// Le matching dans le copilote WhatsApp (lot D2, étape 4b) — modèle PUR : ni Supabase, ni réseau, ni API Deno.
//
// Conception : docs/superpowers/specs/2026-09-24-matching-lot-d2-whatsapp-design.md (§3, §5).
// Testé sous Vitest (`whatsapp-matching.test.ts`, dans l'allowlist de vitest.config.ts) et CONFRONTÉ aux règles du
// CRM par `tests/unit/whatsapp-matching-fil.spec.ts` : les statuts « compatibles », les motifs de refus, les seuils
// des signaux, l'état d'un acheteur et l'explication du score existent déjà dans le fil (`src/components/matching-fil/`).
// Ce module ne peut pas les importer — le bundle Vite et le runtime Deno ne partagent pas `@/` — : il les recopie, et
// la spec rougit au premier écart.
//
// ⛔ Rien ici n'écrit à l'acheteur : ces fonctions rangent, désignent et décrivent ce que l'agent consigne.
// ⚠ Les annonces du marché (`market_listings`) sont PUBLIQUES — un marché national partagé par toutes les agences,
// jamais scopées par `agency_id` (contrairement aux mandats, `properties`). Une annonce se lit donc par son id SEUL ;
// ce qui la rattache à UNE agence, c'est un match compatible qui la cite — jamais une colonne sur la ligne elle-même.

import { ETATS_BIEN, etatDuBien, slugify, type EtatBien } from './matching-normalize.ts'
import { fmtCHF } from './morning-brief.ts'

/** Les statuts d'un acquéreur COMPATIBLE, ceux qu'un refus n'a pas écartés. ⚠ Copie de `STATUTS_COMPATIBLES` (filQuiPour.ts). */
export const STATUTS_COMPATIBLES = ['suggested', 'sent', 'interested', 'visit_planned'] as const
/** Les biens EN COURS pour un acheteur : proposés, intéressés, en visite. */
export const STATUTS_EN_COURS = ['sent', 'interested', 'visit_planned'] as const
/**
 * Les motifs d'un refus, dans l'ordre du fil. ⚠ Copie de `MOTIFS_REFUS` (filBoucle.ts) ; sans `recherche_ajustee`,
 * qui n'est pas une réponse de l'acheteur.
 */
export const MOTIFS_REFUS = ['prix', 'quartier', 'surface', 'pieces', 'type', 'equipements', 'etat', 'autre'] as const
export type MotifRefus = (typeof MOTIFS_REFUS)[number]
/** Les seuils des signaux, en jours. ⚠ Ceux de `filSignaux.ts`, et du SQL des lots C et D1. */
export const JOURS_NOUVEAU = 3
export const JOURS_BAISSE = 14
export const JOURS_MANDAT = 7
const JOUR = 86_400_000

/** Les réponses que `record_match_outcome` consigne (conception §5.3). */
export const REPONSES = ['propose', 'interesse', 'pas_interesse', 'pas_encore'] as const
export type Reponse = (typeof REPONSES)[number]
/** Le statut que chaque réponse suppose : le bien se cherche parmi ces matchs, et la base le revérifie à l'écriture. */
export const STATUTS_DE_DEPART: Readonly<Record<Reponse, readonly string[]>> = {
  propose: ['suggested'],
  interesse: ['sent'],
  pas_interesse: ['sent', 'interested'],
  pas_encore: ['sent'],
}
/**
 * Le statut que chaque réponse ÉCRIT sur le match (`wa_matching_consigner`) ; « pas encore » n'en écrit aucun, il
 * repousse la relance. Quand la base n'écrit rien (`deja`), il sépare « déjà consignée » (le match porte ce statut)
 * de « le bien a changé entre-temps » (un autre).
 */
export const STATUT_D_ARRIVEE: Readonly<Record<Reponse, string | null>> = {
  propose: 'sent',
  interesse: 'interested',
  pas_interesse: 'rejected',
  pas_encore: null,
}

export const estReponse = (v: unknown): v is Reponse => typeof v === 'string' && (REPONSES as readonly string[]).includes(v)
export const estMotif = (v: unknown): v is MotifRefus => typeof v === 'string' && (MOTIFS_REFUS as readonly string[]).includes(v)

/** Un nombre lu en base (`numeric` arrive en chaîne) ; `null` s'il n'en est pas un. */
export function nombreOuNull(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

/** Horodatage d'une date ISO ; absente ou illisible, 0 — pour que les tris restent totaux. */
const temps = (iso: string | null | undefined): number => {
  const t = iso ? Date.parse(iso) : NaN
  return Number.isFinite(t) ? t : 0
}

/** Les chaînes non vides d'un tableau jsonb : une zone ou un équipement mal saisi n'existe pas. */
const chaines = (v: unknown): string[] =>
  (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])

/** Les équipements d'un bien : un tableau de chaînes, ou un objet `{ equipement: vrai }`. */
function listeEquipements(brut: unknown): string[] {
  if (Array.isArray(brut)) return brut.filter((f): f is string => typeof f === 'string')
  if (brut && typeof brut === 'object') {
    return Object.entries(brut as Record<string, unknown>).filter(([, v]) => Boolean(v)).map(([k]) => k)
  }
  return []
}

/** Une date en clair, à la suisse (jour.mois.année), fuseau de Zurich. */
export function dateSuisse(iso: string | null | undefined): string | null {
  if (!iso || !Number.isFinite(Date.parse(iso))) return null
  return new Intl.DateTimeFormat('fr-CH', { timeZone: 'Europe/Zurich', day: '2-digit', month: '2-digit', year: 'numeric' })
    .format(new Date(iso))
}

// ── Les lignes lues ─────────────────────────────────────────────────────────

/** Les colonnes d'un match que le copilote lit. `created_at` départage « à proposer », comme `construireFil` (filModele.ts). */
export const COLONNES_MATCH =
  'id, contact_id, status, score, reasons, client_search_id, property_id, market_listing_id, snoozed_until, sent_at, response_at, reaction_motif, reaction_note, prix_propose, created_at'
export interface LigneMatch {
  id: string
  contact_id: string
  status: string
  score: number | string | null
  reasons: unknown
  client_search_id: string | null
  property_id: string | null
  market_listing_id: string | null
  snoozed_until: string | null
  sent_at: string | null
  response_at: string | null
  reaction_motif: string | null
  reaction_note: string | null
  prix_propose: number | string | null
  created_at: string | null
}

/** Les colonnes d'un mandat. ⚠ `properties` n'a ni `year_renovated` ni colonne de référence. */
export const COLONNES_MANDAT =
  'id, title, type, transaction_type, price, rooms, surface_m2, bedrooms, address, city, canton, features, condition, year_built, off_market, mandate_signed_at, published_at, status'
