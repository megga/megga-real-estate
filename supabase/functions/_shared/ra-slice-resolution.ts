// Garde-fou : le slug de canton a-t-il été RÉSOLU par l'API RealAdvisor ?
//
// POURQUOI
// -----------------------------------------------------------------------------
// RA ne renvoie PAS d'erreur sur un slug qu'il ne connaît pas : il l'IGNORE et
// sert une recherche NATIONALE. Mesuré le 26/07/2026 — le slug bidon
// `canton-inexistant-xyz-99` répond HTTP 200 avec total_count=43 285 et des
// `state` de tous les coins du pays. Même chose pour un slug valide dans la
// mauvaise langue : {slug:'canton-uri', lang:'de'} renvoie le catalogue entier
// (seul lang:'fr' résout aujourd'hui, et buildSearchParams le code en dur).
//
// Sans ce contrôle, le jour où RA renomme un slug, la slice concernée avale les
// ~43 000 annonces du pays, puis `processSlice` écrit un reçu de couverture
// `fully_enumerated` AU NOM D'UN SEUL CANTON. Ce reçu pilote le sweep ENUM : un
// canton entier serait déclaré « intégralement énuméré » sur la foi d'une
// requête qui ne le concernait pas.
//
// ⚠ Ne PAS se fier à `total_count` seul. Sur une slice à bande de prix, une
// réponse nationale filtrée par prix redescend à quelques milliers et passe sous
// n'importe quel seuil raisonnable. Le signal fiable est l'HOMOGÉNÉITÉ des
// cantons de la première page : une réponse nationale est bariolée, une réponse
// scopée ne l'est pas.

import { npaToCanton } from './npa.ts'

// slug RA → code canton à 2 lettres (= market_listings.canton). Sert au sweep
// ENUM, qui relie un reçu de slice (indexé par slug) aux lignes market_listings,
// et au garde-fou ci-dessous.
export const SLUG_TO_CODE: Record<string, string> = {
  'canton-geneve': 'GE', 'canton-vaud': 'VD', 'canton-valais': 'VS', 'canton-fribourg': 'FR',
  'canton-neuchatel': 'NE', 'canton-jura': 'JU', 'canton-berne': 'BE', 'canton-zurich': 'ZH',
  'canton-lucerne': 'LU', 'canton-zoug': 'ZG', 'canton-schwyz': 'SZ', 'canton-tessin': 'TI',
  'canton-grisons': 'GR', 'canton-bale-ville': 'BS', 'canton-bale-campagne': 'BL',
  'canton-argovie': 'AG', 'canton-soleure': 'SO', 'canton-thurgovie': 'TG', 'canton-schaffhouse': 'SH',
  'canton-saint-gall': 'SG', 'canton-appenzell-rhodes-exterieures': 'AR',
  'canton-appenzell-rhodes-interieures': 'AI', 'canton-glaris': 'GL', 'canton-nidwald': 'NW',
  'canton-obwald': 'OW', 'canton-uri': 'UR',
}

// En dessous de cet échantillon, la première page ne prouve rien : un canton
// minuscule (AI tient sur une seule page de 27) ou une bande de prix étroite
// peuvent légitimement ne renvoyer qu'une poignée de résultats.
export const RESOLUTION_MIN_SAMPLE = 8

// Seuil volontairement bas. On ne cherche PAS à mesurer la qualité du scoping —
// quelques annonces d'un canton limitrophe sont normales (NPA à cheval, adresse
// d'agence). On cherche à distinguer « scopé » de « national », et une réponse
// nationale tombe très en dessous de 50 % sur n'importe quel canton : le plus
// gros, TI, pèse ~21 % du catalogue.
export const RESOLUTION_MIN_RATIO = 0.5

export interface SliceHit {
  postcode?: string | number | null
  state?: string | null
}

export interface ResolutionCheck {
  resolu: boolean
  attendu: string | null
  bons: number
  classables: number
  raison?: string
}

/**
 * Vérifie que la première page d'une slice parle bien du canton demandé.
 *
 * Renvoie `resolu: true` — sans juger — quand il n'y a rien à vérifier :
 * requête nationale (slug vide) ou échantillon trop maigre. Un doute n'est
 * jamais traité comme une panne. Un slug hors table, lui, N'EST PAS un doute
 * (cf. ci-dessous).
 */
export function checkSliceResolution(slugCanton: string, listings: SliceHit[]): ResolutionCheck {
  if (!slugCanton) return { resolu: true, attendu: null, bons: 0, classables: 0, raison: 'requête nationale' }
  const attendu = SLUG_TO_CODE[slugCanton]
  // Un slug hors table est un ÉCHEC, pas une abstention. Il n'existe aucun appel
  // légitime : les callers passent soit '' (national, runFresh), soit un slug de
  // `realadvisor_shard_map`, qui n'en contient que des connus. Ce qui atterrit
  // ici est donc un code canton passé à la place d'un slug ('JU' au lieu de
  // 'canton-jura') ou un slug que RA a renommé — deux cas où RA sert le
  // catalogue NATIONAL. Mesuré le 29/07/2026 : un run manuel lancé avec des
  // codes a écrit 32 reçus estampillés « JU » sur des données nationales, dont
  // 16 `fully_enumerated`, sans que rien ne bronche. S'abstenir ici, c'est
  // désarmer le garde-fou exactement quand il sert.
  if (!attendu) {
    return { resolu: false, attendu: null, bons: 0, classables: 0, raison: 'slug hors table' }
  }
  if (listings.length < RESOLUTION_MIN_SAMPLE) {
    return { resolu: true, attendu, bons: 0, classables: 0, raison: 'échantillon insuffisant' }
  }

  let bons = 0
  let classables = 0
  for (const h of listings) {
    const c = npaToCanton(h.postcode, h.state)
    if (!c) continue
    classables++
    if (c === attendu) bons++
  }
  if (classables < RESOLUTION_MIN_SAMPLE) {
    return { resolu: true, attendu, bons, classables, raison: 'trop peu d\'annonces localisables' }
  }

  return { resolu: bons / classables >= RESOLUTION_MIN_RATIO, attendu, bons, classables }
}

/**
 * Variante levante, appelée par processSlice sur la première page.
 *
 * Lever plutôt que journaliser est délibéré : processSlice n'écrit son reçu de
 * couverture qu'en fin de fonction, donc une exception garantit qu'AUCUN reçu
 * mensonger n'est produit. `runBackground` compte la slice en échec ; cinq
 * d'affilée arrêtent le run en `throttled`. Un cycle incomplet vaut mieux qu'un
 * canton déclaré « intégralement énuméré » à tort.
 */
export function assertSliceResolved(slugCanton: string, listings: SliceHit[]): void {
  const r = checkSliceResolution(slugCanton, listings)
  if (r.resolu) return
  if (r.raison === 'slug hors table') {
    throw new Error(
      `slug hors table: ${slugCanton} n'est pas un slug RA connu — attendu l'une des ` +
      `${Object.keys(SLUG_TO_CODE).length} valeurs de SLUG_TO_CODE (p.ex. 'canton-jura', PAS 'JU'). ` +
      `RA ignore un slug inconnu et sert le catalogue national`
    )
  }
  throw new Error(
    `slug non résolu: ${slugCanton} attendait ${r.attendu} mais ${r.bons}/${r.classables} ` +
    `annonces de la 1re page y sont — RA sert une recherche nationale sur un slug inconnu`
  )
}
