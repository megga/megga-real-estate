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

describe.skipIf(!HAS_KEYS)('RLS policies — surfaces anon mortes refermées', () => {
  // Gardes issues de l'audit de TOUTES les policies exposées à anon
  // (migration 20260719100000). Chacune correspond à un risque vérifié en live.

  it("anon ne peut pas écrire un contact_message (pont vers le journal d'audit)", async () => {
    // La policy retirée ne contraignait que consent_privacy et status, deux champs
    // contrôlés par l'appelant. Le vrai risque n'était pas le tenant (la table n'en
    // a pas) mais le trigger SECURITY DEFINER notify_new_contact_message() : il
    // écrivait dans activity_events — où anon n'a aucune policy INSERT — du texte
    // fourni par l'appelant, dans un journal immuable 10 ans (rétention LBA).
    const supabase = anonClient()
    const { error } = await supabase.from('contact_messages').insert({
      name: 'Anon Intrusion',
      email: `anon-rls-guard-${Date.now()}@megga-test.local`,
      // >= 10 caractères, sinon c'est le CHECK qui rejette et le test ne prouve rien.
      message: 'charge utile de la sonde de non-régression',
      consent_privacy: true,
      status: 'new',
      // Le champ qui armait le trigger definer.
      source: 'storefront',
      lang: 'fr',
    })

    expect(error, 'anon doit être refusé en écriture sur contact_messages').not.toBeNull()
    // On exige une VRAIE denial RLS, pas un rejet de CHECK (23514) qui masquerait
    // une policy toujours ouverte.
    expect(error!.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
  })

  it('anon ne peut plus lire agency_profiles (claim_token + coordonnées)', async () => {
    const supabase = anonClient()
    const { data, error } = await supabase.from('agency_profiles').select('id').limit(5)

    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
    } else {
      expect(data, "l'annuaire agences ne doit plus fuiter en anon").toEqual([])
    }
  })

  it('anon ne peut plus lire agent_profiles (PII de personnes physiques)', async () => {
    const supabase = anonClient()
    const { data, error } = await supabase.from('agent_profiles').select('id').limit(5)

    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
    } else {
      expect(data, "l'annuaire agents ne doit plus fuiter en anon").toEqual([])
    }
  })

  it('anon ne peut plus lire market_listings (marketplace désactivée)', async () => {
    // La policy `Public can read active market_listings` servait la marketplace
    // publique, retirée au pivot CRM-first. Les lecteurs restants (Matching CRM,
    // monitoring admin, edge functions en service_role) sont tous hors du rôle anon.
    const supabase = anonClient()
    const { data, error } = await supabase.from('market_listings').select('id').limit(5)

    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
    } else {
      expect(data, 'market_listings ne doit plus être lisible en anon').toEqual([])
    }
  })

  it('anon ne peut plus lire market_price_history', async () => {
    const supabase = anonClient()
    const { data, error } = await supabase.from('market_price_history').select('id').limit(5)

    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|denied|row.?level/i)
    } else {
      expect(data, 'market_price_history ne doit plus être lisible en anon').toEqual([])
    }
  })

  it('seller_leads : anon ne peut pas cibler une agence (policy de référence)', async () => {
    // Contre-garde : cette policy est CORRECTEMENT écrite (WITH CHECK force
    // assigned_agency_id IS NULL). On vérifie qu'elle le reste — c'est le patron
    // à copier pour toute future écriture anon légitime.
    const supabase = anonClient()
    const { error } = await supabase.from('seller_leads').insert({
      status: 'new',
      // Ciblage explicite d'une agence : doit être refusé par le WITH CHECK.
      assigned_agency_id: '00000000-0000-0000-0000-000000000001',
    })

    expect(error, 'anon ne doit pas pouvoir affecter un lead à une agence').not.toBeNull()
  })
})

describe.skipIf(!HAS_KEYS)("RLS — les tables du Help Center SPA sont retirées", () => {
  // Ce bloc affirmait l'INVERSE jusqu'au 20.07.2026 : il exigeait que l'INSERT anon
  // sur article_views « continue de passer », parce que /help était une surface
  // publique et qu'ArticleFeedback y insérait au montage. Les 12 pages SPA /help/*
  // ont été retirées (#919, corpus déplacé vers Intercom), ce qui a laissé deux
  // tables en écriture NON AUTHENTIFIÉE sans aucun consommateur — anon y détenait
  // GRANT DELETE/INSERT/UPDATE/TRUNCATE. Elles ont été droppées le lendemain.
  //
  // Le garde-fou est donc inversé : il verrouille désormais le retrait, pour que
  // personne ne recrée une table anon-writable au motif d'un Help Center in-app.
  it.each(['article_views', 'article_feedback'])(
    '%s : anon ne peut plus écrire (table retirée)',
    async (table) => {
      const supabase = anonClient()
      const { error } = await supabase.from(table).insert({ article_slug: `rls-guard-${Date.now()}` })

      expect(error, `${table} doit rester inaccessible à anon`).not.toBeNull()
    },
  )
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
