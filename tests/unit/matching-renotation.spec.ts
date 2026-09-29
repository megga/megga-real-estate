/**
 * « Apprendre » côté moteur (lot B) : la réévaluation des matchs à proposer d'une recherche ajustée rejoue
 * le VRAI barème (`calculateScoreV2`) ET le pré-filtre dur du moteur, écarte ce qu'il ne créerait pas
 * aujourd'hui, et ne touche pas un match ajouté à la main. La correction part en UNE clé, fusionnée dans les
 * critères d'aujourd'hui. Module pur de l'edge `matching-engine`, modes `rescore-search`, `match-contact` et
 * `scan-all`.
 *
 * Lot E1 (la renotation) : un couple que le moteur a noté avant les versions se renote, un ajout à la main
 * jamais, ni un bien déjà proposé ; le scan de nuit choisit ses couples (`aRattraper`) ; une note qui ne change
 * rien ne s'écrit pas (`notesAEcrire`), et une renotation qui ne change rien ne se journalise pas (`aJournaliser`) ;
 * elle ne tourne que sur le barème de la base, sa version comprise (`baremeLisible`).
 *
 * L'écart du moteur se défait (décision de Julien, 29.09.2026) : un match que la renotation a écarté (`ignored`,
 * `recherche_ajustee`) et qu'elle retient à nouveau revient à proposer ; encore écarté, sa note ne part pas. Un match
 * que l'AGENT a écarté (« Écarter ») ou que l'acheteur a refusé (« Pas intéressé ») n'est jamais relu : gardé par ce
 * que l'edge sélectionne (`RELUS_D_UNE_RECHERCHE`, évalué contre les lignes que laissent les VRAIS gestes), par la
 * lecture de l'edge elle-même, et par le `where` de l'écrivain (`matching_appliquer_notes`, lu dans sa migration).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateScoreV2, DEFAULT_SCORING_CONFIG, type MatchReasons,
} from '../../supabase/functions/_shared/matching-normalize'
import {
  aJournaliser, aRattraper, baremeLisible, ECART_DU_MOTEUR, fusionnerCorrection, lireCorrection, lireRefus, notesAEcrire,
  PLAFOND_RATTRAPAGE, RELUS_D_UNE_RECHERCHE, renoter, tranches, type MatchARattraper, type MatchARenoter, type NoteMatch,
} from '../../supabase/functions/_shared/matching-renotation'
import { execDismiss, execReact, execRepondre } from '@/lib/matchingGestes'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

// Les gestes de l'agent, JOUÉS : chaque écriture sur une table est consignée avec sa valeur au moment de l'envoi —
// supabase-js ne part qu'à l'`await` (`then`) —, et rend une ligne, comme une écriture qui a abouti.
const h = vi.hoisted(() => ({ ecritures: [] as { table: string; valeurs: Record<string, unknown> }[] }))
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      let valeurs: Record<string, unknown> | null = null
      const q = {
        update: (v: Record<string, unknown>) => { valeurs = v; return q },
        insert: () => q,
        select: () => q,
        eq: () => q,
        in: () => q,
        then: <T>(resoudre: (r: { data: unknown; error: null }) => T, rejeter?: (x: unknown) => T) => {
          if (valeurs) h.ecritures.push({ table, valeurs })
          return Promise.resolve({ data: [{ id: 'm-1' }], error: null }).then(resoudre, rejeter)
        },
      }
      return q
    },
  },
}))
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))

const CRITERES = {
  transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_550_000,
  rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur', 'terrasse'],
}
const annonce = (id: string, prix: number, champs: Record<string, unknown> = {}): Record<string, unknown> => ({
  id, price: prix, current_price: prix, type: 'apartment', city: 'Genève', canton: 'GE', rooms: 4.5, surface_m2: 132,
  features: ['Terrasse', 'Ascenseur', 'Balcon'], status: 'active', price_at_first_seen: prix, transaction_type: 'buy',
  quality_score: 70, ...champs,
})
/** Des raisons que le moteur a écrites : ses axes, en objets depuis la version 2. */
const RAISONS_MOTEUR = { budget: { match: true, score: 32, detail: 'Dans le budget' } }
const match = (id: string, bienId: string, champs: Partial<MatchARenoter> = {}): MatchARenoter => ({
  id, property_id: null, market_listing_id: bienId, status: 'suggested', reaction_motif: null, score: 80, score_version: 4,
  reasons: RAISONS_MOTEUR, ...champs,
})
/** Un match que la renotation a sorti des propositions : `ignored`, `recherche_ajustee`, la note de son écart. */
const ecarteDuMoteur = (id: string, bienId: string, champs: Partial<MatchARenoter> = {}): MatchARenoter =>
  match(id, bienId, { status: 'ignored', reaction_motif: ECART_DU_MOTEUR, score: 0, ...champs })
const sansLoyer = () => null

