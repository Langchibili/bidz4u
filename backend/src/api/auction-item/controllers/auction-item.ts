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
  async marketplace(ctx) {
    try {
      const query = ctx.query || {};
      const page = Math.max(1, Number(query.page) || 1);
      const pageSize = Math.min(48, Math.max(1, Number(query.pageSize) || 10));
      const start = query.start === undefined ? (page - 1) * pageSize : Math.max(0, Number(query.start) || 0);
      const search = String(query.search || '').trim();
      const countryId = Number(query.countryId) || null;
      const preferredCountryId = Number(query.preferredCountryId) || null;
      const categoryId = Number(query.categoryId) || null;
      const town = String(query.town || '').trim();
      const minPrice = query.minPrice === undefined || query.minPrice === '' ? null : Number(query.minPrice);
      const maxPrice = query.maxPrice === undefined || query.maxPrice === '' ? null : Number(query.maxPrice);
      const endingWithinHours = Number(query.endingWithinHours) || null;
      const excludeIds = String(query.excludeIds || '').split(',').map(Number).filter(Number.isFinite);
      const conditions: Record<string, any>[] = [
        { actAuctionStatus: 'active' },
        { actIsDraft: false },
      ];

      if (countryId) conditions.push({ itemOriginCountry: { id: countryId } });
      if (categoryId) conditions.push({ category: { id: categoryId } });
      if (town) conditions.push({ actTown: { $containsi: town } });
      if (Number.isFinite(minPrice)) {
        conditions.push({ actCurrentHighestPriceNative: { $gte: minPrice } });
      }
      if (Number.isFinite(maxPrice)) {
        conditions.push({ actCurrentHighestPriceNative: { $lte: maxPrice } });
      }
      if (query.noPrice === 'true') conditions.push({ noPrice: true });
      if (endingWithinHours) {
        const now = new Date();
        conditions.push({
          actListingTimeEnd: {
            $gte: now,
            $lte: new Date(now.getTime() + endingWithinHours * 60 * 60 * 1000),
          },
        });
      }
      if (search) {
        conditions.push({
          $or: [
            { actTitle: { $containsi: search } },
            { actDescription: { $containsi: search } },
            { category: { name: { $containsi: search } } },
          ],
        });
      }
      if (excludeIds.length) conditions.push({ id: { $notIn: excludeIds } });

      const where = { $and: conditions };
      const sort = String(query.sort || 'newest');
      const lightweightFields = [
        'id',
        'actCurrentHighestPriceNative',
        'actStartingPriceNative',
        'actListingTimeEnd',
        'createdAt',
      ];
      const preferredWhere = preferredCountryId && !countryId
        ? { $and: [...conditions, { itemOriginCountry: { id: preferredCountryId } }] }
        : where;
      const otherWhere = preferredCountryId && !countryId
        ? { $and: [...conditions, { itemOriginCountry: { id: { $ne: preferredCountryId } } }] }
        : null;
      const [preferredRows, otherRows] = await Promise.all([
        strapi.db.query('api::auction-item.auction-item').findMany({
          where: preferredWhere,
          select: lightweightFields,
          orderBy: { createdAt: 'desc' },
          limit: 100000,
        }),
        otherWhere
          ? strapi.db.query('api::auction-item.auction-item').findMany({
            where: otherWhere,
            select: lightweightFields,
            orderBy: { createdAt: 'desc' },
            limit: 100000,
          })
          : Promise.resolve([]),
      ]);
      const candidateRows = [...preferredRows, ...otherRows];
      const candidateIds = candidateRows.map((item) => Number(item.id)).filter(Number.isFinite);
      const total = candidateIds.length;

      const bidCounts = new Map<number, number>();
      const userBidIds = new Set<number>();
      if (candidateIds.length) {
        const countRows = await strapi.db.query('api::bid.bid').findMany({
          where: { auctionItem: { id: { $in: candidateIds } } },
          select: ['id'],
          populate: { auctionItem: { select: ['id'] } },
          limit: 100000,
        });
        countRows.forEach((row: any) => {
          const auctionId = Number(row.auctionItem?.id);
          if (!Number.isFinite(auctionId)) return;
          bidCounts.set(auctionId, (bidCounts.get(auctionId) || 0) + 1);
        });

        const userId = Number(ctx.state.user?.id);
        if (Number.isInteger(userId) && userId > 0) {
          const userBids = await strapi.db.query('api::bid.bid').findMany({
            where: { bidder: userId, auctionItem: { id: { $in: candidateIds } } },
            select: ['id'],
            populate: { auctionItem: { select: ['id'] } },
            limit: 100000,
          });
          userBids.forEach((bid: any) => {
            const auctionId = Number(bid.auctionItem?.id);
            if (candidateIds.includes(auctionId)) userBidIds.add(auctionId);
          });
        }
      }

      const candidateById = new Map(candidateRows.map((item) => [Number(item.id), item]));
      const sortGroup = (ids: number[]) => ids.sort((leftId, rightId) => {
        const left = candidateById.get(leftId) || {};
        const right = candidateById.get(rightId) || {};
        let comparison = 0;
        if (sort === 'price_asc') comparison = Number(left.actCurrentHighestPriceNative || left.actStartingPriceNative || 0) - Number(right.actCurrentHighestPriceNative || right.actStartingPriceNative || 0);
        else if (sort === 'price_desc') comparison = Number(right.actCurrentHighestPriceNative || right.actStartingPriceNative || 0) - Number(left.actCurrentHighestPriceNative || left.actStartingPriceNative || 0);
        else if (sort === 'ending_soon') comparison = new Date(left.actListingTimeEnd || 0).getTime() - new Date(right.actListingTimeEnd || 0).getTime();
        else if (sort === 'newest') comparison = new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
        else if (sort === 'bids_asc') comparison = (bidCounts.get(leftId) || 0) - (bidCounts.get(rightId) || 0);
        if (comparison !== 0) return comparison;
        return (bidCounts.get(rightId) || 0) - (bidCounts.get(leftId) || 0);
      });

      const preferredIds = sortGroup(preferredRows.map((item) => Number(item.id)));
      const otherIds = sortGroup(otherRows.map((item) => Number(item.id)));
      const userBidPreferred = preferredIds.filter((id) => userBidIds.has(id));
      const userBidOther = otherIds.filter((id) => userBidIds.has(id));
      const notBidPreferred = preferredIds.filter((id) => !userBidIds.has(id));
      const notBidOther = otherIds.filter((id) => !userBidIds.has(id));
      const orderedIds = [...userBidPreferred, ...userBidOther, ...notBidPreferred, ...notBidOther];

      const pageIds = orderedIds.slice(start, start + pageSize);
      const pageRecords = pageIds.length
        ? await strapi.db.query('api::auction-item.auction-item').findMany({
          where: { id: { $in: pageIds } },
          populate: {
            actImages: { select: ['url', 'formats'] },
            category: true,
            itemOriginCountry: { populate: { currency: true } },
          },
        })
        : [];
      const recordsById = new Map(pageRecords.map((item: any) => [Number(item.id), item]));
      const orderedItems = pageIds.map((id) => ({
        ...recordsById.get(id),
        bidCount: bidCounts.get(id) || 0,
      })).filter((item) => item.id);

      ctx.send({
        data: orderedItems,
        meta: {
          pagination: {
            page,
            pageSize,
            pageCount: Math.max(1, Math.ceil(total / pageSize)),
            total,
          },
        },
      });
    } catch (error) {
      strapi.log.error('[auction-item.marketplace]', error);
      ctx.internalServerError('Failed to load auctions');
    }
  },

  async create(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const { itemOriginCountry, actStartingPriceNative, actIsDraft, noPrice, ...rest } = ctx.request.body.data || ctx.request.body;
      if (!itemOriginCountry) return ctx.badRequest('itemOriginCountry is required');

      const isDraft = actIsDraft === true;
      const listingHasNoPrice = noPrice === true;

      if (!isDraft && !listingHasNoPrice) {
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
      let startingPriceToSave = listingHasNoPrice ? 0 : actStartingPriceNative ?? 0;

      if (!isDraft && !listingHasNoPrice) {
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
          noPrice: listingHasNoPrice,
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

  async myListings(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const items = await strapi.db.query('api::auction-item.auction-item').findMany({
        where: { seller: userId },
        orderBy: { updatedAt: 'desc' },
        populate: { actImages: true },
      });
      const winnerPayments = await strapi.db.query('api::auction-item.auction-item').findMany({
        where: { currentWinningBuyer: userId, actAuctionStatus: 'payment_pending' },
        orderBy: { updatedAt: 'desc' },
      });

      ctx.send({ success: true, items, winnerPayments });
    } catch (error) {
      console.error('Error fetching user listings:', error);
      ctx.internalServerError('Failed to load user listings');
    }
  },

  async pendingWinnerPayment(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { currentWinningBuyer: userId, actAuctionStatus: 'payment_pending' },
        select: ['id', 'documentId', 'actTitle'],
        orderBy: { updatedAt: 'desc' },
      });

      ctx.send({
        pendingPayment: Boolean(item),
        auction: item ? { id: item.id, documentId: item.documentId, title: item.actTitle } : null,
      });
    } catch (error) {
      strapi.log.error('Error checking pending winner payment:', error);
      ctx.internalServerError('Failed to check pending auction payments');
    }
  },

  async removeMine(ctx) {
    try {
      const userId = ctx.state.user?.id;
      const { id } = ctx.params;
      if (!userId) return ctx.unauthorized('Login required');

      let item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        populate: { seller: true },
      });
      if (!item) {
        item = await strapi.db.query('api::auction-item.auction-item').findOne({
          where: { documentId: id },
          populate: { seller: true },
        });
      }
      if (!item) return ctx.notFound('Auction item not found');
      if (String(item.seller?.id) !== String(userId)) return ctx.forbidden('You do not own this listing');

      if (item.actIsDraft !== true && item.actAuctionStatus !== 'scheduled') {
        return ctx.badRequest('Only draft or scheduled listings can be removed');
      }

      await strapi.db.query('api::auction-item.auction-item').update({
        where: { id: item.id },
        data: { seller: null },
      });

      ctx.send({ success: true, detached: true });
    } catch (error) {
      console.error('Error detaching seller from auction item:', error);
      ctx.internalServerError('Failed to remove listing from your account');
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

      const { closeAuctionAndRefundNonWinners } = await import('../../../services/bidDepositLifecycle');
      await closeAuctionAndRefundNonWinners(strapi, item, 'payment_pending');
      const { autoSettleFromWinningBidDeposit } = await import('../../../services/lockedBidAutoSettlement');
      const automaticallySettled = await autoSettleFromWinningBidDeposit(strapi, item.id);
      const updated = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        populate: { seller: true, currentWinningBuyer: true },
      });

      const socketService = (await import('../../../services/socketService')).default;
      const { notifyAuctionClosed } = await import('../../../services/auctionNotifications');
      socketService.emitAuctionClosed(item.id, item.currentWinningBuyer.id);
      if (!automaticallySettled) {
        socketService.emitPaymentRequired(
          item.currentWinningBuyer.id,
          item.id,
          Number(item.actCurrentHighestPriceNative),
          item.actNativeCurrencyCode
        );
      }
      await notifyAuctionClosed(strapi, {
        auctionItemId: item.id,
        sellerId: item.seller?.id,
        winnerId: item.currentWinningBuyer.id,
        amount: item.actCurrentHighestPriceNative,
        currency: item.actNativeCurrencyCode,
        paymentCompleted: automaticallySettled,
      });

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
      const { role, isDigital = false, evidenceId } = ctx.request.body;
      if (!userId) return ctx.unauthorized('Login required');
      if (!['buyer', 'seller'].includes(role)) return ctx.badRequest('role must be buyer or seller');

      const item = await strapi.db.query('api::auction-item.auction-item').findOne({
        where: { id },
        populate: ['seller', 'currentWinningBuyer', 'actBuyerDeliveryEvidence', 'itemOriginCountry'],
      });
      if (!item) return ctx.notFound('Auction item not found');

      const isSeller = item.seller?.id === userId;
      const isBuyer = item.currentWinningBuyer?.id === userId;
      if (role === 'seller' && !isSeller) return ctx.forbidden('Not the seller of this item');
      if (role === 'buyer' && !isBuyer) return ctx.forbidden('Not the winning buyer of this item');

      if (role === 'buyer') {
        if (item.actAuctionStatus !== 'sold') return ctx.badRequest('Payment must be completed before confirming delivery');
        if (item.actEscrowReleased) return ctx.badRequest('Escrow has already been released');
        if (evidenceId) {
          const evidence = await strapi.db.query('plugin::upload.file').findOne({
            where: { id: evidenceId },
            select: ['id', 'mime'],
          });
          if (!evidence || !String(evidence.mime || '').startsWith('image/')) {
            return ctx.badRequest('Delivery evidence must be an uploaded image');
          }
          if (String(item.actBuyerDeliveryEvidence?.id) !== String(evidenceId)) {
            return ctx.badRequest('Upload the delivery photo to this auction before confirming receipt');
          }
        }
        if (!isDigital && !evidenceId && !item.actBuyerDeliveryEvidence) {
          return ctx.badRequest('Upload a photo of the received item or mark it as digital');
        }
      }

      const updateField = role === 'seller' ? 'actSellerConfirmedDelivery' : 'actBuyerConfirmedDelivery';
      const updateData: Record<string, unknown> = { [updateField]: true };
      if (role === 'buyer') updateData.actBuyerDeliveryIsDigital = Boolean(isDigital);
      if (role === 'buyer' && evidenceId) updateData.actBuyerDeliveryEvidence = evidenceId;

      if (role === 'buyer') {
        const sellerWallet = await strapi.db.query('api::wallet.wallet').findOne({
          where: { walletOwner: item.seller?.id },
        });
        const escrowAmount = Number(item.actEscrowAmount || 0);
        const lockedBalance = Number(sellerWallet?.wltLockedEscrowBalance || 0);
        if (!sellerWallet || lockedBalance < escrowAmount) {
          return ctx.badRequest('Seller escrow balance is unavailable; contact support before confirming delivery');
        }
        const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');
        const { convertAmount } = await import('../../../services/currencyConversion');
        const settings = await resolveSettingsForCountry(strapi, item.itemOriginCountry?.id);
        const commissionType = settings.commissionType || 'percentage';
        const configuredCommission = Math.max(0, Number(settings.commission || 0));
        const escrowCurrency = String(item.actEscrowCurrencyCode || 'ZMW').toUpperCase();
        const configuredCommissionCurrency = String(settings._commissionCurrency || escrowCurrency).toUpperCase();
        const calculatedCommission = commissionType === 'flatrate'
          ? configuredCommissionCurrency === escrowCurrency
            ? configuredCommission
            : await convertAmount(configuredCommission, configuredCommissionCurrency, escrowCurrency)
          : escrowAmount * configuredCommission / 100;
        const commissionAmount = Math.min(escrowAmount, Math.max(0, calculatedCommission));
        const sellerNetAmount = escrowAmount - commissionAmount;

        await strapi.db.transaction(async () => {
          await strapi.db.query('api::wallet.wallet').update({
            where: { id: sellerWallet.id },
            data: {
              wltLockedEscrowBalance: lockedBalance - escrowAmount,
              wltAvailableBalance: Number(sellerWallet.wltAvailableBalance || 0) + sellerNetAmount,
            },
          });
          await strapi.db.query('api::auction-item.auction-item').update({
            where: { id },
            data: {
              ...updateData,
              actEscrowReleased: true,
              actCommissionAmount: commissionAmount,
              actCommissionCurrencyCode: escrowCurrency,
            },
          });
          await strapi.db.query('api::transaction.transaction').create({
            data: {
              txReference: `TXN-ESCROW-RELEASE-${id}-${Date.now()}`,
              txAmount: sellerNetAmount,
              txCurrencyCodeAtExecution: escrowCurrency,
              txType: 'escrow_release',
              txStatus: 'completed',
              txMeta: { auctionItemId: item.id, buyerId: userId, grossAmount: escrowAmount, commissionAmount },
              wallet: sellerWallet.id,
            },
          });
          if (commissionAmount > 0) {
            await strapi.db.query('api::transaction.transaction').create({
              data: {
                txReference: `TXN-COMMISSION-${id}-${Date.now()}`,
                txAmount: commissionAmount,
                txCurrencyCodeAtExecution: escrowCurrency,
                txType: 'commission',
                txStatus: 'completed',
                txMeta: { auctionItemId: item.id, grossAmount: escrowAmount, commissionType, configuredCommission },
                wallet: sellerWallet.id,
              },
            });
          }
        });
        return ctx.send({
          success: true,
          item: { ...item, ...updateData, actEscrowReleased: true, actCommissionAmount: commissionAmount, actCommissionCurrencyCode: escrowCurrency },
        });
      }

      const updated = await strapi.db.query('api::auction-item.auction-item').update({
        where: { id },
        data: updateData,
      });
      ctx.send({ success: true, item: updated });
    } catch (error) {
      console.error('Error confirming delivery:', error);
      ctx.internalServerError('Failed to confirm delivery');
    }
  },
}));