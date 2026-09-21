/**
 * Fixtures du mode `demo` de « Recherche hybride » — banc `/dev/matching-atelier`.
 *
 * POURQUOI CE FICHIER EXISTE. `MatchingRechercheHybride` porte ses propres hooks
 * (`useAuth`, `useMatchingSearch`, `useMatchingSearchTotal`, `useMatchingBuyers`,
 * `useCitySuggest`), tous gatés sur la session. Contrairement à `AtelierStage`,
 * qui est présentationnel et qu'un banc peut alimenter par ses props, cette
 * moitié-là — la plus lourde du périmètre bureau — n'avait AUCUN banc : sans
 * session, ses cinq requêtes sont désactivées et l'écran ne montre qu'un état
 * bloqué. On ne pouvait donc pas la regarder avant de la repeindre.
 *
 * ⚠ Ne PAS contourner en injectant une session : une session injectée rend la
 * page sans qu'aucun appel Supabase ne parte — on croit voir des données réelles
 * et on voit un écran vide (fiche `megga/…-preview-method`). Le mode `demo` est
 * l'idiome déjà retenu par le CRM mobile (`MobileMatchingScreen demo`, fixtures
 * dans `vm.ts`, son module frère) ; on le reprend plutôt que d'en inventer un
 * second.
 *
 * ⛔ Rien ici ne vient de la base et rien n'écrit. Les valeurs sont plausibles
 * mais inventées : c'est un banc visuel, pas un aperçu du marché.
 * « Ce qui a bougé » et l'historique du prix (pige, 21.09.2026) y ont leurs fixtures, en fin de fichier.
 */
import type { CityHit } from '@/hooks/useMatchingRecherche'
import { joursEntre, type MouvementPige, type PointPrix } from './pige'
import type { MrhBien, MrhBienDetail, MrhContact } from './types'

/**
 * Les quatre états que le banc doit pouvoir montrer, et pourquoi chacun.
 *
 * ⚠ `vide`, `erreur` et `bloque` ne s'atteignent pas par hasard : un banc qui ne
 * rend que le cas nominal cache exactement les surfaces qu'un lot de peinture va
 * casser (défaut vécu sur `/dev/biens`, où la pastille de score n'était jamais
 * rendue faute de donnée pour la déclencher).
 *
 * ⛔ `vide` et `bloque` sont DEUX écrans distincts, et les confondre était un vrai
 * bug de production : « aucune annonce du marché » est une affirmation sur la
 * base, `bloque` dit seulement que la requête n'a pas pu partir.
 */
export type MrhDemoEtat = 'ok' | 'vide' | 'erreur' | 'bloque'

const PHOTO = (id: string, n = 1200) =>
  `https://images.unsplash.com/photo-${id}?w=${n}&q=80&auto=format&fit=crop`

/** « il y a N jours (et H heures) », relatif à l'ouverture du banc : les libellés restent vrais d'un jour sur l'autre. */
const ILYA = (jours: number, heures = 0) => new Date(Date.now() - (jours * 24 + heures) * 3_600_000).toISOString()

function bien(p: Partial<MrhBien> & Pick<MrhBien, 'id' | 'title' | 'addr' | 'type' | 'typeLabel' | 'transaction'>): MrhBien {
  const dom = p.days_on_market ?? 9
  return {
    price: null, rent: null, price_original: null, price_per_m2: null,
    rooms: null, beds: null, baths: null, area: null, year: null, land_surface: null,
    canton: 'GE', city: null, postal_code: null, lat: null, lng: null,
    features: [], status: 'active', source: 'market', source_portal: null,
    source_url: null, ref: null, agency: null, agency_phone: null, agency_logo_url: null,
    days_on_market: dom,
    postedAt: dom <= 0 ? "aujourd'hui" : dom === 1 ? 'hier' : dom < 7 ? `il y a ${dom} j` : dom < 30 ? `il y a ${Math.round(dom / 7)} sem` : `il y a ${Math.round(dom / 30)} mois`,
    postedRank: dom,
    photos: [],
    enLigneDepuis: ILYA(dom),
    retireeLe: null,
    ...p,
  }
}

