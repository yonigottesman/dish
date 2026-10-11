'use client';

import { useEffect } from 'react';

/**
 * Keeps the screen awake while the app is open using the Screen Wake Lock API.
 * Supported on Chrome for Android (and other modern browsers). Silently does
 * nothing where the API is unavailable. The lock is automatically released by
 * the browser when the tab is hidden, so we re-acquire it when the page becomes
 * visible again.
 */
export default function WakeLock() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let wakeLock: WakeLockSentinel | null = null;
    let cancelled = false;

    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          // Component unmounted while awaiting; clean up.
          wakeLock.release().catch(() => {});
          wakeLock = null;
        }
      } catch {
        // Request can reject (e.g. tab not visible, low battery). Ignore.
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        requestWakeLock();
      }
    };

    requestWakeLock();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
      }
    };
  }, []);

  return null;
}
