// // PATH: backend/scripts/seed.js
// //
// // Populates bidz4u with dummy data: currencies, countries, admn_settings,
// // test user accounts (with wallets auto-created via lifecycle), sample
// // auction items, and sample bids tying users + items together.
// //
// // USAGE:
// //   node scripts/seed.js
// //
// // REQUIRES:
// //   - STRAPI_URL pointing at your running Strapi instance
// //   - API_TOKEN — a Full Access API token (Settings → API Tokens → Create new,
// //     type: "Full access"). This is NOT a user JWT — /users, /countries,
// //     /currencies, /admn-settings all need elevated permissions a normal
// //     authenticated user JWT won't have.
// //   - `npm install axios form-data` in backend/ if not already present

// const axios = require('axios');
// const FormData = require('form-data');

// // ==================== CONFIGURATION ====================
// const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1367';
// const API_TOKEN = process.env.STRAPI_API_TOKEN || '2bfe298353e023e573fa4ddb915fbbaa01ed2105342db0bffc4c50c49af43690a0ec2a28d2b27404835ec0ef03c1bc8f79482b6e5b91d1e35d58daa0064a9b5e3f0161aecfd2750129a4819bb2f86ebe350b39c360e996fb259a4f7b1f17900a6c2f3ba872043afcdd0481ee3b646529979c3e3e87e9ba01572c4f7f036ee076';

// const api = axios.create({
//   baseURL: `${STRAPI_URL}/api`,
//   headers: {
//     Authorization: `Bearer ${API_TOKEN}`,
//     'Content-Type': 'application/json',
//   },
// });

// const handleError = (error, context) => {
//   console.error(`❌ Error in ${context}:`, error.response?.data?.error?.message || error.response?.data || error.message);
// };

// async function findOrCreate(endpoint, data, uniqueField) {
//   try {
//     const searchValue = data[uniqueField];
//     const findResponse = await api.get(`${endpoint}?filters[${uniqueField}][$eq]=${encodeURIComponent(searchValue)}`);

//     if (findResponse.data.data?.length > 0) {
//       console.log(`⊙ Found existing: ${searchValue}`);
//       return findResponse.data.data[0];
//     }

//     const createResponse = await api.post(endpoint, { data });
//     console.log(`✓ Created: ${searchValue}`);
//     return createResponse.data.data;
//   } catch (error) {
//     handleError(error, `finding/creating ${endpoint} (${data[uniqueField]})`);
//     return null;
//   }
// }

// // Users live under plugin::users-permissions.user — no `data` wrapper, and
// // `find` filters by username directly (no /api prefix issue since baseURL already has it).
// async function findOrCreateUser(userData) {
//   try {
//     const findResponse = await api.get(`/users?filters[username][$eq]=${encodeURIComponent(userData.username)}`);
//     if (findResponse.data?.length > 0) {
//       console.log(`⊙ Found existing user: ${userData.username}`);
//       return findResponse.data[0];
//     }

//     const createResponse = await api.post('/users', userData);
//     console.log(`✓ Created user: ${userData.username} (${userData.email})`);
//     return createResponse.data;
//   } catch (error) {
//     handleError(error, `creating user ${userData.username}`);
//     return null;
//   }
// }

// // Uploads a placeholder image (fetched from picsum.photos) and returns the
// // Strapi media file id, for auction-item.actImages (required, multiple media).
// async function uploadPlaceholderImage(seedLabel) {
//   try {
//     const imageResponse = await axios.get(`https://picsum.photos/seed/${encodeURIComponent(seedLabel)}/800/600`, {
//       responseType: 'arraybuffer',
//     });

//     const form = new FormData();
//     form.append('files', Buffer.from(imageResponse.data), {
//       filename: `${seedLabel}.jpg`,
//       contentType: 'image/jpeg',
//     });

//     const uploadResponse = await axios.post(`${STRAPI_URL}/api/upload`, form, {
//       headers: { ...form.getHeaders(), Authorization: `Bearer ${API_TOKEN}` },
//     });

//     return uploadResponse.data[0]?.id || null;
//   } catch (error) {
//     handleError(error, `uploading placeholder image for ${seedLabel}`);
//     return null;
//   }
// }

// const createdIds = {};

// // ==================== DUMMY DATA ====================

// const dummyData = {
//   currencies: [
//     { currCode: 'ZMW', currSymbol: 'ZK', currName: 'Zambian Kwacha', currExchangeRateToUsdCached: 0.038 },
//     { currCode: 'USD', currSymbol: '$', currName: 'US Dollar', currExchangeRateToUsdCached: 1 },
//     { currCode: 'ZAR', currSymbol: 'R', currName: 'South African Rand', currExchangeRateToUsdCached: 0.054 },
//     { currCode: 'KES', currSymbol: 'KSh', currName: 'Kenyan Shilling', currExchangeRateToUsdCached: 0.0077 },
//     { currCode: 'NGN', currSymbol: '₦', currName: 'Nigerian Naira', currExchangeRateToUsdCached: 0.00062 },
//   ],