/**
 * Neuf annonces, choisies pour couvrir ce que la carte SAIT afficher et qui,
 * autrement, ne se voit jamais tous en même temps : vente ET location (les deux
 * segments du sélecteur), un prix barré (baisse ≥ 2 %), une annonce sans photo
 * (le repli de `MrhPhoto`), et des coordonnées réelles pour que les pastilles de
 * la vue Carte se positionnent.
 *
 * ⛔ TROIS RÉGIES PORTENT UN LOGO, LES AUTRES NON — et c'est le point. Mesuré en
 * base le 13 août 2026 : 47,9 % des annonces actives ont un logo (68,0 % côté
 * Flatfox, 31,3 % côté RealAdvisor). Un banc où toutes en auraient un ferait
 * croire que le repli sur le NOM est un cas de bord, alors qu'il couvre la
 * majorité de la grille — c'est exactement l'erreur que la maquette d'origine
 * avait faite en dessinant un monogramme.
 *
 * ⚠ Les paires nom + logo sont RÉELLES, relevées en base : poser un vrai logo sur
 * une régie inventée fabriquerait une donnée. Un CDN de chaque, et un SVG, un PNG
 * et un JPG — les trois ne se chargent pas de la même façon.
 */
export const MRH_DEMO_BIENS: MrhBien[] = [
  bien({
    id: 'demo-ml-01', title: '5 pièces familial — Carouge',
    addr: 'Rue Ancienne 6, 1227 Carouge', city: 'Carouge', postal_code: '1227',
    type: 'apartment', typeLabel: 'Appartement', transaction: 'vente',
    // ⛔ `price_reduced` EST NÉCESSAIRE AU BANC. La pastille en APLAT de la fiche
    // est gatée sur ce statut : sans une fixture qui le porte, deux des trois
    // sites de la teinte de baisse de prix ne sont rendus NULLE PART, et la sonde
    // au rendu n'en voyait qu'un seul. Même défaut que `/dev/biens`, qui ne
    // montrait jamais la pastille de score faute de donnée pour la déclencher.
    status: 'price_reduced',
    price: 1100000, price_original: 1145000, price_per_m2: 9167,
    rooms: 5, beds: 3, baths: 2, area: 120, year: 1996,
    lat: 46.1817, lng: 6.1397, days_on_market: 12,
    features: ['Balcon', 'Cave', 'Parking', 'Ascenseur', 'Parquet'],
    ref: 'MG-RA-4827193', agency: '105 Immo', agency_phone: '+41 22 819 44 00',
    agency_logo_url: 'https://storage.googleapis.com/img.realadvisor.ch/logo-agency-105immo_2025-06-25-155449.svg',
    source_portal: 'realadvisor',
    photos: ['1502672260266-1c1ef2d93688', '1493809842364-78817add7ffb', '1560448204-e02f11c3d0e2'].map((i) => PHOTO(i)),
  }),
  bien({
    id: 'demo-ml-02', title: '4 pièces avec terrasse — Carouge',
    addr: 'Rue Jacques-Dalphin 22, 1227 Carouge', city: 'Carouge', postal_code: '1227',
    type: 'apartment', typeLabel: 'Appartement', transaction: 'vente',
    price: 980000, price_per_m2: 10000,
    rooms: 4, beds: 2, baths: 1, area: 98, year: 2005,
    lat: 46.1809, lng: 6.1372, days_on_market: 4,
    features: ['Terrasse', 'Ascenseur', 'Cave', 'Parquet'],
    ref: 'MG-RA-4831077', agency: 'AD Immob', agency_phone: '+41 22 839 39 39',
    agency_logo_url: 'https://storage.googleapis.com/img.realadvisor.ch/logo-ad-immob_2025-06-06-134039.png',
    source_portal: 'realadvisor',
    photos: ['1493663284031-b7e3aefcae8e', '1505691938895-1758d7feb511'].map((i) => PHOTO(i)),
  }),
  bien({
    id: 'demo-ml-03', title: '5 pièces rénové — Plainpalais',
    addr: 'Boulevard des Philosophes 9, 1205 Genève', city: 'Genève', postal_code: '1205',
    type: 'apartment', typeLabel: 'Appartement', transaction: 'vente',
    price: 1180000, price_original: 1220000, price_per_m2: 10261,
    rooms: 5, beds: 3, baths: 2, area: 115, year: 1908,
    lat: 46.1976, lng: 6.1428, days_on_market: 14,
    features: ['Ascenseur', 'Cave', 'Parquet', 'Balcon'],
    ref: 'MG-RA-4825903', agency: 'Moser Vernet & Cie', agency_phone: '+41 22 839 09 00',
    source_portal: 'realadvisor',
    photos: ['1554995207-c18c203602cb', '1560185007-cde436f6a4d0'].map((i) => PHOTO(i)),
  }),
  bien({
    id: 'demo-ml-04', title: 'Villa individuelle — Vandœuvres',
    addr: 'Chemin de la Blonde 14, 1253 Vandœuvres', city: 'Vandœuvres', postal_code: '1253',
    type: 'villa', typeLabel: 'Villa', transaction: 'vente',
    price: 3250000, price_per_m2: 12500,
    rooms: 7, beds: 4, baths: 3, area: 260, land_surface: 1200, year: 1978,
    lat: 46.2189, lng: 6.1970, days_on_market: 41,
    features: ['Jardin', 'Piscine', 'Garage', 'Cheminée'],
    ref: 'MG-RA-4790112', agency: 'Barnes Suisse',
    source_portal: 'realadvisor',
    photos: ['1568605114967-8130f3a36994', '1512917774080-9991f1c4c750'].map((i) => PHOTO(i)),
  }),
  bien({
    // ⚠ Sans photo NI logo de régie — c'est le seul moyen de voir le repli de
    // `MrhPhoto` et celui de `MrhAgencyLogo`, tous deux invisibles autrement.
    id: 'demo-ml-05', title: 'Studio proche gare — Lausanne',
    addr: 'Avenue de la Gare 33, 1003 Lausanne', city: 'Lausanne', postal_code: '1003',
    canton: 'VD', type: 'studio', typeLabel: 'Studio', transaction: 'location',
    rent: 1450, area: 34, rooms: 1.5, year: 1972,
    lat: 46.5170, lng: 6.6300, days_on_market: 2,
    features: ['Ascenseur'],
    ref: 'MG-FL-8814004',
    source_portal: 'flatfox',
  }),
  bien({
    id: 'demo-ml-06', title: '3,5 pièces lumineux — Eaux-Vives',
    addr: 'Rue des Eaux-Vives 78, 1207 Genève', city: 'Genève', postal_code: '1207',
    type: 'apartment', typeLabel: 'Appartement', transaction: 'location',
    rent: 3200, area: 82, rooms: 3.5, beds: 2, baths: 1, year: 2014,
    lat: 46.2035, lng: 6.1590, days_on_market: 6,
    features: ['Balcon', 'Ascenseur', 'Cave'],
    ref: 'MG-FL-8809741', agency: 'AD Real Estate', agency_phone: '+41 22 708 12 12',
    agency_logo_url: 'https://flatfox.ch/thumb/org/2026/04/0y5q9rryesr3zyvisbtn56ugi4syciihivc789d2xso3eijtrc.jpg?alias=org_logo_m&signature=7ghbsUn-NIQS0CkrdFaLMTPzYQ8sGUJZPSAZy9HYOqA',
    source_portal: 'flatfox',
    photos: ['1522708323590-d24dbb6b0267', '1484154218962-a197022b5858'].map((i) => PHOTO(i)),
  }),
  bien({
    id: 'demo-ml-07', title: '4,5 pièces avec jardin — Chêne-Bougeries',
    addr: 'Route de Chêne 120, 1224 Chêne-Bougeries', city: 'Chêne-Bougeries', postal_code: '1224',
    type: 'apartment', typeLabel: 'Appartement', transaction: 'location',
    rent: 4100, area: 108, rooms: 4.5, beds: 3, baths: 2, year: 2019,
    lat: 46.1962, lng: 6.1852, days_on_market: 19,
    features: ['Jardin', 'Parking', 'Ascenseur'],
    // ⚠ LE CAS QUI SERRE, et il est réel : des agences générales d'assurance
    // portent 86 à 95 caractères ET un logo. Sans lui dans le banc, on livrerait
    // une rangée « plaque + nom + date » qu'on n'a jamais vue se disputer la
    // largeur.
    ref: 'MG-FL-8791220',
    agency: "Helvetia Compagnie Suisse d'Assurances sur la Vie SA, Agence générale Lausanne La Côte",
    agency_logo_url: 'https://flatfox.ch/thumb/org/2020/09/5skf5sjpzqm3ndwrxj08jgj70v8t0azhpzl9et0akm1er8jvl3.jpg?alias=org_logo_m&signature=Nn5dKJhFpftGy5qt6lFcKPhltaQ7s4DNzZyCR93tPiI',
    source_portal: 'flatfox',
    photos: ['1567016432779-094069958ea5'].map((i) => PHOTO(i)),
  }),
  bien({
    id: 'demo-ml-08', title: 'Attique 6 pièces — Champel',
    addr: 'Avenue de Champel 51, 1206 Genève', city: 'Genève', postal_code: '1206',
    type: 'attic', typeLabel: 'Attique', transaction: 'vente',
    price: 2450000, price_per_m2: 14000,
    rooms: 6, beds: 3, baths: 2, area: 175, year: 2001,
    lat: 46.1902, lng: 6.1520, days_on_market: 27,
    features: ['Terrasse', 'Ascenseur', 'Parking', 'Cave'],
    ref: 'MG-RA-4801556', agency: 'SPG One', agency_phone: '+41 22 707 46 46',
    source_portal: 'realadvisor',
    photos: ['1600585154340-be6161a56a0c', '1600607687939-ce8a6c25118c'].map((i) => PHOTO(i)),
  }),
  bien({
    id: 'demo-ml-09', title: '2 pièces meublé — Nyon',
    addr: 'Rue de la Gare 8, 1260 Nyon', city: 'Nyon', postal_code: '1260',
    canton: 'VD', type: 'apartment', typeLabel: 'Appartement', transaction: 'location',
    rent: 1980, area: 48, rooms: 2, beds: 1, baths: 1, year: 1989,
    lat: 46.3833, lng: 6.2394, days_on_market: 1,
    features: ['Cave'],
    ref: 'MG-FL-8820117', agency: 'Régie de la Côte',
    source_portal: 'flatfox',
    photos: ['1560448204-e02f11c3d0e2'].map((i) => PHOTO(i)),
  }),
]