export interface LigneMandat {
  id: string
  title: string | null
  type: string | null
  transaction_type: string | null
  price: number | string | null
  rooms: number | string | null
  surface_m2: number | string | null
  bedrooms: number | string | null
  address: string | null
  city: string | null
  canton: string | null
  features: unknown
  condition: string | null
  year_built: number | string | null
  off_market: boolean | null
  mandate_signed_at: string | null
  published_at: string | null
  status: string | null
}

/** Les colonnes d'une annonce du marché. */
export const COLONNES_ANNONCE =
  'id, title, type, transaction_type, price, current_price, rooms, surface_m2, bedrooms, address, city, canton, features, year_built, year_renovated, first_seen_at, price_at_first_seen, price_reduced_at, status'
export interface LigneAnnonce {
  id: string
  title: string | null
  type: string | null
  transaction_type: string | null
  price: number | string | null
  current_price: number | string | null
  rooms: number | string | null
  surface_m2: number | string | null
  bedrooms: number | string | null
  address: string | null
  city: string | null
  canton: string | null
  features: unknown
  year_built: number | string | null
  year_renovated: number | string | null
  first_seen_at: string | null
  price_at_first_seen: number | string | null
  price_reduced_at: string | null
  status: string | null
}

/** Un bien, tel que le copilote le lit : un mandat de l'agence ou une annonce du marché. */
export interface BienWa {
  id: string
  genre: 'mandat' | 'annonce'
  titre: string
  prix: number | null
  location: boolean
  type: string | null
  pieces: number | null
  surface: number | null
  chambres: number | null
  ville: string | null
  canton: string | null
  adresse: string | null
  equipements: string[]
  offMarket: boolean
  /** Ce que lit `etatDuBien` du moteur : l'état saisi (mandat) et les années. */
  brutEtat: Record<string, unknown>
  /** Une ÉTIQUETTE, montrée à l'agent : une annonce `removed`, un mandat `sold` ou `archived`. Ne dit pas si le bien
   *  peut encore être proposé — voir `occasion`, une règle SÉPARÉE. */
  retire: boolean
  /**
   * L'ÉLIGIBILITÉ à « à proposer » et aux reportés — distincte de `retire` : une annonce non retirée ; un mandat
   * SEULEMENT `active` (`draft` et `reserved` en sont exclus SANS être dits « retirés »). Règle du point du matin de
   * ce même copilote (`matching_actions_agence`, migration 20260924200000 : « un mandat vendu, retiré ou supprimé
   * n'est plus une occasion »). ⚠ DIFFÈRE du fil, qui garde tous les mandats quel que soit leur statut — à confirmer
   * par Julien avant de la généraliser ailleurs (décision 12, lot D1).
   */
  occasion: boolean
  /** Le statut BRUT d'un mandat (`draft`, `active`, `reserved`, `sold`, `archived`) ; `null` pour une annonce, qui
   *  n'en a pas de comparable — `retire` suffit à l'expliquer. Lu par `bienEnClair` pour dire POURQUOI un mandat
   *  n'est pas une occasion (sous offre, brouillon) quand `occasion: false` seul ne le dirait pas. */
  statutMandat: string | null
  /** Les signaux : apparition et baisse d'une annonce, signature ou mise en service d'un mandat. */
  vuLe: string | null
  prixInitial: number | null
  baisseLe: string | null
  mandatLe: string | null
}

/** La plus récente de deux dates ISO ; l'une absente, l'autre. */
const plusRecente = (a: string | null, b: string | null): string | null => {
  if (!a || !b) return a ?? b
  return Date.parse(a) >= Date.parse(b) ? a : b
}

/**
 * Le titre qu'un bien affiche : son titre rogné, sinon son adresse, sinon sa ville ; `null` s'il n'a aucun des trois.
 * `bienDeMandat` et `bienDAnnonce` y ajoutent leur générique (« Bien », « Annonce ») pour l'affichage ; `candidats`
 * bâtit sur ce titre SANS générique le libellé auquel il compare un texte — aucun texte ne doit désigner un bien
 * sans nom.
 */
export function titreAffiche(b: { titre: string | null; adresse: string | null; ville: string | null }): string | null {
  return b.titre?.trim() || b.adresse?.trim() || b.ville?.trim() || null
}

/** Un mandat, dans la forme du copilote — la règle de `versBien` (useMatchingFil.ts). */
export function bienDeMandat(l: LigneMandat): BienWa {
  return {
    id: l.id, genre: 'mandat', titre: titreAffiche({ titre: l.title, adresse: l.address, ville: l.city }) ?? 'Bien',
    prix: nombreOuNull(l.price), location: l.transaction_type === 'rent', type: l.type,
    pieces: nombreOuNull(l.rooms), surface: nombreOuNull(l.surface_m2), chambres: nombreOuNull(l.bedrooms),
    ville: l.city, canton: l.canton, adresse: l.address, equipements: listeEquipements(l.features),
    offMarket: l.off_market === true,
    brutEtat: { condition: l.condition, year_built: l.year_built },
    // L'ÉTIQUETTE « retiré » ne dit que ceci : le mandat a quitté le marché pour de bon (vendu, archivé). Elle ne
    // dit pas s'il reste une occasion — `occasion`, juste en dessous, tranche cette question séparément.
    retire: l.status === 'sold' || l.status === 'archived',
    // ÉLIGIBILITÉ, pas étiquette : seul un mandat `active` est une occasion (règle de `matching_actions_agence`,
    // migration 20260924200000 : « un mandat vendu, retiré ou supprimé n'est plus une occasion »). `draft` (pas
    // publié) et `reserved` (sous offre) en sont donc exclus SANS être dits « retirés » — ils gardent leur place en
    // cours s'ils y sont déjà. Cette règle DIFFÈRE du fil, qui garde tous les mandats quel que soit leur statut : à
    // confirmer par Julien avant de la généraliser (décision 12, lot D1).
    occasion: l.status === 'active',
    statutMandat: l.status,
    vuLe: null, prixInitial: null, baisseLe: null,
    // `mandate_signed_at` n'est posé que par « Nouveau bien » : la mise en service date aussi un nouveau mandat.
    mandatLe: plusRecente(l.mandate_signed_at, l.published_at),
  }
}

