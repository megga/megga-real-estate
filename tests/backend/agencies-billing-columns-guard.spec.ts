// Backend integration spec (live CI) — gel des colonnes de facturation d'agencies
// (migration 20260731200000_agencies_guard_billing_columns.sql, bloquant pré-lancement
// 0.4 / finding S30).
//
// La policy agencies_members_update exige is_agency_admin() depuis 20260731170000 : un
// agent simple ne peut plus écrire aucune colonne d'agencies. Mais un DIRIGEANT (role
// admin ou manager) le pouvait encore, sur les trois colonnes qui décident du plan facturé
// — plan, billing, stripe_customer_id — sans garde super-admin et sans laisser de trace,
// le trigger d'audit ne couvrant que les colonnes d'identité et d'adresse.
//
// Ce fichier prouve les deux moitiés qui comptent : le refus ET la sélectivité. Un test
// qui n'exercerait que le refus laisserait passer un trigger trop large, qui casserait le
// webhook Stripe (service_role) ou la seule RPC gardée qui a le droit de changer un plan.
//
// Piège évité, à ne pas « simplifier » : la valeur tentée pour `plan` est 'pro', pas
// 'entreprise'. 'entreprise' n'existe PAS dans l'enum agency_plan (starter|pro|agency|
// enterprise) et lèverait 22P02 — le test serait vert pour le mauvais motif, sans jamais
// atteindre le trigger. C'est pour cette raison que l'assertion porte sur le code 42501,
// jamais sur « il y a une erreur ».
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : ces tests tournent contre un Supabase local
// seedé et DOIVENT réellement passer — lire le compte de tests, jamais le code de sortie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const PW = 'Test-Password-123!'
const DENIED = '42501'

/** Une valeur VALIDE par colonne gelée — seul compte le refus, jamais une erreur de type.
 *  'pro' est un label réel de l'enum agency_plan ; 'yearly' satisfait agencies_billing_check. */
const FROZEN_COLUMNS: [string, unknown][] = [
  ['plan', 'pro'],
  ['billing', 'yearly'],
  ['stripe_customer_id', 'cus_forged_by_agency'],
]

