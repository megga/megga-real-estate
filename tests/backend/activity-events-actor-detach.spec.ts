// Supprimer un compte qui a laissé une trace dans le journal d'audit.
//
// Ce test existe à cause de la panne qu'il empêche. `activity_events.actor_id`
// porte une FK `ON DELETE SET NULL` vers `profiles`, elle-même en cascade de
// `auth.users` : supprimer un compte émet donc `UPDATE activity_events SET
// actor_id = NULL`. Le garde append-only refusait cette écriture — sa branche
// « anonymisation nLPD » exige `actor_kind = 'system'` EN PLUS, et une FK ne pose
// jamais deux colonnes. Conséquence observée cinq fois en production le
// 01.08.2026 : tout compte ayant travaillé une journée devenait indestructible,
// avec un 500 « activity_events est append-only » à chaque tentative.
//
// Le même piège avait déjà frappé sur l'autre FK de la table (agency_id, migration
// 20260729151800) ; celle-ci est sa jumelle pour l'acteur.
//
// Deux choses sont vérifiées, et il faut les deux : que la suppression PASSE, et
// que la ligne d'audit SURVIVE. Un correctif qui laisserait partir la ligne avec
// le compte ferait passer la première assertion en violant la LBA.
//
// ⚠ L'événement est relu AVANT la suppression, et l'assertion porte sur sa
// présence. Sans ce premier passage, une lecture vide (droits, RLS, schéma qui
// bouge) rendrait le test vert sans avoir rien éprouvé.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('suppression de compte — le journal survit à son acteur', () => {
  let setup: TwoAgenciesSetup
  let eventId: string

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    // L'événement a plus de dix ans ? Non : le garde refuse sa suppression, et
    // c'est voulu. On le laisse — il ne pointe plus vers personne, et l'agence
    // que `cleanup()` supprime le détachera aussi de son agency_id.
    await setup?.cleanup()
  })

  it('un compte qui a journalisé se supprime, et sa ligne d audit reste sans acteur', async () => {
    const svc = serviceRoleClient()

    // 1. L'agent laisse une trace, comme n'importe quelle action du CRM en laisse une.
    const { data: inserted, error: insErr } = await svc
      .from('activity_events')
      .insert({
        agency_id: setup.agencyAId,
        actor_id: setup.agentAId,
        actor_kind: 'user',
        action: 'contact_created',
        entity_type: 'contact',
        // Les huit familles admises par activity_events_category_check :
        // kyc, deal, contact, bien, doc, auth, settings, ai. Pas de 'crm'.
        category: 'contact',
        severity: 'info',
        object_label: `ZZ Detach ${setup.stamp}`,
        metadata: { source: 'activity-events-actor-detach.spec' },
      })
      .select('id, actor_id, action, entity_type, created_at, object_label')
      .single()
    expect(insErr, `insert event: ${insErr?.message}`).toBeNull()
    eventId = inserted!.id
    // Non-vacuité : on tient bien une ligne, avec son acteur, avant de supprimer.
    expect(inserted!.actor_id).toBe(setup.agentAId)

    const before = inserted!

    // 2. La suppression du compte. C'est elle qui répondait 500 en production.
    const { error: delErr } = await svc.auth.admin.deleteUser(setup.agentAId)
    expect(delErr, `deleteUser: ${delErr?.message}`).toBeNull()

    // 3. Le profil est bien parti (la cascade a joué).
    const { data: profile } = await svc
      .from('profiles').select('id').eq('id', setup.agentAId).maybeSingle()
    expect(profile, 'le profil doit disparaître avec le compte').toBeNull()

    // 4. …et la ligne d'audit est TOUJOURS là, amputée de son seul acteur.
    const { data: after, error: readErr } = await svc
      .from('activity_events')
      .select('id, actor_id, actor_kind, agency_id, action, entity_type, created_at, object_label, metadata')
      .eq('id', eventId)
      .maybeSingle()
    expect(readErr, `relecture: ${readErr?.message}`).toBeNull()
    expect(after, 'la ligne d audit ne doit JAMAIS disparaître (LBA art. 7 al. 3)').not.toBeNull()

    expect(after!.actor_id, 'l acteur est détaché').toBeNull()
    // `actor_kind` ne ment pas : c'est bien une personne qui a agi, on a perdu son
    // nom. Le forcer à 'system' raconterait que la machine a fait le geste.
    expect(after!.actor_kind).toBe('user')

    // Le CONTENU du journal, lui, est intact — c'est ce que protège la LBA.
    expect(after!.action).toBe(before.action)
    expect(after!.entity_type).toBe(before.entity_type)
    expect(after!.created_at).toBe(before.created_at)
    expect(after!.object_label).toBe(before.object_label)
    expect(after!.agency_id).toBe(setup.agencyAId)
    expect(after!.metadata?.source, 'les métadonnées d origine survivent').toBe(
      'activity-events-actor-detach.spec',
    )

    // Et la preuve du détachement, pour qu'un relecteur n'ait pas à la deviner.
    expect(after!.metadata?.actor_detached_reason).toBe('profile deleted (FK on delete set null)')
    expect(after!.metadata?.actor_detached_from).toBe(setup.agentAId)
    expect(after!.metadata?.actor_detached_at, 'horodatage du détachement').toBeTruthy()
  })

  it('réattribuer un événement à un autre acteur reste refusé', async () => {
    // Le correctif ouvre UN chemin : actor_id -> NULL. Il ne rend pas la colonne
    // modifiable. Sans cette assertion, élargir la branche par mégarde à
    // « actor_id peut changer » passerait inaperçu.
    expect(eventId, 'le premier cas doit avoir créé la ligne : sans elle, ce test accuserait le garde à tort').toBeTruthy()
    const svc = serviceRoleClient()
    const { error } = await svc
      .from('activity_events')
      .update({ actor_id: setup.agentBId })
      .eq('id', eventId)
    expect(error, 'une réattribution doit être refusée par le garde').not.toBeNull()
    expect(error!.message).toContain('append-only')
  })
})
