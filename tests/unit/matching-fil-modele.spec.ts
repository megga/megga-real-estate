/**
 * Le fil de matchs — le modèle de vue (`src/components/matching-fil/filModele.ts`).
 * Conception : docs/superpowers/specs/2026-09-17-matching-fil-design.md, §3 et §4.
 *
 * ⚠ Les `detail` des raisons reprennent le libellé EXACT du moteur (`matching-normalize.ts`) :
 * une fixture qui invente sa formulation éprouve un écran que la production ne rend jamais.
 */
import { describe, expect, it } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import {
  cleEquipement, cleSelection, compterHistorique, construireFil, construireSelections, contactDeSelection, criteresNonTenus,
  initiales, lignesCriteres, optionsFiltres, palierScore, precoches, premierEcart,
  type FilBien, type FilFiltres, type FilMatch, type FilSelectionResume,
} from '@/components/matching-fil/filModele'

const MAINTENANT = Date.parse('2026-09-17T12:00:00.000Z')
const SANS_FILTRE: FilFiltres = { bienId: null, acheteurId: null, texte: '' }

const bien = (id: string, champs: Partial<FilBien> = {}): FilBien => ({
  id, titre: `Bien ${id}`, prix: 1_000_000, location: false, type: 'apartment', pieces: 4.5,
  surface: 110, ville: 'Genève', canton: 'GE', adresse: null, equipements: [], photo: null, ...champs,
})
const acheteur = (id: string, champs: Partial<FilMatch['acheteur']> = {}): FilMatch['acheteur'] => ({
  id, prenom: `Prénom${id}`, nom: `Nom${id}`, telephone: null, email: null, kyc: 'none', ...champs,
})
const match = (id: string, score: number, b: FilBien, a: FilMatch['acheteur'], champs: Partial<FilMatch> = {}): FilMatch => ({
  id, score, raisons: null, criteres: null, creeLe: '2026-09-10T10:00:00.000Z', reporteJusquau: null, bien: b, acheteur: a, ...champs,
})

describe('palierScore — une seule échelle (§3.5)', () => {
  it.each([[100, 'fort'], [85, 'fort'], [84, 'bon'], [70, 'bon'], [69, 'possible'], [55, 'possible'], [54, 'possible']] as const)(
    '%i → %s', (score, palier) => { expect(palierScore(score)).toBe(palier) },
  )
})