describe.skipIf(!HAS_KEYS)('gel des colonnes de facturation d\'agencies (bloquant 0.4)', () => {
  let setup: TwoAgenciesSetup
  let superClient: SupabaseClient
  const extraUserIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // Le trou visé n'existe QUE pour un dirigeant : is_agency_admin() est la condition
    // d'entrée de agencies_members_update depuis 20260731170000.
    const { error } = await svc.from('profiles').update({ role: 'admin' }).eq('id', setup.agentAId)
    if (error) throw new Error(`promotion role=admin (fixture): ${error.message}`)

    // admin_set_agency_plan est gardée par is_super_admin() SEUL — jamais
    // is_service_role(). Or is_super_admin() lit auth.uid(), nul pour une clé de service :
    // la RPC est donc INAPPELABLE en service_role (mesuré, elle rend 42501 « forbidden:
    // super_admin required »). Elle exige un vrai JWT super-admin, d'où cette fixture.
    // Conséquence à retenir hors de ce test : aucun cron ni aucune edge en service_role ne
    // peut rejouer un changement de plan — à intégrer au design de l'outbox (§10.2).
    const email = `billing-guard-super-${setup.stamp}@megga-test.local`
    const { data, error: createErr } = await svc.auth.admin.createUser({
      email, password: PW, email_confirm: true,
      user_metadata: { full_name: `Super ${setup.stamp}`, role: 'agent' },
    })
    if (createErr) throw new Error(`createUser super_admin: ${createErr.message}`)
    extraUserIds.push(data.user!.id)
    const { error: pErr } = await svc
      .from('profiles')
      .upsert(
        { id: data.user!.id, email, full_name: `Super ${setup.stamp}`, role: 'super_admin', agency_id: null },
        { onConflict: 'id' }
      )
    if (pErr) throw new Error(`profile super_admin: ${pErr.message}`)
    superClient = anonClient()
    const { error: signInErr } = await superClient.auth.signInWithPassword({ email, password: PW })
    if (signInErr) throw new Error(`signin super_admin: ${signInErr.message}`)
  })

  afterAll(async () => {
    if (setup) await setup.cleanup()
    const svc = serviceRoleClient()
    for (const id of extraUserIds) await svc.auth.admin.deleteUser(id).then(() => {}, () => {})
  })

  // ── 1. Le refus ────────────────────────────────────────────────────────────────

  it.each(FROZEN_COLUMNS)('un dirigeant ne peut pas écrire %s sur sa propre agence', async (column, value) => {
    const svc = serviceRoleClient()
    const before = await svc.from('agencies').select(column).eq('id', setup.agencyAId).single()

    const { error } = await setup.clientA.from('agencies').update({ [column]: value }).eq('id', setup.agencyAId)
    expect(error, `un dirigeant ne doit jamais poser ${column} lui-même`).not.toBeNull()
    expect(error?.code, 'refus attendu = 42501, posé par agencies_guard_billing_columns').toBe(DENIED)

    const after = await svc.from('agencies').select(column).eq('id', setup.agencyAId).single()
    expect(
      (after.data as Record<string, unknown> | null)?.[column],
      `${column} ne doit pas avoir bougé malgré la tentative`
    ).toEqual((before.data as Record<string, unknown> | null)?.[column])
  })

  it('les trois colonnes sont refusées ensemble dans un même UPDATE', async () => {
    const { error } = await setup.clientA
      .from('agencies')
      .update({ plan: 'pro', billing: 'yearly', stripe_customer_id: 'cus_forged' })
      .eq('id', setup.agencyAId)
    expect(error?.code).toBe(DENIED)
  })

  // ── 2. La sélectivité ──────────────────────────────────────────────────────────

  it('un dirigeant peut toujours écrire name — le verrou ne ferme QUE la facturation', async () => {
    const newName = `Agency A billing-guard ${setup.stamp}`
    const { error } = await setup.clientA.from('agencies').update({ name: newName }).eq('id', setup.agencyAId)
    expect(error, 'le trigger ne doit gêner aucune autre colonne').toBeNull()

    const { data } = await serviceRoleClient().from('agencies').select('name').eq('id', setup.agencyAId).single()
    expect(data?.name).toBe(newName)
  })

  it('le service_role écrit stripe_customer_id — le chemin webhook Stripe reste ouvert', async () => {
    const svc = serviceRoleClient()
    const customerId = `cus_webhook_${setup.stamp}`
    const { error } = await svc.from('agencies').update({ stripe_customer_id: customerId }).eq('id', setup.agencyAId)
    expect(error, 'stripe-webhook et stripe-checkout écrivent en service_role').toBeNull()

    const { data } = await svc.from('agencies').select('stripe_customer_id').eq('id', setup.agencyAId).single()
    expect(data?.stripe_customer_id).toBe(customerId)
  })

  it('admin_set_agency_plan change le plan malgré le trigger — le chemin gardé reste ouvert', async () => {
    // Appelée avec un JWT super-admin (voir beforeAll) : la RPC est gardée par
    // is_super_admin() seul et refuse le service_role. Une fois entrée, elle est SECURITY
    // DEFINER appartenant à postgres, donc `current_user` y vaut 'postgres' et jamais
    // 'authenticated' — c'est ce qui la fait passer devant le trigger de gel, et ce qui en
    // fait le seul écrivain humain légitime de agencies.plan.
    const svc = serviceRoleClient()
    const { error } = await superClient.rpc('admin_set_agency_plan', {
      p_agency_id: setup.agencyAId,
      p_plan: 'pro',
      p_status: 'active',
      p_note: 'test gel facturation',
    })
    expect(error, 'la RPC gardée doit continuer de passer').toBeNull()

    const { data } = await svc.from('agencies').select('plan').eq('id', setup.agencyAId).single()
    expect(data?.plan, 'le plan doit avoir réellement changé').toBe('pro')

    // Nettoyage de la ligne subscriptions créée par la RPC (stripe_customer_id = manual_<uuid>).
    await svc.from('subscriptions').delete().eq('agency_id', setup.agencyAId).then(() => {}, () => {})
  })

  it('admin_set_agency_plan refuse le service_role — sa garde est is_super_admin() SEUL', async () => {
    // Constat mesuré en écrivant ce fichier, contre-intuitif et à ne pas perdre : contrairement
    // aux RPC de lecture du socle admin (gardées `is_super_admin() OR is_service_role()`),
    // celle-ci n'admet que le premier terme. is_super_admin() lit auth.uid(), nul sous une clé
    // de service. Aucune edge, aucun cron, aucun worker d'outbox ne peut donc rejouer un
    // changement de plan : il faudra porter le JWT de l'opérateur ou étendre la garde.
    const { error } = await serviceRoleClient().rpc('admin_set_agency_plan', {
      p_agency_id: setup.agencyAId,
      p_plan: 'starter',
      p_status: 'active',
      p_note: 'tentative service_role',
    })
    expect(error?.code, 'la garde doit refuser une clé de service').toBe(DENIED)
  })

  // ── 3. L'agent simple : fermé en amont, à ne pas confondre avec ce verrou ───────

  it('un agent simple est exclu par la RLS avant même d\'atteindre le trigger', async () => {
    const svc = serviceRoleClient()
    const { error: demoteErr } = await svc.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId)
    expect(demoteErr).toBeNull()

    const before = await svc.from('agencies').select('plan').eq('id', setup.agencyAId).single()
    // agencies_members_update exige is_agency_admin() : la clause USING exclut la ligne, donc
    // 0 ligne touchée et AUCUN refus explicite. La preuve qui compte est la valeur persistée.
    const { error } = await setup.clientA.from('agencies').update({ plan: 'starter' }).eq('id', setup.agencyAId)
    expect(error, 'RLS exclut la ligne en amont : pas de refus explicite pour un agent simple').toBeNull()

    const after = await svc.from('agencies').select('plan').eq('id', setup.agencyAId).single()
    expect(after.data?.plan, 'plan ne doit pas avoir bougé').toBe(before.data?.plan)
  })
})
