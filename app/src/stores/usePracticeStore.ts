import { create } from 'zustand'
import { TODAY } from '@/constants/categories'

// ─── Badge definitions ────────────────────────────────────────
export const BADGES = [
  { id: 'first',   icon: '🌱', name: 'First Steps',     desc: 'Answer your first question',       cond: (s: PracticeStats) => Object.keys(s.a).length >= 1 },
  { id: 'q25',     icon: '📘', name: 'Quarter Century',  desc: '25 questions attempted',           cond: (s: PracticeStats) => Object.keys(s.a).length >= 25 },
  { id: 'q100',    icon: '🏆', name: 'Centurion',        desc: '100 questions attempted',          cond: (s: PracticeStats) => Object.keys(s.a).length >= 100 },
  { id: 'streak3', icon: '🔥', name: 'On a Roll',        desc: '3-day practice streak',            cond: (s: PracticeStats) => s.streak.count >= 3 },
  { id: 'streak7', icon: '⚡', name: 'Week Warrior',     desc: '7-day practice streak',            cond: (s: PracticeStats) => s.streak.count >= 7 },
  { id: 'streak30',icon: '💎', name: 'Iron Will',        desc: '30-day practice streak',           cond: (s: PracticeStats) => s.streak.count >= 30 },
  { id: 'sharp',   icon: '🎯', name: 'Sharpshooter',    desc: '10 correct in a day',              cond: (s: PracticeStats) => Object.values(s.d).some(d => d.c >= 10) },
]

// ─── Types ────────────────────────────────────────────────────
export interface DayStats {
  n: number  // attempted
  c: number  // correct
}

export interface PracticeStats {
  a: Record<string, [number, number, string]>  // qid -> [correct(0|1), timestamp, subject]
  d: Record<string, DayStats>                  // date -> day stats
  streak: { last: string; count: number }
  badges: string[]
}

export interface PracticeSettings {
  target: number
  remind: boolean
  key: string
  name: string
}

export interface PyqItem {
  id: string
  exam: 'prelims' | 'mains'
  year: number
  subject: string
  question: string
  options?: string[]
  answer?: number
  explanation?: string
  paper?: string
  keyPoints?: string[]
}

function loadStats(): PracticeStats {
  try {
    return JSON.parse(localStorage.getItem('u4stats') || 'null') ?? {
      a: {}, d: {}, streak: { last: '', count: 0 }, badges: [],
    }
  } catch {
    return { a: {}, d: {}, streak: { last: '', count: 0 }, badges: [] }
  }
}

function loadSettings(): PracticeSettings {
  try {
    return Object.assign({ target: 10, remind: false, key: '', name: '' },
      JSON.parse(localStorage.getItem('u4set') || '{}'))
  } catch {
    return { target: 10, remind: false, key: '', name: '' }
  }
}

function loadQbm(): string[] {
  try { return JSON.parse(localStorage.getItem('u4qbm') || '[]') } catch { return [] }
}

function loadMq(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem('u4mq') || '{}') } catch { return {} }
}

// ─── Store interface ──────────────────────────────────────────
interface PracticeStore {
  stats: PracticeStats
  settings: PracticeSettings
  questionBookmarks: string[]  // array of question ids
  mainsQuota: Record<string, number>  // date -> count used
  pyqData: PyqItem[]
  pyqReady: boolean

  // Actions
  recordAnswer: (qid: string, correct: boolean, subject: string, target: number, toast: (m: string) => void) => void
  toggleQbm: (qid: string, toast: (m: string) => void) => void
  saveSettings: (patch: Partial<PracticeSettings>) => void
  setPyqData: (data: PyqItem[]) => void
  incrementMainsQuota: () => void
}

export const usePracticeStore = create<PracticeStore>()((set, get) => ({
  stats: loadStats(),
  settings: loadSettings(),
  questionBookmarks: loadQbm(),
  mainsQuota: loadMq(),
  pyqData: [],
  pyqReady: false,

  recordAnswer: (qid, correct, subject, target, toast) => {
    const s = { ...get().stats }
    const previous = s.a[qid]
    const wasCorrect = previous?.[0] === 1
    const previousDate = previous ? new Date(previous[1]).toISOString().split('T')[0] : null
    const isFirstAttempt = !previous
    s.a = { ...s.a, [qid]: [correct ? 1 : 0, Date.now(), subject] }
    const d = { ...(s.d[TODAY] ?? { n: 0, c: 0 }) }
    if (isFirstAttempt) {
      d.n++
      if (correct) d.c++
    } else if (previousDate === TODAY && wasCorrect !== correct) {
      d.c = Math.max(0, Math.min(d.n, d.c + (correct ? 1 : -1)))
    }
    s.d = { ...s.d, [TODAY]: d }
    const st = { ...s.streak }
    if (isFirstAttempt && st.last !== TODAY) {
      const yesterday = new Date(Date.now() - 864e5).toISOString().split('T')[0]
      st.count = st.last === yesterday ? st.count + 1 : 1
      st.last = TODAY
    }
    // Check badges
    const newBadges = [...s.badges]
    BADGES.forEach(b => {
      if (!newBadges.includes(b.id) && b.cond({ ...s, streak: st, badges: newBadges })) {
        newBadges.push(b.id)
        toast(`${b.icon} Badge earned: ${b.name}`)
      }
    })
    s.badges = newBadges
    s.streak = st
    const newStats = s
    localStorage.setItem('u4stats', JSON.stringify(newStats))
    set({ stats: newStats })
    if (isFirstAttempt && d.n === target) {
      toast(`🎯 Daily target hit! Streak: ${st.count} 🔥`)
    }
  },

  toggleQbm: (qid, toast) => {
    const curr = [...get().questionBookmarks]
    const idx = curr.indexOf(qid)
    if (idx > -1) { curr.splice(idx, 1); toast('Question removed') }
    else { curr.push(qid); toast('Question bookmarked') }
    localStorage.setItem('u4qbm', JSON.stringify(curr))
    set({ questionBookmarks: curr })
  },

  saveSettings: (patch) => {
    const next = { ...get().settings, ...patch }
    localStorage.setItem('u4set', JSON.stringify(next))
    set({ settings: next })
  },

  setPyqData: (data) => set({ pyqData: data, pyqReady: true }),

  incrementMainsQuota: () => {
    const mq = { ...get().mainsQuota, [TODAY]: (get().mainsQuota[TODAY] ?? 0) + 1 }
    localStorage.setItem('u4mq', JSON.stringify(mq))
    set({ mainsQuota: mq })
  },
}))
