// ─── Map Quiz Types ───────────────────────────────────────────

export type QuizMode =
  | 'home'
  | 'india-states'
  | 'india-rivers'
  | 'india-national-parks'
  | 'world-countries'
  | 'india-capitals'

export type QuizPhase =
  | 'idle'        // home screen
  | 'playing'     // question active
  | 'result'      // answer revealed
  | 'complete'    // quiz finished

export interface QuizQuestion {
  id: string
  label: string         // The name to identify on map
  hint?: string         // Optional context hint
  targetFeatureId: string | number   // d3/topojson feature id
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
  geometry: unknown   // GeoJSON geometry
}

export type MapLayer = 'states' | 'rivers' | 'parks' | 'world'
