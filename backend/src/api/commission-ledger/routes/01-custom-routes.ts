export default {
  routes: [
    {
      method: "GET",
      path: "/commission-ledgers/me",
      handler: "commission-ledger.myEarnings",
      config: { auth: {} },
    },
  ],
};
