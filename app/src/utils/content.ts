import { asset } from './asset'

/**
 * Where published content comes from.
 *
 * Editors publish snapshots from the CMS to a public Supabase Storage bucket;
 * this points at it. The JSON there is byte-identical in shape to the copy in
 * public/data — only the origin differs, so nothing downstream changes.
 *
 * Unset (no VITE_CONTENT_BASE) means the app behaves exactly as it did before
 * the CMS existed: everything reads from the bundled files.
 */
const BASE = (import.meta.env.VITE_CONTENT_BASE as string | undefined)?.replace(/\/$/, '')

export function isRemoteContentEnabled() {
  return Boolean(BASE)
}

/** The bundled copy that ships inside the web build and the native binary. */
export function bundledContentUrl(path: string): string {
  return asset(`data/${path.replace(/^\//, '')}`)
}

/**
 * Fetch a published content file, preferring the CMS and falling back to the
 * bundled copy.
 *
 * The fallback is what makes this safe to turn on: a bad publish, an expired
 * bucket, or a plane flight all degrade to the JSON compiled into the app
 * rather than to an empty feed. It matters most on iOS/Android, where
 * public/data is baked into the binary and is the only content a cold,
 * offline install has.
 */
export async function fetchContent<T>(path: string, init?: RequestInit): Promise<T> {
  if (BASE) {
    try {
      const response = await fetch(`${BASE}/${path.replace(/^\//, '')}`, init)
      if (response.ok) return (await response.json()) as T
      // Any non-OK status (404 for a date never published, 5xx) falls through
      // to the bundled copy below.
    } catch (error) {
      // A caller-initiated abort is not a failure to route around — the caller
      // has moved on and expects the rejection.
      if ((error as Error)?.name === 'AbortError') throw error
    }
  }

  const response = await fetch(bundledContentUrl(path), init)
  if (!response.ok) throw new Error(`No data for ${path}`)
  return (await response.json()) as T
}
