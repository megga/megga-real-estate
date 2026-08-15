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
    // Allowlist explicite (et non un glob) pour _shared : certains modules edge tirent des
    // imports Deno `https:` que le loader ESM de Node ne sait pas résoudre. Seuls les specs
    // dont le module se charge sous Node sont listés ici — un spec _shared absent de cette
    // liste ne tourne NULLE PART (la CI type-check les edge functions via `deno check` mais
    // exclut les *.test.ts, et n'exécute pas `deno test`). Y penser en ajoutant un spec.
    include: ['tests/unit/**/*.{spec,test}.{ts,tsx}', 'supabase/functions/_shared/whatsapp-gateway.test.ts', 'supabase/functions/_shared/whatsapp-retry.test.ts', 'supabase/functions/_shared/whatsapp-templates.test.ts', 'supabase/functions/_shared/whatsapp-agent-router.test.ts', 'supabase/functions/_shared/whatsapp-media.test.ts', 'supabase/functions/_shared/whatsapp-transcribe.test.ts', 'supabase/functions/_shared/whatsapp-comprehend.test.ts', 'supabase/functions/_shared/whatsapp-lead.test.ts', 'supabase/functions/_shared/vision.test.ts', 'supabase/functions/_shared/whatsapp-format.test.ts', 'supabase/functions/_shared/kyc-extract.test.ts', 'supabase/functions/_shared/kyb-id-read.test.ts', 'supabase/functions/_shared/kyb-identity-stripe.test.ts', 'supabase/functions/_shared/whatsapp-i18n.test.ts', 'supabase/functions/_shared/whatsapp-stop-keywords.test.ts', 'supabase/functions/_shared/whatsapp-outbound-guard.test.ts', 'supabase/functions/_shared/whatsapp-optin.test.ts', 'supabase/functions/_shared/whatsapp-optin-send.test.ts', 'supabase/functions/_shared/email-guard.test.ts', 'supabase/functions/_shared/magic-link-token.test.ts', 'supabase/functions/_shared/cf-browser-render.test.ts', 'supabase/functions/_shared/agent-style.test.ts', 'supabase/functions/_shared/rent-reference.test.ts', 'supabase/functions/_shared/megga-prose.test.ts', 'supabase/functions/_shared/morning-brief.test.ts', 'supabase/functions/_shared/copilot-persistence.test.ts', 'supabase/functions/_shared/ai-copilot-request.test.ts', 'supabase/functions/_shared/kyc-screening-core.test.ts', 'supabase/functions/_shared/idx-mapper.test.ts', 'supabase/functions/_shared/whatsapp-followups.test.ts', 'supabase/functions/_shared/whatsapp-followup-draft.test.ts', 'supabase/functions/_shared/whatsapp-token.test.ts', 'supabase/functions/_shared/whatsapp-config.test.ts', 'supabase/functions/_shared/esign-finalize.test.ts', 'supabase/functions/_shared/esign-gateway.test.ts', 'supabase/functions/_shared/copilot-market.test.ts', 'supabase/functions/_shared/copilot-redaction.test.ts', 'supabase/functions/_shared/agent-loop.test.ts', 'supabase/functions/_shared/copilot-tools.test.ts', 'supabase/functions/_shared/knowledge-retrieval.test.ts', 'supabase/functions/_shared/pseudonymize.test.ts', 'supabase/functions/_shared/daily-brief.test.ts', 'supabase/functions/_shared/radar-detectors.test.ts', 'supabase/functions/_shared/weekly-digest.test.ts', 'supabase/functions/_shared/photo-staging.test.ts', 'supabase/functions/_shared/ai-usage.test.ts', 'supabase/functions/_shared/contact-nba.test.ts', 'supabase/functions/_shared/agent-system-prompt.test.ts', 'supabase/functions/_shared/wa-agent-redaction.test.ts', 'supabase/functions/_shared/contact-memory.test.ts', 'supabase/functions/_shared/pii-redaction.test.ts', 'supabase/functions/_shared/audit-edge-error.test.ts', 'supabase/functions/_shared/whatsapp-doc-prompt.test.ts', 'supabase/functions/_shared/npa.test.ts', 'supabase/functions/_shared/ra-slice-resolution.test.ts', 'supabase/functions/_shared/agency-lab-guard.test.ts', 'supabase/functions/_shared/bearer-token.test.ts', 'supabase/functions/_shared/booking-slots.test.ts', 'supabase/functions/_shared/onboarding-slots.test.ts', 'supabase/functions/_shared/client-ip.test.ts', 'supabase/functions/_shared/require-service-secret.test.ts'],
    exclude: ['node_modules', 'dist', 'tests/e2e/**', 'tests/e2e-admin/**'],
    css: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
