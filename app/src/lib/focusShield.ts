import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Native app blocking is deliberately exposed through a capability boundary.
 * The web build can keep the display awake, enter full screen and record exits,
 * but browsers cannot block other installed apps. A native shell can provide
 * that stronger behaviour through a `FocusShield` Capacitor plugin once the
 * required OS entitlement/permission has been granted.
 */

interface NativeFocusShieldStatus {
  available: boolean
  authorized: boolean
  selectionCount?: number
  reason?: string
}

interface NativeFocusShieldPlugin {
  getStatus(): Promise<NativeFocusShieldStatus>
  requestAccess(): Promise<NativeFocusShieldStatus>
  chooseApps(): Promise<NativeFocusShieldStatus>
  start(options: { sessionId: string }): Promise<void>
  stop(): Promise<void>
  openSettings(): Promise<void>
}

const NativeFocusShield = registerPlugin<NativeFocusShieldPlugin>('FocusShield')

export type FocusShieldPlatform = 'web' | 'ios' | 'android'

export interface FocusShieldCapability {
  platform: FocusShieldPlatform
  appBlockingAvailable: boolean
  appBlockingAuthorized: boolean
  selectedAppCount: number
  browserGuardAvailable: boolean
  title: string
  detail: string
  actionLabel?: string
}

export interface FocusInterruptionEvent {
  kind: 'left-app' | 'page-hidden' | 'page-unloaded'
  startedAt: number
  endedAt: number
  durationSeconds: number
}

export interface StartFocusGuardOptions {
  sessionId: string
  keepAwake: boolean
  requestFullscreen: boolean
  enableAppBlocking: boolean
  onInterruption: (event: FocusInterruptionEvent) => void
}

export interface FocusGuardHandle {
  nativeBlockingActive: boolean
  wakeLockActive: boolean
  fullscreenActive: boolean
  stop: () => Promise<void>
}

type WakeLockHandle = {
  released?: boolean
  release: () => Promise<void>
  addEventListener?: (name: 'release', listener: () => void) => void
}

function currentPlatform(): FocusShieldPlatform {
  const platform = Capacitor.getPlatform()
  return platform === 'ios' || platform === 'android' ? platform : 'web'
}

export async function getFocusShieldCapability(): Promise<FocusShieldCapability> {
  const platform = currentPlatform()
  if (platform === 'web') {
    return {
      platform,
      appBlockingAvailable: false,
      appBlockingAuthorized: false,
      selectedAppCount: 0,
      browserGuardAvailable: true,
      title: 'Distraction guard',
      detail: 'Keeps Penni awake and records when you leave the session. A browser cannot block other installed apps.',
    }
  }

  try {
    const status = await NativeFocusShield.getStatus()
    return {
      platform,
      appBlockingAvailable: status.available,
      appBlockingAuthorized: status.authorized,
      selectedAppCount: status.selectionCount ?? 0,
      browserGuardAvailable: true,
      title: status.authorized ? 'Focus Shield ready' : 'Set up Focus Shield',
      detail: status.authorized
        ? `${status.selectionCount ?? 0} distracting app${status.selectionCount === 1 ? '' : 's'} selected for blocking during a session.`
        : status.reason || (platform === 'ios'
          ? 'Grant Screen Time access and choose the apps Penni may shield while you focus.'
          : 'Grant Usage Access and choose the apps Penni may shield while you focus.'),
      actionLabel: status.authorized ? 'Change apps' : 'Set up',
    }
  } catch {
    return {
      platform,
      appBlockingAvailable: false,
      appBlockingAuthorized: false,
      selectedAppCount: 0,
      browserGuardAvailable: true,
      title: 'Focus Shield needs the native build',
      detail: platform === 'ios'
        ? 'Screen Time blocking requires Apple’s Family Controls entitlement in the installed iOS app. Exit tracking still works now.'
        : 'App blocking requires the installed Android service and Usage Access permission. Exit tracking still works now.',
    }
  }
}

export async function configureNativeFocusShield(): Promise<FocusShieldCapability> {
  const platform = currentPlatform()
  if (platform === 'web') return getFocusShieldCapability()
  try {
    const access = await NativeFocusShield.requestAccess()
    if (access.authorized) await NativeFocusShield.chooseApps()
  } catch {
    // Capability copy returned below explains why native setup is unavailable.
  }
  return getFocusShieldCapability()
}

export async function openNativeFocusShieldSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try { await NativeFocusShield.openSettings() } catch { /* optional native bridge */ }
}

async function requestWakeLock(): Promise<WakeLockHandle | null> {
  const wakeLock = (navigator as Navigator & {
    wakeLock?: { request: (type: 'screen') => Promise<WakeLockHandle> }
  }).wakeLock
  if (!wakeLock || document.visibilityState !== 'visible') return null
  try { return await wakeLock.request('screen') } catch { return null }
}

async function requestFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) return true
  if (!document.documentElement.requestFullscreen) return false
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    return true
  } catch {
    return false
  }
}

/** Starts the strongest guard currently available without overstating it. */
export async function startFocusGuard(options: StartFocusGuardOptions): Promise<FocusGuardHandle> {
  let hiddenAt: number | null = null
  let stopped = false
  // Fullscreen must be requested first while the start/resume click still
  // carries browser user activation. Wake Lock does not have that constraint.
  const fullscreenActive = options.requestFullscreen ? await requestFullscreen() : Boolean(document.fullscreenElement)
  let wakeLock = options.keepAwake ? await requestWakeLock() : null
  let nativeBlockingActive = false

  if (options.enableAppBlocking && Capacitor.isNativePlatform()) {
    try {
      const status = await NativeFocusShield.getStatus()
      if (status.available && status.authorized) {
        await NativeFocusShield.start({ sessionId: options.sessionId })
        nativeBlockingActive = true
      }
    } catch { /* exit tracking remains active */ }
  }

  const closeInterruption = (kind: FocusInterruptionEvent['kind']) => {
    if (hiddenAt === null) return
    const endedAt = Date.now()
    // Ignore sub-second browser chrome transitions; they are not useful data.
    if (endedAt - hiddenAt >= 1000) {
      options.onInterruption({
        kind,
        startedAt: hiddenAt,
        endedAt,
        durationSeconds: Math.max(1, Math.round((endedAt - hiddenAt) / 1000)),
      })
    }
    hiddenAt = null
  }

  const handleVisibility = async () => {
    if (document.visibilityState === 'hidden') {
      hiddenAt ??= Date.now()
      return
    }
    closeInterruption('page-hidden')
    if (options.keepAwake && !wakeLock && !stopped) wakeLock = await requestWakeLock()
  }
  const handleBlur = () => { hiddenAt ??= Date.now() }
  const handleFocus = () => closeInterruption('left-app')
  const handlePageHide = () => { hiddenAt ??= Date.now() }

  document.addEventListener('visibilitychange', handleVisibility)
  window.addEventListener('blur', handleBlur)
  window.addEventListener('focus', handleFocus)
  window.addEventListener('pagehide', handlePageHide)

  return {
    nativeBlockingActive,
    wakeLockActive: Boolean(wakeLock),
    fullscreenActive,
    stop: async () => {
      if (stopped) return
      stopped = true
      closeInterruption('page-unloaded')
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('pagehide', handlePageHide)
      try { await wakeLock?.release() } catch { /* already released */ }
      wakeLock = null
      if (nativeBlockingActive) {
        try { await NativeFocusShield.stop() } catch { /* session can still finish */ }
      }
      if (document.fullscreenElement) {
        try { await document.exitFullscreen() } catch { /* noop */ }
      }
    },
  }
}
