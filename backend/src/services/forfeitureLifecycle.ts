// backend/src/services/forfeitureLifecycle.ts

import { resolveSettingsForCountry } from './settingsResolver';
import socketService from './socketService';

export async function checkAndForfeitUnpaidWinners(strapi: any) {
  const pending = await strapi.db.query('api::auction-item.auction-item').findMany({
    where: { actAuctionStatus: 'payment_pending' },
    populate: { currentWinningBuyer: { populate: ['country'] }, itemOriginCountry: true },
  });

  for (const item of pending) {
    const settings = await resolveSettingsForCountry(strapi, item.itemOriginCountry?.id);
    const deadline = new Date(item.actListingTimeEnd).getTime() + Number(settings.timeToAllowBidWinnerToPayInMins) * 60 * 1000;
    if (Date.now() < deadline) continue;

    await strapi.db.query('api::auction-item.auction-item').update({
      where: { id: item.id },
      data: { actAuctionStatus: 'delisted_forfeited', currentWinningBuyer: null },
    });

    const winningBid = await strapi.db.query('api::bid.bid').findOne({
      where: { auctionItem: item.id, bidStatus: 'active_leading' },
    });
    if (winningBid) {
      await strapi.db.query('api::bid.bid').update({ where: { id: winningBid.id }, data: { bidStatus: 'won_forfeited' } });
    }

    if (item.currentWinningBuyer?.id) {
      const coolDownUntil = new Date(Date.now() + Number(settings.coolDownPeriodAfterForfeitMins) * 60 * 1000);
      await strapi.db.query('plugin::users-permissions.user').update({
        where: { id: item.currentWinningBuyer.id },
        data: { usrCoolDownUntil: coolDownUntil },
      });
      socketService.emitForfeiture(item.id, item.currentWinningBuyer.id);
    }
  }
}