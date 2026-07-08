import { useReducer, useCallback } from 'react'
import type { AtlasState, AtlasScreen, AtlasCategory, AtlasPlayMode, QuizItem, Choice, Toast } from '@/types/quiz'
import { CONT_DATA, RIVERS, RIVER_SYSTEMS } from './atlasData'

// ─── Initial State ────────────────────────────────────────────────────────────

const INITIAL: AtlasState = {
  screen: 'home',
  sound: true,
  category: null,
  continent: null,
  riverSystem: null,
  parkRegion: null,
  parkLearnState: null,
  playMode: 'locate',
  setupCount: 10,
  queue: [],
  qIndex: 0,
  target: null,
  choices: [],
  score: 0,
  streak: 0,
  combo: 1,
  correctCount: 0,
  wrongList: [],
  answerHistory: [],
  hintsLeft: 3,
  hintUsedThisRound: false,
  hintRemovedId: null,
  answeredThisRound: false,
  toast: null,
  loading: false,
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'SET_SCREEN'; screen: AtlasScreen }
  | { type: 'SET_CATEGORY'; category: AtlasCategory }
  | { type: 'SET_CONTINENT'; continent: string }
  | { type: 'SET_RIVER_SYSTEM'; key: string }
  | { type: 'SET_PARK_REGION'; key: string | null }
  | { type: 'SET_PARK_LEARN_STATE'; state: string | null }
  | { type: 'SET_PLAY_MODE'; mode: AtlasPlayMode }
  | { type: 'SET_SETUP_COUNT'; count: number }
  | { type: 'SET_PARKS'; parks: QuizItem[] }
  | { type: 'TOGGLE_SOUND' }
  | { type: 'START_PLAY'; queue: QuizItem[] }
  | { type: 'ANSWER'; id: string | number }
  | { type: 'NEXT_QUESTION' }
  | { type: 'PREVIOUS_QUESTION' }
  | { type: 'SKIP' }
  | { type: 'HINT' }
  | { type: 'PRACTICE_WRONG' }
  | { type: 'RESTART' }
  | { type: 'MENU' }
  | { type: 'HOME' }
  | { type: 'CLEAR_TOAST' }
  | { type: 'SET_LOADING'; loading: boolean }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function buildChoices(target: QuizItem, pool: QuizItem[], removed: string | number | null): Choice[] {
  const others = shuffle(pool.filter(q => String(q.id) !== String(target.id))).slice(0, 2)
  const all = shuffle([target, ...others])
  return all
    .filter(q => String(q.id) !== String(removed))
    .map(q => ({ id: q.id, name: q.name }))
}

function comboFor(streak: number): number {
  if (streak >= 6) return 3
  if (streak >= 3) return 2
  return 1
}

function makeToast(kind: Toast['kind'], text: string): Toast {
  return { kind, text }
}

