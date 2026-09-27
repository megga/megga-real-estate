/**
 * Pige lisible — le modèle PUR (`src/components/matching-recherche/pige.ts`) : période, pagination, mise
 * en forme des mouvements, résumé et tracé de l'historique d'une annonce, et les lots des acheteurs
 * compatibles (lot D1), liés à la borne de leur RPC.
 *
 * ⚠ « aujourd'hui / hier » se comptent en jours CIVILS locaux : ces instants sont construits en heure
 * locale (`new Date(a, m, j, h)`), jamais par `Date.now() + Δ`, qui casse près de minuit.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  biensAjoutables, curseurSuivant, depuisFenetre, ecartPct, etatDuFlux, formaterPct, joursEntre, lotsAnnonces,
  lotsParPage, quandRelatif, resumerHistorique, tracerCourbe, versMouvement, versPointPrix, type LigneMouvement,
  type MouvementPige, type PointPrix,
} from '@/components/matching-recherche/pige'
import type { MrhBien } from '@/components/matching-recherche/types'

const JOUR = 86_400_000
const BIEN = { id: 'ml-1', title: 'Villa', transaction: 'vente' } as MrhBien

const ligne = (extra: Partial<LigneMouvement> = {}): LigneMouvement => ({
  event_id: 'ev-1', detected_at: '2026-09-21T08:00:00.000Z', kind: 'baisse', market_listing_id: 'ml-1',
  old_price: 14_500_000, new_price: 12_900_000, change_pct: -11.03, first_seen_at: '2026-04-27T08:00:00.000Z',
  ...extra,
})

const point = (genre: PointPrix['genre'], quand: string, prix: number | null, ancienPrix: number | null = null): PointPrix =>
  ({ id: `${genre}-${quand}`, genre, quand, ancienPrix, prix, variationPct: null, statut: null })

describe('période et jours', () => {
  it('depuisFenetre recule de N jours pleins', () => {
    const t = Date.parse('2026-09-21T10:00:00.000Z')
    expect(depuisFenetre(1, t)).toBe('2026-09-20T10:00:00.000Z')
    expect(depuisFenetre(7, t)).toBe('2026-09-14T10:00:00.000Z')
    expect(depuisFenetre(30, t)).toBe('2026-08-22T10:00:00.000Z')
  })

  it('joursEntre compte des jours pleins, jamais négatifs, et se tait sans début lisible', () => {
    expect(joursEntre('2026-04-27T08:00:00.000Z', '2026-09-21T08:00:00.000Z')).toBe(147)
    expect(joursEntre('2026-09-21T08:00:00.000Z', '2026-09-21T20:00:00.000Z')).toBe(0)
    expect(joursEntre('2026-09-22T08:00:00.000Z', '2026-09-21T08:00:00.000Z')).toBe(0)
    expect(joursEntre(null, Date.now())).toBeNull()
    expect(joursEntre('pas une date', Date.now())).toBeNull()
  })

  it('quandRelatif parle en jours civils locaux', () => {
    const maintenant = new Date(2026, 8, 21, 9, 0).getTime()
    expect(quandRelatif(new Date(2026, 8, 21, 0, 30).toISOString(), maintenant)).toEqual({ cle: 'aujourdhui', jours: 0 })
    expect(quandRelatif(new Date(2026, 8, 20, 23, 50).toISOString(), maintenant)).toEqual({ cle: 'hier', jours: 1 })
    expect(quandRelatif(new Date(2026, 8, 18, 12, 0).toISOString(), maintenant)).toEqual({ cle: 'jours', jours: 3 })
  })

  it('formaterPct signe, arrondit à une décimale et suit la langue', () => {
    expect(formaterPct(-11.034, 'fr')).toBe('−11,0 %')
    expect(formaterPct(5, 'en')).toBe('+5.0 %')
    expect(formaterPct(0, 'fr')).toBe('0,0 %')
  })

  it('ecartPct : l’arrondi UNIQUE de l’affiche, de la carte et de l’historique', () => {
    // 1 000 000 → 905 000 : l'affiche disait « −10 % » (Math.round entier), l'historique « −9,5 % ».
    expect(ecartPct(1_000_000, 905_000)).toBe(-9.5)
    expect(formaterPct(ecartPct(1_000_000, 905_000)!, 'fr')).toBe('−9,5 %')
    expect(ecartPct(2600, 2450)).toBe(-5.8)
    expect(ecartPct(3000, 3150)).toBe(5)
    expect(ecartPct(null, 900)).toBeNull()
    expect(ecartPct(0, 900)).toBeNull()
    expect(ecartPct(900, 0)).toBeNull()
  })
})

describe('mouvements du flux', () => {
  it('versMouvement lit les montants (PostgREST peut rendre du texte) et les jours sur le marché', () => {
    const m = versMouvement(ligne({ old_price: '14500000.00', new_price: '12900000.00' }), BIEN)
    expect(m).toMatchObject({ id: 'ev-1', genre: 'baisse', ancienPrix: 14_500_000, prix: 12_900_000, variationPct: -11.03, joursSurMarche: 147 })
    expect(m!.bien).toBe(BIEN)
  })

  it('versMouvement écarte ce qui n’est pas l’un des trois flux', () => {
    expect(versMouvement(ligne({ kind: 'suivi' }), BIEN)).toBeNull()
    expect(versMouvement(ligne({ kind: 'hausse' }), BIEN)).toBeNull()
  })

  it('curseurSuivant : la dernière ligne d’une page pleine, rien après une page incomplète', () => {
    const page = [ligne({ event_id: 'a', detected_at: 't2' }), ligne({ event_id: 'b', detected_at: 't1' })]
    expect(curseurSuivant(page, 2)).toEqual({ at: 't1', id: 'b' })
    expect(curseurSuivant(page, 3)).toBeNull()
    expect(curseurSuivant([], 2)).toBeNull()
  })

  it('⛔ etatDuFlux : une page SUIVANTE en échec garde la liste ; la première en échec est une erreur', () => {
    const q = { enVol: false, lent: false, isFetchNextPageError: false, isError: false, status: 'success' as const }
    // TanStack v5 lève `isError` ET `isFetchNextPageError` : lire le premier seul effaçait les pages lues.
    expect(etatDuFlux({ ...q, isError: true, isFetchNextPageError: true, status: 'error' })).toBe('pret')
    expect(etatDuFlux({ ...q, isError: true, status: 'error' })).toBe('erreur')
    expect(etatDuFlux({ ...q, enVol: true, status: 'pending' })).toBe('chargement')
    expect(etatDuFlux({ ...q, enVol: true, lent: true, status: 'pending' })).toBe('lent')
    expect(etatDuFlux({ ...q, status: 'pending' })).toBe('bloque')
    expect(etatDuFlux(q)).toBe('pret')
  })
})

describe('ajouter à la sélection (`onAjouterSelection`)', () => {
  const vivante = (id: string) => ({ id, status: 'active' }) as MrhBien
  const retiree = (id: string) => ({ id, status: 'removed', retireeLe: '2026-09-20T04:17:00.000Z' }) as MrhBien

  it('⛔ une annonce retirée n’entre jamais dans une sélection ; les vivantes, dans l’ordre des cases', () => {
    const connus = [vivante('a'), { ...vivante('b'), status: 'price_reduced' }, retiree('c')]
    expect(biensAjoutables(['c', 'b', 'a'], connus).map((b) => b.id)).toEqual(['b', 'a'])
  })

  it('une case cochée vivante sur la grille, puis vue retirée dans « Retirés » : c’est le retrait qui compte', () => {
    // L'ordre de `onAjouterSelection` : la grille, puis le flux.
    expect(biensAjoutables(['c'], [vivante('c'), retiree('c')])).toEqual([])
  })

  it('un id qu’aucune liste chargée ne connaît est ignoré, et tout retiré ne laisse rien à ajouter', () => {
    expect(biensAjoutables(['x', 'a'], [vivante('a')]).map((b) => b.id)).toEqual(['a'])
    expect(biensAjoutables(['c'], [retiree('c')])).toEqual([])
  })
})

describe('historique d’une annonce', () => {
  it('versPointPrix range un genre inconnu parmi les statuts', () => {
    const p = versPointPrix({ id: 'h1', kind: 'inconnu', detected_at: 't', old_price: null, new_price: '900', change_pct: null, old_status: null, new_status: 'active' })
    expect(p).toMatchObject({ genre: 'statut', prix: 900, statut: 'active' })
  })

  it('série ouverte par une apparition : écart depuis la première détection, changements de prix comptés', () => {
    const points = [
      point('apparition', '2026-05-01T00:00:00.000Z', 1_000_000),
      point('baisse', '2026-06-01T00:00:00.000Z', 900_000, 1_000_000),
      point('hausse', '2026-07-01T00:00:00.000Z', 950_000, 900_000),
      point('statut', '2026-07-02T00:00:00.000Z', 950_000, 950_000),
    ]
    const r = resumerHistorique(points, { enLigneDepuis: '2026-05-01T00:00:00.000Z', retireeLe: null, prixActuel: 950_000, prixOriginal: 1_000_000 }, Date.parse('2026-05-31T00:00:00.000Z'))
    expect(r).toEqual({
      debut: { nature: 'detection', quand: '2026-05-01T00:00:00.000Z' },
      refEcart: { detection: true, quand: '2026-05-01T00:00:00.000Z' },
      premierPrix: 1_000_000, prixActuel: 950_000, changements: 2, ecartPct: -5, avantSuivi: null, joursSurMarche: 30,
    })
  })

  it('série ouverte par le relevé initial : l’écart se dit depuis le début du suivi', () => {
    const r = resumerHistorique([point('suivi', '2026-09-21T00:00:00.000Z', 2_000_000)], { enLigneDepuis: null, retireeLe: null, prixActuel: 2_000_000, prixOriginal: null }, Date.parse('2026-09-22T00:00:00.000Z'))
    expect(r.debut?.nature).toBe('suivi')
    expect(r).toMatchObject({ refEcart: { detection: false, quand: '2026-09-21T00:00:00.000Z' }, changements: 0, ecartPct: 0, avantSuivi: null, joursSurMarche: null })
  })

  it('⛔ une apparition SANS prix ne prête pas « depuis la première détection » à l’écart : il part du premier prix', () => {
    const points = [
      point('apparition', '2026-09-22T00:00:00.000Z', null),
      point('prix', '2026-09-25T00:00:00.000Z', 3000, 0),
      point('baisse', '2026-09-30T00:00:00.000Z', 2800, 3000),
    ]
    const r = resumerHistorique(points, { enLigneDepuis: '2026-09-20T00:00:00.000Z', retireeLe: null, prixActuel: 2800, prixOriginal: 3000 }, Date.parse('2026-10-01T00:00:00.000Z'))
    expect(r.debut).toEqual({ nature: 'detection', quand: '2026-09-22T00:00:00.000Z' })
    expect(r.refEcart).toEqual({ detection: false, quand: '2026-09-25T00:00:00.000Z' })
    expect(r).toMatchObject({ premierPrix: 3000, ecartPct: -6.7, avantSuivi: null })
  })

  it('⛔ déjà en baisse au début du suivi : la baisse d’avant se dit, à l’arrondi de l’affiche', () => {
    // RealAdvisor : premier prix gelé 1 000 000 (le prix barré de l'affiche), relevé à 905 000 le jour de la
    // pige, rien depuis. Sans cela : « 0 changement · écart 0,0 % » sous une affiche qui porte −9,5 %.
    const r = resumerHistorique([point('suivi', '2026-09-21T00:00:00.000Z', 905_000)], { enLigneDepuis: '2026-06-01T00:00:00.000Z', retireeLe: null, prixActuel: 905_000, prixOriginal: 1_000_000 }, Date.parse('2026-09-22T00:00:00.000Z'))
    expect(r).toMatchObject({ changements: 0, ecartPct: 0, avantSuivi: -9.5 })
    expect(r.avantSuivi).toBe(ecartPct(1_000_000, 905_000))
  })

  it('une baisse suivie depuis son premier prix n’est pas « d’avant le suivi »', () => {
    const points = [point('suivi', '2026-09-21T00:00:00.000Z', 2600), point('baisse', '2026-09-24T00:00:00.000Z', 2450, 2600)]
    const r = resumerHistorique(points, { enLigneDepuis: null, retireeLe: null, prixActuel: 2450, prixOriginal: 2600 }, Date.parse('2026-09-25T00:00:00.000Z'))
    expect(r).toMatchObject({ changements: 1, ecartPct: -5.8, avantSuivi: null })
  })

  it('une annonce retirée compte ses jours jusqu’à son retrait', () => {
    const r = resumerHistorique([], { enLigneDepuis: '2026-09-01T00:00:00.000Z', retireeLe: '2026-09-11T00:00:00.000Z', prixActuel: null, prixOriginal: null }, Date.parse('2026-09-21T00:00:00.000Z'))
    expect(r).toEqual({ debut: null, refEcart: null, premierPrix: null, prixActuel: null, changements: 0, ecartPct: null, avantSuivi: null, joursSurMarche: 10 })
  })

  it('tracerCourbe dessine un escalier jusqu’à la fin de la période', () => {
    const t0 = Date.parse('2026-09-01T00:00:00.000Z')
    const points = [point('suivi', new Date(t0).toISOString(), 100), point('baisse', new Date(t0 + 10 * JOUR).toISOString(), 80, 100)]
    const c = tracerCourbe(points, 200, 100, t0 + 20 * JOUR)
    expect(c?.chemin).toBe('M0 10 H100 V90 H200')
    expect(c?.marques.map((m) => [m.x, m.y, m.genre])).toEqual([[0, 10, 'suivi'], [100, 90, 'baisse']])
  })

  it('tracerCourbe : un seul prix donne une ligne plate, aucun prix ne donne rien', () => {
    const t0 = Date.parse('2026-09-01T00:00:00.000Z')
    expect(tracerCourbe([point('suivi', new Date(t0).toISOString(), 100)], 200, 100, t0)?.chemin).toBe('M0 50 H200')
    expect(tracerCourbe([point('statut', new Date(t0).toISOString(), null)], 200, 100, t0)).toBeNull()
  })
})

describe('lotsAnnonces (lot D1)', () => {
  it('des lots de 30 au plus, dans l’ordre reçu, sans doublon ; quand la liste s’allonge, seuls les lots PLEINS restent', () => {
    const ids = Array.from({ length: 65 }, (_, i) => `a${i}`)
    const lots = lotsAnnonces([...ids, 'a3'])
    expect(lots.map((l) => l.length)).toEqual([30, 30, 5])
    expect(lots[0]![0]).toBe('a0')
    const court = lotsAnnonces(ids.slice(0, 40))
    expect(court[0]).toEqual(lots[0])
    // Le dernier lot, incomplet, change : d'où `lotsParPage`.
    expect(court[1]).not.toEqual(lots[1])
    expect(lotsAnnonces([])).toEqual([])
  })

  it('⛔ lotsParPage : un lot par PAGE du flux — une page de plus ne touche aucun lot d’avant, même incomplet', () => {
    const page = (...ids: string[]) => ({ mouvements: ids.map((id) => ({ id: `mv-${id}`, bien: { id } }) as MouvementPige) })
    // Première page incomplète (une annonce y bouge deux fois) ; la seconde reprend `a`, lue deux fois pour la même valeur.
    const une = lotsParPage([page('a', 'b', 'a')])
    const deux = lotsParPage([page('a', 'b', 'a'), page('c', 'a')])
    expect(une).toEqual([['a', 'b']])
    expect(deux).toEqual([['a', 'b'], ['c', 'a']])
    expect(deux[0]).toEqual(une[0])
    expect(lotsParPage([])).toEqual([])
    expect(lotsParPage([page()])).toEqual([])
  })

  /**
   * ⛔ La RPC LIT au plus N identifiants (`(p_annonces)[1:N]`) et ignore les suivants SANS ERREUR : un lot plus grand
   * que sa borne laisserait des annonces sans pastille, et rien ne le dirait. Les deux tailles vivent dans deux
   * runtimes (SQL, navigateur) : c'est cette lecture de la migration qui les lie.
   */
  it('⛔ la taille des lots est la borne SQL de `pige_acheteurs_compatibles`', () => {
    const dossier = 'supabase/migrations'
    const fichier = readdirSync(dossier).find((f) => f.endsWith('_matching_surfaces.sql'))
    expect(fichier, 'migration du lot D1 introuvable').toBeDefined()
    const sql = readFileSync(join(dossier, fichier!), 'utf8')
    const bornes = [...sql.matchAll(/\(p_annonces\)\[1:(\d+)\]/g)].map((m) => Number(m[1]))
    expect(bornes.length, 'borne `(p_annonces)[1:N]` introuvable dans la migration').toBeGreaterThan(0)
    const taille = lotsAnnonces(Array.from({ length: 31 }, (_, i) => `a${i}`))[0]!.length
    expect(bornes.every((n) => n === taille), `bornes SQL ${bornes.join(', ')} ≠ lots de ${taille}`).toBe(true)
  })
})