/**
 * Total du marché filtré — sciemment très supérieur au nombre d'annonces
 * chargées, pour que le banc rende la mention « sur N au total » et l'avis de
 * portée du filtre client. Les deux lignes n'existent QUE dans ce cas, et c'est
 * précisément celui de la production (la liste est une tranche bornée).
 */
export const MRH_DEMO_TOTAL = 1284

export const MRH_DEMO_BUYERS: MrhContact[] = [
  {
    id: 'demo-c-001', searchId: 'demo-s-001', firstName: 'Marie', lastName: 'Bertrand',
    label: 'Appartement Carouge · 0,9–1,3M',
    criteria: {
      transaction: 'vente', types: ['apartment'], cantons: ['GE'], cities: ['Carouge'],
      budgetMin: 900000, budgetMax: 1300000, roomsMin: 4, roomsMax: null, areaMin: 90,
      mustHave: ['Balcon', 'Ascenseur'],
    },
  },
  {
    id: 'demo-c-002', searchId: 'demo-s-002', firstName: 'David', lastName: 'Rey',
    label: 'Location 3,5 p. rive gauche',
    criteria: {
      transaction: 'location', types: ['apartment'], cantons: ['GE'], cities: [],
      budgetMin: null, budgetMax: 3500, roomsMin: 3, roomsMax: null, areaMin: 70,
      mustHave: ['Balcon'],
    },
  },
  {
    id: 'demo-c-003', searchId: 'demo-s-003', firstName: 'Thomas', lastName: 'Berger',
    label: 'Investisseur — rendement GE',
    criteria: {
      transaction: 'vente', types: ['apartment', 'building'], cantons: ['GE', 'VD'], cities: [],
      budgetMin: 1000000, budgetMax: 1500000, roomsMin: null, roomsMax: null, areaMin: null,
      mustHave: [],
    },
  },
]

