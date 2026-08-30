/**
 * Resolves an effective settings object for a given country:
 * country-level value wins if non-null, otherwise falls back to admn_settings.
 *
 * Money fields need to know WHICH currency they're denominated in, since a
 * country override is assumed to be in that country's own currency, while an
 * admn_settings fallback is in admn_settings.prefferedSettingsCurrency.
 * `minimumAmountBeforeBid` and `minimumAuctionStartingPrice` are the two
 * money fields among the resolved settings — everything else is a boolean,
 * enum, percentage, or duration in minutes.
 */

const FIELD_MAP: Record<string, string> = {
  allowAffiliate: 'fallbackAllowAffiliate',
  allowSelfDelivery: 'fallbackAllowSelfDelivery',
  minimumAmountBeforeBidType: 'fallbackMinimumAmountBeforeBidType',
  minimumAmountBeforeBid: 'fallbackMinimumAmountBeforeBid',
  minimumAuctionStartingPrice: 'fallbackMinimumAuctionStartingPrice',
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

  const settingsBaseCurrency = admnSettings?.prefferedSettingsCurrency?.currCode || 'ZMW';
  const userCurrency = country?.currency?.currCode || settingsBaseCurrency;

  resolved._settingsBaseCurrency = settingsBaseCurrency;
  resolved._userCurrency = userCurrency;
  resolved._pollIntervalMs = resolved.cntPollIntervalMs;

  // minimumAmountBeforeBid is denominated in the country's currency if the
  // country overrode it, otherwise in admn_settings.prefferedSettingsCurrency.
  const minimumAmountCameFromCountry = country?.minimumAmountBeforeBid !== null && country?.minimumAmountBeforeBid !== undefined;
  resolved._minimumAmountBeforeBidCurrency = minimumAmountCameFromCountry ? userCurrency : settingsBaseCurrency;

  // Same rule for minimumAuctionStartingPrice.
  const minimumStartingPriceCameFromCountry = country?.minimumAuctionStartingPrice !== null && country?.minimumAuctionStartingPrice !== undefined;
  resolved._minimumAuctionStartingPriceCurrency = minimumStartingPriceCameFromCountry ? userCurrency : settingsBaseCurrency;

  return resolved;
}