// index.ts or App.tsx root
// ── Polyfill DOMException for React Native ──
if (typeof DOMException === 'undefined') {
  (globalThis as any).DOMException = class DOMException extends Error {
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name ?? 'DOMException';
    }
  };
}
// ────────────────────────────────────────────

import AppContent from './AppContent';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}