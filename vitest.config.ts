import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

// Vitest config — frontend unit/component tests.
// Distinct from Playwright (E2E browser tests in tests/e2e/, tests/e2e-admin/).
// Run with `npm run test:unit`.

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['tests/unit/**/*.{spec,test}.{ts,tsx}', 'supabase/functions/_shared/**/*.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**', 'tests/e2e-admin/**', 'tests/ai/**'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
