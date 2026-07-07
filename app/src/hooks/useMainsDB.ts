// IndexedDB wrapper for Penni Mains evaluation records
// DB: 'penni', version 1, object store: 'mains', keyPath: 'ts'

export interface MainsRecord {
  ts: number
  qid: string
  qtext: string
  images: string[]          // base64 JPEG data URLs
  eval: MainsEval
}

export interface MainsEval {
  score: number
  max_score: number
  overall: string
  structure: string
  content_feedback: string
  missing_points: string[]
  value_addition: string[]
  intro_body_conclusion: string
  facts_examples: string
  language_presentation: string
  model_answer: string
  page_comments: { page: number; comments: string[] }[]
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open('penni', 1)
    r.onupgradeneeded = () => r.result.createObjectStore('mains', { keyPath: 'ts' })
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

export async function idbPut(rec: MainsRecord): Promise<void> {
  const db = await openDB()
  return new Promise((res, rej) => {
    const t = db.transaction('mains', 'readwrite')
    t.objectStore('mains').put(rec)
    t.oncomplete = () => res()
    t.onerror = () => rej(t.error)
  })
}

export async function idbAll(): Promise<MainsRecord[]> {
  try {
    const db = await openDB()
    return new Promise(res => {
      const q = db.transaction('mains').objectStore('mains').getAll()
      q.onsuccess = () => res(q.result ?? [])
    })
  } catch {
    return []
  }
}

export async function idbGet(ts: number): Promise<MainsRecord | undefined> {
  const db = await openDB()
  return new Promise(res => {
    const q = db.transaction('mains').objectStore('mains').get(ts)
    q.onsuccess = () => res(q.result)
  })
}
