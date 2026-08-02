// Admin création d'agence — admin_create_agency (migration 20260714100000)
//
//  Test 1 — Gate : un agent simple est rejeté (42501).
//  Test 2 — Effet : un super_admin crée une agence → elle existe, et le
//    super_admin N'Y est PAS rattaché (son profile.agency_id est inchangé).
//  Test 3 — Audit : un activity_events agency_created (admin_created=true).
//  Test 4 — Collision de nom refusée.
//
// Runs live in CI (SUPABASE_TEST_* keys present). Skips locally without keys.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('admin_create_agency — gardée super_admin, sans rattachement', () => {
  let setup: TwoAgenciesSetup
  let createdId: string | null = null
  let name = ''

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    name = `Nouvelle Agence ${setup.stamp}`
    const { error } = await serviceRoleClient().from('profiles').update({ role: 'super_admin' }).eq('id', setup.agentAId)
    if (error) throw new Error(`promote: ${error.message}`)
  })

  afterAll(async () => {
    const service = serviceRoleClient()
    if (createdId) await service.from('agencies').delete().eq('id', createdId).then(() => {}, () => {})
    await service.from('profiles').update({ role: 'agent' }).eq('id', setup.agentAId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('un agent simple ne peut pas créer d\'agence', async () => {
    const { error } = await setup.clientB.rpc('admin_create_agency', { p_name: `Hack ${setup.stamp}` })
    expect(error, 'refus attendu').not.toBeNull()
  })

  it('un super_admin crée une agence sans s\'y rattacher', async () => {
    const service = serviceRoleClient()
    const { data, error } = await setup.clientA.rpc('admin_create_agency', {
      p_name: name, p_city: 'Genève', p_canton: 'GE', p_plan: 'pro', p_note: 'partenaire',
    })
    if (error) throw new Error(`create: ${error.message}`)
    createdId = data as string
    expect(createdId).toBeTruthy()

    const { data: agency } = await service.from('agencies').select('name, plan, city, canton, created_by').eq('id', createdId).single()
    expect(agency?.name).toBe(name)
    expect(agency?.plan).toBe('pro')

    // Le super_admin n'est PAS rattaché : son profil pointe toujours son agence.
    const { data: profile } = await service.from('profiles').select('agency_id').eq('id', setup.agentAId).single()
    expect(profile?.agency_id).toBe(setup.agencyAId)
  })

  it('la création est auditée agency_created (admin_created=true)', async () => {
    if (!createdId) return
    const { data: events } = await serviceRoleClient()
      .from('activity_events')
      .select('action, metadata')
      .eq('action', 'agency_created')
      .eq('entity_id', createdId)
      .limit(1)
    expect(events?.length).toBe(1)
    expect((events![0].metadata as { admin_created?: boolean })?.admin_created).toBe(true)
  })

  it('un nom déjà pris est refusé', async () => {
    const { error } = await setup.clientA.rpc('admin_create_agency', { p_name: name })
    expect(error, 'collision de nom → erreur').not.toBeNull()
  })

  /**
   * Le plan « entreprise » — celui qui échouait, et que RIEN ne testait.
   *
   * `agencies.plan` était l'enum `agency_plan` (`starter|pro|agency|enterprise`) alors que
   * le catalogue et `subscriptions.plan` disent `entreprise`. La fonction validait DÉJÀ le
   * vocabulaire du catalogue puis castait vers l'enum : toute création « Entreprise »
   * passait le contrôle applicatif pour mourir sur `22P02 invalid input value for enum`.
   *
   * ⚠ Les deux suites qui touchent au plan n'exerçaient que `'pro'` — le seul mot présent
   * dans LES DEUX vocabulaires. Le défaut a traversé les tests parce qu'ils testaient la
   * valeur qui ne pouvait pas le révéler. Corrigé par `20260802170000` (colonne en `text`
   * + CHECK identique à `subscriptions_plan_check`, enum supprimé).
   */
  it('crée une agence au plan « entreprise » — le mot du catalogue, pas celui de l\'enum', async () => {
    const service = serviceRoleClient()
    const nomEntreprise = `Agence Entreprise ${setup.stamp}`
    const { data, error } = await setup.clientA.rpc('admin_create_agency', {
      p_name: nomEntreprise, p_city: 'Lausanne', p_canton: 'VD', p_plan: 'entreprise',
    })
    expect(error, `« entreprise » doit être accepté : ${error?.message ?? ''}`).toBeNull()

    const id = data as string
    try {
      const { data: agency } = await service.from('agencies').select('plan').eq('id', id).single()
      expect(agency?.plan).toBe('entreprise')
    } finally {
      await service.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    }
  })

  it('un plan hors catalogue reste refusé — y compris les mots de l\'ancien enum', async () => {
    // Le CHECK ne doit pas être plus permissif que l'enum ne l'était : `agency` et
    // `enterprise` étaient des valeurs VALIDES de l'ancien type, elles ne le sont plus.
    for (const plan of ['enterprise', 'agency', 'gratuit']) {
      const { error } = await setup.clientA.rpc('admin_create_agency', {
        p_name: `Refus ${plan} ${setup.stamp}`, p_plan: plan,
      })
      expect(error, `« ${plan} » doit être refusé`).not.toBeNull()
    }
  })
})
