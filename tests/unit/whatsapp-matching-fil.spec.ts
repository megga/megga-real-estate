/**
 * Les copies du copilote WhatsApp (lot D2), confrontées aux règles du fil.
 *
 * POURQUOI. `supabase/functions/_shared/whatsapp-matching.ts` tourne sous Deno et ne peut pas importer `src/` : il
 * RECOPIE neuf règles du CRM — les statuts « compatibles », les motifs de refus, les seuils des signaux (en jours),
 * la FORME du bien elle-même (`versBien`/`versBienMarche`, champ par champ), l'état d'un acheteur, l'explication du
 * score, le signal « pourquoi maintenant », l'ordre « à proposer » et l'ordre des acheteurs compatibles d'un bien —
 * rien de plus n'est confronté ici. Recopiées, elles dérivent en silence : le copilote dirait « intéressée » là où
 * la fiche dit « revenu », un prix de mandat à `null` là où le fil en affiche un, ou classerait un bien avant un
 * autre alors que le fil ferait l'inverse. Cette spec rougit au premier écart — la CHARGE UTILE comprise, pas
 * seulement le genre du résultat.
 * Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md, §3 (« une règle, une source »).
 */
import { describe, it, expect, vi } from 'vitest'
import type { SearchCriteria } from '@/types/contact'
import {
  STATUTS_COMPATIBLES as COMPATIBLES_FIL, etatCompatible, trierCompatibles, versCompatible, type LigneCompatible,
} from '@/components/matching-fil/filQuiPour'
import { MOTIFS_REFUS as MOTIFS_FIL, signalPrix } from '@/components/matching-fil/filBoucle'
import { aUnSignal, JOURS_BAISSE as BAISSE_FIL, JOURS_MANDAT as MANDAT_FIL, JOURS_NOUVEAU as NOUVEAU_FIL, signalBien } from '@/components/matching-fil/filSignaux'
import { construireFil, lignesCriteres, type FilBien, type FilMatch, type RaisonsMoteur } from '@/components/matching-fil/filModele'
import { fmtCHF } from '../../supabase/functions/_shared/morning-brief'
import * as wa from '../../supabase/functions/_shared/whatsapp-matching'
import { versBien, versBienMarche, type LigneAnnonce, type LigneBien } from '@/hooks/useMatchingFil'
// La forme du fil vient des fonctions de PRODUCTION ci-dessus (jamais d'une troisième copie écrite à la main) :
// quatre mocks suffisent à charger `useMatchingFil.ts` sans toucher Supabase ni React Query — mêmes noms que
// tests/unit/matching-whatsapp-sql.spec.ts et matching-fil-gestes.spec.ts, qui l'importent déjà sous Vitest.
vi.mock('@/lib/supabase', () => ({ supabase: {} }))
vi.mock('@/lib/intercom-milestones', () => ({ markIntercomMilestone: () => undefined }))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_MATCH_SENT: 'first_match_sent' } }))
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({}) }))

const MAINTENANT = Date.parse('2026-09-24T08:00:00Z')
const ilYA = (jours: number) => new Date(MAINTENANT - jours * 86_400_000).toISOString()
const dans = (jours: number) => new Date(MAINTENANT + jours * 86_400_000).toISOString()

describe('les listes et les seuils recopiés', () => {
  it('statuts compatibles, motifs de refus, seuils des signaux : ceux du fil', () => {
    expect([...wa.STATUTS_COMPATIBLES]).toEqual([...COMPATIBLES_FIL])
    expect([...wa.MOTIFS_REFUS]).toEqual([...MOTIFS_FIL])
    expect([wa.JOURS_NOUVEAU, wa.JOURS_BAISSE, wa.JOURS_MANDAT]).toEqual([NOUVEAU_FIL, BAISSE_FIL, MANDAT_FIL])
  })
})

