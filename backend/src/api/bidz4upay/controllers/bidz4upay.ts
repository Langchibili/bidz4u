import { factories } from '@strapi/strapi';
import { getPaymentGateway } from '../../../paymentGatewayAdapters';
import { resolveSettingsForCountry } from '../../../services/settingsResolver';
import { convertAmount } from '../../../services/currencyConversion';
import { getAccountPhoneNumber, normalizePhoneNumber } from '../../../services/phoneNumber';
import { getUnreservedLockedBalance } from '../../../services/lockedBidAutoSettlement';
import socketService from '../../../services/socketService';
import { createAndEmitNotification } from '../../../services/notificationService';

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

async function getUserWithCountry(userId: number) {
  return strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: userId },
    select: ['id', 'email', 'username', 'usrPhoneNormalized', 'usrVerifiedPaymentNumbers', 'usrFullName'],
    populate: { country: { populate: { currency: true } }, userWallet: { populate: { currency: true } } },
  });
}

function isVerifiedPaymentPhone(user: any, phone: string, country: any): boolean {
  const normalized = normalizePhoneNumber(phone, country).internationalDigits;
  const accountPhone = normalizePhoneNumber(getAccountPhoneNumber(user, country), country).internationalDigits;
  const verifiedNumbers: string[] = Array.isArray(user.usrVerifiedPaymentNumbers)
    ? user.usrVerifiedPaymentNumbers
    : [];
  return normalized === accountPhone || verifiedNumbers.includes(normalized);
}