describe('construireFil', () => {
  const champel = bien('p1', { titre: 'Champel' })
  const cologny = bien('p2', { titre: 'Cologny', ville: 'Cologny' })
  const emma = acheteur('c7', { prenom: 'Emma', nom: 'Schneider' })
  const julie = acheteur('c9', { prenom: 'Julie', nom: 'Morand' })
  const antoine = acheteur('c10', { prenom: 'Antoine', nom: 'Lefèvre' })

  it('groupe par bien, trie les groupes par meilleur score et les acheteurs par score', () => {
    const vue = construireFil([
      match('m3', 90, champel, julie),
      match('m2', 91, champel, emma),
      match('m5', 93, cologny, antoine),
    ], SANS_FILTRE, MAINTENANT)
    expect(vue.groupes.map((g) => g.bien.id)).toEqual(['p2', 'p1'])
    expect(vue.groupes[1]!.matchs.map((m) => m.id)).toEqual(['m2', 'm3'])
    expect(vue.ordre).toEqual(['m5', 'm2', 'm3'])
    expect(vue.compte).toBe(3)
  })

  it('à score égal : le plus récent, puis l’id — et une date absente ne casse pas l’ordre', () => {
    const vue = construireFil([
      match('b', 80, champel, julie, { creeLe: '2026-09-01T00:00:00.000Z' }),
      match('c', 80, champel, emma, { creeLe: '2026-09-05T00:00:00.000Z' }),
      match('a', 80, champel, antoine, { creeLe: '2026-09-01T00:00:00.000Z' }),
      match('d', 80, champel, antoine, { creeLe: null }),
    ], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre).toEqual(['c', 'a', 'b', 'd'])
  })

  it('un reporté quitte les lignes et le compte ; un report échu revient', () => {
    const vue = construireFil([
      match('m4', 68, champel, emma, { reporteJusquau: '2026-09-22T00:00:00.000Z' }),
      match('m9', 70, champel, antoine, { reporteJusquau: '2026-09-19T00:00:00.000Z' }),
      match('m3', 90, champel, julie, { reporteJusquau: '2026-09-16T00:00:00.000Z' }),
    ], SANS_FILTRE, MAINTENANT)
    expect(vue.ordre).toEqual(['m3'])
    expect(vue.compte).toBe(1)
    expect(vue.reportes.map((m) => m.id)).toEqual(['m9', 'm4'])
  })

  it('un bien dont tous les acheteurs sont reportés n’a plus de groupe', () => {
    const vue = construireFil(
      [match('m5', 93, cologny, antoine, { reporteJusquau: '2026-09-30T00:00:00.000Z' })],
      SANS_FILTRE, MAINTENANT,
    )
    expect(vue.groupes).toEqual([])
    expect(vue.reportes).toHaveLength(1)
  })

  it('les filtres s’appliquent aussi aux reportés', () => {
    const vue = construireFil(
      [match('m4', 68, champel, emma, { reporteJusquau: '2026-09-22T00:00:00.000Z' })],
      { ...SANS_FILTRE, acheteurId: 'c9' }, MAINTENANT,
    )
    expect(vue.reportes).toEqual([])
  })

  it('filtre par bien, par acheteur, et par texte sans accents ni ligatures', () => {
    const vandoeuvres = bien('p3', { titre: 'Maison · Vandœuvres', ville: 'Vandœuvres' })
    const tous = [
      match('m2', 91, champel, emma), match('m3', 90, champel, julie),
      match('m5', 93, cologny, antoine), match('m6', 70, vandoeuvres, julie),
    ]
    expect(construireFil(tous, { ...SANS_FILTRE, bienId: 'p1' }, MAINTENANT).ordre).toEqual(['m2', 'm3'])
    expect(construireFil(tous, { ...SANS_FILTRE, acheteurId: 'c7' }, MAINTENANT).ordre).toEqual(['m2'])
    expect(construireFil(tous, { ...SANS_FILTRE, texte: 'lefevre' }, MAINTENANT).ordre).toEqual(['m5'])
    expect(construireFil(tous, { ...SANS_FILTRE, texte: '  COLOGNY ' }, MAINTENANT).ordre).toEqual(['m5'])
    expect(construireFil(tous, { ...SANS_FILTRE, texte: 'vandoeuvres' }, MAINTENANT).ordre).toEqual(['m6'])
  })
})

describe('optionsFiltres', () => {
  it('rend chaque bien et chaque acheteur une fois, triés par libellé', () => {
    const villa = bien('p1', { titre: 'Villa' })
    const attique = bien('p2', { titre: 'Attique' })
    const zoe = acheteur('c1', { prenom: 'Zoé', nom: 'Aubert' })
    const elodie = acheteur('c2', { prenom: 'Élodie', nom: 'Roux' })
    const o = optionsFiltres([match('1', 90, villa, zoe), match('2', 80, attique, zoe), match('3', 70, villa, elodie)])
    expect(o.biens).toEqual([{ id: 'p2', libelle: 'Attique' }, { id: 'p1', libelle: 'Villa' }])
    expect(o.acheteurs).toEqual([{ id: 'c2', libelle: 'Élodie Roux' }, { id: 'c1', libelle: 'Zoé Aubert' }])
  })

  it('les acheteurs des lignes « Marché » en sont aussi, une fois chacun, dans le même tri', () => {
    // Marc n'a QUE des biens du marché : sans les sélections, le filtre Acheteur ne pouvait pas le viser.
    const villa = bien('p1', { titre: 'Villa' })
    const zoe = acheteur('c1', { prenom: 'Zoé', nom: 'Aubert' })
    const elodie = acheteur('c2', { prenom: 'Élodie', nom: 'Roux' })
    const marc = acheteur('c3', { prenom: 'Marc', nom: 'Favre' })
    const marche = (a: FilMatch['acheteur']): FilSelectionResume => ({ acheteur: a, nombre: 2, meilleurScore: 90, vignettes: [] })
    const o = optionsFiltres([match('1', 90, villa, zoe)], [marche(zoe), marche(marc), marche(elodie)])
    expect(o.biens).toEqual([{ id: 'p1', libelle: 'Villa' }])
    expect(o.acheteurs).toEqual([
      { id: 'c2', libelle: 'Élodie Roux' }, { id: 'c3', libelle: 'Marc Favre' }, { id: 'c1', libelle: 'Zoé Aubert' },
    ])
  })
})

