import { create } from 'zustand'
import type { Article, ArticlesByDate, GSFilter } from '@/types/article'
import { TODAY } from '@/constants/categories'

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

  // Deep dive
  activeArticle: null,
  setActiveArticle: (a) => set({ activeArticle: a }),
  deepDiveReturnOverlay: null,
  setDeepDiveReturnOverlay: (s) => set({ deepDiveReturnOverlay: s }),

  // Helpers
  getArticlesForDate: (date) => {
    const { articlesByDate, gsFilter, categoryFilter } = get()
    let articles = articlesByDate[date] ?? []
    // Apply GS filter
    articles = articles.filter((a) => gsFilter[a.gsPaper])
    // Apply category filter
    if (categoryFilter) {
      articles = articles.filter((a) => a.category === categoryFilter)
    }
    return articles
  },

  getAvailableDates: () => {
    const dates = Object.keys(get().articlesByDate)
    return dates.sort((a, b) => (a > b ? -1 : 1)) // newest first
  },
}))
