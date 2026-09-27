// backend/src/services/auctionLifecycle.ts

import socketService from './socketService';
import { notifyAuctionClosed } from './auctionNotifications';
import { closeAuctionAndRefundNonWinners } from './bidDepositLifecycle';
import { autoSettleFromWinningBidDeposit } from './lockedBidAutoSettlement';

export async function checkAndCloseExpiredAuctions(strapi: any) {
  const now = new Date();
  const expired = await strapi.db.query('api::auction-item.auction-item').findMany({
    where: { actAuctionStatus: 'active', actListingTimeEnd: { $lte: now } },
    populate: { currentWinningBuyer: true, seller: true },
  });

  for (const item of expired) {
    const hasWinner = !!item.currentWinningBuyer;
    try {
      await closeAuctionAndRefundNonWinners(strapi, item, hasWinner ? 'payment_pending' : 'delisted_no_bids');
    } catch (error) {
      strapi.log.error(`[auctionLifecycle] Failed to close auction ${item.id} and refund non-winners`, error);
      continue;
    }
    const automaticallySettled = hasWinner
      ? await autoSettleFromWinningBidDeposit(strapi, item.id)
      : false;

    socketService.emitAuctionClosed(item.id, item.currentWinningBuyer?.id || null);
    await notifyAuctionClosed(strapi, {
      auctionItemId: item.id,
      sellerId: item.seller?.id,
      winnerId: item.currentWinningBuyer?.id || null,
      amount: item.actCurrentHighestPriceNative,
      currency: item.actNativeCurrencyCode,
      paymentCompleted: automaticallySettled,
    });
  }
}
