// backend/src/index.ts

import socketService from './services/socketService';
import { handleUserCreation, handleUserUpdate } from './pluginExtensionsFiles/userLifecycleMethods';
import { checkAndCloseExpiredAuctions } from './services/auctionLifecycle';
import { checkAndForfeitUnpaidWinners } from './services/forfeitureLifecycle';

export default {
  register({ strapi }: { strapi: any }) {},

  async bootstrap({ strapi }: { strapi: any }) {
    socketService.connect();
    console.log('✅ Socket bridge initialized');

    const authenticatedRole = await strapi.db.query('plugin::users-permissions.role').findOne({
      where: { type: 'authenticated' },
    });
    if (authenticatedRole) {
      const action = 'api::auction-item.auction-item.myListings';
      const permission = await strapi.db.query('plugin::users-permissions.permission').findOne({
        where: { action, role: authenticatedRole.id },
      });
      if (!permission) {
        await strapi.db.query('plugin::users-permissions.permission').create({
          data: { action, role: authenticatedRole.id },
        });
      }
    }

    try {
      const adminSettings = await strapi.db.query('api::admn-setting.admn-setting').findOne({
        populate: { prefferedSettingsCurrency: true },
      });
      const wallets = await strapi.db.query('api::wallet.wallet').findMany({
        where: { currency: null },
        populate: { walletOwner: { populate: { country: { populate: { currency: true } } } }, currency: true },
      });
      for (const wallet of wallets) {
        if (wallet.currency) continue;
        const currency = wallet.walletOwner?.country?.currency || adminSettings?.prefferedSettingsCurrency;
        if (currency?.id) {
          await strapi.db.query('api::wallet.wallet').update({
            where: { id: wallet.id },
            data: { currency: currency.id },
          });
        }
      }
    } catch (error) {
      strapi.log.error('Failed to backfill wallet currency relations', error);
    }

    strapi.db.lifecycles.subscribe({
      models: ['plugin::users-permissions.user'],
      async afterCreate(event: any) {
        const { result: user } = event;
        if (!user?.id) return;
        await handleUserCreation(strapi, user);
      },
      async afterUpdate(event: any) {
        const { result: user, params } = event;
        if (!user?.id) return;
        await handleUserUpdate(strapi, user, params);
      },
    });

    // Auction close + winner-payment-window cron
    strapi.cron.add({
      closeExpiredAuctions: {
        task: async () => { await checkAndCloseExpiredAuctions(strapi); },
        options: { rule: '*/30 * * * * *', tz: 'UTC' }, // every 30s
      },
      forfeitureSweep: {
        task: async () => { await checkAndForfeitUnpaidWinners(strapi); },
        options: { rule: '*/1 * * * *', tz: 'UTC' }, // every 1 min
      },
    });

    console.log('[bootstrap] bidz4u backend ready ✅');
  },
};