//   countries: (currencyIds) => [
//     {
//       countryName: 'Zambia', countryCode: 'ZM', savedPhoneCode: '260', phoneNumberDigitLenth: 9, cntIsActive: true,
//       allowAffiliate: true, allowSelfDelivery: true,
//       minimumAmountBeforeBidType: 'percentage', minimumAmountBeforeBid: 5,
//       timeToAllowBidWinnerToPayInMins: 30, maximumTimeBeforeBiddingClosesInMins: 1440,
//       minimumBidsBeforeAuctionClose: 1, bidExtensionTriggerWindowMins: 10,
//       maxSimultaneousBidsPerUser: 5, forfeitureSplitSellerPercentage: 50,
//       coolDownPeriodAfterForfeitMins: 1440, agentCommissionSplitPercentage: 50,
//       absorbPaymentFees: false, paymentGateway: 'pawapay', cntPollIntervalMs: 3000,
//       currency: currencyIds[0],
//     },
//     {
//       countryName: 'Kenya', countryCode: 'KE', savedPhoneCode: '254', phoneNumberDigitLenth: 9, cntIsActive: true,
//       allowAffiliate: true, allowSelfDelivery: true,
//       minimumAmountBeforeBidType: 'flatrate', minimumAmountBeforeBid: 500,
//       timeToAllowBidWinnerToPayInMins: 45, maximumTimeBeforeBiddingClosesInMins: null,
//       minimumBidsBeforeAuctionClose: null, bidExtensionTriggerWindowMins: 15,
//       maxSimultaneousBidsPerUser: null, forfeitureSplitSellerPercentage: 60,
//       coolDownPeriodAfterForfeitMins: null, agentCommissionSplitPercentage: null,
//       absorbPaymentFees: true, paymentGateway: 'lenco', cntPollIntervalMs: null,
//       currency: currencyIds[3],
//     },
//     {
//       countryName: 'South Africa', countryCode: 'ZA', savedPhoneCode: '27', phoneNumberDigitLenth: 9, cntIsActive: true,
//       allowAffiliate: false, allowSelfDelivery: true,
//       minimumAmountBeforeBidType: null, minimumAmountBeforeBid: null,
//       timeToAllowBidWinnerToPayInMins: null, maximumTimeBeforeBiddingClosesInMins: 2880,
//       minimumBidsBeforeAuctionClose: null, bidExtensionTriggerWindowMins: null,
//       maxSimultaneousBidsPerUser: null, forfeitureSplitSellerPercentage: null,
//       coolDownPeriodAfterForfeitMins: null, agentCommissionSplitPercentage: null,
//       absorbPaymentFees: false, paymentGateway: 'none', cntPollIntervalMs: null,
//       currency: currencyIds[2],
//     },
//     {
//       countryName: 'Nigeria', countryCode: 'NG', savedPhoneCode: '234', phoneNumberDigitLenth: 10, cntIsActive: true,
//       allowAffiliate: true, allowSelfDelivery: false,
//       minimumAmountBeforeBidType: 'percentage', minimumAmountBeforeBid: 10,
//       timeToAllowBidWinnerToPayInMins: 60, maximumTimeBeforeBiddingClosesInMins: 1440,
//       minimumBidsBeforeAuctionClose: 2, bidExtensionTriggerWindowMins: 10,
//       maxSimultaneousBidsPerUser: 3, forfeitureSplitSellerPercentage: 40,
//       coolDownPeriodAfterForfeitMins: 2880, agentCommissionSplitPercentage: 45,
//       absorbPaymentFees: false, paymentGateway: 'lenco', cntPollIntervalMs: 5000,
//       currency: currencyIds[4],
//     },
//   ],

//   // Single type — country-level fields left null above intentionally, to
//   // exercise the settingsResolver fallback-to-admn_settings path.
//   admnSetting: (currencyIds) => ({
//     fallbackAllowAffiliate: false,
//     fallbackAllowSelfDelivery: true,
//     fallbackMinimumAmountBeforeBidType: 'percentage',
//     fallbackMinimumAmountBeforeBid: 5.0,
//     fallbackTimeToAllowBidWinnerToPayInMins: 30,
//     fallbackMaximumTimeBeforeBiddingClosesInMins: 1440,
//     fallbackMinimumBidsBeforeAuctionClose: 1,
//     fallbackBidExtensionTriggerWindowMins: 10,
//     fallbackMaxSimultaneousBidsPerUser: 3,
//     fallbackForfeitureSplitSellerPercentage: 50.0,
//     fallbackCoolDownPeriodAfterForfeitMins: 1440,
//     fallbackAgentCommissionSplitPercentage: 50.0,
//     fallbackAbsorbPaymentFees: false,
//     fallbackPaymentGateway: 'pawapay',
//     fallbackPollIntervalMs: 3000,
//     prefferedSettingsCurrency: currencyIds[0], // ZMW
//   }),

