/**
 * Le banc `/dev/crm` et la boucle du matching (lot B) : ses matchs portent la note que le VRAI moteur leur
 * donnerait, ses états d'arrivée sont ceux que les triggers laisseraient, et son `matching-engine` renote la
 * recherche de Julie comme l'edge le ferait.
 *
 * ⚠ Le banc ne note pas (`src/` ne charge pas le barème Deno, CLAUDE.md §4) : il porte des notes calculées. Ce
 * fichier les confronte à `calculateScoreV2` — sans lui, une ligne « 97 · Genève correspond » du banc pourrait
 * dire ce que le moteur ne dirait pas, et l'écran se régler sur une fixture fausse.
 *
 * ⚠ Les fixtures sont des tableaux de MODULE, que la renotation du banc modifie : chaque test relit un module
 * neuf (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'

type Ligne = Record<string, unknown> & { id: string }

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const table = (nom: string): Ligne[] => f.CRM_TABLES[nom] as Ligne[]
  const ligne = (nom: string, id: string): Ligne => {
    const l = table(nom).find((x) => x.id === id)
    if (!l) throw new Error(`${nom}/${id} absent du banc`)
    return l
  }
  const bienDe = (m: Ligne): Ligne => (m.property_id
    ? ligne('properties', m.property_id as string)
    : ligne('market_listings', m.market_listing_id as string))
  const edge = f.CRM_EDGES['matching-engine'] as (a: Record<string, unknown>) => unknown
  return { table, ligne, bienDe, edge }
}

const BOUCLE = ['m14', 'm15', 'm16', 'm17', 'm18', 'm19', 'm20', 'm21']

/**
 * L'annonce telle que le moteur l'a notée : à son PREMIER prix. Il ne renote pas une paire quand son prix bouge
 * (`ON CONFLICT DO NOTHING` ; seuls des critères changés ou une version antérieure du barème la renotent) ; notée
 * au prix d'aujourd'hui, une annonce en baisse gagnerait « Prix baissé de 3 % » et un point que la base n'a
 * jamais écrits.
 */
const aLaNotation = (b: Ligne): Ligne => (Number(b.price_at_first_seen) > Number(b.current_price ?? b.price)
  ? { ...b, price: b.price_at_first_seen, current_price: b.price_at_first_seen, status: 'active' }
  : b)
const JULIE_A_PROPOSER = ['m3', 'm8', 'm9', 'm10', 'm19']

describe('le banc de la boucle', () => {
  it('ses matchs portent la note du moteur à leur notation, raisons comprises', async () => {
    const { ligne, bienDe } = await banc()
    for (const id of BOUCLE) {
      const m = ligne('matches', id)
      const criteres = ligne('contacts', m.contact_id as string).search_criteria as Record<string, unknown>
      const note = calculateScoreV2(aLaNotation(bienDe(m)), criteres)
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
    }
  })

  it('ses états d’arrivée sont ceux que les triggers laisseraient', async () => {
    const { table, ligne, bienDe } = await banc()
    // Une relance de proposition reste ouverte tant qu'un de ses biens attend (`fermer_relance_proposition`).
    const relances = table('reminders').filter((r) => r.type === 'follow_up_sent_property')
    expect(relances.map((r) => r.id)).toEqual(['rb1', 'rb2'])
    for (const r of relances) {
      const ids = (r.match_ids as string[] | null) ?? [r.match_id as string]
      expect(ids.some((id) => ligne('matches', id).status === 'sent'), r.id).toBe(r.status === 'pending')
    }
    // Un bien revenu par une baisse (`match_retour_prix_*`) : à proposer, motif « prix », proposé plus cher.
    for (const id of ['m5', 'm20']) {
      const m = ligne('matches', id)
      const bien = bienDe(m)
      expect(m).toMatchObject({ status: 'suggested', reaction_motif: 'prix' })
      expect(Number(m.prix_propose)).toBeGreaterThan(Number(bien.current_price ?? bien.price))
    }
    // Un bien proposé porte le prix auquel il l'a été (`set_match_prix_propose`) : sur le banc, son premier prix.
    for (const id of BOUCLE.filter((x) => ligne('matches', x).status !== 'suggested')) {
      const m = ligne('matches', id)
      expect(m.prix_propose, id).toBe(bienDe(m).price_at_first_seen)
    }
  })

  it('`matching-engine` renote la recherche de Julie comme le moteur, et pose ce que l’edge pose', async () => {
    const { table, ligne, bienDe, edge } = await banc()
    const avant = ligne('client_searches', 'cs9').criteria as Record<string, unknown>
    const corriges = { ...avant, budget_max: 1_550_000 }
    // Le contrat de l'edge : la SEULE clé corrigée, fusionnée dans les critères d'aujourd'hui.
    expect(edge({
      mode: 'rescore-search', client_search_id: 'cs9', correction: { cle: 'budget_max', valeur: 1_550_000 }, motif: 'prix',
      refus_ids: ['m16', 'm14'],
    })).toEqual({ reevalues: 5, ecartes: 1, mode: 'rescore-search' })
    for (const id of JULIE_A_PROPOSER) {
      const m = ligne('matches', id)
      const note = calculateScoreV2(bienDe(m), corriges)
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
      expect(m.status, id).toBe(note.total < DEFAULT_SCORING_CONFIG.threshold ? 'ignored' : 'suggested')
    }
    expect(ligne('matches', 'm19').reaction_motif).toBe('recherche_ajustee')
    expect(ligne('client_searches', 'cs9').criteria).toEqual(corriges)
    expect(ligne('contacts', 'c9').search_criteria).toEqual(corriges)
    for (const id of ['m14', 'm16']) expect(typeof ligne('matches', id).apprentissage_at, id).toBe('string')
    expect(table('activity_events').at(-1)).toMatchObject({
      action: 'recherche_ajustee', category: 'contact', entity_id: 'c9', metadata: { cle: 'budget_max', reevalues: 5, ecartes: 1 },
    })
  })

  it('une autre valeur pose la clé sans rien renoter ; les autres clés d’aujourd’hui restent', async () => {
    const { ligne, edge } = await banc()
    const recherche = ligne('client_searches', 'cs9') as Ligne & { criteria: Record<string, unknown> }
    // Changée ailleurs après la lecture du fil : la correction ne doit pas la remettre.
    recherche.criteria = { ...recherche.criteria, rooms_min: 5 }
    const scores = JULIE_A_PROPOSER.map((id) => ligne('matches', id).score)
    expect(edge({
      mode: 'rescore-search', client_search_id: 'cs9', correction: { cle: 'budget_max', valeur: 1_500_000 }, motif: 'prix',
      refus_ids: ['m16', 'm14'],
    })).toEqual({ reevalues: 0, ecartes: 0, mode: 'rescore-search' })
    expect(JULIE_A_PROPOSER.map((id) => ligne('matches', id).score)).toEqual(scores)
    expect(ligne('client_searches', 'cs9').criteria).toMatchObject({ budget_max: 1_500_000, rooms_min: 5 })
  })

  it('les autres modes gardent la réponse d’une edge sans fixture', async () => {
    const { edge } = await banc()
    expect(edge({ mode: 'scan-all' })).toEqual({ ok: true, banc: true })
  })
})
