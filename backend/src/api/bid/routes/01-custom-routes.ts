export default {
  routes: [
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