function nextRoundState(state: AtlasState, nextIdx: number): Partial<AtlasState> {
  const target = state.queue[nextIdx]
  if (!target) return {}
  const choices = state.playMode === 'name'
    ? buildChoices(target, state.queue, null)
    : []
  return {
    qIndex: nextIdx,
    target,
    choices,
    answeredThisRound: false,
    hintUsedThisRound: false,
    hintRemovedId: null,
    toast: null,
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state: AtlasState, action: Action): AtlasState {
  switch (action.type) {

    case 'SET_SCREEN':
      return { ...state, screen: action.screen, toast: null }

    case 'SET_CATEGORY':
      return { ...state, category: action.category, toast: null }

    case 'SET_CONTINENT':
      return { ...state, continent: action.continent }

    case 'SET_RIVER_SYSTEM':
      return { ...state, riverSystem: action.key }

    case 'SET_PARK_REGION':
      return { ...state, parkRegion: action.key }

    case 'SET_PARK_LEARN_STATE':
      return { ...state, parkLearnState: action.state }

    case 'SET_PLAY_MODE':
      return { ...state, playMode: action.mode }

    case 'SET_SETUP_COUNT':
      return { ...state, setupCount: action.count }

    case 'SET_PARKS':
      // parks are loaded dynamically — just store them (used by MapsArcade component)
      return state

    case 'TOGGLE_SOUND':
      return { ...state, sound: !state.sound }

    case 'SET_LOADING':
      return { ...state, loading: action.loading }

    case 'START_PLAY': {
      const target = action.queue[0]
      const choices = state.playMode === 'name'
        ? buildChoices(target, action.queue, null)
        : []
      return {
        ...state,
        screen: 'play',
        queue: action.queue,
        qIndex: 0,
        target,
        choices,
        score: 0,
        streak: 0,
        combo: 1,
        correctCount: 0,
        wrongList: [],
        answerHistory: [],
        hintsLeft: 3,
        hintUsedThisRound: false,
        hintRemovedId: null,
        answeredThisRound: false,
        toast: null,
      }
    }

    case 'ANSWER': {
      if (state.answeredThisRound || !state.target) return state
      const isCorrect = String(action.id) === String(state.target.id)
      const newStreak = isCorrect ? state.streak + 1 : 0
      const combo = comboFor(newStreak)
      const points = isCorrect ? combo * (state.hintUsedThisRound ? 1 : 1) : 0
      const toast = makeToast(
        isCorrect ? 'correct' : 'wrong',
        isCorrect
          ? combo > 1 ? `✓ Correct! ×${combo} combo!` : '✓ Correct!'
          : `✗ That was ${state.target.name}`,
      )
      return {
        ...state,
        answeredThisRound: true,
        score: state.score + points,
        streak: newStreak,
        combo,
        correctCount: isCorrect ? state.correctCount + 1 : state.correctCount,
        wrongList: isCorrect ? state.wrongList : [...state.wrongList, state.target],
        answerHistory: [...state.answerHistory, isCorrect],
        toast,
      }
    }

    case 'NEXT_QUESTION': {
      const next = state.qIndex + 1
      if (next >= state.queue.length) return { ...state, screen: 'results', toast: null }
      return { ...state, ...nextRoundState(state, next) }
    }

    case 'PREVIOUS_QUESTION': {
      if (state.qIndex === 0) return state
      return { ...state, ...nextRoundState(state, state.qIndex - 1) }
    }

    case 'SKIP': {
      const skipped = state.target!
      const next = state.qIndex + 1
      const newHistory = [...state.answerHistory, false]
      const newWrong = [...state.wrongList, skipped]
      if (next >= state.queue.length) {
        return { ...state, screen: 'results', answerHistory: newHistory, wrongList: newWrong, streak: 0, combo: 1, toast: null }
      }
      return {
        ...state,
        ...nextRoundState(state, next),
        answerHistory: newHistory,
        wrongList: newWrong,
        streak: 0,
        combo: 1,
      }
    }

    case 'HINT': {
      if (state.hintsLeft <= 0 || state.hintUsedThisRound || state.playMode !== 'name') return state
      // Remove one wrong choice from MCQ
      const wrong = state.choices.filter(c => String(c.id) !== String(state.target?.id))
      const toRemove = wrong[Math.floor(Math.random() * wrong.length)]
      const newChoices = state.choices.filter(c => String(c.id) !== String(toRemove?.id))
      return {
        ...state,
        hintsLeft: state.hintsLeft - 1,
        hintUsedThisRound: true,
        hintRemovedId: toRemove?.id ?? null,
        choices: newChoices,
        toast: makeToast('hint', `💡 One wrong answer removed. ${state.hintsLeft - 1} hints left.`),
      }
    }

    case 'PRACTICE_WRONG': {
      if (!state.wrongList.length) return state
      const queue = shuffle(state.wrongList)
      const target = queue[0]
      const choices = state.playMode === 'name' ? buildChoices(target, queue, null) : []
      return {
        ...state,
        screen: 'play',
        queue,
        qIndex: 0,
        target,
        choices,
        score: 0,
        streak: 0,
        combo: 1,
        correctCount: 0,
        wrongList: [],
        answerHistory: [],
        hintsLeft: 3,
        hintUsedThisRound: false,
        hintRemovedId: null,
        answeredThisRound: false,
        toast: null,
      }
    }

    case 'RESTART': {
      const queue = shuffle(state.queue)
      const target = queue[0]
      const choices = state.playMode === 'name' ? buildChoices(target, queue, null) : []
      return {
        ...state,
        screen: 'play',
        queue,
        qIndex: 0,
        target,
        choices,
        score: 0,
        streak: 0,
        combo: 1,
        correctCount: 0,
        wrongList: [],
        answerHistory: [],
        hintsLeft: 3,
        hintUsedThisRound: false,
        hintRemovedId: null,
        answeredThisRound: false,
        toast: null,
      }
    }

    case 'MENU': {
      // Go back to the appropriate menu for the current category
      const screen: AtlasScreen =
        state.category === 'world' ? (state.continent ? 'setup' : 'worldMenu') :
        state.category === 'india-rivers' ? 'riverSystems' :
        state.category === 'india-parks' ? 'parkRegions' :
        'home'
      return { ...state, screen, toast: null }
    }

    case 'HOME':
      return { ...INITIAL }

    case 'CLEAR_TOAST':
      return { ...state, toast: null }

    default:
      return state
  }
}

// ─── Public helpers ───────────────────────────────────────────────────────────

function buildWorldQueue(continent: string, count: number): QuizItem[] {
  const entries = CONT_DATA[continent] ?? []
  const items: QuizItem[] = entries.map(([id, name]) => ({ id, name, continent }))
  return shuffle(items).slice(0, Math.min(count, items.length))
}

function buildRiverQueue(systemKey: string, count: number): QuizItem[] {
  const sys = RIVER_SYSTEMS.find(s => s.key === systemKey)
  if (!sys) return []
  const items: QuizItem[] = RIVERS.filter(r => r.sys === systemKey).map(r => ({
    id: r.id,
    name: r.name,
    sys: r.sys,
    src: r.src,
  }))
  return shuffle(items).slice(0, Math.min(count, items.length))
}

function buildParkQueue(parks: QuizItem[], count: number): QuizItem[] {
  return shuffle(parks).slice(0, Math.min(count, parks.length))
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAtlasArcade() {
  const [state, dispatch] = useReducer(reducer, INITIAL)

  const goHome = useCallback(() => dispatch({ type: 'HOME' }), [])
  const goScreen = useCallback((screen: AtlasScreen) => dispatch({ type: 'SET_SCREEN', screen }), [])
  const toggleSound = useCallback(() => dispatch({ type: 'TOGGLE_SOUND' }), [])
  const setPlayMode = useCallback((mode: AtlasPlayMode) => dispatch({ type: 'SET_PLAY_MODE', mode }), [])
  const setSetupCount = useCallback((count: number) => dispatch({ type: 'SET_SETUP_COUNT', count }), [])

  const pickWorld = useCallback(() => {
    dispatch({ type: 'SET_CATEGORY', category: 'world' })
    dispatch({ type: 'SET_SCREEN', screen: 'worldMenu' })
  }, [])

  const pickIndia = useCallback(() => {
    dispatch({ type: 'SET_CATEGORY', category: 'india-rivers' })
    dispatch({ type: 'SET_SCREEN', screen: 'indiaMenu' })
  }, [])

  const pickContinent = useCallback((continent: string) => {
    dispatch({ type: 'SET_CONTINENT', continent })
    dispatch({ type: 'SET_SCREEN', screen: 'setup' })
  }, [])

  const pickRivers = useCallback(() => {
    dispatch({ type: 'SET_CATEGORY', category: 'india-rivers' })
    dispatch({ type: 'SET_SCREEN', screen: 'riverSystems' })
  }, [])

  const pickParks = useCallback(() => {
    dispatch({ type: 'SET_CATEGORY', category: 'india-parks' })
    dispatch({ type: 'SET_SCREEN', screen: 'parkRegions' })
  }, [])

  const pickRiverSystem = useCallback((key: string) => {
    dispatch({ type: 'SET_RIVER_SYSTEM', key })
    dispatch({ type: 'SET_SCREEN', screen: 'setup' })
  }, [])

  const pickParkRegion = useCallback((key: string | null) => {
    dispatch({ type: 'SET_PARK_REGION', key })
    dispatch({ type: 'SET_SCREEN', screen: 'setup' })
  }, [])

  const pickParkLearn = useCallback((regionKey: string) => {
    dispatch({ type: 'SET_PARK_REGION', key: regionKey })
    dispatch({ type: 'SET_SCREEN', screen: 'parkLearn' })
  }, [])

  const setParkLearnState = useCallback((s: string | null) => {
    dispatch({ type: 'SET_PARK_LEARN_STATE', state: s })
  }, [])

  const startPlay = useCallback((extraParks?: QuizItem[]) => {
    let queue: QuizItem[] = []
    const { category, continent, riverSystem, parkRegion, setupCount, playMode } = state

    if (category === 'world' && continent) {
      queue = buildWorldQueue(continent, setupCount)
    } else if (category === 'india-rivers' && riverSystem) {
      queue = buildRiverQueue(riverSystem, setupCount)
    } else if (category === 'india-parks' && extraParks) {
      queue = buildParkQueue(extraParks, setupCount)
      void parkRegion // used for filtering before passing in
    }

    if (!queue.length) return
    // For name mode, require at least 3 items
    if (playMode === 'name' && queue.length < 3) {
      queue = [...queue, ...shuffle(queue)].slice(0, Math.max(3, queue.length))
    }
    dispatch({ type: 'START_PLAY', queue })
  }, [state])

  const answer = useCallback((id: string | number) => dispatch({ type: 'ANSWER', id }), [])
  const nextQuestion = useCallback(() => dispatch({ type: 'NEXT_QUESTION' }), [])
  const previousQuestion = useCallback(() => dispatch({ type: 'PREVIOUS_QUESTION' }), [])
  const skip = useCallback(() => dispatch({ type: 'SKIP' }), [])
  const hint = useCallback(() => dispatch({ type: 'HINT' }), [])
  const practiceWrong = useCallback(() => dispatch({ type: 'PRACTICE_WRONG' }), [])
  const restart = useCallback(() => dispatch({ type: 'RESTART' }), [])
  const menu = useCallback(() => dispatch({ type: 'MENU' }), [])
  const clearToast = useCallback(() => dispatch({ type: 'CLEAR_TOAST' }), [])

  return {
    state,
    goHome, goScreen, toggleSound,
    setPlayMode, setSetupCount,
    pickWorld, pickIndia,
    pickContinent,
    pickRivers, pickParks,
    pickRiverSystem, pickParkRegion, pickParkLearn, setParkLearnState,
    startPlay,
    answer, nextQuestion, previousQuestion, skip, hint,
    practiceWrong, restart, menu,
    clearToast,
  }
}
