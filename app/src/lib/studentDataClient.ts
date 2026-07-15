import { getSupabase } from '@/lib/authClient'
import { useBookmarkStore } from '@/stores/useBookmarkStore'
import { usePracticeStore, type PracticeSettings, type PracticeStats } from '@/stores/usePracticeStore'

interface StudentStateRow {
  practice_stats: PracticeStats
  practice_settings: PracticeSettings
  article_bookmarks: string[]
  question_bookmarks: string[]
  mains_quota: Record<string, number>
}

function snapshot(): StudentStateRow {
  const practice = usePracticeStore.getState()
  return {
    practice_stats: practice.stats,
    practice_settings: practice.settings,
    article_bookmarks: useBookmarkStore.getState().bookmarkedIds,
    question_bookmarks: practice.questionBookmarks,
    mains_quota: practice.mainsQuota,
  }
}

async function persist(userId: string) {
  const supabase = getSupabase()
  if (!supabase) return
  const { error } = await supabase.from('student_state').upsert({
    user_id: userId,
    ...snapshot(),
  })
  if (error) throw error
}

/** Load cloud state once, or seed it from this device on the user's first login. */
export async function prepareStudentState(userId: string) {
  const supabase = getSupabase()
  if (!supabase) return
  const { data, error } = await supabase
    .from('student_state')
    .select('practice_stats,practice_settings,article_bookmarks,question_bookmarks,mains_quota')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  if (!data) {
    await persist(userId)
    return
  }

  const row = data as StudentStateRow
  usePracticeStore.getState().hydrateCloudState({
    stats: row.practice_stats,
    settings: row.practice_settings,
    questionBookmarks: Array.isArray(row.question_bookmarks) ? row.question_bookmarks : [],
    mainsQuota: row.mains_quota,
  })
  useBookmarkStore.getState().replaceAll(Array.isArray(row.article_bookmarks) ? row.article_bookmarks : [])
}

/** Debounced writes keep normal practice interactions responsive. */
export function startStudentStateSync(userId: string) {
  let timer: number | undefined
  let last = JSON.stringify(snapshot())
  let stopped = false

  const queue = () => {
    const next = JSON.stringify(snapshot())
    if (next === last) return
    last = next
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (stopped) return
      void persist(userId).catch((error) => {
        console.error('Penni cloud sync failed', error)
      })
    }, 700)
  }

  const stopPractice = usePracticeStore.subscribe(queue)
  const stopBookmarks = useBookmarkStore.subscribe(queue)
  return () => {
    stopped = true
    window.clearTimeout(timer)
    stopPractice()
    stopBookmarks()
  }
}