/** Une annonce du marché, dans la forme du copilote — la règle de `versBienMarche` (useMatchingFil.ts). */
export function bienDAnnonce(l: LigneAnnonce): BienWa {
  return {
    id: l.id, genre: 'annonce', titre: titreAffiche({ titre: l.title, adresse: l.address, ville: l.city }) ?? 'Annonce',
    prix: nombreOuNull(l.current_price) ?? nombreOuNull(l.price), location: l.transaction_type === 'rent', type: l.type,
    pieces: nombreOuNull(l.rooms), surface: nombreOuNull(l.surface_m2), chambres: nombreOuNull(l.bedrooms),
    ville: l.city, canton: l.canton, adresse: l.address, equipements: listeEquipements(l.features),
    // Une annonce du marché est publique par définition.
    offMarket: false,
    brutEtat: { year_built: l.year_built, year_renovated: l.year_renovated },
    retire: l.status === 'removed',
    // Pour une annonce, l'étiquette et l'éligibilité coïncident : retirée du marché, elle n'est plus une occasion.
    occasion: l.status !== 'removed',
    statutMandat: null,
    vuLe: l.first_seen_at, prixInitial: nombreOuNull(l.price_at_first_seen), baisseLe: l.price_reduced_at, mandatLe: null,
  }
}

/** Le prix d'un bien en clair : CHF à apostrophe, « /mois » pour une location ; `null` pour un prix sur demande. */
export function prixEnClair(b: Pick<BienWa, 'prix' | 'location'>): string | null {
  return b.prix != null && b.prix > 0 ? `${fmtCHF(b.prix)}${b.location ? '/mois' : ''}` : null
}

/**
 * « /mois » sur un texte DÉJÀ ÉCRIT (une borne, un montant de signal, un prix refusé) pour une location — la même
 * marque que `prixEnClair`, mais WYSIWYG : n'ajoute rien à un texte qui la porte déjà.
 */
const avecLoyer = (texte: string, location: boolean): string => (location && !texte.endsWith('/mois') ? `${texte}/mois` : texte)

// ── Où en est un acheteur ───────────────────────────────────────────────────

/** L'état d'un match, pour le copilote. Les dates et les prix sont déjà écrits : le modèle n'a rien à convertir. */
export type EtatAcheteur =
  | { code: 'reporte'; jusqua: string | null }
  | { code: 'a_proposer' }
  | { code: 'revenu'; refuse_a: string }
  | { code: 'propose'; le: string | null }
  | { code: 'interesse' }
  | { code: 'visite' }
  | { code: 'refuse'; motif: MotifRefus | null }

/**
 * Où en est un match, à l'heure de la lecture — la règle de `etatCompatible` (filQuiPour.ts), confrontée.
 * ⚠ Le report ne vaut que pour un match À PROPOSER (`versCompatible`) : `snoozed_until` s'écrit sans regarder le statut.
 */
export function etatMatch(
  m: Pick<LigneMatch, 'status' | 'snoozed_until' | 'sent_at' | 'reaction_motif' | 'prix_propose'>,
  maintenant: number,
): EtatAcheteur {
  if (m.status === 'suggested' && m.snoozed_until && temps(m.snoozed_until) > maintenant) {
    return { code: 'reporte', jusqua: dateSuisse(m.snoozed_until) }
  }
  const prixPropose = nombreOuNull(m.prix_propose)
  if (m.status === 'suggested') {
    // Un bien refusé pour le prix et revenu par une baisse garde son motif et son prix de proposition (lot B).
    return m.reaction_motif === 'prix' && prixPropose != null ? { code: 'revenu', refuse_a: fmtCHF(prixPropose) } : { code: 'a_proposer' }
  }
  if (m.status === 'sent') return { code: 'propose', le: dateSuisse(m.sent_at) }
  if (m.status === 'interested') return { code: 'interesse' }
  if (m.status === 'visit_planned') return { code: 'visite' }
  return { code: 'refuse', motif: estMotif(m.reaction_motif) ? m.reaction_motif : null }
}

// ── Un bien désigné par un message ──────────────────────────────────────────

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MOTS_VIDES = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du', 'au', 'aux', 'en', 'et', 'ou', 'pour', 'sur', 'avec', 'chez',
  'the', 'an', 'of', 'in', 'at', 'on', 'for', 'with', 'to', 'bien', 'biens', 'property', 'properties',
])
/**
 * Un mot NUMÉRIQUE d'un texte — un entier, ou un décimal que `jetonsFins` a gardé d'un bloc (« 4.5 ») : il ne se
 * compare qu'en mot ENTIER, où qu'il soit — un numéro de rue dans l'adresse, des pièces ou un étage dans le titre ; il
 * n'est jamais pris pour le début d'un autre (« 4 » ne désigne pas le n° 40) : voir `candidats`.
 */
const NUMERIQUE = /^\d+(?:\.\d+)*$/

/**
 * Les ligatures dépliées avant `slugify`, comme `plier` du fil (filModele.ts) : « Vandœuvres » se retrouve en
 * tapant « vandoeuvres ». Appliqué des DEUX côtés (le texte du message, les mots du bien) : sinon l'un des deux
 * porte encore la ligature et la comparaison échoue.
 */
const plierLigatures = (s: string): string =>
  s.replace(/œ/g, 'oe').replace(/Œ/g, 'OE').replace(/æ/g, 'ae').replace(/Æ/g, 'AE')

/**
 * La fraction d'une taille écrite en décimal, derrière son chiffre : « 4½ » et « 4 ½ » deviennent « 4.5 », comme
 * « ¼ » « .25 » et « ¾ » « .75 » — sans quoi « 4½ pièces » et « 4.5 pièces » seraient deux tailles. Une fraction
 * isolée reste un séparateur : elle n'a pas de partie entière que la base retrouverait (`motsDe`).
 */
const FRACTIONS: Readonly<Record<string, string>> = { '½': '.5', '¼': '.25', '¾': '.75' }
const plierFractions = (s: string): string =>
  s.replace(/(\d)\s*([½¼¾])/g, (_, chiffre: string, fraction: string) => `${chiffre}${FRACTIONS[fraction]}`)

/** Un texte plié comme les mots d'un bien : ligatures dépliées, puis `slugify` (sans accents, minuscules, tirets). */
const plie = (s: string): string => slugify(plierLigatures(s))
/** Un mot qui désigne : deux signes au moins, ou un nombre ; jamais un mot vide. */
const utile = (m: string): boolean => (m.length >= 2 || NUMERIQUE.test(m)) && !MOTS_VIDES.has(m)

/**
 * Les jetons d'un texte, tels que `candidats` les compare DES DEUX CÔTÉS (le message et le bien) : ligatures et
 * fractions dépliées, sans accents, en minuscules, coupés à tout ce qui n'est ni lettre ni chiffre — sauf un NOMBRE à
 * séparateur (« 4.5 », « 3,5 », « 4½ », « 1.200.000 »), qui reste UN jeton, écrit au point. Découpé, « le 4.5 pièces
 * de Carouge » désignerait un « 5.5 pièces » au n° 4, et « 4 pièces » un « 4.5 pièces ».
 */