/** Villes servies à l'omnibox — remplace la RPC `search_cities`. */
export const MRH_DEMO_CITIES: CityHit[] = [
  { city: 'Carouge', canton: 'GE', n: 84 },
  { city: 'Genève', canton: 'GE', n: 612 },
  { city: 'Chêne-Bougeries', canton: 'GE', n: 47 },
  { city: 'Lausanne', canton: 'VD', n: 391 },
  { city: 'Nyon', canton: 'VD', n: 128 },
  { city: 'Vandœuvres', canton: 'GE', n: 9 },
]

/**
 * Champs de fiche — normalement chargés par `useMarketListingDetail` à
 * l'ouverture de « Voir l'annonce ». Sans eux la fiche (le plus gros fichier du
 * périmètre) ne montrerait que ce que la grille lui a déjà donné : ni
 * description, ni étage, ni charges, ni disponibilité.
 */
export const MRH_DEMO_DETAIL: MrhBienDetail = {
  description:
    "Appartement traversant de 120 m² au cœur du Vieux-Carouge. Séjour lumineux ouvert sur balcon plein sud, trois chambres, deux salles d'eau. Cave et place de parc en sus. Proche écoles, marché et tram.",
  floor: 3,
  parking_count: 1,
  year_renovated: 2018,
  usable_surface: 112,
  charges_monthly: 420,
  is_furnished: false,
  availability_date: '2026-10-01',
  visit_contact_name: 'Sandra Perrin',
  agency_reference: 'RDR-2026-0412',
}

