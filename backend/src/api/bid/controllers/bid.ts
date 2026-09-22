// import { factories } from '@strapi/strapi';

// export default factories.createCoreController('api::bid.bid', ({ strapi }) => ({
//   async create(ctx) {
//     return ctx.methodNotAllowed('Use POST /bids/place instead');
//   },
//   async update(ctx) {
//     return ctx.methodNotAllowed('Bids cannot be edited directly');
//   },
//   async delete(ctx) {
//     return ctx.methodNotAllowed('Bids cannot be deleted directly');
//   },

//   async place(ctx) {
//     try {
//       const user = ctx.state.user;
//       const { auctionItemId, bidAmountLocal } = ctx.request.body;
//       if (!user) return ctx.unauthorized('Login required');
//       if (!auctionItemId || !bidAmountLocal) return ctx.badRequest('auctionItemId and bidAmountLocal are required');

//       const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');
//       const { convertAmount } = await import('../../../services/currencyConversion');
//       const socketService = (await import('../../../services/socketService')).default;

//       const auctionItem = await strapi.db.query('api::auction-item.auction-item').findOne({
//         where: { id: auctionItemId },
//       });
//       if (!auctionItem) return ctx.notFound('Auction item not found');
//       if (auctionItem.actAuctionStatus !== 'active') return ctx.badRequest('Auction is not active');

//       const auctionCurrency = auctionItem.actNativeCurrencyCode;

//       const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
//         where: { id: user.id },
//         populate: { country: { populate: ['currency'] }, userWallet: true },
//       });

//       const userCurrency = fullUser.country?.currency?.currCode;
//       if (!userCurrency) return ctx.badRequest('Your account has no country/currency set — please update your profile');

//       const settings = await resolveSettingsForCountry(strapi, fullUser.country?.id);

//       // ── Convert bid amount into the auction's native currency, ONLY if
//       //    the bidder's currency differs from the auction's currency. ────────
//       let bidAmountNative: number;
//       let bidWasConverted = false;
//       try {
//         if (userCurrency === auctionCurrency) {
//           bidAmountNative = Number(bidAmountLocal);
//         } else {
//           bidAmountNative = await convertAmount(Number(bidAmountLocal), userCurrency, auctionCurrency);
//           bidWasConverted = true;
//         }
//       } catch (conversionErr: any) {
//         strapi.log.error('[bid.place] Currency conversion failed:', conversionErr.message);
//         return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
//       }

//       if (bidAmountNative <= Number(auctionItem.actCurrentHighestPriceNative)) {
//         return ctx.badRequest('Bid must exceed the current highest bid');
//       }

//       // ── Minimum wallet balance check — also done in the auction's native
//       //    currency, so both the settings value and the wallet balance get
//       //    converted into that currency ONLY if their source currency differs. ─
//       let minRequiredNative: number;
//       let walletBalanceNative: number;
//       try {
//         const basePrice = Number(auctionItem.actStartingPriceNative);

//         if (settings.minimumAmountBeforeBidType === 'percentage') {
//           // Percentage of the (already native-currency) starting price — no conversion needed ever.
//           minRequiredNative = basePrice * (Number(settings.minimumAmountBeforeBid) / 100);
//         } else {
//           const settingsCurrency = settings._minimumAmountBeforeBidCurrency;
//           minRequiredNative = settingsCurrency === auctionCurrency
//             ? Number(settings.minimumAmountBeforeBid)
//             : await convertAmount(Number(settings.minimumAmountBeforeBid), settingsCurrency, auctionCurrency);
//           }

//         const walletCurrency = fullUser.userWallet?.wltCurrencyCode || userCurrency;
//         const walletBalance = Number(fullUser.userWallet?.wltAvailableBalance || 0);
//         walletBalanceNative = walletCurrency === auctionCurrency
//           ? walletBalance
//           : await convertAmount(walletBalance, walletCurrency, auctionCurrency);
//       } catch (conversionErr: any) {
//         strapi.log.error('[bid.place] Currency conversion failed (minimum balance check):', conversionErr.message);
//         return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
//       }

//       if (walletBalanceNative < minRequiredNative) {
//         return ctx.badRequest(`Minimum wallet balance of ${minRequiredNative.toFixed(2)} ${auctionCurrency} equivalent required before bidding on this item.`);
//       }

//       const bid = await strapi.db.query('api::bid.bid').create({
//         data: {
//           bidAmountNative,
//           bidNativeCurrencyCode: auctionCurrency,
//           bidAmountLocalSnapshot: bidAmountLocal,
//           bidLocalCurrencyCode: userCurrency,
//           bidWasConverted,
//           bidSecuredDepositHeld: 0,
//           bidStatus: 'active_leading',
//           bidder: user.id,
//           auctionItem: auctionItem.id,
//         },
//       });

