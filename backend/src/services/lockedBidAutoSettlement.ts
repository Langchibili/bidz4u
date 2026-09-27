import { convertAmount } from './currencyConversion';
import socketService from './socketService';

export async function autoSettleFromWinningBidDeposit(strapi: any, itemId: number): Promise<boolean> {
  const item = await strapi.db.query('api::auction-item.auction-item').findOne({
    where: { id: itemId },
    populate: { currentWinningBuyer: true, seller: true },
  });
  if (!item || item.actAuctionStatus !== 'payment_pending' || !item.currentWinningBuyer?.id || !item.seller?.id) return false;

  const bid = await strapi.db.query('api::bid.bid').findOne({
    where: { auctionItem: item.id, bidder: item.currentWinningBuyer.id, bidStatus: 'active_leading' },
  });
  const heldAmount = Number(bid?.bidSecuredDepositHeld || 0);
  if (heldAmount <= 0) return false;

  const buyerWallet = await strapi.db.query('api::wallet.wallet').findOne({
    where: { walletOwner: item.currentWinningBuyer.id },
    populate: { currency: true },
  });
  const sellerWallet = await strapi.db.query('api::wallet.wallet').findOne({
    where: { walletOwner: item.seller.id },
    populate: { currency: true },
  });
  if (!buyerWallet || !sellerWallet) return false;

  const depositCurrency = String(bid.bidSecuredDepositCurrencyCode || buyerWallet.currency?.currCode || 'ZMW').toUpperCase();
  const buyerWalletCurrency = String(buyerWallet.currency?.currCode || depositCurrency).toUpperCase();
  const itemCurrency = String(item.actNativeCurrencyCode || '').toUpperCase();
  const salePrice = Number(item.actCurrentHighestPriceNative || 0);
  const heldInItemCurrency = depositCurrency === itemCurrency
    ? heldAmount
    : await convertAmount(heldAmount, depositCurrency, itemCurrency);
  if (heldInItemCurrency < salePrice) return false;

  const depositUsed = Math.min(heldAmount, depositCurrency === itemCurrency
    ? salePrice
    : await convertAmount(salePrice, itemCurrency, depositCurrency));
  const depositExcess = Math.max(0, heldAmount - depositUsed);
  if (Number(buyerWallet.wltLockedEscrowBalance || 0) < heldAmount) {
    throw new Error(`Winning bid deposit missing from locked balance for auction ${item.id}`);
  }

  const sellerCurrency = String(sellerWallet.currency?.currCode || itemCurrency).toUpperCase();
  const sellerEscrowAmount = sellerCurrency === itemCurrency
    ? salePrice
    : await convertAmount(salePrice, itemCurrency, sellerCurrency);

  const didSettle = await strapi.db.transaction(async () => {
    const currentItem = await strapi.db.query('api::auction-item.auction-item').findOne({ where: { id: item.id } });
    if (!currentItem || currentItem.actAuctionStatus !== 'payment_pending') return false;

    await strapi.db.query('api::wallet.wallet').update({
      where: { id: buyerWallet.id },
      data: {
        wltLockedEscrowBalance: Number(buyerWallet.wltLockedEscrowBalance || 0) - heldAmount,
        wltAvailableBalance: Number(buyerWallet.wltAvailableBalance || 0) + depositExcess,
      },
    });
    await strapi.db.query('api::wallet.wallet').update({
      where: { id: sellerWallet.id },
      data: {
        wltLockedEscrowBalance: Number(sellerWallet.wltLockedEscrowBalance || 0) + sellerEscrowAmount,
      },
    });
    await strapi.db.query('api::auction-item.auction-item').update({
      where: { id: item.id },
      data: {
        actAuctionStatus: 'sold',
        actEscrowAmount: sellerEscrowAmount,
        actEscrowCurrencyCode: sellerCurrency,
        actEscrowReleased: false,
        actBuyerConfirmedDelivery: false,
        actSellerConfirmedDelivery: false,
      },
    });
    await strapi.db.query('api::bid.bid').update({
      where: { id: bid.id },
      data: { bidSecuredDepositHeld: 0, bidStatus: 'won_complete' },
    });
    await strapi.db.query('api::transaction.transaction').create({
      data: {
        txReference: `TXN-AUTO-WINNER-DEPOSIT-${item.id}`,
        txAmount: depositUsed,
        txCurrencyCodeAtExecution: depositCurrency,
        txType: 'escrow_release',
        txStatus: 'completed',
        txMeta: { auctionItemId: item.id, appliedToPurchase: true, automaticSettlement: true },
        wallet: buyerWallet.id,
      },
    });
    if (depositExcess > 0) {
      await strapi.db.query('api::transaction.transaction').create({
        data: {
          txReference: `TXN-AUTO-WINNER-EXCESS-${item.id}`,
          txAmount: depositExcess,
          txCurrencyCodeAtExecution: depositCurrency,
          txType: 'escrow_release',
          txStatus: 'completed',
          txMeta: { auctionItemId: item.id, reason: 'winning deposit exceeded purchase price' },
          wallet: buyerWallet.id,
        },
      });
    }
    await strapi.db.query('api::transaction.transaction').create({
      data: {
        txReference: `TXN-AUTO-SELLER-ESCROW-${item.id}`,
        txAmount: sellerEscrowAmount,
        txCurrencyCodeAtExecution: sellerCurrency,
        txType: 'escrow_lock',
        txStatus: 'completed',
        txMeta: { auctionItemId: item.id, buyerId: item.currentWinningBuyer.id, automaticSettlement: true },
        wallet: sellerWallet.id,
      },
    });
    return true;
  });

  if (didSettle) {
    socketService.emitNotification(item.seller.id, {
      title: 'Item sold, delivery needed',
      body: 'The winning bid deposit covered the purchase. Deliver the item so the buyer can confirm receipt and release your funds.',
      data: { kind: 'auction_paid', auctionItemId: item.id, amount: sellerEscrowAmount, currency: sellerCurrency },
    });
    socketService.emitNotification(item.currentWinningBuyer.id, {
      title: 'Payment secured',
      body: 'Your locked bid deposit covered the purchase. Your item is awaiting delivery; confirm receipt after it arrives.',
      data: { kind: 'auction_paid', auctionItemId: item.id, amount: salePrice, currency: itemCurrency },
    });
  }

  return didSettle;
}
