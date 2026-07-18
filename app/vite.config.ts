import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  // Relative base so the same build works from '/' (Vercel) and the '/penni/'
  // subpath (GitHub Pages). Runtime data fetches go through asset() (BASE_URL).
  base: "./",
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Large article, PYQ and map datasets are cached when their feature is
      // opened. Precaching data/** made a fresh install download geography
      // assets before a learner ever entered Maps Arcade.
      includeAssets: ['fonts/**', 'icons/**'],
      manifest: {
        name: 'Penni — UPSC Current Affairs',
        short_name: 'Penni',
        description:
          'Daily UPSC current-affairs briefings, previous year questions, and a geography maps arcade.',
        theme_color: '#7A7FC9',
        background_color: '#7A7FC9',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'en',
        categories: ['education', 'news'],
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Cache GeoJSON and article data for offline use
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        globIgnores: [
          '**/globe.gl-*.js',
          '**/AtlasGlobe-*.js',
          '**/MapsArcade-*.js',
          '**/NewsGlobe-*.js',
          '**/FeedCosmicGlobe-*.js',
        ],
        runtimeCaching: [
          {
            urlPattern: /\/data\/articles\/.+\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'articles-cache',
              expiration: { maxEntries: 90 },
            },
          },
          {
            // CMS-published snapshots (Supabase Storage). The rule above only
            // matches the bundled /data/ copies, so without this the CDN
            // responses would never be cached and an offline launch would
            // always fall back to whatever shipped in the build.
            // NetworkFirst, not StaleWhileRevalidate: an editor publishing a
            // correction expects the next open to show it, not the one after.
            urlPattern: /\/storage\/v1\/object\/public\/content\/.+\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cms-content-cache',
              expiration: { maxEntries: 90 },
              networkTimeoutSeconds: 4,
            },
          },
          {
            urlPattern: /\/loading-briefs\/latest\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'daily-loading-briefs',
              expiration: { maxEntries: 2 },
              networkTimeoutSeconds: 3,
            },
          },
          {
            urlPattern: /\/data\/(countries|india-(?:rivers|national|states)|pyq).+/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'geo-data-cache',
              expiration: { maxEntries: 10 },
              networkTimeoutSeconds: 4,
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