const jetonsFins = (s: string): string[] =>
  (plierFractions(plierLigatures(s)).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/\d+(?:[.,]\d+)+|[a-z0-9]+/g) ?? [])
    .map((j) => j.replace(/,/g, '.'))

/**
 * Les mots qui désignent un bien dans un message, tels que la BASE les reçoit : ceux que `candidats` compare
 * (`jetonsFins`, sans mot vide), un nombre à séparateur réduit à sa partie ENTIÈRE — « 4.5 » n'envoie que « 4 », que
 * « 4.5 », « 4,5 » et « 4½ » contiennent tous, quand « 5 » manquerait à « 4½ ». La base garde un bien dont le texte
 * — titre, adresse et ville bout à bout — CONTIENT chacun de ces mots : tout bien que `candidats` garde les contient,
 * et elle en rend donc un sur-ensemble. Un chiffre compte quelle que soit sa longueur ; un mot de plus ne peut que
 * resserrer ce qu'un texte désigne.
 */
export function motsDe(texte: string): string[] {
  return jetonsFins(texte).filter(utile).map((m) => (NUMERIQUE.test(m) ? m.split('.')[0] : m))
}

/**
 * Un texte plié sans ses mots vides ni ses lettres isolées DE TÊTE (« l-attique-4-p… » devient « attique-4-p… ») :
 * un article devant l'écho d'un libellé ne le rend pas méconnaissable. Retirés des deux côtés, pour qu'un titre qui
 * commence lui-même par un article (« Le Clos des Vignes ») reste égal à son écho.
 */
function sansTete(texte: string): string {
  const j = texte.split('-')
  let i = 0
  while (i < j.length && (MOTS_VIDES.has(j[i]) || /^[a-z]$/.test(j[i]))) i++
  return j.slice(i).join('-')
}

/**
 * Les jetons de `partie` se suivent, tous, dans `tout` : « Rue de la Paix 3 » est dans « Attique Rue de la Paix 3 »,
 * pas dans « … Rue de la Paix 32 ». Une partie sans jeton n'ajoute rien à `tout`.
 */
function dansLaSuite(tout: readonly string[], partie: readonly string[]): boolean {
  if (partie.length === 0) return true
  for (let i = 0; i + partie.length <= tout.length; i++) {
    if (partie.every((j, k) => tout[i + k] === j)) return true
  }
  return false
}

/** Le séparateur d'un libellé (« titre · adresse ») : c'est lui qui fait d'un texte l'ÉCHO d'un libellé (`estEcho`). */
const SEPARATEUR = '·'

/**
 * Un bien nommé à l'agent, jamais par son seul titre : deux annonces « Appartement 4 p. » sont indiscernables sans
 * lui, et l'agent pourrait confirmer le mauvais bien sans le voir. L'adresse qualifie le titre, sauf s'il la porte
 * déjà, jeton pour jeton et à la suite (`dansLaSuite`) — jamais par sous-chaîne : « Rue de la Paix 3 » ne se perd pas
 * derrière un titre « … Rue de la Paix 32 ». Sans adresse, la ville, sauf si le titre EST la ville (une annonce sans
 * titre ni adresse s'affiche par sa ville : « Genève », jamais « Genève · Genève ») ; un titre qui la CONTIENT la
 * garde — « Villa de Cologny · Cologny » est l'écho qui la distingue de « Villa de Cologny avec piscine · Cologny »,
 * et « Sion » ne disparaît pas dans « vision ». Une adresse ou une ville vide, faite d'espaces ou de ponctuation
 * seule, n'existe pas : elle écrirait « Studio ·    » ou « Studio · — ».
 */
export function libelleBien(b: Pick<BienWa, 'titre' | 'adresse' | 'ville'>): string {
  const titre = b.titre.trim()
  const adresse = b.adresse?.trim() || null
  const ville = b.ville?.trim() || null
  if (adresse && !dansLaSuite(jetonsFins(titre), jetonsFins(adresse))) return `${titre} ${SEPARATEUR} ${adresse}`
  if (ville && plie(ville) && plie(ville) !== plie(titre)) return `${titre} ${SEPARATEUR} ${ville}`
  return titre
}

/**
 * Un ÉCHO : un texte qui porte le séparateur d'un libellé — le modèle recopie ce que le copilote a nommé. Seul un
 * écho se compare au libellé entier (`candidats`) : « studio rue du Lac 2 », tapé ou reformulé, se plie comme le
 * libellé « Studio · Rue du Lac 2 », mais ses mots désignent aussi « Studio lumineux · Rue du Lac 2 ».
 * ⚠ Le « · » est un INDICE, pas une preuve : un titre peut le porter lui-même. Mesuré en production le 25.09.2026 :
 * 98 annonces du marché ont un « · » dans leur titre (31 encore en ligne), aucune n'est suivie par un match, et aucun
 * mandat n'en a. Recopié, un tel titre peut égaler le libellé d'un AUTRE bien — « Attique · Route de Florissant 12 »,
 * titre de l'un, est le libellé de l'« Attique » voisine : `candidats` n'applique donc pas l'égalité quand le texte
 * est aussi le titre d'un bien qu'elle écarterait.
 */
export const estEcho = (texte: string): boolean => texte.includes(SEPARATEUR)

/**
 * Le plafond d'un ÉCHO relu par `record_match_outcome` (whatsapp-matching-outils.ts) : sa désignation, coupée à 50
 * biens, est relue jusqu'à 200 biens de l'acheteur, à LIMITE+1 comme toute lecture — 201 lignes, exactement le
 * plafond de `wa_matching_biens_de_l_acheteur` (migration `…_matching_whatsapp.sql`, §6), que
 * `tests/unit/matching-whatsapp-sql.spec.ts` confronte à cette constante. Un écho se désigne par l'égalité exacte,
 * mais la base n'en reçoit que les mots (`motsDe`) : chez un acheteur qui a 1 142 matchs `suggested` (mesuré le
 * 25.09.2026), un libellé fait de mots courants peut en désigner plus de 50. « Donne l'adresse » n'y aurait pas de
 * réponse : le texte EST un libellé, 252 des 1 800 annonces que suit l'agence WhatsApp n'ont pas d'adresse, et 410 de
 * ces 1 800 (23 %) partagent leur libellé avec une autre (mesuré le même jour).
 */
export const LIMITE_ECHO = 200

/**
 * Ce qu'un message peut dire d'un bien, tel que la base le rend (`wa_matching_biens_designes`,
 * `wa_matching_biens_de_l_acheteur`) : un titre peut y être NULL ou fait d'espaces. ⚠ Un `BienWa` s'y range par sa
 * forme, mais son titre porte déjà le générique de l'affichage (« Bien », « Annonce »), que `candidats` ne doit pas
 * voir : ce sont les colonnes de la base qu'on lui passe.
 */
