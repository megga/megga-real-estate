/**
 * « Qui pour ce bien ? » côté moteur (lot C) : les anciens prospects — recherche close depuis plus de 90 jours, ou
 * deal perdu dans les 24 derniers mois, sans match sur ce bien —, notés au vrai barème, derrière le pré-filtre
 * du moteur, au seuil. Module pur de l'edge `matching-engine`, modes `prospects` et `reactiver-prospect`.
 */
import { describe, expect, it } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import {
  candidatsProspects, debutFenetreDeal, noterProspects, PROSPECTS_MAX, type RechercheClose,
} from '../../supabase/functions/_shared/matching-prospects'

const T = Date.UTC(2026, 8, 22)
const JOUR = 86_400_000
const iso = (t: number) => new Date(t).toISOString()
const CRITERES = { transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'GE'], budget_max: 2_500_000, rooms_min: 5 }
const recherche = (id: string, contact: string, jours: number, criteria: Record<string, unknown> | null = CRITERES): RechercheClose =>
  ({ id, contact_id: contact, criteria, updated_at: iso(T - jours * JOUR) })
const MANDAT = { transaction_type: 'buy', price: 2_350_000, type: 'apartment', canton: 'GE', city: 'Genève', rooms: 5.5, surface_m2: 168, features: [] }
const sansLoyer = () => null

describe('candidatsProspects', () => {
  it('une recherche close depuis plus de 90 jours ; pas une recherche fermée il y a 20 jours sans deal perdu', () => {
    const c = candidatsProspects([recherche('r1', 'c1', 120), recherche('r2', 'c2', 20)], [], new Set(), T)
    expect(c.map((x) => [x.contact_id, x.origine])).toEqual([['c1', 'recherche_close']])
  })
  it('un deal perdu dans les 24 mois l’emporte, daté de sa perte ; au-delà, il ne compte plus', () => {
    const c = candidatsProspects(
      [recherche('r3', 'c3', 20), recherche('r4', 'c4', 20)],
      [{ contact_id: 'c3', le: iso(T - 150 * JOUR) }, { contact_id: 'c4', le: iso(T - 900 * JOUR) }],
      new Set(), T,
    )
    expect(c).toEqual([expect.objectContaining({ contact_id: 'c3', origine: 'deal_perdu', depuis: iso(T - 150 * JOUR) })])
  })
  it('écarte un acheteur déjà sur ce bien, une recherche sans critères, une date illisible', () => {
    const c = candidatsProspects(
      [recherche('r5', 'c5', 200), recherche('r6', 'c6', 200, null), { id: 'r7', contact_id: 'c7', criteria: CRITERES, updated_at: 'hier' }],
      [], new Set(['c5']), T,
    )
    expect(c).toEqual([])
  })
  it('la fenêtre des deals perdus commence 24 mois avant, au jour près', () => {
    expect(iso(debutFenetreDeal(T))).toBe('2024-09-22T00:00:00.000Z')
  })
})

describe('noterProspects', () => {
  const candidats = candidatsProspects([recherche('r1', 'c1', 120)], [], new Set(), T)
  it('note au vrai barème, au seuil du moteur', () => {
    const [p] = noterProspects(candidats, MANDAT, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)
    expect(p).toMatchObject({ contact_id: 'c1', client_search_id: 'r1', origine: 'recherche_close' })
    expect(p!.score).toBe(calculateScoreV2(MANDAT, CRITERES, DEFAULT_SCORING_CONFIG, null, T).total)
  })
  it('un mandat en location ne va pas à une recherche d’achat, et sous le seuil personne ne passe', () => {
    expect(noterProspects(candidats, { ...MANDAT, transaction_type: 'rent' }, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toEqual([])
    // ⚠ Sans le prix, cette villa de Zürich tombait PILE sur le seuil (55 : prix et pièces, redistribués) — gardée.
    expect(noterProspects(candidats, { ...MANDAT, type: 'house', city: 'Zürich', canton: 'ZH', price: 4_000_000 }, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toEqual([])
  })
  it('une annonce du marché passe par le pré-filtre du moteur (budget à 15 % près)', () => {
    const annonce = { ...MANDAT, current_price: 2_950_000, price: 2_950_000, status: 'active', quality_score: 70 }
    expect(noterProspects(candidats, annonce, true, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toEqual([])
  })
  it('garde la meilleure recherche d’un acheteur, trie par score, 20 au plus', () => {
    const faible = { ...CRITERES, rooms_min: 7 }
    const deux = candidatsProspects([recherche('r1', 'c1', 120), recherche('r1b', 'c1', 120, faible)], [], new Set(), T)
    expect(noterProspects(deux, MANDAT, false, DEFAULT_SCORING_CONFIG, sansLoyer, T).map((p) => p.client_search_id)).toEqual(['r1'])
    const beaucoup = candidatsProspects(Array.from({ length: 30 }, (_, i) => recherche(`r${i}`, `c${String(i).padStart(2, '0')}`, 120)), [], new Set(), T)
    expect(noterProspects(beaucoup, MANDAT, false, DEFAULT_SCORING_CONFIG, sansLoyer, T)).toHaveLength(PROSPECTS_MAX)
  })
})
