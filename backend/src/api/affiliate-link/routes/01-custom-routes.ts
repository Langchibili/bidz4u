export default {
  routes: [
    {
      method: "POST",
      path: "/affiliate-links/:code/click",
      handler: "affiliate-link.trackClick",
      config: { auth: false },
    },
  ],
};
