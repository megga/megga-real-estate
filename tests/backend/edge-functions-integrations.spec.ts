// Contract tests for Edge Functions wrapping external integrations.
// Same minimal contract as edge-functions.spec.ts (auth + CORS + JSON)
// extended to Stripe, Calendar sync (Google/Outlook), and additional
// Resend transactional email functions.
//
// Webhook function (stripe-webhook) gets its own block — it's not
// auth-protected via JWT, it uses Stripe signature verification.

import { describe, it, expect } from 'vitest'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'

// Functions that follow the standard auth-required pattern
const AUTH_PROTECTED_FUNCTIONS = [
  // ── Stripe (user-initiated, JWT required) ──────────────────────────────
  'stripe-checkout',
  'stripe-portal',
  // ── Calendar sync (agent-initiated) ────────────────────────────────────
  'google-calendar-sync',
  'outlook-calendar-sync',
  // ── Additional Resend transactional emails ─────────────────────────────
  'send-property-email',
  'send-reminder-email',
  'send-relance-email',
  'send-team-invite',
  'send-visit-email',
  'magic-link-send-email',
  // ── Admin (super-admin only, JWT + AAL2 required) ──────────────────────
  'admin-stripe-agency-billing',
] as const

describe.skipIf(!HAS_KEYS)('Edge Functions contract — integrations', () => {
  for (const fn of AUTH_PROTECTED_FUNCTIONS) {
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
        expect(
          contentType.toLowerCase(),
          `${fn} returned non-JSON content-type "${contentType}"`
        ).toMatch(/application\/json/)
      })
    })
  }

  // ── stripe-webhook : special case (no JWT, Stripe signature instead) ────
  describe('stripe-webhook (signature-based, not JWT)', () => {
    const endpoint = `${URL}/functions/v1/stripe-webhook`

    it('rejects POST without stripe-signature header (400 or 401)', async () => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'test.event' }),
      })
      // Stripe webhook handler should reject anything without a valid signature.
      // 400 (Bad Request) or 401 (Unauthorized) are both acceptable.
      expect(
        res.status === 400 || res.status === 401,
        `stripe-webhook should reject unsigned payloads (got ${res.status})`
      ).toBe(true)
    })

    it('rejects POST with invalid stripe-signature header', async () => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'stripe-signature': 'invalid-signature-payload',
        },
        body: JSON.stringify({ type: 'test.event' }),
      })
      // Invalid signature → 400 (Stripe SDK throws Webhook.constructEvent error)
      expect(
        res.status === 400 || res.status === 401,
        `stripe-webhook should reject invalid signatures (got ${res.status})`
      ).toBe(true)
    })

    it('returns JSON (not HTML) for error responses', async () => {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const contentType = res.headers.get('content-type') ?? ''
      // Stripe webhook may return plain text "Webhook Error: ..." per Stripe convention.
      // Accept JSON OR plain text — what we DON'T want is HTML (runtime crash page).
      expect(
        contentType.toLowerCase(),
        `stripe-webhook returned non-API content-type "${contentType}"`
      ).toMatch(/application\/json|text\/plain/)
    })
  })
})

// Régression du trou « auth = préfixe Bearer seulement » sur les fonctions Resend
// AGENT-ONLY : elles ne vérifiaient que la présence de « Bearer » → un faux jeton
// déclenchait un envoi Resend réel (usurpation d'expéditeur megga.ch).
// requireAgentAuth valide désormais le JWT (auth.getUser) ET exige un profil agency_id.
// NB volontairement absentes : send-email (appelant anon légitime = form de contact
// public) et send-visit-email (appelant cron service_role) → durcissement différent.
const AGENT_ONLY_RESEND = ['send-relance-email', 'send-property-email'] as const

describe.skipIf(!HAS_KEYS)('Fonctions Resend agent-only — valident le JWT, pas juste le préfixe Bearer', () => {
  for (const fn of AGENT_ONLY_RESEND) {
    it(`${fn} rejette un Bearer falsifié (401, aucun envoi Resend)`, async () => {
      const res = await fetch(`${URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer not-a-real-jwt',
        },
        body: JSON.stringify({
          to: 'someone@example.com',
          subject: 'Test',
          body: 'Test body',
        }),
      })
      expect(
        res.status,
        `${fn}: un Bearer falsifié doit être rejeté avant tout envoi (got ${res.status})`
      ).toBe(401)
    })
  }
})
