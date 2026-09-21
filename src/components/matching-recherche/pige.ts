/**
 * Pige lisible — le modèle PUR de « Ce qui a bougé » et de l'historique du prix d'une annonce du marché.
 *
 * Aucun appel réseau ici : les lignes viennent de la RPC `pige_mouvements` et de la table
 * `market_price_history` (hooks de `src/hooks/usePige.ts`) ; ce module les met en forme, et se prouve
 * sans rendu (`tests/unit/pige.spec.ts`).
 *
 * ⚠ L'HISTORIQUE COMMENCE À LA MISE EN SERVICE DE LA PIGE (21.09.2026) : on ne reconstitue pas le passé.
 * Une annonce déjà en ligne ce jour-là ouvre sa série par un relevé `suivi` ; une annonce apparue ensuite,
 * par son `apparition`. D'où `ResumePrix.debut.nature`.
 * ⚠ UNE APPARITION EST DATÉE À LA DÉTECTION, PAS À LA PUBLICATION : c'est le passage de la collecte qui
 * l'écrit (RealAdvisor voit une annonce ~4,5 jours après sa mise en ligne). L'écran dit donc « première
 * détection », jamais « publication » ; la publication, elle, se lit dans `first_seen_at`.
 */
import type { MrhBien } from './types'

/** Les trois mouvements que la pige montre. */
export type GenreMouvement = 'apparition' | 'baisse' | 'retrait'
/** Ce que montre la Recherche : le marché, ou l'un des trois flux. */
export type VueRecherche = 'marche' | GenreMouvement
export const VUES_RECHERCHE: readonly VueRecherche[] = ['marche', 'apparition', 'baisse', 'retrait']
/** Période du flux, en jours. */
export type FenetrePige = 1 | 7 | 30
export const FENETRES_PIGE: readonly FenetrePige[] = [1, 7, 30]
/** Tout ce qu'une ligne d'historique peut dire — le CHECK `market_price_history_kind_check`. */
export type GenrePoint = 'suivi' | 'apparition' | 'baisse' | 'hausse' | 'prix' | 'retrait' | 'retour' | 'statut'

const JOUR = 86_400_000
const GENRES_FLUX = new Set<string>(['apparition', 'baisse', 'retrait'])
const GENRES_POINT = new Set<string>(['suivi', 'apparition', 'baisse', 'hausse', 'prix', 'retrait', 'retour', 'statut'])

/** Montant PostgREST (nombre ou texte) → nombre ; `null` s'il manque ou ne se lit pas. */
const nombre = (v: unknown): number | null =>
  v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v)

/** Une ligne de `pige_mouvements`. */
export interface LigneMouvement {
  event_id: string
  detected_at: string
  kind: string
  market_listing_id: string
  old_price: number | string | null
  new_price: number | string | null
  change_pct: number | string | null
  first_seen_at: string | null
}

/** Un mouvement prêt à rendre : l'événement, et la carte de son annonce. */
export interface MouvementPige {
  id: string
  genre: GenreMouvement
  /** Quand le CRM l'a constaté (`detected_at`). */
  quand: string
  ancienPrix: number | null
  prix: number | null
  variationPct: number | null
  /** Jours sur le marché AU MOMENT du mouvement, depuis la première publication observée. */
  joursSurMarche: number | null
  bien: MrhBien
}

/** Clé de pagination : le dernier mouvement rendu, dans l'ordre `detected_at DESC, id DESC`. */
export interface CurseurPige { at: string; id: string }

/** Ce que l'écran peut dire du flux — `bloque` : la requête n'a pas pu partir (pas de session). */
export type EtatFlux = 'chargement' | 'lent' | 'erreur' | 'bloque' | 'pret'

/**
 * L'état du flux d'après sa requête infinie (TanStack v5).
 * ⛔ Une page SUIVANTE en échec lève aussi `isError` : lue comme une erreur, elle remplaçait par un écran
 * d'erreur les pages déjà chargées. Elle laisse la liste (`pret`) ; « Réessayer » se pose dessous.
 */
export function etatDuFlux(q: {
  enVol: boolean
  lent: boolean
  isFetchNextPageError: boolean
  isError: boolean
  status: 'pending' | 'error' | 'success'
}): EtatFlux {
  if (q.enVol) return q.lent ? 'lent' : 'chargement'
  if (q.isFetchNextPageError) return 'pret'
  if (q.isError) return 'erreur'
  return q.status === 'success' ? 'pret' : 'bloque'
}

/** Une ligne de `market_price_history`, lue pour la fiche. */
export interface LigneHistorique {
  id: string
  kind: string
  detected_at: string
  old_price: number | string | null
  new_price: number | string | null
  change_pct: number | string | null
  old_status: string | null
  new_status: string | null
}

