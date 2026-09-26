'use client';

import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import ClientProviders from './ClientProviders';
import BackButton from '@/components/BackButton';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useReactNative } from '@/lib/contexts/ReactNativeWrapper';

function AuthenticatedNativeServices({ children }) {
  const { user, hydrated, isAuthenticated } = useAuth();
  const { isNative, servicesInitialized, initializeNativeServices, disconnectNativeServices } = useReactNative();
  const initializedUserId = useRef(null);
  const userType = ['seller', 'seller-admin'].includes(String(user?.userType || user?.role?.name || '').toLowerCase())
    ? 'seller'
    : 'bidder';

  useEffect(() => {
    const userId = user?.id;
    if (hydrated && (!userId || !isAuthenticated())) {
      if (initializedUserId.current !== null) {
        disconnectNativeServices().catch(() => {});
        initializedUserId.current = null;
      }
      return;
    }
    if (
      !hydrated ||
      !isNative ||
      !isAuthenticated() ||
      !userId ||
      (servicesInitialized && initializedUserId.current === userId)
    ) {
      return;
    }

    initializedUserId.current = userId;
    initializeNativeServices(userId, userType).catch((error) => {
      initializedUserId.current = null;
      console.error('Failed to initialize native services', error);
    });
  }, [disconnectNativeServices, hydrated, initializeNativeServices, isAuthenticated, isNative, servicesInitialized, user?.id, userType]);

  useEffect(() => {
    const userId = user?.id;
    console.log('user',user)
    if (!hydrated || isNative || !isAuthenticated() || !userId) return undefined;

    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_SERVER_URL || 'http://localhost:3015/main-sockets';
    const socket = io(socketUrl, {
      query: { userId: String(userId), userType },
      transports: ['websocket', 'polling'],
    });

    const handleNotification = (notification) => {
      window.dispatchEvent(new CustomEvent('bidz4u:notification', { detail: notification }));
      if (typeof window.Notification === 'function' && window.Notification.permission === 'granted') {
        new window.Notification(notification.title || 'Bidz4u update', {
          body: notification.body || 'You have a new auction update.',
        });
      }
    };

    socket.on('notification:new', handleNotification);
    return () => {
      socket.off('notification:new', handleNotification);
      socket.disconnect();
    };
  }, [hydrated, isAuthenticated, isNative, user?.id, userType]);

  return children;
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <ClientProviders>
          <AuthenticatedNativeServices>
            <BackButton />
            {children}
          </AuthenticatedNativeServices>
        </ClientProviders>
      </body>
    </html>
  );
}