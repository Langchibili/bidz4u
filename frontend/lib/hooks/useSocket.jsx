
// import { useEffect, useRef, useState } from 'react';
// import { io } from 'socket.io-client';
// import { SOCKET_NAMESPACES, SOCKET_EVENTS, GLOBAL_DEFAULTS } from '@/Constants';

// const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3015';

// // ── Module-level singleton state ────────────────────────────────────────
// let socket = null;
// let socketNamespace = null;
// let socketConnected = false;
// let currentUserId = null;

// // auctionItemId (string) -> { livePrice, liveCurrencyCode, auctionStatus, auctionEndTime, lastEvent }
// const auctionState = new Map();
// // auctionItemId (string) -> Set<listenerFn>
// const auctionListeners = new Map();
// // auctionItemId (string) -> number of active hook subscribers (room ref-count)
// const auctionRoomRefCount = new Map();
// // Set<listenerFn(connected: boolean)>
// const connectionListeners = new Set();

// function notifyAuction(auctionItemId) {
//   const listeners = auctionListeners.get(String(auctionItemId));
//   if (!listeners || listeners.size === 0) return;
//   const state = auctionState.get(String(auctionItemId)) || {};
//   listeners.forEach((fn) => fn(state));
// }

// function notifyConnection(connected) {
//   connectionListeners.forEach((fn) => fn(connected));
// }

// function updateAuctionState(auctionItemId, patch, eventType) {
//   const key = String(auctionItemId);
//   const prev = auctionState.get(key) || {};
//   const next = {
//     ...prev,
//     ...patch,
//     lastEvent: eventType ? { type: eventType, data: patch } : prev.lastEvent,
//   };
//   auctionState.set(key, next);
//   notifyAuction(key);
// }

// // Creates the shared socket if one doesn't already exist for this
// // namespace/user identity. Reused by every subscriber — this is what makes
// // it "one connection for the whole app" rather than one per component.
// //
// // NOTE: if the signed-in user identity changes after the socket already
// // exists (e.g. the home feed connects anonymously, then the user logs in
// // and opens a detail page that passes a userId), the socket is torn down
// // and reconnected under the new identity. This is a deliberate, rare-case
// // tradeoff — a brief reconnect blip — in exchange for never sending a
// // stale/wrong userId in the handshake. Every currently-watched auction room
// // is automatically rejoined on the resulting 'connect' event, so no
// // subscriber loses live updates because of it.
// function ensureSocket({ isReactNativeWebView, userId, userType }) {
//   const namespace = isReactNativeWebView ? SOCKET_NAMESPACES.NATIVE_DEVICE : SOCKET_NAMESPACES.MAIN_WEB;
//   const normalizedUserId = userId || null;

//   if (socket && (socketNamespace !== namespace || currentUserId !== normalizedUserId)) {
//     socket.disconnect();
//     socket = null;
//   }

//   if (socket) return socket;

//   socketNamespace = namespace;
//   currentUserId = normalizedUserId;

//   socket = io(`${SOCKET_SERVER_URL}${namespace}`, {
//     query: {
//       ...(normalizedUserId ? { userId: normalizedUserId, userType: userType || 'bidder' } : {}),
//     },
//     transports: ['websocket', 'polling'],
//   });

//   socket.on('connect', () => {
//     socketConnected = true;
//     notifyConnection(true);
//     // Room membership doesn't survive a disconnect/reconnect — rejoin every
//     // auction room any currently-mounted hook instance still cares about.
//     for (const auctionItemId of auctionRoomRefCount.keys()) {
//       socket.emit('auction:watch', { auctionItemId });
//     }
//   });

//   socket.on('disconnect', () => {
//     socketConnected = false;
//     notifyConnection(false);
//   });

//   socket.on('connect_error', () => {
//     socketConnected = false;
//     notifyConnection(false);
//   });

//   socket.on(SOCKET_EVENTS.BID_PLACED, (data) => {
//     if (!data?.auctionItemId) return;
//     updateAuctionState(data.auctionItemId, {
//       livePrice: data.bidAmountNative,
//       liveCurrencyCode: data.bidNativeCurrencyCode,
//     }, SOCKET_EVENTS.BID_PLACED);
//   });

//   socket.on(SOCKET_EVENTS.AUCTION_EXTENDED, (data) => {
//     if (!data?.auctionItemId) return;
//     updateAuctionState(data.auctionItemId, { auctionEndTime: data.newEndTime }, SOCKET_EVENTS.AUCTION_EXTENDED);
//   });

