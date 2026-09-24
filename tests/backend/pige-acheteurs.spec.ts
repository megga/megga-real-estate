// Matching · lot D1 — `pige_acheteurs_compatibles` (migration …_matching_surfaces.sql).
//   P1  les acheteurs compatibles d'une annonce : à proposer (reporté compris), proposé, intéressé, en visite — jamais
//       un refus ni un écarté.
//   P2  un acheteur ne compte qu'une fois par annonce : l'index unique `uq_matches_contact_market` refuse un second match,
//       et le compte est `count(distinct)` de toute façon.
//   P3  le cloisonnement : les matchs d'une autre agence ne comptent pas.
//   P4  une annonce sans acheteur ne rend pas de ligne ; 30 identifiants au plus sont lus ; un appelant anonyme est refusé.
// Tourne contre `supabase start` (SUPABASE_TEST_*), jamais la prod. skipIf sans clés.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { anonClient, serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const dansJours = (jours: number) => new Date(Date.now() + jours * 86_400_000).toISOString()

describe.skipIf(!HAS_KEYS)('matching · lot D1 — les acheteurs de la pige', () => {
  let s: TwoAgenciesSetup
  let svc: SupabaseClient
  const contacts: string[] = []
  const annonces: string[] = []
  const matchs: string[] = []
  let annonce = '', vide = '', lointaine = '', propose = ''

  const mkContact = async (agencyId: string, nom: string) => {
    const { data, error } = await svc.from('contacts').insert({
      agency_id: agencyId, first_name: 'Pige', last_name: `${nom} ${s.stamp}`, type: 'buyer',
    }).select('id').single()
    if (error) throw new Error(`contacts ${nom}: ${error.message}`)
    contacts.push(data.id as string)
    return data.id as string
  }
  const mkAnnonce = async (tag: string) => {
    const { data, error } = await svc.from('market_listings').insert({
      source_id: `pige-d1-${tag}-${s.stamp}`, source_portal: 'flatfox', title: `Pige D1 ${tag} ${s.stamp}`, city: 'Genève',
      canton: 'GE', type: 'apartment', transaction_type: 'buy', price: 1_200_000, current_price: 1_200_000, quality_score: 70, status: 'active',
    }).select('id').single()
    if (error) throw new Error(`market_listings ${tag}: ${error.message}`)
    annonces.push(data.id as string)
    return data.id as string
  }
  const mkMatch = async (agencyId: string, contactId: string, annonceId: string, champs: Record<string, unknown> = {}) => {
    const { data, error } = await svc.from('matches').insert({
      agency_id: agencyId, contact_id: contactId, score: 80, status: 'suggested', source: 'market', market_listing_id: annonceId, ...champs,
    }).select('id').single()
    if (error) throw new Error(`matches: ${error.message}`)
    matchs.push(data.id as string)
    return data.id as string
  }
  const compte = async (client: SupabaseClient, ids: string[]) => {
    const { data, error } = await client.rpc('pige_acheteurs_compatibles', { p_annonces: ids })
    if (error) throw new Error(error.message)
    return Object.fromEntries(((data ?? []) as { market_listing_id: string; acheteurs: number }[]).map((l) => [l.market_listing_id, l.acheteurs]))
  }

  beforeAll(async () => {
    s = await setupTwoAgencies()
    svc = serviceRoleClient()
    const A = s.agencyAId
    annonce = await mkAnnonce('compte')
    vide = await mkAnnonce('vide')
    for (const statut of ['suggested', 'interested', 'visit_planned', 'rejected', 'ignored']) {
      await mkMatch(A, await mkContact(A, statut), annonce, { status: statut })
    }
    propose = await mkContact(A, 'propose')
    await mkMatch(A, propose, annonce, { status: 'sent' })
    await mkMatch(A, await mkContact(A, 'reporte'), annonce, { status: 'suggested', snoozed_until: dansJours(5) })
    await mkMatch(s.agencyBId, await mkContact(s.agencyBId, 'chez-b'), annonce, { status: 'sent' })
    lointaine = await mkAnnonce('31e')
    await mkMatch(A, await mkContact(A, 'lointain'), lointaine)
  })

  afterAll(async () => {
    if (!svc) return
    if (matchs.length) await svc.from('matches').delete().in('id', matchs)
    if (annonces.length) await svc.from('market_listings').delete().in('id', annonces)
    if (contacts.length) await svc.from('contacts').delete().in('id', contacts)
    await s.cleanup()
  })

  it('P1/P3 — cinq acheteurs chez A : à proposer, reporté, proposé, intéressé, en visite ; ni refus, ni écarté, ni B', async () => {
    expect(await compte(s.clientA, [annonce])).toEqual({ [annonce]: 5 })
    expect(await compte(s.clientB, [annonce])).toEqual({ [annonce]: 1 })
  })

  it('P2 — un second match du même acheteur sur la même annonce est refusé', async () => {
    const { error } = await svc.from('matches').insert({
      agency_id: s.agencyAId, contact_id: propose, score: 70, status: 'suggested', source: 'market', market_listing_id: annonce,
    })
    expect(error?.code).toBe('23505')
    expect(await compte(s.clientA, [annonce])).toEqual({ [annonce]: 5 })
  })

  it('P4 — une annonce sans acheteur ne rend rien ; au-delà de 30 identifiants, rien n’est lu ; l’anonyme est refusé', async () => {
    expect(await compte(s.clientA, [vide])).toEqual({})
    const trenteFictifs = Array.from({ length: 30 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(await compte(s.clientA, [...trenteFictifs, lointaine])).toEqual({})
    expect(await compte(s.clientA, [lointaine])).toEqual({ [lointaine]: 1 })
    const { error } = await anonClient().rpc('pige_acheteurs_compatibles', { p_annonces: [annonce] })
    expect(error).not.toBeNull()
  })
})