describe('l’état d’un acheteur : celui des fiches (`etatCompatible`), charge utile comprise', () => {
  const ligne = (o: Partial<LigneCompatible>): LigneCompatible => ({
    id: 'm', contact_id: 'c', score: 80, status: 'suggested', snoozed_until: null, sent_at: null, response_at: null,
    reaction_motif: null, reaction_note: null, prix_propose: null, ...o,
  })
  const CAS: LigneCompatible[] = [
    ligne({}),
    ligne({ snoozed_until: dans(2) }),
    ligne({ snoozed_until: ilYA(2) }),
    ligne({ reaction_motif: 'prix', prix_propose: 1_700_000 }),
    ligne({ reaction_motif: 'quartier', prix_propose: 1_700_000 }),
    ligne({ status: 'sent', sent_at: ilYA(3) }),
    ligne({ status: 'sent', sent_at: null, snoozed_until: dans(4) }),
    ligne({ status: 'interested' }),
    ligne({ status: 'visit_planned' }),
    ligne({ status: 'rejected', reaction_motif: 'surface' }),
    ligne({ status: 'rejected', reaction_motif: 'recherche_ajustee' }),
    // Un revenu (refusé pour le prix, revenu) REPORTÉ : le report doit passer avant, comme dans `etatCompatible`
    // (il teste `reporteJusquau` en premier). Sans ce cas, une préséance inversée dans le copilote — un revenu
    // affiché malgré son report — passerait inaperçue.
    ligne({ snoozed_until: dans(2), reaction_motif: 'prix', prix_propose: 1_700_000 }),
  ]

  it.each(CAS.map((c, i) => [i, c] as const))('cas %i', (_i, c) => {
    const fil = etatCompatible(versCompatible(c, { first_name: 'A', last_name: 'B' })!, MAINTENANT)
    // L'objet ENTIER, pas seulement son `code` : une date ou un prix qui se perdrait en route (un `null` au lieu
    // d'une vraie date, un motif brut non traduit) passait inaperçu tant que seul le genre était comparé.
    const attendu = (() => {
      switch (fil.cle) {
        case 'reporte': return { code: 'reporte', jusqua: wa.dateSuisse(fil.date) }
        case 'aProposer': return { code: 'a_proposer' }
        case 'revenu': return { code: 'revenu', refuse_a: fmtCHF(fil.prix) }
        case 'propose': return { code: 'propose', le: wa.dateSuisse(fil.date) }
        case 'proposeSansDate': return { code: 'propose', le: null }
        case 'interesse': return { code: 'interesse' }
        case 'visite': return { code: 'visite' }
        case 'refuse': return { code: 'refuse', motif: fil.motif.replace('fil.motifs.', '') }
        case 'refuseSansMotif': return { code: 'refuse', motif: null }
      }
    })()
    expect(wa.etatMatch(c, MAINTENANT)).toEqual(attendu)
  })
})

/**
 * Un même bien, dans les deux formes : celle du fil — `versBien` / `versBienMarche`, les fonctions de PRODUCTION
 * de `useMatchingFil.ts`, jamais une troisième copie écrite à la main — et celle du copilote.
 */
function deuxFormes(genre: 'annonce' | 'mandat', o: Partial<wa.LigneAnnonce & wa.LigneMandat> = {}): { fil: FilBien; copie: wa.BienWa } {
  // Typé `LigneBien & LigneAnnonce` (les DEUX formes de production, importées ci-dessus) : à elles deux, elles
  // couvrent tous les champs que lisent `versBien`, `versBienMarche` ET les fonctions du copilote (`wa.LigneMandat`
  // n'ajoute rien que `LigneAnnonce` n'ait déjà — `status` — et `wa.LigneAnnonce` est un sous-ensemble strict de
  // `LigneAnnonce`). Plus besoin de `as never` pour faire taire le compilateur sur un type qu'il ne pouvait pas
  // nommer avant que `LigneBien` soit exporté.
  const brut: LigneBien & LigneAnnonce = {
    id: 'b1', title: 'Bien', type: 'apartment', transaction_type: 'buy', price: 1_500_000, current_price: null, rooms: 4,
    surface_m2: 120, bedrooms: 3, address: 'Rue 1', city: 'Genève', canton: 'GE', features: ['Terrasse', 'Ascenseur'],
    condition: null, year_built: 2019, year_renovated: null, off_market: false, mandate_signed_at: null, published_at: ilYA(40),
    first_seen_at: ilYA(60), price_at_first_seen: 1_500_000, price_reduced_at: null, status: 'active',
    photos: null, photos_cf: null, source_portal: null, source_id: null, source_url: null,
    ...o,
  }
  const fil = genre === 'annonce' ? versBienMarche(brut) : versBien(brut)
  const copie = genre === 'annonce' ? wa.bienDAnnonce(brut) : wa.bienDeMandat(brut)
  return { fil, copie }
}

