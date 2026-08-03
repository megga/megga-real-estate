/**
 * Page super-admin — file de revue des dossiers de vérification d'identité KYB.
 *
 * Route : `/kyb-review` (console admin.megga.ch). Consomme les lectures et
 * actions livrées par la migration `20260728160000_agency_review_queue.sql`
 * (étape 5, tâches 1-2) : `get_admin_agency_review_queue` pour la liste,
 * `get_admin_agency_review_detail` pour le détail d'un dossier, et les quatre
 * RPC de décision humaine (valider / rejeter / relancer / résoudre une pièce
 * d'identité).
 *
 * L'enjeu de cet écran n'est PAS l'esthétique, c'est de rendre évident, en
 * quelques secondes, **pourquoi** un dossier est ici — cinq situations qui
 * n'appellent pas la même décision (score faible, véto échoué, véto absent
 * faute de source, pièce d'identité en attente, dossier abandonné par le
 * filet de rattrapage après plusieurs échecs techniques). `qualifyReviewReasons`
 * ci-dessous, testée directement (tests/unit/admin-kyb-review-reasons.spec.ts,
 * même motif que IdentityShell.tsx : ce dépôt n'a pas de bibliothèque de rendu
 * de composants, la logique testable vit dans des fonctions pures exportées),
 * porte cette distinction.
 *
 * La file est PAGINÉE (correctif de revue étape 6) et affiche toujours le nombre
 * total de dossiers en attente, pas la seule taille de la page : sans ce total, une
 * page pleine est indiscernable d'une file terminée — c'est précisément ce qui
 * rendait invisible la troncature silencieuse de PostgREST à `max_rows`.
 *
 * Le poids affiché pour chaque check est celui EN VIGUEUR À LA DATE DU CHECK
 * (applicableWeight, rendu tel quel par la RPC de détail) — jamais recalculé
 * ni substitué par un barème courant : afficher le poids d'aujourd'hui
 * mentirait sur la décision d'hier.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { createPortal } from 'react-dom'
import {
  AlertTriangle, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleSlash, Clock,
  History, IdCard, Loader2, RotateCw, ScanSearch, ShieldAlert, TrendingDown, UserX, Users, X,
  XCircle,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
// Réutilisé tel quel depuis le CRM : ce hook prend (agencyId, relatedPersonId) en simples
// paramètres et ne lit jamais l'agence de l'appelant, donc il sert le relecteur super-admin
// aussi bien que le dirigeant. La console partage le bundle et le client Supabase du CRM.
import { useIdentityDocuments } from '@/hooks/useAgencyIdentity'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useToast } from '@/components/ui/Toast'
import Modal from '@/components/ui/modal'
import PageTransition from '@/components/layout/PageTransition'
import {
  useAdminKybReviewQueue, useAdminKybReviewDetail, useAdminKybReviewActions,
  KYB_REVIEW_PAGE_SIZE,
  type KybReviewCheckRow, type KybReviewPerson, type KybReviewCurrentVeto, type KybReviewEvent,
  type KybReviewQueueRow,
} from '@/hooks/useAdminKybReview'

// ═══════════════════════════════════════════════════════════════════════════
// Types et fonctions pures — testées directement (tests/unit/admin-kyb-review-reasons.spec.ts),
// même motif que IdentityShell.tsx (ce dépôt n'a pas de bibliothèque de rendu de
// composants). Chaque export de VALEUR (fonction/constante non primitive) porte son
// propre eslint-disable-next-line ci-dessous : le linter ne suspend la règle que sur
// la ligne qui suit, jamais une région entière.
// ═══════════════════════════════════════════════════════════════════════════

/** Résultat brut d'un check, tel que renvoyé par get_admin_agency_review_detail
 *  (contrainte CHECK de agency_verification_checks/agency_person_verification_checks,
 *  20260728103000). */
export type CheckResult = 'match' | 'partial' | 'mismatch' | 'unavailable' | 'pending_manual_review'

/** Sous-ensemble d'une ligne de check utile à la qualification du motif de blocage.
 *  `checkId`/`checkedAt` : pas de la décoration, INDISPENSABLES à
 *  latestChecksByTypeAndPerson — les tables de checks sont append-only (résoudre une
 *  pièce INSÈRE une ligne, ne remplace jamais l'ancienne), donc qualifier un dossier à
 *  partir de son historique complet exige de savoir quelle ligne est la plus récente
 *  par couple (type, personne), cf. son commentaire. */
export interface ReviewCheck {
  checkId: string
  checkType: string
  result: CheckResult
  /** null si la ligne de config n'a pas été retrouvée à la date du check (LEFT JOIN
   *  LATERAL sans correspondance) — reste distinct de false, cf. le commentaire SQL
   *  de get_admin_agency_review_detail. */
  isVeto: boolean | null
  relatedPersonId: string | null
  checkedAt: string
}

/** Un type de véto EN VIGUEUR AUJOURD'HUI, avec sa portée (verification_check_config
 *  filtré valid_to is null, jointe à verification_check_types.scope). */
export interface CurrentVetoType {
  checkType: string
  scope: 'agency' | 'person'
}

/** Une ligne agency_person_roles, réduite à ce que la qualification a besoin de lire. */
export interface PersonRoleRow {
  role: 'signatory' | 'ubo'
  validTo: string | null
}

/** Une personne liée à l'agence, avec ses rôles — pour activeSignatoryIds. */
export interface RelatedPersonWithRoles {
  id: string
  roles: PersonRoleRow[]
}

/** Un événement d'activity_events (category=kyc) pertinent pour l'historique du dossier. */
export interface AgencyKybEvent {
  id: string
  action: string
  createdAt: string
  metadata: Record<string, unknown> | null
}

export type ReviewReasonCode =
  | 'veto_failed'
  | 'id_document_pending'
  | 'no_active_signatory'
  | 'sweep_exhausted'
  | 'veto_missing_source'
  | 'low_score'

export interface ReviewReason {
  code: ReviewReasonCode
}

/** Ordre d'affichage — le plus actionnable/alarmant en tête. qualifyReviewReasons
 *  trie systématiquement selon cet ordre : la première raison retournée est celle
 *  que le relecteur doit lire en premier. */
const REASON_PRIORITY: ReviewReasonCode[] = [
  'veto_failed', 'id_document_pending', 'no_active_signatory', 'sweep_exhausted',
  'veto_missing_source', 'low_score',
]

/** Borne du filet de rattrapage — DOIT rester synchronisée avec `v_max_attempts`
 *  (sweep_pending_agency_verifications, 20260728150000). Non exposée par aucune RPC
 *  lisible côté admin (le filet vit entièrement en PL/pgSQL) : dupliquée ici en
 *  connaissance de cause, comme la seule façon de reconnaître le cas "abandonné" côté
 *  écran. Un changement de cette constante côté moteur doit se répercuter ici. */
export const SWEEP_MAX_ATTEMPTS = 5

/** snake_case -> camelCase : dérive la clé i18n d'un check_type/source/result sans
 *  dictionnaire à maintenir en double (19 check_types, 14 sources). Un type/source
 *  futur, absent de la traduction, retombe sur `defaultValue` côté t() plutôt que de
 *  planter — voir son usage plus bas (labelForCheckType/labelForSource/labelForResult). */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function snakeToCamel(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
}

/** true si `roles` porte un rôle signataire ACTIF à `today` (chaîne ISO YYYY-MM-DD) —
 *  même règle que la CTE `active_signatories` du moteur
 *  (recompute_agency_verification, 20260728130000) : `valid_to` nul ou strictement
 *  futur. `>` strict (pas `>=`) : un mandat qui expire aujourd'hui même n'est déjà
 *  plus actif, comme en SQL (`valid_to > current_date`). */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function hasActiveSignatoryRole(roles: PersonRoleRow[], today: string): boolean {
  return roles.some((r) => r.role === 'signatory' && (r.validTo === null || r.validTo > today))
}

