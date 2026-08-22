import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::commission-ledger.commission-ledger', ({ strapi }) => ({
  async myEarnings(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');
      const entries = await strapi.db.query('api::commission-ledger.commission-ledger').findMany({
        where: { beneficiaryAgent: userId },
        populate: ['sourceAuction'],
        orderBy: { createdAt: 'desc' },
      });
      const totalAccruing = entries
        .filter((e) => e.comPayoutStatus === 'accruing')
        .reduce((sum, e) => sum + Number(e.comAgentPayoutCutUsd), 0);
      ctx.send({ success: true, entries, totalAccruingUsd: totalAccruing });
    } catch (error) {
      console.error('Error fetching commission earnings:', error);
      ctx.internalServerError('Failed to fetch earnings');
    }
  },
}));