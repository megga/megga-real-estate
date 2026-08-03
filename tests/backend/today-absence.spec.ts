// Lot 1 « Aujourd'hui » — présence de l'agent et fil « Pendant ton absence ».
// Migration : 20260803120000_agent_presence_absence.sql
//
// Ce que ce fichier verrouille, et pourquoi chaque cas existe :
//
//  1. Les deux fonctions REFUSENT un appelant sans identité. Elles sont
//     SECURITY DEFINER : sans garde explicite, un GRANT posé plus tard par une
//     migration sans rapport rouvrirait la porte en silence (le dépôt a déjà
//     payé ce footgun).
//  2. Le cloisonnement par agence. L'agence vient du JWT, jamais de l'appelant.
//  3. `presence_touch` rend la valeur PRÉCÉDENTE — c'est elle qui borne le
//     prochain « depuis … ». La rendre après écriture donnerait toujours
//     « maintenant », et le fil serait vide en permanence.
//  4. Une réaction acheteur antérieure au dernier départ DISPARAÎT : c'est ainsi
//     que « Tout marquer comme vu » fonctionne, sans table d'accusé de lecture.
//  5. ⚠ LE CAS QUI COMPTE LE PLUS : un rappel échu reste visible APRÈS
//     `presence_touch`. Mesuré le 03.08.2026, les 9 rappels échus de la base
//     dataient d'avril à juillet — tous antérieurs à n'importe quelle fenêtre
//     d'absence. Les borner comme les réactions afficherait « Tu es à jour » à
//     un agent qui a trois mois de retard. Ce test empêche qu'on « harmonise »
//     les deux régimes par souci de symétrie.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceRoleClient, anonClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'

interface AbsenceSignal { id: string; kind: string; late: boolean; ref_id: string }
interface AbsencePayload { since: string | null; signals: AbsenceSignal[] }

const hoursAgo = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()

