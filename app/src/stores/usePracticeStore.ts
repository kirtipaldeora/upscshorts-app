import { create } from 'zustand'
import { TODAY, toDateStr } from '@/constants/categories'
import { calculateStreak, completesDailyActivity } from '@/utils/streak'

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

export const ARTICLE_MILESTONES = [
  { id: 'read5', count: 5, icon: '🧭', name: 'Context Builder', desc: 'Completed 5 Deep Dives' },
  { id: 'read10', count: 10, icon: '🧠', name: 'Informed Aspirant', desc: 'Completed 10 Deep Dives' },
  { id: 'read25', count: 25, icon: '🏅', name: 'Deep Dive Scholar', desc: 'Completed 25 Deep Dives' },
  { id: 'read50', count: 50, icon: '🏆', name: 'Current Affairs Pro', desc: 'Completed 50 Deep Dives' },
  { id: 'read100', count: 100, icon: '💎', name: 'Newsroom Master', desc: 'Completed 100 Deep Dives' },
] as const

export interface ArticleMilestone {
  id: string
  count: number
  icon: string
  name: string
  desc: string
}
export type LearningActivityResult = { recorded: boolean; totalLearned: number; milestone?: ArticleMilestone }

function articleMilestone(count: number): ArticleMilestone | undefined {
  if (count < 5 || count % 5 !== 0) return undefined
  const named = ARTICLE_MILESTONES.find(item => item.count === count)
  if (named) return named
  return {
    id: `read${count}`,
    count,
    icon: count % 25 === 0 ? '🏅' : '✨',
    name: `${count} stories understood`,
    desc: `Completed ${count} Deep Dives`,
  }
}

// ─── Types ────────────────────────────────────────────────────
export interface DayStats {
  n: number  // attempted
  c: number  // correct
  mains?: number
  learned?: string[]
  arcade?: {
    attempts: number
    correct: number
    points: number
  }
}

export interface PracticeStats {
  a: Record<string, [number, number, string]>  // qid -> [correct(0|1), timestamp, subject]
  d: Record<string, DayStats>                  // date -> day stats
  streak: { last: string; count: number; longest: number }
  badges: string[]
}

export interface PracticeSettings {
  target: number
  studyTargets: StudyTargets
  remind: boolean
  reminderTime: string
  key: string
  name: string
  feedCosmicBackdrop: boolean
  voiceURI: string   // preferred system TTS voice for Penni Explain narration
  hapticsEnabled: boolean
}