describe('lignesCriteres — « Recherché / Ce bien » (§4.4)', () => {
  const champel = bien('p1', {
    prix: 1_450_000, ville: 'Genève', canton: 'GE', type: 'apartment', pieces: 4.5, surface: 118,
    equipements: ['Balcon', 'Ascenseur', 'Cave', 'Parking'],
  })
  const a = acheteur('c1')

  it('aucun critère sur la recherche, aucune ligne', () => {
    expect(lignesCriteres(match('m', 70, champel, a))).toEqual([])
  })

  it('une ligne par critère posé, dans l’ordre budget → équipements, verdicts du moteur', () => {
    const lignes = lignesCriteres(match('m4', 68, champel, a, {
      criteres: {
        transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Carouge', 'GE'],
        budget_min: 900_000, budget_max: 1_250_000, rooms_min: 4.5, surface_min: 90, features: ['balcon', 'ascenseur'],
      },
      raisons: {
        budget: { match: false, score: 0, detail: '16% au-dessus du budget' },
        zone: { match: true, score: 24, detail: 'Genève correspond' },
        type: { match: true, score: 12, detail: 'apartment' },
        rooms: { match: true, score: 22, detail: '4,5 pièces · 118 m²' },
        features: { match: true, score: 10, detail: '2/2 critères' },
      },
    }))
    expect(lignes.map((l) => l.cle)).toEqual(['budget', 'zone', 'type', 'pieces', 'surface', 'equipements'])
    expect(lignes[0]).toEqual({
      cle: 'budget', min: 900_000, max: 1_250_000, prix: 1_450_000, location: false, ok: false, ecart: '16% au-dessus du budget',
    })
    expect(lignes[1]).toEqual({ cle: 'zone', villes: ['Genève', 'Carouge'], cantons: ['GE'], ville: 'Genève', canton: 'GE', ok: true, ecart: null })
    expect(lignes[3]).toEqual({ cle: 'pieces', min: 4.5, max: null, pieces: 4.5, ok: true, ecart: null })
    expect(lignes[4]).toEqual({ cle: 'surface', min: 90, surface: 118, ok: true, ecart: null })
    expect(lignes[5]).toEqual({ cle: 'equipements', voulus: ['balcon', 'ascenseur'], presents: ['balcon', 'ascenseur'], ok: true, ecart: null })
    expect(premierEcart(lignes)).toBe('budget')
  })

  it('sans raison du moteur, ou sur un axe qu’il n’a pas évalué, AUCUN verdict — jamais un ✓ inventé', () => {
    const criteres = { budget_max: 1_000_000, zones: ['GE'] }
    const sansRaison = lignesCriteres(match('m', 70, champel, a, { criteres }))
    expect(sansRaison.map((l) => l.ok)).toEqual([null, null])
    const inactifs = lignesCriteres(match('m', 70, champel, a, {
      criteres,
      raisons: { budget: { match: false, score: 0, detail: '—' }, zone: { match: false, score: 0, detail: 'Aucun critère' } },
    }))
    expect(inactifs.map((l) => [l.ok, l.ecart])).toEqual([[null, null], [null, null]])
    expect(premierEcart(inactifs)).toBeNull()
  })

  it('type : le verdict du moteur, jamais son détail — il répète « Ce bien »', () => {
    const lignes = lignesCriteres(match('m', 60, champel, a, {
      criteres: { type: 'house', rooms_max: 3, surface_min: 160 },
      raisons: {
        type: { match: false, score: 0, detail: 'apartment ≠ house' },
        rooms: { match: false, score: 0, detail: '4,5 pièces · 118 m²' },
      },
    }))
    expect(lignes.map((l) => [l.cle, l.ok, l.ecart])).toEqual([
      ['type', false, null],
      ['pieces', false, null],
      ['surface', false, null],
    ])
    expect(lignes[1]).toMatchObject({ min: null, max: 3 })
  })

  it('pièces et surface : chaque ligne compare SA valeur à SES bornes, quel que soit l’axe fusionné du moteur', () => {
    // Les deux cas relevés en production le 17.09.2026.
    const quatrePieces = lignesCriteres(match('m', 70, bien('p', { pieces: 4, surface: 95 }), a, {
      criteres: { rooms_min: 2, rooms_max: 3, surface_min: 40 },
      raisons: { rooms: { match: true, score: 12, detail: '4 pièces · 95 m²' } },
    }))
    expect(quatrePieces.map((l) => [l.cle, l.ok])).toEqual([['pieces', false], ['surface', true]])
    const centVingtM2 = lignesCriteres(match('m', 70, bien('p', { pieces: 5, surface: 120 }), a, {
      criteres: { rooms_min: 3, rooms_max: 4, surface_min: 70 },
      raisons: { rooms: { match: false, score: 5, detail: '5 pièces · 120 m²' } },
    }))
    expect(centVingtM2.map((l) => [l.cle, l.ok])).toEqual([['pieces', false], ['surface', true]])
    const inconnues = lignesCriteres(match('m', 70, bien('p', { pieces: null, surface: null }), a, {
      criteres: { rooms_min: 3, surface_min: 70 },
    }))
    expect(inconnues.map((l) => l.ok)).toEqual([null, null])
  })

  it('un écart au détail vide n’écrit rien', () => {
    const lignes = lignesCriteres(match('m', 60, champel, a, {
      criteres: { budget_max: 1_000_000 },
      raisons: { budget: { match: false, score: 0, detail: '  ' } },
    }))
    expect(lignes[0]).toMatchObject({ ok: false, ecart: null })
  })

  it('villes ET cantons : un match au canton se lit (« Canton GE correspond »)', () => {
    const lancy = bien('p9', { ville: 'Lancy', canton: 'GE' })
    const lignes = lignesCriteres(match('m', 72, lancy, a, {
      criteres: { zones: ['Cologny', 'Vandoeuvres', ' ge'] },
      raisons: { zone: { match: true, score: 14, detail: 'Canton GE correspond' } },
    }))
    expect(lignes).toEqual([{ cle: 'zone', villes: ['Cologny', 'Vandoeuvres'], cantons: ['GE'], ville: 'Lancy', canton: 'GE', ok: true, ecart: null }])
  })

  it('des critères mal formés ne cassent pas la liste', () => {
    const criteres = { zones: 'Genève', features: [42, 'balcon'] } as unknown as FilMatch['criteres']
    expect(() => lignesCriteres(match('m', 60, champel, a, { criteres }))).not.toThrow()
    expect(lignesCriteres(match('m', 60, champel, a, { criteres })).map((l) => l.cle)).toEqual(['equipements'])
  })

  it('un équipement au slug vide n’est pas un critère', () => {
    const lignes = lignesCriteres(match('m', 60, champel, a, { criteres: { features: ['—', 'balcon'] } }))
    expect(lignes[0]).toMatchObject({ voulus: ['balcon'], presents: ['balcon'] })
  })

  it('cleEquipement : le slug du moteur, sans `custom:`', () => {
    expect(cleEquipement('Vue lac')).toBe('vue-lac')
    expect(cleEquipement('vue_lac')).toBe('vue-lac')
    expect(cleEquipement(' Cheminée ')).toBe('cheminee')
    expect(cleEquipement('custom:Terrasse')).toBe('terrasse')
  })
})

