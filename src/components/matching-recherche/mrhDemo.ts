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
 */
import type { CityHit } from '@/hooks/useMatchingRecherche'
import type { SendSelectionResult } from '@/hooks/useSendReceptionSelection'
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
    ref: 'MG-FL-8791220', agency: 'Naef Immobilier',
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

/**
 * Lien de réception simulé — ouvre `MrhSendSheet` sans rien minter.
 *
 * ⚠ Le jeton n'est PAS un jeton : il ne survivrait à aucune vérification de
 * signature. C'est voulu — la feuille se regarde, elle ne se suit pas.
 */
export const MRH_DEMO_SEND: SendSelectionResult = {
  url: 'https://app.megga.ch/reception/demo-banc-essai',
  token: 'demo-banc-essai',
  phone: '+41 79 000 00 00',
  firstName: 'Marie',
  count: 2,
}
