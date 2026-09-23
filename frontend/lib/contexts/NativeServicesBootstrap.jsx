'use client';

import { useNativeApp } from '@/lib/hooks/useNativeApp';

export default function NativeServicesBootstrap() {
  useNativeApp();
  return null;
}
