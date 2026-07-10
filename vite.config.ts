/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

// CSS is compiled by PostCSS (see postcss.config.js): Tailwind v4 generates the
// stylesheet, then the CSSTools plugins flatten @layer and lower oklch()/
// color-mix() to rgb so the build works in older Android WebViews.

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    legacy(),
  ],
  optimizeDeps: {
    // Capacitor packages are native-only — exclude them from Vite's optimizer
    // to prevent "file does not exist" errors after dep re-optimization
    exclude: [
      '@capacitor/core',
      '@capacitor/haptics',
      '@capacitor/push-notifications',
      '@capacitor/app',
      '@capacitor/keyboard',
      '@capacitor/status-bar',
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
  },
})
