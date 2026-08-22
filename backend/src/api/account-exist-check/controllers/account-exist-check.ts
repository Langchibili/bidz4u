// backend/src/api/account-exist-check/controllers/account-exist-check.ts

interface CheckUserRequestBody {
  username?: string;
}

interface CheckUserResponse {
  userExists: boolean;
}

interface CheckUserContext {
  request: {
    body: CheckUserRequestBody;
  };
  badRequest(message: string): unknown;
  body: CheckUserResponse;
}

export default {
  async checkUser(ctx: CheckUserContext): Promise<unknown> {
    const { username } = ctx.request.body;
    if (!username) return ctx.badRequest('username is required');

    const user = await strapi.db.query('plugin::users-permissions.user').findOne({ where: { username } });
    ctx.body = { userExists: !!user };
  },
};