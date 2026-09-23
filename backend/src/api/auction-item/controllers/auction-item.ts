// // import { factories } from '@strapi/strapi';

// // export default factories.createCoreController('api::auction-item.auction-item', ({ strapi }) => ({
// //   async create(ctx) {
// //     try {
// //       const userId = ctx.state.user?.id;
// //       if (!userId) return ctx.unauthorized('Login required');

// //       const { itemOriginCountry, actStartingPriceNative, ...rest } = ctx.request.body.data || ctx.request.body;
// //       if (!itemOriginCountry) return ctx.badRequest('itemOriginCountry is required');
// //       if (!actStartingPriceNative || actStartingPriceNative <= 0) return ctx.badRequest('actStartingPriceNative must be a positive number');

// //       const country = await strapi.db.query('api::country.country').findOne({
// //         where: { id: itemOriginCountry },
// //         populate: ['currency'],
// //       });
// //       if (!country) return ctx.badRequest('Invalid itemOriginCountry');
// //       if (!country.currency?.currCode) return ctx.badRequest('Selected country has no currency configured');

// //       const auctionCurrency = country.currency.currCode;

// //       // ── Enforce minimumAuctionStartingPrice (country override → admn_settings fallback) ──
// //       const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');
// //       const { convertAmount } = await import('../../../services/currencyConversion');

// //       const settings = await resolveSettingsForCountry(strapi, country.id);

// //       let minimumStartingPriceNative: number;
// //       try {
// //         const settingsCurrency = settings._minimumAuctionStartingPriceCurrency;
// //         minimumStartingPriceNative = settingsCurrency === auctionCurrency
// //           ? Number(settings.minimumAuctionStartingPrice)
// //           : await convertAmount(Number(settings.minimumAuctionStartingPrice), settingsCurrency, auctionCurrency);
// //       } catch (conversionErr: any) {
// //         strapi.log.error('[auction-item.create] Currency conversion failed (minimum starting price check):', conversionErr.message);
// //         return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
// //       }

// //       if (Number(actStartingPriceNative) < minimumStartingPriceNative) {
// //         return ctx.badRequest(
// //           `Starting price must be at least ${minimumStartingPriceNative.toFixed(2)} ${auctionCurrency}`
// //         );
// //       }

// //       const entity = await strapi.service('api::auction-item.auction-item').create({
// //         data: {
// //           ...rest,
// //           itemOriginCountry,
// //           actStartingPriceNative,
// //           actCurrentHighestPriceNative: actStartingPriceNative,
// //           actNativeCurrencyCode: auctionCurrency,
// //           seller: userId,
// //         },
// //       });

// //       const sanitizedEntity = (await this?.sanitizeOutput?.(entity, ctx)) ?? entity;
// //       return this?.transformResponse?.(sanitizedEntity) ?? { data: sanitizedEntity };
// //     } catch (error) {
// //       console.error('Error creating auction item:', error);
// //       ctx.internalServerError('Failed to create auction item');
// //     }
// //   },

// //   async lightweightStatus(ctx) {
// //     try {
// //       const { id } = ctx.params;
// //       const item = await strapi.db.query('api::auction-item.auction-item').findOne({
// //         where: { id },
// //         select: ['id', 'actCurrentHighestPriceNative', 'actNativeCurrencyCode', 'actAuctionStatus', 'actListingTimeEnd'],
// //       });
// //       if (!item) return ctx.notFound();
// //       ctx.send(item);
// //     } catch (error) {
// //       console.error('Error fetching lightweight status:', error);
// //       ctx.internalServerError('Failed to fetch status');
// //     }
// //   },

// //   async confirmDelivery(ctx) {
// //     try {
// //       const userId = ctx.state.user?.id;
// //       const { id } = ctx.params;
// //       const { role } = ctx.request.body; // 'buyer' | 'seller'
// //       if (!userId) return ctx.unauthorized('Login required');
// //       if (!['buyer', 'seller'].includes(role)) return ctx.badRequest('role must be buyer or seller');

// //       const item = await strapi.db.query('api::auction-item.auction-item').findOne({
// //         where: { id },
// //         populate: ['seller', 'currentWinningBuyer'],
// //       });
// //       if (!item) return ctx.notFound('Auction item not found');

// //       const isSeller = item.seller?.id === userId;
// //       const isBuyer = item.currentWinningBuyer?.id === userId;
// //       if (role === 'seller' && !isSeller) return ctx.forbidden('Not the seller of this item');
// //       if (role === 'buyer' && !isBuyer) return ctx.forbidden('Not the winning buyer of this item');

