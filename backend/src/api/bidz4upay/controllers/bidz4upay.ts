import { factories } from '@strapi/strapi';
import { getPaymentGateway } from '../../../paymentGatewayAdapters';
import { resolveSettingsForCountry } from '../../../services/settingsResolver';
import socketService from '../../../services/socketService';

// ─── Reference helpers ────────────────────────────────────────────────────────

interface ParsedReference {
  contextId: string;
  purpose: string;
  phone: string;
  timestamp: string;
}

function buildReference(contextId: number | string, purpose: string, phone: string): string {
  return `ref-id-${contextId}-purpose-${purpose}-${phone}-${Date.now()}`;
}

function parseReference(reference: string): ParsedReference | null {
  const match = reference.match(/^ref-id-(\d+)-purpose-([a-zA-Z]+)-([0-9]*)-(\d+)$/);
  if (!match) return null;
  return { contextId: match[1], purpose: match[2], phone: match[3], timestamp: match[4] };
}

function purposeToEntityType(purpose: string): string {
  const map: Record<string, string> = {
    walletdeposit: 'wallet_deposit',
    winnerpay: 'auction_item',
    withdraw: 'withdrawal',
  };
  return map[purpose] || '';
}

function purposeToNarration(purpose: string): string {
  const map: Record<string, string> = {
    walletdeposit: 'Wallet deposit — bidz4u',
    winnerpay: 'Auction winner payment — bidz4u',
    withdraw: 'Withdrawal — bidz4u',
  };
  return map[purpose] || 'bidz4u payment';
}

function resolvePaymentMethod(data: Record<string, unknown>): 'mobile_money' | 'card' | 'bank_account' {
  if ((data as any).cardDetails) return 'card';
  if ((data as any).bankAccountDetails) return 'bank_account';
  return 'mobile_money';
}

function normalisePhone(phone: string, phoneCode: string): string {
  const code = String(phoneCode).replace(/\D/g, '');
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith(code)) digits = digits.slice(code.length);
  digits = digits.replace(/^0+/, '');
  return `${code}${digits.slice(-9)}`;
}

async function getUserWithCountry(userId: number) {
  return strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    select: ['id', 'email', 'username', 'usrFullName'],
    populate: { country: { populate: { currency: true } }, userWallet: true },
  });
}

// ─── Domain handlers ───────────────────────────────────────────────────────────

async function handleCollectionSuccess(
  bidz4upayRecord: any,
  parsed: ParsedReference,
  webhookData: Record<string, unknown>,
): Promise<void> {
  switch (parsed.purpose) {
    case 'walletdeposit':
      await handleWalletDepositSuccess(bidz4upayRecord, parsed.contextId, webhookData);
      break;
    case 'winnerpay':
      await handleWinnerPaymentSuccess(bidz4upayRecord, parsed.contextId, webhookData);
      break;
    default:
      strapi.log.warn(`[Bidz4uPay] Unhandled purpose '${parsed.purpose}' ref ${bidz4upayRecord.payReference}`);
  }
}

// ─── Wallet deposit ────────────────────────────────────────────────────────────