//   socket.on(SOCKET_EVENTS.AUCTION_CLOSED, (data) => {
//     if (!data?.auctionItemId) return;
//     updateAuctionState(data.auctionItemId, {
//       auctionStatus: data.winnerId ? 'payment_pending' : 'delisted_no_bids',
//     }, SOCKET_EVENTS.AUCTION_CLOSED);
//   });

//   socket.on(SOCKET_EVENTS.BID_FORFEITED, (data) => {
//     if (!data?.auctionItemId) return;
//     updateAuctionState(data.auctionItemId, {}, SOCKET_EVENTS.BID_FORFEITED);
//   });

//   return socket;
// }

// function watchAuction(auctionItemId) {
//   const key = String(auctionItemId);
//   const count = (auctionRoomRefCount.get(key) || 0) + 1;
//   auctionRoomRefCount.set(key, count);
//   if (count === 1 && socket && socketConnected) {
//     socket.emit('auction:watch', { auctionItemId });
//   }
// }

// function unwatchAuction(auctionItemId) {
//   const key = String(auctionItemId);
//   const count = (auctionRoomRefCount.get(key) || 0) - 1;
//   if (count <= 0) {
//     auctionRoomRefCount.delete(key);
//     if (socket && socketConnected) {
//       socket.emit('auction:unwatch', { auctionItemId });
//     }
//   } else {
//     auctionRoomRefCount.set(key, count);
//   }
// }

// /**
//  * Subscribe to live updates for one auction item. Safe to call from many
//  * components at once (feed cards + a detail page, several feed cards, etc.)
//  * — they all share the one underlying connection.
//  */
// export function useSocket(auctionItemId, {
//   isReactNativeWebView = false,
//   userId = null,
//   userType = null,
//   pollIntervalMs = null,
// } = {}) {
//   const [state, setState] = useState(() => auctionState.get(String(auctionItemId)) || {});
//   const [isConnected, setIsConnected] = useState(socketConnected);
//   const pollingRef = useRef(null);
//   const activePollInterval = pollIntervalMs || GLOBAL_DEFAULTS.FALLBACK_POLL_INTERVAL_MS;

//   // Connect (or reuse) the shared socket and subscribe to this auction's
//   // room + state updates.
//   useEffect(() => {
//     if (!auctionItemId) return undefined;

//     ensureSocket({ isReactNativeWebView, userId, userType });
//     watchAuction(auctionItemId);

//     const key = String(auctionItemId);
//     const listener = (nextState) => setState(nextState);
//     if (!auctionListeners.has(key)) auctionListeners.set(key, new Set());
//     auctionListeners.get(key).add(listener);
//     // Pick up any state that arrived between initial useState() and this
//     // effect running.
//     setState(auctionState.get(key) || {});

//     const connListener = (connected) => setIsConnected(connected);
//     connectionListeners.add(connListener);
//     setIsConnected(socketConnected);

//     return () => {
//       auctionListeners.get(key)?.delete(listener);
//       connectionListeners.delete(connListener);
//       unwatchAuction(auctionItemId);
//     };
//   }, [auctionItemId, isReactNativeWebView, userId, userType]);

//   // Fallback polling — only while the shared socket is disconnected, and
//   // only for auctions actually being watched right now.
//   useEffect(() => {
//     if (!auctionItemId) return undefined;
//     if (isConnected) {
//       if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
//       return undefined;
//     }
//     pollingRef.current = setInterval(async () => {
//       try {
//         const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auction-items/${auctionItemId}/lightweight-status`);
//         const data = await res.json();
//         updateAuctionState(auctionItemId, {
//           livePrice: data.actCurrentHighestPriceNative,
//           liveCurrencyCode: data.actNativeCurrencyCode,
//           auctionStatus: data.actAuctionStatus,
//           auctionEndTime: data.actListingTimeEnd,
//         });
//       } catch (err) {
//         console.error('Fallback polling error:', err);
//       }
//     }, activePollInterval);
//     return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
//   }, [auctionItemId, isConnected, activePollInterval]);

//   return {
//     livePrice: state.livePrice ?? null,
//     liveCurrencyCode: state.liveCurrencyCode ?? null,
//     auctionStatus: state.auctionStatus ?? null,
//     auctionEndTime: state.auctionEndTime ?? null,
//     isUsingFallback: !isConnected,
//     lastEvent: state.lastEvent ?? null,
//   };
// }

