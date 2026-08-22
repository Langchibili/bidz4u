// lib/api/client.js
//
// Fetch wrapper with explicit token get/set/clear methods, matching the
// apiClient.setToken()/getToken()/clearToken() pattern the reference authAPI
// expects — rather than pulling the token from context on every call.

import { STORAGE_KEYS } from '@/Constants';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:1343/api';

let inMemoryToken = null;

function getToken() {
  if (inMemoryToken) return inMemoryToken;
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
}

function setToken(token) {
  inMemoryToken = token;
  if (typeof window !== 'undefined' && token) {
    localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }
}

function clearToken() {
  inMemoryToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEYS.AUTH_TOKEN);
  }
}

async function request(method, path, body) {
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
    throw err;
  }

  return json;
}

export const apiClient = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  getToken,
  setToken,
  clearToken,
};