export interface StudyTargets {
  prelims: boolean
  mains: boolean
  news: boolean
  gs: boolean
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

function emptyStats(): PracticeStats {
  return { a: {}, d: {}, streak: { last: '', count: 0, longest: 0 }, badges: [] }
}

function normalizeStats(value: Partial<PracticeStats> | null | undefined, target: number): PracticeStats {
  const base = emptyStats()
  const stats: PracticeStats = {
    a: value?.a && typeof value.a === 'object' ? value.a : base.a,
    d: value?.d && typeof value.d === 'object' ? value.d : base.d,
    streak: base.streak,
    badges: Array.isArray(value?.badges) ? value.badges : [],
  }
  const streak = calculateStreak(stats.d, target, TODAY)
  stats.streak = { last: streak.last, count: streak.current, longest: streak.longest }
  return stats
}

function loadStats(target: number): PracticeStats {
  try {
    return normalizeStats(JSON.parse(localStorage.getItem('u4stats') || 'null'), target)
  } catch {
    return emptyStats()
  }
}

export const DEFAULT_STUDY_TARGETS: StudyTargets = {
  prelims: true,
  mains: false,
  news: true,
  gs: false,
}

const DEFAULT_SETTINGS: PracticeSettings = { target: 10, studyTargets: DEFAULT_STUDY_TARGETS, remind: false, reminderTime: '19:00', key: '', name: '', feedCosmicBackdrop: true, voiceURI: '', hapticsEnabled: true }

function loadSettings(): PracticeSettings {
  try {
    const saved = JSON.parse(localStorage.getItem('u4set') || '{}') as Partial<PracticeSettings>
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      studyTargets: { ...DEFAULT_STUDY_TARGETS, ...saved.studyTargets },
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
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
  recordLearningActivity: (articleId: string) => LearningActivityResult
  recordArcadeAnswer: (correct: boolean, points: number) => void
  hydrateCloudState: (state: {
    stats?: PracticeStats
    settings?: Partial<PracticeSettings>
    questionBookmarks?: string[]
    mainsQuota?: Record<string, number>
  }) => void
}

const initialSettings = loadSettings()

export const usePracticeStore = create<PracticeStore>()((set, get) => ({
  stats: loadStats(initialSettings.target),
  settings: initialSettings,
  questionBookmarks: loadQbm(),
  mainsQuota: loadMq(),
  pyqData: [],
  pyqReady: false,

  recordAnswer: (qid, correct, subject, target, toast) => {
    const s = { ...get().stats }
    const previous = s.a[qid]
    const wasCorrect = previous?.[0] === 1
    const previousDate = previous ? toDateStr(new Date(previous[1])) : null
    const isFirstAttempt = !previous
    s.a = { ...s.a, [qid]: [correct ? 1 : 0, Date.now(), subject] }
    const d = { ...(s.d[TODAY] ?? { n: 0, c: 0 }) }
    const wasComplete = completesDailyActivity(d, target)
    if (isFirstAttempt) {
      d.n++
      if (correct) d.c++
    } else if (previousDate === TODAY && wasCorrect !== correct) {
      d.c = Math.max(0, Math.min(d.n, d.c + (correct ? 1 : -1)))
    }
    s.d = { ...s.d, [TODAY]: d }
    const streakSummary = calculateStreak(s.d, target, TODAY)
    const st = { last: streakSummary.last, count: streakSummary.current, longest: streakSummary.longest }
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
    if (!wasComplete && completesDailyActivity(d, target)) {
      toast(`Daily goal complete. ${st.count}-day streak protected.`)
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
    const stats = normalizeStats(get().stats, next.target)
    localStorage.setItem('u4set', JSON.stringify(next))
    localStorage.setItem('u4stats', JSON.stringify(stats))
    set({ settings: next, stats })
  },

  setPyqData: (data) => set({ pyqData: data, pyqReady: true }),

  incrementMainsQuota: () => {
    const mq = { ...get().mainsQuota, [TODAY]: (get().mainsQuota[TODAY] ?? 0) + 1 }
    const stats = { ...get().stats, d: { ...get().stats.d } }
    const day = { ...(stats.d[TODAY] ?? { n: 0, c: 0 }) }
    day.mains = (day.mains ?? 0) + 1
    stats.d[TODAY] = day
    const streak = calculateStreak(stats.d, get().settings.target, TODAY)
    stats.streak = { last: streak.last, count: streak.current, longest: streak.longest }
    localStorage.setItem('u4mq', JSON.stringify(mq))
    localStorage.setItem('u4stats', JSON.stringify(stats))
    set({ mainsQuota: mq, stats })
  },

  recordLearningActivity: (articleId) => {
    const stats = { ...get().stats, d: { ...get().stats.d } }
    const day = { ...(stats.d[TODAY] ?? { n: 0, c: 0 }) }
    const learned = [...(day.learned ?? [])]
    const learnedBefore = new Set(Object.values(stats.d).flatMap(item => item.learned ?? []))
    if (learned.includes(articleId)) return { recorded: false, totalLearned: learnedBefore.size }
    learned.push(articleId)
    day.learned = learned
    stats.d[TODAY] = day
    const totalLearned = new Set([...learnedBefore, articleId]).size
    const earnedMilestone = articleMilestone(totalLearned)
    const milestone = earnedMilestone && !stats.badges.includes(earnedMilestone.id) ? earnedMilestone : undefined
    if (milestone) stats.badges = [...stats.badges, milestone.id]
    const streak = calculateStreak(stats.d, get().settings.target, TODAY)
    stats.streak = { last: streak.last, count: streak.current, longest: streak.longest }
    localStorage.setItem('u4stats', JSON.stringify(stats))
    set({ stats })
    return { recorded: true, totalLearned, milestone }
  },

  recordArcadeAnswer: (correct, points) => {
    const stats = { ...get().stats, d: { ...get().stats.d } }
    const day = { ...(stats.d[TODAY] ?? { n: 0, c: 0 }) }
    day.arcade = {
      attempts: (day.arcade?.attempts ?? 0) + 1,
      correct: (day.arcade?.correct ?? 0) + (correct ? 1 : 0),
      points: (day.arcade?.points ?? 0) + Math.max(0, points),
    }
    stats.d[TODAY] = day
    const streak = calculateStreak(stats.d, get().settings.target, TODAY)
    stats.streak = { last: streak.last, count: streak.current, longest: streak.longest }
    localStorage.setItem('u4stats', JSON.stringify(stats))
    set({ stats })
  },

  hydrateCloudState: (cloud) => {
    const current = get()
    const settings = {
      ...DEFAULT_SETTINGS,
      ...current.settings,
      ...cloud.settings,
      studyTargets: {
        ...DEFAULT_STUDY_TARGETS,
        ...current.settings.studyTargets,
        ...cloud.settings?.studyTargets,
      },
    }
    const stats = normalizeStats(cloud.stats ?? current.stats, settings.target)
    const questionBookmarks = cloud.questionBookmarks ?? current.questionBookmarks
    const mainsQuota = cloud.mainsQuota ?? current.mainsQuota
    localStorage.setItem('u4stats', JSON.stringify(stats))
    localStorage.setItem('u4set', JSON.stringify(settings))
    localStorage.setItem('u4qbm', JSON.stringify(questionBookmarks))
    localStorage.setItem('u4mq', JSON.stringify(mainsQuota))
    set({ stats, settings, questionBookmarks, mainsQuota })
  },
}))
