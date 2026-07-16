import { useSyncExternalStore } from 'react'

export type ReadingLanguage = 'en' | 'hi'

const STORAGE_KEY = 'penni-read-lang'
const CHANGE_EVENT = 'penni:reading-language-change'

export function getReadingLanguage(): ReadingLanguage {
  if (typeof window === 'undefined') return 'en'
  try { return window.localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en' } catch { return 'en' }
}

export function setReadingLanguage(language: ReadingLanguage) {
  if (typeof window === 'undefined') return
  try { window.localStorage.setItem(STORAGE_KEY, language) } catch { /* noop */ }
  window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: language }))
}

function subscribe(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export function useReadingLanguage() {
  const language = useSyncExternalStore(subscribe, getReadingLanguage, () => 'en' as ReadingLanguage)
  return [language, setReadingLanguage] as const
}
