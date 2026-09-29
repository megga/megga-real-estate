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
 *
 * ⛔ CHAMBRES, ÉTAT, OFF-MARKET (lot C) SONT DES FAITS, comme pièces et surface : le moteur les note sans les
 * écrire dans `reasons` (contrat de cinq clés). Même règle que lui — un critère que le bien ne renseigne pas n'a
 * pas de verdict —, confrontée à `axesComplementaires` par `matching-fil-modele.spec.ts`.
 */
import type { SearchCriteria } from '@/types/contact'
import { splitZones } from '@/lib/contactCriteria'

/**
 * Préfixe des clés de requête du fil : l'invalider rafraîchit aussi les sélections ouvertes et « Aujourd'hui » (le
 * segment Matching, « Pendant ton absence »). Défini ICI, dans le module pur, et ré-exporté par `useMatchingFil` :
 * « Aujourd'hui » l'importe, et `useMatchingFil` tire statiquement le module des gestes (`matchingGestes`) — l'écran
 * mobile le chargeait pour une chaîne.
 */
export const CLE_FIL = 'matching-fil'

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
  /** Lot C. Chambres ; 0 ou absent : inconnues (le wizard écrit 0 pour « non renseigné »). */
  chambres?: number | null
  /** Lot C. L'état saisi sur un mandat (`condition`) ; une annonce du marché n'en porte pas. */
  etatSaisi?: string | null
  anneeConstruction?: number | null
  anneeRenovation?: number | null
  /** Lot C. L'interrupteur de l'agent ; une annonce du marché est publique. */
  offMarket?: boolean
  /** Lot C, signaux : première apparition sur le marché, premier prix, date de la dernière baisse. */
  vuLe?: string | null
  prixInitial?: number | null
  baisseLe?: string | null
  /** Lot C, signal : la signature du mandat ou sa mise en service, la plus récente des deux. */
  mandatLe?: string | null
}

/**
 * Où en est un match dans la boucle chez l'agent (lot B) : proposé, répondu, et ce qui a été consigné.
 * Absent d'un match jamais proposé.
 */
export interface SuiviMatch {
  statut: 'suggested' | 'sent' | 'interested' | 'rejected' | 'visit_planned'
  /** `sent_at` : la proposition (ou la dernière relance consignée). */
  proposeLe: string | null
  /** `response_at` : la PREMIÈRE réponse consignée (trigger `set_match_response_at`). */
  reponduLe: string | null
  /** Le motif d'un refus (`reaction_motif`), un code : `fil.motifs.*` l'écrit. */
  motif: string | null
  note: string | null
  /** Le prix du bien quand il a été proposé (`prix_propose`) : c'est lui qui dit « prix baissé de … ». */
  prixPropose: number | null
  /** `apprentissage_at` : ce refus a déjà nourri une correction de recherche, validée ou ignorée. */
  apprisLe: string | null
}

