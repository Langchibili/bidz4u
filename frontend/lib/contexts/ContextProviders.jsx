'use client';
// lib/contexts/ContextProviders.jsx
// Single wrapper so layouts stay tidy as more providers get added later.

import { AuthProvider } from './AuthContext';
import ReactNativeWrapper from './ReactNativeWrapper';
import { NotificationsProvider } from './NotificationsContext';

export default function ContextProviders({ children }) {
  return (
    <ReactNativeWrapper>
      <AuthProvider>
        <NotificationsProvider>{children}</NotificationsProvider>
      </AuthProvider>
    </ReactNativeWrapper>
  );
}
