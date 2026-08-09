// supabase/functions/_shared/personal-data-estate.ts
//
// Déclaration UNIQUE de ce que MEGGA détient sur une personne, et de ce que
// chacun des deux droits en fait. Lue par `admin-dsar-export` (art. 25 nLPD —
// accès) et `delete-account` (art. 32 — effacement).
//
// POURQUOI CE FICHIER. Avant lui, les deux fonctions énuméraient leurs tables
// chacune de son côté, et elles avaient DIVERGÉ : recoupement sur deux tables
// (`profiles`, `activity_events`), désaccord sur tout le reste. Une personne
// pouvait donc exporter ce qui n'était jamais effacé, et l'effacement portait
// sur ce qui n'avait jamais été exportable. Aucune des deux listes n'était
// fausse en soi — c'est leur écart qui l'était, et rien ne le montrait.
//
// ── La ligne de partage n'est PAS « compte vs métier » ──────────────────────
//
// L'en-tête d'origine de `admin-dsar-export` écartait « les données MÉTIER
// d'agence (contacts, transactions…) ». L'intention est juste, la formulation
// range mal. Le critère qui décide est le RÔLE de MEGGA :
//
//   * SOUS-TRAITANT (contacts, transactions) — le responsable du traitement est
//     l'agence. La personne exerce ses droits AUPRÈS D'ELLE, et le registre le
//     dit déjà (activité n°2). Hors périmètre des deux fonctions, à raison.
//   * RESPONSABLE (profil, consentements, KYB du dirigeant, appel d'accueil) —
//     c'est MEGGA qu'on interroge. Doit figurer aux deux endroits.
//
// `agency_related_persons` tombe du côté RESPONSABLE : le registre (activité
// n°13) décrit MEGGA vérifiant le dirigeant d'une agence candidate pour son
// propre compte, avant d'ouvrir l'accès. Sa date de naissance et son numéro de
// pièce ne sont pas « des données métier de l'agence ».
//
// ── La symétrie n'est PAS l'égalité des deux listes ─────────────────────────
//
// Certaines divergences sont CORRECTES et doivent le rester :
// `agency_id_document_purges` doit être exportable (elle dit à la personne que
// sa pièce a été détruite, quand et pourquoi) mais ne doit JAMAIS être effacée
// — effacer la preuve d'effacement la supprime en tant que preuve. D'où
// `divergence`, OBLIGATOIRE dès que `access` et `erasure` ne s'accordent pas :
// l'écart reste permis, le silence ne l'est plus.

/** Ce que l'effacement fait d'une table. */
export type ErasureAction =
  /** Les colonnes identifiantes sont neutralisées, la ligne et son sens restent. */
  | 'anonymise'
  /** La ligne part. */
  | 'delete'
  /** Conservée délibérément — `divergence` doit dire au nom de quoi. */
  | 'retain'

export interface EstateEntry {
  table: string
  /** Colonne qui rattache une ligne au sujet (un `profiles.id`). */
  subjectColumn: string
  /** Décide qui la personne doit interroger — voir l'en-tête. */
  role: 'controller' | 'processor'
  /** Figure dans l'export DSAR. */
  access: boolean
  erasure: ErasureAction
  /** OBLIGATOIRE quand `access` et `erasure` ne racontent pas la même chose. */
  divergence?: string
}

export const PERSONAL_DATA_ESTATE: readonly EstateEntry[] = [
  {
    table: 'profiles',
    subjectColumn: 'id',
    role: 'controller',
    access: true,
    erasure: 'anonymise',
  },
  {
    table: 'user_consents',
    subjectColumn: 'user_id',
    role: 'controller',
    access: true,
    erasure: 'retain',
    divergence:
      'Preuve que le consentement a été donné, et sous quelle version. L\'effacer supprimerait la trace de la LICÉITÉ du traitement passé, pas seulement la donnée.',
  },
  {
    table: 'user_devices',
    subjectColumn: 'user_id',
    role: 'controller',
    access: true,
    erasure: 'retain',
    divergence:
      'ÉCART NON RÉSOLU, déclaré ici pour cesser d\'être invisible : empreinte, navigateur, ville et pays survivent à la suppression du compte sans motif de conservation écrit. À trancher — ni élargir ni corriger dans le lot accès/effacement du 07.08.2026.',
  },
  {
    table: 'auth_events',
    subjectColumn: 'user_id',
    role: 'controller',
    access: true,
    erasure: 'retain',
    divergence:
      'Journal de sécurité (connexions, échecs). Conservé au titre de la traçabilité des accès ; l\'identifiant reste, la charge utile est déjà hachée (`ip_hash`).',
  },
  {
    table: 'activity_events',
    subjectColumn: 'actor_id',
    role: 'controller',
    access: true,
    erasure: 'anonymise',
  },
  {
    table: 'agency_related_persons',
    subjectColumn: 'profile_id',
    role: 'controller',
    access: true,
    erasure: 'anonymise',
    divergence:
      'Anonymisée et non supprimée : le verdict de vérification est append-only et doit rester interprétable. On retire l\'identité (naissance, nationalité, type et NUMÉRO de pièce), on garde le fait qu\'une vérification a eu lieu. ⚠ `profile_id` est `on delete set null` et le compte est ANONYMISÉ (jamais supprimé) : la cascade ne se déclenche donc jamais, et sans ce traitement explicite la PII survivrait — désormais orpheline, donc pire.',
  },
  {
    table: 'onboarding_calls',
    subjectColumn: 'booked_by',
    role: 'controller',
    access: true,
    erasure: 'anonymise',
    divergence:
      'Objet de PLATEFORME (MEGGA ↔ agence), explicitement hors tenant — donc MEGGA est responsable, pas sous-traitant. `booked_by` est `on delete cascade`, mais le compte étant anonymisé et non supprimé la cascade ne joue pas : `attendee_phone` et `attendee_note` doivent être retirés à la main.',
  },
  {
    table: 'agency_id_document_purges',
    subjectColumn: 'related_person_id',
    role: 'controller',
    access: true,
    erasure: 'retain',
    divergence:
      'PREUVE D\'EFFACEMENT. Dit à la personne que sa pièce d\'identité a été détruite, quand et pour quel motif. L\'effacer supprimerait la preuve en tant que preuve — et c\'est précisément au moment où le compte disparaît qu\'elle doit pouvoir être produite. Sans FK ni cascade par construction.',
  },
] as const

/** Tables exportées au titre du droit d'accès. */
export const ACCESS_TABLES = PERSONAL_DATA_ESTATE.filter((e) => e.access)

/** Tables sur lesquelles l'effacement agit réellement. */
export const ERASURE_TABLES = PERSONAL_DATA_ESTATE.filter((e) => e.erasure !== 'retain')

/**
 * Entrées mal déclarées : un écart entre accès et effacement sans justification
 * écrite. Le test unitaire échoue dessus — c'est le seul garde-fou qui empêche
 * les deux listes de re-diverger en silence.
 */
export function undeclaredDivergences(): EstateEntry[] {
  return PERSONAL_DATA_ESTATE.filter(
    (e) => (e.access && e.erasure === 'retain') && !e.divergence?.trim(),
  )
}
