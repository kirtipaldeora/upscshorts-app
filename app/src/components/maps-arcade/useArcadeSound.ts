import { useRef, useCallback } from 'react'

type SoundKind = 'correct' | 'wrong' | 'hint' | 'click' | 'level'

interface Tone { freq: number; delay: number; dur: number; type: OscillatorType }

const TONES: Record<SoundKind, Tone[]> = {
  correct: [
    { freq: 660, delay: 0,    dur: 0.09, type: 'sine' },
    { freq: 990, delay: 0.07, dur: 0.13, type: 'sine' },
  ],
  wrong: [
    { freq: 200, delay: 0, dur: 0.18, type: 'sawtooth' },
  ],
  hint: [
    { freq: 700, delay: 0, dur: 0.12, type: 'triangle' },
  ],
  click: [
    { freq: 520, delay: 0, dur: 0.05, type: 'sine' },
  ],
  level: [
    { freq: 523, delay: 0,    dur: 0.09, type: 'sine' },
    { freq: 659, delay: 0.09, dur: 0.09, type: 'sine' },
    { freq: 784, delay: 0.18, dur: 0.16, type: 'sine' },
  ],
}

export function useArcadeSound() {
  const ctxRef = useRef<AudioContext | null>(null)

  const ensureAudio = useCallback(() => {
    if (ctxRef.current) return ctxRef.current
    try {
      ctxRef.current = new (window.AudioContext || (window as never)['webkitAudioContext'])()
    } catch {
      ctxRef.current = null
    }
    return ctxRef.current
  }, [])

  const playSound = useCallback((kind: SoundKind, muted: boolean) => {
    if (muted) return
    const ctx = ensureAudio()
    if (!ctx) return
    try {
      if (ctx.state === 'suspended') ctx.resume()
      const now = ctx.currentTime
      ;(TONES[kind] ?? TONES.click).forEach(({ freq, delay, dur, type }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = type
        osc.frequency.value = freq
        const start = now + delay
        gain.gain.setValueAtTime(0, start)
        gain.gain.linearRampToValueAtTime(0.16, start + 0.01)
        gain.gain.exponentialRampToValueAtTime(0.001, start + dur)
        osc.connect(gain).connect(ctx.destination)
        osc.start(start)
        osc.stop(start + dur + 0.02)
      })
    } catch { /* ignore */ }
  }, [ensureAudio])

  return { playSound }
}