// // ── Shared display-computation helpers ──────────────────────────────────
// // Both the feed cards and the detail page need to answer the same question
// // — "given the item as originally fetched, plus whatever live/polled data
// // useSocket() has, what price/currency/status do we actually show?" — and
// // need to answer it IDENTICALLY. Centralizing that logic here means fixing
// // or changing that rule (e.g. adjusting the fallback chain) is a one-file
// // change that both surfaces pick up automatically, instead of two call
// // sites quietly drifting apart.

// /**
//  * Resolves the price + currency to display for an auction, preferring live
//  * socket/poll data over the current highest bid over the starting price.
//  */
// export function getDisplayedAuctionPrice(item, live) {
//   const hasLivePrice = Number(live?.livePrice) > 0;
//   const hasCurrentHighest = Number(item?.actCurrentHighestPriceNative) > 0;

//   const displayedPrice = hasLivePrice
//     ? live.livePrice
//     : hasCurrentHighest
//       ? item.actCurrentHighestPriceNative
//       : item?.actStartingPriceNative ?? 0;

//   const displayedCurrencyCode = live?.liveCurrencyCode || item?.actNativeCurrencyCode || '';

//   return { displayedPrice, displayedCurrencyCode };
// }

// /** Resolves the auction status to display, preferring live socket/poll data. */
// export function getDisplayedAuctionStatus(item, live) {
//   return live?.auctionStatus || item?.actAuctionStatus;
// }
'use client';
// lib/hooks/useSocket.jsx
//
// SINGLE SOURCE OF TRUTH for all real-time auction-listing data. Every page
// that shows a live auction price/status (the home feed's AuctionCard, the
// auction detail page, anything added later) goes through THIS file only —
// don't duplicate socket-connection, price-display, or currency-conversion
// logic elsewhere. That's the whole point of consolidating it here: one
// place to fix, one place to extend.
//
// ── Why this is a singleton, not "one socket per component" ────────────────
// The old version of this hook opened a brand-new socket.io connection every
// time a component called useSocket(). That's fine for a single detail page,
// but it's why the home feed never got live updates: AuctionCard didn't call
// useSocket() at all, and if it had, a feed of 20 cards would've opened 20
// separate socket connections — wasteful, and fragile (20 independent
// reconnect/backoff cycles instead of one).
//
// Instead, this module keeps ONE shared socket connection at module scope
// (same pattern as lib/api/client.js's in-memory token). Every component
// that wants live data for a given auction just registers interest in that
// auction's room via `useSocket(auctionItemId, opts)`; the module tracks a
// ref-count per auction id and joins/leaves that room (via the server's
// `auction:watch` / `auction:unwatch` events — see sockets/index.js) as
// subscribers come and go. A `bid:placed` event for auction 17 updates a
// shared state map, and every hook instance subscribed to 17 — whether
// that's an AuctionCard in the feed or the detail page — re-renders with the
// new price. Multiple auctions can be watched over the same one connection.
//
// ── Fallback polling ─────────────────────────────────────────────────────
// The shared socket's connection status is itself reactive (subscribers get
// notified on connect/disconnect). Per-auction polling only runs for a given
// auction while the socket is disconnected, and stops the instant it
// reconnects — so you always get sockets when they're up, and reliable
// per-item polling as a fallback when they're not, never both fighting each
// other.
//
// ── Viewer-currency conversion ───────────────────────────────────────────
// A listing's price is stored/emitted in its own "native" currency
// (actNativeCurrencyCode), which may differ from the viewer's own currency.
// useViewerCurrencyRate() below fetches the exchange RATE for a given
// (native, viewer) currency pair from the backend's currency-conversion
// controller (POST /currencies/convert-price — see
// api/currency/controllers/currency.ts) and caches it client-side. Prices
// change far more often than exchange rates do (every bid vs. hourly), so
// this caches the rate once per pair rather than re-converting the full
// amount on every price tick — callers just multiply nativePrice * rate.
//
// uidType NOTE: `auctionItemId` here must be the NUMERIC id, not documentId
// — the sockets service rooms are `auction:${numericId}` (bid.place emits
// with `auctionItem.id`), and the lightweight-status polling fallback hits a
// controller that does a raw `db.query(...).findOne({ where: { id } })`.
// Callers should pass `apiClient.resolveId(item, 'id')`.

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_NAMESPACES, SOCKET_EVENTS, GLOBAL_DEFAULTS } from '@/Constants';
import { apiClient } from '@/lib/api/client';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3015';