/** Une annonce du banc par son id — les mouvements ci-dessous n'en inventent pas de nouvelles. */
const annonceDemo = (id: string): MrhBien => {
  const b = MRH_DEMO_BIENS.find((x) => x.id === id)
  if (!b) throw new Error(`mrhDemo : annonce ${id} introuvable`)
  return b
}

/**
 * Une retirée du flux : l'annonce passe `removed` à cette date, et le mouvement porte les jours que la fiche
 * comptera pour elle (publication → retrait). Écrits à la main, les deux chiffres se contredisaient d'un écran
 * à l'autre (« après 41 jours » sur la ligne, « 40 jours » sur la fiche). Même compte pour `days_on_market`,
 * que les caractéristiques de la fiche affichent : `mapListingRow` l'arrête au retrait, le banc aussi.
 */
const retiree = (mv: string, id: string, quand: string): MouvementPige => {
  const vivante = annonceDemo(id)
  const jours = joursEntre(vivante.enLigneDepuis, quand)
  const bien: MrhBien = { ...vivante, status: 'removed', retireeLe: quand, days_on_market: jours }
  const prix = (bien.transaction === 'location' ? bien.rent : bien.price) ?? null
  return { id: mv, genre: 'retrait', quand, ancienPrix: prix, prix, variationPct: null, joursSurMarche: jours, bien }
}

/**
 * « Ce qui a bougé » au banc : deux mouvements par flux, pris parmi les neuf annonces ci-dessus.
 * ⚠ Dates RELATIVES à l'ouverture du banc, pour que « aujourd'hui » et « hier » restent vrais d'un jour
 * sur l'autre. Les retirées portent `status` et `retireeLe` : la fiche ouverte depuis le flux doit dire
 * « retirée le … ». ⛔ Inventés, comme le reste de ce fichier.
 */
