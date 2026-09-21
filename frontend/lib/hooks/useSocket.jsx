// 'use client';
// // lib/hooks/useSocket.jsx
// //
// // Dual-namespace real-time bidding hook: connects to /main-sockets (browser)
// // or /device-sockets (RN WebView), and falls back to lightweight polling on
// // cellular drops, per the "Dynamic Polling Fallback" spec.
// //
// // uidType NOTE: `auctionItemId` here must be the NUMERIC id, not documentId.
// // The sockets service rooms are `auction:${numericId}` (bid.place emits with
// // `auctionItem.id`), and the lightweight-status polling fallback below hits
// // a controller that does a raw `db.query(...).findOne({ where: { id } })`.
// // Callers should pass `apiClient.resolveId(item, 'id')` — see
// // UIDTYPE_AUDIT.md for the full breakdown of which endpoints need which id.
// //
// // CURRENCY NOTE (fixed): auction-item and bid moved from flat USD amounts to
// // a per-item "native currency" model — bid.place now emits `bidAmountNative`
// // / `bidNativeCurrencyCode` (not `bidAmountUsd`), and the lightweight-status
// // fallback now returns `actCurrentHighestPriceNative` /
// // `actNativeCurrencyCode` (not `actCurrentHighestPriceUsd`). This hook was
// // still reading the old field names, so `setLivePrice()` was silently
// // getting `undefined` on every real-time bid — the auction page's `livePrice
// // ?? item.actCurrentHighestPriceNative` fallback then quietly kept showing
// // the stale pre-bid price instead of erroring, which is why it looked like
// // sockets weren't updating at all. Both paths below now read the correct
// // fields and also track the item's currency code, since a live bid's
// // currency should always match the item but this makes the hook self-
// // contained rather than assuming the caller already has it.

// import { useEffect, useRef, useState, useCallback } from 'react';
// import { io } from 'socket.io-client';
// import { SOCKET_NAMESPACES, SOCKET_EVENTS, GLOBAL_DEFAULTS } from '@/Constants';

// const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3015';

// export function useSocket(auctionItemId, {
//   isReactNativeWebView = false,
//   userId = null,
//   userType = null,
//   pollIntervalMs = null,
// } = {}) {
//   const [livePrice, setLivePrice] = useState(null);
//   const [liveCurrencyCode, setLiveCurrencyCode] = useState(null);
//   const [auctionStatus, setAuctionStatus] = useState(null);
//   const [auctionEndTime, setAuctionEndTime] = useState(null);
//   const [isUsingFallback, setIsUsingFallback] = useState(false);
//   const [lastEvent, setLastEvent] = useState(null);

//   const socketRef = useRef(null);
//   const pollingRef = useRef(null);
//   const activePollInterval = pollIntervalMs || GLOBAL_DEFAULTS.FALLBACK_POLL_INTERVAL_MS;

//   const startPolling = useCallback(() => {
//     if (pollingRef.current) clearInterval(pollingRef.current);
//     pollingRef.current = setInterval(async () => {
//       try {
//         const res = await fetch(
//           `${process.env.NEXT_PUBLIC_API_URL}/auction-items/${auctionItemId}/lightweight-status`
//         );
//         const data = await res.json();
//         setLivePrice(data.actCurrentHighestPriceNative);
//         setLiveCurrencyCode(data.actNativeCurrencyCode);
//         setAuctionStatus(data.actAuctionStatus);
//         setAuctionEndTime(data.actListingTimeEnd);
//       } catch (err) {
//         console.error('Fallback polling error:', err);
//       }
//     }, activePollInterval);
//   }, [auctionItemId, activePollInterval]);

//   useEffect(() => {
//     if (!auctionItemId) return undefined;

//     const namespace = isReactNativeWebView ? SOCKET_NAMESPACES.NATIVE_DEVICE : SOCKET_NAMESPACES.MAIN_WEB;

//     socketRef.current = io(`${SOCKET_SERVER_URL}${namespace}`, {
//       query: {
//         auctionItemId,
//         ...(userId ? { userId, userType: userType || 'bidder' } : {}),
//       },
//       transports: ['websocket', 'polling'],
//     });

//     socketRef.current.on(SOCKET_EVENTS.BID_PLACED, (data) => {
//       if (String(data.auctionItemId) !== String(auctionItemId)) return;
//       setLivePrice(data.bidAmountNative);
//       setLiveCurrencyCode(data.bidNativeCurrencyCode);
//       setIsUsingFallback(false);
//       setLastEvent({ type: SOCKET_EVENTS.BID_PLACED, data });
//       if (pollingRef.current) clearInterval(pollingRef.current);
//     });

//     socketRef.current.on(SOCKET_EVENTS.AUCTION_EXTENDED, (data) => {
//       if (String(data.auctionItemId) !== String(auctionItemId)) return;
//       setAuctionEndTime(data.newEndTime);
//       setLastEvent({ type: SOCKET_EVENTS.AUCTION_EXTENDED, data });
//     });

//     socketRef.current.on(SOCKET_EVENTS.AUCTION_CLOSED, (data) => {
//       if (String(data.auctionItemId) !== String(auctionItemId)) return;
//       setAuctionStatus(data.winnerId ? 'payment_pending' : 'delisted_no_bids');
//       setLastEvent({ type: SOCKET_EVENTS.AUCTION_CLOSED, data });
//     });

//     socketRef.current.on(SOCKET_EVENTS.BID_FORFEITED, (data) => {
//       if (String(data.auctionItemId) !== String(auctionItemId)) return;
//       setLastEvent({ type: SOCKET_EVENTS.BID_FORFEITED, data });
//     });

//     socketRef.current.on('connect_error', () => {
//       setIsUsingFallback(true);
//       startPolling();
//     });

//     return () => {
//       socketRef.current?.disconnect();
//       if (pollingRef.current) clearInterval(pollingRef.current);
//     };
//   }, [auctionItemId, isReactNativeWebView, userId, userType, startPolling]);

//   return { livePrice, liveCurrencyCode, auctionStatus, auctionEndTime, isUsingFallback, lastEvent };
// }

'use client';
// lib/hooks/useSocket.jsx
//
// SINGLE SOURCE OF TRUTH for all real-time auction-listing data. Every page
// that shows a live auction price/status (the home feed's AuctionCard, the
// auction detail page, anything added later) goes through THIS file only —
// don't duplicate socket-connection or price-display logic elsewhere. That's
// the whole point of consolidating it here: one place to fix, one place to
// extend.
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
// uidType NOTE: `auctionItemId` here must be the NUMERIC id, not documentId
// — the sockets service rooms are `auction:${numericId}` (bid.place emits
// with `auctionItem.id`), and the lightweight-status polling fallback hits a
// controller that does a raw `db.query(...).findOne({ where: { id } })`.
// Callers should pass `apiClient.resolveId(item, 'id')`.

import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_NAMESPACES, SOCKET_EVENTS, GLOBAL_DEFAULTS } from '@/Constants';

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