describe('renoter — le vrai barème, sur les critères corrigés', () => {
  const biens = new Map<string, Record<string, unknown>>([
    ['ml-2', annonce('ml-2', 1_590_000)],
    ['ml-4', annonce('ml-4', 1_750_000, { city: 'Onex', rooms: 3.5, surface_m2: 92, features: ['Ascenseur'] })],
  ])

  it('score et raisons de calculateScoreV2 ; sous le seuil, écarté', () => {
    const notes = renoter([match('m9', 'ml-2'), match('m19', 'ml-4')], biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    const attendu = (id: string) => calculateScoreV2(biens.get(id)!, CRITERES, DEFAULT_SCORING_CONFIG, null)
    expect(notes).toEqual([
      { id: 'm9', score: attendu('ml-2').total, reasons: attendu('ml-2').reasons, score_version: DEFAULT_SCORING_CONFIG.version, ecarte: false, revient: false },
      { id: 'm19', score: attendu('ml-4').total, reasons: attendu('ml-4').reasons, score_version: DEFAULT_SCORING_CONFIG.version, ecarte: true, revient: false },
    ])
    // Les notes du banc : 94, et 49 sous le seuil.
    expect(notes.map((n) => n.score)).toEqual([94, 49])
  })

  it('un match ajouté à la main (ni version, ni axe du moteur), ou dont le bien est illisible, n’est pas renoté', () => {
    // La Recherche écrit `{ keys: [...] }`, ou rien : l'agent a choisi ces biens.
    expect(renoter(
      [
        match('m-main', 'ml-2', { score_version: null, reasons: { keys: ['budget', 'zone'] } }),
        match('m-main-vide', 'ml-2', { score_version: null, reasons: {} }),
        match('m-main-nul', 'ml-2', { score_version: null, reasons: null }),
        match('m-perdu', 'ml-inconnue'),
      ],
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )).toEqual([])
  })

  it('un couple que le moteur a noté AVANT les versions (sans `score_version`, ses axes dans `reasons`) est renoté', () => {
    // Ses raisons portent les axes du moteur — en objets, ou en booléens comme les décrit docs/schema.md : c'est lui
    // qui l'a noté, avec un barème périmé.
    const avant = { budget: true, zone: true, rooms: true, surface: false, features: ['parking'] }
    const notes = renoter(
      [match('m-avant', 'ml-2', { score_version: null, reasons: avant }), match('m-objets', 'ml-4', { score_version: null })],
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )
    expect(notes.map((n) => [n.id, n.score, n.score_version])).toEqual([
      ['m-avant', 94, DEFAULT_SCORING_CONFIG.version], ['m-objets', 49, DEFAULT_SCORING_CONFIG.version],
    ])
  })

  it('un bien déjà proposé, répondu, en visite, ou écarté par l’agent garde sa note', () => {
    expect(renoter(
      ['sent', 'interested', 'rejected', 'visit_planned', 'ignored'].map((status) => match(`m-${status}`, 'ml-2', { status })),
      biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer,
    )).toEqual([])
    // « Écarter » efface le motif et « Pas intéressé » pose `rejected` : ni l'un ni l'autre n'est un écart du moteur. En
    // défense, un écart d'agent resté avec son motif (`prix`, d'un bien revenu par une baisse) ne l'est pas non plus.
    expect(renoter([
      match('ecarte-agent-revenu', 'ml-2', { status: 'ignored', reaction_motif: 'prix' }),
      match('refuse', 'ml-2', { status: 'rejected', reaction_motif: 'prix' }),
      match('refuse-motif-moteur', 'ml-2', { status: 'rejected', reaction_motif: ECART_DU_MOTEUR }),
    ], biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)).toEqual([])
  })

  it('un bien d’une autre transaction est écarté, comme le moteur ne l’aurait jamais créé', () => {
    const loc = new Map([['p-loc', annonce('p-loc', 3_000, { transaction_type: 'rent' })]])
    const [n] = renoter([match('m-x', 'p-loc', { market_listing_id: null, property_id: 'p-loc' })], loc, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    expect(n).toMatchObject({ id: 'm-x', score: 0, ecarte: true })
  })

  it('la référence loyer ne sert qu’une annonce du MARCHÉ d’une recherche de LOCATION', () => {
    const refLoyer = vi.fn(() => null)
    renoter([match('m9', 'ml-2')], biens, CRITERES, DEFAULT_SCORING_CONFIG, refLoyer)
    expect(refLoyer).not.toHaveBeenCalled()
    const loyer = { ...CRITERES, transaction_type: 'rent', budget_min: 2_000, budget_max: 3_000 }
    const locations = new Map([
      ['ml-l', annonce('ml-l', 2_800, { transaction_type: 'rent' })],
      ['p-l', annonce('p-l', 2_800, { transaction_type: 'rent' })],
    ])
    renoter([match('a', 'ml-l'), match('b', 'p-l', { market_listing_id: null, property_id: 'p-l' })], locations, loyer, DEFAULT_SCORING_CONFIG, refLoyer)
    expect(refLoyer).toHaveBeenCalledTimes(1)
  })
})

describe('renoter — le pré-filtre dur de `match_candidate_listings`, rejoué', () => {
  const noter = (a: Record<string, unknown>) =>
    renoter([match('m', a.id as string)], new Map([[a.id as string, a]]), CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)[0]!

  it('au-delà du budget à 15 % près, écarté même quand le barème le garderait', () => {
    // 1'800'000 > 1'550'000 × 1,15 : le budget ne rapporte rien, les quatre autres axes suffiraient au seuil.
    const cher = annonce('ml-cher', 1_800_000)
    expect(calculateScoreV2(cher, CRITERES).total).toBeGreaterThanOrEqual(DEFAULT_SCORING_CONFIG.threshold)
    expect(noter(cher)).toMatchObject({ score: 0, ecarte: true })
    // À la borne, il passe (`<=`, comme en SQL) ; sous le minimum à 15 % près, il sort.
    expect(noter(annonce('ml-borne', 1_782_500)).ecarte).toBe(false)
    expect(noter(annonce('ml-bas', 1_100_000))).toMatchObject({ score: 0, ecarte: true })
  })

  it('hors des cantons de la recherche, sans prix, retirée, sans qualité : écartée', () => {
    expect(noter(annonce('ml-vd', 1_500_000, { canton: 'VD', city: 'Lausanne' })).ecarte).toBe(true)
    expect(noter(annonce('ml-0', 0, { current_price: 0 })).ecarte).toBe(true)
    expect(noter(annonce('ml-retiree', 1_500_000, { status: 'removed' })).ecarte).toBe(true)
    expect(noter(annonce('ml-qualite', 1_500_000, { quality_score: 40 })).ecarte).toBe(true)
    expect(noter(annonce('ml-inconnue', 1_500_000, { quality_score: null })).ecarte).toBe(true)
    expect(noter(annonce('ml-baisse', 1_500_000, { status: 'price_reduced', price_at_first_seen: 1_600_000 })).ecarte).toBe(false)
  })

  it('un MANDAT n’a pas de pré-filtre de prix : le barème seul décide, comme à sa création', () => {
    const cher = annonce('p-cher', 1_800_000)
    const [n] = renoter([match('m', 'p-cher', { market_listing_id: null, property_id: 'p-cher' })], new Map([['p-cher', cher]]), CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    expect(n).toMatchObject({ score: calculateScoreV2(cher, CRITERES).total, ecarte: false })
  })
})

describe('aRattraper — ce que le scan de nuit renote (lot E1)', () => {
  const COURANTE = 4
  const ACTIVES = new Set(['r1', 'r2'])
  const couple = (id: string, recherche: string | null, champs: Partial<MatchARattraper> = {}): MatchARattraper => ({
    ...match(id, `ml-${id}`), client_search_id: recherche, ...champs,
  })
  /** La sélection, lisible : les ids par recherche, dans l'ordre. */
  const ids = (selection: Map<string, MatchARattraper[]>) =>
    Object.fromEntries([...selection].map(([recherche, matchs]) => [recherche, matchs.map((m) => m.id)]))

  it('les versions ANTÉRIEURES, et sans version quand le moteur l’a noté — ni la courante, ni une ultérieure, ni un ajout à la main', () => {
    expect(ids(aRattraper([
      couple('v2', 'r1', { score_version: 2 }),
      couple('v3', 'r1', { score_version: 3 }),
      couple('sans', 'r1', { score_version: null }),
      couple('v4', 'r1', { score_version: 4 }),
      couple('v5', 'r1', { score_version: 5 }),
      couple('main', 'r1', { score_version: null, reasons: { keys: ['budget'] } }),
    ], COURANTE, ACTIVES))).toEqual({ r1: ['v2', 'v3', 'sans'] })
  })

  it('à proposer seulement : un bien déjà proposé garde la note de sa proposition', () => {
    expect(ids(aRattraper(
      ['sent', 'interested', 'rejected', 'visit_planned', 'ignored'].map((status) => couple(status, 'r1', { status, score_version: 2 })),
      COURANTE, ACTIVES,
    ))).toEqual({})
  })

  it('ni un écarté du moteur, même noté par une version antérieure : il revient à la renotation suivante de SA recherche', () => {
    expect(ids(aRattraper([
      { ...ecarteDuMoteur('ecarte', 'ml-ecarte', { score_version: 2 }), client_search_id: 'r1' },
      { ...ecarteDuMoteur('ecarte-sans', 'ml-ecarte-sans', { score_version: null }), client_search_id: 'r1' },
      couple('a-proposer', 'r1', { score_version: 2 }),
    ], COURANTE, ACTIVES))).toEqual({ r1: ['a-proposer'] })
  })

  it('d’une recherche ACTIVE : ni d’une recherche close ou supprimée, ni sans recherche', () => {
    expect(ids(aRattraper([
      couple('close', 'r-close', { score_version: 2 }),
      couple('orphelin', null, { score_version: 2 }),
      couple('actif', 'r2', { score_version: 2 }),
    ], COURANTE, ACTIVES))).toEqual({ r2: ['actif'] })
  })

  it('groupés par recherche, chaque groupe dans l’ordre de lecture', () => {
    expect(ids(aRattraper([
      couple('a', 'r2', { score_version: 2 }),
      couple('b', 'r1', { score_version: null }),
      couple('c', 'r2', { score_version: 3 }),
      couple('d', 'r1', { score_version: 1 }),
    ], COURANTE, ACTIVES))).toEqual({ r2: ['a', 'c'], r1: ['b', 'd'] })
  })

  it('au plus `plafond` couples, les premiers lus ; ceux qu’il écarte ne comptent pas', () => {
    const lus = [
      couple('a', 'r1', { score_version: 2 }),
      couple('courant', 'r1', { score_version: 4 }),
      couple('main', 'r2', { score_version: null, reasons: {} }),
      couple('b', 'r2', { score_version: 2 }),
      couple('c', 'r1', { score_version: 2 }),
    ]
    expect(ids(aRattraper(lus, COURANTE, ACTIVES, 2))).toEqual({ r1: ['a'], r2: ['b'] })
  })

  it('2 000 par défaut, par agence et par nuit : le 2 001ᵉ attend la nuit d’après', () => {
    expect(PLAFOND_RATTRAPAGE).toBe(2000)
    const lus = Array.from({ length: 2001 }, (_, i) => couple(`m${i}`, i % 2 ? 'r1' : 'r2', { score_version: 2 }))
    const selection = aRattraper(lus, COURANTE, ACTIVES)
    const retenus = [...selection.values()].flat().map((m) => m.id)
    expect(retenus).toHaveLength(2000)
    expect(retenus).not.toContain('m2000')
  })
})

describe('aJournaliser — une renotation ne se journalise que si elle change quelque chose (lot E1)', () => {
  const lus = [match('m1', 'ml-1', { score: 80 }), match('m2', 'ml-2', { score: 60 })]
  const raisons = calculateScoreV2(annonce('ml-1', 1_590_000), CRITERES).reasons
  const note = (id: string, score: number, ecarte = false): NoteMatch =>
    ({ id, score, reasons: raisons, score_version: 4, ecarte, revient: false })

  it('les mêmes notes, rien d’écarté : rien à journaliser — une version tamponnée ne se journalise pas', () => {
    expect(aJournaliser(lus, [note('m1', 80), note('m2', 60)])).toBe(false)
    expect(aJournaliser(lus, [])).toBe(false)
  })

  it('une note qui change, à la hausse comme à la baisse : à journaliser', () => {
    expect(aJournaliser(lus, [note('m1', 80), note('m2', 61)])).toBe(true)
    expect(aJournaliser(lus, [note('m1', 79)])).toBe(true)
  })

  it('un match écarté, même à note égale : son statut change, à journaliser', () => {
    // Un seuil relevé : la note ne bouge pas, le match sort d'« À proposer ».
    expect(aJournaliser(lus, [note('m1', 80), note('m2', 60, true)])).toBe(true)
  })
})

describe('notesAEcrire — une note qui ne change rien ne part pas vers l’écrivain (lot E1)', () => {
  const { total, reasons: raisons } = calculateScoreV2(annonce('ml-1', 1_590_000), CRITERES)
  /** Ce que rend une colonne jsonb : les clés de chaque objet triées par longueur, puis par octets. */
  const commeJsonb = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(commeJsonb)
    if (v === null || typeof v !== 'object') return v
    return Object.fromEntries(Object.entries(v)
      .sort(([a], [b]) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => [k, commeJsonb(x)]))
  }
  /** Le match tel que lu : il porte déjà la note que le barème lui donne, sauf `champs`. */
  const lu = (id: string, champs: Partial<MatchARenoter> = {}): MatchARenoter =>
    match(id, 'ml-1', { score: total, score_version: 4, reasons: JSON.parse(JSON.stringify(raisons)), ...champs })
  const note = (id: string, champs: Partial<NoteMatch> = {}): NoteMatch =>
    ({ id, score: total, reasons: raisons, score_version: 4, ecarte: false, revient: false, ...champs })
  /** Les ids des notes qui partent. */
  const partent = (lus: MatchARenoter[], notes: NoteMatch[]) => notesAEcrire(lus, notes).map((n) => n.id)

  it('la note que le match porte déjà — score, version, raisons, rien d’écarté : elle ne part pas', () => {
    expect(partent([lu('m1')], [note('m1')])).toEqual([])
  })

  it('des raisons que la base rend réordonnées sont les mêmes : la note ne part pas', () => {
    // Comparées sur leur texte, elles différeraient toutes, et chaque passage réécrirait chaque note.
    expect(JSON.stringify(commeJsonb(raisons))).not.toBe(JSON.stringify(raisons))
    expect(partent([lu('m1', { reasons: commeJsonb(raisons) })], [note('m1')])).toEqual([])
  })

  it('une clé `undefined` n’existe pas en base : la note ne part pas pour elle', () => {
    const avecVide = { ...raisons, budget: { ...raisons.budget, bonus: undefined } } as MatchReasons
    expect(partent([lu('m1', { reasons: commeJsonb(raisons) })], [note('m1', { reasons: avecVide })])).toEqual([])
  })

  it('une version à tamponner — même score, mêmes raisons, version antérieure ou nulle : elle part, sans quoi la nuit la reprendrait', () => {
    expect(partent([lu('m1', { score_version: 3 })], [note('m1')])).toEqual(['m1'])
    expect(partent([lu('m1', { score_version: null })], [note('m1')])).toEqual(['m1'])
  })

  it('un score changé, à la hausse comme à la baisse : elle part', () => {
    expect(partent([lu('m1', { score: total - 1 })], [note('m1')])).toEqual(['m1'])
    expect(partent([lu('m1', { score: total + 1 })], [note('m1')])).toEqual(['m1'])
  })

  it('des raisons changées : elle part — un détail, ou les booléens d’avant les versions', () => {
    const autre = { ...raisons, budget: { ...raisons.budget, detail: 'Prix indisponible' } }
    expect(partent([lu('m1', { reasons: autre })], [note('m1')])).toEqual(['m1'])
    const avant = { budget: true, zone: true, type: true, rooms: true, features: true }
    expect(partent([lu('m1', { reasons: avant })], [note('m1')])).toEqual(['m1'])
  })

  it('une note qui écarte son match, même identique à la lecture : elle part — il sort d’« À proposer »', () => {
    expect(partent([lu('m1')], [note('m1', { ecarte: true })])).toEqual(['m1'])
  })

  it('parmi plusieurs, seules partent celles qui changent, dans leur ordre ; un match non lu, faute de quoi comparer', () => {
    const lus = [lu('m1'), lu('m2', { score: total - 5 }), lu('m3', { score_version: 3 }), lu('m4')]
    const notes = ['m4', 'm3', 'm2', 'm1', 'm-inconnu'].map((id) => note(id))
    expect(partent(lus, notes)).toEqual(['m3', 'm2', 'm-inconnu'])
  })
})

describe('l’écart du moteur se défait : un écarté retenu à nouveau revient à proposer (29.09.2026)', () => {
  // Les notes du barème : 94 pour ml-2, 49 (sous le seuil) pour ml-4 ; ml-cher sort du pré-filtre (budget à 15 % près).
  const biens = new Map<string, Record<string, unknown>>([
    ['ml-2', annonce('ml-2', 1_590_000)],
    ['ml-4', annonce('ml-4', 1_750_000, { city: 'Onex', rooms: 3.5, surface_m2: 92, features: ['Ascenseur'] })],
    ['ml-cher', annonce('ml-cher', 1_800_000)],
  ])
  const noter = (matchs: MatchARenoter[]) => renoter(matchs, biens, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
  /** La note que le barème donne à ml-2 : celle qu'un écarté peut déjà porter, sorti sous un seuil plus haut. */
  const n94 = () => noter([match('x', 'ml-2')])[0]!

  it('retenu à nouveau — au seuil et dans le pré-filtre —, il a la note du barème et REVIENT ; sinon il reste écarté', () => {
    expect(noter([
      ecarteDuMoteur('e-retenu', 'ml-2'), ecarteDuMoteur('e-sous', 'ml-4'), ecarteDuMoteur('e-hors', 'ml-cher'),
    ]).map((n) => [n.id, n.score, n.ecarte, n.revient])).toEqual([
      ['e-retenu', 94, false, true], ['e-sous', 49, true, false], ['e-hors', 0, true, false],
    ])
  })

  it('un match à proposer que sa note garde ne « revient » pas : il y est déjà', () => {
    expect(noter([match('m', 'ml-2')])[0]).toMatchObject({ ecarte: false, revient: false })
  })

  it('sur un MANDAT, il ne revient qu’en vente (`active`, non supprimé) : vendu ou supprimé, il reste écarté et ne part pas', () => {
    const mandat = (id: string, champs: Record<string, unknown>) => annonce(id, 1_590_000, { deleted_at: null, ...champs })
    const mandats = new Map<string, Record<string, unknown>>([
      ['p-actif', mandat('p-actif', { status: 'active' })],
      ['p-vendu', mandat('p-vendu', { status: 'sold' })],
      ['p-supprime', mandat('p-supprime', { status: 'active', deleted_at: '2026-09-20T08:00:00Z' })],
    ])
    const surMandat = (id: string, bien: string) => ecarteDuMoteur(id, bien, { market_listing_id: null, property_id: bien })
    const lus = [surMandat('e-actif', 'p-actif'), surMandat('e-vendu', 'p-vendu'), surMandat('e-supprime', 'p-supprime')]
    const notes = renoter(lus, mandats, CRITERES, DEFAULT_SCORING_CONFIG, sansLoyer)
    // Retenus par le barème tous trois : seul le mandat en vente fait revenir le sien.
    expect(notes.map((n) => [n.id, n.ecarte, n.revient])).toEqual([
      ['e-actif', false, true], ['e-vendu', false, false], ['e-supprime', false, false],
    ])
    expect(notesAEcrire(lus, notes).map((n) => n.id)).toEqual(['e-actif'])
  })

  it('un ajout à la main n’est jamais renoté, écarté ou non', () => {
    const main = { score_version: null, reasons: { keys: ['zone'] } }
    expect(noter([
      match('main-ecarte-agent', 'ml-2', { ...main, status: 'ignored' }),
      // Aucun écrivain ne le produit — le moteur ne l'a jamais noté, donc jamais écarté — : la règle tient quand même.
      match('main-motif-moteur', 'ml-2', { ...main, status: 'ignored', reaction_motif: ECART_DU_MOTEUR }),
    ])).toEqual([])
  })

  it('le retour part vers l’écrivain, même à la note qu’il portait ; un écarté qui le reste ne part pas, même noté autrement', () => {
    const lus = [
      ecarteDuMoteur('e-retenu', 'ml-2'),
      // Sorti sous un seuil plus haut, à la note que le barème lui redonne : seul son statut change.
      ecarteDuMoteur('e-meme-note', 'ml-2', { score: n94().score, reasons: n94().reasons }),
      ecarteDuMoteur('e-sous', 'ml-4', { score: 12, score_version: 2 }),
      ecarteDuMoteur('e-hors', 'ml-cher', { score_version: 2 }),
    ]
    expect(notesAEcrire(lus, noter(lus)).map((n) => n.id)).toEqual(['e-retenu', 'e-meme-note'])
  })

  it('un retour se journalise, même à note égale ; un écarté qui le reste, non — même noté autrement', () => {
    const lus = [
      ecarteDuMoteur('e-meme-note', 'ml-2', { score: n94().score, reasons: n94().reasons }),
      ecarteDuMoteur('e-sous', 'ml-4', { score: 12 }),
    ]
    const [retour, encore] = noter(lus)
    expect(aJournaliser(lus, [retour!])).toBe(true)
    expect(aJournaliser(lus, [encore!])).toBe(false)
  })
})

/**
 * Un tout petit évaluateur du filtre PostgREST que l'edge passe à `.or(…)` : des termes `colonne.eq.valeur`, et des
 * groupes `and(…)` / `or(…)`, séparés par des virgules au premier niveau. Un opérateur qu'il ne sait pas lire LÈVE :
 * un filtre illisible ne passe pas pour un filtre qui refuse. `eq` sur une colonne nulle est faux, comme en SQL.
 */
function evaluer(groupe: string, mode: 'and' | 'or', ligne: Record<string, unknown>): boolean {
  const termes: string[] = []
  let profondeur = 0
  let debut = 0
  for (let i = 0; i < groupe.length; i++) {
    const c = groupe[i]
    if (c === '(') profondeur++
    else if (c === ')') profondeur--
    else if (c === ',' && profondeur === 0) { termes.push(groupe.slice(debut, i)); debut = i + 1 }
  }
  termes.push(groupe.slice(debut))
  const verdicts = termes.map((t) => {
    const imbrique = /^(and|or)\((.*)\)$/.exec(t)
    if (imbrique) return evaluer(imbrique[2]!, imbrique[1] as 'and' | 'or', ligne)
    const [colonne, op, ...valeur] = t.split('.')
    if (op !== 'eq') throw new Error(`opérateur non lu : ${t}`)
    const v = ligne[colonne!]
    return v != null && String(v) === valeur.join('.')
  })
  return mode === 'and' ? verdicts.every(Boolean) : verdicts.some(Boolean)
}
/** Ce que la renotation d'une recherche relit de cette ligne (`RELUS_D_UNE_RECHERCHE`). */
const relu = (ligne: Record<string, unknown>) => evaluer(RELUS_D_UNE_RECHERCHE, 'or', ligne)

/** La migration du lot B, par son suffixe : elle se redate au jour de la fusion. */
function migrationBoucle(): string {
  const dossier = join(process.cwd(), 'supabase/migrations')
  const noms = readdirSync(dossier).filter((n) => n.endsWith('_matching_boucle.sql'))
  expect(noms).toHaveLength(1)
  return readFileSync(join(dossier, noms[0]!), 'utf8')
}
/** Sans commentaires ni blancs superflus : un corps se lit sur ce qu'il exécute. */
const nu = (s: string) => s.replace(/--.*$/gm, '').replace(/\s+/g, ' ').trim()

describe('l’écart de l’agent n’est jamais relu : ce que l’edge sélectionne, ce que l’écrivain accepte (29.09.2026)', () => {
  const ligne = (status: string, reaction_motif: string | null = null) => ({ status, reaction_motif })
  const CTX = { agencyId: 'ag-1', userId: 'u-1' }
  const ACHETEUR = { id: 'c-1', matchId: 'm-1', first: 'Julie', last: 'Morand', score: 90 }
  /** Les valeurs que les gestes ont écrites sur `matches`, dans l'ordre d'envoi. */
  const surLesMatchs = () => h.ecritures.filter((e) => e.table === 'matches').map((e) => e.valeurs)
  beforeEach(() => { h.ecritures.length = 0 })

  it('le filtre : les matchs à proposer, et `ignored` avec `recherche_ajustee` — aucun autre statut, aucun autre motif', () => {
    expect(relu(ligne('suggested'))).toBe(true)
    // Un bien revenu par une baisse : à proposer, son motif `prix` gardé.
    expect(relu(ligne('suggested', 'prix'))).toBe(true)
    expect(relu(ligne('ignored', ECART_DU_MOTEUR))).toBe(true)
    const jamais: [string, string | null][] = [
      ['ignored', null], ['ignored', 'prix'], ['ignored', 'quartier'],
      ['rejected', null], ['rejected', 'prix'], ['rejected', ECART_DU_MOTEUR],
      ['sent', null], ['interested', null], ['visit_planned', null], ['visit_planned', ECART_DU_MOTEUR],
    ]
    for (const [status, motif] of jamais) expect(relu(ligne(status, motif)), `${status} / ${motif}`).toBe(false)
  })

  it('« Écarter » (fil, mobile) écrit `ignored` et efface le motif : le match qu’il laisse n’est jamais relu — même un écart du moteur resté à l’écran', async () => {
    for (const avant of [ligne('suggested'), ligne('suggested', 'prix'), ligne('ignored', ECART_DU_MOTEUR)]) {
      h.ecritures.length = 0
      await execDismiss(CTX, ACHETEUR)
      expect(surLesMatchs()).toEqual([{ status: 'ignored', reaction_motif: null }])
      expect(relu({ ...avant, ...surLesMatchs()[0] }), JSON.stringify(avant)).toBe(false)
    }
  })

  it('tout écrivain du client qui pose `ignored` efface le motif : un écart du moteur ne se confond jamais avec celui de l’agent', () => {
    const ecrivains: string[] = []
    const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) && !n.endsWith('.d.ts') }])
    expect(emptyRoots(scan)).toEqual([])
    expect(scan.unreadable).toEqual([])
    for (const abs of scan.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      for (const m of lu.value.matchAll(/\.update\(\{[^}]*status:\s*'ignored'[^}]*\}/g)) ecrivains.push(`${rel(abs)} ${m[0]}`)
    }
    // Le fil et le mobile (`execDismiss`), et le hook du mobile (`useMatching`).
    expect(ecrivains).toHaveLength(2)
    for (const e of ecrivains) expect(e, e).toMatch(/reaction_motif:\s*null/)
  })

  it('« Pas intéressé » (fil, puis écran mobile) écrit `rejected` : le match qu’il laisse n’est jamais relu', async () => {
    await execRepondre(ACHETEUR, { genre: 'rejected', motif: 'prix', note: null })
    await execReact(ACHETEUR, 'rejected')
    const ecrits = surLesMatchs()
    expect(ecrits.map((v) => v.status)).toEqual(['rejected', 'rejected'])
    for (const v of ecrits) expect(relu({ ...ligne('sent'), ...v }), JSON.stringify(v)).toBe(false)
  })

  it('l’edge relit par ce filtre, et par lui seul, dans les deux renotations d’une recherche ; la nuit reste sur les matchs à proposer', () => {
    const edge = readFileSync(join(process.cwd(), 'supabase/functions/matching-engine/index.ts'), 'utf8')
    /** Le corps d'une fonction de l'edge : de sa déclaration à la première accolade fermante en début de ligne. */
    const corps = (declaration: string) => {
      const i = edge.indexOf(declaration)
      expect(i, declaration).toBeGreaterThanOrEqual(0)
      return edge.slice(i, edge.indexOf('\n}\n', i))
    }
    const lecture = corps('function matchsDeLaRecherche(')
    expect(lecture).toContain('.or(RELUS_D_UNE_RECHERCHE)')
    // Aucun autre filtre de statut ou de motif ne s'y ajoute, ni ne s'y substitue.
    expect(lecture).not.toMatch(/['"](status|reaction_motif)['"]/)
    // `rescore-search` et `match-contact` lisent par elle, et rien d'autre ne l'appelle.
    expect(corps('async function renoterRecherche(')).toContain('await matchsDeLaRecherche(supabase, agencyId, recherche)')
    expect(edge).toContain('(recherche) => matchsDeLaRecherche(supabase, agency_id, recherche)')
    expect(edge.match(/matchsDeLaRecherche\(supabase/g)).toHaveLength(2)
    // La nuit : les seuls matchs à proposer (son index partiel), jamais le filtre d'une recherche.
    const nuit = corps('async function couplesARattraper(')
    expect(nuit).toContain(".eq('status', 'suggested')")
    expect(nuit).not.toContain('RELUS_D_UNE_RECHERCHE')
    // Les mandats se lisent avec de quoi savoir s'ils sont en vente : sans `status`, aucun écarté n'y reviendrait.
    expect(edge).toContain('const COLS_MANDAT_NOTE = `${PROP_COLS}, status, deleted_at`')
    expect(corps('async function ecrireNotes(')).toContain(".from('properties').select(COLS_MANDAT_NOTE)")
  })

  it('l’écrivain (`matching_appliquer_notes`) n’accepte, hors un match à proposer, que l’écart du moteur ; le retour efface le motif', () => {
    const sql = migrationBoucle()
    const i = sql.indexOf('create or replace function public.matching_appliquer_notes(')
    expect(i).toBeGreaterThanOrEqual(0)
    const as = sql.indexOf('as $$', i)
    const corps = nu(sql.slice(as + 'as $$'.length, sql.indexOf('$$;', as)))
    expect(sql.slice(i, as)).toMatch(/security invoker/)
    expect(corps.match(/\bwhere\b/g)).toHaveLength(1)
    expect(corps).toContain(
      `and (m.status = 'suggested' or (m.status = 'ignored' and m.reaction_motif = '${ECART_DU_MOTEUR}'))`)
    expect(corps).toContain(
      "status = case when (n->>'ecarte')::boolean then 'ignored' when m.status = 'ignored' then 'suggested' else m.status end,")
    expect(corps).toContain(
      `reaction_motif = case when (n->>'ecarte')::boolean then '${ECART_DU_MOTEUR}' when m.status = 'ignored' then null else m.reaction_motif end`)
    expect(corps).toContain('returning m.id, m.status;')
    expect(sql).toContain(
      'revoke all on function public.matching_appliquer_notes(uuid, uuid, jsonb) from public, anon, authenticated;')
    expect(sql).toContain('grant execute on function public.matching_appliquer_notes(uuid, uuid, jsonb) to service_role;')
  })
})

describe('baremeLisible — la renotation ne tourne que sur le barème de la base (lot E1)', () => {
  it('le barème rendu, sa version comprise — en nombre, ou en texte comme `parseScoringConfig` la lit : lisible', () => {
    expect(baremeLisible('{"weights":{"price":32,"zone":24},"threshold":55,"version":3}')).toBe(true)
    expect(baremeLisible('{"version":"3"}')).toBe(true)
  })

  it('absent, illisible ou sans version : le moteur tournerait sur ses défauts, rien ne se renote', () => {
    for (const texte of [null, undefined, '', 'pas du json', '{"threshold":55}', '{"version":"v3"}', '[3]', '3', 'null', 3]) {
      expect(baremeLisible(texte), String(texte)).toBe(false)
    }
  })
})

describe('la correction : UNE clé, fusionnée dans les critères d’aujourd’hui', () => {
  it('lit les seules clés que la fiche écrit, chacune dans sa forme', () => {
    expect(lireCorrection({ cle: 'budget_max', valeur: 1_550_000 })).toEqual({ cle: 'budget_max', valeur: 1_550_000 })
    expect(lireCorrection({ cle: 'zones', valeur: ['Champel', 'GE'] })).toEqual({ cle: 'zones', valeur: ['Champel', 'GE'] })
    expect(lireCorrection({ cle: 'type', valeur: ' villa ' })).toEqual({ cle: 'type', valeur: 'villa' })
    for (const illisible of [
      null, [], { cle: 'budget_min', valeur: 1 }, { cle: 'toString', valeur: 1 }, { cle: 'budget_max', valeur: '1550000' },
      { cle: 'budget_max', valeur: 0 }, { cle: 'rooms_min', valeur: Number.NaN }, { cle: 'zones', valeur: [] },
      { cle: 'features', valeur: ['balcon', 3] }, { cle: 'type', valeur: '  ' },
    ]) expect(lireCorrection(illisible), JSON.stringify(illisible)).toBeNull()
  })

  it('ne remplace que sa clé : ce qu’un collègue a changé entre-temps sur une autre reste', () => {
    // L'écran avait lu `rooms_min: 4` ; la recherche porte désormais 5.
    const aujourdhui = { ...CRITERES, rooms_min: 5 }
    expect(fusionnerCorrection(aujourdhui, { cle: 'budget_max', valeur: 1_450_000 })).toEqual({ ...CRITERES, rooms_min: 5, budget_max: 1_450_000 })
    expect(fusionnerCorrection(null, { cle: 'type', valeur: 'house' })).toEqual({ type: 'house' })
  })
})

describe('lireRefus et tranches', () => {
  const U1 = '00000000-0000-4000-8000-000000000001'
  const U2 = '00000000-0000-4000-8000-000000000002'

  it('des uuid, sans doublon, sans plafond de 50 ; absente : aucun', () => {
    expect(lireRefus(undefined)).toEqual([])
    expect(lireRefus([U1, U2, U1])).toEqual([U1, U2])
    const nombreux = Array.from({ length: 120 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`)
    expect(lireRefus(nombreux)).toHaveLength(120)
    expect(lireRefus([U1, 'pas-un-uuid'])).toBeNull()
    expect(lireRefus('m-1')).toBeNull()
  })

  it('découpe en lots', () => {
    expect(tranches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(tranches([], 2)).toEqual([])
  })
})
