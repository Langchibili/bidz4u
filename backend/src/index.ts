// backend/src/index.ts

import socketService from './services/socketService';
import { handleUserCreation, handleUserUpdate } from './pluginExtensionsFiles/userLifecycleMethods';
import { checkAndCloseExpiredAuctions } from './services/auctionLifecycle';
import { checkAndForfeitUnpaidWinners } from './services/forfeitureLifecycle';

export default {
  register({ strapi }: { strapi: any }) {},

  bootstrap({ strapi }: { strapi: any }) {
    socketService.connect();
    console.log('✅ Socket bridge initialized');

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