export const MRH_DEMO_MOUVEMENTS: MouvementPige[] = [
  { id: 'demo-mv-01', genre: 'apparition', quand: ILYA(0, 3), ancienPrix: null, prix: 980000, variationPct: null, joursSurMarche: 4, bien: annonceDemo('demo-ml-02') },
  { id: 'demo-mv-02', genre: 'apparition', quand: ILYA(1, 2), ancienPrix: null, prix: 1980, variationPct: null, joursSurMarche: 0, bien: annonceDemo('demo-ml-09') },
  { id: 'demo-mv-03', genre: 'baisse', quand: ILYA(0, 5), ancienPrix: 1145000, prix: 1100000, variationPct: -3.93, joursSurMarche: 12, bien: annonceDemo('demo-ml-01') },
  { id: 'demo-mv-04', genre: 'baisse', quand: ILYA(3), ancienPrix: 1220000, prix: 1180000, variationPct: -3.28, joursSurMarche: 11, bien: annonceDemo('demo-ml-03') },
  retiree('demo-mv-05', 'demo-ml-04', ILYA(0, 6)),
  retiree('demo-mv-06', 'demo-ml-07', ILYA(2)),
]

/** Début FICTIF du suivi au banc, en jours : la frontière entre un relevé initial et une apparition. */
const DEBUT_SUIVI_JOURS = 40

/**
 * Historique d'une annonce du banc : son premier point, sa baisse si elle en porte une, son retrait si
 * elle est retirée.
 * ⚠ Le premier point suit la règle de la production : une annonce DÉJÀ en ligne au début du suivi ouvre
 * sa série par un relevé (`suivi`) ; une annonce publiée depuis, par son apparition. Un relevé posé avant
 * la publication ferait dire à la fiche « suivi depuis » une date où l'annonce n'existait pas.
 */
function historiqueDemo(b: MrhBien): PointPrix[] {
  const actuel = (b.transaction === 'location' ? b.rent : b.price) ?? null
  const premier = b.price_original ?? actuel
  // Même date que le mouvement du flux quand il existe : la fiche ne contredit pas la ligne qu'on a cliquée.
  const duFlux = (genre: MouvementPige['genre']) => MRH_DEMO_MOUVEMENTS.find((m) => m.bien.id === b.id && m.genre === genre)?.quand
  const debutSuivi = ILYA(DEBUT_SUIVI_JOURS)
  const dejaEnLigne = !b.enLigneDepuis || b.enLigneDepuis <= debutSuivi
  const points: PointPrix[] = [
    dejaEnLigne
      ? { id: `${b.id}-suivi`, genre: 'suivi', quand: debutSuivi, ancienPrix: null, prix: premier, variationPct: null, statut: 'active' }
      : { id: `${b.id}-apparition`, genre: 'apparition', quand: duFlux('apparition') ?? b.enLigneDepuis ?? debutSuivi, ancienPrix: null, prix: premier, variationPct: null, statut: 'active' },
  ]
  if (b.price_original && actuel && b.price_original > actuel) {
    const quand = duFlux('baisse') ?? ILYA(6)
    points.push({ id: `${b.id}-baisse`, genre: 'baisse', quand, ancienPrix: b.price_original, prix: actuel, variationPct: Math.round(((actuel - b.price_original) / b.price_original) * 10000) / 100, statut: 'price_reduced' })
  }
  if (b.retireeLe) {
    points.push({ id: `${b.id}-retrait`, genre: 'retrait', quand: b.retireeLe, ancienPrix: actuel, prix: actuel, variationPct: null, statut: 'removed' })
  }
  return points
}

/**
 * Historiques calculés UNE fois au chargement du module — les calculer au rendu lirait l'horloge pendant
 * le rendu. DEUX tables : une annonce retirée du flux partage son id avec sa version vivante de la grille,
 * et une seule table ferait porter un retrait à la fiche ouverte depuis la grille.
 */
const HISTORIQUES_VIVANTES: Record<string, PointPrix[]> = Object.fromEntries(MRH_DEMO_BIENS.map((b) => [b.id, historiqueDemo(b)]))
const HISTORIQUES_RETIREES: Record<string, PointPrix[]> = Object.fromEntries(
  MRH_DEMO_MOUVEMENTS.filter((m) => m.bien.retireeLe).map((m) => [m.bien.id, historiqueDemo(m.bien)]),
)

/** L'historique du prix d'une annonce du banc, selon qu'elle est ouverte vivante (grille) ou retirée (flux). */
export function historiqueDuBanc(b: MrhBien): PointPrix[] {
  return (b.retireeLe ? HISTORIQUES_RETIREES[b.id] : HISTORIQUES_VIVANTES[b.id]) ?? []
}
