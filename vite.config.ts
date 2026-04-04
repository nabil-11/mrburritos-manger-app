/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    legacy()
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
  }
})
