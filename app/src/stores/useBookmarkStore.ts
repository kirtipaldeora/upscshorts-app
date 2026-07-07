import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface BookmarkStore {
  bookmarkedIds: string[]
  toggle: (id: string) => void
  isBookmarked: (id: string) => boolean
  clearAll: () => void
}

export const useBookmarkStore = create<BookmarkStore>()(
  persist(
    (set, get) => ({
      bookmarkedIds: [],
      toggle: (id) =>
        set((s) => {
          const exists = s.bookmarkedIds.includes(id)
          return {
            bookmarkedIds: exists
              ? s.bookmarkedIds.filter((b) => b !== id)
              : [...s.bookmarkedIds, id],
          }
        }),
      isBookmarked: (id) => get().bookmarkedIds.includes(id),
      clearAll: () => set({ bookmarkedIds: [] }),
    }),
    {
      name: 'u4bm', // Matches original localStorage key
    }
  )
)
