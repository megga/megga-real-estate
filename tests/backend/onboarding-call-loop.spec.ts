// Backend test (live CI) — Appel d'accueil
// (migrations 20260803214105_onboarding_calls / 20260803214110_onboarding_call_reminder_cron).
//
// Ce fichier vise la couche BASE, celle qui arbitre réellement. Le calcul de créneaux
// est couvert à part, en pur, par `supabase/functions/_shared/onboarding-slots.test.ts` :
// ici on vérifie ce qu'aucun module pur ne peut prouver, à savoir que la base refuse ce
// qu'elle doit refuser même quand deux requêtes arrivent en même temps.
//
// Couvre :
//   L1  réservation nominale + jeton de gestion émis.
//   L2  DEUX réservations CONCURRENTES sur le même créneau : une seule passe.
//   L3  une agence ne peut pas accumuler deux appels confirmés.
//   L4  le créneau se libère à l'annulation, et redevient réservable.
//   L5  lecture publique par jeton : forme, et `can_reschedule` sous la limite.
//   L6  jeton inconnu ou nul : aucune donnée.
//   L7  issue d'un appel : `done` et `no_show` acceptés, le reste refusé.
//   L8  isolation : l'agence B ne lit pas l'appel de l'agence A.
//   L9  audit : `actor_kind='system'`, `actor_id` NULL, `category='onboarding'`.
//   L10 les tables du pool n'accordent aucun droit au client.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { execSql } from './helpers/local-sql'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

/** Prochain lundi 09:00 UTC, loin devant, pour ne dépendre d'aucune horloge de CI. */
function futureSlot(offsetDays = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + 30 + offsetDays)
  d.setUTCHours(9, 0, 0, 0)
  return d.toISOString()
}

