import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::notification.notification', ({ strapi }) => ({
  async mine(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');

    const page = Math.max(1, Number(ctx.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(ctx.query.pageSize) || 20));
    const unreadOnly = ctx.query.unread === 'true';
    const where: Record<string, any> = { user: userId };
    if (unreadOnly) where.isRead = false;

    const [notifications, total, unreadCount] = await Promise.all([
      strapi.db.query('api::notification.notification').findMany({
        where,
        orderBy: { createdAt: 'desc' },
        offset: (page - 1) * pageSize,
        limit: pageSize,
      }),
      strapi.db.query('api::notification.notification').count({ where }),
      strapi.db.query('api::notification.notification').count({ where: { user: userId, isRead: false } }),
    ]);

    ctx.send({
      data: notifications,
      unreadCount,
      meta: { pagination: { page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)), total } },
    });
  },

  async unreadCount(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');
    const count = await strapi.db.query('api::notification.notification').count({ where: { user: userId, isRead: false } });
    ctx.send({ unreadCount: count });
  },

  async markRead(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');
    const notification = await strapi.db.query('api::notification.notification').findOne({
      where: { id: ctx.params.id, user: userId },
      select: ['id', 'isRead'],
    });
    if (!notification) return ctx.notFound('Notification not found');
    const updated = await strapi.db.query('api::notification.notification').update({
      where: { id: notification.id },
      data: { isRead: true, readAt: notification.isRead ? undefined : new Date() },
    });
    ctx.send({ data: updated });
  },

  async markUnread(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');
    const notification = await strapi.db.query('api::notification.notification').findOne({
      where: { id: ctx.params.id, user: userId },
      select: ['id', 'isRead'],
    });
    if (!notification) return ctx.notFound('Notification not found');
    const updated = await strapi.db.query('api::notification.notification').update({
      where: { id: notification.id },
      data: { isRead: false, readAt: null },
    });
    ctx.send({ data: updated });
  },

  async markAllRead(ctx) {
    const userId = ctx.state.user?.id;
    if (!userId) return ctx.unauthorized('Authentication required');
    await strapi.db.query('api::notification.notification').updateMany({
      where: { user: userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    ctx.send({ success: true });
  },
}));