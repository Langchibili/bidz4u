'use client';
// lib/contexts/ContextProviders.jsx
// Single wrapper so layouts stay tidy as more providers get added later.

import { AuthProvider } from './AuthContext';

export default function ContextProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