//   // Password only matters if you ever want to log in as these accounts via
//   // /auth/local — the real app uses OTP-only login, this is just for seeding.
//   users: (countryIds) => [
//     { username: '260971111111', email: 'test1@testmail.com', usrFullName: 'Test Bidder One', usrPhoneNormalized: '260971111111', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[0] },
//     { username: '260972222222', email: 'test2@testmail.com', usrFullName: 'Test Bidder Two', usrPhoneNormalized: '260972222222', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[0] },
//     { username: '254712345678', email: 'test3@testmail.com', usrFullName: 'Test Bidder Three (Kenya)', usrPhoneNormalized: '254712345678', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[1] },
//     { username: '27821234567', email: 'test4@testmail.com', usrFullName: 'Test Seller One (SA)', usrPhoneNormalized: '27821234567', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[2] },
//     { username: '2348012345678', email: 'test5@testmail.com', usrFullName: 'Test Seller Two (Nigeria)', usrPhoneNormalized: '2348012345678', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[3] },
//     { username: '260973333333', email: 'test6@testmail.com', usrFullName: 'Test Admin-ish User', usrPhoneNormalized: '260973333333', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[0] },
//   ],

//   // sellerIndex/countryIndex reference positions in createdIds.users / createdIds.countries
//   auctionItems: [
//     { actTitle: 'Vintage Leather Sofa', actDescription: 'Well-kept 3-seater leather sofa, minor wear.', actStartingPriceUsd: 80, sellerIndex: 3, countryIndex: 2, hoursFromNow: 48 },
//     { actTitle: 'iPhone 13 Pro — 256GB', actDescription: 'Unlocked, good battery health, small scratch on back.', actStartingPriceUsd: 350, sellerIndex: 4, countryIndex: 3, hoursFromNow: 24 },
//     { actTitle: 'Mountain Bike — 26"', actDescription: 'Hardtail, recently serviced, ready to ride.', actStartingPriceUsd: 60, sellerIndex: 3, countryIndex: 2, hoursFromNow: 72 },
//     { actTitle: 'Samsung 55" 4K TV', actDescription: 'Barely used, comes with remote and wall mount.', actStartingPriceUsd: 220, sellerIndex: 5, countryIndex: 0, hoursFromNow: 12 },
//     { actTitle: 'Office Desk & Chair Set', actDescription: 'Compact home-office setup, oak finish.', actStartingPriceUsd: 45, sellerIndex: 4, countryIndex: 3, hoursFromNow: 96 },
//   ],

//   // bidderIndex/itemIndex reference positions in createdIds.users / createdIds.auctionItems
//   bids: [
//     { itemIndex: 0, bidderIndex: 0, amountAboveStart: 5 },
//     { itemIndex: 0, bidderIndex: 1, amountAboveStart: 12 },
//     { itemIndex: 1, bidderIndex: 1, amountAboveStart: 20 },
//     { itemIndex: 3, bidderIndex: 0, amountAboveStart: 10 },
//     { itemIndex: 3, bidderIndex: 2, amountAboveStart: 25 },
//   ],
// };

// // ==================== MAIN ====================

// async function populateData() {
//   console.log('🌱 Starting bidz4u data population...\n');

//   try {
//     // 1. Currencies
//     console.log('Creating Currencies...');
//     createdIds.currencies = [];
//     for (const currency of dummyData.currencies) {
//       const result = await findOrCreate('/currencies', currency, 'currCode');
//       if (result) createdIds.currencies.push(result.id);
//     }

//     // 2. Countries
//     console.log('\nCreating Countries...');
//     createdIds.countries = [];
//     for (const country of dummyData.countries(createdIds.currencies)) {
//       const result = await findOrCreate('/countries', country, 'countryCode');
//       if (result) createdIds.countries.push(result.id);
//     }

//     // 3. Admin Settings (single type — PUT, not POST/findOrCreate)
//     console.log('\nSetting Admin Settings (single type)...');
//     try {
//       await api.put('/admn-setting', { data: dummyData.admnSetting(createdIds.currencies) });
//       console.log('✓ Admin settings configured');
//     } catch (error) {
//       handleError(error, 'setting admn-setting');
//     }

//     // 4. Users (wallets auto-created via afterCreate lifecycle — see userLifecycleMethods.ts)
//     console.log('\nCreating Test Users...');
//     createdIds.users = [];
//     for (const user of dummyData.users(createdIds.countries)) {
//       const result = await findOrCreateUser(user);
//       if (result) createdIds.users.push(result.id);
//     }

//     // 5. Give each user's wallet a starting balance so bidding actually works
//     // (minimumAmountBeforeBid checks will otherwise reject every bid in this seed).
//     console.log('\nTopping up seeded wallets...');
//     for (const userId of createdIds.users) {
//       try {
//         const walletsRes = await api.get(`/wallets?filters[walletOwner][id][$eq]=${userId}`);
//         const wallet = walletsRes.data.data?.[0];
//         if (wallet) {
//           await api.put(`/wallets/${wallet.id}`, { data: { wltAvailableBalance: 500 } });
//           console.log(`✓ Wallet topped up for user ${userId}`);
//         } else {
//           console.log(`⚠ No wallet found for user ${userId} — did the afterCreate lifecycle fire?`);
//         }
//       } catch (error) {
//         handleError(error, `topping up wallet for user ${userId}`);
//       }
//     }

