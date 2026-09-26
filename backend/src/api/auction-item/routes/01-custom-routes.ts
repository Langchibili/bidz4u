export default {
  routes: [
    {
      method: "GET",
      path: "/auction-items/me/listings",
      handler: "auction-item.myListings",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/auction-items/:id/lightweight-status",
      handler: "auction-item.lightweightStatus",
      config: { auth: false },
    },
    {
      method: "GET",
      path: "/auction-items/:id/mine",
      handler: "auction-item.mine",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/auction-items/:id/winner",
      handler: "auction-item.winner",
      config: { auth: {} },
    },
    {
      method: "POST",
      path: "/auction-items/:id/accept-price",
      handler: "auction-item.acceptPrice",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/auction-items/:userId/current-draft-id",
      handler: "auction-item.currentDraftId",
      config: { auth: {} },
    },
    {
      method: "POST",
      path: "/auction-items/:id/confirm-delivery",
      handler: "auction-item.confirmDelivery",
      config: { auth: {} },
    },
  ],
};