export default {
  routes: [
    {
      method: "GET",
      path: "/bids/me/active-auctions",
      handler: "bid.activeAuctions",
      config: { policies: [], middlewares: [] },
    },
    {
      method: "POST",
      path: "/bids/place",
      handler: "bid.place",
      config: { policies: [], middlewares: [] },
    },
    {
      method: "GET",
      path: "/bids/me",
      handler: "bid.myBids",
      config: { policies: [], middlewares: [] },
    },
  ],
};
