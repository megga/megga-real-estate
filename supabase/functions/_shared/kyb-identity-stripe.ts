// Vérification d'identité du dirigeant par Stripe Identity (KYB, étape 3).
// Pur et testable sans réseau : conversion des formes Stripe, correspondance avec la
// personne DÉCLARÉE, verdict. Les exécuteurs impurs sont
// supabase/functions/kyb-identity-verify/index.ts (création de la session) et le
// webhook stripe-webhook (traitement du résultat).
//
// ── Pourquoi un vendeur plutôt que la lecture par modèle ────────────────────────────
//
// Le socle l'attendait : `verification_check_types.id_document` est libellé « Pièce
// d'identité ET DÉTECTION DU VIVANT » et `agency_person_verification_checks.source`
// autorise `id_vendor` depuis l'origine — sans qu'aucun code ne l'écrive. Un OCR lit ce
// qui est imprimé ; il ne distingue pas une carte d'une impression, et ne vérifie pas
// que la personne est présente. Stripe Identity fait les deux (authenticité du
// document + selfie comparé à la photo).
//
// Effet de bord principal, et c'est le plus important : **l'image ne transite plus par
// MEGGA**. Le dossier `documents/{agence}/kyb-identity/` — sans rétention, sans purge,
// sans propriétaire — cesse d'être alimenté. La question de sa purge ne se résout pas,
// elle disparaît pour tout dossier passé par ce chemin.
//
// ── ⚠ La limite à connaître avant de lire le reste ──────────────────────────────────
//
// `options.document.allowed_types` de Stripe ne connaît que `driving_license`,
// `id_card` et `passport`. **Il n'y a PAS de titre de séjour.** À Genève, une part
// notable des dirigeants d'agence sont des ressortissants étrangers dont la pièce
// suisse est un livret B/C. Ils devront présenter leur PASSEPORT d'origine — ce qui
// reste une pièce valable, mais ce n'est pas la même demande.
// C'est la raison pour laquelle le dépôt manuel (StepPieceIdentite + kyb-id-read.ts)
// n'est pas retiré : il devient le chemin de SECOURS, pas un vestige.

import {
  compareBirthDate,
  compareName,
  deriveVerdict,
  type KybDeclaredIdentity,
  type KybIdFieldVerdict,
  type KybIdVerdict,
} from './kyb-id-read.ts'

/** Statuts d'une VerificationSession Stripe. */
export type StripeVerificationStatus = 'requires_input' | 'processing' | 'verified' | 'canceled'

export const STRIPE_VERIFICATION_STATUSES: readonly StripeVerificationStatus[] = [
  'requires_input', 'processing', 'verified', 'canceled',
]

/** Vrai si cette chaîne est un statut de session que la colonne accepte. */
export function isStripeVerificationStatus(value: unknown): value is StripeVerificationStatus {
  return typeof value === 'string'
    && (STRIPE_VERIFICATION_STATUSES as readonly string[]).includes(value)
}

/** Une date Stripe (`dob`, `expiration_date`) : trois entiers, jamais une chaîne. */
export interface StripeDateParts {
  day?: number | null
  month?: number | null
  year?: number | null
}

/**
 * Les seules données que MEGGA retient d'une vérification réussie.
 *
 * ⚠ Ni le nom, ni le prénom, ni la date de naissance, ni le NUMÉRO du document ne
 * figurent ici — seulement des verdicts de correspondance avec la ligne déjà déclarée.
 * Même règle que la lecture par modèle (kyb-id-read.ts) et même raison : dupliquer une
 * PII pour dire qu'elle correspond à elle-même crée une seconde copie à protéger, à
 * purger et à justifier, sans rien apporter. Stripe conserve l'original de son côté et
 * sait le supprimer sur demande (endpoint `redact`).
 */
export interface StripeIdentityRecord {
  /** Toujours 'stripe_identity' — journalisé pour distinguer d'un verdict de kyb-id-read. */
  provider: 'stripe_identity'
  sessionId: string
  status: StripeVerificationStatus
  /** Correspondance des champs vérifiés avec la personne déclarée à l'étape 1. */
  verdict: KybIdVerdict
  fields: {
    firstName: KybIdFieldVerdict
    lastName: KybIdFieldVerdict
    dateOfBirth: KybIdFieldVerdict
  }
  /** Nature du document présenté, dans le vocabulaire de la colonne id_document_type. */
  documentType: 'passport' | 'id_card' | 'other' | null
  /** Pays émetteur (ISO 3166-1 alpha-2), tel que rendu par le rapport. */
  issuingCountry: string | null
  expiresOn: string | null
  /** true si le document était périmé au jour du traitement. null = échéance inconnue. */
  expired: boolean | null
  /** `last_error.code` de Stripe quand la session demande une reprise, sinon null. */
  errorCode: string | null
}

/**
 * Trois entiers Stripe -> 'YYYY-MM-DD'. null dès qu'un des trois manque : une date
 * partielle n'est pas une date, et la compléter d'un 1er janvier inventerait une donnée
 * qu'un dossier de conformité ne doit jamais porter.
 */
