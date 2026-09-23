export default {
  routes: [
   {
      method: 'GET',
      path: '/devices',
      handler: 'device.find',
      config: { auth: {}, policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/devices',
      handler: 'device.create',
      config: { auth: {}, policies: [], middlewares: [] },
    },
    // ─── 5. Single generic param (:id) ──────────────────────────────────────
    {
      method: 'GET',
      path: '/devices/:id',
      handler: 'device.findOne',
      config: { auth: {}, policies: [], middlewares: [] },
    },
    {
      method: 'PUT',
      path: '/devices/:id',
      handler: 'device.update',
      config: { auth: {}, policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/devices/:id',
      handler: 'device.delete',
      config: { auth: {}, policies: [], middlewares: [] },
    },
  ],
};