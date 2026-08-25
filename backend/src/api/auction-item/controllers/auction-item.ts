import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::auction-item.auction-item', ({ strapi }) => ({
  async create(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const { itemOriginCountry, actStartingPriceNative, ...rest } = ctx.request.body.data || ctx.request.body;
      if (!itemOriginCountry) return ctx.badRequest('itemOriginCountry is required');
      if (!actStartingPriceNative || actStartingPriceNative <= 0) return ctx.badRequest('actStartingPriceNative must be a positive number');

      const country = await strapi.db.query('api::country.country').findOne({
        where: { id: itemOriginCountry },
        populate: ['currency'],
      });
      if (!country) return ctx.badRequest('Invalid itemOriginCountry');
      if (!country.currency?.currCode) return ctx.badRequest('Selected country has no currency configured');

      const entity = await strapi.service('api::auction-item.auction-item').create({
        data: {
          ...rest,
          itemOriginCountry,
          actStartingPriceNative,
          actCurrentHighestPriceNative: actStartingPriceNative,
          actNativeCurrencyCode: country.currency.currCode,
          seller: userId,
        },
      });

      const sanitizedEntity = (await this?.sanitizeOutput?.(entity, ctx)) ?? entity;
      return this?.transformResponse?.(sanitizedEntity) ?? { data: sanitizedEntity };
    } catch (error) {
      console.error('Error creating auction item:', error);
      ctx.internalServerError('Failed to create auction item');
    }
  },

  async lightweightStatus(ctx) {
    try {
      const { id } = ctx.params;
      const item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        select: ['id', 'actCurrentHighestPriceNative', 'actNativeCurrencyCode', 'actAuctionStatus', 'actListingTimeEnd'],
      });
      if (!item) return ctx.notFound();
      ctx.send(item);
    } catch (error) {
      console.error('Error fetching lightweight status:', error);
      ctx.internalServerError('Failed to fetch status');
    }
  },

  async confirmDelivery(ctx) {
    try {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      const { role } = ctx.request.body; // 'buyer' | 'seller'
      if (!userId) return ctx.unauthorized('Login required');
      if (!['buyer', 'seller'].includes(role)) return ctx.badRequest('role must be buyer or seller');

      const item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        populate: ['seller', 'currentWinningBuyer'],
      });
      if (!item) return ctx.notFound('Auction item not found');

      const isSeller = item.seller?.id === userId;
      const isBuyer = item.currentWinningBuyer?.id === userId;
      if (role === 'seller' && !isSeller) return ctx.forbidden('Not the seller of this item');
      if (role === 'buyer' && !isBuyer) return ctx.forbidden('Not the winning buyer of this item');

      const updateField = role === 'seller' ? 'actSellerConfirmedDelivery' : 'actBuyerConfirmedDelivery';
      const updated = await strapi.db.query('api::auction-item.auction-item').update({
        where: { id },
        data: { [updateField]: true },
      });

      if (updated.actBuyerConfirmedDelivery && updated.actSellerConfirmedDelivery) {
        await strapi.db.query('api::auction-item.auction-item').update({
          where: { id },
          data: { actAuctionStatus: 'sold' },
        });
      }

      ctx.send({ success: true, item: updated });
    } catch (error) {
      console.error('Error confirming delivery:', error);
      ctx.internalServerError('Failed to confirm delivery');
    }
  },
}));