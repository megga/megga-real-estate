/**
 * Le fil de matchs — modèle de vue PUR : ni React, ni Supabase, ni traduction.
 *
 * Conception : `docs/superpowers/specs/2026-09-17-matching-fil-design.md` (§3, §4). Le lot 1
 * n'en sert que « À traiter » sur les biens de l'agence ; la forme est déjà celle du fil entier.
 *
 * ⚠ Aucune chaîne affichée ne sort d'ici : les lignes de critères portent des VALEURS, et c'est
 * l'écran qui les écrit dans la langue de l'agent. Seul le `detail` du moteur traverse tel quel —
 * c'est une donnée, rédigée par `matching-engine`.
 *
 * ⛔ LES CRITÈRES SONT CEUX DE LA RECHERCHE qui a produit le match (`client_searches.criteria`, par
 * `matches.client_search_id`), jamais ceux de la fiche : mesuré le 17.09.2026, 3 acheteurs sur 4 ont
 * un `contacts.search_criteria` vide alors que leur recherche est complète, et un contact peut porter
 * plusieurs recherches. D'où `criteres` sur le MATCH, pas sur l'acheteur.
 *
 * ⛔ LES ÉQUIPEMENTS SE COMPARENT AVEC LA RÈGLE DU MOTEUR (`slugify` puis inclusion,
 * `matching-normalize.ts`). Une règle à nous afficherait « 0 sur 1 » à côté d'un ✓ du moteur, ou
 * l'inverse ; `matching-fil-modele.spec.ts` la confronte à `calculateScoreV2`.
 */
import type { SearchCriteria } from '@/types/contact'
import { splitZones } from '@/lib/contactCriteria'

type AxeMoteur = 'budget' | 'zone' | 'type' | 'rooms' | 'features'
type RaisonMoteur = { match: boolean; score: number; detail: string }
/** `matches.reasons` : cinq axes, `match` = fraction tenue ≥ 0,5 (`matching-normalize.ts`). */
export type RaisonsMoteur = Partial<Record<AxeMoteur, RaisonMoteur>>

export interface FilBien {
  id: string
  titre: string
  prix: number | null
  location: boolean
  /** Type en base (`apartment`, `house`…) : traduit à l'écran. */
  type: string | null
  pieces: number | null
  surface: number | null
  ville: string | null
  canton: string | null
  adresse: string | null
  equipements: string[]
  /** Première photo seulement (§8). */
  photo: string | null
  /** Annonce du MARCHÉ (lot 2) : sa référence et son lien d'origine. Absent pour un bien en mandat. */
  marche?: { ref: string; sourceUrl: string | null }
}

export interface FilMatch {
  id: string
  score: number
  raisons: RaisonsMoteur | null
  /** Les critères de la recherche qui a produit ce match. */
  criteres: SearchCriteria | null
  creeLe: string | null
  reporteJusquau: string | null
  bien: FilBien
  acheteur: {
    id: string
    prenom: string
    nom: string
    telephone: string | null
    email: string | null
    kyc: 'verified' | 'pending' | 'stale' | 'none'
  }
}

export interface FilFiltres { bienId: string | null; acheteurId: string | null; texte: string }

export interface FilVue {
  groupes: { bien: FilBien; matchs: FilMatch[] }[]
  /** Triés par date de retour, le plus proche d'abord. */
  reportes: FilMatch[]
  /** Lignes d'« À traiter » : un acheteur sous un bien vaut une ligne (§3.1). */
  compte: number
  /** Ordre de lecture des lignes, celui de ↑/↓. */
  ordre: string[]
}

export interface Historique { proposes: number; interesses: number }
export type PalierScore = 'fort' | 'bon' | 'possible'
export interface OptionFiltre { id: string; libelle: string }

type Verdict = { ok: boolean | null; ecart: string | null }
export type LigneCritere =
  | ({ cle: 'budget'; min: number | null; max: number | null; prix: number | null; location: boolean } & Verdict)
  | ({ cle: 'zone'; villes: string[]; cantons: string[]; ville: string | null; canton: string | null } & Verdict)
  | ({ cle: 'type'; voulu: string; propose: string | null } & Verdict)
  | ({ cle: 'pieces'; min: number | null; max: number | null; pieces: number | null } & Verdict)
  | ({ cle: 'surface'; min: number; surface: number | null } & Verdict)
  | ({ cle: 'equipements'; voulus: string[]; presents: string[] } & Verdict)

