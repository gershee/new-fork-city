/**
 * Haptic feedback utilities for mobile devices
 */

export function triggerHaptic(type: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof window === 'undefined') return;

  // Check for vibration API support
  if ('vibrate' in navigator) {
    const duration = type === 'light' ? 10 : type === 'medium' ? 25 : 50;
    navigator.vibrate(duration);
  }
}

export function triggerSuccessHaptic() {
  if (typeof window === 'undefined') return;
  if ('vibrate' in navigator) {
    // Pattern: short-pause-short
    navigator.vibrate([10, 50, 10]);
  }
}

export function triggerCelebrationHaptic() {
  if (typeof window === 'undefined') return;
  if ('vibrate' in navigator) {
    // Pattern: celebration burst
    navigator.vibrate([10, 30, 10, 30, 20]);
  }
}
