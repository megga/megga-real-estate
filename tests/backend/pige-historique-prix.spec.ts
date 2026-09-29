// Backend test — Pige lisible et historique des prix (migrations 20260930145000 et 20260930150000).
//
// skipIf(!HAS_KEYS) ne SKIP PAS en CI : la suite tourne contre un Supabase local fraîchement migré.
//
// CE QUE CE FICHIER FIGE
//  1. Une ligne d'historique par changement RÉEL : le passage nocturne de la collecte, qui réécrit
//     toutes les colonnes, n'en écrit aucune quand ni le prix ni le statut n'ont bougé.
//  2. Flatfox : le premier prix est gelé et la baisse détectée (price_reduced + price_reduced_at),
//     comme RealAdvisor depuis le 19.06.2026 — l'upsert réécrivait price_at_first_seen à chaque passage.
//  3. removed_at : posé au retrait, conservé tant que l'annonce reste retirée, effacé à son retour.
//  4. pige_mouvements : les trois flux, les filtres durs, la pagination par clé, anon refusé ; une seule
//     ligne par annonce retirée (son retrait en cours), et jamais plus de 31 jours en arrière.
//  5. market_price_history : lisible par un agent, jamais écrite par lui.
//  6. flatfox_balayer_retraits : retire par lots bornés, et seulement ce qui n'a pas été revu ; au-delà du
//     plafond relatif posé au premier lot, rien n'est retiré.
//
// MÉTHODE : un micro-marché semé dans une VILLE unique au run (le flux se filtre dessus), détruit en
// afterAll — l'historique part en cascade (FK ON DELETE CASCADE). Aucune ligne préexistante n'est
// écrite : le balayage n'est éprouvé que sous une borne en l'an 2000, que seules nos lignes datent.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { type SupabaseClient } from '@supabase/supabase-js'
import { anonClient, serviceRoleClient } from './helpers/supabase'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const DENIED = '42501'
const JOUR = 86_400_000

interface Ligne {
  kind: string
  old_price: number | null
  new_price: number | null
  old_status: string | null
  new_status: string | null
  change_pct: number | null
  city: string | null
  transaction_type: string | null
}