//     // 6. Auction Items (with uploaded placeholder images)
//     console.log('\nCreating Auction Items...');
//     createdIds.auctionItems = [];
//     for (const item of dummyData.auctionItems) {
//       const sellerId = createdIds.users[item.sellerIndex];
//       const countryId = createdIds.countries[item.countryIndex];
//       if (!sellerId || !countryId) {
//         console.log(`⚠ Skipping "${item.actTitle}" — missing seller/country reference`);
//         continue;
//       }

//       const imageId = await uploadPlaceholderImage(item.actTitle.replace(/\s+/g, '-').toLowerCase());
//       const now = new Date();
//       const listingEnd = new Date(now.getTime() + item.hoursFromNow * 60 * 60 * 1000);

//       const payload = {
//         actTitle: item.actTitle,
//         actDescription: item.actDescription,
//         actStartingPriceUsd: item.actStartingPriceUsd,
//         actCurrentHighestPriceUsd: item.actStartingPriceUsd,
//         actListingTimeStart: now,
//         actListingTimeEnd: listingEnd,
//         actAuctionStatus: 'active',
//         actImages: imageId ? [imageId] : [],
//         seller: sellerId,
//         itemOriginCountry: countryId,
//       };

//       const result = await findOrCreate('/auction-items', payload, 'actTitle');
//       if (result) createdIds.auctionItems.push(result.id);
//     }

//     // 7. Bids
//     console.log('\nCreating Bids...');
//     for (const bid of dummyData.bids) {
//       const auctionItemId = createdIds.auctionItems[bid.itemIndex];
//       const bidderId = createdIds.users[bid.bidderIndex];
//       if (!auctionItemId || !bidderId) {
//         console.log('⚠ Skipping a bid — missing item/bidder reference');
//         continue;
//       }

//       const sourceItem = dummyData.auctionItems[bid.itemIndex];
//       const bidAmountUsd = sourceItem.actStartingPriceUsd + bid.amountAboveStart;

//       try {
//         await api.post('/bids', {
//           data: {
//             bidAmountUsd,
//             bidAmountLocalSnapshot: bidAmountUsd,
//             bidLocalCurrencyCode: 'USD',
//             bidSecuredDepositHeld: 0,
//             bidStatus: 'active_leading',
//             bidder: bidderId,
//             auctionItem: auctionItemId,
//           },
//         });
//         console.log(`✓ Bid created: user ${bidderId} → item ${auctionItemId} @ $${bidAmountUsd}`);
//       } catch (error) {
//         handleError(error, `creating bid for item ${auctionItemId}`);
//       }
//     }

//     // 8. Sync each auction item's actCurrentHighestPriceUsd + currentWinningBuyer
//     //    to whichever bid ended up highest (the /bids POST above bypasses the
//     //    bid.place business logic on purpose — this is seed data, not a live bid).
//     console.log('\nSyncing auction item highest bids...');
//     for (let i = 0; i < createdIds.auctionItems.length; i++) {
//       const auctionItemId = createdIds.auctionItems[i];
//       try {
//         const bidsRes = await api.get(`/bids?filters[auctionItem][id][$eq]=${auctionItemId}&sort=bidAmountUsd:desc&pagination[limit]=1&populate=bidder`);
//         const topBid = bidsRes.data.data?.[0];
//         if (topBid) {
//           await api.put(`/auction-items/${auctionItemId}`, {
//             data: {
//               actCurrentHighestPriceUsd: topBid.bidAmountUsd,
//               currentWinningBuyer: topBid.bidder?.id,
//             },
//           });
//           console.log(`✓ Item ${auctionItemId} synced to top bid $${topBid.bidAmountUsd}`);
//         }
//       } catch (error) {
//         handleError(error, `syncing highest bid for item ${auctionItemId}`);
//       }
//     }

//     console.log('\n✅ bidz4u data population completed!\n');
//     console.log('Summary:');
//     console.log(`  Currencies:     ${createdIds.currencies?.length || 0}`);
//     console.log(`  Countries:      ${createdIds.countries?.length || 0}`);
//     console.log(`  Users:          ${createdIds.users?.length || 0}`);
//     console.log(`  Auction Items:  ${createdIds.auctionItems?.length || 0}`);
//     console.log(`  Bids:           ${dummyData.bids.length}`);
//     console.log('\nTest logins (username = phone, no password needed — real login is OTP-only):');
//     dummyData.users(createdIds.countries).forEach((u) => console.log(`  ${u.email}  →  ${u.username}`));
//   } catch (error) {
//     console.error('\n❌ Fatal error during data population:', error.message);
//     process.exit(1);
//   }
// }

// populateData();
// REQUIRES:
//   - STRAPI_URL pointing at your running Strapi instance
//   - API_TOKEN — a Full Access API token (Settings → API Tokens → Create new,
//     type: "Full access"). This is NOT a user JWT — /users, /countries,
//     /currencies, /admn-settings all need elevated permissions a normal
//     authenticated user JWT won't have.
//   - `npm install axios form-data` in backend/ if not already present

const axios = require('axios');
const FormData = require('form-data');

