export default {
  routes: [
   {
      method: 'GET',
      path: '/devices',
      handler: 'device.find',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/devices',
      handler: 'device.create',
      config: { policies: [], middlewares: [] },
    },
    // ─── 5. Single generic param (:id) ──────────────────────────────────────
    {
      method: 'GET',
      path: '/devices/:id',
      handler: 'device.findOne',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'PUT',
      path: '/devices/:id',
      handler: 'device.update',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/devices/:id',
      handler: 'device.delete',
      config: { policies: [], middlewares: [] },
    },
  ],
};