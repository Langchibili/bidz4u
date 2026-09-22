/**
 * currency controller
 */

import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::currency.currency', ({ strapi }) => ({
  /**
   * POST /currencies/convert-price
   * Body: { amount: number, fromCurrencyCode: string, toCurrencyCode?: string }
   *
   * Converts `amount` (denominated in fromCurrencyCode) into the caller's
   * own currency by default — resolved from their country's configured
   * currency, the same relation the wallet/settings flows already use —
   * or into an explicitly-requested toCurrencyCode if one is given.
   *
   * This is the endpoint for DISPLAY-purpose conversions: "what should this
   * price look like in my currency", e.g. for auction cards and the
   * auction detail page when an item is listed in a different currency
   * than the viewer's own. It's intentionally separate from bid.place's
   * own server-side conversion, which is transaction-critical and must
   * happen at the moment a bid is placed, not be cached for display.
   */
  async convertPrice(ctx) {
    try {
      const userId = ctx.state.user?.id;
      if (!userId) return ctx.unauthorized('Login required');

      const { amount, fromCurrencyCode, toCurrencyCode } = ctx.request.body || {};
      if (amount === undefined || amount === null || Number.isNaN(Number(amount))) {
        return ctx.badRequest('amount is required and must be numeric');
      }
      if (!fromCurrencyCode) return ctx.badRequest('fromCurrencyCode is required');

      let targetCode = toCurrencyCode;
      let targetSymbol: string | undefined;

      if (targetCode) {
        const targetCurrency = await strapi.db.query('api::currency.currency').findOne({
          where: { currCode: targetCode },
        });
        if (!targetCurrency) return ctx.badRequest(`Unknown currency code: ${targetCode}`);
        targetSymbol = targetCurrency.currSymbol;
      } else {
        const user = await strapi.db.query('plugin::users-permissions.user').findOne({
          where: { id: userId },
          populate: { country: { populate: ['currency'] } },
        });
        const userCurrency = user?.country?.currency;
        if (!userCurrency?.currCode) {
          return ctx.badRequest('Your account has no country/currency set — please update your profile');
        }
        targetCode = userCurrency.currCode;
        targetSymbol = userCurrency.currSymbol;
      }

      const { convertAmount } = await import('../../../services/currencyConversion');

      const numericAmount = Number(amount);
      const wasConverted = fromCurrencyCode !== targetCode;
      const convertedAmount = wasConverted
        ? await convertAmount(numericAmount, fromCurrencyCode, targetCode)
        : numericAmount;

      ctx.send({
        success: true,
        amount: convertedAmount,
        currencyCode: targetCode,
        currencySymbol: targetSymbol || targetCode,
        wasConverted,
      });
    } catch (error: any) {
      if (typeof error?.message === 'string' && error.message.startsWith('Currency conversion unavailable')) {
        strapi.log.error('[currency.convertPrice]', error.message);
        return ctx.badRequest('Currency conversion is temporarily unavailable. Please try again shortly.');
      }
      strapi.log.error('[currency.convertPrice] Unexpected error:', error);
      ctx.internalServerError('Failed to convert price');
    }
  },
}));