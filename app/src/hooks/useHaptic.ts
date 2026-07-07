import { useCallback } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'

// Detect if running inside Capacitor native container
function isNative(): boolean {
  return !!(window as unknown as { Capacitor?: { isNative?: boolean } }).Capacitor
    ?.isNative
}

/**
 * Returns a haptic feedback function.
 * On native (Android/iOS): uses @capacitor/haptics.
 * On web: falls back to navigator.vibrate.
 */
export function useHaptic() {
  const haptic = useCallback(async (ms = 8) => {
    try {
      if (isNative()) {
        await Haptics.impact({ style: ImpactStyle.Light })
      } else if (navigator.vibrate) {
        navigator.vibrate(ms)
      }
    } catch {
      // Silently fail — haptics are enhancement only
    }
  }, [])

  return haptic
}
