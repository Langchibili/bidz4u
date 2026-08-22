export default {
  routes: [
    {
      method: "POST",
      path: "/auth-otp/send",
      handler: "otp-verification.send",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth-otp/resend",
      handler: "otp-verification.resend",
      config: { auth: false },
    },
    {
      method: "POST",
      path: "/auth-otp/verify",
      handler: "otp-verification.verify",
      config: { auth: false },
    },
  ],
};
