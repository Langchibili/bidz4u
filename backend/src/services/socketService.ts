// backend/src/services/socketService.ts

import { io, Socket } from 'socket.io-client';
 
class SocketService {
  private socket: Socket | null = null;
  private connected = false;
  private readonly URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3015';
 
  connect() {
    if (this.socket?.connected) return;
 
    this.socket = io(`${this.URL}/main-sockets`, {
      autoConnect: true,
      reconnection: true,
      transports: ['websocket', 'polling'],
      query: {
        isStrapiSystem: 'true',
        strapiSecret: process.env.STRAPI_SOCKET_SECRET || '',
      },
    });
 
    this.socket.on('connect', () => {
      this.connected = true;
      console.log('✅ Strapi connected to socket server (/main-sockets, system client)');
    });
    this.socket.on('disconnect', () => { this.connected = false; });
    this.socket.on('connect_error', (e) => console.error('❌ socket server connection error:', e.message));
  }
 
  private emit(event: string, data: any) {
    if (!this.socket || !this.connected) {
      console.warn(`⚠️ Cannot emit '${event}': socket not connected`);
      return false;
    }
    this.socket.emit(event, data);
    return true;
  }
 
  // ── Auction-scoped events (payload must include auctionItemId) ──────────
  emitBidPlaced(auctionItemId: number, data: any) {
    return this.emit('bid:placed', { auctionItemId, ...data });
  }
  emitAuctionExtended(auctionItemId: number, newEndTime: string) {
    return this.emit('auction:extended', { auctionItemId, newEndTime });
  }
  emitAuctionClosed(auctionItemId: number, winnerId: number | null) {
    return this.emit('auction:closed', { auctionItemId, winnerId });
  }
  emitForfeiture(auctionItemId: number, userId: number) {
    return this.emit('bid:forfeited', { auctionItemId, userId });
  }
 
  // ── User-scoped events (payload must include userId) ────────────────────
  emitPaymentSuccess(userId: number, amount: number, reference: string) {
    return this.emit('payment:success', { userId, amount, reference });
  }
  emitPaymentFailed(userId: number, amount: number, reference: string) {
    return this.emit('payment:failed', { userId, amount, reference });
  }
  emitPaymentRequired(userId: number, auctionItemId: number, amount: number, currency: string) {
    return this.emit('payment:required', { userId, auctionItemId, amount, currency });
  }
  emitHapticPulse(userId: number, pattern: 'outbid' | 'final_60s' | 'won') {
    return this.emit('device:haptic', { userId, pattern });
  }
  emitNotification(userId: number, notification: any) {
    return this.emit('notification:new', { userId, ...notification });
  }
 
  // ── Global broadcast (no auctionItemId/userId) ───────────────────────────
  emitAnnouncement(message: string, priority: string = 'normal') {
    return this.emit('admin:announcement', { message, priority });
  }
}
 
const socketService = new SocketService();
export default socketService;


/*
// frontend/hooks/useSocket.jsx
import { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
 
const SOCKET_SERVER_URL = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3015';
 
export const useSocket = (auctionItemId, { isReactNativeWebView = false, userId = null, userType = null, pollIntervalMs = 3000 } = {}) => {
  const [livePrice, setLivePrice] = useState(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const socketRef = useRef(null);
  const pollingRef = useRef(null);
 
  useEffect(() => {
    const namespace = isReactNativeWebView ? '/device-sockets' : '/main-sockets';
 
    socketRef.current = io(`${SOCKET_SERVER_URL}${namespace}`, {
      query: { auctionItemId, userId: userId || undefined, userType: userType || undefined },
      transports: ['websocket'],
    });
 
    socketRef.current.on('bid:placed', (data) => {
      if (String(data.auctionItemId) !== String(auctionItemId)) return;
      setLivePrice(data.bidAmountUsd);
      setIsUsingFallback(false);
      if (pollingRef.current) clearInterval(pollingRef.current);
    });
 
    socketRef.current.on('connect_error', () => {
      setIsUsingFallback(true);
      startPolling();
    });
 
    return () => {
      socketRef.current?.disconnect();
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [auctionItemId, isReactNativeWebView, userId, userType]);
 
  const startPolling = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auction-items/${auctionItemId}/lightweight-status`);
        const data = await res.json();
        setLivePrice(data.actCurrentHighestPriceUsd);
      } catch (err) {
        console.error('Fallback polling error:', err);
      }
    }, pollIntervalMs);
  };
 
  return { livePrice, isUsingFallback };
};
*/
// give me the full and detailed backend flow and ensure to include all frontend hooking pointers and socket flow