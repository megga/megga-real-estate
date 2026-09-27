/**
 * Le banc `/dev/crm` et le lot C : ses matchs portent la note du VRAI moteur (chambres, état, off-market
 * compris), ses anciens prospects aussi, et son `matching-engine` les rend puis les réactive comme l'edge.
 *
 * ⚠ Le banc ne note pas (`src/` ne charge pas le barème Deno) : il porte des notes calculées, que ce fichier
 * confronte à `calculateScoreV2`. ⚠ Les fixtures sont des tableaux de MODULE que la réactivation modifie :
 * chaque test relit un module neuf (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'

type Ligne = Record<string, unknown> & { id: string }
const JOUR = 86_400_000

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const table = (nom: string): Ligne[] => f.CRM_TABLES[nom] as Ligne[]
  const ligne = (nom: string, id: string): Ligne => {
    const l = table(nom).find((x) => x.id === id)
    if (!l) throw new Error(`${nom}/${id} absent du banc`)
    return l
  }
  const edge = f.CRM_EDGES['matching-engine'] as (a: Record<string, unknown>) => Record<string, unknown>
  const resume = f.CRM_RPC.matching_fil_marche_resume as () => Record<string, unknown>[]
  return { table, ligne, edge, resume }
}

describe('le banc du lot C', () => {
  it('ses matchs portent la note du moteur, raisons comprises', async () => {
    const { ligne } = await banc()
    for (const id of ['m22', 'm23', 'm24', 'm25']) {
      const m = ligne('matches', id)
      const bien = m.property_id ? ligne('properties', m.property_id as string) : ligne('market_listings', m.market_listing_id as string)
      const criteres = ligne('client_searches', m.client_search_id as string).criteria as Record<string, unknown>
      const note = calculateScoreV2(bien, criteres, DEFAULT_SCORING_CONFIG, null, Date.now())
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
    }
  })

  it('Florissant est le seul nouveau mandat ; Champel et Cologny sont anciens', async () => {
    const { ligne } = await banc()
    const recent = (b: Ligne) => [b.mandate_signed_at, b.published_at]
      .some((d) => typeof d === 'string' && Date.now() - Date.parse(d) <= 7 * JOUR)
    expect(recent(ligne('properties', 'p3'))).toBe(true)
    expect(recent(ligne('properties', 'p1'))).toBe(false)
    expect(recent(ligne('properties', 'p2'))).toBe(false)
  })

  it('les anciens prospects de Florissant : recherche close depuis 90 jours ou deal perdu, notés par le moteur', async () => {
    const { ligne, edge } = await banc()
    const { prospects } = edge({ mode: 'prospects', property_id: 'p3' }) as { prospects: Record<string, unknown>[] }
    expect(prospects.map((p) => [p.contact_id, p.origine])).toEqual([['c12', 'recherche_close'], ['c13', 'deal_perdu']])
    const bien = ligne('properties', 'p3')
    for (const p of prospects) {
      const recherche = ligne('client_searches', p.client_search_id as string)
      expect(recherche.is_active).toBe(false)
      expect(p.score).toBe(calculateScoreV2(bien, recherche.criteria as Record<string, unknown>, DEFAULT_SCORING_CONFIG, null, Date.now()).total)
    }
    expect(Date.now() - Date.parse(ligne('client_searches', 'cs12').updated_at as string)).toBeGreaterThan(90 * JOUR)
  })

  it('réactiver : le match naît à proposer, la recherche rouvre, une ligne au journal, le prospect sort de la liste', async () => {
    const { table, ligne, edge } = await banc()
    const r = edge({ mode: 'reactiver-prospect', property_id: 'p3', client_search_id: 'cs12', origine: 'recherche_close' })
    const m = ligne('matches', r.match_id as string)
    expect(m).toMatchObject({ contact_id: 'c12', property_id: 'p3', status: 'suggested', score: r.score })
    expect(ligne('client_searches', 'cs12').is_active).toBe(true)
    expect(table('activity_events').filter((e) => e.action === 'prospect_reactive' && e.entity_id === 'c12')).toHaveLength(1)
    const { prospects } = edge({ mode: 'prospects', property_id: 'p3' }) as { prospects: Record<string, unknown>[] }
    expect(prospects.map((p) => p.contact_id)).toEqual(['c13'])
  })

  it('le résumé « Marché » compte les annonces nouvelles et en baisse d’Anastasia', async () => {
    const { resume } = await banc()
    expect(resume().find((l) => l.contact_id === 'c11')).toMatchObject({ nombre: 2, nouveaux: 1, baisses: 1 })
  })
})
