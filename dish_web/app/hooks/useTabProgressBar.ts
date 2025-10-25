import { useEffect, useRef, useState } from 'react';

interface UseProgressBarOptions {
  duration?: number; // Duration in milliseconds
  active?: boolean; // Whether the progress bar is active
  onComplete?: () => void; // Callback when progress completes
}

export const useProgressBar = (options: UseProgressBarOptions = {}) => {
  const { duration = 20000, active = false, onComplete } = options;
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);
  const hasCompletedRef = useRef<boolean>(false);

  const clearProgressBar = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    // If progress bar has completed, stay at 99%, otherwise reset to 0
    if (hasCompletedRef.current) {
      setProgress(0.99); // Stay at 99%
    } else {
      setProgress(0);
    }
  };

  const resetProgressBar = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    hasCompletedRef.current = false;
    setProgress(0);
  };

  const startProgressBar = () => {
    startTimeRef.current = Date.now();
    hasCompletedRef.current = false;
    setProgress(0);
    
    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current;
      // Cap progress at 99% (0.99) instead of 100% (1.0)
      const currentProgress = Math.min(elapsed / duration, 0.99);
      setProgress(currentProgress);
      
      // Consider "complete" when we reach 99%
      if (currentProgress >= 0.99) {
        hasCompletedRef.current = true;
        clearProgressBar();
        if (onComplete) {
          onComplete();
        }
      }
    };

    // Update immediately, then every 100ms for smooth animation
    updateProgress();
    intervalRef.current = setInterval(updateProgress, 100);
  };

  useEffect(() => {
    if (active) {
      startProgressBar();
    } else {
      clearProgressBar();
    }

    // Cleanup on unmount
    return () => {
      clearProgressBar();
    };
  }, [active, duration]);

  // Also cleanup when the component unmounts
  useEffect(() => {
    return () => {
      clearProgressBar();
    };
  }, []);

  return {
    progress: Math.floor(progress * 100), // Return percentage
    isActive: active,
    startProgressBar,
    clearProgressBar,
    resetProgressBar,
  };
}; 