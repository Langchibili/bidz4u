// backend/src/services/auctionLifecycle.ts

import socketService from './socketService';
import { notifyAuctionClosed } from './auctionNotifications';

export async function checkAndCloseExpiredAuctions(strapi: any) {
  const now = new Date();
  const expired = await strapi.db.query('api::auction-item.auction-item').findMany({
    where: { actAuctionStatus: 'active', actListingTimeEnd: { $lte: now } },
    populate: { currentWinningBuyer: true, seller: true },
  });

  for (const item of expired) {
    const hasWinner = !!item.currentWinningBuyer;
    await strapi.db.query('api::auction-item.auction-item').update({
      where: { id: item.id },
      data: { actAuctionStatus: hasWinner ? 'payment_pending' : 'delisted_no_bids' },
    });
    socketService.emitAuctionClosed(item.id, item.currentWinningBuyer?.id || null);
    await notifyAuctionClosed(strapi, {
      auctionItemId: item.id,
      sellerId: item.seller?.id,
      winnerId: item.currentWinningBuyer?.id || null,
      amount: item.actCurrentHighestPriceNative,
      currency: item.actNativeCurrencyCode,
    });
  }
}