describe('la forme du bien, champ par champ : `copie` (le copilote) contre `fil` (la production)', () => {
  // ⚠ Compare RÉELLEMENT le copilote au fil (pas `versBienMarche` à elle-même, comme l'ancien bloc ici) : sans ce
  // bloc, un prix de mandat renvoyé à `null` par `bienDeMandat` ne se voyait plus — aucun autre bloc ne compare
  // `prix` sur TOUS les cas.
  const CHAMPS = ['id', 'prix', 'location', 'type', 'pieces', 'surface', 'chambres', 'ville', 'canton', 'adresse',
    'equipements', 'offMarket', 'vuLe', 'prixInitial', 'baisseLe', 'mandatLe'] as const
  // `titre` EXCLU EXPRÈS, seule divergence VOULUE de la forme : le copilote nomme toujours le bien (repli sur
  // l'adresse, la ville, puis « Bien »/« Annonce »), là où `versBien` rend `''` et `versBienMarche` une référence —
  // ne pas l'ajouter à CHAMPS pour « corriger » la copie.
  const garder = (b: object) => Object.fromEntries(CHAMPS.map((k) => [k, (b as Record<string, unknown>)[k] ?? null]))
  const CAS: [string, 'annonce' | 'mandat', Partial<wa.LigneAnnonce & wa.LigneMandat>][] = [
    ['mandat par défaut', 'mandat', {}],
    ['mandat en location, signé après publication, équipements en objet', 'mandat', { transaction_type: 'rent', price: 3_200, mandate_signed_at: ilYA(2), features: { piscine: true, jardin: false } }],
    ['annonce par défaut', 'annonce', {}],
    ['annonce au prix courant, en baisse', 'annonce', { current_price: 1_400_000, price_reduced_at: ilYA(3) }],
    ['annonce en location', 'annonce', { transaction_type: 'rent', price: 3_200 }],
  ]
  it.each(CAS)('%s', (_n, genre, o) => {
    const { fil, copie } = deuxFormes(genre, o)
    expect(garder(copie)).toEqual(garder(fil))
  })
})

const filMatch = (bien: FilBien, criteres: SearchCriteria | null, raisons: RaisonsMoteur | null): FilMatch => ({
  id: 'm', score: 80, raisons, criteres, creeLe: null, reporteJusquau: null, bien,
  acheteur: { id: 'c', prenom: 'A', nom: 'B', telephone: null, email: null, kyc: 'none' },
})

describe('le score expliqué : celui du fil (`lignesCriteres`)', () => {
  const TOUT: SearchCriteria = {
    budget_max: 1_400_000, zones: ['Genève', 'GE'], type: 'apartment', rooms_min: 3, rooms_max: 4, bedrooms_min: 4,
    surface_min: 100, condition_min: 'new', features: ['terrasse', 'piscine'], off_market_only: true,
  }
  const RAISONS: RaisonsMoteur = {
    budget: { match: false, score: 20, detail: '7 % au-dessus du budget' },
    zone: { match: true, score: 100, detail: 'Genève' },
    type: { match: true, score: 100, detail: 'Appartement' },
    features: { match: false, score: 50, detail: '1 sur 2' },
  }
  const CAS: [string, 'annonce' | 'mandat', Partial<wa.LigneAnnonce & wa.LigneMandat>, SearchCriteria | null, RaisonsMoteur | null][] = [
    ['annonce, tous les critères', 'annonce', {}, TOUT, RAISONS],
    ['annonce, sans raison du moteur', 'annonce', {}, TOUT, null],
    // Aux bornes : pièces, surface et chambres ÉGALES aux minimums — une comparaison stricte y rougirait.
    ['annonce aux bornes', 'annonce', { rooms: 3, surface_m2: 100, bedrooms: 4 }, TOUT, RAISONS],
    ['annonce rénovée, surface et chambres inconnues', 'annonce', { year_built: 1970, year_renovated: 2020, surface_m2: null, bedrooms: 0 }, TOUT, RAISONS],
    ['mandat saisi rénové, off-market', 'mandat', { condition: 'renovated', off_market: true, features: { piscine: true } }, { ...TOUT, condition_min: 'good' }, { features: { match: false, score: 0, detail: '—' } }],
    ['location, budget minimum seul', 'annonce', { transaction_type: 'rent', price: 3_200 }, { budget_min: 2_500 }, { budget: { match: true, score: 100, detail: 'Dans le budget' } }],
    ['aucune recherche', 'annonce', {}, null, RAISONS],
  ]

  it.each(CAS)('%s', (_nom, genre, o, criteres, raisons) => {
    const { fil, copie } = deuxFormes(genre, o)
    const attendu = lignesCriteres(filMatch(fil, criteres, raisons), MAINTENANT).map((l) => [l.cle, l.ok, l.ecart])
    const obtenu = wa.expliquer(criteres as wa.Criteres | null, raisons, copie, MAINTENANT).map((l) => [l.critere, l.tenu, l.ecart])
    expect(obtenu).toEqual(attendu)
  })
})

