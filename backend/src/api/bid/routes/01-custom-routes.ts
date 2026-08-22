export default {
  routes: [
    {
      method: "POST",
      path: "/bids/place",
      handler: "bid.place",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/bids/me",
      handler: "bid.myBids",
      config: { auth: {} },
    },
  ],
};