/** Ids des personnes qui comptent comme signataires actifs pour le moteur — même
 *  périmètre que active_signatories. Alimente la détection d'un véto personne
 *  totalement absent (aucune ligne pour CE signataire, cf. qualifyReviewReasons). */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function activeSignatoryIds(persons: RelatedPersonWithRoles[], today: string): string[] {
  return persons.filter((p) => hasActiveSignatoryRole(p.roles, today)).map((p) => p.id)
}

export type CheckTone = 'positive' | 'negative' | 'neutral' | 'pending'

/** Teinte d'affichage d'UNE ligne de check (table brute, pas le résumé du dossier).
 *  `partial` bascule selon `isVeto` : sur un véto, seul `match` passe — un `partial`
 *  y échoue donc au même titre qu'un `mismatch` (negative) ; sur un signal pondéré,
 *  `partial` vaut un demi-crédit dans le score (recompute_agency_verification), ni
 *  alarmant ni pleinement rassurant (neutral). */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function checkRowTone(result: CheckResult, isVeto: boolean | null): CheckTone {
  if (result === 'pending_manual_review') return 'pending'
  if (result === 'unavailable') return 'neutral'
  if (result === 'match') return 'positive'
  if (result === 'partial') return isVeto ? 'negative' : 'neutral'
  return 'negative' // mismatch
}

/** Poids affiché pour une ligne de check. Un véto porte weight=0 en config PAR
 *  CONSTRUCTION (hors score) : l'afficher tel quel se lirait à tort comme « un
 *  signal qui n'a pesé pour rien » plutôt que « structurellement hors calcul » (cf.
 *  le commentaire de get_admin_agency_review_detail, 20260728160000) — d'où
 *  'veto' plutôt que le nombre. `null` (ligne de config introuvable à la date du
 *  check) reste distinct : 'unknown', jamais un poids inventé. */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function displayCheckWeight(weight: number | null, isVeto: boolean | null): 'veto' | 'unknown' | number {
  if (isVeto) return 'veto'
  if (weight === null) return 'unknown'
  return weight
}

/**
 * Garde, par couple (check_type, related_person_id), UNIQUEMENT la ligne la plus
 * récente — même dédoublonnage que les CTE `latest_agency_checks`/`latest_person_checks`
 * du moteur (recompute_agency_verification, 20260728130000). Les tables de checks sont
 * APPEND-ONLY (résoudre une pièce, admin_resolve_agency_id_document, INSÈRE une ligne,
 * ne remplace ni ne supprime jamais l'ancienne) : évaluer l'historique brut ferait
 * cohabiter, pour LE MÊME couple, un verdict à jour et un verdict périmé — la confusion
 * de catégories que cet écran existe pour éviter (revue étape 5/tâche 3, point 1 —
 * prouvé par sonde : une résolution en mismatch affichait simultanément "véto échoué"
 * ET "pièce d'identité en attente"). Généralisée à TOUT check, pas seulement
 * id_document : un correctif ponctuel laisserait la même classe de défaut resurgir dès
 * qu'un autre type de check gagnerait une seconde ligne.
 *
 * Départage par `checkId` à `checkedAt` égal (deux lignes de la même transaction, cf.
 * le commentaire ctid desc de latest_agency_checks) : le moteur départage par `ctid`,
 * non exposé côté client ; `checkId` reprend le départage que
 * get_admin_agency_review_detail applique déjà à SON PROPRE tri (`checked_at desc,
 * check_id desc`, 20260728160000). Ne suppose PAS `checks` pré-trié : compare
 * explicitement, pour rester correcte quel que soit l'ordre d'appel — pas une
 * dépendance implicite et fragile envers le tri actuel de la RPC.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function latestChecksByTypeAndPerson<
  T extends { checkId: string; checkType: string; relatedPersonId: string | null; checkedAt: string },
>(checks: T[]): T[] {
  const latest = new Map<string, T>()
  for (const c of checks) {
    const key = `${c.relatedPersonId ?? ''}:${c.checkType}`
    const current = latest.get(key)
    if (
      !current
      || c.checkedAt > current.checkedAt
      || (c.checkedAt === current.checkedAt && c.checkId > current.checkId)
    ) {
      latest.set(key, c)
    }
  }
  return Array.from(latest.values())
}

/** Pièce(s) d'identité encore en attente de relecture humaine (result=
 *  pending_manual_review, check_type=id_document) — alimente l'action "résoudre".
 *  Déduplique D'ABORD à la ligne la plus récente par (type, personne)
 *  (latestChecksByTypeAndPerson) : sans quoi une pièce déjà résolue (nouvelle ligne
 *  match/partial/mismatch) referait réapparaître le bouton "résoudre" à partir de son
 *  ancienne ligne pending_manual_review, encore présente en historique append-only — et
 *  un clic dessus échouerait côté serveur (le check n'est plus pending_manual_review).
 *  Ignore une ligne sans related_person_id (donnée incohérente : jamais une action
 *  sans cible) plutôt que de planter. */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function pendingIdDocumentChecks(
  checks: Array<{ checkId: string; checkType: string; result: CheckResult; relatedPersonId: string | null; checkedAt: string }>,
): Array<{ checkId: string; relatedPersonId: string }> {
  const out: Array<{ checkId: string; relatedPersonId: string }> = []
  for (const c of latestChecksByTypeAndPerson(checks)) {
    if (c.checkType === 'id_document' && c.result === 'pending_manual_review' && c.relatedPersonId !== null) {
      out.push({ checkId: c.checkId, relatedPersonId: c.relatedPersonId })
    }
  }
  return out
}

/**
 * Motif d'un rejet, lu dans activity_events.metadata.reason — AUCUNE colonne
 * dédiée (admin_reject_agency_review, 20260728160000 : « même discipline que la
 * file elle-même — pas de champ dérivé quand l'audit trail suffit »).
 * get_admin_agency_review_detail ne le rend PAS ; c'est pour cela que
 * useAdminKybReviewDetail lit activity_events séparément (useKybReviewEvents,
 * useAdminKybReview.ts) et que cette fonction en extrait le motif. Contrat non
 * documenté ailleurs de façon durable — d'où ce commentaire, à l'endroit précis où
 * il est lu.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function decisionReasonFromEvent(event: AgencyKybEvent): string | null {
  if (
    event.action !== 'agency_verification_rejected'
    && event.action !== 'agency_verification_correction_requested'
  ) return null
  const reason = event.metadata?.reason
  if (typeof reason !== 'string') return null
  const trimmed = reason.trim()
  return trimmed === '' ? null : trimmed
}

/** Signal de triage AU NIVEAU LISTE, à partir des seules colonnes que
 *  get_admin_agency_review_queue fournit (score, tentatives du filet).
 *  Volontairement PLUS PAUVRE que qualifyReviewReasons : sans les checks (qui ne
 *  se chargent qu'à l'ouverture du détail), deviner un véto échoué/absent ou un
 *  signataire manquant AFFIRMERAIT une classification sans la donnée qui la
 *  justifie — l'erreur exacte que ce chantier veut éviter. Le détail, lui,
 *  dispose de tout et rend le verdict complet. */
export type QueueRowSignal = 'sweep_exhausted' | 'score_unknown' | 'score'

// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function queueRowSignal(score: number | null, sweepAttempts: number): QueueRowSignal {
  if (sweepAttempts >= SWEEP_MAX_ATTEMPTS) return 'sweep_exhausted'
  if (score === null) return 'score_unknown'
  return 'score'
}

/** Ce que le pager doit afficher : la fenêtre courante, et surtout ce qu'il RESTE. */
export interface QueuePagerView {
  /** Index 0-based de la page réellement affichée. */
  page: number
  pageCount: number
  /** Rang 1-based du premier dossier affiché ; 0 quand la file est vide. */
  rangeStart: number
  /** Rang 1-based du dernier dossier affiché. */
  rangeEnd: number
  hasPrev: boolean
  hasNext: boolean
}

