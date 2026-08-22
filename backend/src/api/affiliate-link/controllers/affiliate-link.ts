import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::affiliate-link.affiliate-link', ({ strapi }) => ({
  async create(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');
      const { targetAuctionItem } = ctx.request.body;
      const crypto = await import('crypto');
      const aflUniqueCode = 'BID4U-' + crypto.randomBytes(3).toString('hex').toUpperCase();

      const entity = await strapi.service('api::affiliate-link.affiliate-link').create({
        data: { aflUniqueCode, aflTotalClicks: 0, affiliateAgent: userId, targetAuctionItem },
      });
      const sanitizedEntity = (await this?.sanitizeOutput?.(entity, ctx)) ?? entity;
      return this?.transformResponse?.(sanitizedEntity) ?? { data: sanitizedEntity };
    } catch (error) {
      console.error('Error creating affiliate link:', error);
      ctx.internalServerError('Failed to create affiliate link');
    }
  },

  async trackClick(ctx) {
    try {
      const { code } = ctx.params;
      const link = await strapi.db.query('api::affiliate-link.affiliate-link').findOne({ where: { aflUniqueCode: code } });
      if (!link) return ctx.notFound('Affiliate link not found');
      await strapi.db.query('api::affiliate-link.affiliate-link').update({
        where: { id: link.id },
        data: { aflTotalClicks: (link.aflTotalClicks || 0) + 1 },
      });
      ctx.send({ success: true });
    } catch (error) {
      console.error('Error tracking affiliate click:', error);
      ctx.internalServerError('Failed to track click');
    }
  },
}));