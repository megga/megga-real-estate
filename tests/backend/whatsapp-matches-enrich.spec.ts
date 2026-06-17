// Backend test (live CI) — Anti-fabrication LOT 1 : enrichissement des retours d'outils
// (execGetMatches + execGetMyAgenda dans _shared/whatsapp-actions.ts).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : exécuté contre un Supabase local seedé. C'est le SEUL
// test qui exerce réellement les exécuteurs whatsapp-actions (import Deno https résolu par le
// harnais backend) → il vérifie aussi que l'embed PostgREST FK est CORRECT (un mauvais nom de
// FK ferait planter l'outil au runtime, pas au build).
//
// Couvre :
//   E1 get_matches : retour enrichi {biens:[{titre,montant,ville,...}]} — PLUS d'UUID nus
//      (le modèle ne peut plus inventer un bien sur un id seul). property résolue.
//   E2 get_matches : un match dont le bien ne résout PAS (property d'une AUTRE agence, filtrée par
//      .eq(agency_id)) → objet {id,score,statut} SANS titre/montant inventés (branche non résolue réelle).
//   E3 get_my_agenda : l'embed contacts/properties (FK visits_contact_id_fkey / _property_id_fkey)
//      résout le client + le bien ; aucun UUID ni buyer_name nu dans le retour.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'
import { execGetMatches, execGetMyAgenda, type ActionCtx } from '../../supabase/functions/_shared/whatsapp-actions'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('anti-fabrication LOT 1 — enrichissement get_matches / get_my_agenda (live)', () => {
  let setup: TwoAgenciesSetup
  let svc: SupabaseClient
  let ctx: ActionCtx

  const contactIds: string[] = []
  const matchIds: string[] = []
  const visitIds: string[] = []
  let propId = ''   // bien de l'agence A (résout)
  let propBId = ''  // bien de l'agence B (jamais résolu par le filtre agency_id de A → orphelin réel)
  let cMatch = ''   // contact avec un match résolu (property A)
  let cOrphan = ''  // contact avec un match dont le bien (agence B) ne résout pas côté A
  let cVisit = ''   // contact d'une visite (agenda)

  const mkContact = async (tag: string): Promise<string> => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: setup.agencyAId, first_name: 'ENRICH', last_name: `${tag}-${setup.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contact ${tag}: ${error.message}`)
    contactIds.push(data.id)
    return data.id
  }

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    svc = serviceRoleClient()
    ctx = { supabase: svc, profileId: setup.agentAId, agencyId: setup.agencyAId, lang: 'fr' }

    const { data: prop, error: pe } = await svc.from('properties').insert({
      agency_id: setup.agencyAId, title: `Appartement ENRICH ${setup.stamp}`,
      type: 'apartment', status: 'draft', transaction_type: 'buy', price: 1850000, city: 'Genève', rooms: 4,
    }).select('id').single()
    if (pe) throw new Error(`property: ${pe.message}`)
    propId = prop.id

    // Bien de l'AGENCE B : FK matches_property_id_fkey satisfaite (la property existe), mais
    // resolveMatchListings filtre properties par .eq('agency_id', agencyA) → ce bien n'est JAMAIS
    // résolu pour un match de l'agence A. C'est l'orphelin réel (branche non résolue de projectMatchListing).
    const { data: propB, error: pbe } = await svc.from('properties').insert({
      agency_id: setup.agencyBId, title: `Bien AUTRE AGENCE ${setup.stamp}`,
      type: 'apartment', status: 'draft', transaction_type: 'buy', price: 999000, city: 'Lausanne',
    }).select('id').single()
    if (pbe) throw new Error(`propertyB: ${pbe.message}`)
    propBId = propB.id

    cMatch = await mkContact('Match')
    cOrphan = await mkContact('Orphan')
    cVisit = await mkContact('Visit')

    const mk = async (contactId: string, propertyId: string | null, mlId: string | null): Promise<string> => {
      const { data, error } = await svc.from('matches').insert({
        agency_id: setup.agencyAId, contact_id: contactId, property_id: propertyId,
        market_listing_id: mlId, score: 88, status: 'suggested', source: 'internal',
      }).select('id').single()
      if (error) throw new Error(`match: ${error.message}`)
      matchIds.push(data.id)
      return data.id
    }
    await mk(cMatch, propId, null)
    // Match de l'agence A pointant un bien de l'agence B → non résolu côté A (vrai orphelin).
    await mk(cOrphan, propBId, null)

    // visite pour l'agenda (agent_id = profileId, sinon execGetMyAgenda la filtre)
    const { data: v, error: ve } = await svc.from('visits').insert({
      agency_id: setup.agencyAId, agent_id: setup.agentAId, contact_id: cVisit, property_id: propId,
      scheduled_at: new Date(Date.now() + 86400_000).toISOString(), status: 'planned',
    }).select('id').single()
    if (ve) throw new Error(`visit: ${ve.message}`)
    visitIds.push(v.id)
  })

  afterAll(async () => {
    if (!svc) return
    if (visitIds.length) await svc.from('visits').delete().in('id', visitIds)
    if (matchIds.length) await svc.from('matches').delete().in('id', matchIds)
    const props = [propId, propBId].filter(Boolean)
    if (props.length) await svc.from('properties').delete().in('id', props)
    if (contactIds.length) await svc.from('contacts').delete().in('id', contactIds)
    await setup.cleanup()
  })

  it('E1 — get_matches renvoie des biens ENRICHIS (titre/montant/ville), plus d\'UUID nus', async () => {
    const raw = await execGetMatches(ctx, { contact_id: cMatch })
    const out = JSON.parse(raw) as { biens: Array<Record<string, unknown>> }
    expect(Array.isArray(out.biens)).toBe(true)
    expect(out.biens.length).toBeGreaterThanOrEqual(1)
    const b = out.biens[0]
    expect(b.titre).toBe(`Appartement ENRICH ${setup.stamp}`)
    expect(b.montant).toBe(1850000)
    expect(b.ville).toBe('Genève')
    // anti-fabrication : aucune clé d'UUID brut exposée au modèle.
    expect(b).not.toHaveProperty('property_id')
    expect(b).not.toHaveProperty('market_listing_id')
  })

  it('E2 — bien non résolu (autre agence) → AUCUN titre/montant inventé (que id/score/statut)', async () => {
    const raw = await execGetMatches(ctx, { contact_id: cOrphan })
    const out = JSON.parse(raw) as { biens: Array<Record<string, unknown>> }
    expect(out.biens.length).toBe(1)
    const b = out.biens[0]
    // Le bien de l'agence B n'est pas résolu côté A → le modèle ne reçoit RIEN à habiller.
    expect(b).not.toHaveProperty('titre')
    expect(b).not.toHaveProperty('montant')
    expect(b).not.toHaveProperty('ville')
    // …mais jamais une clé vide : ce qui est présent est réel (id/score/statut).
    expect(typeof b.id).toBe('string')
    expect(b.score).toBe(88)
    expect(b.statut).toBe('suggested')
    for (const k of Object.keys(b)) expect(b[k]).not.toBeNull()
  })

  it('E3 — get_my_agenda : embed FK résout client + bien, aucun UUID/buyer_name nu', async () => {
    const from = new Date(Date.now() - 86400_000).toISOString()
    const to = new Date(Date.now() + 3 * 86400_000).toISOString()
    const raw = await execGetMyAgenda(ctx, { from, to })
    // Si l'embed FK était mauvais, l'outil renverrait « Erreur agenda: ... » → on l'exclut.
    expect(raw.startsWith('Erreur')).toBe(false)
    const out = JSON.parse(raw) as Array<Record<string, unknown>>
    const mine = out.find((v) => v.bien === `Appartement ENRICH ${setup.stamp}`)
    expect(mine, 'la visite seedée doit apparaître avec le bien résolu').toBeDefined()
    expect(mine!.client).toBe(`ENRICH Visit-${setup.stamp}`)
    expect(mine!).not.toHaveProperty('contact_id')
    expect(mine!).not.toHaveProperty('buyer_name')
  })
})