/**
 * Arithmétique du pager, à partir du décalage RÉELLEMENT servi par la RPC (jamais de
 * celui demandé : le hook se replie sur la dernière page réelle quand la file rétrécit
 * sous le relecteur — voir useAdminKybReview.ts).
 *
 * Isolée en fonction pure parce que c'est elle qui porte la promesse de l'écran :
 * « voici où vous en êtes, et voici combien il reste ». Une erreur ici redonnerait
 * exactement la maladie que la pagination soigne — un relecteur convaincu d'avoir tout
 * vu alors que des dossiers l'attendent encore.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function queuePagerView(
  servedOffset: number,
  rowCount: number,
  total: number,
  pageSize: number,
): QueuePagerView {
  const page = pageSize > 0 ? Math.floor(Math.max(0, servedOffset) / pageSize) : 0
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / Math.max(1, pageSize)))
  const pageStart = page * pageSize
  return {
    page,
    pageCount,
    // Une file vide n'a pas de « premier dossier » : 0, pas 1 — sinon l'écran
    // annoncerait « 1-0 sur 0 ».
    rangeStart: total === 0 || rowCount === 0 ? 0 : pageStart + 1,
    rangeEnd: pageStart + rowCount,
    hasPrev: page > 0,
    hasNext: page < pageCount - 1,
  }
}

/**
 * Le cœur de l'écran : pourquoi CE dossier est-il en revue. Retourne un tableau
 * (jamais un seul code forcé) parce qu'un dossier réel peut cumuler plusieurs
 * causes à la fois (ex. un véto échoué ET un score NULL) — les cacher l'une
 * derrière l'autre serait exactement « mettre les cas dans le même sac ». Trié
 * selon REASON_PRIORITY, le plus actionnable en tête.
 *
 * `currentVetoTypes` vide (catalogue pas encore chargé, ou en erreur) dégrade
 * proprement : aucun véto n'est alors reconnu comme "actuellement en vigueur",
 * donc `veto_missing_source` ne se déclenche QUE sur un résultat `unavailable`
 * explicitement observé — jamais un faux positif inventé faute de catalogue.
 *
 * `input.checks` est un historique COMPLET, append-only (get_admin_agency_review_detail
 * ne déduplique volontairement pas, cf. son commentaire SQL) : toute évaluation
 * ci-dessous lit `latestChecks` (latestChecksByTypeAndPerson), jamais `input.checks`
 * directement, sans quoi une pièce résolue laisserait sa ligne `pending_manual_review`
 * périmée continuer à qualifier le dossier aux côtés de son verdict à jour.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/admin-kyb-review-reasons.spec.ts), même motif que IdentityShell.tsx.
export function qualifyReviewReasons(input: {
  sweepAttempts: number
  score: number | null
  checks: ReviewCheck[]
  currentVetoTypes: CurrentVetoType[]
  activeSignatoryIds: string[]
}): ReviewReason[] {
  const reasons: ReviewReason[] = []
  const sweepExhausted = input.sweepAttempts >= SWEEP_MAX_ATTEMPTS

  if (sweepExhausted) reasons.push({ code: 'sweep_exhausted' })
  // no_active_signatory est orthogonal aux checks (dérivé de agency_related_persons/
  // agency_person_roles, jamais des tables de checks) : vrai indépendamment de ce que
  // le moteur a pu, ou non, exécuter.
  if (input.activeSignatoryIds.length === 0) reasons.push({ code: 'no_active_signatory' })

  // Le moteur n'a jamais pu s'exécuter ne serait-ce qu'une fois (typiquement : le
  // filet épuisé avant tout passage réussi, cf. sweep_pending_agency_verifications,
  // 20260728150000 — le cas nominal où verification_score reste NULL). Dériver un
  // véto échoué/absent ou un score à partir de ZÉRO check ferait dire à l'écran des
  // choses que personne n'a observées : chaque véto configuré semblerait "absent",
  // non pas parce que sa source est injoignable, mais parce que rien n'a jamais
  // interrogé personne — un récit différent, que sweep_exhausted raconte déjà
  // correctement. Retour anticipé : sweep_exhausted (et no_active_signatory) restent
  // les SEULES raisons pertinentes dans ce cas précis.
  if (sweepExhausted && input.checks.length === 0) {
    return sortReasons(reasons)
  }

  // Dédoublonnage AVANT toute évaluation qui suit (latestChecksByTypeAndPerson, même
  // règle que latest_agency_checks/latest_person_checks côté moteur) : les tables de
  // checks sont append-only, donc TOUTE lecture de input.checks à partir d'ici doit
  // passer par latestChecks, jamais par input.checks directement — sans quoi une pièce
  // résolue (nouvelle ligne) cohabiterait avec son ancienne ligne encore
  // pending_manual_review/mismatch, et l'écran afficherait deux motifs qui se
  // contredisent pour LE MÊME couple (type, personne). Généralisé à chaque évaluation
  // ci-dessous, pas seulement id_document (revue étape 5/tâche 3, point 1) : un
  // correctif ponctuel laisserait la même classe de défaut resurgir dès qu'un autre
  // type de check gagnerait une seconde ligne.
  const latestChecks = latestChecksByTypeAndPerson(input.checks)

  const hasFailedVeto = latestChecks.some(
    (c) => c.isVeto === true && (c.result === 'mismatch' || c.result === 'partial'),
  )
  if (hasFailedVeto) reasons.push({ code: 'veto_failed' })

  const hasPendingIdDocument = latestChecks.some(
    (c) => c.checkType === 'id_document' && c.result === 'pending_manual_review',
  )
  if (hasPendingIdDocument) reasons.push({ code: 'id_document_pending' })

  const hasUnavailableVeto = latestChecks.some((c) => c.isVeto === true && c.result === 'unavailable')

  const agencyVetoTypes = input.currentVetoTypes.filter((v) => v.scope === 'agency').map((v) => v.checkType)
  const agencyCheckTypesPresent = new Set(
    latestChecks.filter((c) => c.relatedPersonId === null).map((c) => c.checkType),
  )
  const hasMissingAgencyVeto = agencyVetoTypes.some((vt) => !agencyCheckTypesPresent.has(vt))

  const personVetoTypes = input.currentVetoTypes.filter((v) => v.scope === 'person').map((v) => v.checkType)
  const hasMissingPersonVeto = input.activeSignatoryIds.some((personId) => {
    const presentForPerson = new Set(
      latestChecks.filter((c) => c.relatedPersonId === personId).map((c) => c.checkType),
    )
    return personVetoTypes.some((vt) => !presentForPerson.has(vt))
  })

  if (hasUnavailableVeto || hasMissingAgencyVeto || hasMissingPersonVeto) {
    reasons.push({ code: 'veto_missing_source' })
  }

  // Score : le cas NULL est LE PLUS opaque (cf. commentaire NULLS FIRST de
  // get_admin_agency_review_queue) — au moins un check existe à ce stade (le
  // retour anticipé ci-dessus a déjà écarté le cas "zéro donnée"), donc un score
  // NULL ici signifie "de vrais checks existent, mais aucun n'était scorable" :
  // une information réelle, jamais redondante, toujours signalée. Un score
  // numérique ne motive en revanche une raison que s'il ne reste sinon aucune
  // autre explication — le nombre est de toute façon déjà affiché ailleurs à
  // l'écran.
  if (input.score === null) {
    reasons.push({ code: 'low_score' })
  } else if (reasons.length === 0) {
    reasons.push({ code: 'low_score' })
  }

  return sortReasons(reasons)
}

/** Priorité d'affichage — la plus actionnable en tête (REASON_PRIORITY). */
function sortReasons(reasons: ReviewReason[]): ReviewReason[] {
  return reasons.sort((a, b) => REASON_PRIORITY.indexOf(a.code) - REASON_PRIORITY.indexOf(b.code))
}

// ═══════════════════════════════════════════════════════════════════════════
// Présentation
// ═══════════════════════════════════════════════════════════════════════════

const REASON_META: Record<ReviewReasonCode, { icon: typeof AlertTriangle; tone: 'negative' | 'warn' | 'neutral' }> = {
  veto_failed: { icon: ShieldAlert, tone: 'negative' },
  id_document_pending: { icon: IdCard, tone: 'warn' },
  no_active_signatory: { icon: UserX, tone: 'warn' },
  sweep_exhausted: { icon: RotateCw, tone: 'warn' },
  veto_missing_source: { icon: CircleSlash, tone: 'neutral' },
  low_score: { icon: TrendingDown, tone: 'neutral' },
}