describe('le score expliqué, suite : zone et type en écart, faits aux bornes', () => {
  const TOUT: SearchCriteria = {
    budget_max: 1_400_000, zones: ['Genève', 'GE'], type: 'apartment', rooms_min: 3, rooms_max: 4, bedrooms_min: 4,
    surface_min: 100, condition_min: 'new', features: ['terrasse', 'piscine'], off_market_only: true,
  }
  // ⚠ Zone ET type en écart (contrairement au bloc ci-dessus, où ils sont tenus) : sans ce cas, un type qui
  // écrirait son écart comme le budget (au lieu de le taire) ne rougirait jamais.
  const EN_ECART: RaisonsMoteur = {
    budget: { match: false, score: 20, detail: '7 % au-dessus du budget' },
    zone: { match: false, score: 0, detail: 'Hors zone' },
    type: { match: false, score: 0, detail: 'Maison' },
    features: { match: false, score: 50, detail: '1 sur 2' },
  }
  const CAS: [string, 'annonce' | 'mandat', Partial<wa.LigneAnnonce & wa.LigneMandat>][] = [
    ['trop de pièces, trop petit', 'annonce', { rooms: 5, surface_m2: 80 }],
    ['pas assez de pièces', 'annonce', { rooms: 2 }],
    ['pièces inconnues', 'annonce', { rooms: null }],
    ['neuf, pile au minimum', 'annonce', { year_built: 2024 }],
  ]
  it.each(CAS)('%s', (_nom, genre, o) => {
    const { fil, copie } = deuxFormes(genre, o)
    const attendu = lignesCriteres(filMatch(fil, TOUT, EN_ECART), MAINTENANT).map((l) => [l.cle, l.ok, l.ecart])
    const obtenu = wa.expliquer(TOUT as wa.Criteres, EN_ECART, copie, MAINTENANT).map((l) => [l.critere, l.tenu, l.ecart])
    expect(obtenu).toEqual(attendu)
  })
})

describe('le score expliqué, garde-fous : critères inactifs ou hors minimum', () => {
  it('« Aucun critère », « à rénover » refusé comme minimum, 0 chambre, zones vides, équipement « — »', () => {
    const { fil, copie } = deuxFormes('annonce')
    const c = { budget_max: 1_400_000, zones: ['', '  '], features: ['—'], bedrooms_min: 0, condition_min: 'to_renovate' } as unknown as SearchCriteria
    const r: RaisonsMoteur = { budget: { match: false, score: 0, detail: 'Aucun critère' } }
    const attendu = lignesCriteres(filMatch(fil, c, r), MAINTENANT).map((l) => [l.cle, l.ok, l.ecart])
    const obtenu = wa.expliquer(c as wa.Criteres, r, copie, MAINTENANT).map((l) => [l.critere, l.tenu, l.ecart])
    expect(obtenu).toEqual(attendu)
  })
  it('un type vide (`type: \'\'`) n’est pas un critère', () => {
    const { fil, copie } = deuxFormes('annonce')
    const c = { type: '' } as unknown as SearchCriteria
    const attendu = lignesCriteres(filMatch(fil, c, null), MAINTENANT).map((l) => [l.cle, l.ok, l.ecart])
    const obtenu = wa.expliquer(c as wa.Criteres, null, copie, MAINTENANT).map((l) => [l.critere, l.tenu, l.ecart])
    expect(obtenu).toEqual(attendu)
  })
})

