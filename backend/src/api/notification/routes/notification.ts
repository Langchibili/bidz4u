export default {
  routes: [
    { method: 'GET', path: '/notifications/me', handler: 'notification.mine', config: { auth: {} } },
    { method: 'GET', path: '/notifications/unread-count', handler: 'notification.unreadCount', config: { auth: {} } },
    { method: 'PATCH', path: '/notifications/:id/read', handler: 'notification.markRead', config: { auth: {} } },
    { method: 'PATCH', path: '/notifications/:id/unread', handler: 'notification.markUnread', config: { auth: {} } },
    { method: 'POST', path: '/notifications/read-all', handler: 'notification.markAllRead', config: { auth: {} } },
  ],
};