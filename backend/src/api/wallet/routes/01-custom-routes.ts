export default {
  routes: [
    {
      method: "GET",
      path: "/wallets/me",
      handler: "wallet.myWallet",
      config: { auth: {} },
    },
  ],
};