// ==================== CONFIGURATION ====================
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1367';
const API_TOKEN = process.env.STRAPI_API_TOKEN || '2bfe298353e023e573fa4ddb915fbbaa01ed2105342db0bffc4c50c49af43690a0ec2a28d2b27404835ec0ef03c1bc8f79482b6e5b91d1e35d58daa0064a9b5e3f0161aecfd2750129a4819bb2f86ebe350b39c360e996fb259a4f7b1f17900a6c2f3ba872043afcdd0481ee3b646529979c3e3e87e9ba01572c4f7f036ee076';

// Fallback role id if the /users-permissions/roles lookup fails for any reason.
// On a fresh Strapi install, "authenticated" is almost always id 1.
const FALLBACK_AUTHENTICATED_ROLE_ID = 1;

const api = axios.create({
  baseURL: `${STRAPI_URL}/api`,
  headers: {
    Authorization: `Bearer ${API_TOKEN}`,
    'Content-Type': 'application/json',
  },
});

const handleError = (error, context) => {
  console.error(`❌ Error in ${context}:`, error.response?.data?.error?.message || error.response?.data || error.message);
};

async function findOrCreate(endpoint, data, uniqueField) {
  try {
    const searchValue = data[uniqueField];
    const findResponse = await api.get(`${endpoint}?filters[${uniqueField}][$eq]=${encodeURIComponent(searchValue)}`);

    if (findResponse.data.data?.length > 0) {
      console.log(`⊙ Found existing: ${searchValue}`);
      return findResponse.data.data[0];
    }

    const createResponse = await api.post(endpoint, { data });
    console.log(`✓ Created: ${searchValue}`);
    return createResponse.data.data;
  } catch (error) {
    handleError(error, `finding/creating ${endpoint} (${data[uniqueField]})`);
    return null;
  }
}

// The content-API /users create endpoint requires an explicit role relation —
// unlike the public /auth/local/register endpoint, it won't default this for you.
async function getAuthenticatedRoleId() {
  try {
    const res = await api.get('/users-permissions/roles');
    const role = res.data.roles?.find((r) => r.type === 'authenticated');
    if (!role) throw new Error('authenticated role not found in response');
    console.log('✓ Resolved authenticated role id:', role.id);
    return role.id;
  } catch (error) {
    handleError(error, 'fetching authenticated role id');
    console.log(`⚠ Falling back to hardcoded role id ${FALLBACK_AUTHENTICATED_ROLE_ID}`);
    return FALLBACK_AUTHENTICATED_ROLE_ID;
  }
}

// Users live under plugin::users-permissions.user — no `data` wrapper, and
// `find` filters by username directly (no /api prefix issue since baseURL already has it).
async function findOrCreateUser(userData) {
  try {
    const findResponse = await api.get(`/users?filters[username][$eq]=${encodeURIComponent(userData.username)}`);
    if (findResponse.data?.length > 0) {
      console.log(`⊙ Found existing user: ${userData.username}`);
      return findResponse.data[0];
    }

    const createResponse = await api.post('/users', userData);
    console.log(`✓ Created user: ${userData.username} (${userData.email})`);
    return createResponse.data;
  } catch (error) {
    handleError(error, `creating user ${userData.username}`);
    return null;
  }
}

// Uploads a placeholder image (fetched from picsum.photos) and returns the
// Strapi media file id, for auction-item.actImages (required, multiple media).
async function uploadPlaceholderImage(seedLabel, attempt = 1) {
  try {
    const imageResponse = await axios.get(`https://picsum.photos/seed/${encodeURIComponent(seedLabel)}/800/600`, {
      responseType: 'arraybuffer',
      timeout: 15000, // don't hang forever on a flaky connection
    });

    const form = new FormData();
    form.append('files', Buffer.from(imageResponse.data), {
      filename: `${seedLabel}.jpg`,
      contentType: 'image/jpeg',
    });

    const uploadResponse = await axios.post(`${STRAPI_URL}/api/upload`, form, {
      headers: { ...form.getHeaders(), Authorization: `Bearer ${API_TOKEN}` },
      timeout: 20000,
    });

    return uploadResponse.data[0]?.id || null;
  } catch (error) {
    if (attempt < 3) {
      console.log(`↻ Retrying image upload for "${seedLabel}" (attempt ${attempt + 1}/3)...`);
      await new Promise((r) => setTimeout(r, 1500 * attempt)); // simple backoff
      return uploadPlaceholderImage(seedLabel, attempt + 1);
    }
    handleError(error, `uploading placeholder image for ${seedLabel}`);
    return null; // proceed without an image rather than aborting the item
  }
}

const createdIds = {};

// ==================== DUMMY DATA ====================

