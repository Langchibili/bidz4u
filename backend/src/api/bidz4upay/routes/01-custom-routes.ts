export default {
  routes: [
    {
      method: "POST",
      path: "/bidz4upay/initiate",
      handler: "bidz4upay.initiate",
      config: { auth: {} },
    },
    {
      method: "GET",
      path: "/bidz4upay/status/:reference",
      handler: "bidz4upay.getPaymentStatus",
      config: { auth: {} },
    },
    {
      method: "POST",
      path: "/bidz4upay/webhook/:gateway",
      handler: "bidz4upay.webhook",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/bidz4upay/webhook/:gateway/withdraw",
      handler: "bidz4upay.withdrawWebhook",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/bidz4upay/request-withdrawal",
      handler: "bidz4upay.requestWithdrawal",
      config: { auth: {} },
    },
  ],
};
