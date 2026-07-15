import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

// The admin app deploys as its own Vercel project but lives in the Penni repo
// so it can import Penni's content types directly — the Article interface is
// the contract between the two, and a copy would drift.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@penni': resolve(__dirname, '../app/src'),
    },
  },
  server: {
    port: 5174,
    // Allow importing from ../app/src (outside this app's root).
    fs: { allow: [resolve(__dirname, '..')] },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
