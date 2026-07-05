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
    include: ['tests/unit/**/*.{spec,test}.{ts,tsx}', 'supabase/functions/_shared/whatsapp-gateway.test.ts', 'supabase/functions/_shared/whatsapp-agent-router.test.ts', 'supabase/functions/_shared/whatsapp-media.test.ts', 'supabase/functions/_shared/whatsapp-transcribe.test.ts', 'supabase/functions/_shared/whatsapp-comprehend.test.ts', 'supabase/functions/_shared/whatsapp-lead.test.ts', 'supabase/functions/_shared/vision.test.ts', 'supabase/functions/_shared/whatsapp-format.test.ts', 'supabase/functions/_shared/kyc-extract.test.ts', 'supabase/functions/_shared/whatsapp-i18n.test.ts', 'supabase/functions/_shared/magic-link-token.test.ts', 'supabase/functions/_shared/cf-browser-render.test.ts', 'supabase/functions/_shared/agent-style.test.ts', 'supabase/functions/_shared/rent-reference.test.ts', 'supabase/functions/_shared/megga-prose.test.ts', 'supabase/functions/_shared/copilot-persistence.test.ts', 'supabase/functions/_shared/ai-copilot-request.test.ts', 'supabase/functions/_shared/kyc-screening-core.test.ts', 'supabase/functions/_shared/idx-mapper.test.ts', 'supabase/functions/_shared/whatsapp-followups.test.ts', 'supabase/functions/_shared/whatsapp-token.test.ts', 'supabase/functions/_shared/whatsapp-config.test.ts', 'supabase/functions/_shared/esign-finalize.test.ts', 'supabase/functions/_shared/copilot-market.test.ts', 'supabase/functions/_shared/copilot-redaction.test.ts', 'supabase/functions/_shared/agent-loop.test.ts', 'supabase/functions/_shared/copilot-tools.test.ts', 'supabase/functions/_shared/knowledge-retrieval.test.ts', 'supabase/functions/_shared/pseudonymize.test.ts', 'supabase/functions/_shared/daily-brief.test.ts', 'supabase/functions/_shared/radar-detectors.test.ts', 'supabase/functions/_shared/weekly-digest.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**', 'tests/e2e-admin/**', 'tests/ai/**'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