//       // ── Mark previous leading bid(s) as outbid ───────────────────────────
//       // Resolve target ids with a plain findMany first, then updateMany on a
//       // scalar `id: { $in }` filter only — mixing a relation filter with $ne
//       // directly inside updateMany's `where` crashes Strapi's query builder.
//       const previousLeadingBids = await strapi.db.query('api::bid.bid').findMany({
//         where: { auctionItem: auctionItem.id, bidStatus: 'active_leading', id: { $ne: bid.id } },
//         select: ['id'],
//       });

//       if (previousLeadingBids.length > 0) {
//         await strapi.db.query('api::bid.bid').updateMany({
//           where: { id: { $in: previousLeadingBids.map((b) => b.id) } },
//           data: { bidStatus: 'outbid_refunded' },
//         });
//       }

//       await strapi.db.query('api::auction-item.auction-item').update({
//         where: { id: auctionItem.id },
//         data: { actCurrentHighestPriceNative: bidAmountNative, currentWinningBuyer: user.id },
//       });

//       const now = Date.now();
//       const endTime = new Date(auctionItem.actListingTimeEnd).getTime();
//       const triggerWindowMs = Number(settings.bidExtensionTriggerWindowMins) * 60 * 1000;
//       if (endTime - now <= triggerWindowMs) {
//         const newEnd = new Date(now + triggerWindowMs);
//         await strapi.db.query('api::auction-item.auction-item').update({
//           where: { id: auctionItem.id },
//           data: { actListingTimeEnd: newEnd },
//         });
//         socketService.emitAuctionExtended(auctionItem.id, newEnd.toISOString());
//       }

//       socketService.emitBidPlaced(auctionItem.id, {
//         bidId: bid.id,
//         bidderId: user.id,
//         bidAmountNative,
//         bidNativeCurrencyCode: auctionCurrency,
//         bidAmountLocalSnapshot: bidAmountLocal,
//         bidLocalCurrencyCode: userCurrency,
//         bidWasConverted,
//       });

//       ctx.send({ status: true, bid });
//     } catch (error: any) {
//       strapi.log.error('[bid.place] Error placing bid:', error);
//       ctx.internalServerError('Failed to place bid');
//     }
//   },

