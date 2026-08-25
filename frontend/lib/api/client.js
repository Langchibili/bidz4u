// lib/api/client.js
//
// Fetch wrapper with explicit token get/set/clear methods (apiClient.setToken
// etc.), plus a `uidType` convention threaded through every method so entity
// identifiers resolve consistently.
//
// WHY THIS EXISTS: Strapi v5's single-record REST routes (GET/PUT/DELETE
// /api/<collection>/:id) resolve by `documentId`, not the old auto-increment
// numeric `id` — even though every returned object still carries both fields.
// Passing a numeric id like `3` on a :id route now 404s. `uidType` defaults
// to 'documentId' everywhere in this app; pass 'id' explicitly only for
// code paths that are confirmed to need the numeric id (see the callout in
// bid.place below — that one is a backend inconsistency, not a frontend choice).

import { STORAGE_KEYS } from '@/Constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1343/api';
const DEFAULT_UID_TYPE = 'documentId';

let inMemoryToken = null;

function getToken() {
  const raw = inMemoryToken ?? (typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) : null);
  // Defensive: a previously-corrupted localStorage entry reads back as the
  // literal string "[object Object]" (or "undefined"/"null") rather than a
  // real JWT — treat those as "no token" instead of sending garbage as a
  // Bearer header, and clear the bad entry so it doesn't keep tripping this.
  if (raw === '[object Object]' || raw === 'undefined' || raw === 'null') {
    clearToken();
    return null;
  }
  return raw || null;
}

function setToken(token) {
  // A JWT is always a plain string ("header.payload.signature"). If
  // something other than a string reaches here, `localStorage.setItem`
  // would silently coerce it via String(token) — which is exactly how you
  // get "[object Object]" stored as the token. Fail loudly instead, and try
  // to salvage a nested string (some backends accidentally wrap it as
  // `{ jwt: '...' }` or `{ token: '...' }`) before giving up.
  let resolved = token;
  if (resolved && typeof resolved === 'object') {
    resolved = resolved.jwt || resolved.token || resolved.accessToken || null;
    console.error(
      'apiClient.setToken() received a non-string token — this is almost ' +
        'certainly a backend bug (the /auth-otp/verify response\'s `jwt` ' +
        'field should be a plain signed string, e.g. from a synchronous ' +
        '`jwt.issue()` call). Received:',
      token
    );
  }

  if (typeof resolved !== 'string' || !resolved) {
    console.error('apiClient.setToken() could not resolve a usable token from:', token);
    return; // refuse to store garbage rather than corrupting localStorage
  }

  inMemoryToken = resolved;
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, resolved);
  }
}

function clearToken() {
  inMemoryToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }
}

/**
 * Resolves the identifier to use for a given entity.
 *
 *   resolveId(item)                     → item.documentId (falls back to item.id)
 *   resolveId(item, 'id')               → item.id
 *   resolveId('some-raw-id-string')     → returned unchanged (already resolved)
 *   resolveId(null | undefined)         → null
 *
 * Every place in this app that builds a URL path or a relation reference
 * from an entity object should go through this instead of reading `.id`
 * directly, so a single default (documentId) governs the whole app.
 */
function resolveId(entityOrId, uidType = DEFAULT_UID_TYPE) {
  if (entityOrId === null || entityOrId === undefined) return null;
  if (typeof entityOrId === 'object') {
    return entityOrId[uidType] ?? entityOrId.documentId ?? entityOrId.id ?? null;
  }
  return entityOrId;
}

async function request(method, path, body, uidType = DEFAULT_UID_TYPE) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }

  if (!res.ok) {
    const message =
      json?.error?.message || json?.message || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.payload = json;
    err.uidType = uidType; // surfaces in error logs which id convention was used
    throw err;
  }

  return json;
}

export const apiClient = {
  // Every method's last parameter is `uidType`, defaulting to 'documentId'.
  // It doesn't rewrite `path` for you (you still build the path string) —
  // it's there so call sites can pass it through to `resolveId()` and to
  // apiClient's own error objects for consistent debugging, per the
  // convention below. Use `apiClient.resolveId(entity, uidType)` when
  // building the path itself, e.g.:
  //   apiClient.get(`/auction-items/${apiClient.resolveId(item)}`)
  get: (path, uidType = DEFAULT_UID_TYPE) => request('GET', path, undefined, uidType),
  post: (path, body, uidType = DEFAULT_UID_TYPE) => request('POST', path, body, uidType),
  put: (path, body, uidType = DEFAULT_UID_TYPE) => request('PUT', path, body, uidType),
  delete: (path, uidType = DEFAULT_UID_TYPE) => request('DELETE', path, undefined, uidType),
  resolveId,
  getToken,
  setToken,
  clearToken,
};