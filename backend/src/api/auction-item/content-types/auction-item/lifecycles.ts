import { errors } from '@strapi/utils';

const { ApplicationError } = errors;

export default {
  async beforeCreate(event: any) {
    const { data } = event.params;

    // Only guard draft creation — real (non-draft) creates are unaffected.
    if (data?.actIsDraft !== true) return;

    // `seller` may arrive as a raw id or as a relation-connect object,
    // depending on what called strapi.service(...).create() — normalize both.
    const sellerId =
      typeof data.seller === 'object' && data.seller !== null
        ? data.seller.id ?? data.seller.connect?.[0]?.id ?? data.seller.set?.[0]?.id
        : data.seller;

    if (!sellerId) return; // no seller on the payload — nothing to check against

    const latest = await strapi.db.query('api::auction-item.auction-item').findOne({
      where: { seller: sellerId },
      orderBy: { createdAt: 'desc' },
      select: ['id', 'documentId', 'actIsDraft', 'actTitle'],
    });

    if (latest && latest.actIsDraft) {
      throw new ApplicationError(
        `You already have a draft in progress ("${latest.actTitle || 'Untitled'}"). ` +
          `Finish or discard it before starting a new one.`,
        { existingDraftId: latest.documentId, existingDraftNumericId: latest.id }
      );
    }
  },
};