describe('le signal : celui du fil (`signalPrix`, puis `signalBien`), montant et date compris, aux seuils', () => {
  const versFil = (m: FilMatch) => {
    const p = signalPrix(m)
    if (p) return { genre: p.depuis === 'refus' ? 'baisse_depuis_refus' : 'baisse_depuis_proposition', montant: p.baisse }
    const b = signalBien(m.bien, MAINTENANT)
    if (!b) return null
    return b.genre === 'mandat' ? { genre: 'nouveau_mandat', le: b.le } : b
  }
  const CAS: [string, 'annonce' | 'mandat', Partial<wa.LigneAnnonce & wa.LigneMandat>, Partial<wa.LigneMatch>][] = [
    ['proposé, prix baissé depuis', 'annonce', { price: 1_400_000 }, { status: 'sent', prix_propose: 1_500_000 }],
    ['refusé pour le prix, revenu', 'annonce', { price: 1_400_000 }, { reaction_motif: 'prix', prix_propose: 1_550_000 }],
    ['revenu pour un autre motif', 'annonce', { price: 1_400_000 }, { reaction_motif: 'quartier', prix_propose: 1_550_000 }],
    ['proposé, prix inchangé', 'annonce', { price: 1_500_000 }, { status: 'sent', prix_propose: 1_500_000 }],
    ['prix courant sous le prix affiché', 'annonce', { price: 1_500_000, current_price: 1_400_000 }, { status: 'sent', prix_propose: 1_500_000 }],
    ['baisse il y a 10 jours (entre 3 et 14)', 'annonce', { price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(10) }, {}],
    ['baisse il y a 15 jours', 'annonce', { price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(15) }, {}],
    ['baisse pile à 14 jours', 'annonce', { price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(14) }, {}],
    ['baisse datée dans le futur', 'annonce', { price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: dans(1) }, {}],
    ['annonce vue il y a 4 jours', 'annonce', { first_seen_at: ilYA(4) }, {}],
    ['annonce vue pile à 3 jours', 'annonce', { first_seen_at: ilYA(3) }, {}],
    ['mandat mis en service il y a 5 jours (entre 3 et 7)', 'mandat', { published_at: ilYA(5) }, {}],
    ['mandat mis en service il y a 8 jours', 'mandat', { published_at: ilYA(8) }, {}],
    // Les deux fixtures « signé avant/après sa publication » : `plusRecente` prend la plus récente des deux
    // dates. Seule la seconde (signé longtemps AVANT, publié récemment) attraperait un `mandate_signed_at ??
    // published_at` écrit à la place — la première (signé APRÈS) rend le même résultat dans les deux versions.
    ['mandat signé il y a 5 jours, publié il y a 40', 'mandat', { mandate_signed_at: ilYA(5), published_at: ilYA(40) }, {}],
    ['mandat signé il y a 40 jours, publié il y a 5', 'mandat', { mandate_signed_at: ilYA(40), published_at: ilYA(5) }, {}],
    // Préséance : le signal du MATCH (prix_propose) d'abord, même quand le BIEN qualifie aussi pour le sien —
    // sans ces trois cas, une inversion de l'ordre des vérifications (le bien avant le prix) ne rougissait jamais,
    // les deux familles de fixtures ci-dessus ne les combinant jamais.
    ['proposée, prix baissé depuis, ET annonce en baisse récente', 'annonce', { price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(3) }, { status: 'sent', prix_propose: 1_500_000 }],
    ['mandat neuf proposé, prix baissé depuis', 'mandat', { price: 1_400_000, published_at: ilYA(2) }, { status: 'sent', prix_propose: 1_500_000 }],
    // Un « intéressé » n'affiche PAS de baisse depuis la proposition (règle du fil : `signalPrix` ne la rend que
    // pour `statut === 'sent'`) — un `status !== 'suggested'` élargi au lieu de `=== 'sent'` la ferait apparaître.
    ['intéressé, prix baissé depuis la proposition', 'annonce', { price: 1_400_000 }, { status: 'interested', prix_propose: 1_500_000 }],
  ]
  it.each(CAS)('%s', (_nom, genre, o, mo) => {
    const { fil, copie } = deuxFormes(genre, o)
    const ligne: wa.LigneMatch = {
      id: 'm', contact_id: 'c', status: 'suggested', score: 80, reasons: null, client_search_id: null, property_id: null,
      market_listing_id: null, snoozed_until: null, sent_at: null, response_at: null, reaction_motif: null, reaction_note: null,
      prix_propose: null, created_at: null, ...mo,
    }
    // Le suivi vient de `versCompatible`, jamais construit à la main : c'est la même règle qui décide si un
    // match « jamais proposé » a un `suivi` du tout (`jamaisPropose` dans le fil comme dans le copilote).
    const compat = versCompatible({ ...ligne, score: 80 }, { first_name: 'A', last_name: 'B' })!
    const m: FilMatch = { ...filMatch(fil, null, null), suivi: compat.suivi }
    expect(wa.signalMatch(ligne, copie, MAINTENANT)).toEqual(versFil(m))
  })
})