describe('lignesCriteres — les équipements comptent comme le MOTEUR', () => {
  // Cas relevés dans les écritures réelles : puces de la fiche (« vue lac »), WhatsApp (« Vue »),
  // formulaire du bien (« Garage double »), « Nouveau bien » (`vue_lac`, `clim`, `custom:…`).
  const CAS: [string[], string[]][] = [
    [['vue lac'], ['vue_lac']],
    [['garage'], ['Garage double']],
    [['Vue'], ['Vue lac']],
    [['clim'], ['Climatisation']],
    [['terrasse'], ['custom:Terrasse']],
    [['jardin'], ['garden']],
    [['balcon', 'piscine', 'cave'], ['Balcon', 'Piscine']],
    [['Garage double'], ['garage']],
    [['cheminée'], ['Cheminee']],
  ]
  it.each(CAS)('voulus %j, bien %j', (voulus, offerts) => {
    const moteur = calculateScoreV2(
      { price: 1_000_000, type: 'apartment', city: 'Genève', canton: 'GE', rooms: 4, surface_m2: 100, features: offerts },
      { features: voulus },
      DEFAULT_SCORING_CONFIG,
    )
    const [touches] = moteur.reasons.features.detail.split('/')
    const ligne = lignesCriteres(match('m', 70, bien('p', { equipements: offerts }), acheteur('c'), {
      criteres: { features: voulus },
      raisons: moteur.reasons,
    }))[0]
    expect(ligne).toMatchObject({ cle: 'equipements', ok: moteur.reasons.features.match })
    expect(ligne && ligne.cle === 'equipements' ? ligne.presents.length : -1).toBe(Number(touches))
  })
})