/** Un point de la série de prix d'une annonce. */
export interface PointPrix {
  id: string
  genre: GenrePoint
  quand: string
  ancienPrix: number | null
  prix: number | null
  variationPct: number | null
  statut: string | null
}

/** Borne basse ISO de la période : `maintenant` moins N jours. */
export function depuisFenetre(jours: FenetrePige, maintenant: number): string {
  return new Date(maintenant - jours * JOUR).toISOString()
}

/** Jours PLEINS entre deux instants, jamais négatifs ; `null` si le début manque ou ne se lit pas. */
export function joursEntre(debut: string | null | undefined, fin: string | number): number | null {
  if (!debut) return null
  const a = Date.parse(debut)
  const b = typeof fin === 'number' ? fin : Date.parse(fin)
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.max(0, Math.floor((b - a) / JOUR))
}

/**
 * « aujourd'hui », « hier » ou « il y a N jours » — en jours CIVILS locaux, pas en tranches de 24 h :
 * une annonce apparue à 23 h 50 la veille est d'« hier », même vue à 0 h 10.
 */
export function quandRelatif(iso: string, maintenant: number): { cle: 'aujourdhui' | 'hier' | 'jours'; jours: number } {
  const jourCivil = (t: number) => {
    const d = new Date(t)
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  }
  // Math.round et non floor : un jour de changement d'heure dure 23 ou 25 heures.
  const n = Math.round((jourCivil(maintenant) - jourCivil(Date.parse(iso))) / JOUR)
  if (n <= 0) return { cle: 'aujourdhui', jours: 0 }
  if (n === 1) return { cle: 'hier', jours: 1 }
  return { cle: 'jours', jours: n }
}

/**
 * Écart en %, à UNE décimale, de `avant` à `apres` ; `null` sans deux prix positifs. L'arrondi unique de la
 * Recherche — l'affiche de la fiche, la carte de la grille et l'historique le partagent : un même écart
 * ne s'écrit pas « −10 % » en haut de la fiche et « −9,5 % » dans son historique.
 */
export function ecartPct(avant: number | null | undefined, apres: number | null | undefined): number | null {
  if (avant == null || apres == null || avant <= 0 || apres <= 0) return null
  return Math.round(((apres - avant) / avant) * 1000) / 10
}