/** Trois paliers, bureau et mobile (§3.5). Le seuil du moteur (55) borne le bas. */
export function palierScore(score: number): PalierScore {
  if (score >= 85) return 'fort'
  if (score >= 70) return 'bon'
  return 'possible'
}

/** Minuscules, sans diacritiques, ligatures dépliées : « Vandœuvres » se trouve en tapant « vandoeuvres ». */
const plier = (s: string): string =>
  s.replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')
    .normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

/** Le `slugify` du moteur, à l'identique (`matching-normalize.ts`). */
const slug = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Horodatage d'une date ISO ; une date absente ou illisible vaut 0, pour que le tri reste total. */
const temps = (iso: string | null): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

function passeFiltres(m: FilMatch, f: FilFiltres): boolean {
  if (f.bienId && m.bien.id !== f.bienId) return false
  if (f.acheteurId && m.acheteur.id !== f.acheteurId) return false
  const texte = plier(f.texte.trim())
  if (!texte) return true
  return plier([m.bien.titre, m.bien.ville ?? '', m.bien.adresse ?? '', m.acheteur.prenom, m.acheteur.nom].join(' ')).includes(texte)
}

/** Score décroissant, puis le plus récent, puis l'id : un ordre TOTAL, donc une navigation stable. */
function avant(a: FilMatch, b: FilMatch): number {
  return b.score - a.score || temps(b.creeLe) - temps(a.creeLe) || a.id.localeCompare(b.id)
}

/** Le fil « À traiter » : groupes par bien, reportés à part, compte et ordre de lecture. */
export function construireFil(matchs: readonly FilMatch[], filtres: FilFiltres, maintenant: number): FilVue {
  const reportes: FilMatch[] = []
  const parBien = new Map<string, { bien: FilBien; matchs: FilMatch[] }>()
  for (const m of matchs) {
    if (!passeFiltres(m, filtres)) continue
    if (m.reporteJusquau != null && temps(m.reporteJusquau) > maintenant) {
      reportes.push(m)
      continue
    }
    const groupe = parBien.get(m.bien.id) ?? { bien: m.bien, matchs: [] }
    groupe.matchs.push(m)
    parBien.set(m.bien.id, groupe)
  }
  reportes.sort((a, b) => temps(a.reporteJusquau) - temps(b.reporteJusquau) || a.id.localeCompare(b.id))
  const groupes = [...parBien.values()]
    .map((g) => ({ bien: g.bien, matchs: [...g.matchs].sort(avant) }))
    .sort((a, b) => avant(a.matchs[0]!, b.matchs[0]!))
  const ordre = groupes.flatMap((g) => g.matchs.map((m) => m.id))
  return { groupes, reportes, compte: ordre.length, ordre }
}

/**
 * Les choix des filtres Bien et Acheteur : chacun une fois, triés par libellé. Les acheteurs des lignes
 * « Marché » (`selections`) en sont aussi : sans eux, un acheteur qui n'a que des biens du marché ne
 * pouvait pas être filtré. Le filtre Bien ne vise que les biens en mandat : il écarte toutes les lignes
 * « Marché » (`construireSelections`).
 */
