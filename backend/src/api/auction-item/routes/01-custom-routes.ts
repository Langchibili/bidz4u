export default {
  routes: [
    {
      method: "GET",
      path: "/auction-items/:id/lightweight-status",
      handler: "auction-item.lightweightStatus",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auction-items/:id/confirm-delivery",
      handler: "auction-item.confirmDelivery",
      config: { auth: {} },
    },
  ],
};
