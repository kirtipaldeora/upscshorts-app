import { useState } from 'react'
import type { FocusRuntimeController } from '@/hooks/useFocusRuntime'
import { useFocusExperience } from '@/hooks/useFocusExperience'
import { FocusScreen } from './FocusScreen'
import type { FocusView } from './focusTypes'

interface FocusExperienceProps {
  runtime: FocusRuntimeController
  onShowToast?: (message: string) => void
}

/** Connects the lazy Focus UI to the single app-owned runtime. */
export function FocusExperience({ runtime, onShowToast }: FocusExperienceProps) {
  const [initialView] = useState<FocusView>(() => {
    try {
      const requested = sessionStorage.getItem('penni.focus.initial-view')
      sessionStorage.removeItem('penni.focus.initial-view')
      return requested === 'friends' || requested === 'groups' || requested === 'rankings' ? requested : 'today'
    } catch { return 'today' as const }
  })
  const experience = useFocusExperience(runtime, { onShowToast })
  const socialState = experience.loading
    ? { kind: 'loading' as const, message: 'Connecting Focus friends and study groups…' }
    : experience.socialAvailability === 'guest'
      ? { kind: 'unavailable' as const, message: 'Sign in to create groups, invite members and share live study status. Your timer still works locally.' }
      : experience.socialAvailability === 'offline'
        ? { kind: 'unavailable' as const, message: 'You are offline. The timer still works; groups and live study status will reconnect when you are online.' }
        : experience.socialAvailability === 'unconfigured'
          ? { kind: 'unavailable' as const, message: 'Study groups are not connected in this build yet. The Focus timer still works locally.' }
          : experience.error
            ? { kind: 'error' as const, message: `Focus social service: ${experience.error}` }
            : null
  return <FocusScreen
    {...experience.screenProps}
    initialView={initialView}
    socialNotice={socialState?.message}
    socialNoticeKind={socialState?.kind}
  />
}
