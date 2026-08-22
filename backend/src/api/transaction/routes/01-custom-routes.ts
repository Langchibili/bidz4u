export default {
  routes: [
    {
      method: "GET",
      path: "/transactions/me",
      handler: "transaction.myTransactions",
      config: { auth: {} },
    },
    {
      method: "POST",
      path: "/transactions/deposit",
      handler: "transaction.initiateDeposit",
      config: { auth: {} },
    },
  ],
};
