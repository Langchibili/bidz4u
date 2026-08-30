// lib/api/uploads.js
//
// Mirrors the gigs-app upload pattern: POST /upload with the file plus
// optional `ref`/`refId`/`field` so Strapi's upload plugin auto-attaches the
// uploaded media directly onto an existing entry's field — no separate PUT
// needed to wire the relation up afterwards.
//
// refId NOTE: Strapi's upload-plugin ref/refId linking operates at the
// low-level Query Engine, same class of thing as the other raw
// `db.query(...).findOne({ where: { id } })` controllers audited in
// UIDTYPE_AUDIT.md — so `refId` must be the entry's NUMERIC id, not
// documentId. This is consistent with the existing convention
// (`apiClient.resolveId(entity, 'id')`) but genuinely unverified against
// your exact Strapi version for THIS specific mechanism — if attaching
// fails silently (upload succeeds, but the auction-item's actImages never
// gets the file), that's the first thing to check.

import { apiClient } from './client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1343/api';

/**
 * @param {File} file
 * @param {{ ref: string, refId: number, field: string } | null} refConfig
 * @returns {Promise<Array>} the array of Strapi media objects the upload endpoint returns
 */
export async function uploadFile(file, refConfig = null) {
  const form = new FormData();
  form.append('files', file);
  if (refConfig) {
    form.append('ref', refConfig.ref);
    form.append('refId', String(refConfig.refId));
    form.append('field', refConfig.field);
  }

  const res = await fetch(`${API_URL}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiClient.getToken()}` },
    body: form,
  });

  if (!res.ok) {
    let message = 'Upload failed';
    try {
      const json = await res.json();
      message = json?.error?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}