export function optionsFiltres(
  matchs: readonly FilMatch[], selections: readonly FilSelectionResume[] = [],
): { biens: OptionFiltre[]; acheteurs: OptionFiltre[] } {
  const biens = new Map<string, string>()
  const acheteurs = new Map<string, string>()
  for (const m of matchs) {
    biens.set(m.bien.id, m.bien.titre)
    acheteurs.set(m.acheteur.id, `${m.acheteur.prenom} ${m.acheteur.nom}`)
  }
  for (const s of selections) acheteurs.set(s.acheteur.id, `${s.acheteur.prenom} ${s.acheteur.nom}`)
  const trier = (e: Map<string, string>): OptionFiltre[] =>
    [...e].map(([id, libelle]) => ({ id, libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr') || a.id.localeCompare(b.id))
  return { biens: trier(biens), acheteurs: trier(acheteurs) }
}

/** La clé de traduction d'un équipement (`fil.equipementsNoms`) : le slug du moteur, sans le préfixe `custom:`. */
export function cleEquipement(brut: string): string {
  return slug(brut.replace(/^custom:/i, ''))
}

const chaines = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])

/** Détails que le moteur écrit pour un axe INACTIF (aucun critère de son côté) : pas un verdict. */
const INACTIF = new Set(['—', 'Aucun critère'])

/** Les lignes « Recherché / Ce bien » : une par critère que la recherche a posé (§4.4). */
export function lignesCriteres(m: FilMatch): LigneCritere[] {
  const c = m.criteres
  if (!c) return []
  const raisons = m.raisons ?? {}
  // ⛔ Sans raison du moteur, ou sur un axe qu'il n'a pas évalué, AUCUN verdict : un ✓ sans preuve
  // serait une invention. ⛔ Et l'écart ne s'écrit que là où le `detail` DÉCRIT un écart (budget,
  // zone, équipements) : pour le type, il répète la colonne « Ce bien ».
  const verdict = (axe: AxeMoteur, decritEcart: boolean): Verdict => {
    const r = raisons[axe]
    const detail = typeof r?.detail === 'string' ? r.detail.trim() : ''
    if (!r || typeof r.match !== 'boolean' || (!r.match && INACTIF.has(detail))) return { ok: null, ecart: null }
    return { ok: r.match, ecart: decritEcart && !r.match && detail ? detail : null }
  }
  const lignes: LigneCritere[] = []
  if (c.budget_min != null || c.budget_max != null) {
    lignes.push({ cle: 'budget', min: c.budget_min ?? null, max: c.budget_max ?? null, prix: m.bien.prix, location: m.bien.location, ...verdict('budget', true) })
  }
  const { cities, cantons } = splitZones(chaines(c.zones))
  if (cities.length > 0 || cantons.length > 0) {
    lignes.push({ cle: 'zone', villes: cities, cantons, ville: m.bien.ville, canton: m.bien.canton, ...verdict('zone', true) })
  }
  if (c.type) lignes.push({ cle: 'type', voulu: c.type, propose: m.bien.type, ...verdict('type', false) })
  // ⛔ PIÈCES ET SURFACE : UN FAIT, PAS LA NOTE DU MOTEUR. Il les a FUSIONNÉES en un axe, dont le
  // verdict contredit l'une des deux lignes dès que l'autre tire la moyenne — mesuré le 17.09.2026 :
  // 4 pièces cochées pour 2 à 3 demandées (la surface compensait), 120 m² en écart pour 70 m²
  // demandés (les pièces pesaient). Chaque ligne compare donc SA valeur à SES bornes.
  if (c.rooms_min != null || c.rooms_max != null) {
    const p = m.bien.pieces
    lignes.push({
      cle: 'pieces', min: c.rooms_min ?? null, max: c.rooms_max ?? null, pieces: p, ecart: null,
      ok: p == null ? null : (c.rooms_min == null || p >= c.rooms_min) && (c.rooms_max == null || p <= c.rooms_max),
    })
  }
  if (c.surface_min != null) {
    const s = m.bien.surface
    lignes.push({ cle: 'surface', min: c.surface_min, surface: s, ok: s == null ? null : s >= c.surface_min, ecart: null })
  }
  // Un équipement dont le slug est vide (« — ») n'existe pas pour le moteur : il n'existe pas ici.
  const voulus = chaines(c.features).filter((v) => slug(v) !== '')
  if (voulus.length > 0) {
    const offerts = m.bien.equipements.map(slug).filter(Boolean)
    const presents = voulus.filter((v) => {
      const w = slug(v)
      return offerts.some((h) => h === w || h.includes(w) || w.includes(h))
    })
    lignes.push({ cle: 'equipements', voulus, presents, ...verdict('features', true) })
  }
  return lignes
}

/** Le premier critère que le moteur dit en écart, ou `null`. */
export function premierEcart(lignes: readonly LigneCritere[]): LigneCritere['cle'] | null {
  return lignes.find((l) => l.ok === false)?.cle ?? null
}

const PROPOSES = new Set(['sent', 'interested', 'rejected', 'visit_planned'])
/** Une visite planifiée suit un « intéressé » (§3.1) : elle compte comme tel. */
const INTERESSES = new Set(['interested', 'visit_planned'])

/** « Déjà reçu » (§4.5) : par contact, ce qui lui a été proposé et ce qui l'a intéressé. */
export function compterHistorique(lignes: readonly { contact_id: string; status: string }[]): Map<string, Historique> {
  const parContact = new Map<string, Historique>()
  for (const l of lignes) {
    if (!PROPOSES.has(l.status)) continue
    const h = parContact.get(l.contact_id) ?? { proposes: 0, interesses: 0 }
    h.proposes++
    if (INTERESSES.has(l.status)) h.interesses++
    parContact.set(l.contact_id, h)
  }
  return parContact
}

/** Initiales d'avatar. */
export function initiales(prenom: string, nom: string): string {
  return `${prenom.trim().charAt(0)}${nom.trim().charAt(0)}`.toUpperCase()
}

/** La ligne « Marché » d'un acheteur (lot 2, §3.2) : un résumé serveur, jamais ses biens un à un. */
export interface FilSelectionResume {
  acheteur: FilMatch['acheteur']
  /** Matchs du marché `suggested`, non reportés, sur une annonce non retirée. */
  nombre: number
  meilleurScore: number
  /** Jusqu'à trois vignettes, du meilleur bien au moins bon. */
  vignettes: string[]
}

const PREFIXE_SELECTION = 'marche:'

/** L'identifiant de la ligne « Marché » d'un acheteur dans l'ordre du fil — distinct de tout id de match. */
export const cleSelection = (contactId: string): string => `${PREFIXE_SELECTION}${contactId}`

/** L'acheteur d'une ligne « Marché », ou `null` pour une ligne de match. */
export const contactDeSelection = (cle: string): string | null =>
  (cle.startsWith(PREFIXE_SELECTION) ? cle.slice(PREFIXE_SELECTION.length) : null)

/**
 * Les lignes « Marché » retenues par les filtres, par meilleur score (§3.2). Un filtre sur un BIEN les
 * écarte toutes : un bien en mandat n'est dans aucune sélection du marché.
 */
export function construireSelections(resumes: readonly FilSelectionResume[], filtres: FilFiltres): FilSelectionResume[] {
  if (filtres.bienId) return []
  const texte = plier(filtres.texte.trim())
  const nom = (s: FilSelectionResume): string => `${s.acheteur.prenom} ${s.acheteur.nom}`
  return resumes
    .filter((s) => s.nombre > 0)
    .filter((s) => !filtres.acheteurId || s.acheteur.id === filtres.acheteurId)
    .filter((s) => !texte || plier(nom(s)).includes(texte))
    .sort((a, b) =>
      b.meilleurScore - a.meilleurScore || b.nombre - a.nombre
      || nom(a).localeCompare(nom(b), 'fr') || a.acheteur.id.localeCompare(b.acheteur.id))
}

/**
 * Une ligne tenue sur un FAIT, pas sur la seule note du moteur. Son verdict dit ✓ dès 0,5 de fraction
 * tenue (`matching-normalize.ts`) : 7 % au-dessus du budget, « Sous le budget minimum » ou un équipement
 * sur deux passent. Pièces et surface sont déjà des faits (`lignesCriteres`) ; zone et type ne cochent
 * que ce que la recherche a nommé.
 */
function tenueSurFaits(l: LigneCritere): boolean {
  if (l.ok !== true) return false
  switch (l.cle) {
    case 'budget': return l.prix != null && (l.min == null || l.prix >= l.min) && (l.max == null || l.prix <= l.max)
    case 'equipements': return l.presents.length === l.voulus.length
    default: return true
  }
}

/**
 * Les critères qu'un bien ne tient PAS en fait (`tenueSurFaits`) : un écart du moteur, un verdict absent,
 * un ✓ qui tolère un écart. Une seule règle pour le pré-cochage ET le résumé d'un bien de la sélection —
 * sans elle, un bien laissé décoché affichait « Aucun écart signalé » (équipements 2 sur 3 sous un ✓).
 */
export function criteresNonTenus(lignes: readonly LigneCritere[]): LigneCritere['cle'][] {
  return lignes.filter((l) => !tenueSurFaits(l)).map((l) => l.cle)
}

/**
 * Les biens cochés d'office dans une sélection (§5) : ceux dont CHAQUE critère posé est tenu, 5 au plus,
 * dans l'ordre reçu. ⛔ Un pré-cochage pousse à la proposition : il ne se fonde que sur des faits — un verdict
 * absent n'est pas tenu, et un ✓ du moteur ne suffit pas là où il tolère un écart (`criteresNonTenus`).
 */
export function precoches(matchs: readonly FilMatch[], max = 5): string[] {
  return matchs
    .filter((m) => {
      const lignes = lignesCriteres(m)
      return lignes.length > 0 && criteresNonTenus(lignes).length === 0
    })
    .slice(0, max)
    .map((m) => m.id)
}