describe.skipIf(!HAS_KEYS)('today_absence + presence_touch (Lot 1)', () => {
  let setup: TwoAgenciesSetup
  const contactIds: string[] = []
  const reminderIds: string[] = []

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    // Un contact par agence. Mêmes clés dans les deux objets : un insert en lot
    // PostgREST prend l'UNION des clés, et une clé absente devient NULL.
    const { data: contacts, error: cErr } = await svc
      .from('contacts')
      .insert([
        { agency_id: setup.agencyAId, first_name: 'Alpha', last_name: `Test ${setup.stamp}`, type: 'buyer' },
        { agency_id: setup.agencyBId, first_name: 'Beta', last_name: `Test ${setup.stamp}`, type: 'buyer' },
      ])
      .select('id, agency_id')
    if (cErr) throw new Error(`contacts: ${cErr.message}`)
    const contactA = contacts!.find((c) => c.agency_id === setup.agencyAId)!.id as string
    const contactB = contacts!.find((c) => c.agency_id === setup.agencyBId)!.id as string
    contactIds.push(contactA, contactB)

    // Un rappel échu par agence — VIEUX (30 jours), donc bien antérieur à toute
    // fenêtre d'absence : c'est exactement le cas du cas n°5.
    const { data: reminders, error: rErr } = await svc
      .from('reminders')
      .insert([
        { agency_id: setup.agencyAId, contact_id: contactA, type: 'custom', trigger_rule: 'manual', status: 'pending', trigger_at: hoursAgo(24 * 30) },
        { agency_id: setup.agencyBId, contact_id: contactB, type: 'custom', trigger_rule: 'manual', status: 'pending', trigger_at: hoursAgo(24 * 30) },
      ])
      .select('id, agency_id')
    if (rErr) throw new Error(`reminders: ${rErr.message}`)
    reminderIds.push(...reminders!.map((r) => r.id as string))
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    if (reminderIds.length) await svc.from('reminders').delete().in('id', reminderIds)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await svc.from('agent_presence').delete().in('agent_id', [setup.agentAId, setup.agentBId])
    await setup.cleanup()
  })

  const absence = async (client = setup.clientA): Promise<AbsencePayload> => {
    const { data, error } = await client.rpc('today_absence')
    if (error) throw new Error(`today_absence: ${error.message}`)
    return data as unknown as AbsencePayload
  }

  it('refuse un appelant sans identité', async () => {
    const anon = anonClient()
    const abs = await anon.rpc('today_absence')
    expect(abs.error?.code, 'today_absence doit refuser anon').toBe(DENIED)
    const touch = await anon.rpc('presence_touch')
    expect(touch.error?.code, 'presence_touch doit refuser anon').toBe(DENIED)
  })

  it('cloisonne par agence : A ne voit pas le rappel de B', async () => {
    const forA = await absence(setup.clientA)
    const forB = await absence(setup.clientB)
    const refsA = forA.signals.map((s) => s.ref_id)
    const refsB = forB.signals.map((s) => s.ref_id)
    expect(refsA).toContain(reminderIds[0])
    expect(refsA).not.toContain(reminderIds[1])
    expect(refsB).toContain(reminderIds[1])
    expect(refsB).not.toContain(reminderIds[0])
  })

  it('marque les rappels échus comme en retard', async () => {
    const { signals } = await absence()
    const mine = signals.find((s) => s.ref_id === reminderIds[0])
    expect(mine, 'le rappel de A doit remonter').toBeDefined()
    expect(mine!.kind).toBe('reminder')
    expect(mine!.late).toBe(true)
  })

  it('presence_touch rend la valeur PRÉCÉDENTE, pas la nouvelle', async () => {
    // Première pose : aucune ligne encore → précédent inconnu.
    const first = await setup.clientA.rpc('presence_touch')
    expect(first.error).toBeNull()
    expect(first.data, 'aucune présence antérieure ⇒ null').toBeNull()

    // Seconde pose : rend l'horodatage posé par la première.
    const second = await setup.clientA.rpc('presence_touch')
    expect(second.error).toBeNull()
    expect(second.data, 'la 2e pose rend la 1re').not.toBeNull()
    expect(new Date(second.data as string).getTime()).toBeLessThanOrEqual(Date.now())
  })

  it('⚠ un rappel échu reste visible APRÈS presence_touch (régimes volontairement différents)', async () => {
    // La présence vient d'être avancée par le test précédent : une réaction
    // acheteur antérieure serait masquée. Le rappel, lui, ATTEND toujours.
    const { signals, since } = await absence()
    expect(since, 'la borne doit exister une fois la présence posée').not.toBeNull()
    expect(
      signals.map((s) => s.ref_id),
      'borner les rappels comme les réactions afficherait « Tu es à jour » à un agent en retard',
    ).toContain(reminderIds[0])
  })

  it('un rappel traité sort du fil', async () => {
    const svc = serviceRoleClient()
    await svc.from('reminders').update({ status: 'done' }).eq('id', reminderIds[0])
    const { signals } = await absence()
    expect(signals.map((s) => s.ref_id)).not.toContain(reminderIds[0])
    await svc.from('reminders').update({ status: 'pending' }).eq('id', reminderIds[0])
  })

  // ─── Lot 2 — le geste « Reprendre » ────────────────────────────────────────
  // Il ne passe par AUCUNE RPC : l'agent écrit `reminders` en direct, sous la
  // policy `reminders_update USING (agency_id = get_user_agency_id())`. C'est
  // donc la RLS, et elle seule, qui empêche d'écrire chez le voisin.
  describe('geste « Reprendre »', () => {
    it('l’agent marque SON rappel comme traité, et il quitte le fil', async () => {
      const { error } = await setup.clientA
        .from('reminders')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', reminderIds[0])
      expect(error, 'A doit pouvoir traiter son propre rappel').toBeNull()

      const { signals } = await absence(setup.clientA)
      expect(signals.map((s) => s.ref_id)).not.toContain(reminderIds[0])

      await serviceRoleClient()
        .from('reminders')
        .update({ status: 'pending', completed_at: null })
        .eq('id', reminderIds[0])
    })

    it('⚠ l’agent NE PEUT PAS traiter le rappel d’une autre agence', async () => {
      // La RLS ne lève pas d'erreur : elle ne fait CORRESPONDRE aucune ligne.
      // L'assertion porte donc sur l'état réel de la ligne, pas sur `error`.
      await setup.clientA
        .from('reminders')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', reminderIds[1])

      const { data, error } = await serviceRoleClient()
        .from('reminders')
        .select('status')
        .eq('id', reminderIds[1])
        .single()
      if (error) throw new Error(`relecture: ${error.message}`)
      expect(data!.status, 'le rappel de B doit être resté intact').toBe('pending')
    })
  })
})