export function stripeDateToIso(parts: StripeDateParts | null | undefined): string | null {
  if (!parts) return null
  const { year, month, day } = parts
  if (typeof year !== 'number' || typeof month !== 'number' || typeof day !== 'number') return null
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/**
 * Vocabulaire Stripe -> vocabulaire de la colonne `id_document_type`.
 *
 * `driving_license` tombe sur `other` et non sur une valeur inventée : le CHECK en base
 * (20260729150200) ne connaît que passport | id_card | residence_permit | other, et un
 * permis de conduire n'est aucune des trois premières.
 *
 * ⚠ Ce cas est DÉFENSIF, pas nominal : `kyb-identity-verify` ne l'autorise pas
 * (`allowed_types: ['passport','id_card']` — un permis n'est pas un document
 * d'identité au sens d'un dossier LAB suisse). Il reste traité parce qu'une session
 * ouverte autrement — un flux configuré dans le tableau de bord Stripe, un essai
 * manuel — peut en produire un, et qu'un webhook ne doit jamais échouer sur une
 * valeur que le vendeur a le droit d'émettre.
 *
 * ⚠ `residence_permit` n'a AUCUN antécédent Stripe (cf. l'en-tête) : cette valeur ne
 * peut venir que du chemin de secours manuel.
 */
export function mapStripeDocumentType(
  type: string | null | undefined,
): StripeIdentityRecord['documentType'] {
  if (type === 'passport') return 'passport'
  if (type === 'id_card') return 'id_card'
  if (type === 'driving_license') return 'other'
  return null
}

/** Ce que l'appelant extrait de la session et de son rapport avant d'appeler buildStripeIdentityRecord. */
export interface StripeVerificationInput {
  sessionId: string
  status: StripeVerificationStatus
  /** `verified_outputs` (session développée). Absent tant que la session n'est pas vérifiée. */
  firstName?: string | null
  lastName?: string | null
  dob?: StripeDateParts | null
  /** Champs du `document` du dernier VerificationReport. */
  documentType?: string | null
  issuingCountry?: string | null
  expirationDate?: StripeDateParts | null
  /** `last_error.code`. */
  errorCode?: string | null
}

/**
 * Construit la ligne à persister.
 *
 * La comparaison réutilise TELLES QUELLES les fonctions de kyb-id-read.ts : normalisation
 * des accents et des séparateurs, prénom composé partiellement déclaré traité en
 * `approx`, aucune tolérance sur le jour de naissance. Un dirigeant ne doit pas obtenir
 * deux verdicts différents selon le chemin qui a lu sa pièce.
 *
 * `today` est un paramètre, comme partout dans ce chantier : la péremption est la seule
 * sortie dépendante du temps, et un test qui la lirait sur l'horloge réelle deviendrait
 * faux tout seul.
 */
export function buildStripeIdentityRecord(
  input: StripeVerificationInput,
  declared: KybDeclaredIdentity,
  today: string,
): StripeIdentityRecord {
  const fields = {
    firstName: compareName(input.firstName ?? '', declared.firstName),
    lastName: compareName(input.lastName ?? '', declared.lastName),
    dateOfBirth: compareBirthDate(stripeDateToIso(input.dob), declared.dateOfBirth),
  }
  const expiresOn = stripeDateToIso(input.expirationDate)
  return {
    provider: 'stripe_identity',
    sessionId: input.sessionId,
    status: input.status,
    verdict: deriveVerdict(fields),
    fields,
    documentType: mapStripeDocumentType(input.documentType),
    issuingCountry: input.issuingCountry ?? null,
    expiresOn,
    // Comparaison de chaînes ISO : 'YYYY-MM-DD' s'ordonne lexicographiquement, et le
    // jour de l'échéance compte encore comme valable.
    expired: expiresOn ? expiresOn < today : null,
    errorCode: input.errorCode ?? null,
  }
}

/**
 * Les codes `last_error.code` que l'écran sait expliquer, et pour lesquels il existe une
 * phrase traduite. Tout autre code retombe sur un message générique plutôt que d'être
 * affiché brut : `selfie_document_missing_photo` n'a aucun sens pour un dirigeant.
 *
 * `consent_declined` et `country_not_supported` sont les deux qui doivent renvoyer vers
 * le dépôt manuel — dans ces deux cas Stripe ne pourra JAMAIS aboutir, insister
 * enfermerait l'utilisateur dans une boucle.
 */
export const STRIPE_IDENTITY_ERROR_CODES = [
  'consent_declined',
  'under_supported_age',
  'country_not_supported',
  'document_expired',
  'document_type_not_supported',
  'document_unverified_other',
  'selfie_face_mismatch',
  'selfie_manipulated',
  'selfie_document_missing_photo',
  'selfie_unverified_other',
  'abandoned',
] as const

export type StripeIdentityErrorCode = typeof STRIPE_IDENTITY_ERROR_CODES[number]

/** Le code s'il est connu, sinon 'unknown' — jamais le code brut de Stripe à l'écran. */
export function knownErrorCode(code: string | null | undefined): StripeIdentityErrorCode | 'unknown' {
  return (STRIPE_IDENTITY_ERROR_CODES as readonly string[]).includes(code ?? '')
    ? (code as StripeIdentityErrorCode)
    : 'unknown'
}

/**
 * Vrai si ce refus est DÉFINITIF pour Stripe : réessayer ne changera rien, il faut
 * offrir le dépôt manuel. Distinguer les deux est ce qui évite la boucle où
 * l'utilisateur relance une vérification que le vendeur refusera à l'identique.
 */
export function requiresManualFallback(code: string | null | undefined): boolean {
  return code === 'consent_declined' || code === 'country_not_supported' || code === 'under_supported_age'
}
