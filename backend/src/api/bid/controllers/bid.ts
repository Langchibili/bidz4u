import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::bid.bid', ({ strapi }) => ({
  async create(ctx) {
    return ctx.methodNotAllowed('Use POST /bids/place instead');
  },
  async update(ctx) {
    return ctx.methodNotAllowed('Bids cannot be edited directly');
  },
  async delete(ctx) {
    return ctx.methodNotAllowed('Bids cannot be deleted directly');
  },

  async place(ctx) {
    try {
      const user = ctx.state.user;
      const { auctionItemId, bidAmountLocal } = ctx.request.body;
      if (!user) return ctx.unauthorized('Login required');
      if (!auctionItemId || !bidAmountLocal) return ctx.badRequest('auctionItemId and bidAmountLocal are required');

      const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');
      const { convertAmount } = await import('../../../services/currencyConversion');
      const socketService = (await import('../../../services/socketService')).default;

      const auctionItem = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id: auctionItemId },
        populate: { itemOriginCountry: { populate: ['currency'] } },
      });
      if (!auctionItem) return ctx.notFound('Auction item not found');
      if (auctionItem.actAuctionStatus !== 'active') return ctx.badRequest('Auction is not active');

      const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: user.id },
        populate: { country: { populate: ['currency'] }, userWallet: true },
      });

      const settings = await resolveSettingsForCountry(strapi, fullUser.country?.id);
      const userCurrency = fullUser.country?.currency?.currCode || settings._settingsBaseCurrency;

      const bidAmountUsd = await convertAmount(Number(bidAmountLocal), userCurrency, 'USD');
      if (bidAmountUsd <= Number(auctionItem.actCurrentHighestPriceUsd)) {
        return ctx.badRequest('Bid must exceed the current highest bid');
      }

      const basePrice = Number(auctionItem.actStartingPriceUsd);
      const minRequiredUsd = settings.minimumAmountBeforeBidType === 'percentage'
        ? basePrice * (Number(settings.minimumAmountBeforeBid) / 100)
        : await convertAmount(Number(settings.minimumAmountBeforeBid), settings._settingsBaseCurrency, 'USD');

      const walletBalanceUsd = await convertAmount(
        Number(fullUser.userWallet?.wltAvailableBalance || 0),
        fullUser.userWallet?.wltCurrencyCode || userCurrency,
        'USD'
      );
      if (walletBalanceUsd < minRequiredUsd) {
        return ctx.badRequest(`Minimum wallet balance of ${minRequiredUsd.toFixed(2)} USD equivalent required before bidding`);
      }

      const bid = await strapi.db.query('api::bid.bid').create({
        data: {
          bidAmountUsd,
          bidAmountLocalSnapshot: bidAmountLocal,
          bidLocalCurrencyCode: userCurrency,
          bidSecuredDepositHeld: 0,
          bidStatus: 'active_leading',
          bidder: user.id,
          auctionItem: auctionItem.id,
        },
      });

      await strapi.db.query('api::bid.bid').updateMany({
        where: { auctionItem: auctionItem.id, bidStatus: 'active_leading', id: { $ne: bid.id } },
        data: { bidStatus: 'outbid_refunded' },
      });

      await strapi.db.query('api::auction-item.auction-item').update({
        where: { id: auctionItem.id },
        data: { actCurrentHighestPriceUsd: bidAmountUsd, currentWinningBuyer: user.id },
      });

      const now = Date.now();
      const endTime = new Date(auctionItem.actListingTimeEnd).getTime();
      const triggerWindowMs = Number(settings.bidExtensionTriggerWindowMins) * 60 * 1000;
      if (endTime - now <= triggerWindowMs) {
        const newEnd = new Date(now + triggerWindowMs);
        await strapi.db.query('api::auction-item.auction-item').update({
          where: { id: auctionItem.id },
          data: { actListingTimeEnd: newEnd },
        });
        socketService.emitAuctionExtended(auctionItem.id, newEnd.toISOString());
      }

      socketService.emitBidPlaced(auctionItem.id, {
        bidId: bid.id,
        bidderId: user.id,
        bidAmountUsd,
        bidAmountLocalSnapshot: bidAmountLocal,
        bidLocalCurrencyCode: userCurrency,
      });

      ctx.send({ status: true, bid });
    } catch (error) {
      console.error('Error placing bid:', error);
      ctx.internalServerError('Failed to place bid');
    }
  },

  async myBids(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');
      const bids = await strapi.db.query('api::bid.bid').findMany({
        where: { bidder: userId },
        populate: ['auctionItem'],
        orderBy: { createdAt: 'desc' },
      });
      ctx.send({ success: true, bids });
    } catch (error) {
      console.error('Error fetching own bids:', error);
      ctx.internalServerError('Failed to fetch bids');
    }
  },
}));