/** Variation signée à une décimale, au séparateur de la langue : « −4,2 % », « +5.0 % ». */
export function formaterPct(v: number, langue: string): string {
  const signe = v < 0 ? '−' : v > 0 ? '+' : ''
  const chiffre = Math.abs(v).toLocaleString(`${langue.slice(0, 2)}-CH`, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return `${signe}${chiffre} %`
}

/** Ligne RPC + carte déjà mappée → mouvement ; `null` si la ligne n'est pas l'un des trois flux. */
export function versMouvement(ligne: LigneMouvement, bien: MrhBien): MouvementPige | null {
  if (!GENRES_FLUX.has(ligne.kind)) return null
  return {
    id: ligne.event_id,
    genre: ligne.kind as GenreMouvement,
    quand: ligne.detected_at,
    ancienPrix: nombre(ligne.old_price),
    prix: nombre(ligne.new_price),
    variationPct: nombre(ligne.change_pct),
    joursSurMarche: joursEntre(ligne.first_seen_at, ligne.detected_at),
    bien,
  }
}

/** Curseur de la page suivante : la dernière ligne d'une page PLEINE ; `null` après une page incomplète. */
export function curseurSuivant(lignes: LigneMouvement[], taille: number): CurseurPige | null {
  const derniere = lignes[lignes.length - 1]
  if (!derniere || lignes.length < taille) return null
  return { at: derniere.detected_at, id: derniere.event_id }
}

/**
 * Les biens cochés qui peuvent entrer dans la sélection d'un acheteur, dans l'ordre des ids : ceux qu'on
 * connaît (grille, puis flux), JAMAIS une annonce retirée. La fiche d'une retirée ne propose plus le geste ;
 * ce filtre tient quand même si une case cochée sur la grille survit au retrait de son annonce.
 * ⚠ À id égal, la DERNIÈRE version l'emporte : passer le flux après la grille, car une annonce qu'on
 * voit retirée dans « Retirés » l'est, même si la grille l'a chargée vivante plus tôt.
 */
export function biensAjoutables(ids: readonly string[], connus: readonly MrhBien[]): MrhBien[] {
  const parId = new Map(connus.map((b) => [b.id, b]))
  return ids.flatMap((id) => {
    const b = parId.get(id)
    return b && b.status !== 'removed' ? [b] : []
  })
}

/** Ligne de `market_price_history` → point ; un genre inconnu se range parmi les statuts. */
export function versPointPrix(l: LigneHistorique): PointPrix {
  return {
    id: l.id,
    genre: (GENRES_POINT.has(l.kind) ? l.kind : 'statut') as GenrePoint,
    quand: l.detected_at,
    ancienPrix: nombre(l.old_price),
    prix: nombre(l.new_price),
    variationPct: nombre(l.change_pct),
    statut: l.new_status,
  }
}

/** Ce que la fiche dit d'une série. */
export interface ResumePrix {
  /** Premier point : l'annonce détectée par la collecte (`apparition`), ou le début du suivi. */
  debut: { nature: 'detection' | 'suivi'; quand: string } | null
  /**
   * Le point qui porte le PREMIER PRIX de la série, d'où part l'écart. Pas forcément le premier point : une
   * annonce détectée sans prix n'a rien à comparer, et l'écart ne se dit « depuis la première détection »
   * (`detection`) que si l'apparition portait elle-même ce prix.
   */
  refEcart: { detection: boolean; quand: string } | null
  premierPrix: number | null
  prixActuel: number | null
  /** Changements de prix — baisses, hausses, prix affiché ou retiré — depuis le début de la série. */
  changements: number
  /** Écart du prix actuel au premier prix de la série, en %, à une décimale (`ecartPct`). */
  ecartPct: number | null
  /**
   * Baisse ANTÉRIEURE au suivi, en % (négatif), du premier prix gelé par la collecte (le prix barré de
   * l'affiche) au premier prix de la série ; `null` si la série part de ce premier prix. Même arrondi
   * que l'affiche, qui calcule le même écart.
   */
  avantSuivi: number | null
  /** Depuis la première publication observée (`first_seen_at`), jusqu'au retrait s'il y en a un. */
  joursSurMarche: number | null
}

/** Résumé d'une série triée du plus ancien au plus récent. */
export function resumerHistorique(
  points: PointPrix[],
  annonce: { enLigneDepuis: string | null; retireeLe: string | null; prixActuel: number | null; prixOriginal: number | null },
  maintenant: number,
): ResumePrix {
  const avecPrix = points.filter((p) => p.prix != null && p.prix > 0)
  const premier = points[0]
  const reference = avecPrix[0]
  const premierPrix = reference?.prix ?? null
  const prixActuel = annonce.prixActuel ?? avecPrix[avecPrix.length - 1]?.prix ?? null
  const avant = ecartPct(annonce.prixOriginal, premierPrix)
  return {
    debut: premier ? { nature: premier.genre === 'apparition' ? 'detection' : 'suivi', quand: premier.quand } : null,
    refEcart: reference ? { detection: reference === premier && reference.genre === 'apparition', quand: reference.quand } : null,
    premierPrix,
    prixActuel,
    changements: points.filter((p) => p.ancienPrix != null && p.prix != null && p.ancienPrix !== p.prix).length,
    ecartPct: ecartPct(premierPrix, prixActuel),
    avantSuivi: avant != null && avant < 0 ? avant : null,
    joursSurMarche: joursEntre(annonce.enLigneDepuis, annonce.retireeLe ?? maintenant),
  }
}

/** L'escalier des prix dans un cadre largeur × hauteur (origine en haut à gauche). */
export interface Courbe {
  chemin: string
  marques: { x: number; y: number; genre: GenrePoint }[]
}

/**
 * Tracé en ESCALIER : un prix tient jusqu'au changement suivant, puis jusqu'à `fin` (maintenant, ou le
 * retrait). `null` si aucun point ne porte de prix. 10 % de marge en haut et en bas ; un prix unique se
 * trace à mi-hauteur.
 */
export function tracerCourbe(points: PointPrix[], largeur: number, hauteur: number, fin: number): Courbe | null {
  const avecPrix = points.filter((p): p is PointPrix & { prix: number } => p.prix != null && p.prix > 0)
  if (!avecPrix.length) return null
  const temps = avecPrix.map((p) => Date.parse(p.quand))
  const t0 = temps[0]!
  const t1 = Math.max(fin, temps[temps.length - 1]!)
  const prix = avecPrix.map((p) => p.prix)
  const min = Math.min(...prix)
  const max = Math.max(...prix)
  const marge = hauteur * 0.1
  const arrondi = (v: number) => Math.round(v * 10) / 10
  const x = (t: number) => arrondi(t1 === t0 ? 0 : ((t - t0) / (t1 - t0)) * largeur)
  const y = (v: number) => arrondi(max === min ? hauteur / 2 : marge + (1 - (v - min) / (max - min)) * (hauteur - 2 * marge))
  const marques = avecPrix.map((p, i) => ({ x: x(temps[i]!), y: y(p.prix), genre: p.genre }))
  let chemin = `M${marques[0]!.x} ${marques[0]!.y}`
  for (const m of marques.slice(1)) chemin += ` H${m.x} V${m.y}`
  return { chemin: `${chemin} H${arrondi(largeur)}`, marques }
}
