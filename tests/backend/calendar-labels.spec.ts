// Libellés du Calendrier (13.09.2026) : RLS de `calendar_labels`, les deux RPC
// (`calendar_set_event_label`, `calendar_label_assignments`), la clé composite
// qui interdit le libellé d'une AUTRE agence, et le SET NULL à la suppression.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Calendrier — libellés : RLS, RPC, clé composite', () => {
  let s: TwoAgenciesSetup
  let service: SupabaseClient
  let labelAId: string
  let labelBId: string
  let rappelAId: string
  let rappelBId: string
  /** Contacts semés par ce fichier : à supprimer AVANT les agences (FK NO ACTION). */
  const contacts: string[] = []
  const debut = new Date(Date.now() - 7 * 86_400_000).toISOString()
  const fin = new Date(Date.now() + 7 * 86_400_000).toISOString()

  const mkRappel = async (agencyId: string, suffixe: string) => {
    const { data: c, error: cErr } = await service.from('contacts').insert({
      agency_id: agencyId, first_name: 'Test', last_name: `Libellé ${suffixe}`, email: `cal-${suffixe}-${s.stamp}@example.ch`, type: 'buyer',
    }).select('id').single()
    if (cErr) throw new Error(`contacts: ${cErr.message}`)
    contacts.push(c.id as string)
    const { data, error } = await service.from('reminders').insert({
      agency_id: agencyId, contact_id: c.id, type: 'custom', trigger_rule: 'manual',
      status: 'pending', trigger_at: new Date().toISOString(),
    }).select('id').single()
    if (error) throw new Error(`reminders: ${error.message}`)
    return data.id as string
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    service = serviceRoleClient()
    rappelAId = await mkRappel(s.agencyAId, 'a')
    rappelBId = await mkRappel(s.agencyBId, 'b')
    const { data: lb, error: lbErr } = await service.from('calendar_labels')
      .insert({ agency_id: s.agencyBId, name: `Chez B ${s.stamp}`, color: '#00aa55' }).select('id').single()
    if (lbErr) throw new Error(lbErr.message)
    labelBId = lb.id
  }, 90_000)

  afterAll(async () => {
    if (!s) return
    await service.from('reminders').delete().in('id', [rappelAId, rappelBId])
    await service.from('calendar_labels').delete().in('agency_id', [s.agencyAId, s.agencyBId])
    // ⚠ Sans ça, `cleanup()` échoue EN SILENCE sur la suppression des agences
    // (contacts_agency_id_fkey NO ACTION) et chaque passage laisse deux agences.
    if (contacts.length) await service.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('un agent crée un libellé DANS son agence, pas dans une autre', async () => {
    const { data, error } = await s.clientA.from('calendar_labels')
      .insert({ agency_id: s.agencyAId, name: `Urgent ${s.stamp}`, color: '#fe566b' }).select('id').single()
    expect(error).toBeNull()
    labelAId = data!.id
    const { error: croise } = await s.clientA.from('calendar_labels')
      .insert({ agency_id: s.agencyBId, name: `Intrus ${s.stamp}`, color: '#123456' })
    expect(croise, 'WITH CHECK : un libellé chez une autre agence doit être refusé').not.toBeNull()
  })

  it('la couleur est un hexadécimal, le nom tient en 40 caractères', async () => {
    const { error: couleur } = await s.clientA.from('calendar_labels')
      .insert({ agency_id: s.agencyAId, name: `Rouge ${s.stamp}`, color: 'red' })
    expect(couleur).not.toBeNull()
    const { error: nom } = await s.clientA.from('calendar_labels')
      .insert({ agency_id: s.agencyAId, name: 'x'.repeat(41), color: '#aabbcc' })
    expect(nom).not.toBeNull()
  })

  it('les libellés d’une agence sont invisibles pour l’autre', async () => {
    const { data } = await s.clientB.from('calendar_labels').select('id')
    const ids = (data ?? []).map((l) => l.id)
    expect(ids).toContain(labelBId)
    expect(ids).not.toContain(labelAId)
  })

  it('poser son libellé sur son événement, puis le lire par les affectations', async () => {
    const { error } = await s.clientA.rpc('calendar_set_event_label', { p_source: 'reminder', p_event_id: rappelAId, p_label_id: labelAId })
    expect(error).toBeNull()
    const { data } = await s.clientA.rpc('calendar_label_assignments', { p_from: debut, p_to: fin })
    expect(data).toContainEqual({ source: 'reminder', event_id: rappelAId, label_id: labelAId })
    const { data: chezB } = await s.clientB.rpc('calendar_label_assignments', { p_from: debut, p_to: fin })
    expect((chezB ?? []).map((a) => a.event_id), 'B ne lit pas les affectations de A').not.toContain(rappelAId)
  })

  it('le libellé d’une AUTRE agence est refusé, par la RPC comme en écriture directe', async () => {
    const { error: rpc } = await s.clientA.rpc('calendar_set_event_label', { p_source: 'reminder', p_event_id: rappelAId, p_label_id: labelBId })
    // ⚠ Le MOTIF, pas seulement « une erreur » : sans la vérification de la RPC, la
    // clé composite refuserait aussi (23503) et l'assertion passerait à vide.
    expect(rpc?.code, 'la RPC vérifie elle-même l’agence du libellé').toBe('P0002')
    expect(rpc?.message).toMatch(/label not found/)
    // Voie directe, en service-role (hors RLS) : c'est la CLÉ COMPOSITE qui tient.
    const { error: direct } = await service.from('reminders').update({ calendar_label_id: labelBId }).eq('id', rappelAId)
    expect(direct, 'clé (calendar_label_id, agency_id) : un libellé d’une autre agence est impossible').not.toBeNull()
  })

  it('on ne libelle pas l’événement d’une autre agence', async () => {
    const { error } = await s.clientB.rpc('calendar_set_event_label', { p_source: 'reminder', p_event_id: rappelAId, p_label_id: labelBId })
    expect(error?.code, 'l’événement de A est introuvable pour B').toBe('P0002')
    const { data } = await service.from('reminders').select('calendar_label_id').eq('id', rappelAId).single()
    expect(data?.calendar_label_id).toBe(labelAId)
  })

  /**
   * ⛔ LE CAS QUE SEUL LE FILTRE D'AGENCE DE LA RPC TIENT. Retirer un libellé
   * (p_label_id omis) écrit NULL, que la clé composite ne vérifie pas (MATCH
   * SIMPLE) : sans `agency_id = v_agency` dans les UPDATE, B effacerait le
   * libellé de A. Les cas précédents ne le prouvaient pas — ils passent aussi par
   * la clé.
   */
  it('on ne RETIRE pas le libellé de l’événement d’une autre agence', async () => {
    const { error } = await s.clientB.rpc('calendar_set_event_label', { p_source: 'reminder', p_event_id: rappelAId })
    expect(error?.code).toBe('P0002')
    const { data } = await service.from('reminders').select('calendar_label_id').eq('id', rappelAId).single()
    expect(data?.calendar_label_id, 'le libellé de A doit être intact').toBe(labelAId)
  })

  it('omettre le libellé le RETIRE', async () => {
    const { error } = await s.clientA.rpc('calendar_set_event_label', { p_source: 'reminder', p_event_id: rappelAId })
    expect(error).toBeNull()
    const { data } = await service.from('reminders').select('calendar_label_id').eq('id', rappelAId).single()
    expect(data?.calendar_label_id).toBeNull()
  })

  it('supprimer un libellé le retire des événements, sans toucher à leur agence', async () => {
    await s.clientA.rpc('calendar_set_event_label', { p_source: 'reminder', p_event_id: rappelAId, p_label_id: labelAId })
    const { error } = await s.clientA.from('calendar_labels').delete().eq('id', labelAId)
    expect(error).toBeNull()
    const { data } = await service.from('reminders').select('calendar_label_id, agency_id').eq('id', rappelAId).single()
    expect(data?.calendar_label_id, 'ON DELETE SET NULL (calendar_label_id)').toBeNull()
    expect(data?.agency_id, 'la clé composite ne doit PAS vider l’agence').toBe(s.agencyAId)
  })

  it('un anonyme n’appelle aucune des deux RPC — c’est le REVOKE qui le dit', async () => {
    const anon = anonClient()
    // ⚠ Le message, pas le code : sans le REVOKE, l'appel échouerait AUSSI en 42501
    // (« no agency », auth.uid() nul) — seul « permission denied » prouve le droit.
    const { error: lire } = await anon.rpc('calendar_label_assignments', { p_from: debut, p_to: fin })
    expect(lire?.message).toMatch(/permission denied/)
    const { error: poser } = await anon.rpc('calendar_set_event_label', { p_source: 'reminder', p_event_id: rappelAId })
    expect(poser?.message).toMatch(/permission denied/)
  })
})
