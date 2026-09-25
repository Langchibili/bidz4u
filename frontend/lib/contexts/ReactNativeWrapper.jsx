'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

const ReactNativeContext = createContext(null);
const REQUEST_TIMEOUTS = { INITIALIZE_SERVICES: 20000, REQUEST_PERMISSION: 60000, DEFAULT: 30000 };
const FIRE_AND_FORGET = new Set(['LOG_DATA']);

export function useReactNative() {
  const context = useContext(ReactNativeContext);
  if (!context) throw new Error('useReactNative must be used within ReactNativeWrapper');
  return context;
}

export default function ReactNativeWrapper({ children }) {
  const [isNative, setIsNative] = useState(false);
  const [servicesInitialized, setServicesInitialized] = useState(false);
  const [permissions, setPermissions] = useState({ location: null, notification: null });
  const pendingRef = useRef(new Map());
  const handlersRef = useRef(new Map());
  const requestCounterRef = useRef(0);

  useEffect(() => {
    setIsNative(typeof window !== 'undefined' && Boolean(window.ReactNativeWebView));
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      let message;
      try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch { return; }
      const { type, requestId, payload, error } = message || {};
      const pending = requestId ? pendingRef.current.get(requestId) : null;
      if (pending) {
        clearTimeout(pending.timeoutId);
        pendingRef.current.delete(requestId);
        error ? pending.reject(new Error(String(error))) : pending.resolve(payload);
        return;
      }
      handlersRef.current.get(type)?.forEach((handler) => handler(payload));
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('message', handleMessage);
      document.addEventListener('message', handleMessage);
    }
    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('message', handleMessage);
    };
  }, []);

  const sendToNative = useCallback((type, payload = {}) => {
    if (FIRE_AND_FORGET.has(type)) {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type, payload }));
      return Promise.resolve();
    }
    if (!isNative || !window.ReactNativeWebView) return Promise.reject(new Error('Not running in native app'));

    const requestId = `bidz4u_${Date.now()}_${++requestCounterRef.current}`;
    const timeoutMs = REQUEST_TIMEOUTS[type] || REQUEST_TIMEOUTS.DEFAULT;
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        pendingRef.current.delete(requestId);
        reject(new Error(`Native request timed out: ${type}`));
      }, timeoutMs);
      pendingRef.current.set(requestId, { resolve, reject, timeoutId });
      try {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type, requestId, payload }));
      } catch (error) {
        clearTimeout(timeoutId);
        pendingRef.current.delete(requestId);
        reject(error);
      }
    });
  }, [isNative]);

  const on = useCallback((type, handler) => {
    if (!handlersRef.current.has(type)) handlersRef.current.set(type, new Set());
    handlersRef.current.get(type).add(handler);
    return () => handlersRef.current.get(type)?.delete(handler);
  }, []);

  const initializeNativeServices = useCallback(async (userId, userType = 'bidder') => {
    const result = await sendToNative('INITIALIZE_SERVICES', {
      userId,
      userType,
      frontendName: userType,
      socketServerUrl: process.env.NEXT_PUBLIC_DEVICE_SOCKET_URL,
    });
    setServicesInitialized(result?.success === true);
    return result;
  }, [sendToNative]);

  const requestPermission = useCallback(async (permissionType) => {
    const result = await sendToNative('REQUEST_PERMISSION', { permissionType });
    setPermissions((previous) => ({ ...previous, [permissionType]: result?.status }));
    return result?.status;
  }, [sendToNative]);

  const checkPermission = useCallback(async (permissionType) => {
    const result = await sendToNative('CHECK_PERMISSION', { permissionType });
    setPermissions((previous) => ({ ...previous, [permissionType]: result?.status }));
    return result?.status;
  }, [sendToNative]);

  return (
    <ReactNativeContext.Provider value={{
      isNative,
      servicesInitialized,
      permissions,
      sendToNative,
      on,
      initializeNativeServices,
      requestPermission,
      checkPermission,
      showNotification: (notification) => sendToNative('SHOW_NOTIFICATION', notification),
    }}>
      {children}
    </ReactNativeContext.Provider>
  );
}
