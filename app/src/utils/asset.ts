/**
 * Prefix a public-directory path with the app's base URL so runtime fetches
 * resolve correctly whether the app is served from '/' (Vercel) or a subpath
 * like '/penni/' (GitHub Pages). Vite does NOT rewrite absolute public paths
 * for a non-root base, so these must be built at runtime from BASE_URL.
 */
export const asset = (path: string): string =>
  import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
