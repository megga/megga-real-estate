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
    // Only whatsapp-gateway from _shared runs under Node/Vitest (Web Crypto only).
    // Other _shared modules (e.g. pii-redaction) use Deno https: imports that the
    // Node ESM loader can't resolve — they must NOT be globbed into the unit run.
    include: ['tests/unit/**/*.{spec,test}.{ts,tsx}', 'supabase/functions/_shared/whatsapp-gateway.test.ts', 'supabase/functions/_shared/whatsapp-agent-router.test.ts', 'supabase/functions/_shared/whatsapp-media.test.ts', 'supabase/functions/_shared/whatsapp-transcribe.test.ts', 'supabase/functions/_shared/whatsapp-comprehend.test.ts', 'supabase/functions/_shared/whatsapp-lead.test.ts', 'supabase/functions/_shared/vision.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**', 'tests/e2e-admin/**', 'tests/ai/**'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