async function getWinnerPaymentQuote(auctionItemId: string, winnerId: number) {
  const item = await strapi.db.query('api::auction-item.auction-item').findOne({
    where: { id: auctionItemId },
    populate: { currentWinningBuyer: true, seller: true },
  });
  if (!item || Number(item.currentWinningBuyer?.id) !== Number(winnerId)) return null;
  if (item.actAuctionStatus !== 'payment_pending') return null;

  const winner = await strapi.db.query('plugin::users-permissions.user').findOne({
    where: { id: winnerId },
    populate: { country: { populate: ['currency'] }, userWallet: { populate: ['currency'] } },
  });
  const buyerCurrency = String(winner?.country?.currency?.currCode || '').toUpperCase();
  if (!buyerCurrency) throw new Error('Your account has no payment currency set');

  const wallet = winner?.userWallet;
  const walletCurrency = String(wallet?.currency?.currCode || buyerCurrency).toUpperCase();
  const winningBid = await strapi.db.query('api::bid.bid').findOne({
    where: { auctionItem: item.id, bidder: winnerId, bidStatus: 'active_leading' },
  });
  const lockedHeld = Number(winningBid?.bidSecuredDepositHeld || 0);
  const heldCurrency = String(winningBid?.bidSecuredDepositCurrencyCode || walletCurrency).toUpperCase();
  const price = Number(item.actCurrentHighestPriceNative || 0);
  const itemCurrency = String(item.actNativeCurrencyCode || '').toUpperCase();
  const lockedBalance = Number(wallet?.wltLockedEscrowBalance || 0);
  const lockedAvailable = wallet
    ? await getUnreservedLockedBalance(strapi, winnerId, wallet, Number(winningBid?.id || 0))
    : 0;
  const winningBidHoldInWalletCurrency = heldCurrency === walletCurrency
    ? lockedHeld
    : await convertAmount(lockedHeld, heldCurrency, walletCurrency);
  if (lockedHeld > 0 && lockedAvailable < winningBidHoldInWalletCurrency) {
    throw new Error('The winning bid deposit is not present in locked escrow balance');
  }
  const lockedInItemCurrency = walletCurrency === itemCurrency
    ? lockedAvailable
    : await convertAmount(lockedAvailable, walletCurrency, itemCurrency);
  const walletAppliedInItemCurrency = Math.min(price, lockedInItemCurrency);
  const walletDebit = walletAppliedInItemCurrency > 0
    ? Math.min(lockedAvailable, walletCurrency === itemCurrency
      ? walletAppliedInItemCurrency
      : await convertAmount(walletAppliedInItemCurrency, itemCurrency, walletCurrency))
    : 0;
  const walletRefund = Math.max(0, lockedAvailable - walletDebit);
  const remainingInItemCurrency = Math.max(0, price - walletAppliedInItemCurrency);
  const amountDue = remainingInItemCurrency > 0
    ? await convertAmount(remainingInItemCurrency, itemCurrency, buyerCurrency)
    : 0;

  return {
    item,
    wallet,
    buyerCurrency,
    walletCurrency,
    walletDebit: Math.round(walletDebit * 100) / 100,
    walletHeld: Math.round(lockedAvailable * 100) / 100,
    walletRefund: Math.round(walletRefund * 100) / 100,
    amountDue,
    totalPrice: price,
    itemCurrency,
    walletAppliedInItemCurrency,
  };
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
    await createAndEmitNotification(strapi, Number(userId), {
      title: 'Wallet deposit successful',
      body: `Your wallet deposit of ${depositAmount} ${bidz4upayRecord.payCurrencyCode} completed.`,
      data: { kind: 'payment_success', reference: bidz4upayRecord.payReference, amount: depositAmount },
    });

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
      populate: { currentWinningBuyer: true, seller: true },
    });

    if (!auctionItem) {
      strapi.log.error(`[Bidz4uPay:winnerpay] Auction item ${auctionItemId} not found`);
      return;
    }
    if (auctionItem.actEscrowAmount && Number(auctionItem.actEscrowAmount) > 0) {
      strapi.log.warn(`[Bidz4uPay:winnerpay] Item ${auctionItemId} already sold — duplicate ignored`);
      return;
    }

    const winnerId = auctionItem.currentWinningBuyer?.id;
    if (!winnerId) {
      strapi.log.error(`[Bidz4uPay:winnerpay] No winning buyer on item ${auctionItemId}`);
      return;
    }

    const sellerId = auctionItem.seller?.id;
    const sellerWallet = sellerId
      ? await strapi.db.query('api::wallet.wallet').findOne({ where: { walletOwner: sellerId }, populate: { currency: true } })
      : null;
    if (!sellerWallet) throw new Error(`Seller wallet not found for auction item ${auctionItemId}`);

    const saleAmountNative = Number(auctionItem.actCurrentHighestPriceNative || 0);
    const itemCurrency = String(auctionItem.actNativeCurrencyCode || bidz4upayRecord.payCurrencyCode).toUpperCase();
    const sellerCurrency = String(sellerWallet.currency?.currCode || itemCurrency).toUpperCase();
    const escrowAmount = sellerCurrency === itemCurrency
      ? saleAmountNative
      : await convertAmount(saleAmountNative, itemCurrency, sellerCurrency);
    const lockedBalance = Number(sellerWallet.wltLockedEscrowBalance || 0);

    await strapi.db.transaction(async () => {
      await strapi.db.query('api::wallet.wallet').update({
        where: { id: sellerWallet.id },
        data: { wltLockedEscrowBalance: lockedBalance + escrowAmount },
      });
      await strapi.db.query('api::auction-item.auction-item').update({
        where: { id: auctionItemId },
        data: {
          actAuctionStatus: 'sold',
          actEscrowAmount: escrowAmount,
          actEscrowCurrencyCode: sellerCurrency,
          actEscrowReleased: false,
          actBuyerConfirmedDelivery: false,
          actSellerConfirmedDelivery: false,
        },
      });
      await strapi.db.query('api::transaction.transaction').create({
        data: {
          txReference: `TXN-ESCROW-LOCK-${auctionItemId}-${Date.now()}`,
          txGatewayReference: bidz4upayRecord.payGatewayReference,
          txAmount: escrowAmount,
          txCurrencyCodeAtExecution: sellerCurrency,
          txType: 'escrow_lock',
          txStatus: 'completed',
          txMeta: { ...webhookData, auctionItemId, buyerId: winnerId, saleAmountNative, itemCurrency },
          wallet: sellerWallet.id,
        },
      });
      const walletContribution = Number(bidz4upayRecord.payMetadata?.winnerWalletDebit || 0);
      const walletHeld = Number(bidz4upayRecord.payMetadata?.winnerWalletHeld || 0);
      const winnerWalletId = bidz4upayRecord.payMetadata?.winnerWalletId;
      if (walletHeld > 0 && winnerWalletId) {
        const winnerWallet = await strapi.db.query('api::wallet.wallet').findOne({ where: { id: winnerWalletId } });
        const winnerLockedBalance = Number(winnerWallet?.wltLockedEscrowBalance || 0);
        if (!winnerWallet || winnerLockedBalance < walletHeld) {
          throw new Error('Winning bid deposit changed before payment completed; winner payment needs reconciliation');
        }
        await strapi.db.query('api::wallet.wallet').update({
          where: { id: winnerWalletId },
          data: {
            wltLockedEscrowBalance: winnerLockedBalance - walletHeld,
            wltAvailableBalance: Number(winnerWallet.wltAvailableBalance || 0) + Number(bidz4upayRecord.payMetadata?.winnerWalletRefund || 0),
          },
        });
        if (walletContribution > 0) {
          await strapi.db.query('api::transaction.transaction').create({
            data: {
              txReference: `TXN-WINPAY-WALLET-${auctionItemId}-${Date.now()}`,
              txAmount: walletContribution,
              txCurrencyCodeAtExecution: bidz4upayRecord.payMetadata.winnerWalletCurrency,
              txType: 'escrow_release',
              txStatus: 'completed',
              txMeta: { auctionItemId, saleAmountNative, itemCurrency, appliedToSale: true },
              wallet: winnerWalletId,
            },
          });
        }
        const walletRefund = Number(bidz4upayRecord.payMetadata?.winnerWalletRefund || 0);
        if (walletRefund > 0) {
          await strapi.db.query('api::transaction.transaction').create({
            data: {
              txReference: `TXN-WINPAY-REFUND-${auctionItemId}-${Date.now()}`,
              txAmount: walletRefund,
              txCurrencyCodeAtExecution: bidz4upayRecord.payMetadata.winnerWalletCurrency,
              txType: 'escrow_release',
              txStatus: 'completed',
              txMeta: { auctionItemId, reason: 'winning deposit exceeded purchase price' },
              wallet: winnerWalletId,
            },
          });
        }
        await strapi.db.query('api::bid.bid').update({
          where: { auctionItem: auctionItemId, bidder: winnerId, bidStatus: 'active_leading' },
          data: { bidSecuredDepositHeld: 0, bidStatus: 'won_complete' },
        });
      }
    });

    socketService.emitPaymentSuccess(winnerId, Number(bidz4upayRecord.payAmount), bidz4upayRecord.payReference);
    await createAndEmitNotification(strapi, sellerId, {
      title: 'Item sold, delivery needed',
      body: 'Payment is secured in escrow. Deliver the item so the buyer can confirm receipt and release your funds.',
      data: { kind: 'auction_paid', auctionItemId: Number(auctionItemId), amount: escrowAmount, currency: sellerCurrency },
    });
    await createAndEmitNotification(strapi, winnerId, {
      title: 'Payment secured',
      body: 'Your item is awaiting delivery. Please wait for it to arrive, then confirm receipt to release the seller’s funds.',
      data: { kind: 'auction_paid', auctionItemId: Number(auctionItemId), amount: saleAmountNative, currency: itemCurrency },
    });

    strapi.log.info(`[Bidz4uPay:winnerpay] Winner ${winnerId} settled payment for item ${auctionItemId}`);
  } catch (err) {
    strapi.log.error('[Bidz4uPay:winnerpay]', err);
    throw err;
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
    await createAndEmitNotification(strapi, Number(userId), {
      title: 'Withdrawal completed',
      body: `Your withdrawal of ${bidz4upayRecord.payAmount} ${bidz4upayRecord.payCurrencyCode} completed.`,
      data: { kind: 'payment_success', reference: bidz4upayRecord.payReference, amount: bidz4upayRecord.payAmount },
    });
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
    await createAndEmitNotification(strapi, Number(userId), {
      title: 'Withdrawal failed',
      body: 'Your withdrawal failed. The funds have been returned to your wallet.',
      data: { kind: 'payment_failed', reference: bidz4upayRecord.payReference, amount: bidz4upayRecord.payAmount },
    });
    strapi.log.warn(`[Bidz4uPay:withdraw] Withdrawal failed for user ${userId} — balance refunded`);
  } catch (err) {
    strapi.log.error('[Bidz4uPay:withdrawFailed]', err);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

export default factories.createCoreController('api::bidz4upay.bidz4upay', ({ strapi }) => ({

  async winnerQuote(ctx: any) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Authentication required');
      const quote = await getWinnerPaymentQuote(String(ctx.params.id), userId);
      if (!quote) return ctx.forbidden('This auction is not awaiting payment for your account');

      ctx.send({
        success: true,
        data: {
          amountDue: quote.amountDue,
          currency: quote.buyerCurrency,
          totalPrice: quote.totalPrice,
          itemCurrency: quote.itemCurrency,
          walletApplied: quote.walletAppliedInItemCurrency,
          walletCurrency: quote.walletCurrency,
        },
      });
    } catch (err: any) {
      strapi.log.error('[Bidz4uPay:winnerQuote]', err);
      ctx.internalServerError(err.message || 'Failed to calculate winner payment');
    }
  },

  async paymentPhone(ctx: any) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Authentication required');
      const user = await getUserWithCountry(userId);
      if (!user) return ctx.notFound('User not found');
      const country = user.country;
      const defaultPhone = normalizePhoneNumber(getAccountPhoneNumber(user, country), country);
      ctx.send({
        countryCode: String(country?.countryCode || '').toUpperCase(),
        phoneCode: String(country?.savedPhoneCode || '260').replace(/\D/g, ''),
        phoneNumberDigitLenth: Number(country?.phoneNumberDigitLenth) || 9,
        defaultPhone: defaultPhone.localDigits,
        defaultPhoneInternational: defaultPhone.internationalDigits,
        verifiedPaymentNumbers: Array.isArray(user.usrVerifiedPaymentNumbers)
          ? user.usrVerifiedPaymentNumbers
          : [],
      });
    } catch (error: any) {
      strapi.log.error('[Bidz4uPay:paymentPhone]', error);
      ctx.badRequest(error.message || 'Unable to load payment phone details');
    }
  },

  // ──────────────────────────────────────────────────────────────────────────
  // POST /bidz4upay/initiate   (auth required)
  // ──────────────────────────────────────────────────────────────────────────
  async initiate(ctx: any) {
    let payRecord: any = null;
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

      if (!purpose || (purpose !== 'winnerpay' && !amount)) return ctx.badRequest('purpose and amount are required');
      if (!['walletdeposit', 'winnerpay'].includes(purpose)) return ctx.badRequest('Invalid purpose');
      if (!['mobile_money', 'card'].includes(paymentType)) return ctx.badRequest('Invalid paymentType');
      if (paymentType === 'card') {
        if (!card?.number || !card?.expiryMonth || !card?.expiryYear || !card?.cvv) {
          return ctx.badRequest('Complete card number, expiry and security code');
        }
        if (!cardCustomer?.firstName || !cardCustomer?.lastName) {
          return ctx.badRequest('Cardholder first and last name are required');
        }
        if (!billing?.streetAddress || !billing?.city || !billing?.postalCode) {
          return ctx.badRequest('Complete the card billing address');
        }
      }

      let numAmount = Number(amount || 0);
      if (!Number.isFinite(numAmount) || numAmount < 0 || (purpose === 'walletdeposit' && numAmount <= 0)) {
        return ctx.badRequest('amount must be a positive number');
      }
      let paymentMetadata = metadata;
      if (purpose === 'winnerpay') {
        if (!relatedEntityId) return ctx.badRequest('relatedEntityId is required for winnerpay');
        const quote = await getWinnerPaymentQuote(String(relatedEntityId), userId);
        if (!quote) {
          return ctx.forbidden('Only the winning bidder can make this payment');
        }
        numAmount = quote.amountDue;
        if (quote.walletDebit > 0 && quote.wallet?.id) {
          const currentWallet = await strapi.db.query('api::wallet.wallet').findOne({ where: { id: quote.wallet.id } });
          const locked = Number(currentWallet?.wltLockedEscrowBalance || 0);
          if (!currentWallet || locked < quote.walletHeld) return ctx.badRequest('Locked wallet balance changed; refresh and try again');
        }
        paymentMetadata = {
          ...metadata,
          winnerWalletId: quote.wallet?.id || null,
          winnerWalletDebit: quote.walletDebit,
          winnerWalletHeld: quote.walletHeld,
          winnerWalletRefund: quote.walletRefund,
          winnerWalletCurrency: quote.walletCurrency,
        };
      }
      const user = await getUserWithCountry(userId);
      const userCountry = user?.country;
      const countryCode = (userCountry?.countryCode || 'zm').toLowerCase();
      const currencyCode = (userCountry?.currency?.currCode || 'ZMW').toUpperCase();
      let formattedPhone = '';
      let phoneDigits = '';
      const requiresPhone = paymentType === 'mobile_money'
        && (purpose === 'walletdeposit' || (purpose === 'winnerpay' && numAmount > 0));
      if (requiresPhone) {
        try {
          const normalized = normalizePhoneNumber(phone || user?.usrPhoneNormalized || user?.username, userCountry);
          if (!isVerifiedPaymentPhone(user, normalized.internationalDigits, userCountry)) {
            return ctx.forbidden('Verify this phone number before using it for payment');
          }
          formattedPhone = normalized.e164;
          phoneDigits = normalized.internationalDigits;
        } catch (error: any) {
          return ctx.badRequest(error.message || 'Enter a valid phone number');
        }
      }

      const settings = await resolveSettingsForCountry(strapi, userCountry?.id);
      const gatewayName = String(settings.paymentGateway || 'pawapay');
      if (paymentType === 'card' && gatewayName !== 'lenco') {
        return ctx.badRequest('Card payments are not available with this country’s payment provider');
      }
      const gateway = getPaymentGateway(gatewayName);

      const reference = buildReference(userId, purpose, phoneDigits || user?.username || '');
      const paymentId = `BID4U-${Date.now()}`;

      payRecord = await strapi.db.query('api::bidz4upay.bidz4upay').create({
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
          payMetadata: { ...paymentMetadata },
          payNotes: narration || null,
        },
      });

      if (purpose === 'winnerpay' && numAmount === 0) {
        const completedRecord = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({ where: { id: payRecord.id } });
        await handleWinnerPaymentSuccess(completedRecord, String(relatedEntityId), { walletOnly: true });
        await strapi.db.query('api::bidz4upay.bidz4upay').update({
          where: { id: payRecord.id },
          data: { payStatus: 'completed', payCompletedAt: new Date() },
        });
        return ctx.send({ success: true, data: { paymentId, reference, amount: 0, paymentStatus: 'completed' } });
      }

      const result: any = await gateway.initiatePayment({
        reference,
        amount: numAmount,
        currency: currencyCode,
        phone: formattedPhone,
        paymentType,
        operator,
        country: countryCode,
        email: user?.email || undefined,
        customer: paymentType === 'card' ? cardCustomer : undefined,
        card: paymentType === 'card' ? card : undefined,
        billing: paymentType === 'card' ? billing : undefined,
        redirectUrl: paymentType === 'card' ? redirectUrl : undefined,
        narration: narration || purposeToNarration(purpose),
        metadata: { bidz4upayId: payRecord.id, userId, purpose, relatedEntityId },
      });

      const gatewayStatus = String(result.status || 'pending').toLowerCase();
      const immediateSuccess = gatewayStatus === 'successful' || gatewayStatus === 'completed';
      const immediateFailure = gatewayStatus === 'failed' || gatewayStatus === 'rejected';
      const referenceData = parseReference(reference);
      await strapi.db.query('api::bidz4upay.bidz4upay').update({
        where: { id: payRecord.id },
        data: {
          payGatewayReference: result.gatewayReference,
          payGatewayResponse: result.raw || null,
          payMethod: paymentType === 'card' ? 'card' : 'mobile_money',
          ...(immediateSuccess ? { payStatus: 'completed', payCompletedAt: new Date() } : {}),
          ...(immediateFailure ? {
            payStatus: 'failed',
            payFailedAt: new Date(),
            payFailureReason: result.raw?.reasonForFailure || 'Payment failed',
          } : {}),
        },
      });

      if ((immediateSuccess || immediateFailure) && referenceData) {
        const updatedRecord = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({
          where: { id: payRecord.id },
        });
        if (immediateSuccess) {
          await handleCollectionSuccess(updatedRecord, referenceData, result.raw || {});
        } else {
          socketService.emitPaymentFailed(userId, numAmount, reference);
          await createAndEmitNotification(strapi, userId, {
            title: 'Payment failed',
            body: result.raw?.reasonForFailure || 'Your payment could not be completed.',
            data: { kind: 'payment_failed', reference, amount: numAmount },
          });
        }
      }

      ctx.send({
        success: true,
        data: {
          paymentId,
          reference,
          gatewayStatus,
          paymentStatus: immediateSuccess ? 'completed' : immediateFailure ? 'failed' : undefined,
          failureReason: immediateFailure ? result.raw?.reasonForFailure || 'Payment failed' : undefined,
          immediateFailure,
          redirectUrl: result.redirectUrl || undefined,
          gatewayName,
          amount: numAmount,
        },
      });
    } catch (err: any) {
      if (payRecord?.id) {
        try {
          await strapi.db.query('api::bidz4upay.bidz4upay').update({
            where: { id: payRecord.id },
            data: { payStatus: 'failed', payFailedAt: new Date(), payFailureReason: err.message || 'Payment initiation failed' },
          });
        } catch (recordError) {
          strapi.log.error('[Bidz4uPay:initiate] Failed to mark payment failed', recordError);
        }
      }
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
      let record = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({
        where: { payReference: reference, user: userId },
      });
      if (!record) return ctx.notFound('Payment record not found');

      if (['pending', 'processing'].includes(record.payStatus) && record.payGatewayName === 'lenco') {
        const gateway = getPaymentGateway('lenco') as any;
        if (typeof gateway.getCollectionStatus === 'function') {
          const statusResult = await gateway.getCollectionStatus(record.payReference);
          const status = String(statusResult.status || '').toLowerCase();
          const gatewayData = statusResult.data || {};

          if (status === 'successful') {
            const parsed = parseReference(record.payReference);
            if (!parsed) return ctx.badRequest('Invalid payment reference');
            await strapi.db.query('api::bidz4upay.bidz4upay').update({
              where: { id: record.id },
              data: {
                payGatewayReference: (gatewayData as any).id || record.payGatewayReference,
                payGatewayResponse: gatewayData,
                payMethod: resolvePaymentMethod(gatewayData),
              },
            });
            record = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({ where: { id: record.id } });
            if (parsed.purpose === 'winnerpay') {
              await handleWinnerPaymentSuccess(record, String(record.payRelatedEntityId), gatewayData);
            } else {
              await handleCollectionSuccess(record, parsed, gatewayData);
            }
            await strapi.db.query('api::bidz4upay.bidz4upay').update({
              where: { id: record.id },
              data: { payStatus: 'completed', payCompletedAt: new Date() },
            });
          } else if (status === 'failed') {
            await strapi.db.query('api::bidz4upay.bidz4upay').update({
              where: { id: record.id },
              data: {
                payStatus: 'failed',
                payGatewayReference: (gatewayData as any).id || record.payGatewayReference,
                payGatewayResponse: gatewayData,
                payFailedAt: new Date(),
                payFailureReason: (gatewayData as any).reasonForFailure || 'Payment failed',
              },
            });
            socketService.emitPaymentFailed(userId, Number(record.payAmount), record.payReference);
            await createAndEmitNotification(strapi, userId, {
              title: 'Payment failed',
              body: (gatewayData as any).reasonForFailure || 'Your payment could not be completed.',
              data: { kind: 'payment_failed', reference: record.payReference, amount: record.payAmount },
            });
          }

          record = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({ where: { id: record.id } });
        }
      }

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
            payGatewayResponse: data,
            payMethod: paymentMethod,
          },
        });

        const updated = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({ where: { id: payRecord.id } });
        if (parsed.purpose === 'winnerpay') {
          await handleWinnerPaymentSuccess(updated, String(updated.payRelatedEntityId), data);
          await strapi.db.query('api::bidz4upay.bidz4upay').update({
            where: { id: payRecord.id },
            data: { payStatus: 'completed', payCompletedAt: new Date() },
          });
        } else {
          await strapi.db.query('api::bidz4upay.bidz4upay').update({
            where: { id: payRecord.id },
            data: { payStatus: 'completed', payCompletedAt: new Date() },
          });
          await handleCollectionSuccess(updated, parsed, data);
        }
      } else if (gateway.isCollectionFailed(event, data)) {
        if (payRecord.payStatus === 'failed') return;
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
          await createAndEmitNotification(strapi, Number(payRecord.user), {
            title: 'Payment failed',
            body: (data as any).reasonForFailure || 'Your payment could not be completed.',
            data: { kind: 'payment_failed', reference: payRecord.payReference, amount: payRecord.payAmount },
          });
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
      const currencyCode = (userCountry?.currency?.currCode || 'ZMW').toUpperCase();
      let formattedPhone = '';
      if (method === 'mobile_money') {
        try {
          const normalized = normalizePhoneNumber(phone, userCountry);
          if (!isVerifiedPaymentPhone(user, normalized.internationalDigits, userCountry)) {
            return ctx.forbidden('Verify this phone number before using it for withdrawal');
          }
          formattedPhone = normalized.e164;
        } catch (error: any) {
          return ctx.badRequest(error.message || 'Enter a valid withdrawal phone number');
        }
      }

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

      const reference = buildReference(
        userId,
        'withdraw',
        method === 'mobile_money' ? formattedPhone.replace(/\D/g, '') : accountNumber,
      );
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
        method,
        operator,
        country: countryCode,
        accountNumber,
        bankId,
      });

      const payoutStatus = result.status === 'completed'
        ? 'completed'
        : result.status === 'failed' ? 'failed' : 'processing';
      await strapi.db.query('api::bidz4upay.bidz4upay').update({
        where: { id: payRecord.id },
        data: {
          payGatewayReference: result.gatewayReference,
          payGatewayResponse: result.raw || null,
          payStatus: payoutStatus,
          ...(payoutStatus === 'completed' ? { payCompletedAt: new Date() } : {}),
          ...(payoutStatus === 'failed' ? {
            payFailedAt: new Date(),
            payFailureReason: result.raw?.reasonForFailure || 'Withdrawal failed',
          } : {}),
        },
      });

      if (payoutStatus === 'completed' || payoutStatus === 'failed') {
        const completedRecord = await strapi.db.query('api::bidz4upay.bidz4upay').findOne({
          where: { id: payRecord.id },
        });
        if (payoutStatus === 'completed') {
          await handleWithdrawalCompleted(completedRecord, String(userId), result.raw || {});
        } else {
          await handleWithdrawalFailed(completedRecord, String(userId), result.raw || {});
        }
      }

      strapi.log.info(`[Bidz4uPay:requestWithdrawal] Withdrawal ${payRecord.id} initiated for user ${userId}, amount ${numAmount}`);

      ctx.send({
        success: true,
        data: { paymentId, reference, status: payoutStatus, paymentStatus: payoutStatus, amount: numAmount, message: 'Withdrawal initiated.' },
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