// ── Module-level singleton state ────────────────────────────────────────
let socket = null;
let socketNamespace = null;
let socketConnected = false;
let currentUserId = null;

// auctionItemId (string) -> { livePrice, liveCurrencyCode, auctionStatus, auctionEndTime, lastEvent }
const auctionState = new Map();
// auctionItemId (string) -> Set<listenerFn>
const auctionListeners = new Map();
// auctionItemId (string) -> number of active hook subscribers (room ref-count)
const auctionRoomRefCount = new Map();
// Set<listenerFn(connected: boolean)>
const connectionListeners = new Set();

function notifyAuction(auctionItemId) {
  const listeners = auctionListeners.get(String(auctionItemId));
  if (!listeners || listeners.size === 0) return;
  const state = auctionState.get(String(auctionItemId)) || {};
  listeners.forEach((fn) => fn(state));
}

function notifyConnection(connected) {
  connectionListeners.forEach((fn) => fn(connected));
}

function updateAuctionState(auctionItemId, patch, eventType) {
  const key = String(auctionItemId);
  const prev = auctionState.get(key) || {};
  const next = {
    ...prev,
    ...patch,
    lastEvent: eventType ? { type: eventType, data: patch } : prev.lastEvent,
  };
  auctionState.set(key, next);
  notifyAuction(key);
}

// Creates the shared socket if one doesn't already exist for this
// namespace/user identity. Reused by every subscriber — this is what makes
// it "one connection for the whole app" rather than one per component.
//
// NOTE: if the signed-in user identity changes after the socket already
// exists (e.g. the home feed connects anonymously, then the user logs in
// and opens a detail page that passes a userId), the socket is torn down
// and reconnected under the new identity. This is a deliberate, rare-case
// tradeoff — a brief reconnect blip — in exchange for never sending a
// stale/wrong userId in the handshake. Every currently-watched auction room
// is automatically rejoined on the resulting 'connect' event, so no
// subscriber loses live updates because of it.
function ensureSocket({ isReactNativeWebView, userId, userType }) {
  const namespace = isReactNativeWebView ? SOCKET_NAMESPACES.NATIVE_DEVICE : SOCKET_NAMESPACES.MAIN_WEB;
  const normalizedUserId = userId || null;

  if (socket && (socketNamespace !== namespace || currentUserId !== normalizedUserId)) {
    socket.disconnect();
    socket = null;
  }

  if (socket) return socket;

  socketNamespace = namespace;
  currentUserId = normalizedUserId;

  socket = io(`${SOCKET_SERVER_URL}${namespace}`, {
    query: {
      ...(normalizedUserId ? { userId: normalizedUserId, userType: userType || 'bidder' } : {}),
    },
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    socketConnected = true;
    notifyConnection(true);
    // Room membership doesn't survive a disconnect/reconnect — rejoin every
    // auction room any currently-mounted hook instance still cares about.
    for (const auctionItemId of auctionRoomRefCount.keys()) {
      socket.emit('auction:watch', { auctionItemId });
    }
  });

  socket.on('disconnect', () => {
    socketConnected = false;
    notifyConnection(false);
  });

  socket.on('connect_error', () => {
    socketConnected = false;
    notifyConnection(false);
  });

  socket.on(SOCKET_EVENTS.BID_PLACED, (data) => {
    if (!data?.auctionItemId) return;
    updateAuctionState(data.auctionItemId, {
      livePrice: data.bidAmountNative,
      liveCurrencyCode: data.bidNativeCurrencyCode,
    }, SOCKET_EVENTS.BID_PLACED);
  });

  socket.on(SOCKET_EVENTS.AUCTION_EXTENDED, (data) => {
    if (!data?.auctionItemId) return;
    updateAuctionState(data.auctionItemId, { auctionEndTime: data.newEndTime }, SOCKET_EVENTS.AUCTION_EXTENDED);
  });

  socket.on(SOCKET_EVENTS.AUCTION_CLOSED, (data) => {
    if (!data?.auctionItemId) return;
    updateAuctionState(data.auctionItemId, {
      auctionStatus: data.winnerId ? 'payment_pending' : 'delisted_no_bids',
    }, SOCKET_EVENTS.AUCTION_CLOSED);
  });

  socket.on(SOCKET_EVENTS.BID_FORFEITED, (data) => {
    if (!data?.auctionItemId) return;
    updateAuctionState(data.auctionItemId, {}, SOCKET_EVENTS.BID_FORFEITED);
  });

  return socket;
}