// //       const updateField = role === 'seller' ? 'actSellerConfirmedDelivery' : 'actBuyerConfirmedDelivery';
// //       const updated = await strapi.db.query('api::auction-item.auction-item').update({
// //         where: { id },
// //         data: { [updateField]: true },
// //       });

// //       if (updated.actBuyerConfirmedDelivery && updated.actSellerConfirmedDelivery) {
// //         await strapi.db.query('api::auction-item.auction-item').update({
// //           where: { id },
// //           data: { actAuctionStatus: 'sold' },
// //         });
// //       }

// //       ctx.send({ success: true, item: updated });
// //     } catch (error) {
// //       console.error('Error confirming delivery:', error);
// //       ctx.internalServerError('Failed to confirm delivery');
// //     }
// //   },
// // }));
// import { factories } from '@strapi/strapi';

// export default factories.createCoreController('api::auction-item.auction-item', ({ strapi }) => ({
//   async create(ctx) {
//     try {
//       const userId = ctx.state.user?.id;
//       if (!userId) return ctx.unauthorized('Login required');

//       const { itemOriginCountry, actStartingPriceNative, actIsDraft, ...rest } = ctx.request.body.data || ctx.request.body;
//       if (!itemOriginCountry) return ctx.badRequest('itemOriginCountry is required');

//       const isDraft = actIsDraft === true;

//       if (!isDraft) {
//         if (!actStartingPriceNative || actStartingPriceNative <= 0) {
//           return ctx.badRequest('actStartingPriceNative must be a positive number');
//         }
//       }

//       const country = await strapi.db.query('api::country.country').findOne({
//         where: { id: itemOriginCountry },
//         populate: ['currency'],
//       });
//       if (!country) return ctx.badRequest('Invalid itemOriginCountry');
//       if (!country.currency?.currCode) return ctx.badRequest('Selected country has no currency configured');

//       const auctionCurrency = country.currency.currCode;
//       let startingPriceToSave = actStartingPriceNative ?? 0;

//       if (!isDraft) {
//         const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');
//         const { convertAmount } = await import('../../../services/currencyConversion');

//         const settings = await resolveSettingsForCountry(strapi, country.id);

//         let minimumStartingPriceNative: number;
//         try {
//           const settingsCurrency = settings._minimumAuctionStartingPriceCurrency;
//           minimumStartingPriceNative = settingsCurrency === auctionCurrency
//             ? Number(settings.minimumAuctionStartingPrice)
//             : await convertAmount(Number(settings.minimumAuctionStartingPrice), settingsCurrency, auctionCurrency);
//         } catch (conversionErr: any) {
//           strapi.log.error('[auction-item.create] Currency conversion failed (minimum starting price check):', conversionErr.message);
//           return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
//         }

//         if (Number(startingPriceToSave) < minimumStartingPriceNative) {
//           return ctx.badRequest(
//             `Starting price must be at least ${minimumStartingPriceNative.toFixed(2)} ${auctionCurrency}`
//           );
//         }
//       }

//       // `seller` is set here, before the create call — the beforeCreate
//       // lifecycle reads it straight off event.params.data.
//       const entity = await strapi.service('api::auction-item.auction-item').create({
//         data: {
//           ...rest,
//           itemOriginCountry,
//           actIsDraft: isDraft,
//           actStartingPriceNative: startingPriceToSave,
//           actCurrentHighestPriceNative: startingPriceToSave,
//           actNativeCurrencyCode: auctionCurrency,
//           seller: userId,
//         },
//       });

//       const sanitizedEntity = (await this?.sanitizeOutput?.(entity, ctx)) ?? entity;
//       return this?.transformResponse?.(sanitizedEntity) ?? { data: sanitizedEntity };
//     } catch (error: any) {
//       // A lifecycle-thrown ApplicationError (e.g. "you already have a draft
//       // in progress") should surface as a 400 with its real message — not
//       // get swallowed into a generic 500.
//       if (error?.name === 'ApplicationError') {
//         return ctx.badRequest(error.message, error.details);
//       }
//       console.error('Error creating auction item:', error);
//       ctx.internalServerError('Failed to create auction item');
//     }
//   },

//   async lightweightStatus(ctx) {
//     try {
//       const { id } = ctx.params;
//       const item = await strapi.db.query('api::auction-item.auction-item').findOne({
//         where: { id },
//         select: ['id', 'actCurrentHighestPriceNative', 'actNativeCurrencyCode', 'actAuctionStatus', 'actListingTimeEnd'],
//       });
//       if (!item) return ctx.notFound();
//       ctx.send(item);
//     } catch (error) {
//       console.error('Error fetching lightweight status:', error);
//       ctx.internalServerError('Failed to fetch status');
//     }
//   },

