import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::wallet.wallet', ({ strapi }) => ({
  async myWallet(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const wallet = await strapi.db.query('api::wallet.wallet').findOne({ where: { walletOwner: userId } });
      if (!wallet) return ctx.notFound('Wallet not found for this user');

      ctx.send({ success: true, wallet });
    } catch (error) {
      console.error('Error fetching own wallet:', error);
      ctx.internalServerError('Failed to fetch wallet');
    }
  },
}));