const dummyData = {
  currencies: [
    { currCode: 'ZMW', currSymbol: 'ZK', currName: 'Zambian Kwacha', currExchangeRateToUsdCached: 0.038 },
    { currCode: 'USD', currSymbol: '$', currName: 'US Dollar', currExchangeRateToUsdCached: 1 },
    { currCode: 'ZAR', currSymbol: 'R', currName: 'South African Rand', currExchangeRateToUsdCached: 0.054 },
    { currCode: 'KES', currSymbol: 'KSh', currName: 'Kenyan Shilling', currExchangeRateToUsdCached: 0.0077 },
    { currCode: 'NGN', currSymbol: '₦', currName: 'Nigerian Naira', currExchangeRateToUsdCached: 0.00062 },
  ],

  countries: (currencyIds) => [
    {
      countryName: 'Zambia', countryCode: 'ZM', savedPhoneCode: '260', phoneNumberDigitLenth: 9, cntIsActive: true,
      allowAffiliate: true, allowSelfDelivery: true,
      minimumAmountBeforeBidType: 'percentage', minimumAmountBeforeBid: 5,
      timeToAllowBidWinnerToPayInMins: 30, maximumTimeBeforeBiddingClosesInMins: 1440,
      minimumBidsBeforeAuctionClose: 1, bidExtensionTriggerWindowMins: 10,
      maxSimultaneousBidsPerUser: 5, forfeitureSplitSellerPercentage: 50,
      coolDownPeriodAfterForfeitMins: 1440, agentCommissionSplitPercentage: 50,
      absorbPaymentFees: false, paymentGateway: 'pawapay', cntPollIntervalMs: 3000,
      currency: currencyIds[0],
    },
    {
      countryName: 'Kenya', countryCode: 'KE', savedPhoneCode: '254', phoneNumberDigitLenth: 9, cntIsActive: true,
      allowAffiliate: true, allowSelfDelivery: true,
      minimumAmountBeforeBidType: 'flatrate', minimumAmountBeforeBid: 500,
      timeToAllowBidWinnerToPayInMins: 45, maximumTimeBeforeBiddingClosesInMins: null,
      minimumBidsBeforeAuctionClose: null, bidExtensionTriggerWindowMins: 15,
      maxSimultaneousBidsPerUser: null, forfeitureSplitSellerPercentage: 60,
      coolDownPeriodAfterForfeitMins: null, agentCommissionSplitPercentage: null,
      absorbPaymentFees: true, paymentGateway: 'lenco', cntPollIntervalMs: null,
      currency: currencyIds[3],
    },
    {
      countryName: 'South Africa', countryCode: 'ZA', savedPhoneCode: '27', phoneNumberDigitLenth: 9, cntIsActive: true,
      allowAffiliate: false, allowSelfDelivery: true,
      minimumAmountBeforeBidType: null, minimumAmountBeforeBid: null,
      timeToAllowBidWinnerToPayInMins: null, maximumTimeBeforeBiddingClosesInMins: 2880,
      minimumBidsBeforeAuctionClose: null, bidExtensionTriggerWindowMins: null,
      maxSimultaneousBidsPerUser: null, forfeitureSplitSellerPercentage: null,
      coolDownPeriodAfterForfeitMins: null, agentCommissionSplitPercentage: null,
      absorbPaymentFees: false, paymentGateway: 'none', cntPollIntervalMs: null,
      currency: currencyIds[2],
    },
    {
      countryName: 'Nigeria', countryCode: 'NG', savedPhoneCode: '234', phoneNumberDigitLenth: 10, cntIsActive: true,
      allowAffiliate: true, allowSelfDelivery: false,
      minimumAmountBeforeBidType: 'percentage', minimumAmountBeforeBid: 10,
      timeToAllowBidWinnerToPayInMins: 60, maximumTimeBeforeBiddingClosesInMins: 1440,
      minimumBidsBeforeAuctionClose: 2, bidExtensionTriggerWindowMins: 10,
      maxSimultaneousBidsPerUser: 3, forfeitureSplitSellerPercentage: 40,
      coolDownPeriodAfterForfeitMins: 2880, agentCommissionSplitPercentage: 45,
      absorbPaymentFees: false, paymentGateway: 'lenco', cntPollIntervalMs: 5000,
      currency: currencyIds[4],
    },
  ],

  // Single type — country-level fields left null above intentionally, to
  // exercise the settingsResolver fallback-to-admn_settings path.
  admnSetting: (currencyIds) => ({
    fallbackAllowAffiliate: false,
    fallbackAllowSelfDelivery: true,
    fallbackMinimumAmountBeforeBidType: 'percentage',
    fallbackMinimumAmountBeforeBid: 5.0,
    fallbackTimeToAllowBidWinnerToPayInMins: 30,
    fallbackMaximumTimeBeforeBiddingClosesInMins: 1440,
    fallbackMinimumBidsBeforeAuctionClose: 1,
    fallbackBidExtensionTriggerWindowMins: 10,
    fallbackMaxSimultaneousBidsPerUser: 3,
    fallbackForfeitureSplitSellerPercentage: 50.0,
    fallbackCoolDownPeriodAfterForfeitMins: 1440,
    fallbackAgentCommissionSplitPercentage: 50.0,
    fallbackAbsorbPaymentFees: false,
    fallbackPaymentGateway: 'pawapay',
    fallbackPollIntervalMs: 3000,
    prefferedSettingsCurrency: currencyIds[0], // ZMW
  }),

  // Password only matters if you ever want to log in as these accounts via
  // /auth/local — the real app uses OTP-only login, this is just for seeding.
  // NOTE: `role` is injected at call time in populateData() once resolved —
  // it is intentionally NOT hardcoded here so it stays a single source of truth.
    users: (countryIds) => [
    { username: '260971111111', email: 'test1@testmail.com', usrFullName: 'Test Bidder One', usrPhoneNormalized: '260971111111', phoneNumber: '260971111111', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[0] },
    { username: '260972222222', email: 'test2@testmail.com', usrFullName: 'Test Bidder Two', usrPhoneNormalized: '260972222222', phoneNumber: '260972222222', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[0] },
    { username: '254712345678', email: 'test3@testmail.com', usrFullName: 'Test Bidder Three (Kenya)', usrPhoneNormalized: '254712345678', phoneNumber: '254712345678', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[1] },
    { username: '27821234567', email: 'test4@testmail.com', usrFullName: 'Test Seller One (SA)', usrPhoneNormalized: '27821234567', phoneNumber: '27821234567', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[2] },
    { username: '2348012345678', email: 'test5@testmail.com', usrFullName: 'Test Seller Two (Nigeria)', usrPhoneNormalized: '2348012345678', phoneNumber: '2348012345678', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[3] },
    { username: '260973333333', email: 'test6@testmail.com', usrFullName: 'Test Admin-ish User', usrPhoneNormalized: '260973333333', phoneNumber: '260973333333', password: 'Test1234!', confirmed: true, provider: 'local', country: countryIds[0] },
  ],

  // sellerIndex/countryIndex reference positions in createdIds.users / createdIds.countries
  auctionItems: [
    { actTitle: 'Vintage Leather Sofa', actDescription: 'Well-kept 3-seater leather sofa, minor wear.', actStartingPriceUsd: 80, sellerIndex: 3, countryIndex: 2, hoursFromNow: 48 },
    { actTitle: 'iPhone 13 Pro — 256GB', actDescription: 'Unlocked, good battery health, small scratch on back.', actStartingPriceUsd: 350, sellerIndex: 4, countryIndex: 3, hoursFromNow: 24 },
    { actTitle: 'Mountain Bike — 26"', actDescription: 'Hardtail, recently serviced, ready to ride.', actStartingPriceUsd: 60, sellerIndex: 3, countryIndex: 2, hoursFromNow: 72 },
    { actTitle: 'Samsung 55" 4K TV', actDescription: 'Barely used, comes with remote and wall mount.', actStartingPriceUsd: 220, sellerIndex: 5, countryIndex: 0, hoursFromNow: 12 },
    { actTitle: 'Office Desk & Chair Set', actDescription: 'Compact home-office setup, oak finish.', actStartingPriceUsd: 45, sellerIndex: 4, countryIndex: 3, hoursFromNow: 96 },
  ],

  // bidderIndex/itemIndex reference positions in createdIds.users / createdIds.auctionItems
  bids: [
    { itemIndex: 0, bidderIndex: 0, amountAboveStart: 5 },
    { itemIndex: 0, bidderIndex: 1, amountAboveStart: 12 },
    { itemIndex: 1, bidderIndex: 1, amountAboveStart: 20 },
    { itemIndex: 3, bidderIndex: 0, amountAboveStart: 10 },
    { itemIndex: 3, bidderIndex: 2, amountAboveStart: 25 },
  ],
};

