'use client';
// lib/hooks/useAuctionTimer.jsx
//
// Independent countdown driven by actListingTimeEnd. Resets automatically
// whenever the parent passes a new endTime (e.g. from a socket
// 'auction:extended' event caught by useSocket in the same page).

import { useEffect, useRef, useState } from 'react';
import { formatCountdown } from '@/Functions';

export function useAuctionTimer(endTimeIso) {
  const [msRemaining, setMsRemaining] = useState(() => {
    if (!endTimeIso) return 0;
    return Math.max(0, new Date(endTimeIso).getTime() - Date.now());
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!endTimeIso) {
      setMsRemaining(0);
      return undefined;
    }

    const tick = () => {
      const remaining = Math.max(0, new Date(endTimeIso).getTime() - Date.now());
      setMsRemaining(remaining);
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [endTimeIso]);

  return {
    msRemaining,
    isExpired: msRemaining <= 0,
    isInFinalMinute: msRemaining > 0 && msRemaining <= 60000,
    display: formatCountdown(msRemaining),
  };
}
