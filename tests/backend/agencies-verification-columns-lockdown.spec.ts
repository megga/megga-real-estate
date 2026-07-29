// Backend integration spec (live CI) — verrouillage des colonnes de vérification LAB
// sur agencies (revue étape 5/tâche 4, point 1 CRITIQUE — migration
// 20260728170000_lock_agency_verification_columns.sql).
//
// La policy agencies_members_update (20260527010000) autorise tout membre à écrire
// sa propre ligne agencies, SANS restriction de colonne — verification_status y
// compris. Un agent simple pouvait donc se poser lui-même
// verification_status='validated' et franchir sans obstacle les deux gardes serveur
// (kyc-screening, sign-document via supabase/functions/_shared/agency-lab-guard.ts)
// qui lisent exactement cette colonne : le garde lisait un fait que le gardé
// contrôlait.
//
// Ce fichier prouve : (1) qu'un agent simple, (2) qu'un dirigeant (role admin) de
// l'agence ne peuvent plus écrire ces colonnes en direct — même sur LEUR PROPRE
// agence ; (3) que la seconde défense (trigger) tient même si la première (REVOKE)
// régressait ; (4) que les trois chemins légitimes (submit_agency_identity,
// recompute_agency_verification, admin_validate_agency_review) continuent de
// fonctionner sans être gênés par le verrou.
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seedé et DOIVENT réellement passer — lire le compte de tests, jamais le code de
// sortie (même convention que les autres specs étape 5).

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'

/** Une valeur de rechange par colonne protégée — n'importe laquelle suffit, seul
 *  compte le refus. */
const PROTECTED_COLUMNS: [string, unknown][] = [
  ['verification_status', 'validated'],
  ['verification_score', 0.99],
  ['verified_at', new Date().toISOString()],
  ['identity_submitted_at', new Date().toISOString()],
  ['verification_sweep_attempts', 99],
]

