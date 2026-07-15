import { Capacitor } from '@capacitor/core'
import { Haptics, NotificationType } from '@capacitor/haptics'
import { LocalNotifications } from '@capacitor/local-notifications'

function notificationId(sessionId: string) {
  let hash = 17
  for (let index = 0; index < sessionId.length; index += 1) {
    hash = ((hash * 31) + sessionId.charCodeAt(index)) | 0
  }
  return Math.max(1, Math.abs(hash) % 2_000_000_000)
}

export async function requestFocusNotificationPermission(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const current = await LocalNotifications.checkPermissions()
      if (current.display === 'granted') return true
      const requested = await LocalNotifications.requestPermissions()
      return requested.display === 'granted'
    } catch {
      return false
    }
  }

  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  try { return (await Notification.requestPermission()) === 'granted' } catch { return false }
}

export async function scheduleFocusCompletion(options: {
  sessionId: string
  endsAt: number
  subject: string
  phase?: 'focus' | 'break'
  soundEnabled?: boolean
}): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || options.endsAt <= Date.now()) return false
  const allowed = await requestFocusNotificationPermission()
  if (!allowed) return false
  try {
    const isBreak = options.phase === 'break'
    await LocalNotifications.schedule({
      notifications: [{
        id: notificationId(options.sessionId),
        title: isBreak ? 'Break complete' : 'Focus block complete',
        body: isBreak
          ? 'Ready for the next focused block?'
          : `${options.subject || 'Your study block'} is complete. Take a deliberate break.`,
        schedule: { at: new Date(options.endsAt), allowWhileIdle: true },
        sound: options.soundEnabled === false ? undefined : 'default',
        extra: { sessionId: options.sessionId, kind: 'focus-complete' },
      }],
    })
    return true
  } catch {
    return false
  }
}

export async function cancelFocusCompletion(sessionId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try {
    await LocalNotifications.cancel({ notifications: [{ id: notificationId(sessionId) }] })
  } catch { /* notification may already have fired */ }
}

export async function showFocusCompletion(subject: string, kind: 'focus' | 'break' = 'focus'): Promise<void> {
  if (Capacitor.isNativePlatform()) return
  if (!('Notification' in window) || Notification.permission !== 'granted') return
  try {
    new Notification(kind === 'break' ? 'Break complete' : 'Focus block complete', {
      body: kind === 'break'
        ? 'Ready for the next focused block?'
        : `${subject || 'Your study block'} is complete. Time for a deliberate break.`,
      tag: 'penni-focus-complete',
    })
  } catch { /* foreground UI still shows completion */ }
}

/** A short, self-contained chime; no media asset or network request is needed. */
export function playFocusCompletionSound(kind: 'focus' | 'break' = 'focus'): void {
  if (typeof window === 'undefined') return
  const AudioContextClass = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return
  try {
    const context = new AudioContextClass()
    const master = context.createGain()
    const startedAt = context.currentTime
    const tones = kind === 'break' ? [523.25, 659.25] : [659.25, 783.99, 987.77]
    master.gain.setValueAtTime(0.0001, startedAt)
    master.gain.exponentialRampToValueAtTime(0.12, startedAt + 0.025)
    master.gain.exponentialRampToValueAtTime(0.0001, startedAt + tones.length * 0.16 + 0.3)
    master.connect(context.destination)
    tones.forEach((frequency, index) => {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      const toneAt = startedAt + index * 0.16
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, toneAt)
      gain.gain.setValueAtTime(0.0001, toneAt)
      gain.gain.exponentialRampToValueAtTime(0.8, toneAt + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, toneAt + 0.24)
      oscillator.connect(gain)
      gain.connect(master)
      oscillator.start(toneAt)
      oscillator.stop(toneAt + 0.26)
    })
    window.setTimeout(() => void context.close().catch(() => undefined), 1_300)
  } catch { /* toast and notification still provide completion feedback */ }
}

/**
 * Repeats a gentle two-tone break alarm while the foreground alarm sheet is
 * open. The returned disposer is idempotent so every dismissal path can stop
 * the alarm immediately. Native background delivery remains the responsibility
 * of the scheduled local notification above.
 */
export function startBreakAlarmSound(): () => void {
  if (typeof window === 'undefined') return () => undefined
  const AudioContextClass = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AudioContextClass) return () => undefined

  try {
    const context = new AudioContextClass()
    let stopped = false
    let interval: number | null = null

    const ring = () => {
      if (stopped || context.state === 'closed') return
      void context.resume().catch(() => undefined)
      const startedAt = context.currentTime + 0.02
      const master = context.createGain()
      master.gain.setValueAtTime(0.0001, startedAt)
      master.gain.exponentialRampToValueAtTime(0.16, startedAt + 0.035)
      master.gain.exponentialRampToValueAtTime(0.0001, startedAt + 0.88)
      master.connect(context.destination)

      ;[659.25, 523.25, 659.25].forEach((frequency, index) => {
        const oscillator = context.createOscillator()
        const gain = context.createGain()
        const toneAt = startedAt + index * 0.25
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(frequency, toneAt)
        gain.gain.setValueAtTime(0.0001, toneAt)
        gain.gain.exponentialRampToValueAtTime(0.9, toneAt + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, toneAt + 0.2)
        oscillator.connect(gain)
        gain.connect(master)
        oscillator.start(toneAt)
        oscillator.stop(toneAt + 0.22)
      })
    }

    ring()
    interval = window.setInterval(ring, 1_650)
    return () => {
      if (stopped) return
      stopped = true
      if (interval !== null) window.clearInterval(interval)
      void context.close().catch(() => undefined)
    }
  } catch {
    return () => undefined
  }
}

export async function playFocusCompletionHaptic(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  try { await Haptics.notification({ type: NotificationType.Success }) } catch { /* optional feedback */ }
}