//   async myBids(ctx) {
//     try {
//       const userId = ctx.state.user?.id;
//       if (!userId) return ctx.unauthorized('Login required');
//       const bids = await strapi.db.query('api::bid.bid').findMany({
//         where: { bidder: userId },
//         populate: ['auctionItem'],
//         orderBy: { createdAt: 'desc' },
//       });
//       ctx.send({ success: true, bids });
//     } catch (error) {
//       console.error('Error fetching own bids:', error);
//       ctx.internalServerError('Failed to fetch bids');
//     }
//   },
// }));
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
      });
      if (!auctionItem) return ctx.notFound('Auction item not found');
      if (auctionItem.actAuctionStatus !== 'active') return ctx.badRequest('Auction is not active');

      const auctionCurrency = auctionItem.actNativeCurrencyCode;

      const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
        where: { id: user.id },
        populate: { country: { populate: ['currency'] }, userWallet: true },
      });

      const userCurrency = fullUser.country?.currency?.currCode;
      if (!userCurrency) return ctx.badRequest('Your account has no country/currency set — please update your profile');

      // Used for every error message below that shows a money amount to
      // the bidder — errors should always speak in the BIDDER's own
      // currency/symbol, never the listing's native currency, regardless
      // of which currency the underlying check itself is computed in.
      const userCurrencySymbol = fullUser.country?.currency?.currSymbol || userCurrency;

      // Converts a nativeCurrency-denominated amount into the bidder's own
      // currency for display in an error message. Best-effort: if the
      // conversion call itself fails (rate API down, etc.), falls back to
      // the original amount + the native currency's own code rather than
      // throwing — an error message that's slightly less convenient beats
      // a 500 on top of the bid actually being correctly rejected.
      async function formatAmountForBidder(amountInAuctionCurrency: number): Promise<string> {
        try {
          const amountInUserCurrency = userCurrency === auctionCurrency
            ? amountInAuctionCurrency
            : await convertAmount(amountInAuctionCurrency, auctionCurrency, userCurrency);
          return `${userCurrencySymbol}${amountInUserCurrency.toFixed(2)}`;
        } catch (err: any) {
          strapi.log.error('[bid.place] Failed to convert amount for error message:', err.message);
          return `${amountInAuctionCurrency.toFixed(2)} ${auctionCurrency}`;
        }
      }

      const settings = await resolveSettingsForCountry(strapi, fullUser.country?.id);

      // ── Convert bid amount into the auction's native currency, ONLY if
      //    the bidder's currency differs from the auction's currency. ────────
      let bidAmountNative: number;
      let bidWasConverted = false;
      try {
        if (userCurrency === auctionCurrency) {
          bidAmountNative = Number(bidAmountLocal);
        } else {
          bidAmountNative = await convertAmount(Number(bidAmountLocal), userCurrency, auctionCurrency);
          bidWasConverted = true;
        }
      } catch (conversionErr: any) {
        strapi.log.error('[bid.place] Currency conversion failed:', conversionErr.message);
        return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
      }

      if (bidAmountNative <= Number(auctionItem.actCurrentHighestPriceNative)) {
        const highestBidDisplay = await formatAmountForBidder(Number(auctionItem.actCurrentHighestPriceNative));
        return ctx.badRequest(`Bid must exceed the current highest bid of ${highestBidDisplay}`);
      }

      // ── Minimum wallet balance check — also done in the auction's native
      //    currency, so both the settings value and the wallet balance get
      //    converted into that currency ONLY if their source currency differs. ─
      let minRequiredNative: number;
      let walletBalanceNative: number;
      try {
        const basePrice = Number(auctionItem.actStartingPriceNative);

        if (settings.minimumAmountBeforeBidType === 'percentage') {
          // Percentage of the (already native-currency) starting price — no conversion needed ever.
          minRequiredNative = basePrice * (Number(settings.minimumAmountBeforeBid) / 100);
        } else {
          const settingsCurrency = settings._minimumAmountBeforeBidCurrency;
          minRequiredNative = settingsCurrency === auctionCurrency
            ? Number(settings.minimumAmountBeforeBid)
            : await convertAmount(Number(settings.minimumAmountBeforeBid), settingsCurrency, auctionCurrency);
          }

        const walletCurrency = fullUser.userWallet?.wltCurrencyCode || userCurrency;
        const walletBalance = Number(fullUser.userWallet?.wltAvailableBalance || 0);
        walletBalanceNative = walletCurrency === auctionCurrency
          ? walletBalance
          : await convertAmount(walletBalance, walletCurrency, auctionCurrency);
      } catch (conversionErr: any) {
        strapi.log.error('[bid.place] Currency conversion failed (minimum balance check):', conversionErr.message);
        return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
      }

      if (walletBalanceNative < minRequiredNative) {
        const minRequiredDisplay = await formatAmountForBidder(minRequiredNative);
        return ctx.badRequest(`Minimum wallet balance of ${minRequiredDisplay} required before bidding on this item.`);
      }

      const bid = await strapi.db.query('api::bid.bid').create({
        data: {
          bidAmountNative,
          bidNativeCurrencyCode: auctionCurrency,
          bidAmountLocalSnapshot: bidAmountLocal,
          bidLocalCurrencyCode: userCurrency,
          bidWasConverted,
          bidSecuredDepositHeld: 0,
          bidStatus: 'active_leading',
          bidder: user.id,
          auctionItem: auctionItem.id,
        },
      });

      // ── Mark previous leading bid(s) as outbid ───────────────────────────
      // Resolve target ids with a plain findMany first, then updateMany on a
      // scalar `id: { $in }` filter only — mixing a relation filter with $ne
      // directly inside updateMany's `where` crashes Strapi's query builder.
      const previousLeadingBids = await strapi.db.query('api::bid.bid').findMany({
        where: { auctionItem: auctionItem.id, bidStatus: 'active_leading', id: { $ne: bid.id } },
        select: ['id'],
      });

      if (previousLeadingBids.length > 0) {
        await strapi.db.query('api::bid.bid').updateMany({
          where: { id: { $in: previousLeadingBids.map((b) => b.id) } },
          data: { bidStatus: 'outbid_refunded' },
        });
      }

      await strapi.db.query('api::auction-item.auction-item').update({
        where: { id: auctionItem.id },
        data: { actCurrentHighestPriceNative: bidAmountNative, currentWinningBuyer: user.id },
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
        bidAmountNative,
        bidNativeCurrencyCode: auctionCurrency,
        bidAmountLocalSnapshot: bidAmountLocal,
        bidLocalCurrencyCode: userCurrency,
        bidWasConverted,
      });

      ctx.send({ status: true, bid });
    } catch (error: any) {
      strapi.log.error('[bid.place] Error placing bid:', error);
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