export interface Designable { id: string; titre: string | null; adresse: string | null; ville: string | null }

/**
 * Les biens qu'un texte désigne, dans cet ordre — le copilote ne choisit jamais entre plusieurs (conception §3) :
 * 1. un identifiant désigne son bien seul ;
 * 2. un ÉCHO (`estEcho` : le texte porte le « · » d'un libellé) ÉGAL au LIBELLÉ d'un bien — `libelleBien` bâti sur
 *    son titre affiché (`titreAffiche`), plié des deux côtés, sans mot vide ni lettre isolée de tête (`sansTete` :
 *    « l'Attique 4 p. · … ») — désigne ce bien, et tous ceux qui portent le même. C'est ce que le copilote nomme dans
 *    ses questions et ses refus, et que le modèle lui redonne au tour suivant : l'adresse y départage deux biens au
 *    même titre. ⛔ Sans « · », pas d'égalité : « studio rue du Lac 2 » se plie comme le libellé « Studio · Rue du
 *    Lac 2 », mais ses mots désignent aussi « Studio lumineux · Rue du Lac 2 » ; et jamais le titre nu, qu'un titre
 *    générique (« Studio ») ferait choisir parmi « Studio » et « Studio lumineux ». ⛔ Ni quand le texte est AUSSI le
 *    titre affiché, plié de même, d'un bien que l'égalité écarterait : un titre qui porte son propre « · » (`estEcho`)
 *    désignerait seul, recopié, le bien voisin dont c'est le libellé — les mots, alors, et le copilote demande.
 *    ⚠ Risque ACCEPTÉ : le modèle peut écrire à la manière du copilote un libellé qu'il n'a jamais lu (« Studio ·
 *    Carouge » pour « le studio de Carouge ») ; un bien dont c'est exactement le libellé est alors désigné seul, là
 *    où les mots en rendraient plusieurs ;
 * 3. sinon TOUS les mots du texte (`jetonsFins`, sans mots vides), dans le titre, l'adresse ou la ville : un mot est
 *    entier, ou le début d'un mot à partir de quatre lettres (« attiq » pour « attique ») ; un mot NUMÉRIQUE est
 *    toujours entier, jamais pris pour le début d'un autre (« 4 » ne désigne pas « 40 », ni « 4.5 »), où qu'il soit.
 *    L'écho nu d'un titre à chiffres (« Attique 4 p. ») se retrouve ainsi, comme « le 4.5 pièces de Carouge ».
 *    Mesuré le 25.09.2026 sur l'agence WhatsApp : 1 184 de ses 1 806 biens désignables (ses mandats et les annonces
 *    qu'elle suit) portent un chiffre dans leur titre, et 22 seulement se retrouveraient par leur propre titre si un
 *    nombre ne se comparait qu'à l'adresse.
 *    « Florissant 4 », avec un bien au n° 4 et l'« Attique 4 p. » au n° 12, les rend tous deux, et le copilote
 *    demande ; sans bien au n° 4, l'attique seule, nommée par son libellé — la question [Oui] [Non] de
 *    `record_match_outcome` et la réponse de `get_buyers_for_property` montrent son adresse. C'est voulu : une
 *    désignation qui en rend plusieurs demande, elle ne choisit jamais.
 * Aucun mot utile : aucun bien.
 */
export function candidats<T extends Designable>(biens: readonly T[], texte: string): T[] {
  const t = texte.trim()
  if (UUID.test(t)) return biens.filter((b) => b.id.toLowerCase() === t.toLowerCase())
  const cherche = estEcho(t) ? sansTete(plie(t)) : ''
  if (cherche) {
    const egaux = biens.filter((b) => {
      const titre = titreAffiche(b)
      return titre != null && sansTete(plie(libelleBien({ titre, adresse: b.adresse, ville: b.ville }))) === cherche
    })
    const retenus = new Set<T>(egaux)
    const titreDUnEcarte = biens.some((b) => {
      const titre = titreAffiche(b)
      return !retenus.has(b) && titre != null && sansTete(plie(titre)) === cherche
    })
    if (egaux.length > 0 && !titreDUnEcarte) return egaux
  }
  const mots = jetonsFins(t).filter(utile)
  if (mots.length === 0) return []
  return biens.filter((b) => {
    const siens = jetonsFins([b.titre, b.adresse, b.ville].filter(Boolean).join(' '))
    return mots.every((m) => siens.some((s) => s === m || (!NUMERIQUE.test(m) && m.length >= 4 && s.startsWith(m))))
  })
}

// ── Le score expliqué ───────────────────────────────────────────────────────

/** Les critères d'une recherche (`client_searches.criteria`), tels que le moteur les lit. */
export interface Criteres {
  type?: string
  budget_min?: number
  budget_max?: number
  zones?: unknown
  rooms_min?: number
  rooms_max?: number
  surface_min?: number
  features?: unknown
  bedrooms_min?: number
  condition_min?: string
  off_market_only?: boolean
}

export type CleCritere = 'budget' | 'zone' | 'type' | 'pieces' | 'chambres' | 'surface' | 'etat' | 'equipements' | 'offMarket'
/** Un critère de la recherche face au bien : `tenu` nul quand rien ne permet de trancher. */
export interface CritereExplique { critere: CleCritere; tenu: boolean | null; ecart: string | null; voulu: string; bien: string | null }

type AxeMoteur = 'budget' | 'zone' | 'type' | 'rooms' | 'features'
/** Détails que le moteur écrit pour un axe INACTIF (aucun critère de son côté) : pas un verdict. */
const INACTIF = new Set(['—', 'Aucun critère'])
/** L'état MINIMUM qu'une recherche peut poser : « à rénover » n'en est pas un (règle du moteur). */
const MINIMUMS: ReadonlySet<string> = new Set(['good', 'renovated', 'new'])
const estEtat = (v: unknown): v is EtatBien => typeof v === 'string' && (ETATS_BIEN as readonly string[]).includes(v)

function bornes(min: number | null | undefined, max: number | null | undefined, f: (n: number) => string): string {
  if (min != null && max != null) return `${f(min)} – ${f(max)}`
  if (max != null) return `≤ ${f(max)}`
  return `≥ ${f(min as number)}`
}

