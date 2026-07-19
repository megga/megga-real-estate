// Real backend integration tests for RLS policies.
//
// These run against the LOCAL Supabase (from `supabase start`), which has
// the production schema baseline applied. We use the anon client to verify
// that Row-Level Security correctly blocks unauthenticated access to internal
// tables, and the service_role client to confirm full access bypassing RLS.

import { describe, it, expect } from 'vitest'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('RLS policies — anon cannot read internal tables', () => {
  it('contacts: anon receives 0 rows (RLS blocks)', async () => {
    const supabase = anonClient()
    const { data, error } = await supabase
      .from('contacts')
      .select('id')
      .limit(5)

    // Either error (RLS denial) or empty array (RLS filter to 0 rows).
    // Both are acceptable — what matters is that no real rows leak.
    if (error) {
      // Permission/RLS error is the "expected error" path
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
    } else {
      expect(data).toEqual([])
    }
  })

  it('properties: anon receives 0 rows or error', async () => {
    const supabase = anonClient()
    const { data, error } = await supabase
      .from('properties')
      .select('id')
      .limit(5)

    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
    } else {
      expect(data).toEqual([])
    }
  })

  it('transactions: anon receives 0 rows or error', async () => {
    const supabase = anonClient()
    const { data, error } = await supabase
      .from('transactions')
      .select('id')
      .limit(5)

    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
    } else {
      expect(data).toEqual([])
    }
  })
})

describe.skipIf(!HAS_KEYS)('RLS policies — anon cannot write contacts', () => {
  // Garde de non-régression pour la policy `contacts_anon_onboarding_insert`
  // (retirée par la migration 20260719090000). Son WITH CHECK ne contraignait
  // que `source`, pas `agency_id` : la clé anon étant publique, n'importe qui
  // pouvait écrire dans le carnet de n'importe quelle agence. La suite RLS ne
  // couvrait que la LECTURE de contacts, ce qui a laissé le trou survivre au
  // durcissement précédent. On teste donc explicitement l'écriture.
  it('anon ne peut pas insérer un contact, même avec source=onboarding', async () => {
    const supabase = anonClient()
    const { error } = await supabase.from('contacts').insert({
      first_name: 'Anon',
      last_name: 'Intrusion',
      email: `anon-rls-guard-${Date.now()}@megga-test.local`,
      type: 'buyer',
      // La valeur que l'ancienne policy laissait passer.
      source: 'onboarding',
      // agency_id volontairement omis : l'ancienne policy ne le contraignait pas,
      // n'importe quelle valeur (ou aucune) passait.
    })

    expect(error, 'anon doit être refusé en écriture sur contacts').not.toBeNull()
    expect(error!.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
  })
})

describe.skipIf(!HAS_KEYS)('RPC behavior — get_user_agency_id (bug #404 guard)', () => {
  it('returns null or errors gracefully for anonymous callers', async () => {
    // This was the bug behind #404: the RPC was called for anon users on /rent
    // and produced "permission denied" warnings. The frontend now guards the
    // call by checking session?.user first. Here we verify the RPC itself
    // handles anon callers without crashing.
    const supabase = anonClient()
    const { data, error } = await supabase.rpc('get_user_agency_id')

    // Acceptable outcomes:
    //   - data === null (no agency for anon — semantically correct)
    //   - error with message about permission/policy (RLS-style block)
    // What we DON'T want: server 500 / connection drop / unexpected payload
    const acceptableError = error !== null &&
      /permission|policy|denied|not authorized|auth/i.test(error.message)
    const acceptableData = data === null
    expect(
      acceptableError || acceptableData,
      `Unexpected outcome — data: ${JSON.stringify(data)}, error: ${error?.message}`
    ).toBe(true)
  })
})

describe.skipIf(!HAS_KEYS)('Service role bypasses RLS', () => {
  it('can SELECT contacts (RLS bypass)', async () => {
    const supabase = serviceRoleClient()
    const { error } = await supabase
      .from('contacts')
      .select('id', { head: true, count: 'estimated' })
    expect(error, `service_role should bypass RLS: ${error?.message}`).toBeNull()
  })

  it('can SELECT properties (RLS bypass)', async () => {
    const supabase = serviceRoleClient()
    const { error } = await supabase
      .from('properties')
      .select('id', { head: true, count: 'estimated' })
    expect(error).toBeNull()
  })
})
