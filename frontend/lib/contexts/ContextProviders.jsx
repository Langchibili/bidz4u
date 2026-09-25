'use client';
// lib/contexts/ContextProviders.jsx
// Single wrapper so layouts stay tidy as more providers get added later.

import { AuthProvider } from './AuthContext';
import ReactNativeWrapper from './ReactNativeWrapper';

export default function ContextProviders({ children }) {
  return (
    <ReactNativeWrapper>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ReactNativeWrapper>
  );
}
