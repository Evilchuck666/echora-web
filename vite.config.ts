/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        // The libraries in a chunk of their own: they change when they are updated, not with every change to the
        // app, so after a deploy browsers keep them and only fetch the app's code again.
        codeSplitting: { groups: [{ name: 'vendor', test: /node_modules/ }] },
      },
    },
  },
  // bun run preview serves the production build, which calls the API by path (/api/..., see .env.production), as it
  // does on the Echora server: pass those calls to the local API.
  preview: {
    proxy: { '/api': { target: 'https://localhost', changeOrigin: true, secure: false } },
  },
  // Unit tests (bun run test). The end-to-end tests in e2e/ run with Playwright (playwright.config.ts).
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'happy-dom',
    setupFiles: ['src/test/setup.ts'],
  },
})