export interface FilMatch {
  id: string
  score: number
  raisons: RaisonsMoteur | null
  /** Les critères de la recherche qui a produit ce match. */
  criteres: SearchCriteria | null
  creeLe: string | null
  reporteJusquau: string | null
  /** La recherche notée (`client_search_id`) : c'est elle qu'« Apprendre » corrige (lot B). */
  rechercheId?: string | null
  /** La boucle (lot B) ; absent d'un match jamais proposé. */
  suivi?: SuiviMatch
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
  /** Ordre de lecture des lignes, celui de ↑/↓ : chaque groupe s'ouvre sur l'en-tête de son bien (`cleBien`). */
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
  | ({ cle: 'chambres'; min: number; chambres: number | null } & Verdict)
  | ({ cle: 'etat'; voulu: EtatBien; etat: EtatConnu | null } & Verdict)
  | ({ cle: 'offMarket'; offMarket: boolean } & Verdict)

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
export const slug = (s: string): string =>
  (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

/** Horodatage d'une date ISO ; une date absente ou illisible vaut 0, pour que le tri reste total. */
export const temps = (iso: string | null): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

/** Un match retenu par les filtres du fil : le bien, l'acheteur, et le texte (bien, ville, adresse, acheteur). */
export function passeFiltres(m: FilMatch, f: FilFiltres): boolean {
  if (f.bienId && m.bien.id !== f.bienId) return false
  if (f.acheteurId && m.acheteur.id !== f.acheteurId) return false
  const texte = plier(f.texte.trim())
  if (!texte) return true
  return plier([m.bien.titre, m.bien.ville ?? '', m.bien.adresse ?? '', m.acheteur.prenom, m.acheteur.nom].join(' ')).includes(texte)
}

/**
 * Le fil « À traiter » : groupes par bien, reportés à part, compte et ordre de lecture. L'ordre : score
 * décroissant, puis — à score égal — ce qui porte un signal (`signal`, lot C : `aUnSignal` de filSignaux.ts ;
 * absent, aucun), puis le plus récent, puis l'id : un ordre TOTAL, donc une navigation stable. Un groupe se
 * range par son premier match. ⚠ Le comparateur est PASSÉ, pas importé : filSignaux lit ce module.
 * ⚠ Le copilote WhatsApp (lot D2) recopie ce comparateur (`avant`, local, non exporté) dans `vueGetMatches`
 * (`_shared/whatsapp-matching.ts`) : confronté par `tests/unit/whatsapp-matching-fil.spec.ts`, par la sortie
 * publique de `construireFil` puisque `avant` lui-même ne l'est pas.
 */
export function construireFil(
  matchs: readonly FilMatch[], filtres: FilFiltres, maintenant: number, signal: (m: FilMatch) => boolean = () => false,
): FilVue {
  const avant = (a: FilMatch, b: FilMatch): number =>
    b.score - a.score || Number(signal(b)) - Number(signal(a)) || temps(b.creeLe) - temps(a.creeLe) || a.id.localeCompare(b.id)
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
  // L'en-tête de chaque bien ouvre son groupe (« Qui pour ce bien ? », lot C) : une ligne de l'ordre, pas du compte.
  const ordre = groupes.flatMap((g) => [cleBien(g.bien.id), ...g.matchs.map((m) => m.id)])
  return { groupes, reportes, compte: groupes.reduce((n, g) => n + g.matchs.length, 0), ordre }
}

/**
 * Les choix des filtres Bien et Acheteur : chacun une fois, triés par libellé. Les acheteurs des lignes
 * « Marché » (`selections`) en sont aussi : sans eux, un acheteur qui n'a que des biens du marché ne
 * pouvait pas être filtré ; de même ceux de la boucle (`autres`, lot B), qui n'ont peut-être plus rien à
 * proposer. Le filtre Bien ne vise que les biens en mandat : il écarte toutes les lignes « Marché »
 * (`construireSelections`).
 */
export function optionsFiltres(
  matchs: readonly FilMatch[], selections: readonly FilSelectionResume[] = [], autres: readonly FilMatch['acheteur'][] = [],
): { biens: OptionFiltre[]; acheteurs: OptionFiltre[] } {
  const biens = new Map<string, string>()
  const acheteurs = new Map<string, string>()
  for (const m of matchs) {
    biens.set(m.bien.id, m.bien.titre)
    acheteurs.set(m.acheteur.id, `${m.acheteur.prenom} ${m.acheteur.nom}`)
  }
  for (const s of selections) acheteurs.set(s.acheteur.id, `${s.acheteur.prenom} ${s.acheteur.nom}`)
  for (const a of autres) acheteurs.set(a.id, `${a.prenom} ${a.nom}`)
  const trier = (e: Map<string, string>): OptionFiltre[] =>
    [...e].map(([id, libelle]) => ({ id, libelle })).sort((a, b) => a.libelle.localeCompare(b.libelle, 'fr') || a.id.localeCompare(b.id))
  return { biens: trier(biens), acheteurs: trier(acheteurs) }
}

/** La clé de traduction d'un équipement (`fil.equipementsNoms`) : le slug du moteur, sans le préfixe `custom:`. */
export function cleEquipement(brut: string): string {
  return slug(brut.replace(/^custom:/i, ''))
}

/** Les chaînes non vides d'un tableau jsonb — une zone ou un équipement mal saisi n'existe pas. */
export const chaines = (v: unknown): string[] =>
  (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])

/** Détails que le moteur écrit pour un axe INACTIF (aucun critère de son côté) : pas un verdict. */
const INACTIF = new Set(['—', 'Aucun critère'])

/**
 * L'état d'un bien, du moins bon au meilleur, et ses seuils : ceux du moteur (`ETATS_BIEN`, `ANS_NEUF`,
 * `ANS_RENOVE`, `etatDuBien` dans matching-normalize.ts), à l'identique — `matching-fil-modele.spec.ts` les
 * confronte. Neuf : construit il y a 5 ans au plus, ou en chantier ; rénové : il y a 10 ans au plus.
 */
const ETATS = ['to_renovate', 'good', 'renovated', 'new'] as const
type EtatBien = (typeof ETATS)[number]
type EtatConnu = { etat: EtatBien; source: 'saisi' | 'construction' | 'renovation'; annee: number | null }
const ANS_NEUF = 5
const ANS_RENOVE = 10
const ANS_CHANTIER = 5
const estEtat = (v: unknown): v is EtatBien => typeof v === 'string' && (ETATS as readonly string[]).includes(v)
/** L'état MINIMUM qu'une recherche peut poser : « à rénover » n'en est pas un, tout bien le tient (règle du moteur). */
const MINIMUMS: ReadonlySet<EtatBien> = new Set(['good', 'renovated', 'new'])

/** L'état d'un bien, ou `null` : ⛔ jamais « bon état » ni « à rénover » déduit d'une date. */
function etatDuBien(b: FilBien, annee: number): EtatConnu | null {
  if (estEtat(b.etatSaisi)) return { etat: b.etatSaisi, source: 'saisi', annee: null }
  const construit = b.anneeConstruction
  if (construit != null && construit > 0 && construit >= annee - ANS_NEUF && construit <= annee + ANS_CHANTIER) {
    return { etat: 'new', source: 'construction', annee: construit }
  }
  const renove = b.anneeRenovation
  if (renove != null && renove > 0 && renove >= annee - ANS_RENOVE && renove <= annee) {
    return { etat: 'renovated', source: 'renovation', annee: renove }
  }
  return null
}

/**
 * Les lignes « Recherché / Ce bien » : une par critère que la recherche a posé (§4.4).
 * ⚠ Recopiée par le copilote WhatsApp (lot D2, `expliquer` dans `_shared/whatsapp-matching.ts`), confrontée par
 * `tests/unit/whatsapp-matching-fil.spec.ts`.
 */
export function lignesCriteres(m: FilMatch, maintenant: number = Date.now()): LigneCritere[] {
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
  // Lot C. ⛔ UN FAIT, comme les pièces, à la règle du MOTEUR : 0 chambre n'est pas une valeur, et un critère
  // que le bien ne renseigne pas n'a pas de verdict — il n'a pas compté dans la note.
  if (typeof c.bedrooms_min === 'number' && c.bedrooms_min > 0) {
    const n = m.bien.chambres != null && m.bien.chambres > 0 ? m.bien.chambres : null
    lignes.push({ cle: 'chambres', min: c.bedrooms_min, chambres: n, ecart: null, ok: n == null ? null : n >= c.bedrooms_min })
  }
  if (c.surface_min != null) {
    const s = m.bien.surface
    lignes.push({ cle: 'surface', min: c.surface_min, surface: s, ok: s == null ? null : s >= c.surface_min, ecart: null })
  }
  if (estEtat(c.condition_min) && MINIMUMS.has(c.condition_min)) {
    const voulu = c.condition_min
    const e = etatDuBien(m.bien, new Date(maintenant).getUTCFullYear())
    lignes.push({ cle: 'etat', voulu, etat: e, ecart: null, ok: e == null ? null : ETATS.indexOf(e.etat) >= ETATS.indexOf(voulu) })
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
  // Off-market : toujours évalué — un mandat porte son interrupteur, une annonce du marché est publique.
  if (c.off_market_only === true) {
    const off = m.bien.offMarket === true
    lignes.push({ cle: 'offMarket', offMarket: off, ecart: null, ok: off })
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
  /** Lot C : ses annonces nouvelles (3 jours) et en baisse (14 jours), comptées par la base. */
  nouveaux?: number
  baisses?: number
}

const PREFIXE_BIEN = 'bien:'

/** La ligne « Qui pour ce bien ? » d'un bien en mandat (lot C) : son en-tête, dans l'ordre du fil. */
export const cleBien = (bienId: string): string => `${PREFIXE_BIEN}${bienId}`

/** Le bien d'un en-tête, ou `null` pour toute autre ligne. */
export const bienDeCle = (cle: string): string | null => (cle.startsWith(PREFIXE_BIEN) ? cle.slice(PREFIXE_BIEN.length) : null)

const PREFIXE_SELECTION = 'marche:'

/** L'identifiant de la ligne « Marché » d'un acheteur dans l'ordre du fil — distinct de tout id de match. */
export const cleSelection = (contactId: string): string => `${PREFIXE_SELECTION}${contactId}`

/** L'acheteur d'une ligne « Marché », ou `null` pour une ligne de match. */
export const contactDeSelection = (cle: string): string | null =>
  (cle.startsWith(PREFIXE_SELECTION) ? cle.slice(PREFIXE_SELECTION.length) : null)

/** Une ligne « Marché » porte un signal (lot C) : une annonce nouvelle ou en baisse. */
const aDesSignaux = (s: FilSelectionResume): boolean => (s.nouveaux ?? 0) + (s.baisses ?? 0) > 0

/**
 * Les lignes « Marché » retenues par les filtres, par meilleur score, puis, à score égal, celles qui portent
 * un signal (lot C). Un filtre sur un BIEN les écarte toutes : un bien en mandat n'est dans aucune sélection
 * du marché.
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
      b.meilleurScore - a.meilleurScore || Number(aDesSignaux(b)) - Number(aDesSignaux(a)) || b.nombre - a.nombre
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

// Les aides de LECTURE, pures : le fil (`useMatchingFil`) et les surfaces du lot D1 — « Sa boucle », « Qui pour ce
// bien ? » — les partagent. Elles vivent ici, pas dans un module de hook : `useMatchingFil` tire statiquement
// le module des gestes (`matchingGestes`), et une fiche n'a pas à le charger pour lire une ligne.

/**
 * Les lignes d'une lecture PostgREST (ou du banc) ; son erreur est LEVÉE, pour que TanStack la tienne pour un échec.
 * Pur : il attend la requête qu'on lui passe, sans importer de client.
 */
export async function lire<T>(requete: PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const { data, error } = await requete
  if (error) throw error
  return (data ?? []) as T[]
}

/** Un nombre lu en base (`numeric` arrive en chaîne) ; `null` s'il n'en est pas un. */
export const nombreOuNull = (v: number | string | null): number | null => {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return Number.isFinite(n) ? n : null
}

/**
 * Les équipements d'un bien : un tableau de chaînes, ou un objet `{ equipement: vrai }`.
 * ⚠ Recopiée par le copilote (`whatsapp-matching.ts`, qui ne peut pas importer `src/` — sa propre copie, privée,
 * y vit à côté de `bienDAnnonce`/`bienDeMandat`) ; `tests/unit/whatsapp-matching-fil.spec.ts` l'appelle (via
 * `versBien`/`versBienMarche`) pour confronter les deux formes.
 */
export function listeEquipements(brut: unknown): string[] {
  if (Array.isArray(brut)) return brut.filter((f): f is string => typeof f === 'string')
  if (brut && typeof brut === 'object') {
    return Object.entries(brut as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k)
  }
  return []
}

/** La vignette d'une annonce : `photos_cf` porte des URL en chaîne OU des objets `{thumb, …}`, sinon `photos`. */
export function photoAnnonce(cf: unknown, photos: string[] | null): string | null {
  const premier: unknown = Array.isArray(cf) ? cf[0] : undefined
  if (typeof premier === 'string' && premier) return premier
  if (premier && typeof premier === 'object') {
    const thumb = (premier as Record<string, unknown>).thumb
    if (typeof thumb === 'string' && thumb) return thumb
  }
  return photos?.find((p) => typeof p === 'string' && p !== '') ?? null
}
