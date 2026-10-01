import socketService from './socketService';

const NOTIFICATION_TYPES = new Set([
  'bid_placed',
  'outbid',
  'auction_closed',
  'auction_forfeited',
  'auction_paid',
  'payment_success',
  'payment_failed',
  'payment_required',
  'general',
]);

export async function createAndEmitNotification(
  strapi: any,
  userId: number,
  notification: { title: string; body: string; data?: Record<string, unknown> },
) {
  const kind = String(notification.data?.kind || 'general');
  let stored: any = null;
  try {
    stored = await strapi.db.query('api::notification.notification').create({
      data: {
        title: notification.title,
        body: notification.body,
        notificationType: NOTIFICATION_TYPES.has(kind) ? kind : 'general',
        data: notification.data || {},
        isRead: false,
        user: userId,
      },
    });
  } catch (error) {
    strapi.log.error('[notificationService] Failed to persist notification', error);
  }

  socketService.emitNotification(userId, {
    ...notification,
    notificationId: stored?.id || null,
    notificationType: stored?.notificationType || (NOTIFICATION_TYPES.has(kind) ? kind : 'general'),
    isRead: false,
    createdAt: stored?.createdAt || new Date().toISOString(),
  });
  return stored;
}