const TONE_TEXT: Record<'negative' | 'warn' | 'neutral', string> = {
  negative: 'text-red-500',
  warn: 'text-amber-500',
  neutral: 'text-theme-secondary',
}

const CHECK_TONE_TEXT: Record<CheckTone, string> = {
  positive: 'text-emerald-500',
  negative: 'text-red-500',
  neutral: 'text-theme-tertiary',
  pending: 'text-amber-500',
}

const CHECK_TONE_ICON: Record<CheckTone, typeof CheckCircle2> = {
  positive: CheckCircle2,
  negative: XCircle,
  neutral: CircleSlash,
  pending: Clock,
}

/** Une carte de raison (icône + titre + description) — jamais un pill au survol :
 *  la description reste visible en permanence, pas de dépendance à un hover. */
function ReasonCard({ code }: { code: ReviewReasonCode }) {
  const { t } = useTranslation('admin')
  const meta = REASON_META[code]
  const Icon = meta.icon
  const key = code.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
  return (
    <div className="flex items-start gap-3 rounded-lg border border-theme-border p-3">
      <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', TONE_TEXT[meta.tone])} />
      <div className="min-w-0">
        <p className={cn('text-sm font-medium', TONE_TEXT[meta.tone])}>{t(`kybReview.reason.${key}.title`)}</p>
        <p className="text-xs text-theme-tertiary mt-0.5">{t(`kybReview.reason.${key}.description`)}</p>
      </div>
    </div>
  )
}

/** Libellé d'un check_type/source/result — dérivé en camelCase, avec repli sur la
 *  valeur brute si la traduction n'existe pas encore (catalogue futur). */
function labelForCheckType(t: TFunction, checkType: string): string {
  return t(`kybReview.checkType.${snakeToCamel(checkType)}`, checkType)
}
function labelForSource(t: TFunction, source: string): string {
  return t(`kybReview.source.${snakeToCamel(source)}`, source)
}
function labelForResult(t: TFunction, result: CheckResult): string {
  return t(`kybReview.result.${snakeToCamel(result)}`, result)
}

/** Nom affiché d'une personne, ou le libellé "Agence" pour un check entité
 *  (related_person_id NULL). */
function personLabel(
  t: TFunction,
  relatedPersonId: string | null,
  persons: KybReviewPerson[],
): string {
  if (relatedPersonId === null) return t('kybReview.checks.forAgency')
  const p = persons.find((x) => x.id === relatedPersonId)
  return p ? `${p.firstName} ${p.lastName}`.trim() : '—'
}

/** Ligne + ligne d'expansion (réponse brute) d'un check — deux <tr> plutôt qu'un
 *  <details> imbriqué dans une cellule de tableau, pour rester un tableau réel
 *  (colSpan couvrant toutes les colonnes). */
function CheckRow({ check, persons, expanded, onToggle }: {
  check: KybReviewCheckRow
  persons: KybReviewPerson[]
  expanded: boolean
  onToggle: () => void
}) {
  const { t } = useTranslation('admin')
  const tone = checkRowTone(check.result, check.isVeto)
  const ToneIcon = CHECK_TONE_ICON[tone]
  const weight = displayCheckWeight(check.applicableWeight, check.isVeto)

  return (
    <>
      <tr className="border-b border-theme-border-subtle">
        <td className="py-2.5 pr-3 text-sm text-theme-primary">{labelForCheckType(t, check.checkType)}</td>
        <td className="py-2.5 pr-3 text-sm text-theme-secondary whitespace-nowrap">{labelForSource(t, check.source)}</td>
        <td className="py-2.5 pr-3 text-sm text-theme-secondary whitespace-nowrap">
          {personLabel(t, check.relatedPersonId, persons)}
        </td>
        <td className="py-2.5 pr-3">
          <span className={cn('inline-flex items-center gap-1.5 text-sm font-medium whitespace-nowrap', CHECK_TONE_TEXT[tone])}>
            <ToneIcon className="h-3.5 w-3.5 flex-shrink-0" />
            {labelForResult(t, check.result)}
          </span>
        </td>
        <td className="py-2.5 pr-3 text-sm text-theme-secondary tabular-nums whitespace-nowrap">
          {weight === 'veto' ? t('kybReview.checks.weightVeto')
            : weight === 'unknown' ? t('kybReview.checks.weightUnknown')
              : weight.toFixed(2)}
        </td>
        <td className="py-2.5 pr-3 text-xs text-theme-tertiary whitespace-nowrap">{formatDate(check.checkedAt)}</td>
        <td className="py-2.5 text-right">
          <button
            onClick={onToggle}
            className="text-theme-tertiary hover:text-theme-primary transition-colors"
            aria-label={t(expanded ? 'kybReview.checks.hideRaw' : 'kybReview.checks.viewRaw')}
            aria-expanded={expanded}
          >
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-theme-border-subtle">
          <td colSpan={7} className="bg-theme-hover/40 px-3 py-2.5">
            <pre className="text-xs text-theme-secondary whitespace-pre-wrap break-all max-h-64 overflow-y-auto scrollbar-hide">
              {JSON.stringify(check.rawResponse, null, 2) ?? '—'}
            </pre>
          </td>
        </tr>
      )}
    </>
  )
}

/** Table réelle des checks — chiffres tabulaires (poids), type/source/résultat
 *  lisibles sans avoir lu ce dépôt, réponse brute consultable par ligne. */
