import { useCallback, useEffect, useRef, useState } from 'react'

interface SpeakOptions {
  lang?: string
  rate?: number
  pitch?: number
  onItemStart?: (index: number) => void
  onDone?: () => void
}

interface QueueChunk {
  text: string
  itemIndex: number
  start: number
  total: number
}

function splitText(text: string, itemIndex = 0, startOffset = 0, totalLength = text.length): QueueChunk[] {
  const sentences = text.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [text]
  const chunks: QueueChunk[] = []
  let current = ''
  let cursor = startOffset
  sentences.forEach(sentence => {
    const next = `${current} ${sentence}`.trim()
    if (next.length > 190 && current) {
      chunks.push({ text: current, itemIndex, start: cursor, total: totalLength })
      cursor += current.length + 1
      current = sentence.trim()
    } else {
      current = next
    }
  })
  if (current) chunks.push({ text: current, itemIndex, start: cursor, total: totalLength })
  return chunks
}

function preferredVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  const voices = window.speechSynthesis.getVoices()
  const exact = voices.find(voice => voice.lang.toLowerCase() === lang.toLowerCase())
  if (exact) return exact
  return voices.find(voice => voice.lang.toLowerCase() === 'en-in') ??
    voices.find(voice => voice.lang.toLowerCase() === 'hi-in') ??
    voices.find(voice => voice.lang.toLowerCase().startsWith('en-')) ??
    null
}

export function useNarration() {
  const [speaking, setSpeaking] = useState(false)
  const [progress, setProgress] = useState(0)
  const [supported, setSupported] = useState(() => typeof window !== 'undefined' && 'speechSynthesis' in window)
  const queueRef = useRef<QueueChunk[]>([])
  const optionsRef = useRef({ lang: 'en-IN', rate: 0.88, pitch: 1.04 })
  const callbacksRef = useRef<Pick<SpeakOptions, 'onItemStart' | 'onDone'>>({})
  const currentItemRef = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (!supported) return
    queueRef.current = []
    callbacksRef.current = {}
    currentItemRef.current = null
    window.speechSynthesis.cancel()
    setSpeaking(false)
    setProgress(0)
  }, [supported])

  const playNext = useCallback(() => {
    if (!supported) return
    const next = queueRef.current.shift()
    if (!next) {
      setSpeaking(false)
      setProgress(100)
      callbacksRef.current.onDone?.()
      callbacksRef.current = {}
      currentItemRef.current = null
      return
    }
    const opts = optionsRef.current
    const utterance = new SpeechSynthesisUtterance(next.text)
    utterance.lang = opts.lang
    utterance.rate = opts.rate
    utterance.pitch = opts.pitch
    const voice = preferredVoice(opts.lang)
    if (voice) utterance.voice = voice
    utterance.onstart = () => {
      setProgress(next.total > 0 ? Math.min(99, (next.start / next.total) * 100) : 0)
      if (currentItemRef.current !== next.itemIndex) {
        currentItemRef.current = next.itemIndex
        callbacksRef.current.onItemStart?.(next.itemIndex)
      }
    }
    utterance.onboundary = (event) => {
      if (event.name && event.name !== 'word' && event.name !== 'sentence') return
      const readChars = next.start + event.charIndex
      setProgress(next.total > 0 ? Math.min(99, (readChars / next.total) * 100) : 0)
    }
    utterance.onend = () => playNext()
    utterance.onerror = () => {
      queueRef.current = []
      callbacksRef.current = {}
      currentItemRef.current = null
      setSpeaking(false)
      setProgress(0)
    }
    window.speechSynthesis.speak(utterance)
  }, [supported])

  const speak = useCallback((text: string, options: SpeakOptions = {}) => {
    if (!supported) {
      setSupported(false)
      return false
    }
    const clean = text.trim()
    if (!clean) return false
    window.speechSynthesis.cancel()
    optionsRef.current = {
      lang: options.lang ?? 'en-IN',
      rate: options.rate ?? 0.88,
      pitch: options.pitch ?? 1.04,
    }
    callbacksRef.current = { onItemStart: options.onItemStart, onDone: options.onDone }
    currentItemRef.current = null
    setProgress(0)
    queueRef.current = splitText(clean, 0, 0, clean.length)
    setSpeaking(true)
    playNext()
    return true
  }, [playNext, supported])

  const speakSequence = useCallback((items: string[], options: SpeakOptions = {}) => {
    if (!supported) {
      setSupported(false)
      return false
    }
    const cleanItems = items.map(item => item.trim()).filter(Boolean)
    const totalLength = cleanItems.join(' ').length
    let cursor = 0
    const chunks = cleanItems.flatMap((item, itemIndex) => {
      const itemChunks = splitText(item, itemIndex, cursor, totalLength)
      cursor += item.length + 1
      return itemChunks
    })
    if (!chunks.length) return false
    window.speechSynthesis.cancel()
    optionsRef.current = {
      lang: options.lang ?? 'en-IN',
      rate: options.rate ?? 0.88,
      pitch: options.pitch ?? 1.04,
    }
    callbacksRef.current = { onItemStart: options.onItemStart, onDone: options.onDone }
    currentItemRef.current = null
    setProgress(0)
    queueRef.current = chunks
    setSpeaking(true)
    playNext()
    return true
  }, [playNext, supported])

  const setVoiceOptions = useCallback((options: SpeakOptions = {}) => {
    optionsRef.current = {
      lang: options.lang ?? optionsRef.current.lang,
      rate: options.rate ?? optionsRef.current.rate,
      pitch: options.pitch ?? optionsRef.current.pitch,
    }
  }, [])

  useEffect(() => stop, [stop])

  return { speak, speakSequence, stop, setVoiceOptions, speaking, supported, progress }
}
