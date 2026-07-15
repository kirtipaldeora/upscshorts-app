import { useCallback } from 'react'
import { Haptics, ImpactStyle } from '@capacitor/haptics'
import { usePracticeStore } from '@/stores/usePracticeStore'

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
  const enabled = usePracticeStore(state => state.settings.hapticsEnabled)
  const haptic = useCallback(async (ms = 8) => {
    if (!enabled) return
    try {
      if (isNative()) {
        await Haptics.impact({ style: ImpactStyle.Light })
      } else if (navigator.vibrate) {
        navigator.vibrate(ms)
      }
    } catch {
      // Silently fail — haptics are enhancement only
    }
  }, [enabled])

  return haptic
}
