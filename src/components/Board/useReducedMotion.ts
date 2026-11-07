import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

function reducedOnWeb(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True when the OS asks to skip nonessential motion. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (Platform.OS === 'web' ? reducedOnWeb() : false));

  useEffect(() => {
    if (Platform.OS === 'web') {
      if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
      const media = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => setReduced(media.matches);
      apply();
      media.addEventListener('change', apply);
      return () => media.removeEventListener('change', apply);
    }

    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduced(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reduced;
}
