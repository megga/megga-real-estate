// `agency_created` est produit par le trigger trg_agency_created (migration
// 20260729140000), pas par les fonctions de création.
//
// Ce test existe à cause de la panne qu'il empêche : la console admin savait
// nommer, iconifier et colorer `agency_created` depuis des mois, mais sur les
// TROIS fonctions qui créent une agence une seule journalisait — et c'était la
// seule qui n'a jamais été appelée en production. Le signal de croissance de la
// plateforme n'existait donc pas, sans qu'aucun test ne s'en aperçoive.
//
// On insère dans `agencies` DIRECTEMENT : le trigger doit se déclencher quel que
// soit le chemin, y compris un chemin qui n'existe pas encore.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const STAMP = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`

describe.skipIf(!HAS_KEYS)('agency_created — le trigger couvre tous les chemins de création', () => {
  let setup: TwoAgenciesSetup
  const createdAgencyIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of createdAgencyIds) {
      // `.then(onOk, onErr)` et non `.catch` : le builder PostgREST est un
      // thenable qui n'expose pas `.catch`.
      await svc.from('agencies').delete().eq('id', id).then(() => {}, () => {})
    }
    await setup?.cleanup()
  })

  it('un INSERT direct dans agencies produit un événement, et un seul', async () => {
    const svc = serviceRoleClient()
    const name = `ZZ Trigger ${STAMP}`

    const { data: agency, error: agErr } = await svc
      .from('agencies')
      .insert({
        name, slug: `zz-trigger-${STAMP}`, plan: 'starter', status: 'active',
        city: 'Genève', canton: 'GE', solo: true,
      })
      .select('id')
      .single()
    expect(agErr, `agence: ${agErr?.message}`).toBeNull()
    createdAgencyIds.push(agency!.id)

    const { data: events, error: evErr } = await svc
      .from('activity_events')
      .select('entity_type, entity_id, category, severity, object_label, actor_id, actor_kind, metadata')
      .eq('agency_id', agency!.id)
      .eq('action', 'agency_created')
    expect(evErr, `events: ${evErr?.message}`).toBeNull()
    // Un seul : `admin_create_agency` écrivait le sien, le trigger écrit
    // maintenant pour tout le monde — si son insert revenait, ce serait deux.
    expect(events, 'exactement un événement agency_created').toHaveLength(1)

    const evt = events![0]
    expect(evt.entity_type).toBe('agency')
    expect(evt.entity_id).toBe(agency!.id)
    expect(evt.object_label).toBe(name)
    expect(evt.category).toBe('settings')
    // `info` et non `warn` : la console le fait remonter par une règle nommée
    // (useAdminStats), pas en gonflant sa gravité. Le passer en `warn` serait
    // une décision à prendre, pas un effet de bord à subir.
    expect(evt.severity).toBe('info')
    // Contrainte activity_events_actor_kind_coherence : sans créateur connu,
    // l'acteur est la plateforme, donc actor_id nul.
    expect(evt.actor_id).toBeNull()
    expect(evt.actor_kind).toBe('system')

    const meta = evt.metadata as Record<string, unknown>
    expect(meta.plan).toBe('starter')
    expect(meta.solo).toBe(true)
    expect(meta.canton).toBe('GE')
    // Le trigger ne doit pas inventer un contexte admin qu'on ne lui a pas donné.
    expect(meta.admin_created).toBeUndefined()
  })

  it('une agence créée par une personne lui est attribuée', async () => {
    const svc = serviceRoleClient()

    const { data: agency, error: agErr } = await svc
      .from('agencies')
      .insert({
        name: `ZZ Auteur ${STAMP}`, slug: `zz-auteur-${STAMP}`,
        plan: 'pro', status: 'active', created_by: setup.agentAId,
      })
      .select('id')
      .single()
    expect(agErr, `agence: ${agErr?.message}`).toBeNull()
    createdAgencyIds.push(agency!.id)

    const { data: events } = await svc
      .from('activity_events')
      .select('actor_id, actor_kind, metadata')
      .eq('agency_id', agency!.id)
      .eq('action', 'agency_created')
    expect(events).toHaveLength(1)

    // L'autre branche du CASE : un créateur connu impose actor_kind='user',
    // sans quoi la contrainte de cohérence ferait échouer l'INSERT — et donc
    // la création d'agence tout entière.
    expect(events![0].actor_id).toBe(setup.agentAId)
    expect(events![0].actor_kind).toBe('user')
    expect((events![0].metadata as Record<string, unknown>).plan).toBe('pro')
  })
})
