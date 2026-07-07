import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['fonts/**', 'icons/**', 'data/**'],
      manifest: {
        name: 'michi — UPSC Current Affairs',
        short_name: 'michi',
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
            urlPattern: /\/data\/(countries|india-rivers|india-national|pyq).+/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'geo-data-cache',
              expiration: { maxEntries: 10 },
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
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