// ==================== MAIN ====================

async function populateData() {
  console.log('🌱 Starting bidz4u data population...\n');

  try {
    // 1. Currencies
    console.log('Creating Currencies...');
    createdIds.currencies = [];
    for (const currency of dummyData.currencies) {
      const result = await findOrCreate('/currencies', currency, 'currCode');
      if (result) createdIds.currencies.push(result.id);
    }

    // 2. Countries
    console.log('\nCreating Countries...');
    createdIds.countries = [];
    for (const country of dummyData.countries(createdIds.currencies)) {
      const result = await findOrCreate('/countries', country, 'countryCode');
      if (result) createdIds.countries.push(result.id);
    }

    // 3. Admin Settings (single type — PUT, not POST/findOrCreate)
    console.log('\nSetting Admin Settings (single type)...');
    try {
      await api.put('/admn-setting', { data: dummyData.admnSetting(createdIds.currencies) });
      console.log('✓ Admin settings configured');
    } catch (error) {
      handleError(error, 'setting admn-setting');
    }

    // 4. Resolve the authenticated role id ONCE, before building any user payloads.
    //    This was the source of the "role is a required field" failures — the
    //    lookup was never called and its body had a stray reference to an
    //    undefined `roles` variable that silently swallowed the result.
    console.log('\nResolving authenticated role id...');
    const authenticatedRoleId = await getAuthenticatedRoleId();

    // 5. Users (wallets auto-created via afterCreate lifecycle — see userLifecycleMethods.ts)
    console.log('\nCreating Test Users...');
    createdIds.users = [];
    for (const user of dummyData.users(createdIds.countries)) {
      const result = await findOrCreateUser({ ...user, role: authenticatedRoleId });
      if (result) createdIds.users.push(result.id);
    }

    // 6. Give each user's wallet a starting balance so bidding actually works
    // (minimumAmountBeforeBid checks will otherwise reject every bid in this seed).
    console.log('\nTopping up seeded wallets...');
    for (const userId of createdIds.users) {
      try {
        const walletsRes = await api.get(`/wallets?filters[walletOwner][id][$eq]=${userId}`);
        const wallet = walletsRes.data.data?.[0];
        if (wallet) {
          await api.put(`/wallets/${wallet.id}`, { data: { wltAvailableBalance: 500 } });
          console.log(`✓ Wallet topped up for user ${userId}`);
        } else {
          console.log(`⚠ No wallet found for user ${userId} — did the afterCreate lifecycle fire?`);
        }
      } catch (error) {
        handleError(error, `topping up wallet for user ${userId}`);
      }
    }

       // 7. Auction Items (with uploaded placeholder images)
    console.log('\nCreating Auction Items...');
    createdIds.auctionItems = [];
    for (const item of dummyData.auctionItems) {
      const sellerId = createdIds.users[item.sellerIndex];
      const countryId = createdIds.countries[item.countryIndex];
      if (!sellerId || !countryId) {
        console.log(`⚠ Skipping "${item.actTitle}" — missing seller/country reference`);
        continue;
      }

      const imageId = await uploadPlaceholderImage(item.actTitle.replace(/\s+/g, '-').toLowerCase());
      const now = new Date();
      const listingEnd = new Date(now.getTime() + item.hoursFromNow * 60 * 60 * 1000);

      const payload = {
        actTitle: item.actTitle,
        actDescription: item.actDescription,
        actStartingPriceUsd: item.actStartingPriceUsd,
        actCurrentHighestPriceUsd: item.actStartingPriceUsd,
        actListingTimeStart: now.toISOString(),
        actListingTimeEnd: listingEnd.toISOString(),
        actAuctionStatus: 'active',
        actImages: imageId ? [imageId] : [],
        seller: sellerId,
        itemOriginCountry: countryId,
      }

      const result = await findOrCreate('/auction-items', payload, 'actTitle');
      if (result) createdIds.auctionItems.push(result.id);
    }

    // 8. Bids
    console.log('\nCreating Bids...');
    for (const bid of dummyData.bids) {
      const auctionItemId = createdIds.auctionItems[bid.itemIndex];
      const bidderId = createdIds.users[bid.bidderIndex];
      if (!auctionItemId || !bidderId) {
        console.log('⚠ Skipping a bid — missing item/bidder reference');
        continue;
      }

      const sourceItem = dummyData.auctionItems[bid.itemIndex];
      const bidAmountUsd = sourceItem.actStartingPriceUsd + bid.amountAboveStart;

      try {
        await api.post('/bids', {
          data: {
            bidAmountUsd,
            bidAmountLocalSnapshot: bidAmountUsd,
            bidLocalCurrencyCode: 'USD',
            bidSecuredDepositHeld: 0,
            bidStatus: 'active_leading',
            bidder: bidderId,
            auctionItem: auctionItemId,
          },
        });
        console.log(`✓ Bid created: user ${bidderId} → item ${auctionItemId} @ $${bidAmountUsd}`);
      } catch (error) {
        handleError(error, `creating bid for item ${auctionItemId}`);
      }
    }

    // 9. Sync each auction item's actCurrentHighestPriceUsd + currentWinningBuyer
    //    to whichever bid ended up highest (the /bids POST above bypasses the
    //    bid.place business logic on purpose — this is seed data, not a live bid).
    console.log('\nSyncing auction item highest bids...');
    for (let i = 0; i < createdIds.auctionItems.length; i++) {
      const auctionItemId = createdIds.auctionItems[i];
      try {
        const bidsRes = await api.get(`/bids?filters[auctionItem][id][$eq]=${auctionItemId}&sort=bidAmountUsd:desc&pagination[limit]=1&populate=bidder`);
        const topBid = bidsRes.data.data?.[0];
        if (topBid) {
          await api.put(`/auction-items/${auctionItemId}`, {
            data: {
              actCurrentHighestPriceUsd: topBid.bidAmountUsd,
              currentWinningBuyer: topBid.bidder?.id,
            },
          });
          console.log(`✓ Item ${auctionItemId} synced to top bid $${topBid.bidAmountUsd}`);
        }
      } catch (error) {
        handleError(error, `syncing highest bid for item ${auctionItemId}`);
      }
    }

    console.log('\n✅ bidz4u data population completed!\n');
    console.log('Summary:');
    console.log(`  Currencies:     ${createdIds.currencies?.length || 0}`);
    console.log(`  Countries:      ${createdIds.countries?.length || 0}`);
    console.log(`  Users:          ${createdIds.users?.length || 0}`);
    console.log(`  Auction Items:  ${createdIds.auctionItems?.length || 0}`);
    console.log(`  Bids:           ${dummyData.bids.length}`);
    console.log('\nTest logins (username = phone, no password needed — real login is OTP-only):');
    dummyData.users(createdIds.countries).forEach((u) => console.log(`  ${u.email}  →  ${u.username}`));
  } catch (error) {
    console.error('\n❌ Fatal error during data population:', error.message);
    process.exit(1);
  }
}

populateData();