function watchAuction(auctionItemId) {
  const key = String(auctionItemId);
  const count = (auctionRoomRefCount.get(key) || 0) + 1;
  auctionRoomRefCount.set(key, count);
  if (count === 1 && socket && socketConnected) {
    socket.emit('auction:watch', { auctionItemId });
  }
}

function unwatchAuction(auctionItemId) {
  const key = String(auctionItemId);
  const count = (auctionRoomRefCount.get(key) || 0) - 1;
  if (count <= 0) {
    auctionRoomRefCount.delete(key);
    if (socket && socketConnected) {
      socket.emit('auction:unwatch', { auctionItemId });
    }
  } else {
    auctionRoomRefCount.set(key, count);
  }
}

/**
 * Subscribe to live updates for one auction item. Safe to call from many
 * components at once (feed cards + a detail page, several feed cards, etc.)
 * — they all share the one underlying connection.
 */
export function useSocket(auctionItemId, {
  isReactNativeWebView = false,
  userId = null,
  userType = null,
  pollIntervalMs = null,
} = {}) {
  const [state, setState] = useState(() => auctionState.get(String(auctionItemId)) || {});
  const [isConnected, setIsConnected] = useState(socketConnected);
  const pollingRef = useRef(null);
  const activePollInterval = pollIntervalMs || GLOBAL_DEFAULTS.FALLBACK_POLL_INTERVAL_MS;

  // Connect (or reuse) the shared socket and subscribe to this auction's
  // room + state updates.
  useEffect(() => {
    if (!auctionItemId) return undefined;

    ensureSocket({ isReactNativeWebView, userId, userType });
    watchAuction(auctionItemId);

    const key = String(auctionItemId);
    const listener = (nextState) => setState(nextState);
    if (!auctionListeners.has(key)) auctionListeners.set(key, new Set());
    auctionListeners.get(key).add(listener);
    // Pick up any state that arrived between initial useState() and this
    // effect running.
    setState(auctionState.get(key) || {});

    const connListener = (connected) => setIsConnected(connected);
    connectionListeners.add(connListener);
    setIsConnected(socketConnected);

    return () => {
      auctionListeners.get(key)?.delete(listener);
      connectionListeners.delete(connListener);
      unwatchAuction(auctionItemId);
    };
  }, [auctionItemId, isReactNativeWebView, userId, userType]);

  // Fallback polling — only while the shared socket is disconnected, and
  // only for auctions actually being watched right now.
  useEffect(() => {
    if (!auctionItemId) return undefined;
    if (isConnected) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return undefined;
    }
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auction-items/${auctionItemId}/lightweight-status`);
        const data = await res.json();
        updateAuctionState(auctionItemId, {
          livePrice: data.actCurrentHighestPriceNative,
          liveCurrencyCode: data.actNativeCurrencyCode,
          auctionStatus: data.actAuctionStatus,
          auctionEndTime: data.actListingTimeEnd,
        });
      } catch (err) {
        console.error('Fallback polling error:', err);
      }
    }, activePollInterval);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [auctionItemId, isConnected, activePollInterval]);

  return {
    livePrice: state.livePrice ?? null,
    liveCurrencyCode: state.liveCurrencyCode ?? null,
    auctionStatus: state.auctionStatus ?? null,
    auctionEndTime: state.auctionEndTime ?? null,
    isUsingFallback: !isConnected,
    lastEvent: state.lastEvent ?? null,
  };
}

// ── Shared display-computation helpers ──────────────────────────────────
// Both the feed cards and the detail page need to answer the same question
// — "given the item as originally fetched, plus whatever live/polled data
// useSocket() has, what price/currency/status do we actually show?" — and
// need to answer it IDENTICALLY. Centralizing that logic here means fixing
// or changing that rule (e.g. adjusting the fallback chain) is a one-file
// change that both surfaces pick up automatically, instead of two call
// sites quietly drifting apart.

/**
 * Resolves the price + currency to display for an auction, preferring live
 * socket/poll data over the current highest bid over the starting price.
 * This is the item's NATIVE currency — see useViewerCurrencyRate() below to
 * convert it into the viewer's own currency for display.
 */
export function getDisplayedAuctionPrice(item, live) {
  const hasLivePrice = Number(live?.livePrice) > 0;
  const hasCurrentHighest = Number(item?.actCurrentHighestPriceNative) > 0;

  const displayedPrice = hasLivePrice
    ? live.livePrice
    : hasCurrentHighest
      ? item.actCurrentHighestPriceNative
      : item?.actStartingPriceNative ?? 0;

  const displayedCurrencyCode = live?.liveCurrencyCode || item?.actNativeCurrencyCode || '';

  return { displayedPrice, displayedCurrencyCode };
}

/** Resolves the auction status to display, preferring live socket/poll data. */
export function getDisplayedAuctionStatus(item, live) {
  return live?.auctionStatus || item?.actAuctionStatus;
}

// ── Viewer-currency conversion ──────────────────────────────────────────
const RATE_CACHE_TTL_MS = 60 * 60 * 1000; // 1hr — mirrors the server-side cache in services/currencyConversion.ts
const rateCache = new Map(); // `${from}_${to}` -> { rate, expiresAt }
const inFlightRateFetches = new Map(); // `${from}_${to}` -> Promise<number|null>

// Fetches (and caches) the exchange rate for converting fromCode -> toCode,
// via the backend's POST /currencies/convert-price action (amount: 1, so
// the returned amount IS the rate). Concurrent callers for the same pair
// share one in-flight request rather than firing duplicates — this matters
// because many feed cards can all want the same currency pair's rate at
// once.
async function fetchConversionRate(fromCode, toCode) {
  if (!fromCode || !toCode || fromCode === toCode) return 1;
  const key = `${fromCode}_${toCode}`;

  const cached = rateCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.rate;

  if (inFlightRateFetches.has(key)) return inFlightRateFetches.get(key);

  const fetchPromise = (async () => {
    try {
      const res = await apiClient.post('/currencies/convert-price', {
        amount: 1,
        fromCurrencyCode: fromCode,
        toCurrencyCode: toCode,
      });
      const payload = res?.data || res;
      const rate = Number(payload?.amount);
      if (!Number.isFinite(rate)) throw new Error('Invalid rate in response');
      rateCache.set(key, { rate, expiresAt: Date.now() + RATE_CACHE_TTL_MS });
      return rate;
    } catch (err) {
      console.error(`Failed to fetch conversion rate ${fromCode}->${toCode}:`, err.message);
      return null; // caller falls back to a 1:1 rate (native price shown) rather than blocking render
    } finally {
      inFlightRateFetches.delete(key);
    }
  })();

  inFlightRateFetches.set(key, fetchPromise);
  return fetchPromise;
}

/**
 * Returns { rate, isReady } for converting a nativeCurrencyCode-denominated
 * price into viewerCurrencyCode.
 *
 * `rate` defaults to 1 before a real rate is known — but `isReady` is what
 * callers should actually gate rendering on. Without that, a component that
 * just does `nativePrice * rate` renders the NATIVE amount (rate still 1)
 * labeled with the VIEWER's currency symbol for one render before the real
 * rate arrives — a wrong number that looks plausible, not an obviously
 * missing one. `isReady` is true immediately when the two currencies match
 * or either is unknown (nothing to wait for), and only goes true after a
 * real conversion attempt has settled (success OR failure) otherwise.
 */
export function useViewerCurrencyRate(nativeCurrencyCode, viewerCurrencyCode) {
  const [state, setState] = useState(() => {
    const noConversionNeeded = !nativeCurrencyCode || !viewerCurrencyCode || nativeCurrencyCode === viewerCurrencyCode;
    return { rate: 1, isReady: noConversionNeeded };
  });

  useEffect(() => {
    if (!nativeCurrencyCode || !viewerCurrencyCode || nativeCurrencyCode === viewerCurrencyCode) {
      setState({ rate: 1, isReady: true });
      return undefined;
    }
    let cancelled = false;
    setState({ rate: 1, isReady: false });
    fetchConversionRate(nativeCurrencyCode, viewerCurrencyCode).then((r) => {
      if (cancelled) return;
      // Settle either way — a failed fetch (fetchConversionRate resolves
      // null on error) still means "we're done trying", not "keep showing
      // loading forever"; fall back to a 1:1 rate rather than blocking the
      // UI indefinitely.
      setState({ rate: r != null ? r : 1, isReady: true });
    });
    return () => { cancelled = true; };
  }, [nativeCurrencyCode, viewerCurrencyCode]);

  return state;
}