function ChecksTable({ checks, persons }: { checks: KybReviewCheckRow[]; persons: KybReviewPerson[] }) {
  const { t } = useTranslation('admin')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  if (checks.length === 0) {
    return <p className="text-sm text-theme-tertiary py-4">{t('kybReview.detail.checksEmpty')}</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-theme-border text-xs font-medium text-theme-tertiary">
            <th className="py-2 pr-3 font-medium">{t('kybReview.checks.table.type')}</th>
            <th className="py-2 pr-3 font-medium">{t('kybReview.checks.table.source')}</th>
            <th className="py-2 pr-3 font-medium">{t('kybReview.checks.table.person')}</th>
            <th className="py-2 pr-3 font-medium">{t('kybReview.checks.table.result')}</th>
            <th className="py-2 pr-3 font-medium">{t('kybReview.checks.table.weight')}</th>
            <th className="py-2 pr-3 font-medium">{t('kybReview.checks.table.checkedAt')}</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {checks.map((c) => (
            <CheckRow
              key={c.checkId}
              check={c}
              persons={persons}
              expanded={expandedId === c.checkId}
              onToggle={() => setExpandedId((cur) => (cur === c.checkId ? null : c.checkId))}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Personnes liées à l'agence — nom, rôle(s), et un indicateur "actif" pour les
 *  signataires (même règle que hasActiveSignatoryRole). */
/**
 * `agencyId` sert UNIQUEMENT à l'aperçu de la pièce d'identité, rattaché ici et pas
 * seulement au bloc de résolution : ce dernier n'est rendu que tant qu'un check est
 * `pending_manual_review`, donc il disparaît à l'instant même où il a servi. Or relire la
 * pièce d'un dossier DÉJÀ tranché est précisément ce qu'un audit demande. Rattaché à la
 * PERSONNE, l'aperçu survit à la décision.
 */
/**
 * Date suisse depuis un ISO date-SEULE (31.12.2030).
 *
 * `formatDate()` est utilisée partout ailleurs sur cet écran, mais elle prend des
 * `timestamptz` : sur une date-seule elle rend la VEILLE dès que le fuseau de la
 * session est à l'ouest de UTC (mesuré le 03.08.2026, même piège que la date de
 * naissance du récapitulatif). Une échéance de pièce d'identité est une date-seule.
 */
function swissDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso
}

function PersonsList({ persons, agencyId }: { persons: KybReviewPerson[]; agencyId: string }) {
  const { t } = useTranslation('admin')
  const today = new Date().toISOString().slice(0, 10)

  if (persons.length === 0) {
    return <p className="text-sm text-theme-tertiary py-2">{t('kybReview.detail.personsEmpty')}</p>
  }

  return (
    <ul className="space-y-1.5">
      {persons.map((p) => {
        const roleLabels = p.roles.map((r) => {
          const active = r.role === 'signatory' && hasActiveSignatoryRole([r], today)
          const label = r.role === 'signatory' ? t('kybReview.detail.roleSignatory') : t('kybReview.detail.roleUbo')
          return { label, active: r.role === 'signatory' ? active : true }
        })
        return (
          <li key={p.id} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-theme-primary">
                {p.firstName} {p.lastName}
                {/* Nature de la pièce, à côté du nom : c'est elle qui dit combien de
                    faces attendre sous cette ligne. Sans elle, l'absence de verso
                    d'un passeport se lit comme un dossier incomplet. Absente sur les
                    dossiers soumis avant le 03.08.2026, où rien ne la demandait. */}
                {p.idDocumentType && (
                  <span className="ml-2 text-xs text-theme-tertiary">
                    {t(`kybReview.detail.idDocumentType.${p.idDocumentType}`)}
                  </span>
                )}
              </span>
              <span className="flex items-center gap-1.5">
                {roleLabels.map((r, i) => (
                  <span
                    key={i}
                    className={cn('text-xs', r.active ? 'text-theme-secondary' : 'text-theme-tertiary line-through')}
                  >
                    {r.label}
                  </span>
                ))}
              </span>
            </div>
            {/* Ce que la lecture assistée a trouvé, AU-DESSUS de l'image et non à sa
                place : elle dit où porter les yeux, elle ne remplace pas le regard.
                Absente sur les dossiers soumis avant le 03.08.2026. */}
            {(p.idDocumentRead || p.idDocumentExpiresOn) && (
              <div className="mt-1 flex items-center gap-2 text-xs text-theme-tertiary">
                {/* « vérifiée » quand c'est le prestataire (document authentifié +
                    selfie), « lecture » quand c'est le modèle (ce qui est imprimé sur
                    une image, rien de plus). Le relecteur tranche sur cette nuance. */}
                {p.idDocumentRead && (
                  <span>
                    {t(`kybReview.detail.${p.idDocumentRead.provider === 'stripe_identity' ? 'idVerified' : 'idRead'}.${p.idDocumentRead.verdict}`)}
                  </span>
                )}
                {p.idDocumentExpiresOn && (
                  <span className={cn(p.idDocumentRead?.expired && 'text-red-500')}>
                    {t('kybReview.detail.idRead.expiresOn', { date: swissDate(p.idDocumentExpiresOn) })}
                  </span>
                )}
              </div>
            )}
            <div className="mt-1">
              <IdDocumentPreview agencyId={agencyId} relatedPersonId={p.id} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

/** Historique d'audit du dossier — soumission, recalculs, tentatives du filet,
 *  décisions humaines. Le motif d'une décision motivée (decisionReasonFromEvent) est la
 *  seule information que get_admin_agency_review_detail ne rend pas : elle vit ici. */
function HistoryList({ events }: { events: KybReviewEvent[] }) {
  const { t } = useTranslation('admin')

  if (events.length === 0) {
    return <p className="text-sm text-theme-tertiary py-2">{t('kybReview.detail.historyEmpty')}</p>
  }

  return (
    <ul className="space-y-2">
      {events.map((e) => {
        const reason = decisionReasonFromEvent(e)
        const key = e.action.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())
        return (
          <li key={e.id} className="text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-theme-primary">{t(`kybReview.event.${key}`, e.action)}</span>
              <span className="text-xs text-theme-tertiary whitespace-nowrap">{formatDate(e.createdAt)}</span>
            </div>
            {reason && (
              <p className="text-xs text-theme-tertiary mt-0.5">
                {t('kybReview.event.reasonPrefix')} {reason}
              </p>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Modale à motif obligatoire (même garde que btrim() côté RPC), partagée par le REJET et la
 *  DEMANDE DE CORRECTION (étape 7, tâche 5). Une seule modale pour deux décisions : la forme
 *  est identique — un motif libre, obligatoire, puis une confirmation — et seuls les mots et
 *  la teinte changent. En dupliquer une seconde aurait fait deux endroits à corriger le jour
 *  où la garde de motif évolue.
 *
 *  Le motif est obligatoire dans les deux cas, mais pas pour la même raison : un rejet doit
 *  être justifiable devant un audit, une demande de correction doit être ACTIONNABLE par un
 *  dirigeant qui ne voit pas la file et ne sait de la demande que ce que ce texte lui dit. */
function ReasonDialog({ open, onClose, onConfirm, pending, variant }: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
  pending: boolean
  variant: 'reject' | 'correction'
}) {
  const { t } = useTranslation('admin')
  const [reason, setReason] = useState('')
  const trimmed = reason.trim()
  const ns = variant === 'reject' ? 'kybReview.rejectDialog' : 'kybReview.correctionDialog'
  const busyKey = variant === 'reject' ? 'kybReview.actions.rejecting' : 'kybReview.actions.requestingCorrection'
  const confirmTone = variant === 'reject'
    ? 'border-red-500/30 text-red-500 hover:border-red-500'
    : 'border-amber-500/30 text-amber-500 hover:border-amber-500'

  return (
    <Modal open={open} onClose={onClose} title={t(`${ns}.title`)} size="md">
      <div className="p-5 space-y-3">
        <div>
          <label className="text-xs text-theme-secondary mb-1.5 block">{t(`${ns}.reasonLabel`)}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t(`${ns}.reasonPlaceholder`)}
            rows={4}
            autoFocus
            className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          />
          {reason !== '' && trimmed === '' && (
            <p className="text-xs text-red-500 mt-1">{t(`${ns}.reasonRequired`)}</p>
          )}
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="h-9 px-4 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => onConfirm(trimmed)}
            disabled={trimmed === '' || pending}
            className={cn(
              'h-9 px-4 text-sm font-medium border rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              confirmTone,
            )}
          >
            {pending ? t(busyKey) : t(`${ns}.confirm`)}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/**
 * UNE face (recto ou verso) de la pièce d'identité.
 *
 * Deux rendus, et le choix n'est pas cosmétique. Une IMAGE passe par `<img>`, qui
 * n'exécute jamais de script : l'URL signée suffit. Un PDF — format accepté au dépôt
 * (`ALLOWED_IDENTITY_DOCUMENT_TYPES`, un scan de passeport est courant) — est servi via un
 * blob au TYPE FORCÉ `application/pdf` : un HTML déguisé téléversé dans le bucket ne peut
 * alors pas s'exécuter, alors que passer l'URL signée brute à une `<iframe>` embarquerait
 * une surface d'exécution. Et surtout PAS d'attribut `sandbox` : il bloque le lecteur PDF
 * de Chromium (panneau vide), constat empirique déjà payé une fois — cf. l'en-tête de
 * KycDocViewer.tsx, d'où cette technique est reprise.
 */
function IdDocumentFace({ label, signedUrl, path }: { label: string; signedUrl: string; path: string }) {
  const { t } = useTranslation('admin')
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [zoomed, setZoomed] = useState(false)
  const isPdf = /\.pdf$/i.test(path)

  // Le tiroir parent écoute Escape sur `window` pour se fermer. Sans ce handler en phase
  // de CAPTURE, appuyer sur Escape depuis l'agrandissement fermerait le dossier entier
  // au lieu de la seule image. On intercepte donc avant lui, et uniquement quand
  // l'agrandissement est ouvert.
  useEffect(() => {
    if (!zoomed) return
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      setZoomed(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [zoomed])

  useEffect(() => {
    if (!isPdf) return
    let alive = true
    let objectUrl: string | null = null
    setPdfUrl(null)
    setFailed(false)
    ;(async () => {
      try {
        const resp = await fetch(signedUrl)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const buf = await resp.arrayBuffer()
        if (!alive) return
        objectUrl = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
        setPdfUrl(objectUrl)
      } catch {
        if (alive) setFailed(true)
      }
    })()
    return () => {
      alive = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [signedUrl, isPdf])

  return (
    <div className="min-w-0">
      <p className="text-xs text-theme-tertiary mb-1">{label}</p>
      {isPdf ? (
        failed ? (
          <p className="text-xs text-red-500">{t('kybReview.idDocument.faceError')}</p>
        ) : pdfUrl ? (
          <iframe src={pdfUrl} title={label} className="w-full h-64 rounded-lg border border-theme-border bg-theme-section" />
        ) : (
          <div className="h-64 rounded-lg border border-theme-border grid place-items-center">
            <Loader2 className="h-4 w-4 animate-spin text-theme-tertiary" />
          </div>
        )
      ) : (
        <>
          <button
            type="button"
            onClick={() => setZoomed(true)}
            className="block w-full rounded-lg border border-theme-border overflow-hidden hover:border-theme-border-subtle transition-colors"
            aria-label={t('kybReview.idDocument.enlarge')}
          >
            <img src={signedUrl} alt={label} className="w-full h-48 object-contain bg-theme-section" />
          </button>
          {zoomed && createPortal(
            <div
              className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm grid place-items-center p-6"
              onClick={() => setZoomed(false)}
              role="dialog"
              aria-modal="true"
              aria-label={label}
            >
              <img src={signedUrl} alt={label} className="max-h-full max-w-full object-contain" />
            </div>,
            document.body,
          )}
        </>
      )}
    </div>
  )
}

/**
 * L'aperçu recto/verso de la pièce d'identité d'une personne liée.
 *
 * Chargé À LA DEMANDE : tant que le relecteur n'a pas cliqué, `relatedPersonId` reste
 * `null` et `useIdentityDocuments` demeure désactivé. Ce n'est pas une optimisation, c'est
 * la règle de moindre exposition — une PII de conformité ne se charge pas parce qu'un
 * tiroir s'est ouvert. `useIdentityDocuments` est réutilisé tel quel : il prend ses deux
 * identifiants en paramètres, sans jamais lire l'agence de l'appelant, donc il sert le
 * dirigeant sur sa propre agence comme le relecteur sur n'importe laquelle.
 *
 * La lecture n'est possible que depuis la migration 20260802200000, qui a ajouté la
 * branche `is_super_admin()` à la SEULE policy SELECT du préfixe. Avant elle, cet écran
 * n'aurait rien affiché : la RLS filtre les LIGNES visibles sans faire échouer l'appel,
 * donc `list()` renvoyait un tableau vide SANS erreur. D'où la distinction explicite
 * ci-dessous entre « rien déposé » et « lecture impossible » : un vide muet serait
 * indiscernable d'un droit manquant, et c'est exactement le piège qui a laissé un dossier
 * réel coincé en `manual_review`.
 *
 * ⚠ Les URL signées émises par `useIdentityDocuments` vivent 300 s. Un relecteur qui
 * étudie longuement une pièce verra l'image expirer. Replier puis rouvrir l'aperçu
 * ré-émet des URL fraîches — c'est le geste de rattrapage, volontairement laissé manuel :
 * un rafraîchissement automatique prolongerait indéfiniment la durée de vie de jetons
 * porteurs sur une PII sensible, ce qui est exactement ce que la TTL courte évite.
 */
function IdDocumentPreview({ agencyId, relatedPersonId }: { agencyId: string; relatedPersonId: string }) {
  const { t } = useTranslation('admin')
  const [open, setOpen] = useState(false)
  const documents = useIdentityDocuments(agencyId, open ? relatedPersonId : null)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-8 px-3 text-xs font-medium border border-theme-border text-theme-secondary rounded-lg hover:border-theme-border-subtle hover:text-theme-primary transition-colors inline-flex items-center gap-1.5"
      >
        <IdCard className="h-3.5 w-3.5" />
        {t('kybReview.idDocument.show')}
      </button>
    )
  }

  const previews = documents.data
  const nothing = previews && !previews.recto && !previews.verso

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors"
      >
        {t('kybReview.idDocument.hide')}
      </button>

      {documents.isLoading ? (
        <p className="text-xs text-theme-tertiary">{t('kybReview.idDocument.loading')}</p>
      ) : documents.isError ? (
        <p className="text-xs text-red-500">{t('kybReview.idDocument.error')}</p>
      ) : nothing ? (
        <div>
          <p className="text-xs text-theme-secondary">{t('kybReview.idDocument.empty')}</p>
          {/* La ligne de check ne prouve PAS que le fichier existe : submit_agency_identity
              « ne touche jamais au fichier lui-même » et n'enregistre aucun chemin. Le
              relecteur doit savoir que ce vide est ambigu, pas conclure à une fraude. */}
          <p className="text-xs text-theme-tertiary mt-0.5">{t('kybReview.idDocument.emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {previews?.recto && (
            <IdDocumentFace label={t('kybReview.idDocument.recto')} signedUrl={previews.recto.signedUrl} path={previews.recto.path} />
          )}
          {previews?.verso && (
            <IdDocumentFace label={t('kybReview.idDocument.verso')} signedUrl={previews.verso.signedUrl} path={previews.verso.path} />
          )}
        </div>
      )}
    </div>
  )
}

/** Les 3 boutons de résolution d'UNE pièce d'identité en attente — enchaîne
 *  résolution + relance en un seul geste (useAdminKybReviewActions.resolveIdentityDocument). */
function ResolveIdDocumentSection({ agencyId, pending, persons, onResolve, busy }: {
  agencyId: string
  pending: Array<{ checkId: string; relatedPersonId: string }>
  persons: KybReviewPerson[]
  onResolve: (checkId: string, result: 'match' | 'partial' | 'mismatch') => void
  busy: boolean
}) {
  const { t } = useTranslation('admin')
  if (pending.length === 0) return null

  return (
    <div className="space-y-3">
      {pending.map((p) => {
        const person = persons.find((x) => x.id === p.relatedPersonId)
        const name = person ? `${person.firstName} ${person.lastName}`.trim() : '—'
        return (
          <div key={p.checkId} className="rounded-lg border border-amber-500/30 p-3">
            <p className="text-sm font-medium text-theme-primary mb-2">
              {t('kybReview.resolveIdDocument.title', { name })}
            </p>
            {/* La pièce AVANT les boutons : c'est l'ordre du geste. La RPC appelée juste
                en dessous refuse 'unavailable' au motif que « Le relecteur A le document
                sous les yeux » — jusqu'au 02.08.2026 cette prémisse était fausse. */}
            <div className="mb-3">
              <IdDocumentPreview agencyId={agencyId} relatedPersonId={p.relatedPersonId} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onResolve(p.checkId, 'match')}
                disabled={busy}
                className="h-8 px-3 text-xs font-medium border border-emerald-500/30 text-emerald-500 rounded-lg hover:border-emerald-500 transition-colors disabled:opacity-40"
              >
                {t('kybReview.resolveIdDocument.match')}
              </button>
              <button
                onClick={() => onResolve(p.checkId, 'partial')}
                disabled={busy}
                className="h-8 px-3 text-xs font-medium border border-amber-500/30 text-amber-500 rounded-lg hover:border-amber-500 transition-colors disabled:opacity-40"
              >
                {t('kybReview.resolveIdDocument.partial')}
              </button>
              <button
                onClick={() => onResolve(p.checkId, 'mismatch')}
                disabled={busy}
                className="h-8 px-3 text-xs font-medium border border-red-500/30 text-red-500 rounded-lg hover:border-red-500 transition-colors disabled:opacity-40"
              >
                {t('kybReview.resolveIdDocument.mismatch')}
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Section repliable (Vérifications / Personnes liées / Historique). */
function DetailSection({ title, icon: Icon, children }: { title: string; icon: typeof Users; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-theme-secondary" />
        <h3 className="text-sm font-semibold text-theme-primary">{title}</h3>
      </div>
      {children}
    </div>
  )
}

/** Tiroir de détail d'un dossier — createPortal(document.body), z-[100] (règle DS
 *  « modals toujours en portail »). Assemble raisons, checks, personnes, historique
 *  et les 4 actions. */
function KybReviewDrawer({ row, onClose }: { row: KybReviewQueueRow; onClose: () => void }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const drawerRef = useFocusTrap(true)

  // `row` vient de la page courante de la file plutôt que d'une seconde lecture de la
  // RPC : depuis la pagination (correctif étape 6), re-interroger la file ici ne
  // rendrait qu'UNE page, et le dossier ouvert pourrait très bien ne pas s'y trouver —
  // l'en-tête du tiroir retomberait alors sur « — » pour un dossier parfaitement
  // valide. Le parent le détient déjà ; le passer évite la lecture ET l'incohérence.
  const agencyId = row.agencyId

  const { checks, persons, currentVetoTypes, events, isLoading, isError } = useAdminKybReviewDetail(agencyId)
  const { validate, reject, relaunch, requestCorrection, resolveIdentityDocument } = useAdminKybReviewActions(agencyId)

  const [rejectOpen, setRejectOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const today = useMemo(() => new Date().toISOString().slice(0, 10), [])
  const activeSignatories = useMemo(
    () => activeSignatoryIds(persons.data ?? [], today),
    [persons.data, today],
  )

  const reasons = useMemo(() => qualifyReviewReasons({
    sweepAttempts: row.verificationSweepAttempts,
    score: row.verificationScore,
    checks: checks.data ?? [],
    currentVetoTypes: (currentVetoTypes.data ?? []) as KybReviewCurrentVeto[],
    activeSignatoryIds: activeSignatories,
  }), [row, checks.data, currentVetoTypes.data, activeSignatories])

  const pendingIdDocs = useMemo(() => pendingIdDocumentChecks(checks.data ?? []), [checks.data])

  const anyActionPending = validate.isPending || reject.isPending || relaunch.isPending
    || requestCorrection.isPending || resolveIdentityDocument.isPending

  function handleError(e: unknown) {
    toast.error(t('kybReview.actions.genericError'), {
      description: e instanceof Error ? e.message : undefined,
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={row.agencyName}
        className="absolute right-0 top-0 h-full w-full max-w-xl bg-theme-card border-l border-theme-border overflow-y-auto scrollbar-hide"
      >
        <div className="sticky top-0 bg-theme-card border-b border-theme-border px-5 py-4 flex items-start justify-between gap-3 z-10">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-theme-primary truncate">{row.agencyName}</h2>
            <p className="text-xs text-theme-tertiary mt-0.5">
              {row.country ?? '—'} · {row.identitySubmittedAt
                ? t('kybReview.detail.submittedAt') + ' ' + formatDate(row.identitySubmittedAt)
                : t('kybReview.detail.notSubmitted')}
            </p>
          </div>
          <button onClick={onClose} aria-label={t('common.close')} className="p-1.5 rounded-lg hover:bg-theme-hover text-theme-tertiary hover:text-theme-primary transition-colors flex-shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {isLoading ? (
            <p className="text-sm text-theme-tertiary">{t('kybReview.detail.loading')}</p>
          ) : isError ? (
            <p className="text-sm text-red-500">{t('kybReview.detail.error')}</p>
          ) : (
            <>
              {/* Score + tentatives du filet — les chiffres bruts, toujours visibles. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-theme-border p-3">
                  <p className="text-xs text-theme-tertiary">{t('kybReview.detail.score')}</p>
                  <p className="text-lg font-semibold text-theme-primary tabular-nums mt-0.5">
                    {row.verificationScore != null ? row.verificationScore.toFixed(3) : t('kybReview.scoreNone')}
                  </p>
                </div>
                <div className="rounded-xl border border-theme-border p-3">
                  <p className="text-xs text-theme-tertiary">{t('kybReview.detail.sweepAttempts')}</p>
                  <p className="text-lg font-semibold text-theme-primary tabular-nums mt-0.5">
                    {row.verificationSweepAttempts} / {SWEEP_MAX_ATTEMPTS}
                  </p>
                </div>
              </div>

              {/* Pourquoi ce dossier est ici — la section centrale du brief. */}
              <div>
                <h3 className="text-sm font-semibold text-theme-primary mb-2">{t('kybReview.detail.whySection')}</h3>
                <div className="space-y-2">
                  {reasons.map((r) => <ReasonCard key={r.code} code={r.code} />)}
                </div>
              </div>

              {pendingIdDocs.length > 0 && (
                <ResolveIdDocumentSection
                  agencyId={agencyId}
                  pending={pendingIdDocs}
                  persons={persons.data ?? []}
                  busy={anyActionPending}
                  onResolve={(checkId, result) => {
                    resolveIdentityDocument.mutate({ checkId, result }, {
                      onSuccess: () => toast.success(t('kybReview.actions.resolveSuccess')),
                      onError: handleError,
                    })
                  }}
                />
              )}

              <DetailSection title={t('kybReview.detail.checksSection')} icon={ScanSearch}>
                <ChecksTable checks={checks.data ?? []} persons={persons.data ?? []} />
              </DetailSection>

              <DetailSection title={t('kybReview.detail.personsSection')} icon={Users}>
                <PersonsList persons={persons.data ?? []} agencyId={agencyId} />
              </DetailSection>

              <DetailSection title={t('kybReview.detail.historySection')} icon={History}>
                <HistoryList events={events.data ?? []} />
              </DetailSection>
            </>
          )}
        </div>

        {/* Actions — toujours visibles, même en erreur de chargement du détail (une
            décision reste possible avec ce que la file elle-même a déjà montré). */}
        <div className="sticky bottom-0 bg-theme-card border-t border-theme-border px-5 py-3 flex flex-wrap items-center gap-2">
          <button
            onClick={() => validate.mutate(undefined, {
              onSuccess: () => toast.success(t('kybReview.actions.validateSuccess')),
              onError: handleError,
            })}
            disabled={anyActionPending}
            className="h-9 px-4 text-sm font-medium border border-emerald-500/30 text-emerald-500 rounded-lg hover:border-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {validate.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {validate.isPending ? t('kybReview.actions.validating') : t('kybReview.actions.validate')}
          </button>
          <button
            onClick={() => setRejectOpen(true)}
            disabled={anyActionPending}
            className="h-9 px-4 text-sm font-medium border border-red-500/30 text-red-500 rounded-lg hover:border-red-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('kybReview.actions.reject')}
          </button>
          <button
            onClick={() => setCorrectionOpen(true)}
            disabled={anyActionPending}
            className="h-9 px-4 text-sm font-medium border border-amber-500/30 text-amber-500 rounded-lg hover:border-amber-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {t('kybReview.actions.requestCorrection')}
          </button>
          <button
            onClick={() => relaunch.mutate(undefined, {
              onSuccess: () => toast.success(t('kybReview.actions.relaunchSuccess')),
              onError: handleError,
            })}
            disabled={anyActionPending}
            className="h-9 px-4 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
          >
            {relaunch.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {relaunch.isPending ? t('kybReview.actions.relaunching') : t('kybReview.actions.relaunch')}
          </button>
        </div>
      </div>

      {/* `key` qui change à l'ouverture : React remonte la modale, donc son champ de motif
          repart vide. Sans cela il faudrait un setState dans un effet (rendu en cascade,
          react-hooks/set-state-in-effect), motif que ce fichier évite partout ailleurs — et
          sans remise à zéro du tout, le motif d'un rejet abandonné réapparaîtrait dans la
          demande de correction du dossier suivant. */}
      <ReasonDialog
        key={`reject-${rejectOpen}`}
        variant="reject"
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        pending={reject.isPending}
        onConfirm={(reason) => {
          reject.mutate(reason, {
            onSuccess: () => {
              toast.success(t('kybReview.actions.rejectSuccess'))
              setRejectOpen(false)
            },
            onError: handleError,
          })
        }}
      />

      <ReasonDialog
        key={`correction-${correctionOpen}`}
        variant="correction"
        open={correctionOpen}
        onClose={() => setCorrectionOpen(false)}
        pending={requestCorrection.isPending}
        onConfirm={(reason) => {
          requestCorrection.mutate(reason, {
            onSuccess: () => {
              toast.success(t('kybReview.actions.requestCorrectionSuccess'))
              setCorrectionOpen(false)
            },
            onError: handleError,
          })
        }}
      />
    </div>,
    document.body,
  )
}

/** Placeholder pulsant de la file pendant le chargement. */
function QueueSkeleton() {
  return (
    <>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={cn('flex items-center px-4 py-3.5 gap-4', i < 3 && 'border-b border-theme-border')}>
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-40 rounded bg-theme-hover animate-pulse" />
            <div className="h-2.5 w-24 rounded bg-theme-hover animate-pulse" />
          </div>
          <div className="h-3 w-16 rounded bg-theme-hover animate-pulse" />
          <div className="h-3 w-20 rounded bg-theme-hover animate-pulse" />
        </div>
      ))}
    </>
  )
}

/** État vide : aucun dossier en attente de décision. */
function QueueEmpty() {
  const { t } = useTranslation('admin')
  return (
    <div className="px-4 py-16 text-center">
      <CheckCircle2 className="h-8 w-8 mx-auto text-theme-tertiary mb-3" />
      <p className="text-sm text-theme-secondary font-medium">{t('kybReview.empty.title')}</p>
      <p className="text-xs text-theme-tertiary mt-1">{t('kybReview.empty.subtitle')}</p>
    </div>
  )
}

/** État d'erreur de la liste, avec reprise. */
function QueueError({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation('admin')
  return (
    <div className="px-4 py-16 text-center">
      <AlertTriangle className="h-8 w-8 mx-auto text-red-500 mb-3" />
      <p className="text-sm text-theme-secondary font-medium">{t('kybReview.error.title')}</p>
      <p className="text-xs text-theme-tertiary mt-1 mb-3">{t('kybReview.error.subtitle')}</p>
      <button
        onClick={onRetry}
        className="h-8 px-3 text-xs font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors"
      >
        {t('kybReview.error.retry')}
      </button>
    </div>
  )
}

/** Une ligne de la file — score/statut du filet, jamais une classification devinée
 *  (cf. queueRowSignal). */
function QueueRow({ row, onOpen, isLast }: {
  row: { agencyId: string; agencyName: string; country: string | null; verificationScore: number | null; identitySubmittedAt: string | null; verificationSweepAttempts: number }
  onOpen: () => void
  isLast: boolean
}) {
  const { t } = useTranslation('admin')
  const signal = queueRowSignal(row.verificationScore, row.verificationSweepAttempts)

  return (
    <button
      onClick={onOpen}
      className={cn(
        'flex items-center px-4 py-3.5 w-full text-left gap-4 hover:bg-theme-hover transition-colors',
        !isLast && 'border-b border-theme-border',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-theme-primary truncate">{row.agencyName}</p>
        <p className="text-xs text-theme-tertiary mt-0.5">
          {row.country ?? '—'} · {row.identitySubmittedAt ? formatDate(row.identitySubmittedAt) : '—'}
        </p>
      </div>
      <div className="w-28 text-right">
        {signal === 'sweep_exhausted' ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-500">
            <RotateCw className="h-3.5 w-3.5" />
            {t('kybReview.reason.sweepExhausted.title')}
          </span>
        ) : (
          <span className="text-sm font-medium text-theme-primary tabular-nums">
            {signal === 'score_unknown' ? t('kybReview.scoreNone') : row.verificationScore!.toFixed(3)}
          </span>
        )}
      </div>
    </button>
  )
}

/** Pager de la file — la fenêtre affichée et le total, jamais l'un sans l'autre.
 *  Sans ce total, une page pleine est indiscernable d'une file terminée : c'est
 *  exactement ce qui rendait la troncature invisible avant le correctif étape 6. */
function QueuePager({ view, total, onPrev, onNext }: {
  view: QueuePagerView
  total: number
  onPrev: () => void
  onNext: () => void
}) {
  const { t } = useTranslation('admin')
  const { page, pageCount, rangeStart, rangeEnd, hasPrev, hasNext } = view

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-theme-border">
      <p className="text-xs text-theme-tertiary tabular-nums">
        {t('kybReview.pager.range', { from: rangeStart, to: rangeEnd, total })}
      </p>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className="h-8 px-3 text-xs font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          {t('kybReview.pager.previous')}
        </button>
        <span className="text-xs text-theme-tertiary tabular-nums whitespace-nowrap">
          {t('kybReview.pager.page', { page: page + 1, pageCount })}
        </span>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className="h-8 px-3 text-xs font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
        >
          {t('kybReview.pager.next')}
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

/** Écran : file KYB en manual_review, triée par score, paginée, et le tiroir de détail. */
export default function AdminKybReviewPage() {
  const { t } = useTranslation('admin')
  const [requestedPage, setRequestedPage] = useState(0)
  const { data, isLoading, isError, refetch } = useAdminKybReviewQueue(requestedPage * KYB_REVIEW_PAGE_SIZE)
  const [selectedAgencyId, setSelectedAgencyId] = useState<string | null>(null)

  const rows = data?.rows ?? []
  // Le TOTAL, jamais `rows.length` : c'est la seule information qui distingue « il ne
  // reste que ceux-là » de « la liste s'arrête ici parce que la page est pleine ».
  const total = data?.total ?? 0

  // Calculé depuis le décalage RÉELLEMENT servi, pas depuis celui demandé : trancher
  // les derniers dossiers de la dernière page la vide, et le hook se replie alors sur
  // la dernière page réelle (useAdminKybReview.ts). L'écran n'a donc aucun état à
  // recorriger après coup.
  const pager = queuePagerView(data?.servedOffset ?? 0, rows.length, total, KYB_REVIEW_PAGE_SIZE)

  // Le tiroir ne s'affiche que pour une agence encore PRÉSENTE dans la page
  // fraîchement chargée — dérivé au rendu plutôt que réinitialisé depuis un effet
  // (`setState` synchrone dans un effet re-déclenche un rendu en cascade,
  // react-hooks/set-state-in-effect). Une agence validée/rejetée, ou auto-validée
  // après une relance/résolution, quitte `rows` dès l'invalidation de la file
  // (useAdminKybReview.ts) : le tiroir se referme alors tout seul, sans mécanique
  // dédiée par action. `selectedAgencyId` peut rester temporairement une ancienne
  // valeur "morte" (inoffensif : elle n'est relue qu'ici, et une nouvelle sélection
  // l'écrase).
  const drawerRow = rows.find((r) => r.agencyId === selectedAgencyId) ?? null

  return (
    <PageTransition>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="h-2 w-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-medium text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <h1 className="text-2xl font-semibold text-theme-primary">{t('kybReview.title')}</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {isLoading ? t('common.loading') : t('kybReview.subtitle', { count: total })}
          </p>
        </div>

        <div className="rounded-xl border border-theme-border">
          {isLoading ? (
            <QueueSkeleton />
          ) : isError ? (
            <QueueError onRetry={() => void refetch()} />
          ) : total === 0 ? (
            <QueueEmpty />
          ) : (
            <>
              {rows.map((row, i) => (
                <QueueRow
                  key={row.agencyId}
                  row={row}
                  isLast={i === rows.length - 1}
                  onOpen={() => setSelectedAgencyId(row.agencyId)}
                />
              ))}
              {/* Toujours rendu dès qu'il y a des dossiers, même sur une file d'une
                  seule page : le relecteur doit pouvoir lire « 1-12 sur 12 » et savoir
                  qu'il les a tous vus, pas le déduire d'une absence de bouton. */}
              <QueuePager
                view={pager}
                total={total}
                // Repart de la page SERVIE, jamais de celle demandée : après un repli,
                // les deux diffèrent, et naviguer depuis la demande ferait sauter une page.
                onPrev={() => setRequestedPage(Math.max(0, pager.page - 1))}
                onNext={() => setRequestedPage(Math.min(pager.pageCount - 1, pager.page + 1))}
              />
            </>
          )}
        </div>
      </div>

      {drawerRow && (
        <KybReviewDrawer row={drawerRow} onClose={() => setSelectedAgencyId(null)} />
      )}
    </PageTransition>
  )
}
