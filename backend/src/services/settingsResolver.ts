// backend/src/services/settingsResolver.ts

/**
 * Resolves an effective settings object for a given country:
 * country-level value wins if non-null, otherwise falls back to admn_settings.
 */

const FIELD_MAP: Record<string, string> = {
  allowAffiliate: 'fallbackAllowAffiliate',
  allowSelfDelivery: 'fallbackAllowSelfDelivery',
  minimumAmountBeforeBidType: 'fallbackMinimumAmountBeforeBidType',
  minimumAmountBeforeBid: 'fallbackMinimumAmountBeforeBid',
  timeToAllowBidWinnerToPayInMins: 'fallbackTimeToAllowBidWinnerToPayInMins',
  maximumTimeBeforeBiddingClosesInMins: 'fallbackMaximumTimeBeforeBiddingClosesInMins',
  minimumBidsBeforeAuctionClose: 'fallbackMinimumBidsBeforeAuctionClose',
  bidExtensionTriggerWindowMins: 'fallbackBidExtensionTriggerWindowMins',
  maxSimultaneousBidsPerUser: 'fallbackMaxSimultaneousBidsPerUser',
  forfeitureSplitSellerPercentage: 'fallbackForfeitureSplitSellerPercentage',
  coolDownPeriodAfterForfeitMins: 'fallbackCoolDownPeriodAfterForfeitMins',
  agentCommissionSplitPercentage: 'fallbackAgentCommissionSplitPercentage',
  absorbPaymentFees: 'fallbackAbsorbPaymentFees',
  paymentGateway: 'fallbackPaymentGateway',
  cntPollIntervalMs: 'fallbackPollIntervalMs',
};

export async function resolveSettingsForCountry(strapi: any, countryId?: number | null) {
  const admnSettings = await strapi.db.query('api::admn-setting.admn-setting').findOne({
    populate: { prefferedSettingsCurrency: true },
  });

  let country: any = null;
  if (countryId) {
    country = await strapi.db.query('api::country.country').findOne({
      where: { id: countryId },
      populate: { currency: true },
    });
  }

  const resolved: Record<string, any> = {};
  for (const [countryField, admnField] of Object.entries(FIELD_MAP)) {
    const countryVal = country?.[countryField];
    resolved[countryField] = countryVal !== null && countryVal !== undefined
      ? countryVal
      : admnSettings?.[admnField];
  }

  resolved._settingsBaseCurrency = admnSettings?.prefferedSettingsCurrency?.currCode || 'ZMW';
  resolved._userCurrency = country?.currency?.currCode || resolved._settingsBaseCurrency;
  resolved._pollIntervalMs = resolved.cntPollIntervalMs;

  return resolved;
}
