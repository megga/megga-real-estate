// RPC de soumission d'identité — submit_agency_identity() (étape 2 onboarding KYB,
// tâche 1). Le dirigeant clôt sa saisie d'identité légale ; la RPC valide la
// complétude (raison sociale, forme juridique, pays, signataire actif — dans cet
// ordre), pose agencies.identity_submitted_at et journalise dans activity_events.
// Idempotente côté métier : un second appel après un premier succès ne rejoue rien.
//
// Chaque test crée sa propre agence via une vraie inscription (le trigger
// handle_new_user provisionne l'agence solo et pose le fondateur admin) : on ne
// fabrique jamais l'agence à la main, sinon le test ne prouve pas le comportement
// réel. Motif de création d'utilisateur repris de signup-provisioning.spec.ts.
//
// Voir docs/superpowers/plans/2026-07-27-onboarding-kyb-etape-2.md (Task 1) et
// supabase/migrations/20260727100000_submit_agency_identity.sql.

import { describe, it, expect, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'

const PW = 'Test-Password-123!'
const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

interface Founder {
  id: string
  agencyId: string
  client: SupabaseClient
}

describe.skipIf(!HAS_KEYS)('submit_agency_identity — RPC de soumission', () => {
  const userIds: string[] = []

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of userIds) {
      const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
      await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
      if (prof?.agency_id) await svc.from('agencies').delete().eq('id', prof.agency_id).then(() => {}, () => {})
    }
  })

  // Inscrit un fondateur : handle_new_user() -> provision_solo_agency() lui crée une
  // agence solo et le pose admin. C'est la seule façon de tester le comportement réel
  // de is_agency_admin() sans fabriquer un profil à la main.
  async function signUpFounder(): Promise<Founder> {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `identity-${stamp}@megga-test.local`
    const { data, error } = await svc.auth.admin.createUser({
      email,
      password: PW,
      email_confirm: true,
      user_metadata: { full_name: `Fondateur ${stamp}`, role: 'agent' },
    })
    if (error) throw new Error(`createUser: ${error.message}`)
    const id = data.user!.id
    userIds.push(id)

    const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', id).maybeSingle()
    if (!prof?.agency_id) throw new Error('provisioning: aucune agence solo créée')

    const client = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin: ${signInErr.message}`)

    return { id, agencyId: prof.agency_id as string, client }
  }

  async function getChSaLegalFormId(): Promise<string> {
    const { data, error } = await serviceRoleClient()
      .from('legal_forms')
      .select('id')
      .eq('code', 'CH_SA')
      .single()
    if (error) throw new Error(`legal_forms lookup: ${error.message}`)
    return data!.id as string
  }

  // valid_to nul = signataire actif sans date de fin ; une date passée simule un
  // mandat expiré, utilisé pour prouver que le check regarde bien valid_to et pas
  // seulement l'existence de la ligne.
  async function addSignatory(agencyId: string, validTo: string | null = null): Promise<void> {
    const svc = serviceRoleClient()
    const { data: person, error: perErr } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Dupont' })
      .select('id')
      .single()
    if (perErr) throw new Error(`related_person: ${perErr.message}`)

    const { error: roleErr } = await svc
      .from('agency_person_roles')
      .insert({
        related_person_id: person!.id,
        role: 'signatory',
        signature_power: 'individual',
        valid_to: validTo,
      })
    if (roleErr) throw new Error(`person_role: ${roleErr.message}`)
  }

  async function completeAgencyIdentity(agencyId: string): Promise<void> {
    const legalFormId = await getChSaLegalFormId()
    const { error } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Test SA', legal_form_id: legalFormId, country: 'CH' })
      .eq('id', agencyId)
    if (error) throw new Error(`update agency: ${error.message}`)
    await addSignatory(agencyId)
  }

  it('un dirigeant dont l\'agence est complète soumet, et identity_submitted_at est posé', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, `submit: ${error?.message}`).toBeNull()

    const { data: agency } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(agency?.identity_submitted_at, 'identity_submitted_at doit être posé').not.toBeNull()
  })

  it('un second appel ne crée pas un second événement dans activity_events', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const first = await founder.client.rpc('submit_agency_identity')
    expect(first.error, `1er appel: ${first.error?.message}`).toBeNull()

    const { data: agencyAfterFirst } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()

    const second = await founder.client.rpc('submit_agency_identity')
    expect(second.error, `2e appel: ${second.error?.message}`).toBeNull()

    const { data: agencyAfterSecond } = await serviceRoleClient()
      .from('agencies')
      .select('identity_submitted_at')
      .eq('id', founder.agencyId)
      .maybeSingle()
    expect(
      agencyAfterSecond?.identity_submitted_at,
      'un second appel ne doit pas rejouer la pose de identity_submitted_at'
    ).toBe(agencyAfterFirst?.identity_submitted_at)

    const { data: events, error: evErr } = await serviceRoleClient()
      .from('activity_events')
      .select('id')
      .eq('entity_type', 'agency')
      .eq('entity_id', founder.agencyId)
      .eq('action', 'agency_identity_submitted')
    expect(evErr).toBeNull()
    expect(events?.length, 'un second appel ne doit pas re-journaliser').toBe(1)
  })

  it('un agent simple (role agent) reçoit 42501', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    // role/agency_id sont en lecture seule hors service_role (garde 20260627120000).
    const { error: downgradeErr } = await serviceRoleClient()
      .from('profiles')
      .update({ role: 'agent' })
      .eq('id', founder.id)
    expect(downgradeErr).toBeNull()

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'un agent simple ne doit jamais soumettre l\'identité de son agence').not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  it('une agence sans legal_name est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    // legal_name / legal_form_id / country restent NULL : agence fraîchement
    // provisionnée par le trigger, jamais complétée.

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans raison sociale ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('legal_name')
  })

  it('une agence sans legal_form_id est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Sans Forme SA' })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans forme juridique ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('legal_form')
  })

  it('une agence sans country est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    const legalFormId = await getChSaLegalFormId()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Sans Pays SA', legal_form_id: legalFormId })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans pays ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('country')
  })

  it('une agence sans signataire actif est refusée, avec le message dédié', async () => {
    const founder = await signUpFounder()
    const legalFormId = await getChSaLegalFormId()
    const { error: updErr } = await serviceRoleClient()
      .from('agencies')
      .update({ legal_name: 'Régie Sans Signataire SA', legal_form_id: legalFormId, country: 'CH' })
      .eq('id', founder.agencyId)
    expect(updErr).toBeNull()

    // Signataire expiré (valid_to hier) : la ligne existe mais ne compte pas comme
    // active, ce qui prouve que le check regarde valid_to et pas seulement
    // l'existence de la ligne.
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await addSignatory(founder.agencyId, yesterday)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error, 'une agence sans signataire actif ne doit pas pouvoir soumettre').not.toBeNull()
    expect(error?.message).toContain('signatory')
  })

  it('l\'événement journalisé porte category=kyc (et non compliance)', async () => {
    const founder = await signUpFounder()
    await completeAgencyIdentity(founder.agencyId)

    const { error } = await founder.client.rpc('submit_agency_identity')
    expect(error).toBeNull()

    const { data: event, error: evErr } = await serviceRoleClient()
      .from('activity_events')
      .select('category, severity, actor_kind, actor_id, action, entity_type, entity_id')
      .eq('entity_type', 'agency')
      .eq('entity_id', founder.agencyId)
      .eq('action', 'agency_identity_submitted')
      .maybeSingle()
    expect(evErr).toBeNull()
    expect(event?.category, 'compliance ferait échouer activity_events_category_check').toBe('kyc')
    expect(event?.severity).toBe('info')
    expect(event?.actor_kind).toBe('user')
    expect(event?.actor_id).toBe(founder.id)
  })
})
