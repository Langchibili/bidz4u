'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/contexts/AuthContext';
import { useReactNative } from '@/lib/contexts/ReactNativeWrapper';

export function useNativeApp() {
  const { user, hydrated, isAuthenticated } = useAuth();
  const native = useReactNative();
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!hydrated || !isAuthenticated() || !native.isNative || !user?.id || initialized || native.servicesInitialized) return;
    native.initializeNativeServices(user.id)
      .then((result) => setInitialized(result?.success === true))
      .catch((error) => console.error('Failed to initialize Bidz4u native services', error));
  }, [hydrated, initialized, isAuthenticated, native, user?.id]);

  return { ...native, initialized: initialized || native.servicesInitialized };
}
