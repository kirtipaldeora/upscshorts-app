import { useReducer, useCallback } from 'react'
import type { QuizState, QuizMode, QuizQuestion } from '@/types/quiz'

// ─── State & Actions ──────────────────────────────────────────
type Action =
  | { type: 'START_QUIZ'; mode: QuizMode; questions: QuizQuestion[]; topicLabel: string }
  | { type: 'SELECT_FEATURE'; featureId: string | number }
  | { type: 'NEXT_QUESTION' }
  | { type: 'RESET' }

const initialState: QuizState = {
  mode: 'home',
  phase: 'idle',
  questions: [],
  currentIndex: 0,
  score: 0,
  streak: 0,
  selectedFeatureId: null,
  isCorrect: null,
  topicLabel: '',
  tagline: 'Geography Quiz',
}

function reducer(state: QuizState, action: Action): QuizState {
  switch (action.type) {
    case 'START_QUIZ':
      return {
        ...initialState,
        mode: action.mode,
        phase: 'playing',
        questions: action.questions,
        topicLabel: action.topicLabel,
        tagline: action.topicLabel.toUpperCase(),
      }

    case 'SELECT_FEATURE': {
      if (state.phase !== 'playing') return state
      const current = state.questions[state.currentIndex]
      const isCorrect = action.featureId === current.targetFeatureId ||
        String(action.featureId) === String(current.targetFeatureId)
      return {
        ...state,
        phase: 'result',
        selectedFeatureId: action.featureId,
        isCorrect,
        score: isCorrect ? state.score + 1 : state.score,
        streak: isCorrect ? state.streak + 1 : 0,
      }
    }

    case 'NEXT_QUESTION': {
      const next = state.currentIndex + 1
      if (next >= state.questions.length) {
        return { ...state, phase: 'complete' }
      }
      return {
        ...state,
        phase: 'playing',
        currentIndex: next,
        selectedFeatureId: null,
        isCorrect: null,
      }
    }

    case 'RESET':
      return initialState

    default:
      return state
  }
}

// ─── Hook ─────────────────────────────────────────────────────
export function useMapQuiz() {
  const [state, dispatch] = useReducer(reducer, initialState)

  const startQuiz = useCallback(
    (mode: QuizMode, questions: QuizQuestion[], topicLabel: string) => {
      dispatch({ type: 'START_QUIZ', mode, questions, topicLabel })
    },
    []
  )

  const selectFeature = useCallback((featureId: string | number) => {
    dispatch({ type: 'SELECT_FEATURE', featureId })
  }, [])

  const nextQuestion = useCallback(() => {
    dispatch({ type: 'NEXT_QUESTION' })
  }, [])

  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])

  return { state, startQuiz, selectFeature, nextQuestion, reset }
}
