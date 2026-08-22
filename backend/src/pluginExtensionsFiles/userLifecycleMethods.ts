// backend/src/pluginExtensionsFiles/userLifecycleMethods.ts

import { SendSmsNotification } from '../services/messages';

interface User { id: number; documentId?: string; country?: any; }

async function initializeWallet(strapi: any, user: User) {
  const country = user.country
    ? await strapi.db.query('api::country.country').findOne({ where: { id: user.country }, populate: ['currency'] })
    : null;

  await strapi.db.query('api::wallet.wallet').create({
    data: {
      wltAvailableBalance: 0,
      wltLockedEscrowBalance: 0,
      wltCurrencyCode: country?.currency?.currCode || 'ZMW',
      walletOwner: user.id,
    },
  });
}

export async function handleUserCreation(strapi: any, user: User): Promise<void> {
  try {
    await initializeWallet(strapi, user);
    strapi.log?.info(`✅ Wallet initialized for user ${user.id}`);
  } catch (error) {
    strapi.log?.error('❌ Error in handleUserCreation:', error);
  }
}

export async function handleUserUpdate(strapi: any, user: any, params: any): Promise<void> {
  try {
    const kycApproved = params?.data?.usrKycVerified === true;
    if (!kycApproved) return;

    const fullUser = await strapi.db.query('plugin::users-permissions.user').findOne({
      where: { id: user.id },
      select: ['id', 'usrFullName', 'username'],
    });
    if (!fullUser?.username) return;

    await SendSmsNotification(
      fullUser.username,
      `Dear ${fullUser.usrFullName || 'user'}, your bidz4u account has been verified. You can now bid on live auctions.`
    );
  } catch (error) {
    strapi.log?.error('❌ Error in handleUserUpdate:', error);
  }
}