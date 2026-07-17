// Phase A · batch 3 — purge des matchs sur annonces retirées (migration 20260717232500).
//
//  1. purge_stale_market_matches supprime un match 'suggested' dont la
//     market_listing est 'removed' (bien disparu).
//  2. Préserve un match 'sent' sur annonce 'removed' (historique d'un envoi réel).
//  3. Préserve un match 'suggested' sur annonce 'active' (bien vivant).
//  4. Un agent simple (authenticated) ne peut PAS déclencher la purge (REVOKE PUBLIC).
//
// Runs live in CI (SUPABASE_TEST_* présentes). Skip local sans clés.
// NB : matches dédup par couple contact×bien → 3 annonces distinctes.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)

describe.skipIf(!HAS_KEYS)('Phase A batch 3 — purge matchs annonces retirées', () => {
  let setup: TwoAgenciesSetup
  let contactId: string | null = null
  const mlIds: string[] = []
  let mSuggRemoved: string | null = null // suggested sur removed → à supprimer
  let mSentRemoved: string | null = null // sent sur removed → préservé
  let mSuggActive: string | null = null // suggested sur active → préservé

  beforeAll(async () => {
    setup = await setupTwoAgencies()
    const svc = serviceRoleClient()

    const { data: contact } = await svc
      .from('contacts')
      .insert({ agency_id: setup.agencyAId, first_name: 'Buyer', last_name: `B3 ${setup.stamp}`, type: 'buyer' })
      .select('id').single()
    contactId = contact?.id ?? null

    const mkListing = async (status: string, tag: string): Promise<string | null> => {
      const { data, error } = await svc
        .from('market_listings')
        .insert({ source_id: `b3-${tag}-${setup.stamp}`, title: `ML ${tag} ${setup.stamp}`, city: 'Genève', canton: 'GE', status })
        .select('id').single()
      if (error) { console.warn(`seed market_listing ${tag} failed:`, error.message); return null }
      mlIds.push(data.id)
      return data.id
    }
    // Annonces distinctes (dédup matches par couple contact×bien).
    const removed1 = await mkListing('removed', 'rm1')
    const removed2 = await mkListing('removed', 'rm2')
    const active1 = await mkListing('active', 'ac1')

    const mkMatch = async (mlId: string | null, status: string): Promise<string | null> => {
      if (!contactId || !mlId) return null
      const { data, error } = await svc
        .from('matches')
        .insert({ agency_id: setup.agencyAId, contact_id: contactId, market_listing_id: mlId, score: 80, status, source: 'market' })
        .select('id').single()
      if (error) { console.warn(`seed match ${status} failed:`, error.message); return null }
      return data.id
    }
    mSuggRemoved = await mkMatch(removed1, 'suggested')
    mSentRemoved = await mkMatch(removed2, 'sent')
    mSuggActive = await mkMatch(active1, 'suggested')
  })

  afterAll(async () => {
    const svc = serviceRoleClient()
    for (const id of [mSuggRemoved, mSentRemoved, mSuggActive]) {
      if (id) await svc.from('matches').delete().eq('id', id).then(() => {}, () => {})
    }
    for (const id of mlIds) {
      await svc.from('market_listings').delete().eq('id', id).then(() => {}, () => {})
    }
    if (contactId) await svc.from('contacts').delete().eq('id', contactId).then(() => {}, () => {})
    await setup.cleanup()
  })

  it('purge_stale_market_matches : supprime le suggested sur annonce removed', async () => {
    expect(mSuggRemoved).toBeTruthy()
    const svc = serviceRoleClient()
    const { data: count, error } = await svc.rpc('purge_stale_market_matches')
    expect(error).toBeNull()
    expect(typeof count).toBe('number')
    const { data: gone } = await svc.from('matches').select('id').eq('id', mSuggRemoved)
    expect(gone ?? []).toHaveLength(0)
  })

  it('préserve un match sent sur annonce removed (historique)', async () => {
    expect(mSentRemoved).toBeTruthy()
    const svc = serviceRoleClient()
    const { data } = await svc.from('matches').select('id').eq('id', mSentRemoved)
    expect(data ?? []).toHaveLength(1)
  })

  it('préserve un suggested sur annonce active (bien vivant)', async () => {
    expect(mSuggActive).toBeTruthy()
    const svc = serviceRoleClient()
    const { data } = await svc.from('matches').select('id').eq('id', mSuggActive)
    expect(data ?? []).toHaveLength(1)
  })

  it('un agent simple ne peut pas déclencher la purge (REVOKE PUBLIC)', async () => {
    const { error } = await setup.clientA.rpc('purge_stale_market_matches')
    expect(error).toBeTruthy()
  })
})
