// Hygiène EXECUTE des fns SECURITY DEFINER (migration 20260711210000) — preuves :
//   (1) les fonctions TRIGGER ne sont plus appelables via l'API (anon NI authenticated),
//       MAIS les triggers tirent toujours (PostgreSQL ne vérifie EXECUTE qu'à la
//       création du trigger) : un insert authenticated qui déclenche des triggers passe.
//   (2) les helpers cron/service (can_auto_send…) et les orphelines (check_email_exists,
//       RPC marketplace) sont fermés aux deux rôles API.
//   (3) les RPC CRM restent appelables en authenticated mais plus en anon
//       (accept_followup_suggestion — le happy-path authenticated est déjà couvert par
//       whatsapp-followups.spec.ts).
//   (4) les surfaces publiques voulues restent ouvertes à l'anon (get_popular_articles,
//       get_visit_by_token).
// NB erreurs : permission refusée = code 42501 ; on ne s'appuie JAMAIS sur un message.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

const DENIED = '42501'

describe.skipIf(!HAS_KEYS)('secdef — EXECUTE révoqué (API) sans casser les triggers', () => {
  let setup: TwoAgenciesSetup
  let propertyId = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (propertyId) await svc.from('properties').delete().eq('id', propertyId).then(() => {}, () => {})
    await setup.cleanup()
  })

  // ── (1) triggers : API fermée, déclenchement intact ─────────────────────────
  it('un insert authenticated déclenche encore ses triggers (properties_audit_event…)', async () => {
    // properties porte properties_audit_event + set_property_published_at (révoquées
    // côté API) : si le revoke cassait le déclenchement, cet insert échouerait.
    const { data, error } = await setup.clientA.from('properties')
      .insert({
        agency_id: setup.agencyAId, title: `Trigger OK ${setup.stamp}`,
        type: 'apartment', status: 'active', city: 'Genève', canton: 'GE',
      }).select('id').single()
    expect(error).toBeNull()
    expect(data?.id).toBeTruthy()
    propertyId = data!.id
  })

  it('une fonction trigger n\'est plus appelable via l\'API (anon ET authenticated)', async () => {
    const { error: anonErr } = await anonClient().rpc('bump_contact_last_interaction')
    expect(anonErr?.code).toBe(DENIED)
    const { error: authErr } = await setup.clientA.rpc('bump_contact_last_interaction')
    expect(authErr?.code).toBe(DENIED)
  })

  // ── (2) helpers cron/service + orphelines fermés ────────────────────────────
  it('can_auto_send : fermé aux rôles API (le service_role continue — cf. autonomy-gate.spec)', async () => {
    const { error: anonErr } = await anonClient().rpc('can_auto_send', {
      p_agent_id: '00000000-0000-0000-0000-000000000000', p_action_type: 'pipeline_move',
    })
    expect(anonErr?.code).toBe(DENIED)
    const { error: authErr } = await setup.clientA.rpc('can_auto_send', {
      p_agent_id: '00000000-0000-0000-0000-000000000000', p_action_type: 'pipeline_move',
    })
    expect(authErr?.code).toBe(DENIED)
  })

  it('check_email_exists (énumération d\'emails, orpheline) : fermée aux deux rôles', async () => {
    const { error: anonErr } = await anonClient().rpc('check_email_exists', { p_email: 'a@b.ch' })
    expect(anonErr?.code).toBe(DENIED)
    const { error: authErr } = await setup.clientA.rpc('check_email_exists', { p_email: 'a@b.ch' })
    expect(authErr?.code).toBe(DENIED)
  })

  it('RPC marketplace orphelines (count_market_by_canton…) : fermées à l\'anon', async () => {
    const { error } = await anonClient().rpc('count_market_by_canton', { p_context: 'rent' })
    expect(error?.code).toBe(DENIED)
  })

  // ── (3) RPC CRM : anon fermé, authenticated conservé ────────────────────────
  it('accept_followup_suggestion : anon refusé (authenticated couvert par whatsapp-followups.spec)', async () => {
    const { error } = await anonClient().rpc('accept_followup_suggestion', {
      p_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(error?.code).toBe(DENIED)
  })

  it('search_agencies : anon refusé, authenticated OK (onboarding)', async () => {
    const { error: anonErr } = await anonClient().rpc('search_agencies', { q: 'megga', lim: 3 })
    expect(anonErr?.code).toBe(DENIED)
    const { error: authErr } = await setup.clientA.rpc('search_agencies', { q: 'megga', lim: 3 })
    expect(authErr).toBeNull()
  })

  // ── (4) surfaces publiques voulues : toujours ouvertes ──────────────────────
  it('get_popular_articles (/help public) : anon toujours autorisé', async () => {
    const { error } = await anonClient().rpc('get_popular_articles', { limit_count: 3 })
    // pas de 42501 — la fn répond (données ou vide selon le seed local)
    expect(error?.code ?? null).not.toBe(DENIED)
  })

  it('get_visit_by_token (page visite publique) : anon toujours autorisé', async () => {
    const { data, error } = await anonClient().rpc('get_visit_by_token', {
      p_token: '00000000-0000-0000-0000-000000000000',
    })
    expect(error).toBeNull()   // exécutable (token inconnu → null, pas un refus)
    expect(data ?? null).toBeNull()
  })
})