describe('compterHistorique', () => {
  it('compte ce qui a été proposé, et ce qui a intéressé (une visite planifiée compte)', () => {
    const h = compterHistorique([
      { contact_id: 'c7', status: 'interested' },
      { contact_id: 'c7', status: 'sent' },
      { contact_id: 'c7', status: 'suggested' },
      { contact_id: 'c1', status: 'ignored' },
      { contact_id: 'c1', status: 'visit_planned' },
      { contact_id: 'c1', status: 'rejected' },
    ])
    expect(h.get('c7')).toEqual({ proposes: 2, interesses: 1 })
    expect(h.get('c1')).toEqual({ proposes: 2, interesses: 1 })
  })
})

describe('initiales', () => {
  it('première lettre du prénom et du nom, en capitales', () => {
    expect(initiales('élodie', ' Schmidt')).toBe('ÉS')
  })
})

describe('construireSelections — les lignes « Marché » (§3.2)', () => {
  const s = (id: string, prenom: string, nom: string, nombre: number, meilleurScore: number): FilSelectionResume => ({
    acheteur: acheteur(id, { prenom, nom }), nombre, meilleurScore, vignettes: [],
  })
  const tous = [
    s('c9', 'Julie', 'Morand', 3, 97), s('c7', 'Emma', 'Schneider', 3, 100),
    s('c4', 'Luca', 'Bernasconi', 1, 97), s('c2', 'Théo', 'Baumgartner', 0, 99),
  ]

  it('par meilleur score, puis par nombre ; une sélection vide n’a pas de ligne', () => {
    expect(construireSelections(tous, SANS_FILTRE).map((x) => x.acheteur.id)).toEqual(['c7', 'c9', 'c4'])
  })

  it('un filtre sur un BIEN écarte toutes les sélections ; acheteur et texte s’appliquent', () => {
    expect(construireSelections(tous, { ...SANS_FILTRE, bienId: 'p1' })).toEqual([])
    expect(construireSelections(tous, { ...SANS_FILTRE, acheteurId: 'c9' }).map((x) => x.acheteur.id)).toEqual(['c9'])
    expect(construireSelections(tous, { ...SANS_FILTRE, texte: 'bernasconi' }).map((x) => x.acheteur.id)).toEqual(['c4'])
  })

  it('la recherche ignore les accents : « theo » trouve Théo', () => {
    const avecTheo = [...tous, s('c3', 'Théo', 'Favre', 2, 80)]
    expect(construireSelections(avecTheo, { ...SANS_FILTRE, texte: 'theo' }).map((x) => x.acheteur.id)).toEqual(['c3'])
  })

  it('à score et nombre égaux, le nom départage, dans l’ordre du français', () => {
    const egaux = [s('z', 'Zoé', 'Aubert', 2, 90), s('e', 'Emma', 'Schneider', 2, 90), s('l', 'Élodie', 'Roux', 2, 90)]
    // Par unités de code, « É » passerait après « Z » : c'est la comparaison 'fr' qui le range avec les E.
    expect(construireSelections(egaux, SANS_FILTRE).map((x) => x.acheteur.id)).toEqual(['l', 'e', 'z'])
  })
})

