'use client';
// lib/hooks/useSocket.jsx
//
// Dual-namespace real-time bidding hook: connects to /main-sockets (browser)
// or /device-sockets (RN WebView), and falls back to lightweight polling on
// cellular drops, per the "Dynamic Polling Fallback" spec.

import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { SOCKET_NAMESPACES, SOCKET_EVENTS, GLOBAL_DEFAULTS } from '@/Constants';

const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3015';

export function useSocket(auctionItemId, {
  isReactNativeWebView = false,
  userId = null,
  userType = null,
  pollIntervalMs = null,
} = {}) {
  const [livePrice, setLivePrice] = useState(null);
  const [auctionStatus, setAuctionStatus] = useState(null);
  const [auctionEndTime, setAuctionEndTime] = useState(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);

  const socketRef = useRef(null);
  const pollingRef = useRef(null);
  const activePollInterval = pollIntervalMs || GLOBAL_DEFAULTS.FALLBACK_POLL_INTERVAL_MS;

  const startPolling = useCallback(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/auction-items/${auctionItemId}/lightweight-status`
        );
        const data = await res.json();
        setLivePrice(data.actCurrentHighestPriceUsd);
        setAuctionStatus(data.actAuctionStatus);
        setAuctionEndTime(data.actListingTimeEnd);
      } catch (err) {
        console.error('Fallback polling error:', err);
      }
    }, activePollInterval);
  }, [auctionItemId, activePollInterval]);

  useEffect(() => {
    if (!auctionItemId) return undefined;

    const namespace = isReactNativeWebView ? SOCKET_NAMESPACES.NATIVE_DEVICE : SOCKET_NAMESPACES.MAIN_WEB;

    socketRef.current = io(`${SOCKET_SERVER_URL}${namespace}`, {
      query: {
        auctionItemId,
        ...(userId ? { userId, userType: userType || 'bidder' } : {}),
      },
      transports: ['websocket', 'polling'],
    });

    socketRef.current.on(SOCKET_EVENTS.BID_PLACED, (data) => {
      if (String(data.auctionItemId) !== String(auctionItemId)) return;
      setLivePrice(data.bidAmountUsd);
      setIsUsingFallback(false);
      setLastEvent({ type: SOCKET_EVENTS.BID_PLACED, data });
      if (pollingRef.current) clearInterval(pollingRef.current);
    });

    socketRef.current.on(SOCKET_EVENTS.AUCTION_EXTENDED, (data) => {
      if (String(data.auctionItemId) !== String(auctionItemId)) return;
      setAuctionEndTime(data.newEndTime);
      setLastEvent({ type: SOCKET_EVENTS.AUCTION_EXTENDED, data });
    });

    socketRef.current.on(SOCKET_EVENTS.AUCTION_CLOSED, (data) => {
      if (String(data.auctionItemId) !== String(auctionItemId)) return;
      setAuctionStatus(data.winnerId ? 'payment_pending' : 'delisted_no_bids');
      setLastEvent({ type: SOCKET_EVENTS.AUCTION_CLOSED, data });
    });

    socketRef.current.on(SOCKET_EVENTS.BID_FORFEITED, (data) => {
      if (String(data.auctionItemId) !== String(auctionItemId)) return;
      setLastEvent({ type: SOCKET_EVENTS.BID_FORFEITED, data });
    });

    socketRef.current.on('connect_error', () => {
      setIsUsingFallback(true);
      startPolling();
    });

    return () => {
      socketRef.current?.disconnect();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [auctionItemId, isReactNativeWebView, userId, userType, startPolling]);

  return { livePrice, auctionStatus, auctionEndTime, isUsingFallback, lastEvent };
}
