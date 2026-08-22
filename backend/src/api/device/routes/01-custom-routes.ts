// src/api/device/routes/custom-routes.ts

export default {
  routes: [
    // ─── 1. Literal sub-paths (must come before /:id) ───────────────────────
    {
      method: 'POST',
      path: '/devices/register',
      handler: 'device.registerDevices',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'POST',
      path: '/devices/updatecurrentloc',
      handler: 'device.updateUserCurrentLocation',
      config: { policies: [], middlewares: [] },
    },

    // ─── 2. Literal prefix + single param ───────────────────────────────────
    // {
    //   method: 'GET',
    //   path: '/devices/activeride/:deviceId',
    //   handler: 'device.getActiveRideByDevice',
    //   config: { policies: [], middlewares: [] },
    // },
    // {
    //   method: 'POST',
    //   path: '/devices/acceptride/:deviceId',
    //   handler: 'device.acceptRideByDevice',
    //   config: { policies: [], middlewares: [] },
    // },
    // {
    //   method: 'POST',
    //   path: '/devices/acceptdelivery/:deviceId',
    //   handler: 'device.acceptDeliveryByDevice',
    //   config: { policies: [], middlewares: [] },
    // },

    {
      method: 'GET',
      path: '/devices/user/:userId',
      handler: 'device.getUserDevices',
      config: { policies: [], middlewares: [] },
    },
    
    // {
    //   method: 'GET',
    //   path: '/devices/pending-ride/:deviceId',
    //   handler: 'device.getPendingRideByDevice',
    //   config: { auth: false, policies: [], middlewares: [] },
    // },
    // {
    //   method: 'GET',
    //   path: '/devices/pending-delivery/:deviceId',
    //   handler: 'device.getPendingDeliveryByDevice',
    //   config: { policies: [], middlewares: [] },
    // },
    
    // ─── 3. Unrelated prefix (/device singular) ─────────────────────────────
    {
      method: 'GET',
      path: '/device/:deviceId/permissions',
      handler: 'device.checkDevicePermissions',
      config: { policies: [], middlewares: [] },
    },
    // ─── 6. Two generic params (:userId/:deviceId) ──────────────────────────
    {
      method: 'PUT',
      path: '/devices/:userId/:deviceId',
      handler: 'device.updateDevice',
      config: { policies: [], middlewares: [] },
    },
    {
      method: 'DELETE',
      path: '/devices/:userId/:deviceId',
      handler: 'device.removeDevice',
      config: { policies: [], middlewares: [] },
    },
  ],
};