describe('l’ordre « à proposer » : celui du fil (`avant`, via `construireFil`)', () => {
  // `avant` n'est pas exporté (une const locale de `construireFil`, filModele.ts) : on lit l'ordre par sa
  // sortie publique — un groupe par bien, triés par `avant(matchs[0], …)`. Un seul match par bien ici, donc
  // l'ordre des groupes EST l'ordre à plat que `avant` produirait sur les matchs seuls.
  const filDe = (id: string, score: number, creeLe: string | null, bien: FilBien): FilMatch => ({
    id, score, raisons: null, criteres: null, creeLe, reporteJusquau: null, bien,
    acheteur: { id: 'c', prenom: 'A', nom: 'B', telephone: null, email: null, kyc: 'none' },
  })
  const entreeDe = (id: string, score: number, createdAt: string | null, bien: wa.BienWa): wa.EntreeMatch => ({
    match: {
      id, contact_id: 'c', status: 'suggested', score, reasons: null, client_search_id: null, property_id: bien.id,
      market_listing_id: null, snoozed_until: null, sent_at: null, response_at: null, reaction_motif: null,
      reaction_note: null, prix_propose: null, created_at: createdAt,
    },
    bien, criteres: null,
  })
  // Mandat ACTIF : une occasion dans les deux mondes — la divergence sur `occasion` reste À CONFIRMER par
  // Julien (décision 12, lot D1 ; docs/superpowers/feuille-de-route.md), pas testée ici. `publieIlYA` porte
  // le signal « nouveau mandat » ou son absence.
  const mandat = (id: string, publieIlYA: number) => deuxFormes('mandat', { id, published_at: ilYA(publieIlYA) })

  it('le signal passe devant la récence, le score devant le signal ; l’id départage est celui du MATCH', () => {
    // [idMatch, idBien, score, créé il y a, publié il y a] — ordre d'ENTRÉE délibérément différent de l'ordre
    // ATTENDU (voir plus bas) : supprimer le tri de la copie ferait alors rougir ce test, pas le laisser passer.
    const T: [string, string, number, number, number][] = [
      ['m-1', 'p-z', 80, 50, 2], // signal, ANCIEN — face à m-2, plus récent mais sans signal : le signal doit gagner
      ['m-2', 'p-y', 80, 2, 400], // sans signal, récent
      ['m-3', 'p-x', 90, 60, 400], // sans signal, meilleur score — doit passer devant m-1/m-2 malgré son âge
      ['m-4', 'p-w', 70, 1, 2], // signal, score PLUS BAS — ne doit pas doubler m-1/m-2 malgré son signal
      ['m-6', 'p-a', 60, 5, 400], // égalité totale : m-5 avant m-6 (id du MATCH), alors que p-a < p-b (id du BIEN)
      ['m-5', 'p-b', 60, 5, 400],
      // Score ET signal ÉGAUX (aucun des deux, ici), SEUL `created_at` départage — sans cette paire isolée, le
      // départage par récence n'est jamais la clause qui décide (les deux paires ci-dessus le court-circuitent
      // avant de l'atteindre) et son inversion passerait inaperçue.
      ['m-7', 'p-c1', 55, 3, 400], // sans signal, créé il y a 3 jours (plus récent)
      ['m-8', 'p-c2', 55, 20, 400], // sans signal, créé il y a 20 jours (plus ancien)
    ]
    const biens = T.map(([, idBien, , , publie]) => mandat(idBien, publie))
    const ordreFil = construireFil(
      T.map(([idm, , s, cree], i) => filDe(idm, s, ilYA(cree), biens[i]!.fil)),
      { bienId: null, acheteurId: null, texte: '' }, MAINTENANT, (m) => aUnSignal(m, MAINTENANT),
    ).groupes.map((g) => g.bien.id)
    const ordreCopie = wa.vueGetMatches(
      T.map(([idm, , s, cree], i) => entreeDe(idm, s, ilYA(cree), biens[i]!.copie)), MAINTENANT, false,
    ).biens.map((b) => b.id)
    expect(ordreCopie).toEqual(ordreFil)
    expect(ordreFil).toEqual(['p-x', 'p-z', 'p-y', 'p-w', 'p-b', 'p-a', 'p-c1', 'p-c2'])
  })
})

