import { convertAmount } from './currencyConversion';

export async function closeAuctionAndRefundNonWinners(strapi: any, item: any, status: string) {
  const hasWinner = !!item.currentWinningBuyer;
  const winnerId = item.currentWinningBuyer?.id;
  const bids: any[] = await strapi.db.query('api::bid.bid').findMany({
    where: { auctionItem: item.id },
    populate: { bidder: true },
  });
  const refunds: any[] = [];

  for (const bid of bids) {
    if (hasWinner && Number(bid.bidder?.id) === Number(winnerId)) continue;
    const heldAmount = Number(bid.bidSecuredDepositHeld || 0);
    if (heldAmount <= 0) continue;
    if (!bid.bidder?.id) throw new Error(`Bid ${bid.id} has a hold but no bidder`);

    const wallet = await strapi.db.query('api::wallet.wallet').findOne({
      where: { walletOwner: bid.bidder.id },
      populate: { currency: true },
    });
    if (!wallet) throw new Error(`Wallet not found for bidder ${bid.bidder.id}`);
    const holdCurrency = String(bid.bidSecuredDepositCurrencyCode || bid.bidLocalCurrencyCode || wallet.currency?.currCode || 'ZMW').toUpperCase();
    const walletCurrency = String(wallet.currency?.currCode || holdCurrency).toUpperCase();
    const releaseAmount = holdCurrency === walletCurrency
      ? heldAmount
      : await convertAmount(heldAmount, holdCurrency, walletCurrency);
    const lockedBalance = Number(wallet.wltLockedEscrowBalance || 0);
    if (lockedBalance < releaseAmount) throw new Error(`Locked bid deposit missing for bid ${bid.id}`);
    refunds.push({ bid, wallet, releaseAmount, walletCurrency, lockedBalance });
  }

  await strapi.db.transaction(async () => {
    for (const refund of refunds) {
      await strapi.db.query('api::wallet.wallet').update({
        where: { id: refund.wallet.id },
        data: {
          wltLockedEscrowBalance: refund.lockedBalance - refund.releaseAmount,
          wltAvailableBalance: Number(refund.wallet.wltAvailableBalance || 0) + refund.releaseAmount,
        },
      });
      await strapi.db.query('api::transaction.transaction').create({
        data: {
          txReference: `TXN-AUCTION-CLOSE-REFUND-${refund.bid.id}`,
          txAmount: refund.releaseAmount,
          txCurrencyCodeAtExecution: refund.walletCurrency,
          txType: 'escrow_release',
          txStatus: 'completed',
          txMeta: { auctionItemId: item.id, bidId: refund.bid.id, reason: 'non-winning bid deposit' },
          wallet: refund.wallet.id,
        },
      });
    }

    const nonWinnerBidIds = bids
      .filter((bid) => !hasWinner || Number(bid.bidder?.id) !== Number(winnerId))
      .map((bid) => bid.id);
    if (nonWinnerBidIds.length > 0) {
      await strapi.db.query('api::bid.bid').updateMany({
        where: { id: { $in: nonWinnerBidIds } },
        data: { bidStatus: 'outbid_refunded', bidSecuredDepositHeld: 0 },
      });
    }
    await strapi.db.query('api::auction-item.auction-item').update({
      where: { id: item.id },
      data: { actAuctionStatus: status },
    });
  });
}