/**
 * Le score expliqué, critère par critère — la règle de `lignesCriteres` (filModele.ts), confrontée par
 * whatsapp-matching-fil.spec.ts : le verdict du MOTEUR (`matches.reasons`) pour le budget, la zone, le type et les
 * équipements ; un FAIT comparé à ses bornes pour les pièces, les chambres, la surface, l'état (`etatDuBien`, la
 * règle du moteur) et l'off-market.
 * ⛔ Sans raison du moteur, ou sur un axe qu'il n'a pas évalué, AUCUN verdict : un « tenu » sans preuve serait une
 * invention. Et l'écart ne s'écrit que là où le `detail` du moteur DÉCRIT un écart (budget, zone, équipements).
 */
export function expliquer(criteres: Criteres | null, raisons: unknown, bien: BienWa, maintenant: number): CritereExplique[] {
  const c = criteres
  if (!c) return []
  const r = (raisons && typeof raisons === 'object' ? raisons : {}) as Partial<Record<AxeMoteur, { match?: unknown; detail?: unknown }>>
  const verdict = (axe: AxeMoteur, decritEcart: boolean): { tenu: boolean | null; ecart: string | null } => {
    const x = r[axe]
    const detail = typeof x?.detail === 'string' ? x.detail.trim() : ''
    if (!x || typeof x.match !== 'boolean' || (!x.match && INACTIF.has(detail))) return { tenu: null, ecart: null }
    return { tenu: x.match, ecart: decritEcart && !x.match && detail ? detail : null }
  }
  const out: CritereExplique[] = []
  if (c.budget_min != null || c.budget_max != null) {
    out.push({ critere: 'budget', ...verdict('budget', true), voulu: bornes(c.budget_min, c.budget_max, fmtCHF), bien: prixEnClair(bien) })
  }
  const zones = chaines(c.zones)
  if (zones.length > 0) {
    out.push({ critere: 'zone', ...verdict('zone', true), voulu: zones.join(', '), bien: [bien.ville, bien.canton].filter(Boolean).join(', ') || null })
  }
  if (c.type) out.push({ critere: 'type', ...verdict('type', false), voulu: c.type, bien: bien.type })
  // ⛔ Pièces et surface : un FAIT, pas la note du moteur, qui les a fusionnées en un axe (règle du fil).
  if (c.rooms_min != null || c.rooms_max != null) {
    const p = bien.pieces
    out.push({
      critere: 'pieces', ecart: null, voulu: bornes(c.rooms_min, c.rooms_max, String), bien: p == null ? null : String(p),
      tenu: p == null ? null : (c.rooms_min == null || p >= c.rooms_min) && (c.rooms_max == null || p <= c.rooms_max),
    })
  }
  // Lot C : 0 chambre n'est pas une valeur, et un critère que le bien ne renseigne pas n'a pas de verdict.
  if (typeof c.bedrooms_min === 'number' && c.bedrooms_min > 0) {
    const n = bien.chambres != null && bien.chambres > 0 ? bien.chambres : null
    out.push({ critere: 'chambres', ecart: null, voulu: `≥ ${c.bedrooms_min}`, bien: n == null ? null : String(n), tenu: n == null ? null : n >= c.bedrooms_min })
  }
  if (c.surface_min != null) {
    const s = bien.surface
    out.push({ critere: 'surface', ecart: null, voulu: `≥ ${c.surface_min} m²`, bien: s == null ? null : `${s} m²`, tenu: s == null ? null : s >= c.surface_min })
  }
  if (estEtat(c.condition_min) && MINIMUMS.has(c.condition_min)) {
    const voulu = c.condition_min
    const e = etatDuBien(bien.brutEtat, new Date(maintenant).getUTCFullYear())
    out.push({
      critere: 'etat', ecart: null, voulu, bien: e?.etat ?? null,
      tenu: e == null ? null : ETATS_BIEN.indexOf(e.etat) >= ETATS_BIEN.indexOf(voulu),
    })
  }
  // Un équipement dont le slug est vide n'existe pas pour le moteur : il n'existe pas ici.
  const voulus = chaines(c.features).filter((v) => slugify(v) !== '')
  if (voulus.length > 0) {
    const offerts = bien.equipements.map(slugify).filter(Boolean)
    const presents = voulus.filter((v) => {
      const w = slugify(v)
      return offerts.some((h) => h === w || h.includes(w) || w.includes(h))
    })
    out.push({ critere: 'equipements', ...verdict('features', true), voulu: voulus.join(', '), bien: presents.length ? presents.join(', ') : null })
  }
  // Off-market : toujours évalué — un mandat porte son interrupteur, une annonce du marché est publique.
  if (c.off_market_only === true) {
    out.push({ critere: 'offMarket', ecart: null, voulu: 'off-market', bien: bien.offMarket ? 'off-market' : 'publié', tenu: bien.offMarket })
  }
  return out
}

// ── Pourquoi maintenant ─────────────────────────────────────────────────────

/** Le signal d'un match : la baisse depuis la proposition ou le refus (lot B), sinon celui de son bien (lot C). */
export type Signal =
  | { genre: 'baisse_depuis_proposition'; montant: number }
  | { genre: 'baisse_depuis_refus'; montant: number }
  | { genre: 'baisse'; montant: number; le: string }
  | { genre: 'nouveau'; le: string }
  | { genre: 'nouveau_mandat'; le: string }

/** Une date des `jours` derniers jours ; une date future est une saisie fautive, pas un signal. */
function recente(iso: string | null, jours: number, maintenant: number): iso is string {
  const t = temps(iso)
  return t > 0 && t <= maintenant && maintenant - t <= jours * JOUR
}

/**
 * Le signal « pourquoi maintenant » d'un match — `signalPrix` (filBoucle.ts) d'abord, parce qu'il parle de CET
 * acheteur, puis `signalBien` (filSignaux.ts). ⛔ Un prix nul (« prix sur demande ») n'est ni une baisse ni une hausse.
 */
export function signalMatch(
  m: Pick<LigneMatch, 'status' | 'reaction_motif' | 'prix_propose'>,
  bien: BienWa,
  maintenant: number,
): Signal | null {
  const prixPropose = nombreOuNull(m.prix_propose)
  if (prixPropose != null && bien.prix != null && bien.prix > 0) {
    const baisse = prixPropose - bien.prix
    if (baisse > 0 && m.status === 'suggested' && m.reaction_motif === 'prix') return { genre: 'baisse_depuis_refus', montant: baisse }
    if (baisse > 0 && m.status === 'sent') return { genre: 'baisse_depuis_proposition', montant: baisse }
  }
  if (bien.genre === 'annonce') {
    const { prix, prixInitial } = bien
    if (prix != null && prix > 0 && prixInitial != null && prixInitial > prix && recente(bien.baisseLe, JOURS_BAISSE, maintenant)) {
      return { genre: 'baisse', montant: prixInitial - prix, le: bien.baisseLe }
    }
    return recente(bien.vuLe, JOURS_NOUVEAU, maintenant) ? { genre: 'nouveau', le: bien.vuLe } : null
  }
  return recente(bien.mandatLe, JOURS_MANDAT, maintenant) ? { genre: 'nouveau_mandat', le: bien.mandatLe } : null
}

