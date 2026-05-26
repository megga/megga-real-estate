// Contract tests for 4 critical Edge Functions.
//
// Scope: validates that each function is reachable, returns proper HTTP
// codes for missing auth, and handles CORS preflight correctly. Does NOT
// test the business logic — that would require mocking external APIs
// (Anthropic, Dilisense, Resend) and a more elaborate setup. The point
// here is to catch obvious regressions: someone breaks the deployment,
// changes the auth gateway, or accidentally returns HTML instead of JSON.
//
// Functions covered:
//   - ai-copilot     : Claude chat + structured actions (requires ANTHROPIC_API_KEY)
//   - kyc-screening  : Dilisense PEP/sanctions check (requires DILISENSE_API_KEY)
//   - send-email     : Resend transactional email (requires RESEND_API_KEY)
//   - detect-new-device : device fingerprinting + Resend alert
//
// All run against the LOCAL Supabase functions runtime (port 54321).

import { describe, it, expect } from 'vitest'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

const FUNCTIONS = [
  'ai-copilot',
  'kyc-screening',
  'send-email',
  'detect-new-device',
] as const

describe.skipIf(!HAS_KEYS)('Edge Functions contract', () => {
  for (const fn of FUNCTIONS) {
    describe(fn, () => {
      const endpoint = `${URL}/functions/v1/${fn}`

      it('rejects POST without Authorization header (401)', async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        expect(
          res.status,
          `${fn} should require auth (got ${res.status})`
        ).toBe(401)
      })

      it('handles CORS preflight (OPTIONS returns 2xx)', async () => {
        const res = await fetch(endpoint, {
          method: 'OPTIONS',
          headers: {
            'Origin': 'https://megga.ch',
            'Access-Control-Request-Method': 'POST',
            'Access-Control-Request-Headers': 'authorization, content-type',
          },
        })
        // Supabase gateway returns 200 with full CORS headers, or 204 No Content.
        // Either is acceptable — what matters is that the preflight succeeds so
        // the actual POST from a browser can proceed.
        expect(
          res.status >= 200 && res.status < 300,
          `${fn} CORS preflight should be 2xx (got ${res.status})`
        ).toBe(true)
      })

      it('returns JSON (not HTML) for error responses', async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        })
        const contentType = res.headers.get('content-type') ?? ''
        // We expect JSON for errors — not HTML (which would mean a misconfigured
        // gateway or a crashed runtime returning a generic error page).
        expect(
          contentType.toLowerCase(),
          `${fn} returned non-JSON content-type "${contentType}" for error response`
        ).toMatch(/application\/json/)
      })
    })
  }
})
