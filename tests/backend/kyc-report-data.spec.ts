// Backend integration spec for the `kyc-report-data` Edge Function.
//
// Tests three tiers:
//   1. Baseline contract — OPTIONS (CORS) / missing token (400) / bad signature (401).
//      These do NOT require the HMAC secret and ALWAYS run when Supabase keys are set.
//   2. Full token path — valid token → 200 with correct report shape; expired → 401.
//      Requires MEGGA_MAGIC_LINK_HMAC_SECRET to be set (both here and in the edge
//      runtime via config.toml [edge_runtime.secrets]).  Gated on the env var presence.
//   3. Agency scope — the report's agency_id matches the dossier's own agency,
//      proving no cross-agency substitution is possible via the token.
//
// Secret wiring:
//   - `config.toml` [edge_runtime.secrets] maps the env var into the local runtime.
//   - `backend.yml` job-level `env:` sets the fixed test value before `supabase start`
//     so the runtime receives it on boot.
//   - This spec shims globalThis.Deno in beforeAll() before importing signMagicLinkToken
//     so the Node/Vitest process can call the same signing code the Deno runtime uses.
//   - The test value is intentionally public and non-production.
//
// Seeding: two agencies (A, B) + one contact + one kyc_case in agency A.
// The kyc_case INSERT triggers seed_kyc_lba_checks which creates initial checklist
// items — this is a known side effect that the cleanup handles gracefully.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

// ── env guards ──────────────────────────────────────────────────────────────

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const HAS_HMAC = !!(process.env.MEGGA_MAGIC_LINK_HMAC_SECRET)
const TEST_SECRET = process.env.MEGGA_MAGIC_LINK_HMAC_SECRET ?? ''
const BASE_URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ENDPOINT = `${BASE_URL}/functions/v1/kyc-report-data`

// kyc-report-data is NOT in config.toml's verify_jwt=false list (only the
// whatsapp-* functions are), so on the LOCAL stack the gateway rejects every
// non-OPTIONS request with 401 BEFORE the function body runs unless the anon
// key is attached. The frontend never trips on this because
// supabase.functions.invoke() auto-attaches the key — raw fetch() must do it by
// hand. Sending the anon key lets the gateway pass through, after which the
// function's own token logic (400/401/404/200) applies. Same convention as the
// repo's other edge specs: keep verify_jwt true locally, send the key, let the
// function self-auth via the magic-link token.
const ANON = process.env.SUPABASE_TEST_ANON_KEY ?? ''
const authHeaders = { apikey: ANON, Authorization: `Bearer ${ANON}` }

// ── helpers ──────────────────────────────────────────────────────────────────

const now = () => Math.floor(Date.now() / 1000)

async function post(body: unknown): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify(body),
  })
}

// ── Tier 1: Baseline contract (no secret needed) ──────────────────────────

describe.skipIf(!HAS_KEYS)('kyc-report-data — baseline contract', () => {
  it('OPTIONS → 2xx (CORS preflight)', async () => {
    const res = await fetch(ENDPOINT, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://megga.ch',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
        ...authHeaders,
      },
    })
    expect(res.status >= 200 && res.status < 300, `CORS preflight got ${res.status}`).toBe(true)
  })

  it('POST {} (no token) → 400', async () => {
    const res = await post({})
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json).toHaveProperty('error')
  })

  it('POST malformed token (wrong format) → 401', async () => {
    // "aaa.bbb" has 2 parts but the signature is garbage → invalid_signature or malformed
    const res = await post({ token: 'aaa.bbb' })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toHaveProperty('error')
    expect(String(json.error)).toMatch(/invalid token/i)
  })

  it('POST single-part token (wrong format) → 401', async () => {
    const res = await post({ token: 'notadottoken' })
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toHaveProperty('error')
  })
})

// ── Tier 2 + 3: Full token path (requires HMAC secret in edge runtime) ────