interface Mouvement {
  event_id: string
  detected_at: string
  kind: string
  market_listing_id: string
  old_price: number | string | null
  new_price: number | string | null
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

describe.skipIf(!HAS_KEYS)('pige — historique des prix, retrait daté, flux « Ce qui a bougé »', () => {
  const STAMP = Date.now()
  const CITY = `Pige QA ${STAMP}`
  let service: SupabaseClient
  let agents: TwoAgenciesSetup
  const semees: string[] = []

  const sourceId = (suffixe: string) => `pige-${suffixe}-${STAMP}`

  /** Une location Flatfox vivante, publiée il y a quarante jours. */
  const semer = async (suffixe: string, extra: Record<string, unknown> = {}): Promise<string> => {
    const { data, error } = await service
      .from('market_listings')
      .insert({
        source_portal: 'flatfox', source_id: sourceId(suffixe), title: `Pige QA ${suffixe}`,
        city: CITY, canton: 'GE', type: 'apartment', transaction_type: 'rent',
        price: 3000, current_price: 3000, price_at_first_seen: 3000, status: 'active', quality_score: 80,
        first_seen_at: new Date(Date.now() - 40 * JOUR).toISOString(),
        ...extra,
      })
      .select('id')
      .single()
    if (error) throw new Error(`semis ${suffixe} : ${error.message}`)
    semees.push(data.id as string)
    return data.id as string
  }

  /** Ce que fait `flatfox-sync` chaque nuit : TOUTES les colonnes réécrites, `active` posé d'office. */
  const passageFlatfox = async (suffixe: string, prix: number): Promise<void> => {
    const { error } = await service.from('market_listings').upsert([{
      source_portal: 'flatfox', source_id: sourceId(suffixe), title: `Pige QA ${suffixe}`,
      city: CITY, canton: 'GE', type: 'apartment', transaction_type: 'rent',
      price: prix, current_price: prix, price_at_first_seen: prix, status: 'active', quality_score: 80,
      last_seen_at: new Date().toISOString(),
    }], { onConflict: 'source_portal,source_id' })
    if (error) throw new Error(`passage ${suffixe} : ${error.message}`)
  }

  const historique = async (id: string): Promise<Ligne[]> => {
    const { data, error } = await service
      .from('market_price_history')
      .select('kind, old_price, new_price, old_status, new_status, change_pct, city, transaction_type')
      .eq('market_listing_id', id)
      .order('detected_at', { ascending: true })
    if (error) throw new Error(`historique : ${error.message}`)
    return (data ?? []).map((l) => ({
      ...l, old_price: num(l.old_price), new_price: num(l.new_price), change_pct: num(l.change_pct),
    })) as Ligne[]
  }

  const annonce = async (id: string) => {
    const { data, error } = await service
      .from('market_listings')
      .select('status, removed_at, price_at_first_seen, price_reduced_at')
      .eq('id', id)
      .single()
    if (error) throw new Error(`annonce : ${error.message}`)
    return data as { status: string; removed_at: string | null; price_at_first_seen: number | string; price_reduced_at: string | null }
  }

  beforeAll(async () => {
    service = serviceRoleClient()
    agents = await setupTwoAgencies()
  })

  afterAll(async () => {
    for (const id of semees) await service.from('market_listings').delete().eq('id', id)
    await agents?.cleanup()
  })

  it('une insertion écrit UNE apparition, avec le contexte de l’annonce', async () => {
    const id = await semer('apparition')
    expect(await historique(id)).toEqual([
      { kind: 'apparition', old_price: null, new_price: 3000, old_status: null, new_status: 'active', change_pct: null, city: CITY, transaction_type: 'rent' },
    ])
  })

  it('le passage nocturne qui ne change ni le prix ni le statut n’écrit rien', async () => {
    const id = await semer('stable')
    await passageFlatfox('stable', 3000)
    await passageFlatfox('stable', 3000)
    expect((await historique(id)).map((l) => l.kind)).toEqual(['apparition'])
  })

  it('Flatfox : le premier prix est gelé, la baisse est détectée, datée et historisée', async () => {
    const id = await semer('baisse')
    // L'upsert réécrit price_at_first_seen à 2700 : c'est ce qui rendait la baisse indétectable.
    await passageFlatfox('baisse', 2700)
    const a = await annonce(id)
    expect(a.status).toBe('price_reduced')
    expect(Number(a.price_at_first_seen)).toBe(3000)
    expect(a.price_reduced_at).not.toBeNull()
    const h = await historique(id)
    expect(h.map((l) => l.kind)).toEqual(['apparition', 'baisse'])
    expect(h[1]).toMatchObject({ old_price: 3000, new_price: 2700, old_status: 'active', new_status: 'price_reduced', change_pct: -10 })
  })

  it('une hausse est historisée, et l’annonce reste `active`', async () => {
    const id = await semer('hausse')
    await passageFlatfox('hausse', 3150)
    expect((await annonce(id)).status).toBe('active')
    const h = await historique(id)
    expect(h.map((l) => l.kind)).toEqual(['apparition', 'hausse'])
    expect(h[1]).toMatchObject({ old_price: 3000, new_price: 3150, change_pct: 5 })
  })

  it('removed_at : posé au retrait, gardé tant que l’annonce reste retirée, effacé à son retour', async () => {
    const id = await semer('retrait')
    const { error } = await service.from('market_listings').update({ status: 'removed' }).eq('id', id)
    expect(error).toBeNull()
    const retiree = await annonce(id)
    expect(retiree.status).toBe('removed')
    expect(retiree.removed_at).not.toBeNull()
    // Une écriture qui ne touche pas au statut (comme la sonde RealAdvisor) ne déplace pas la date.
    await service.from('market_listings').update({ last_seen_at: new Date().toISOString() }).eq('id', id)
    expect((await annonce(id)).removed_at).toBe(retiree.removed_at)
    // Le retour : la collecte repose `active`.
    await passageFlatfox('retrait', 3000)
    expect(await annonce(id)).toMatchObject({ status: 'active', removed_at: null })
    expect((await historique(id)).map((l) => l.kind)).toEqual(['apparition', 'retrait', 'retour'])
  })

  describe('pige_mouvements — le flux « Ce qui a bougé »', () => {
    let apparue = ''
    let baissee = ''
    let retiree = ''
    const flux = async (client: SupabaseClient, args: Record<string, unknown>) => {
      const { data, error } = await client.rpc('pige_mouvements', {
        p_since: new Date(Date.now() - 3_600_000).toISOString(), p_city: CITY, p_tx: 'buy', ...args,
      })
      return { lignes: (data ?? []) as Mouvement[], error }
    }

    beforeAll(async () => {
      const vente = { transaction_type: 'buy', type: 'villa' }
      apparue = await semer('flux-apparue', { ...vente, price: 5_200_000, current_price: 5_200_000, price_at_first_seen: 5_200_000 })
      baissee = await semer('flux-baissee', { ...vente, price: 6_000_000, current_price: 6_000_000, price_at_first_seen: 6_000_000 })
      retiree = await semer('flux-retiree', { ...vente, price: 7_000_000, current_price: 7_000_000, price_at_first_seen: 7_000_000 })
      const { error: e1 } = await service.from('market_listings').update({ price: 5_500_000, current_price: 5_500_000 }).eq('id', baissee)
      const { error: e2 } = await service.from('market_listings').update({ status: 'removed' }).eq('id', retiree)
      if (e1 || e2) throw new Error(`préparation du flux : ${(e1 ?? e2)!.message}`)
    })

    it('chaque flux rend ses mouvements : apparues vivantes, baisses, retraits', async () => {
      const apparitions = await flux(service, { p_kind: 'apparition' })
      expect(apparitions.error).toBeNull()
      expect(apparitions.lignes.map((l) => l.market_listing_id).sort()).toEqual([apparue, baissee].sort())
      const baisses = await flux(service, { p_kind: 'baisse' })
      expect(baisses.lignes.map((l) => l.market_listing_id)).toEqual([baissee])
      expect([num(baisses.lignes[0]!.old_price), num(baisses.lignes[0]!.new_price)]).toEqual([6_000_000, 5_500_000])
      expect((await flux(service, { p_kind: 'retrait' })).lignes.map((l) => l.market_listing_id)).toEqual([retiree])
    })

    it('les filtres durs : type, canton, tranche de prix (marge de 15 % comme la grille), transaction', async () => {
      expect((await flux(service, { p_kind: 'apparition', p_types: ['apartment'] })).lignes).toEqual([])
      expect((await flux(service, { p_kind: 'apparition', p_cantons: ['VD'] })).lignes).toEqual([])
      // 4,6 M × 1,15 = 5,29 M : l'apparition à 5,2 M passe, celle à 6 M non.
      expect((await flux(service, { p_kind: 'apparition', p_budget_max: 4_600_000 })).lignes.map((l) => l.market_listing_id)).toEqual([apparue])
      expect((await flux(service, { p_kind: 'apparition', p_tx: 'rent' })).lignes.map((l) => l.market_listing_id)).not.toContain(apparue)
    })

    it('la pagination par clé rend deux pages d’une ligne, sans doublon ni trou', async () => {
      const p1 = await flux(service, { p_kind: 'apparition', p_limit: 1 })
      expect(p1.lignes).toHaveLength(1)
      const a = p1.lignes[0]!
      const p2 = await flux(service, { p_kind: 'apparition', p_limit: 1, p_before_at: a.detected_at, p_before_id: a.event_id })
      expect(p2.lignes).toHaveLength(1)
      const b = p2.lignes[0]!
      expect([a.market_listing_id, b.market_listing_id].sort()).toEqual([apparue, baissee].sort())
      const p3 = await flux(service, { p_kind: 'apparition', p_limit: 1, p_before_at: b.detected_at, p_before_id: b.event_id })
      expect(p3.lignes).toEqual([])
    })

    it('anon est refusé ; un agent authentifié lit le flux', async () => {
      expect((await flux(anonClient(), { p_kind: 'apparition' })).error?.code).toBe(DENIED)
      const agent = await flux(agents.clientA, { p_kind: 'baisse' })
      expect(agent.error).toBeNull()
      expect(agent.lignes.map((l) => l.market_listing_id)).toEqual([baissee])
    })

    it('un agent lit l’historique mais ne peut pas l’écrire', async () => {
      const lecture = await agents.clientA.from('market_price_history').select('kind').eq('market_listing_id', apparue)
      expect(lecture.error).toBeNull()
      expect(lecture.data).toEqual([{ kind: 'apparition' }])
      const ecriture = await agents.clientA.from('market_price_history').insert({ market_listing_id: apparue, kind: 'baisse', old_price: 2, new_price: 1 })
      expect(ecriture.error?.code).toBe(DENIED)
    })

    // ⚠ Les deux cas suivants sèment APRÈS les précédents, qui comptent les lignes de la ville.
    it('⛔ retirée, revenue puis retirée de nouveau : UNE ligne dans « Retirés », celle du retrait en cours', async () => {
      const id = await semer('flux-deux-retraits', { transaction_type: 'buy', type: 'villa', price: 8_000_000, current_price: 8_000_000, price_at_first_seen: 8_000_000 })
      // Trois requêtes, donc trois transactions : trois now() distincts.
      for (const status of ['removed', 'active', 'removed']) {
        const { error } = await service.from('market_listings').update({ status }).eq('id', id)
        expect(error).toBeNull()
      }
      expect((await historique(id)).map((l) => l.kind)).toEqual(['apparition', 'retrait', 'retour', 'retrait'])
      const retraits = (await flux(service, { p_kind: 'retrait' })).lignes.filter((l) => l.market_listing_id === id)
      expect(retraits).toHaveLength(1)
    })

    it('p_since recule de 31 jours au plus, quoi que demande l’appelant', async () => {
      const id = await semer('flux-ancienne', { transaction_type: 'buy', type: 'villa', price: 9_000_000, current_price: 9_000_000, price_at_first_seen: 9_000_000 })
      // Antidatée par le service : en production, le déclencheur est le seul écrivain de la table.
      const { error } = await service.from('market_price_history')
        .update({ detected_at: new Date(Date.now() - 40 * JOUR).toISOString() })
        .eq('market_listing_id', id)
      expect(error).toBeNull()
      const soixante = new Date(Date.now() - 60 * JOUR).toISOString()
      expect((await flux(service, { p_kind: 'apparition', p_since: soixante })).lignes.map((l) => l.market_listing_id)).not.toContain(id)
    })
  })

  // Balayage par lots : dans l'étape 1b par décision de Julien du 21.09.2026 (Question 1 du plan).
  // Ce bloc va et vient avec la migration 20260930145000.
  describe('flatfox_balayer_retraits — le balayage par lots', () => {
    // Borne en l'an 2000 : seules les lignes semées ici ont une dernière vue plus ancienne.
    const BORNE = '2000-01-01T00:00:00Z'

    it('retire par lots bornés les Flatfox non revues, et seulement elles', async () => {
      const perdue1 = await semer('balai-perdue-1', { last_seen_at: '1999-06-01T00:00:00Z' })
      const perdue2 = await semer('balai-perdue-2', { last_seen_at: '1999-06-02T00:00:00Z' })
      const revue = await semer('balai-revue', { last_seen_at: '2000-06-01T00:00:00Z' })
      const lot = async (): Promise<number> => {
        const { data, error } = await service.rpc('flatfox_balayer_retraits', { p_sync_start: BORNE, p_limit: 1 })
        expect(error).toBeNull()
        return Number(data)
      }
      expect([await lot(), await lot(), await lot()]).toEqual([1, 1, 0])
      for (const id of [perdue1, perdue2]) {
        const a = await annonce(id)
        expect(a.status).toBe('removed')
        expect(a.removed_at).not.toBeNull()
      }
      expect((await annonce(revue)).status).toBe('active')
      expect((await historique(perdue1)).map((l) => l.kind)).toEqual(['apparition', 'retrait'])
    })

    it('réservé au service : un agent authentifié est refusé', async () => {
      const { error } = await agents.clientA.rpc('flatfox_balayer_retraits', { p_sync_start: BORNE })
      expect(error?.code).toBe(DENIED)
    })

    // Après le premier cas : ses deux perdues sont retirées, les candidates sous la borne sont les nôtres.
    it('⛔ au-delà du plafond relatif, le premier lot lève et ne retire RIEN ; à hauteur du plafond, tout part', async () => {
      const a = await semer('balai-plafond-a', { last_seen_at: '1999-07-01T00:00:00Z' })
      const b = await semer('balai-plafond-b', { last_seen_at: '1999-07-02T00:00:00Z' })
      const refus = await service.rpc('flatfox_balayer_retraits', { p_sync_start: BORNE, p_limit: 500, p_plafond: 1 })
      expect(refus.error?.message).toMatch(/balayage refusé/)
      for (const id of [a, b]) expect((await annonce(id)).status).toBe('active')
      const { data, error } = await service.rpc('flatfox_balayer_retraits', { p_sync_start: BORNE, p_limit: 500, p_plafond: 2 })
      expect(error).toBeNull()
      expect(Number(data)).toBe(2)
    })
  })
})