describe('cleSelection', () => {
  it('fait l’aller et le retour, et ne confond jamais un id de match', () => {
    expect(contactDeSelection(cleSelection('c9'))).toBe('c9')
    expect(contactDeSelection('m3')).toBeNull()
  })
})

describe('precoches — cochés d’office (§5)', () => {
  const b = bien('ml', { prix: 1_500_000, ville: 'Genève', canton: 'GE', type: 'apartment', pieces: 5, surface: 124 })
  const criteres = { budget_min: 1_300_000, budget_max: 1_600_000, rooms_min: 4 }
  const raisonsOk = { budget: { match: true, score: 32, detail: 'Dans le budget' } }

  it('retient les biens dont chaque critère est tenu, dans l’ordre reçu, 5 au plus', () => {
    const matchs = Array.from({ length: 7 }, (_, i) => match(`m${i}`, 90 - i, b, acheteur('c'), { criteres, raisons: raisonsOk }))
    expect(precoches(matchs)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4'])
  })

  it('un écart, un verdict absent ou aucun critère : pas coché', () => {
    const ecart = match('e', 90, b, acheteur('c'), { criteres, raisons: { budget: { match: false, score: 0, detail: '12% au-dessus du budget' } } })
    const sansVerdict = match('n', 90, b, acheteur('c'), { criteres })
    const sansCritere = match('v', 90, b, acheteur('c'))
    expect(precoches([ecart, sansVerdict, sansCritere])).toEqual([])
  })

  it('l’ordre reçu fait foi, même non trié par score', () => {
    const matchs = [70, 95, 80].map((score) => match(`m${score}`, score, b, acheteur('c'), { criteres, raisons: raisonsOk }))
    expect(precoches(matchs)).toEqual(['m70', 'm95', 'm80'])
  })

  it('un ✓ du moteur à 7 % au-dessus du budget n’est pas un fait : pas coché', () => {
    // Le moteur dit ✓ dès 0,5 de fraction tenue : 7 % au-dessus d'un plafond toléré à 15 % en vaut 0,53.
    const cher = bien('cher', { prix: 1_712_000, pieces: 5 })
    const m = match('m', 88, cher, acheteur('c'), {
      criteres, raisons: { budget: { match: true, score: 17, detail: '7% au-dessus du budget' } },
    })
    expect(lignesCriteres(m)[0]).toMatchObject({ cle: 'budget', ok: true })
    expect(precoches([m])).toEqual([])
  })

  it('un prix inconnu, ou sous le budget minimum, n’est pas coché non plus', () => {
    const sansPrix = match('p', 88, bien('x', { prix: null, pieces: 5 }), acheteur('c'), { criteres, raisons: raisonsOk })
    const sous = match('s', 88, bien('y', { prix: 1_100_000, pieces: 5 }), acheteur('c'), {
      criteres, raisons: { budget: { match: true, score: 28, detail: 'Sous le budget minimum' } },
    })
    expect(precoches([sansPrix, sous])).toEqual([])
  })

  it('un équipement sur deux, même sous un ✓ du moteur : pas coché', () => {
    const m = match('m', 88, bien('eq', { prix: 1_500_000, pieces: 5, equipements: ['Balcon'] }), acheteur('c'), {
      criteres: { ...criteres, features: ['balcon', 'piscine'] },
      raisons: { ...raisonsOk, features: { match: true, score: 5, detail: '1/2 critères' } },
    })
    expect(lignesCriteres(m).find((l) => l.cle === 'equipements')).toMatchObject({ ok: true, presents: ['balcon'] })
    expect(precoches([m])).toEqual([])
  })
})

describe('criteresNonTenus — ce qui reste à vérifier, même règle que le pré-cochage', () => {
  // Le bien Florissant du banc pour Julie (m8) : le moteur dit ✓ sur les équipements à 2 sur 3.
  const julie = acheteur('c9', { prenom: 'Julie', nom: 'Morand' })
  const florissant = bien('ml-fil-1', {
    titre: 'Appartement 5 pièces · Florissant', prix: 1_520_000, pieces: 5, surface: 124, equipements: ['Balcon', 'Ascenseur'],
  })
  const criteres: NonNullable<FilMatch['criteres']> = {
    transaction_type: 'buy', type: 'apartment', zones: ['Genève', 'Champel', 'GE'], budget_min: 1_300_000, budget_max: 1_600_000,
    rooms_min: 4, surface_min: 100, features: ['balcon', 'ascenseur', 'terrasse'],
  }
  const raisons: NonNullable<FilMatch['raisons']> = {
    budget: { match: true, score: 32, detail: 'Dans le budget' },
    zone: { match: true, score: 24, detail: 'Genève correspond' },
    type: { match: true, score: 12, detail: 'apartment' },
    rooms: { match: true, score: 22, detail: '5 pièces · 124 m²' },
    features: { match: true, score: 7, detail: '2/3 critères' },
  }

  it('équipements 2 sur 3 sous un ✓ : « Équipements » à vérifier, et pas coché d’office', () => {
    const m = match('m8', 97, florissant, julie, { criteres, raisons })
    expect(criteresNonTenus(lignesCriteres(m))).toEqual(['equipements'])
    expect(precoches([m])).toEqual([])
  })

  it('tout tenu en fait : rien à vérifier, et coché d’office', () => {
    const complet = bien('ml-fil-2', { prix: 1_590_000, pieces: 4.5, surface: 132, equipements: ['Terrasse', 'Ascenseur', 'Balcon'] })
    const m = match('m9', 100, complet, julie, { criteres, raisons: { ...raisons, features: { match: true, score: 10, detail: '3/3 critères' } } })
    expect(criteresNonTenus(lignesCriteres(m))).toEqual([])
    expect(precoches([m])).toEqual(['m9'])
  })

  it('un écart, un verdict absent, un budget toléré par le moteur : chacun à vérifier, dans l’ordre des lignes', () => {
    const cher = bien('x', { prix: 1_712_000, pieces: 5, surface: 124, equipements: ['Balcon', 'Ascenseur', 'Terrasse'] })
    const m = match('m', 80, cher, julie, {
      criteres,
      raisons: {
        budget: { match: true, score: 17, detail: '7% au-dessus du budget' },
        type: { match: false, score: 0, detail: 'house' },
        rooms: { match: true, score: 22, detail: '5 pièces · 124 m²' },
        features: { match: true, score: 10, detail: '3/3 critères' },
      },
    })
    expect(criteresNonTenus(lignesCriteres(m))).toEqual(['budget', 'zone', 'type'])
  })
})