/** Un signal en clair : montant en CHF, date à la suisse ; le montant garde « /mois » pour une location, comme le prix du bien. */
export function signalEnClair(s: Signal | null, location: boolean): { genre: Signal['genre']; montant?: string; le?: string } | null {
  if (!s) return null
  return {
    genre: s.genre,
    ...('montant' in s ? { montant: avecLoyer(fmtCHF(s.montant), location) } : {}),
    ...('le' in s ? { le: dateSuisse(s.le) ?? undefined } : {}),
  }
}

// ── Les réponses des outils ─────────────────────────────────────────────────

/**
 * Un bien en clair, pour le modèle : ce qu'il peut en dire, et l'identifiant dont les autres outils ont besoin.
 * `adresse` distingue deux annonces au même titre, même ville, même prix — sans elle, identiques à l'id près.
 * Un bien qui n'est plus une OCCASION le dit explicitement — `occasion: false` et, pour un mandat, son `statut`
 * (« reserved », « draft »…) : sans ça, le modèle ne peut ni l'expliquer à l'agent ni dire pourquoi `get_matches`
 * (qui garde un tel bien « en cours ») et `get_buyers_for_property` (qui l'écarte d'« à proposer ») semblent se
 * contredire. Rien n'est ajouté quand le bien EST une occasion, pour garder la réponse compacte ; pour une annonce
 * retirée, `retire` suffit déjà — pas de champ en plus.
 */
export function bienEnClair(b: BienWa): {
  id: string; genre: BienWa['genre']; titre: string; ville: string | null; adresse: string | null; prix: string | null
  retire?: true; occasion?: false; statut?: string
} {
  return {
    id: b.id, genre: b.genre, titre: b.titre, ville: b.ville, adresse: b.adresse, prix: prixEnClair(b),
    ...(b.retire ? { retire: true as const } : {}),
    ...(b.genre === 'mandat' && !b.occasion ? { occasion: false as const, ...(b.statutMandat ? { statut: b.statutMandat } : {}) } : {}),
  }
}

/** Un match et ce qu'on sait de lui : son bien, et les critères de la recherche qui l'a produit. */
export interface EntreeMatch { match: LigneMatch; bien: BienWa; criteres: Criteres | null }

export const MAX_BIENS = 8
const RANG_EN_COURS: Readonly<Record<string, number>> = { interesse: 0, visite: 1, propose: 2 }

/** Un équipement du fil, sans son préfixe `custom:` (comme `cleEquipement`, filModele.ts) — jamais montré tel quel. */
const sansPrefixeCustom = (s: string): string => s.replace(/^custom:/i, '')

/** L'état d'un acheteur, en clair : le prix d'un bien refusé garde « /mois » pour une location. */
function etatEnClair(etat: EtatAcheteur, location: boolean): EtatAcheteur {
  return etat.code === 'revenu' ? { ...etat, refuse_a: avecLoyer(etat.refuse_a, location) } : etat
}

/**
 * Les critères tels que la vue les rend : un équipement perd son préfixe `custom:` (voulu ET tenu, jamais montré tel
 * quel — comme `filValeurs.ts`), un budget de location garde son « /mois » (`bien` l'a déjà par `prixEnClair` ;
 * `voulu`, lui, vient de `bornes()` seul, qui ne connaît pas le bien). Le NOYAU d'`expliquer` (`[critere, tenu,
 * ecart]`), confronté par whatsapp-matching-fil.spec.ts, n'est pas touché : cette fonction ne réécrit que `voulu`
 * et `bien`.
 */
function presenterCriteres(lignes: CritereExplique[], location: boolean): CritereExplique[] {
  return lignes.map((l) => {
    if (l.critere === 'equipements') {
      return {
        ...l,
        voulu: l.voulu.split(', ').map(sansPrefixeCustom).join(', '),
        bien: l.bien ? l.bien.split(', ').map(sansPrefixeCustom).join(', ') : l.bien,
      }
    }
    if (l.critere === 'budget' && location) return { ...l, voulu: avecLoyer(l.voulu, location) }
    return l
  })
}

/** Partagée par `vueGetMatches` et `vueAcheteurs` (CLAUDE.md §5 : un score IA se présente comme une estimation). */
const NOTE_MODELE =
  "Le score est une estimation du moteur de matching : présente-le comme tel. Un critère à tenu: null n'a pas été évalué : ne dis pas qu'il est tenu, ni qu'il ne l'est pas. Un bien à occasion: false ne se propose pas : son statut dit pourquoi (sous offre, brouillon, vendu). Un bien à retire: true (annonce retirée du marché) ne se propose plus non plus à ses acquéreurs."

/**
 * La réponse de `get_matches` : les biens EN COURS d'abord — intéressé, visite, puis proposé —, puis les meilleurs
 * À PROPOSER, revenus compris. Huit au plus. Un match reporté n'y est pas tant que son report court ; les refusés
 * et écartés ne sont pas lus. Un bien qui n'est PLUS UNE OCCASION (`BienWa.occasion`) sort d'« à proposer » (ci-
 * dessous), mais reste EN COURS s'il y est déjà — l'agent doit savoir où en est sa démarche, même sur un bien parti.
 * `aProposerALaLimite` : la lecture des matchs à proposer (et des reportés, la même lecture) a atteint sa limite,
 * leur total réel est inconnu (« N+ »). `enCoursALaLimite` (par défaut `false`, pour les appelants existants) : même
 * drapeau côté « en cours » — l'exécuteur y lit deux statuts à part (intéressé/visite, puis proposé), chacun borné.
 */