async function handleWalletDepositSuccess(
  bidz4upayRecord: any,
  userId: string,
  webhookData: Record<string, unknown>,
): Promise<void> {
  try {
    const user = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: userId },
      select: ['id', 'usrFullName', 'username'],
      populate: { userWallet: true },
    });

    if (!user?.userWallet) {
      strapi.log.error(`[Bidz4uPay:walletdeposit] Wallet not found for user ${userId}`);
      return;
    }

    const currentBalance = parseFloat(user.userWallet.wltAvailableBalance || '0');
    const depositAmount = parseFloat(bidz4upayRecord.payAmount);
    const newBalance = currentBalance + depositAmount;

    await strapi.db.query('api::wallet.wallet').update({
      where: { id: user.userWallet.id },
      data: { wltAvailableBalance: newBalance },
    });

    await strapi.db.query('api::transaction.transaction').create({
      data: {
        txReference: `TXN-DEP-${Date.now()}`,
        txGatewayReference: bidz4upayRecord.payGatewayReference,
        txAmount: depositAmount,
        txCurrencyCodeAtExecution: bidz4upayRecord.payCurrencyCode,
        txType: 'deposit',
        txStatus: 'completed',
        txMeta: webhookData,
        wallet: user.userWallet.id,
      },
    });

    socketService.emitPaymentSuccess(parseInt(userId), depositAmount, bidz4upayRecord.payReference);

    strapi.log.info(`[Bidz4uPay:walletdeposit] +${depositAmount} → user ${userId}, new balance ${newBalance}`);
  } catch (err) {
    strapi.log.error('[Bidz4uPay:walletdeposit]', err);
  }
}

// ─── Auction winner payment ─────────────────────────────────────────────────────
//
// relatedEntityId is the auction-item ID. Winner pays the remaining balance
// (post-deposit) to fully settle the purchase — moves the item into escrow release.

async function handleWinnerPaymentSuccess(
  bidz4upayRecord: any,
  auctionItemId: string,
  webhookData: Record<string, unknown>,
): Promise<void> {
  try {
    const auctionItem = await strapi.db.query('api::auction-item.auction-item').findOne({
      where: { id: auctionItemId },
      populate: { currentWinningBuyer: true },
    });

    if (!auctionItem) {
      strapi.log.error(`[Bidz4uPay:winnerpay] Auction item ${auctionItemId} not found`);
      return;
    }
    if (auctionItem.actAuctionStatus === 'sold') {
      strapi.log.warn(`[Bidz4uPay:winnerpay] Item ${auctionItemId} already sold — duplicate ignored`);
      return;
    }

    const winnerId = auctionItem.currentWinningBuyer?.id;
    if (!winnerId) {
      strapi.log.error(`[Bidz4uPay:winnerpay] No winning buyer on item ${auctionItemId}`);
      return;
    }

    // Move out of payment_pending — awaiting delivery confirmation from both sides
    await strapi.db.query('api::auction-item.auction-item').update({
      where: { id: auctionItemId },
      data: { actAuctionStatus: 'payment_pending' },
    });

    const winnerWallet = await strapi.db.query('api::wallet.wallet').findOne({ where: { walletOwner: winnerId } });

    await strapi.db.query('api::transaction.transaction').create({
      data: {
        txReference: `TXN-WINPAY-${Date.now()}`,
        txGatewayReference: bidz4upayRecord.payGatewayReference,
        txAmount: bidz4upayRecord.payAmount,
        txCurrencyCodeAtExecution: bidz4upayRecord.payCurrencyCode,
        txType: 'escrow_lock',
        txStatus: 'completed',
        txMeta: webhookData,
        wallet: winnerWallet?.id,
      },
    });

    socketService.emitPaymentSuccess(winnerId, Number(bidz4upayRecord.payAmount), bidz4upayRecord.payReference);

    strapi.log.info(`[Bidz4uPay:winnerpay] Winner ${winnerId} settled payment for item ${auctionItemId}`);
  } catch (err) {
    strapi.log.error('[Bidz4uPay:winnerpay]', err);
  }
}

// ─── Withdrawal ────────────────────────────────────────────────────────────────

async function handleWithdrawalCompleted(
  bidz4upayRecord: any,
  userId: string,
  webhookData: Record<string, unknown>,
): Promise<void> {
  try {
    await strapi.db.query('api::transaction.transaction').create({
      data: {
        txReference: `TXN-WD-${Date.now()}`,
        txGatewayReference: bidz4upayRecord.payGatewayReference,
        txAmount: bidz4upayRecord.payAmount,
        txCurrencyCodeAtExecution: bidz4upayRecord.payCurrencyCode,
        txType: 'withdrawal',
        txStatus: 'completed',
        txMeta: webhookData,
        wallet: (await strapi.db.query('api::wallet.wallet').findOne({ where: { walletOwner: userId } }))?.id,
      },
    });

    socketService.emitPaymentSuccess(parseInt(userId), Number(bidz4upayRecord.payAmount), bidz4upayRecord.payReference);
    strapi.log.info(`[Bidz4uPay:withdraw] Withdrawal completed for user ${userId}`);
  } catch (err) {
    strapi.log.error('[Bidz4uPay:withdraw]', err);
  }
}