describe('l’ordre « à proposer » : un match sans `created_at` passe en dernier de son rang', () => {
  // `created_at` est nullable côté base, et le copilote l'écrit tel quel (`LigneMatch.created_at: string | null`) :
  // `temps(null)` vaut 0 des deux côtés (filModele.ts comme whatsapp-matching.ts), donc une entrée sans date
  // lisible se range après une entrée datée, même ancienne — jamais en tête par accident.
  it('created_at nul', () => {
    const b1 = deuxFormes('mandat', { id: 'p-1', published_at: ilYA(400) })
    const b2 = deuxFormes('mandat', { id: 'p-2', published_at: ilYA(400) })
    const fil = (id: string, creeLe: string | null, bien: FilBien): FilMatch => ({
      id, score: 60, raisons: null, criteres: null, creeLe, reporteJusquau: null, bien,
      acheteur: { id: 'c', prenom: 'A', nom: 'B', telephone: null, email: null, kyc: 'none' },
    })
    const entree = (id: string, created_at: string | null, bien: wa.BienWa): wa.EntreeMatch => ({
      match: {
        id, contact_id: 'c', status: 'suggested', score: 60, reasons: null, client_search_id: null, property_id: bien.id,
        market_listing_id: null, snoozed_until: null, sent_at: null, response_at: null, reaction_motif: null,
        reaction_note: null, prix_propose: null, created_at,
      },
      bien, criteres: null,
    })
    const ordreFil = construireFil([fil('m-1', null, b1.fil), fil('m-2', ilYA(30), b2.fil)], { bienId: null, acheteurId: null, texte: '' }, MAINTENANT, (m) => aUnSignal(m, MAINTENANT))
      .groupes.map((g) => g.bien.id)
    const ordreCopie = wa.vueGetMatches([entree('m-1', null, b1.copie), entree('m-2', ilYA(30), b2.copie)], MAINTENANT, false).biens.map((b) => b.id)
    expect(ordreCopie).toEqual(ordreFil)
    expect(ordreFil).toEqual(['p-2', 'p-1'])
  })
})

describe('ce qui entre dans « à proposer » : les revenus, jamais les reportés', () => {
  it('un revenu y est (son signal le fait passer devant), un reporté n’y est pas', () => {
    // `construireFil` range un match reporté À PART (`reportes`, jamais dans `groupes`) ; un revenu, lui, reste
    // « à proposer » — conception §5.1, « revenus compris ». Sans ce cas, exclure les revenus ou laisser entrer
    // les reportés passerait tous deux inaperçus (aucun autre bloc ne construit les DEUX dans la même liste).
    const fiche = (idm: string, idb: string, o: Partial<LigneCompatible>) => {
      const l: LigneCompatible = {
        id: idm, contact_id: 'c', score: 70, status: 'suggested', snoozed_until: null, sent_at: null, response_at: null,
        reaction_motif: null, reaction_note: null, prix_propose: null, ...o,
      }
      const b = deuxFormes('mandat', { id: idb, published_at: ilYA(400), price: 1_400_000 })
      const compat = versCompatible(l, { first_name: 'A', last_name: 'B' })!
      const fil: FilMatch = {
        id: idm, score: 70, raisons: null, criteres: null, creeLe: ilYA(5), reporteJusquau: compat.reporteJusquau, suivi: compat.suivi,
        bien: b.fil, acheteur: { id: 'c', prenom: 'A', nom: 'B', telephone: null, email: null, kyc: 'none' },
      }
      const entree: wa.EntreeMatch = {
        match: {
          id: idm, contact_id: 'c', status: 'suggested', score: 70, reasons: null, client_search_id: null, property_id: idb,
          market_listing_id: null, snoozed_until: l.snoozed_until, sent_at: null, response_at: null, reaction_motif: l.reaction_motif,
          reaction_note: null, prix_propose: l.prix_propose, created_at: ilYA(5),
        },
        bien: b.copie, criteres: null,
      }
      return { fil, entree }
    }
    const X = [
      fiche('m-o', 'p-o', {}),
      fiche('m-s', 'p-s', { snoozed_until: dans(2) }),
      fiche('m-r', 'p-r', { reaction_motif: 'prix', prix_propose: 1_500_000 }),
    ]
    const ordreFil = construireFil(X.map((x) => x.fil), { bienId: null, acheteurId: null, texte: '' }, MAINTENANT, (m) => aUnSignal(m, MAINTENANT))
      .groupes.map((g) => g.bien.id)
    const ordreCopie = wa.vueGetMatches(X.map((x) => x.entree), MAINTENANT, false).biens.map((b) => b.id)
    expect(ordreCopie).toEqual(ordreFil)
    expect(ordreFil).toEqual(['p-r', 'p-o'])
  })
})

