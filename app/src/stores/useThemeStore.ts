import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'
export type AppPalette = 'penni' | 'apricot' | 'turquoise' | 'lavender' | 'sage' | 'rose' | 'sky'
export type PaletteIntervalHours = 3 | 6 | 12

export const APP_PALETTES: Array<{ id: AppPalette; label: string; colors: [string, string, string] }> = [
  { id: 'penni', label: 'Penni', colors: ['#4b66d6', '#f0a43e', '#f4f1ea'] },
  { id: 'apricot', label: 'Apricot', colors: ['#d76a3a', '#f3a84f', '#fff1e3'] },
  { id: 'turquoise', label: 'Turquoise', colors: ['#168f8b', '#55c7ba', '#e6f7f3'] },
  { id: 'lavender', label: 'Lavender', colors: ['#7968bd', '#b9a8ea', '#f1edfb'] },
  { id: 'sage', label: 'Sage', colors: ['#648a6b', '#a9c49e', '#eef5e9'] },
  { id: 'rose', label: 'Rose', colors: ['#bd6078', '#e9a2b1', '#fbecef'] },
  { id: 'sky', label: 'Sky', colors: ['#397eaf', '#7bc4e8', '#eaf6fc'] },
]

interface ThemeStore {
  theme: Theme
  palette: AppPalette
  autoShufflePalette: boolean
  paletteIntervalHours: PaletteIntervalHours
  paletteChangedAt: number
  toggle: () => void
  setTheme: (t: Theme) => void
  setPalette: (palette: AppPalette) => void
  setAutoShufflePalette: (enabled: boolean) => void
  setPaletteIntervalHours: (hours: PaletteIntervalHours) => void
  randomizePalette: () => void
}

function applyTheme(t: Theme) {
  if (t === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

function applyPalette(palette: AppPalette) {
  document.documentElement.dataset.palette = palette
}

function randomPalette(current: AppPalette) {
  const choices = APP_PALETTES.map(item => item.id).filter(item => item !== current)
  return choices[Math.floor(Math.random() * choices.length)] ?? 'penni'
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      palette: 'penni',
      autoShufflePalette: false,
      paletteIntervalHours: 6,
      paletteChangedAt: Date.now(),
      toggle: () =>
        set((s) => {
          const next: Theme = s.theme === 'light' ? 'dark' : 'light'
          applyTheme(next)
          return { theme: next }
        }),
      setTheme: (t) => {
        applyTheme(t)
        set({ theme: t })
      },
      setPalette: (palette) => {
        applyPalette(palette)
        set({ palette, paletteChangedAt: Date.now() })
      },
      setAutoShufflePalette: (enabled) => set({ autoShufflePalette: enabled, paletteChangedAt: Date.now() }),
      setPaletteIntervalHours: (hours) => set({ paletteIntervalHours: hours, paletteChangedAt: Date.now() }),
      randomizePalette: () => set((state) => {
        const palette = randomPalette(state.palette)
        applyPalette(palette)
        return { palette, paletteChangedAt: Date.now() }
      }),
    }),
    {
      name: 'u4th', // Matches original localStorage key
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme)
          applyPalette(state.palette || 'penni')
        }
      },
    }
  )
)