describe.skipIf(!HAS_KEYS)('verrouillage des colonnes de vérification LAB sur agencies (revue étape 5/tâche 4, point 1)', () => {
  let setup: TwoAgenciesSetup
  const extraUserIds: string[] = []
  const extraAgencyIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    if (setup) await setup.cleanup()
    const svc = serviceRoleClient()
    for (const id of extraAgencyIds) await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. Un agent simple ne peut plus toucher ces colonnes ────────────────────────

  it.each(PROTECTED_COLUMNS)('un agent simple ne peut pas écrire %s directement sur sa propre agence', async (column, value) => {
    const before = await serviceRoleClient().from('agencies').select(column).eq('id', setup.agencyAId).single()

    const { error } = await setup.clientA.from('agencies').update({ [column]: value }).eq('id', setup.agencyAId)
    expect(error, `un agent ne doit jamais pouvoir poser ${column} lui-même`).not.toBeNull()

    const after = await serviceRoleClient().from('agencies').select(column).eq('id', setup.agencyAId).single()
    expect(
      (after.data as Record<string, unknown> | null)?.[column],
      `${column} ne doit pas avoir bougé malgré la tentative`
    ).toEqual((before.data as Record<string, unknown> | null)?.[column])
  })

  it('un agent peut toujours écrire une colonne NON protégée (name) sur sa propre agence — le verrou est précis', async () => {
    const { error } = await setup.clientA
      .from('agencies')
      .update({ name: `Agency A renamed ${setup.stamp}` })
      .eq('id', setup.agencyAId)
    expect(error, 'le verrou ne doit fermer QUE les colonnes de vérification, rien d\'autre').toBeNull()
  })

  // ── 2. Un dirigeant (role admin) de l'agence non plus ────────────────────────────

  it.each(PROTECTED_COLUMNS)('un dirigeant (role admin) de l\'agence ne peut pas non plus écrire %s', async (column, value) => {
    const svc = serviceRoleClient()
    const { error: promoteErr } = await svc.from('profiles').update({ role: 'admin' }).eq('id', setup.agentAId)
    expect(promoteErr, 'promotion role=admin (fixture)').toBeNull()

    const { error } = await setup.clientA.from('agencies').update({ [column]: value }).eq('id', setup.agencyAId)
    expect(error, `un dirigeant ne doit jamais pouvoir poser ${column} lui-même, même admin de sa propre agence`).not.toBeNull()
  })

  // ── 3. Deuxième défense (trigger) : tient même si la première (REVOKE) régresse ──

  it('le trigger bloque authenticated même si la GRANT colonne était (par hypothèse) réouverte', async () => {
    // Simule une régression future du REVOKE (ex. un `GRANT UPDATE ON agencies TO
    // authenticated` sans liste de colonnes qui redonnerait tout — précédent réel sur
    // cette table, 20260527010000). Si SEUL le REVOKE protégeait, cette tentative
    // réussirait ; la deuxième défense (trigger BEFORE UPDATE, current_user=authenticated)
    // doit continuer à refuser.
    execSql('grant update (verification_status) on public.agencies to authenticated;')
    try {
      const { error } = await setup.clientA
        .from('agencies')
        .update({ verification_status: 'validated' })
        .eq('id', setup.agencyAId)
      expect(error, 'le trigger doit refuser meme quand la colonne est explicitement re-accordee').not.toBeNull()
      expect(error?.code, 'refus attendu = 42501 (forbidden), pose par le trigger').toBe('42501')
    } finally {
      // Restaure l'état voulu par la migration, quoi qu'il arrive.
      execSql('revoke update (verification_status) on public.agencies from authenticated;')
    }
  })

  // ── 4. Les chemins légitimes continuent de fonctionner ──────────────────────────

  it('submit_agency_identity (dirigeant, RPC SECURITY DEFINER) continue de poser identity_submitted_at', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const email = `lockdown-founder-${stamp}@megga-test.local`
    const { data: created, error: createErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Fondateur ${stamp}`, role: 'agent' },
    })
    expect(createErr).toBeNull()
    const founderId = created!.user!.id
    extraUserIds.push(founderId)

    const { data: prof } = await svc.from('profiles').select('agency_id').eq('id', founderId).maybeSingle()
    const agencyId = prof!.agency_id as string
    extraAgencyIds.push(agencyId)

    const { data: legalForm, error: lfErr } = await svc.from('legal_forms').select('id').eq('code', 'CH_SA').single()
    expect(lfErr).toBeNull()
    const { error: updErr } = await svc
      .from('agencies')
      .update({ legal_name: 'Regie Lockdown SA', legal_form_id: legalForm!.id, country: 'CH' })
      .eq('id', agencyId)
    expect(updErr).toBeNull()
    const { data: person, error: perErr } = await svc
      .from('agency_related_persons')
      .insert({ agency_id: agencyId, first_name: 'Jean', last_name: 'Dupont' })
      .select('id')
      .single()
    expect(perErr).toBeNull()
    const { error: roleErr } = await svc
      .from('agency_person_roles')
      .insert({ related_person_id: person!.id, role: 'signatory', signature_power: 'individual' })
    expect(roleErr).toBeNull()

    const client: SupabaseClient = anonClient()
    const { error: signInErr } = await client.auth.signInWithPassword({ email, password: PW })
    expect(signInErr).toBeNull()

    const { error: submitErr } = await client.rpc('submit_agency_identity')
    expect(submitErr, `submit_agency_identity ne doit pas être bloquée par le verrou: ${submitErr?.message}`).toBeNull()

    const { data: after } = await svc.from('agencies').select('identity_submitted_at').eq('id', agencyId).maybeSingle()
    expect(after?.identity_submitted_at, 'identity_submitted_at doit être posé malgré le verrou').not.toBeNull()
  })

  it('recompute_agency_verification (service_role, RPC SECURITY DEFINER) continue de poser verification_status/score/verified_at', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    const { data: agency, error: agErr } = await svc
      .from('agencies')
      .insert({ name: `Agence Lockdown Recompute ${stamp}`, slug: `agence-lockdown-recompute-${stamp}` })
      .select('id, verification_status')
      .single()
    expect(agErr).toBeNull()
    extraAgencyIds.push(agency!.id as string)
    expect(agency!.verification_status).toBe('pending')

    const { error: rpcErr } = await svc.rpc('recompute_agency_verification', { p_agency_id: agency!.id })
    expect(rpcErr, `recompute_agency_verification ne doit pas être bloquée par le verrou: ${rpcErr?.message}`).toBeNull()

    const { data: after } = await svc.from('agencies').select('verification_status').eq('id', agency!.id).single()
    expect(after?.verification_status, 'le moteur doit toujours pouvoir écrire un verdict').not.toBe('pending')
  })

  it('admin_validate_agency_review (super-admin, RPC SECURITY DEFINER) continue de poser verification_status=validated', async () => {
    const svc = serviceRoleClient()
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

    const { error: cfgErr } = await svc
      .from('app_config')
      .upsert({ key: 'super_admin_test_domain', value: '@megga-test.local' }, { onConflict: 'key' })
    expect(cfgErr).toBeNull()

    const { data: agency, error: agErr } = await svc
      .from('agencies')
      .insert({
        name: `Agence Lockdown Review ${stamp}`, slug: `agence-lockdown-review-${stamp}`,
        verification_status: 'manual_review',
      })
      .select('id')
      .single()
    expect(agErr).toBeNull()
    extraAgencyIds.push(agency!.id as string)

    const email = `lockdown-super-${stamp}@megga-test.local`
    const { data: userData, error: userErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true, user_metadata: { full_name: `Super ${stamp}`, role: 'agent' },
    })
    expect(userErr).toBeNull()
    const superId = userData!.user!.id
    extraUserIds.push(superId)
    const { error: profErr } = await svc
      .from('profiles')
      .upsert({ id: superId, email, full_name: `Super ${stamp}`, role: 'super_admin', agency_id: null }, { onConflict: 'id' })
    expect(profErr).toBeNull()

    const superClient = anonClient()
    const { error: signInErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    expect(signInErr).toBeNull()

    const { error: validateErr } = await superClient.rpc('admin_validate_agency_review', { p_agency_id: agency!.id })
    expect(validateErr, `admin_validate_agency_review ne doit pas être bloquée par le verrou: ${validateErr?.message}`).toBeNull()

    const { data: after } = await svc.from('agencies').select('verification_status').eq('id', agency!.id).maybeSingle()
    expect(after?.verification_status).toBe('validated')
  })
})