describe('l’ordre des acheteurs compatibles : celui du fil (`trierCompatibles`, filQuiPour.ts)', () => {
  it('à score égal, l’id du MATCH départage — ni celui du contact, ni l’ordre d’entrée ; score texte et nul', () => {
    // Ids de match et de contact volontairement DANS DES ORDRES OPPOSÉS (m-2/c-1 puis m-1/c-2, à score égal) :
    // un départage par le mauvais id, ou l'absence de départage (ordre d'entrée conservé), s'y verrait — les
    // comparer via `c.acheteur.id` (fil) contre `a.contact_id` (copie), jamais `c.id` (l'id du match, ici égal
    // à rien de comparable côté copie).
    const T: [string, string, number | string | null][] = [['m-2', 'c-1', 80], ['m-1', 'c-2', 80], ['m-3', 'c-3', '95'], ['m-4', 'c-4', null]]
    const lignes: LigneCompatible[] = T.map(([id, contact_id, score]) => ({
      id, contact_id, score, status: 'suggested', snoozed_until: null, sent_at: null, response_at: null,
      reaction_motif: null, reaction_note: null, prix_propose: null,
    }))
    const ordreFil = trierCompatibles(lignes.map((l) => versCompatible(l, { first_name: 'A', last_name: 'B' })!)).map((c) => c.acheteur.id)
    const ordreCopie = wa.vueAcheteurs(deuxFormes('mandat').copie, lignes.map((l) => ({ ...l, nom: 'A B' })), MAINTENANT, false)
      .acheteurs.map((a) => a.contact_id)
    expect(ordreCopie).toEqual(ordreFil)
    expect(ordreFil).toEqual(['c-3', 'c-2', 'c-1', 'c-4'])
  })
})

describe('les équipements d’un bien en objet ou par inclusion', () => {
  it('une valeur fausse n’est pas un équipement, des deux côtés', () => {
    const { fil, copie } = deuxFormes('mandat', { features: { piscine: true, jardin: false } })
    expect(copie.equipements).toEqual(fil.equipements)
    const c: SearchCriteria = { features: ['piscine', 'jardin'] }
    const r: RaisonsMoteur = { features: { match: true, score: 50, detail: '1 sur 2' } }
    const presentsFil = lignesCriteres(filMatch(fil, c, r), MAINTENANT).flatMap((l) => (l.cle === 'equipements' ? l.presents : []))
    const presentsCopie = wa.expliquer(c as wa.Criteres, r, copie, MAINTENANT).flatMap((l) => (l.critere === 'equipements' && l.bien ? l.bien.split(', ') : []))
    expect(presentsCopie).toEqual(presentsFil)
  })
  it('un équipement présent par inclusion (« Grande terrasse » pour « terrasse »), des deux côtés', () => {
    const { fil, copie } = deuxFormes('annonce', { features: ['Grande terrasse'] })
    const c: SearchCriteria = { features: ['terrasse', 'piscine'] }
    const r: RaisonsMoteur = { features: { match: true, score: 50, detail: '1 sur 2' } }
    const presentsFil = lignesCriteres(filMatch(fil, c, r), MAINTENANT).flatMap((l) => (l.cle === 'equipements' ? l.presents : []))
    const presentsCopie = wa.expliquer(c as wa.Criteres, r, copie, MAINTENANT).flatMap((l) => (l.critere === 'equipements' && l.bien ? l.bien.split(', ') : []))
    expect(presentsCopie).toEqual(presentsFil)
  })
})
