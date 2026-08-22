export default {
  routes: [
    {
      method: "GET",
      path: "/countries/:id/effective-settings",
      handler: "country.effectiveSettings",
      config: { auth: false },
    },
  ],
};