describe.skipIf(!HAS_KEYS || !HAS_HMAC)('kyc-report-data — token validation + agency scope', () => {
  let setup: TwoAgenciesSetup
  let contactId: string
  let caseId: string

  // Sign function — loaded dynamically with Deno shim set first.
  type SignFn = (payload: { id: string; exp: number; p?: string }) => Promise<string>
  let signToken: SignFn

  beforeAll(async () => {
    // Shim globalThis.Deno BEFORE importing the shared token module.
    // The module reads Deno.env.get() at call time — same pattern as magic-link-token.test.ts.
    ;(globalThis as Record<string, unknown>).Deno = {
      env: { get: (k: string) => (k === 'MEGGA_MAGIC_LINK_HMAC_SECRET' ? TEST_SECRET : undefined) },
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = await import('../../supabase/functions/_shared/magic-link-token.ts') as any
    signToken = mod.signMagicLinkToken as SignFn

    setup = await setupTwoAgencies()
    const service = serviceRoleClient()

    // Insert contact in agency A
    const { data: contact, error: cErr } = await service
      .from('contacts')
      .insert({
        agency_id: setup.agencyAId,
        first_name: 'KycReport',
        last_name: `Spec ${setup.stamp}`,
        email: `kyc-report-${setup.stamp}@megga-test.local`,
        entity_type: 'pp',
        type: 'buyer',
        source: 'manual',
      })
      .select('id')
      .single()
    if (cErr) throw new Error(`contact insert: ${cErr.message}`)
    contactId = contact!.id

    // Insert kyc_case in agency A — triggers seed_kyc_lba_checks (side effect OK)
    const { data: kc, error: kErr } = await service
      .from('kyc_cases')
      .insert({
        agency_id: setup.agencyAId,
        contact_id: contactId,
        type: 'buyer_pp',
        vigilance: 'standard',
      })
      .select('id')
      .single()
    if (kErr) throw new Error(`kyc_cases insert: ${kErr.message}`)
    caseId = kc!.id
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    // Cleanup in dependency order. LBA retention may block kyc_cases delete —
    // we swallow errors (same pattern as kyc-wa-uploads-rls.spec.ts).
    await service.from('kyc_magic_link_uploads').delete().eq('kyc_case_id', caseId).then(() => {}, () => {})
    await service.from('kyc_cases').delete().eq('id', caseId).then(() => {}, () => {})
    await service.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('valid token → 200 with correct report shape', async () => {
    // Sign with the dossier's kyc_case id — kyc-report-data uses token.payload.id as dossierId
    const token = await signToken({ id: caseId, exp: now() + 300 })
    const res = await post({ token })

    expect(res.status, `Expected 200, got ${res.status}`).toBe(200)
    const json = await res.json()

    expect(json.ok).toBe(true)
    expect(json.report).toBeDefined()

    // Agency must match the dossier's own agency — proves no cross-agency substitution
    expect(json.report.dossier).toBeDefined()
    expect(json.report.dossier.agency_id).toBe(setup.agencyAId)

    // documents is always an array (even if empty)
    expect(Array.isArray(json.report.documents)).toBe(true)

    // auditEvents is always an array
    expect(Array.isArray(json.report.auditEvents)).toBe(true)

    // agencyName is a non-empty string
    expect(typeof json.report.agencyName).toBe('string')
    expect(json.report.agencyName.length).toBeGreaterThan(0)
  })

  it('expired token → 401', async () => {
    // exp is 10 seconds in the past
    const token = await signToken({ id: caseId, exp: now() - 10 })
    const res = await post({ token })

    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json).toHaveProperty('error')
    expect(String(json.error)).toMatch(/invalid token.*expired|expired/i)
  })

  it('validly-signed token for non-existent dossier → 404', async () => {
    // A well-formed, validly-signed token pointing to a UUID that does not exist in the DB
    const fakeDossierId = '00000000-0000-0000-0000-000000000001'
    const token = await signToken({ id: fakeDossierId, exp: now() + 300 })
    const res = await post({ token })

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json).toHaveProperty('error')
  })
})