export function vueGetMatches(
  entrees: readonly EntreeMatch[], maintenant: number, aProposerALaLimite: boolean, enCoursALaLimite = false,
) {
  const vus = entrees.map((e) => ({
    e, etat: etatMatch(e.match, maintenant), signal: signalMatch(e.match, e.bien, maintenant), score: nombreOuNull(e.match.score) ?? 0,
  }))
  // En cours : l'ordre des états, puis le plus récemment PROPOSÉ, puis le score, puis l'id — comme « Sa boucle »
  // (saBoucle.ts, `construireSaBoucle`) et « Retours de … » (`construireAttente`, filBoucle.ts), qui trient par
  // `sent_at` décroissant. ⚠ `trierCompatibles` (filQuiPour.ts) départage les ACHETEURS d'un même bien, pas les
  // biens d'un acheteur : ce n'est pas la règle qui s'applique ici. Retiré ou non : un bien déjà en cours reste
  // visible (son drapeau le dit).
  const enCours = vus.filter((v) => v.etat.code in RANG_EN_COURS).sort((a, b) =>
    RANG_EN_COURS[a.etat.code] - RANG_EN_COURS[b.etat.code]
    || temps(b.e.match.sent_at) - temps(a.e.match.sent_at)
    || b.score - a.score
    || a.e.match.id.localeCompare(b.e.match.id))
  // Un bien qui n'est plus une OCCASION (`occasion`, distincte de l'étiquette `retire`) sort d'« à proposer » et des
  // reportés — mais reste en cours ci-dessus.
  const vivants = vus.filter((v) => v.e.bien.occasion)
  // À proposer : score, puis signal d'abord, puis création la plus récente, puis id — l'ordre de `construireFil`
  // (filModele.ts, comparateur `avant`). Une entrée sans `created_at` lisible (tests, anciennes lignes) vaut 0
  // (`temps`) : elle passe en dernier de son rang, sans jamais faire planter le tri.
  const aProposer = vivants.filter((v) => v.etat.code === 'a_proposer' || v.etat.code === 'revenu').sort((a, b) =>
    b.score - a.score
    || Number(b.signal != null) - Number(a.signal != null)
    || temps(b.e.match.created_at) - temps(a.e.match.created_at)
    || a.e.match.id.localeCompare(b.e.match.id))
  const reportes = vivants.filter((v) => v.etat.code === 'reporte').length
  return {
    total: {
      // Même forme que `a_proposer` (chaîne, « + » possible) : l'exécuteur lit « en cours » en deux bornes séparées
      // (intéressé/visite, puis proposé) depuis le lot D2, et l'une des deux peut avoir atteint sa limite sans que
      // l'autre l'ait atteinte — un nombre nu prétendrait à une exactitude que la lecture ne garantit plus.
      en_cours: enCoursALaLimite ? `${enCours.length}+` : String(enCours.length),
      // Reportés et à proposer viennent de la même lecture plafonnée (les matchs `suggested`) : le même drapeau dit
      // si leur total réel est inconnu.
      a_proposer: aProposerALaLimite ? `${aProposer.length}+` : String(aProposer.length),
      reportes: aProposerALaLimite ? `${reportes}+` : String(reportes),
    },
    biens: [...enCours, ...aProposer].slice(0, MAX_BIENS).map((v) => ({
      ...bienEnClair(v.e.bien),
      etat: etatEnClair(v.etat, v.e.bien.location),
      score: v.score,
      criteres: presenterCriteres(expliquer(v.e.criteres, v.e.match.reasons, v.e.bien, maintenant), v.e.bien.location),
      signal: signalEnClair(v.signal, v.e.bien.location),
    })),
    note: NOTE_MODELE,
  }
}

export const MAX_ACHETEURS = 10

/** Un acheteur compatible, tel que la fiche le lit : son match, et son nom. */
export type LigneAcheteur = Pick<LigneMatch, 'id' | 'contact_id' | 'status' | 'score' | 'snoozed_until' | 'sent_at' | 'reaction_motif' | 'prix_propose'> & { nom: string }

/**
 * La réponse de `get_buyers_for_property` : les acquéreurs compatibles du bien, à la définition des fiches, par score
 * (l'id départage) — dix au plus, avec le total. Les anciens prospects restent sur la fiche d'un mandat actif : ils se
 * réactivent d'un geste dans le CRM.
 */
export function vueAcheteurs(bien: BienWa, lignes: readonly LigneAcheteur[], maintenant: number, totalALaLimite: boolean) {
  const tries = [...lignes].sort((a, b) => (nombreOuNull(b.score) ?? 0) - (nombreOuNull(a.score) ?? 0) || a.id.localeCompare(b.id))
  return {
    bien: bienEnClair(bien),
    total: totalALaLimite ? `${tries.length}+` : String(tries.length),
    acheteurs: tries.slice(0, MAX_ACHETEURS).map((l) => ({
      contact_id: l.contact_id, nom: l.nom, score: nombreOuNull(l.score) ?? 0, etat: etatEnClair(etatMatch(l, maintenant), bien.location),
    })),
    note: NOTE_MODELE,
    // Seulement pour un mandat ACTIF (`occasion`, pas `retire`) : la fiche « Qui pour ce bien ? » ne montre cette
    // section que là, et le moteur rend 404 sur les autres — un mandat `reserved` ou `draft` n'en a pas non plus.
    // Sans compter ici : on ne sait pas s'il y en a. La phrase ne l'affirme pas — elle dit où les trouver s'il y en a.
    ...(bien.genre === 'mandat' && bien.occasion
      ? { anciens_prospects: "S'il y en a, ils sont sur la fiche du mandat, dans le CRM (« Qui pour ce bien ? ») : ils s'y réactivent d'un geste." }
      : {}),
  }
}

/**
 * Les candidats d'un texte ambigu : `biens` déjà réduit à cinq au plus par l'appelant (les seuls relus en colonnes
 * complètes), `total` le nombre RÉEL de candidats affinés — qui peut dépasser 5, ce que dit « N+ » si la lecture en
 * base (LIMITE+1) a été coupée avant l'affinage, comme `vueGetMatches`/`vueAcheteurs` : jamais un total nu qui
 * prétendrait à une exactitude que la lecture ne garantit plus. Ordre STABLE : celui que la base rend déjà (mandats
 * d'abord, puis id) — cette fonction ne trie ni ne coupe rien elle-même.
 */
export function vueCandidats(biens: readonly BienWa[], total: number, coupe: boolean) {
  return { candidats: biens.map(bienEnClair), total: coupe ? `${total}+` : String(total) }
}

/** Ce que `wa_matching_visite` rend. */
export interface VisitePlanifiee {
  ok: boolean
  raison?: 'contact' | 'bien' | 'profil'
  genre?: 'mandat' | 'annonce'
  titre?: string
  visite_id?: string | null
  evenement_id?: string | null
  match_id?: string | null
  statut_match?: string | null
  match_avant?: string | null
  deal_id?: string | null
  etape_avant?: string | null
}

/** Ce que « /annuler » défera : la visite ou l'événement, le match s'il a bougé, l'étape du deal s'il a avancé. */
export function retourDeVisite(r: VisitePlanifiee): Record<string, unknown> {
  return {
    visite_id: r.visite_id ?? null,
    evenement_id: r.evenement_id ?? null,
    match_id: r.match_avant ? r.match_id ?? null : null,
    deal_id: r.etape_avant ? r.deal_id ?? null : null,
    etape_avant: r.etape_avant ?? null,
  }
}
