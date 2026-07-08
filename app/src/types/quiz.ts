// ─── Atlas Arcade Types ───────────────────────────────────────

export type QuizMode =
  | 'home'
  | 'india-states'
  | 'india-rivers'
  | 'india-national-parks'
  | 'world-countries'
  | 'india-capitals'

export type AtlasScreen =
  | 'home'
  | 'worldMenu'
  | 'indiaMenu'
  | 'riverSystems'
  | 'parkRegions'
  | 'parkLearn'
  | 'setup'
  | 'play'
  | 'results'

export type AtlasCategory = 'world' | 'india-rivers' | 'india-parks'
export type AtlasPlayMode = 'locate' | 'name'

export interface Choice {
  id: string | number
  name: string
}

export interface Toast {
  kind: 'correct' | 'wrong' | 'hint'
  text: string
}

export interface QuizItem {
  id: string | number
  name: string
  continent?: string
  region?: string
  state?: string
  sys?: string            // river system key
  parkRegion?: string     // park region key
  lon?: number
  lat?: number
  src?: { type: string; name: string; place: string }
}

export interface AtlasState {
  screen: AtlasScreen
  sound: boolean
  category: AtlasCategory | null
  continent: string | null
  riverSystem: string | null
  parkRegion: string | null
  parkLearnState: string | null
  playMode: AtlasPlayMode
  setupCount: number
  queue: QuizItem[]
  qIndex: number
  target: QuizItem | null
  choices: Choice[]
  score: number
  streak: number
  combo: number             // 1, 2, or 3
  correctCount: number
  wrongList: QuizItem[]
  answerHistory: boolean[]  // true=correct, false=wrong
  hintsLeft: number
  hintUsedThisRound: boolean
  hintRemovedId: string | number | null
  answeredThisRound: boolean
  chosenId: string | number | null
  sourceInfo: QuizItem['src'] | null
  toast: Toast | null
  loading: boolean
}

// ─── Legacy quiz types (kept for any remaining code that uses them) ───────────

export type QuizPhase =
  | 'idle'
  | 'playing'
  | 'result'
  | 'complete'

export interface QuizQuestion {
  id: string
  label: string
  hint?: string
  targetFeatureId: string | number
}

export interface QuizState {
  mode: QuizMode
  phase: QuizPhase
  questions: QuizQuestion[]
  currentIndex: number
  score: number
  streak: number
  selectedFeatureId: string | number | null
  isCorrect: boolean | null
  topicLabel: string
  tagline: string
}

export interface MapFeature {
  id: string | number
  name: string
  geometry: unknown
}

export type MapLayer = 'states' | 'rivers' | 'parks' | 'world'