//   async confirmDelivery(ctx) {
//     try {
//       const userId = ctx.state.user?.id;
//       const { id } = ctx.params;
//       const { role } = ctx.request.body; // 'buyer' | 'seller'
//       if (!userId) return ctx.unauthorized('Login required');
//       if (!['buyer', 'seller'].includes(role)) return ctx.badRequest('role must be buyer or seller');

//       const item = await strapi.db.query('api::auction-item.auction-item').findOne({
//         where: { id },
//         populate: ['seller', 'currentWinningBuyer'],
//       });
//       if (!item) return ctx.notFound('Auction item not found');

//       const isSeller = item.seller?.id === userId;
//       const isBuyer = item.currentWinningBuyer?.id === userId;
//       if (role === 'seller' && !isSeller) return ctx.forbidden('Not the seller of this item');
//       if (role === 'buyer' && !isBuyer) return ctx.forbidden('Not the winning buyer of this item');

//       const updateField = role === 'seller' ? 'actSellerConfirmedDelivery' : 'actBuyerConfirmedDelivery';
//       const updated = await strapi.db.query('api::auction-item.auction-item').update({
//         where: { id },
//         data: { [updateField]: true },
//       });

//       if (updated.actBuyerConfirmedDelivery && updated.actSellerConfirmedDelivery) {
//         await strapi.db.query('api::auction-item.auction-item').update({
//           where: { id },
//           data: { actAuctionStatus: 'sold' },
//         });
//       }