describe.skipIf(!HAS_KEYS)('appel d accueil — socle base (live)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  let hostId: string
  const callIds: string[] = []

  const insertCall = async (
    agencyId: string,
    bookedBy: string,
    slotIso: string,
  ) => {
    const res = await svc.from('onboarding_calls').insert({
      agency_id: agencyId,
      booked_by: bookedBy,
      host_id: hostId,
      host_display_name: 'Hote Test',
      scheduled_at: slotIso,
      duration_minutes: 30,
    }).select('id, manage_token, status').single()
    if (res.data) callIds.push(res.data.id)
    return res
  }

  /**
   * Repart d'un état sans appel confirmé pour les deux agences du décor.
   *
   * Les deux index partiels se recouvrent : une même ligne peut violer l'un ET
   * l'autre, et Postgres n'en rapporte qu'un. Sans remise à zéro, un test qui vise
   * une garde précise pourrait donc être satisfait par l'autre.
   */
  const clearConfirmed = async (): Promise<void> => {
    await svc.from('onboarding_calls')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .in('agency_id', [setup.agencyAId, setup.agencyBId])
      .eq('status', 'confirmed')
  }

  /** Un appel confirmé neuf pour l'agence A, pour les tests qui en ont besoin. */
  const freshCallForA = async (offsetDays: number) => {
    await clearConfirmed()
    const res = await insertCall(setup.agencyAId, setup.agentAId, futureSlot(offsetDays))
    if (res.error) throw new Error(`fresh call: ${res.error.message}`)
    return res.data!
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()

    // L'hôte est un profil MEGGA : on réutilise l'agent A, seule son identité de
    // profil compte ici (aucune lecture d'agenda dans ces tests).
    const { data, error } = await svc.rpc('admin_upsert_onboarding_host', {
      p_profile_id: setup.agentAId,
      p_display_name: `Hote ${setup.stamp}`,
      p_timezone: 'Europe/Zurich',
      p_weekly_hours: [{ dow: 1, start: '09:00', end: '17:00' }],
      p_slot_minutes: 30,
      p_duration_minutes: 30,
      p_buffer_after_minutes: 0,
      p_min_notice_hours: 0,
      p_horizon_days: 60,
      p_max_per_day: null,
    })
    if (error) throw new Error(`host: ${error.message}`)
    const envelope = data as { ok: boolean; data?: { host_id?: string } }
    expect(envelope.ok).toBe(true)
    hostId = envelope.data!.host_id!
  }, 30_000)

  afterAll(async () => {
    if (callIds.length) await svc.from('onboarding_calls').delete().in('id', callIds)
    if (hostId) await svc.from('onboarding_hosts').delete().eq('id', hostId)
    await setup.cleanup()
    // Les lignes d'`activity_events` posées par L9 ne sont PAS nettoyées : la table
    // refuse toute suppression avant 10 ans (LBA art. 7 al. 3), et le trigger le dit
    // explicitement. Une ligne de ménage ici échouerait en silence — supabase-js rend
    // l'erreur dans `error`, que personne ne lit dans un afterAll — et laisserait
    // croire que le nettoyage a lieu. Mieux vaut l'absence de ligne et cette note.
  }, 30_000)

  it('L1 — réserve, et émet un jeton de gestion', async () => {
    const { data, error } = await insertCall(setup.agencyAId, setup.agentAId, futureSlot(0))
    expect(error).toBeNull()
    expect(data?.status).toBe('confirmed')
    expect(data?.manage_token).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i)
  })

  it('L2 — deux réservations CONCURRENTES sur le même créneau : une seule passe', async () => {
    // ⚠ Le nettoyage préalable EST une partie du test, ne pas le retirer. Une ligne
    // qui viole les DEUX index uniques ne rapporte que le premier violé dans l'ordre
    // de création, c'est-à-dire `host_slot` : l'assertion ci-dessous passerait alors
    // sans rien prouver du créneau. En partant de deux agences sans appel confirmé,
    // le seul index franchissable est celui du créneau.
    await clearConfirmed()

    const slot = futureSlot(1)
    // Les deux requêtes partent AVANT que l'une ait fini. Une revérification
    // applicative les laisserait toutes deux passer ; seul l'index partiel unique
    // (host_id, scheduled_at) where status='confirmed' arbitre.
    const [first, second] = await Promise.all([
      insertCall(setup.agencyAId, setup.agentAId, slot),
      insertCall(setup.agencyBId, setup.agentBId, slot),
    ])

    const ok = [first, second].filter((r) => r.error === null)
    const ko = [first, second].filter((r) => r.error !== null)

    expect(ok).toHaveLength(1)
    expect(ko).toHaveLength(1)
    expect(ko[0].error?.code).toBe('23505')
    expect(ko[0].error?.message).toContain('idx_onboarding_calls_host_slot')
  })

  it('L3 — une agence ne peut pas avoir deux appels confirmés', async () => {
    await clearConfirmed()

    const first = await insertCall(setup.agencyAId, setup.agentAId, futureSlot(2))
    expect(first.error).toBeNull()

    // Créneau DIFFÉRENT, même agence : seul l'index d'agence peut s'y opposer, donc
    // le message ne peut pas venir de l'autre garde.
    const { error } = await insertCall(setup.agencyAId, setup.agentAId, futureSlot(3))
    expect(error).not.toBeNull()
    expect(error?.code).toBe('23505')
    expect(error?.message).toContain('idx_onboarding_calls_agency_active')
  })

  it('L4 — annuler libère le créneau et l agence', async () => {
    await clearConfirmed()

    const slot = futureSlot(4)
    const created = await insertCall(setup.agencyBId, setup.agentBId, slot)
    expect(created.error).toBeNull()

    await svc.from('onboarding_calls')
      .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
      .eq('id', created.data!.id)

    // Même hôte, même instant, même agence : réservable de nouveau, parce que les
    // deux index partiels ne comptent que les lignes `confirmed`.
    const reuse = await insertCall(setup.agencyBId, setup.agentBId, slot)
    expect(reuse.error).toBeNull()
  })

  it('L5 — lecture publique par jeton : forme et droits', async () => {
    const row = await freshCallForA(5)

    const { data, error } = await svc.rpc('get_onboarding_call_by_token', {
      p_token: row.manage_token,
    })
    expect(error).toBeNull()

    const call = data as Record<string, unknown>
    expect(call.status).toBe('confirmed')
    expect(call.host_name).toContain('Hote')
    expect(call.can_manage).toBe(true)
    expect(call.can_reschedule).toBe(true)
    // Le jeton ne doit pas exposer d'identifiants internes de plateforme.
    expect(call).not.toHaveProperty('host_id')
    expect(call).not.toHaveProperty('agency_id')
  })

  it('L5bis — can_reschedule tombe à la limite de replanifications', async () => {
    const row = await freshCallForA(6)

    await svc.from('onboarding_calls').update({ rescheduled_count: 3 }).eq('id', row.id)
    const { data } = await svc.rpc('get_onboarding_call_by_token', { p_token: row.manage_token })
    const call = data as Record<string, unknown>
    // Encore gérable (on peut toujours annuler), mais plus replanifiable.
    expect(call.can_manage).toBe(true)
    expect(call.can_reschedule).toBe(false)
  })

  it('L6 — jeton inconnu ou nul : rien', async () => {
    const unknown = await svc.rpc('get_onboarding_call_by_token', {
      p_token: '00000000-0000-4000-8000-000000000000',
    })
    expect(unknown.error).toBeNull()
    expect(unknown.data).toBeNull()

    const nullToken = await svc.rpc('get_onboarding_call_by_token', { p_token: null })
    expect(nullToken.error).toBeNull()
    expect(nullToken.data).toBeNull()
  })

  it('L7 — issue : done et no_show acceptés, le reste refusé', async () => {
    const row = await freshCallForA(7)

    const bad = await svc.rpc('admin_set_onboarding_call_outcome', {
      p_call_id: row.id, p_status: 'cancelled',
    })
    // Annuler prévient l'agence et touche l'agenda : ce chemin passe par l'edge
    // function, pas par cette RPC. Le refus est la fonctionnalité.
    expect(bad.error).not.toBeNull()
    expect(bad.error?.message).toContain('onboarding_call_invalid_outcome')

    // Enveloppe §10.1 : tout geste de console rend `{ ok, data? }`, jamais une valeur
    // nue, et laisse une ligne au registre `admin_log` (chaîne d'empreintes).
    const good = await svc.rpc('admin_set_onboarding_call_outcome', {
      p_call_id: row.id, p_status: 'done',
    })
    expect(good.error).toBeNull()
    expect((good.data as Record<string, unknown>).ok).toBe(true)

    // `admin_log` n'est PAS lisible via PostgREST, même en service_role : le registre
    // se lit par ses propres RPC. L'assertion passe donc par du SQL, comme les
    // balayages de contrat de la console.
    expect(() => execSql(`
      do $$
      begin
        if not exists (
          select 1 from public.admin_log
           where entity_id = '${row.id}'::uuid
             and action = 'onboarding_call_done'
             and family = 'ops'
        ) then
          raise exception 'le geste n a pas laisse de ligne au registre';
        end if;
      end $$;
    `)).not.toThrow()

    // Rejouer sur une ligne qui n'est plus 'confirmed' ne fait rien, sans lever, et
    // ne journalise pas : le registre raconterait un geste qui n'a pas eu lieu.
    const again = await svc.rpc('admin_set_onboarding_call_outcome', {
      p_call_id: row.id, p_status: 'no_show',
    })
    expect((again.data as Record<string, unknown>).ok).toBe(false)

    expect(() => execSql(`
      do $$
      begin
        if exists (
          select 1 from public.admin_log
           where entity_id = '${row.id}'::uuid and action = 'onboarding_call_no_show'
        ) then
          raise exception 'un geste sans effet a quand meme journalise';
        end if;
      end $$;
    `)).not.toThrow()
  })

  it('L8 — isolation : l agence B ne lit pas l appel de l agence A', async () => {
    await freshCallForA(8)

    const { data: mine } = await setup.clientB
      .from('onboarding_calls')
      .select('id, agency_id')

    // RLS répond par un ensemble vide, pas par une erreur : on vérifie donc le
    // CONTENU, seule preuve que le filtre a bien porté.
    for (const row of mine ?? []) {
      expect(row.agency_id).toBe(setup.agencyBId)
    }
    expect((mine ?? []).some((r) => r.agency_id === setup.agencyAId)).toBe(false)
  })

  it('L9 — audit : actor_kind system, actor_id nul, catégorie onboarding', async () => {
    const call = await freshCallForA(9)

    const { error } = await svc.from('activity_events').insert({
      agency_id: setup.agencyAId,
      actor_id: null,
      actor_kind: 'system',
      action: 'onboarding_call_booked',
      entity_type: 'onboarding_call',
      entity_id: call.id,
      category: 'onboarding',
      severity: 'info',
      object_label: `Test ${setup.stamp}`,
      metadata: { host_id: hostId },
    })
    // Sans l'élargissement du CHECK par la migration, cette insertion échouerait :
    // c'est ce qui prouve que la catégorie existe réellement en base.
    expect(error).toBeNull()

    // Et la contrainte de cohérence tient toujours : un actor_id renseigné force
    // actor_kind='user'.
    const { error: incoherent } = await svc.from('activity_events').insert({
      agency_id: setup.agencyAId,
      actor_id: setup.agentAId,
      actor_kind: 'system',
      action: 'onboarding_call_booked',
      entity_type: 'onboarding_call',
      category: 'onboarding',
      severity: 'info',
    })
    expect(incoherent).not.toBeNull()
  })

  it('L10 — les tables du pool n accordent aucun droit au client', async () => {
    // Pas de grant du tout : la lecture échoue par PRIVILÈGE, pas par RLS. C'est
    // volontaire, et c'est plus fort qu'une policy : aucune policy écrite plus tard
    // ne pourra rouvrir ces tables sans repasser par un GRANT explicite.
    const hosts = await setup.clientA.from('onboarding_hosts').select('id')
    expect(hosts.error).not.toBeNull()

    const exceptions = await setup.clientA.from('onboarding_host_exceptions').select('id')
    expect(exceptions.error).not.toBeNull()
  })

  it('L11 — un fuseau inconnu est refusé à la création d un hôte', async () => {
    const { error } = await svc.rpc('admin_upsert_onboarding_host', {
      p_profile_id: setup.agentBId,
      p_display_name: 'Hote fuseau faux',
      p_timezone: 'Mars/Olympus_Mons',
      p_weekly_hours: [],
      p_slot_minutes: 30,
      p_duration_minutes: 30,
      p_buffer_after_minutes: 0,
      p_min_notice_hours: 0,
      p_horizon_days: 30,
      p_max_per_day: null,
    })
    // Un fuseau inconnu ne doit pas se découvrir au moment de calculer les créneaux,
    // hors de portée de l'écran qui l'a posé.
    expect(error).not.toBeNull()
    expect(error?.message).toContain('unknown timezone')
  })

  it('L12 — une plage hebdomadaire mal formée est refusée', async () => {
    const bad = [
      [{ dow: 8, start: '09:00', end: '12:00' }],
      [{ dow: 1, start: '12:00', end: '09:00' }],
      [{ dow: 1, start: '9:00', end: '12:00' }],
    ]
    for (const weekly of bad) {
      const { error } = await svc.rpc('admin_upsert_onboarding_host', {
        p_profile_id: setup.agentBId,
        p_display_name: 'Hote plage fausse',
        p_timezone: 'Europe/Zurich',
        p_weekly_hours: weekly,
        p_slot_minutes: 30,
        p_duration_minutes: 30,
        p_buffer_after_minutes: 0,
        p_min_notice_hours: 0,
        p_horizon_days: 30,
        p_max_per_day: null,
      })
      expect(error?.message).toContain('bad weekly_hours slice')
    }
  })
})
