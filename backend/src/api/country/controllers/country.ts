import { factories } from '@strapi/strapi';

export default factories.createCoreController('api::country.country', ({ strapi }) => ({
  async effectiveSettings(ctx) {
    try {
      const { id } = ctx.params;
      const { resolveSettingsForCountry } = await import('../../../services/settingsResolver');
      const settings = await resolveSettingsForCountry(strapi, id ? Number(id) : null);
      ctx.send({ success: true, settings });
    } catch (error) {
      console.error('Error resolving effective settings:', error);
      ctx.internalServerError('Failed to resolve settings');
    }
  },
}))