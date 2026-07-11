import { create } from 'zustand'
import type { Article, ArticlesByDate, GSFilter } from '@/types/article'
import { TODAY } from '@/constants/categories'
import { isSourceVisible, loadSourceFilter, saveSourceFilter, type SourceFilter, type SourceKey } from '@/constants/sources'

export type Screen =
  | 'feed'
  | 'revise'
  | 'search'
  | 'bookmarks'
  | 'profile'
  | 'practice'
  | 'maps'
  | 'settings'

export type ViewMode = 'deck' | 'list'

export type OverlayScreen =
  | null
  | 'deep-dive'
  | 'maps-arcade'
  | 'pyq-vault'
  | 'upload'
  | 'digest'
  | 'mains'
  | 'news-globe'

interface AppStore {
  // ─── Articles ───────────────────────────────────────────────
  articlesByDate: ArticlesByDate
  setArticlesByDate: (data: ArticlesByDate) => void
  mergeArticles: (data: ArticlesByDate) => void

  // ─── Navigation ─────────────────────────────────────────────
  activeScreen: Screen
  setScreen: (s: Screen) => void
  overlayScreen: OverlayScreen
  setOverlay: (s: OverlayScreen) => void

  // ─── Feed state ─────────────────────────────────────────────
  selectedDate: string
  setSelectedDate: (d: string) => void
  viewMode: ViewMode
  setViewMode: (v: ViewMode) => void
  categoryFilter: string | null // null = all
  setCategoryFilter: (c: string | null) => void

  // ─── GS filter (from onboarding) ─────────────────────────
  gsFilter: GSFilter
  setGsFilter: (f: GSFilter) => void

  // ─── News source toggles ──────────────────────────────────
  sourceFilter: SourceFilter
  toggleSource: (key: SourceKey) => void

  // ─── GS focus: cycle the feed through one GS paper at a time ─
  gsFocus: keyof GSFilter | null      // null = show all
  cycleGsFocus: () => void
  getFocusableGsPapers: (date: string) => (keyof GSFilter)[]

  // ─── Deep dive ───────────────────────────────────────────────
  activeArticle: Article | null
  setActiveArticle: (a: Article | null) => void
  deepDiveReturnOverlay: OverlayScreen
  setDeepDiveReturnOverlay: (s: OverlayScreen) => void

  // ─── Helpers ─────────────────────────────────────────────────
  getArticlesForDate: (date: string) => Article[]
  getAvailableDates: () => string[]
}

export const useAppStore = create<AppStore>()((set, get) => ({
  // Articles
  articlesByDate: {},
  setArticlesByDate: (data) => set({ articlesByDate: data }),
  mergeArticles: (data) =>
    set((s) => {
      const merged = { ...s.articlesByDate }
      for (const [date, articles] of Object.entries(data)) {
        const existing = merged[date] ?? []
        const incomingById = new Map(articles.map((a) => [a.id, a]))
        const next = existing.map((article) => incomingById.get(article.id) ?? article)
        const existingIds = new Set(existing.map((a) => a.id))
        const newOnes = articles.filter((a) => !existingIds.has(a.id))
        merged[date] = [...next, ...newOnes]
      }
      return { articlesByDate: merged }
    }),

  // Navigation
  activeScreen: 'feed',
  setScreen: (s) => set({ activeScreen: s }),
  overlayScreen: null,
  setOverlay: (s) => set({ overlayScreen: s }),

  // Feed state
  selectedDate: TODAY,
  setSelectedDate: (d) => set({ selectedDate: d }),
  viewMode: (localStorage.getItem('u4view') as ViewMode) || 'deck',
  setViewMode: (v) => {
    try {
      localStorage.setItem('u4view', v)
    } catch { /* noop */ }
    set({ viewMode: v })
  },
  categoryFilter: null,
  setCategoryFilter: (c) => set({ categoryFilter: c }),

  // GS filter
  gsFilter: { 'GS 1': true, 'GS 2': true, 'GS 3': true, 'GS 4': false },
  setGsFilter: (f) => set({ gsFilter: f }),

  // News source toggles
  sourceFilter: loadSourceFilter(),
  toggleSource: (key) =>
    set((s) => {
      const next = { ...s.sourceFilter, [key]: !s.sourceFilter[key] }
      saveSourceFilter(next)
      return { sourceFilter: next }
    }),

  // GS focus (feed shows only this GS paper; cycles through the papers that
  // actually have stories that day, then back to "all")
  gsFocus: null,
  getFocusableGsPapers: (date) => {
    const { articlesByDate, gsFilter, categoryFilter, sourceFilter } = get()
    const papers = (['GS 1', 'GS 2', 'GS 3', 'GS 4'] as (keyof GSFilter)[])
    const present = new Set(
      (articlesByDate[date] ?? [])
        .filter((a) => gsFilter[a.gsPaper])
        .filter((a) => isSourceVisible(a.source, sourceFilter))
        .filter((a) => !categoryFilter || a.category === categoryFilter)
        .map((a) => a.gsPaper),
    )
    return papers.filter((p) => present.has(p))
  },
  cycleGsFocus: () =>
    set((s) => {
      const focusable = get().getFocusableGsPapers(s.selectedDate)
      if (focusable.length === 0) return { gsFocus: null }
      const cycle: (keyof GSFilter | null)[] = [null, ...focusable]
      const idx = cycle.findIndex((p) => p === s.gsFocus)
      return { gsFocus: cycle[(idx + 1) % cycle.length] }
    }),

  // Deep dive
  activeArticle: null,
  setActiveArticle: (a) => set({ activeArticle: a }),
  deepDiveReturnOverlay: null,
  setDeepDiveReturnOverlay: (s) => set({ deepDiveReturnOverlay: s }),

  // Helpers
  getArticlesForDate: (date) => {
    const { articlesByDate, gsFilter, categoryFilter, sourceFilter, gsFocus } = get()
    let articles = articlesByDate[date] ?? []
    // Apply GS filter
    articles = articles.filter((a) => gsFilter[a.gsPaper])
    // Apply news source toggles
    articles = articles.filter((a) => isSourceVisible(a.source, sourceFilter))
    // Apply category filter
    if (categoryFilter) {
      articles = articles.filter((a) => a.category === categoryFilter)
    }
    // Apply GS focus (feed shows only the currently focused GS paper)
    if (gsFocus) {
      articles = articles.filter((a) => a.gsPaper === gsFocus)
    }
    return articles
  },

  getAvailableDates: () => {
    const dates = Object.keys(get().articlesByDate)
    return dates.sort((a, b) => (a > b ? -1 : 1)) // newest first
  },
}))