//       ctx.send({ success: true, item: updated });
//     } catch (error) {
//       console.error('Error confirming delivery:', error);
//       ctx.internalServerError('Failed to confirm delivery');
//     }
//   },
// }));
import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::auction-item.auction-item', ({ strapi }) => ({
  async create(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const { itemOriginCountry, actStartingPriceNative, actIsDraft, ...rest } = ctx.request.body.data || ctx.request.body;
      if (!itemOriginCountry) return ctx.badRequest('itemOriginCountry is required');

      const isDraft = actIsDraft === true;

      if (!isDraft) {
        if (!actStartingPriceNative || actStartingPriceNative <= 0) {
          return ctx.badRequest('actStartingPriceNative must be a positive number');
        }
      }

      const country = await strapi.db.query('api::country.country').findOne({
        where: { id: itemOriginCountry },
        populate: ['currency'],
      });
      if (!country) return ctx.badRequest('Invalid itemOriginCountry');
      if (!country.currency?.currCode) return ctx.badRequest('Selected country has no currency configured');

      const auctionCurrency = country.currency.currCode;
      let startingPriceToSave = actStartingPriceNative ?? 0;

      if (!isDraft) {
        const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');
        const { convertAmount } = await import('../../../services/currencyConversion');

        const settings = await resolveSettingsForCountry(strapi, country.id);

        let minimumStartingPriceNative: number;
        try {
          const settingsCurrency = settings._minimumAuctionStartingPriceCurrency;
          minimumStartingPriceNative = settingsCurrency === auctionCurrency
            ? Number(settings.minimumAuctionStartingPrice)
            : await convertAmount(Number(settings.minimumAuctionStartingPrice), settingsCurrency, auctionCurrency);
        } catch (conversionErr: any) {
          strapi.log.error('[auction-item.create] Currency conversion failed (minimum starting price check):', conversionErr.message);
          return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
        }

        if (Number(startingPriceToSave) < minimumStartingPriceNative) {
          return ctx.badRequest(
            `Starting price must be at least ${minimumStartingPriceNative.toFixed(2)} ${auctionCurrency}`
          );
        }
      }

      // `seller` is set here, before the create call — the beforeCreate
      // lifecycle reads it straight off event.params.data.
      const entity = await strapi.service('api::auction-item.auction-item').create({
        data: {
          ...rest,
          itemOriginCountry,
          actIsDraft: isDraft,
          actStartingPriceNative: startingPriceToSave,
          actCurrentHighestPriceNative: startingPriceToSave,
          actNativeCurrencyCode: auctionCurrency,
          seller: userId,
        },
      });

      const sanitizedEntity = (await this?.sanitizeOutput?.(entity, ctx)) ?? entity;
      return this?.transformResponse?.(sanitizedEntity) ?? { data: sanitizedEntity };
    } catch (error: any) {
      // A lifecycle-thrown ApplicationError (e.g. "you already have a draft
      // in progress") should surface as a 400 with its real message — not
      // get swallowed into a generic 500.
      if (error?.name === 'ApplicationError') {
        return ctx.badRequest(error.message, error.details);
      }
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

  async mine(ctx) {
    try {
      const authenticatedUserId = ctx.state.user?.id;
      const requestedUserId = Number(ctx.query.userId);
      const { id } = ctx.params;

      if (!authenticatedUserId) return ctx.unauthorized('Login required');
      if (!Number.isInteger(requestedUserId) || requestedUserId !== authenticatedUserId) {
        return ctx.send({ mine: false });
      }

      const item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        select: ['id'],
      });
      if (!item) {
        const itemByDocumentId = await strapi.db.query('api::auction-item.auction-item').findOne({
          where: { documentId: id },
          select: ['id'],
        });
        if (!itemByDocumentId) return ctx.send({ mine: false });
        const ownedByDocumentId = await strapi.db.query('api::auction-item.auction-item').findOne({
          where: { id: itemByDocumentId.id, seller: authenticatedUserId },
          select: ['id'],
        });
        return ctx.send({ mine: Boolean(ownedByDocumentId) });
      }

      const ownedItem = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id: item.id, seller: authenticatedUserId },
        select: ['id'],
      });
      return ctx.send({ mine: Boolean(ownedItem) });
    } catch (error) {
      console.error('Error checking auction ownership:', error);
      ctx.internalServerError('Failed to check auction ownership');
    }
  },

  async winner(ctx) {
    try {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      if (!userId) return ctx.unauthorized('Login required');

      const item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        populate: { currentWinningBuyer: true },
      });
      const itemByDocumentId = item || await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { documentId: id },
        populate: { currentWinningBuyer: true },
      });

      return ctx.send({ winner: itemByDocumentId?.currentWinningBuyer?.id === userId });
    } catch (error) {
      console.error('Error checking auction winner:', error);
      ctx.internalServerError('Failed to check auction winner');
    }
  },

  async acceptPrice(ctx) {
    try {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      if (!userId) return ctx.unauthorized('Login required');

      const item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        populate: { seller: true, currentWinningBuyer: true },
      });
      if (!item) return ctx.notFound('Auction item not found');
      if (item.seller?.id !== userId) return ctx.forbidden('Only the listing owner can accept the price');
      if (item.actAuctionStatus !== 'active') return ctx.badRequest('Auction is not active');
      if (!item.currentWinningBuyer) return ctx.badRequest('There is no bid to accept');

      const updated = await strapi.db.query('api::auction-item.auction-item').update({
        where: { id },
        data: { actAuctionStatus: 'payment_pending' },
        populate: { seller: true, currentWinningBuyer: true },
      });

      const socketService = (await import('../../../services/socketService')).default;
      socketService.emitAuctionClosed(item.id, item.currentWinningBuyer.id);
      socketService.emitPaymentRequired(
        item.currentWinningBuyer.id,
        item.id,
        Number(item.actCurrentHighestPriceNative),
        item.actNativeCurrencyCode
      );

      ctx.send({ success: true, data: updated });
    } catch (error) {
      console.error('Error accepting auction price:', error);
      ctx.internalServerError('Failed to accept auction price');
    }
  },

  // GET /auction-items/:userId/current-draft-id
  //
  // Returns the id of the requesting seller's in-progress draft, if any —
  // mirrors the same "latest listing is a draft" rule the beforeCreate
  // lifecycle enforces (see auction-item lifecycle), so this always agrees
  // with what create() would reject/redirect to.
  //
  // `:userId` in the path is NOT trusted as the identity source — the
  // authenticated user (ctx.state.user.id) is always who gets looked up,
  // so this can't be used to probe another seller's draft state. The param
  // is only there to match the frontend's URL shape; a mismatch against
  // the real signed-in user is simply ignored rather than erroring, since
  // trusting it would be the actual security hole.
  async currentDraftId(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const latest = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { seller: userId },
        orderBy: { createdAt: 'desc' },
        select: ['id', 'documentId', 'actIsDraft'],
      });

      const hasDraft = !!latest && latest.actIsDraft === true;

      ctx.send({
        success: true,
        draftId: hasDraft ? latest.documentId : null,
        draftNumericId: hasDraft ? latest.id : null,
      });
    } catch (error) {
      console.error('Error resolving current draft id:', error);
      ctx.internalServerError('Failed to resolve current draft id');
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