import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::transaction.transaction', ({ strapi }) => ({
  async myTransactions(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const wallet = await strapi.db.query('api::wallet.wallet').findOne({ where: { walletOwner: userId } });
      if (!wallet) return ctx.notFound('Wallet not found for this user');

      const transactions = await strapi.db.query('api::transaction.transaction').findMany({
        where: { wallet: wallet.id },
        orderBy: { createdAt: 'desc' },
      });

      ctx.send({ success: true, transactions });
    } catch (error) {
      console.error('Error fetching own transactions:', error);
      ctx.internalServerError('Failed to fetch transactions');
    }
  },

  async initiateDeposit(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');
      const { amount } = ctx.request.body;
      if (!amount || amount <= 0) return ctx.badRequest('A positive amount is required');

      const { getPaymentGateway } = await import('../../../paymentGatewayAdapters');
      const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');

      const user = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: userId },
        populate: { country: { populate: ['currency'] }, userWallet: true },
      });
      if (!user?.userWallet) return ctx.badRequest('User has no wallet');

      const settings = await resolveSettingsForCountry(strapi, user.country?.id);
      const gateway = getPaymentGateway(settings.paymentGateway);
      const currencyCode = user.country?.currency?.currCode || 'ZMW';
      const reference = `DEP-${Date.now()}-${userId}`;

      const tx = await strapi.db.query('api::transaction.transaction').create({
        data: {
          txReference: reference,
          txAmount: amount,
          txCurrencyCodeAtExecution: currencyCode,
          txType: 'deposit',
          txStatus: 'pending',
          wallet: user.userWallet.id,
        },
      });

      const gatewayResult = await gateway.initiatePayment({
        reference,
        amount: Number(amount),
        currency: currencyCode,
        phone: user.username,
        narration: 'bidz4u wallet deposit',
      });

      await strapi.db.query('api::transaction.transaction').update({
        where: { id: tx.id },
        data: { txGatewayReference: gatewayResult.gatewayReference },
      });

      ctx.send({ success: true, transaction: tx, gateway: gatewayResult });
    } catch (error) {
      console.error('Error initiating deposit:', error);
      ctx.internalServerError('Failed to initiate deposit');
    }
  },
}));