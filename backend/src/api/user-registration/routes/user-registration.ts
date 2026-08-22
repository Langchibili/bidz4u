// backend/src/api/user-registration/routes/user-registration.ts

export default {
  routes: [
    {
      method: "POST",
      path: "/user-registration/register",
      handler: "user-registration.register",
      config: { auth: false },
    },
  ],
};
