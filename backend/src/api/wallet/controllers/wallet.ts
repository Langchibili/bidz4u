import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::wallet.wallet', ({ strapi }) => ({
  async myWallet(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const [wallet, adminSettings] = await Promise.all([
        strapi.db.query('api::wallet.wallet').findOne({
          where: { walletOwner: userId },
          populate: { currency: true },
        }),
        strapi.db.query('api::admn-setting.admn-setting').findOne({
          populate: { prefferedSettingsCurrency: true },
        }),
      ]);
      if (!wallet) return ctx.notFound('Wallet not found for this user');

      ctx.send({
        success: true,
        wallet,
        settingsBaseCurrency: adminSettings?.prefferedSettingsCurrency?.currCode || null,
      });
    } catch (error) {
      console.error('Error fetching own wallet:', error);
      ctx.internalServerError('Failed to fetch wallet');
    }
  },
}));