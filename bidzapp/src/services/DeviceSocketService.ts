import io, { Socket } from 'socket.io-client';
import { logger } from '../utils/logger';
import NetInfo from '@react-native-community/netinfo';
import { SOCKET_EVENTS } from '../utils/constants';

const S = SOCKET_EVENTS;
type EventHandler = (data: any) => void;

interface DeviceRegistration {
  deviceId: string; userId: string | number; userType: 'owner' | 'employee';
  frontendName: string; notificationToken: string | null; deviceInfo: any; socketServerUrl: string;
}

class DeviceSocketService {
  private socket: Socket | null = null;
  private serverUrl = '';
  private isConnectedState = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private deviceRegistration: DeviceRegistration | null = null;
  // In React Native / browser environments, timers return a number, not NodeJS.Timeout
  private heartbeatInterval: number | null = null;

  async connect(serverUrl: string): Promise<boolean> {
    this.serverUrl = serverUrl;
    const net = await NetInfo.fetch();
    if (!net.isConnected) return false;
    if (this.socket) this.socket.close();

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'], reconnection: true,
      reconnectionDelay: 1000, reconnectionAttempts: this.maxReconnectAttempts, timeout: 10000,
    });
    this.setupSocketListeners();

    return new Promise((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000);
      this.socket?.once(S.CONNECT, () => {
        clearTimeout(timeout);
        this.isConnectedState = true; this.reconnectAttempts = 0;
        this.startHeartbeat();
        resolve(true);
      });
      this.socket?.once(S.CONNECTION.CONNECT_ERROR, () => { clearTimeout(timeout); resolve(false); });
    });
  }

  private setupSocketListeners() {
    if (!this.socket) return;
    this.socket.on(S.CONNECT, () => {
      this.isConnectedState = true; this.reconnectAttempts = 0;
      this.triggerEvent(S.CONNECTED, {});
      if (this.deviceRegistration) this.registerDevice(this.deviceRegistration);
    });
    this.socket.on(S.DISCONNECT, (reason) => {
      this.isConnectedState = false; this.stopHeartbeat();
      this.triggerEvent(S.DISCONNECTED, { reason });
    });
    this.socket.on(S.CONNECTION.CONNECT_ERROR, () => { this.reconnectAttempts++; });
    this.socket.on(S.CONNECTION.ERROR, (error) => this.triggerEvent('socket_error', error));

    this.socket.on(S.DEVICE.REGISTER_SUCCESS, (d) => this.triggerEvent('device_registered', d));
    this.socket.on(S.DEVICE.REGISTER_ERROR, (e) => this.triggerEvent('device_registration_error', e));

    this.socket.on(S.ORDER.NEW, (d) => this.triggerEvent(S.ORDER.NEW, d));
    this.socket.on(S.ORDER.STATUS_UPDATED, (d) => this.triggerEvent(S.ORDER.STATUS_UPDATED, d));
    this.socket.on(S.WAITER_CALL.NEW, (d) => this.triggerEvent(S.WAITER_CALL.NEW, d));
    this.socket.on(S.WAITER_CALL.ACKNOWLEDGED, (d) => this.triggerEvent(S.WAITER_CALL.ACKNOWLEDGED, d));
    this.socket.on(S.TABLE.STATUS_UPDATED, (d) => this.triggerEvent(S.TABLE.STATUS_UPDATED, d));

    this.socket.on(S.NOTIFICATION.NEW, (d) => this.triggerEvent(S.NOTIFICATION.NEW, d));
    this.socket.on(S.NOTIFICATION.BROADCAST, (d) => this.triggerEvent(S.NOTIFICATION.BROADCAST, d));
    this.socket.on(S.SYSTEM.ANNOUNCEMENT, (d) => this.triggerEvent(S.SYSTEM.ANNOUNCEMENT, d));
    this.socket.on(S.OWNER.SESSION_REPLACED, (d) => this.triggerEvent(S.OWNER.SESSION_REPLACED, d));
    this.socket.on(S.EMPLOYEE.SESSION_REPLACED, (d) => this.triggerEvent(S.EMPLOYEE.SESSION_REPLACED, d));
    this.socket.on(S.CONNECTION.PONG, () => { });
  }

  async registerDevice(registration: DeviceRegistration): Promise<void> {
    this.deviceRegistration = registration;
    if (!this.socket || !this.isConnectedState) return;
    this.socket.emit(S.DEVICE.REGISTER, registration);
  }

  async emit(event: string, data: any): Promise<void> {
    if (!this.socket || !this.isConnectedState) return;
    this.socket.emit(event, data);
  }

  on(event: string, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) this.eventHandlers.set(event, new Set());
    this.eventHandlers.get(event)!.add(handler);
    return () => this.eventHandlers.get(event)?.delete(handler);
  }

  off(event: string, handler?: EventHandler): void {
    if (!handler) { this.eventHandlers.delete(event); return; }
    this.eventHandlers.get(event)?.delete(handler);
    if (this.eventHandlers.get(event)?.size === 0) this.eventHandlers.delete(event);
  }

  private triggerEvent(event: string, data: any) {
    this.eventHandlers.get(event)?.forEach((h) => { try { h(data); } catch (e) { logger.error(`Handler error ${event}:`, e); } });
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket && this.isConnectedState) this.socket.emit(S.CONNECTION.PING, { timestamp: Date.now() });
    }, 30000) as unknown as number;
  }
  private stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval as number);
      this.heartbeatInterval = null;
    }
  }

  async reconnect(): Promise<boolean> {
    if (this.socket) this.socket.close();
    return this.connect(this.serverUrl);
  }

  disconnect() {
    this.stopHeartbeat();
    this.eventHandlers.clear();
    if (this.socket) { this.socket.close(); this.socket = null; }
    this.isConnectedState = false;
  }

  isConnected(): boolean { return this.isConnectedState && this.socket?.connected === true; }
}

export default new DeviceSocketService();