async function handleWithdrawalFailed(
  bidz4upayRecord: any,
  userId: string,
  webhookData: Record<string, unknown>,
): Promise<void> {
  try {
    const wallet = await strapi.db.query('api::wallet.wallet').findOne({ where: { walletOwner: userId } });
    if (wallet) {
      await strapi.db.query('api::wallet.wallet').update({
        where: { id: wallet.id },
        data: { wltAvailableBalance: Number(wallet.wltAvailableBalance) + Number(bidz4upayRecord.payAmount) },
      });
    }

    await strapi.db.query('api::transaction.transaction').create({
      data: {
        txReference: `TXN-WDFAIL-${Date.now()}`,
        txGatewayReference: bidz4upayRecord.payGatewayReference,
        txAmount: bidz4upayRecord.payAmount,
        txCurrencyCodeAtExecution: bidz4upayRecord.payCurrencyCode,
        txType: 'refund',
        txStatus: 'reversed',
        txMeta: webhookData,
        wallet: wallet?.id,
      },
    });

    socketService.emitPaymentFailed(
      parseInt(userId),
      Number(bidz4upayRecord.payAmount),
      bidz4upayRecord.payReference,
    );
    strapi.log.warn(`[Bidz4uPay:withdraw] Withdrawal failed for user ${userId} — balance refunded`);
  } catch (err) {
    strapi.log.error('[Bidz4uPay:withdrawFailed]', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export default factories.createCoreController('api::bidz4upay.bidz4upay', ({ strapi }) => ({

  // ──────────────────────────────────────────────────────────────────────────
  // POST /bidz4upay/initiate   (auth required)
  // ──────────────────────────────────────────────────────────────────────────
  async initiate(ctx: any) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Authentication required');

      const {
        purpose,          // 'walletdeposit' | 'winnerpay'
        amount,
        relatedEntityId,  // auction-item id for winnerpay
        metadata = {},
        paymentType = 'mobile_money',
        phone = '',
        operator = '',
        customer: cardCustomer,
        card,
        billing,
        redirectUrl,
        narration,
        channels,
        callbackUrl,
      } = ctx.request.body as Record<string, any>;

      if (!purpose || !amount) return ctx.badRequest('purpose and amount are required');
      if (!['walletdeposit', 'winnerpay'].includes(purpose)) return ctx.badRequest('Invalid purpose');

      const numAmount = parseFloat(amount);
      if (!Number.isFinite(numAmount) || numAmount <= 0) return ctx.badRequest('amount must be a positive number');
      if (purpose === 'winnerpay') {
        if (!relatedEntityId) return ctx.badRequest('relatedEntityId is required for winnerpay');
        const auctionItem = await strapi.db.query('api::auction-item.auction-item').findOne({
          where: { id: relatedEntityId },
          populate: { currentWinningBuyer: true },
        });
        if (!auctionItem || auctionItem.currentWinningBuyer?.id !== userId) {
          return ctx.forbidden('Only the winning bidder can make this payment');
        }
        if (auctionItem.actAuctionStatus !== 'payment_pending') {
          return ctx.badRequest('This auction is not awaiting payment');
        }
      }
      const user = await getUserWithCountry(userId);
      const userCountry = user?.country;
      const countryCode = (userCountry?.countryCode || 'zm').toLowerCase();
      const phoneCode = (userCountry?.savedPhoneCode || '260').replace(/\D/g, '');
      const currencyCode = (userCountry?.currency?.currCode || 'ZMW').toUpperCase();
      const formattedPhone = phone ? normalisePhone(phone, phoneCode) : '';

      const settings = await resolveSettingsForCountry(strapi, userCountry?.id);
      const gatewayName = String(settings.paymentGateway || 'pawapay');
      const gateway = getPaymentGateway(gatewayName);

      const reference = buildReference(userId, purpose, formattedPhone || user?.username || '');
      const paymentId = `BID4U-${Date.now()}`;

      const payRecord = await strapi.db.query('api::bidz4upay.bidz4upay').create({
        data: {
          payPaymentId: paymentId,
          payReference: reference,
          user: userId,
          payPurpose: purpose,
          payDirection: 'collection',
          payAmount: numAmount,
          payCurrencyCode: currencyCode,
          payStatus: 'pending',
          payGatewayName: gatewayName,
          payRelatedEntityType: purposeToEntityType(purpose),
          payRelatedEntityId: relatedEntityId ? String(relatedEntityId) : null,
          payInitiatedAt: new Date(),
          payIpAddress: ctx.request.ip,
          payMetadata: { ...metadata },
          payNotes: narration || null,
        },
      });

      const result: any = await gateway.initiatePayment({
        reference,
        amount: numAmount,
        currency: currencyCode,
        phone: formattedPhone,
        narration: narration || purposeToNarration(purpose),
        metadata: { bidz4upayId: payRecord.id, userId, purpose, relatedEntityId },
      });

      await strapi.db.query('api::bidz4upay.bidz4upay').update({
        where: { id: payRecord.id },
        data: { payGatewayReference: result.gatewayReference },
      });

      ctx.send({
        success: true,
        data: {
          paymentId,
          reference,
          gatewayStatus: result.status,
          gatewayName,
          amount: numAmount,
        },
      });
    } catch (err: any) {
      strapi.log.error('[Bidz4uPay:initiate]', err);
      ctx.internalServerError(err.message || 'Failed to initiate payment');
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GET /bidz4upay/status/:reference   (auth required)
  // ──────────────────────────────────────────────────────────────────────────
  async getPaymentStatus(ctx: any) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Authentication required');

      const { reference } = ctx.params;
      const record = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({
        where: { payReference: reference, user: userId },
      });
      if (!record) return ctx.notFound('Payment record not found');

      ctx.send({
        paymentId: record.payPaymentId,
        reference: record.payReference,
        purpose: record.payPurpose,
        amount: record.payAmount,
        paymentStatus: record.payStatus,
        paymentMethod: record.payMethod,
        initiatedAt: record.payInitiatedAt,
        completedAt: record.payCompletedAt,
        failedAt: record.payFailedAt,
        failureReason: record.payFailureReason,
      });
    } catch (err) {
      strapi.log.error('[Bidz4uPay:getPaymentStatus]', err);
      ctx.internalServerError('Failed to get payment status');
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // POST /bidz4upay/webhook/:gateway   (inbound collection webhook — no auth)
  // ──────────────────────────────────────────────────────────────────────────
  async webhook(ctx: any) {
    ctx.status = 200;
    ctx.body = { received: true };

    try {
      const { gateway: gatewayName } = ctx.params;
      const gateway = getPaymentGateway(gatewayName);

      const rawBody = ctx.request.body?.[Symbol.for('unparsedBody')] || JSON.stringify(ctx.request.body);
      const verified = gateway.verifyWebhook(ctx.request.headers as any, rawBody);
      if (!verified.valid) {
        strapi.log.warn('[Bidz4uPay:webhook] Invalid signature');
        return;
      }

      const { event, data } = verified;
      const reference = gateway.extractReference(data);
      if (!reference) return;

      const parsed = parseReference(reference);
      if (!parsed) {
        strapi.log.warn(`[Bidz4uPay:webhook] Cannot parse reference '${reference}'`);
        return;
      }

      const payRecord = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({ where: { payReference: reference } });
      if (!payRecord) {
        strapi.log.warn(`[Bidz4uPay:webhook] No record for reference '${reference}'`);
        return;
      }

      const paymentMethod = resolvePaymentMethod(data);

      if (gateway.isCollectionSuccess(event, data)) {
        if (payRecord.payStatus === 'completed') return;

        await strapi.db.query('api::bidz4upay.bidz4upay').update({
          where: { id: payRecord.id },
          data: {
            payStatus: 'completed',
            payGatewayResponse: data,
            payMethod: paymentMethod,
            payCompletedAt: new Date(),
          },
        });

        const updated = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({ where: { id: payRecord.id } });
        await handleCollectionSuccess(updated, parsed, data);
      } else if (gateway.isCollectionFailed(event, data)) {
        await strapi.db.query('api::bidz4upay.bidz4upay').update({
          where: { id: payRecord.id },
          data: {
            payStatus: 'failed',
            payGatewayResponse: data,
            payFailedAt: new Date(),
            payFailureReason: (data as any).reasonForFailure || 'Payment failed',
          },
        });

        if (payRecord.user) {
          socketService.emitPaymentFailed(
            payRecord.user,
            Number(payRecord.payAmount),
            payRecord.payReference,
          );
        }
      }
    } catch (err) {
      strapi.log.error('[Bidz4uPay:webhook]', err);
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // POST /bidz4upay/webhook/:gateway/withdraw   (inbound payout webhook — no auth)
  // ──────────────────────────────────────────────────────────────────────────
  async withdrawWebhook(ctx: any) {
    ctx.status = 200;
    ctx.body = { received: true };

    try {
      const { gateway: gatewayName } = ctx.params;
      const gateway = getPaymentGateway(gatewayName);

      const rawBody = ctx.request.body?.[Symbol.for('unparsedBody')] || JSON.stringify(ctx.request.body);
      const verified = gateway.verifyWebhook(ctx.request.headers as any, rawBody);
      if (!verified.valid) return;

      const { event, data } = verified;
      const reference = gateway.extractReference(data);
      if (!reference) return;

      const parsed = parseReference(reference);
      if (!parsed || parsed.purpose !== 'withdraw') return;

      const payRecord = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({ where: { payReference: reference } });
      if (!payRecord) return;

      if (gateway.isPayoutCompleted(event, data)) {
        if (payRecord.payStatus === 'completed') return;

        await strapi.db.query('api::bidz4upay.bidz4upay').update({
          where: { id: payRecord.id },
          data: { payStatus: 'completed', payGatewayResponse: data, payCompletedAt: new Date() },
        });

        await handleWithdrawalCompleted(payRecord, String(payRecord.user), data);
      } else if (gateway.isPayoutFailed(event, data)) {
        await strapi.db.query('api::bidz4upay.bidz4upay').update({
          where: { id: payRecord.id },
          data: {
            payStatus: 'failed',
            payGatewayResponse: data,
            payFailedAt: new Date(),
            payFailureReason: (data as any).reasonForFailure || 'Withdrawal failed',
          },
        });

        await handleWithdrawalFailed(payRecord, String(payRecord.user), data);
      }
    } catch (err) {
      strapi.log.error('[Bidz4uPay:withdrawWebhook]', err);
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // POST /bidz4upay/request-withdrawal   (auth required)
  // ──────────────────────────────────────────────────────────────────────────
  async requestWithdrawal(ctx: any) {
    let wallet: any = null;
    let currentBalance = 0;
    let payRecord: any = null;

    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Authentication required');

      const { amount, method = 'mobile_money', narration, phone = '', operator = '', accountName = '', accountNumber = '', bankId = '' } =
        ctx.request.body as Record<string, any>;

      if (!amount) return ctx.badRequest('amount is required');
      if (method === 'mobile_money' && (!phone || !operator)) {
        return ctx.badRequest('phone and operator are required for mobile_money withdrawals');
      }
      if (method === 'bank_account' && (!accountNumber || !bankId || !accountName)) {
        return ctx.badRequest('accountNumber, bankId and accountName are required for bank_account withdrawals');
      }

      const numAmount = parseFloat(amount);
      const user = await getUserWithCountry(userId);
      const userCountry = user?.country;
      const countryCode = (userCountry?.countryCode || 'zm').toLowerCase();
      const phoneCode = (userCountry?.savedPhoneCode || '260').replace(/\D/g, '');
      const currencyCode = (userCountry?.currency?.currCode || 'ZMW').toUpperCase();
      const formattedPhone = phone ? normalisePhone(phone, phoneCode) : '';

      const settings = await resolveSettingsForCountry(strapi, userCountry?.id);
      const gatewayName = String(settings.paymentGateway || 'pawapay');

      wallet = user?.userWallet;
      if (!wallet) return ctx.badRequest('Wallet not found');

      currentBalance = parseFloat(wallet.wltAvailableBalance || '0');
      if (currentBalance < numAmount) {
        return ctx.badRequest(`Insufficient wallet balance. Available: ${currentBalance}`);
      }

      // Optimistic deduction
      const newBalance = currentBalance - numAmount;
      await strapi.db.query('api::wallet.wallet').update({
        where: { id: wallet.id },
        data: { wltAvailableBalance: newBalance },
      });

      const reference = buildReference(userId, 'withdraw', method === 'mobile_money' ? formattedPhone : accountNumber);
      const paymentId = `BID4U-WD-${Date.now()}`;

      payRecord = await strapi.db.query('api::bidz4upay.bidz4upay').create({
        data: {
          payPaymentId: paymentId,
          payReference: reference,
          user: userId,
          payPurpose: 'withdraw',
          payDirection: 'payout',
          payAmount: numAmount,
          payCurrencyCode: currencyCode,
          payStatus: 'processing',
          payGatewayName: gatewayName,
          payRelatedEntityType: 'wallet',
          payRelatedEntityId: String(wallet.id),
          payInitiatedAt: new Date(),
          payIpAddress: ctx.request.ip,
        },
      });

      const gateway = getPaymentGateway(gatewayName);
      const result: any = await gateway.initiatePayout({
        reference,
        amount: numAmount,
        currency: currencyCode,
        narration: narration || `Withdrawal for user ${userId}`,
        phone: formattedPhone || accountNumber,
      });

      await strapi.db.query('api::bidz4upay.bidz4upay').update({
        where: { id: payRecord.id },
        data: { payGatewayReference: result.gatewayReference },
      });

      strapi.log.info(`[Bidz4uPay:requestWithdrawal] Withdrawal ${payRecord.id} initiated for user ${userId}, amount ${numAmount}`);

      ctx.send({
        success: true,
        data: { paymentId, reference, status: 'processing', amount: numAmount, message: 'Withdrawal initiated.' },
      });
    } catch (err: any) {
      strapi.log.error('[Bidz4uPay:requestWithdrawal]', err);

      // Rollback deducted balance
      if (wallet?.id && currentBalance > 0) {
        try {
          await strapi.db.query('api::wallet.wallet').update({
            where: { id: wallet.id },
            data: { wltAvailableBalance: currentBalance },
          });
        } catch (rollbackErr) {
          strapi.log.error('[Bidz4uPay:requestWithdrawal] Balance rollback failed:', rollbackErr);
        }
      }

      if (payRecord?.id) {
        try {
          await strapi.db.query('api::bidz4upay.bidz4upay').update({
            where: { id: payRecord.id },
            data: { payStatus: 'failed', payFailedAt: new Date(), payFailureReason: err.message || 'Gateway error' },
          });
        } catch { /* non-fatal */ }
      }

      ctx.internalServerError(err.message || 'Failed to initiate withdrawal');
    }
  },
}));