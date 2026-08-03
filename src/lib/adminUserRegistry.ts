/**
 * Dérivations pures du registre Utilisateurs (maquette `admin-users.jsx`).
 *
 * Même grammaire que `src/lib/adminAgencyHealth.ts` : ce module rend des
 * **mots-clés** et des **tons fonctionnels**, jamais une chaîne française ni une
 * couleur. La page tient la table ton → couleur, `t()` traduit à l'écran.
 *
 * ⛔ **Ce module ne décrit AUCUN modèle de droits par rôle**, et c'est mesuré :
 * aucune policy RLS de la base ne mentionne `manager` ni `assistant`, et les
 * lectures métier (`contacts_select`, `kyc_cases_select`) sont scopées par
 * AGENCE, aveugles au rôle. Une notice « ce que ce rôle contrôle » aurait
 * affirmé des restrictions qui n'existent pas — par exemple qu'un agent ne voit
 * pas les dossiers de ses collègues, alors que la policy lui donne toute
 * l'agence. Le seul fait opposable aujourd'hui est l'invitation : l'edge
 * `send-team-invite` refuse tout appelant hors `admin`/`manager`.
 */

/** Anomalie d'un compte. Cascade EXCLUSIVE : un compte ne porte qu'un drapeau. */
export type UserFlagId = 'suspended' | 'noActivity' | 'stale'

/** Au-delà de ce nombre de jours sans activité, un compte est « dormant ». */
export const STALE_DAYS_MIN = 30

/** Ordre d'affichage des chips d'anomalie — du plus grave au moins grave. */
export const USER_FLAG_ORDER: readonly UserFlagId[] = ['suspended', 'noActivity', 'stale']

export const USER_FLAG_KEY: Record<UserFlagId, string> = {
  suspended: 'users.flags.suspended',
  noActivity: 'users.flags.noActivity',
  stale: 'users.flags.stale',
}

export const USER_FLAG_TONE: Record<UserFlagId, 'err' | 'warn'> = {
  suspended: 'err',
  noActivity: 'warn',
  stale: 'warn',
}

export interface UserFlagInput {
  suspended: boolean
  last: string | null
  stale_days: number | null
}

/**
 * Anomalie d'un compte, ou `null`.
 *
 * ⚠ Cascade exclusive et ORDONNÉE : un compte suspendu et dormant sort
 * « suspendu ». Aucun compte de production n'exerce ce croisement — c'est
 * précisément pourquoi il est testé plutôt que laissé à l'implémentation.
 */
export function userFlag(u: UserFlagInput): UserFlagId | null {
  if (u.suspended) return 'suspended'
  if (u.last == null) return 'noActivity'
  if ((u.stale_days ?? 0) >= STALE_DAYS_MIN) return 'stale'
  return null
}

/** Rôles d'organisation, dans l'ordre hiérarchique de la maquette. */
export const ORG_ROLES = ['super_admin', 'admin', 'manager', 'agent', 'assistant'] as const

/**
 * Clé i18n d'un rôle.
 *
 * ⚠ `admin_set_user_role` en accepte HUIT : les trois derniers sont des rôles de
 * clients finaux, qui existent en base et doivent donc s'afficher — mais ne sont
 * jamais proposés au changement (voir `ORG_ROLES`).
 */
export const ROLE_LABEL_KEY: Record<string, string> = {
  super_admin: 'common.role.superAdmin',
  admin: 'common.role.admin',
  manager: 'common.role.manager',
  agent: 'common.role.agent',
  assistant: 'common.role.assistant',
  buyer: 'users.role.buyer',
  seller: 'users.role.seller',
  particulier: 'users.role.particulier',
}

/** Rang de tri d'un rôle. ⚠ `999` pour un rôle hors organisation : sans ce
 *  repli, `indexOf` rend `-1` et un comparateur qui soustrait des `NaN` rend un
 *  tri INDÉFINI — la base porte justement un profil `buyer`. */
function roleRank(role: string): number {
  const i = (ORG_ROLES as readonly string[]).indexOf(role)
  return i === -1 ? 999 : i
}

/**
 * Nom affichable.
 *
 * ⛔ Teste la chaîne VIDE, pas `null`. Mesuré : deux profils sur sept portent
 * `full_name = ''`, jamais `NULL` — un `?? fallback` est donc mort, et laissait
 * la ligne sans nom avec un `aria-label` vide.
 */
export function displayName(name: string | null | undefined, fallback: string): string {
  return (name ?? '').trim() || fallback
}

export interface UserSortInput {
  agency: string | null
  role: string
  name: string | null
}

/** Par agence (les comptes sans agence en dernier), puis rang de rôle, puis nom. */
export function compareUsers(a: UserSortInput, b: UserSortInput): number {
  const sansA = a.agency ? 0 : 1
  const sansB = b.agency ? 0 : 1
  return (
    sansA - sansB ||
    (a.agency ?? '').localeCompare(b.agency ?? '', 'fr') ||
    roleRank(a.role) - roleRank(b.role) ||
    displayName(a.name, '').localeCompare(displayName(b.name, ''), 'fr')
  )
}

export type ActivityKind = 'none' | 'stale' | 'recent'

/** Comment présenter la dernière activité d'un compte. */
export function activityView(u: { last: string | null; stale_days: number | null }): {
  kind: ActivityKind
  at: string | null
} {
  if (u.last == null) return { kind: 'none', at: null }
  return { kind: (u.stale_days ?? 0) >= STALE_DAYS_MIN ? 'stale' : 'recent', at: u.last }
}

export interface ConsentRow {
  type?: string
  version?: string
  accepted_at?: string
}

export type ConsentState =
  | { kind: 'accepted'; version: string | null; at: string | null }
  | { kind: 'notRecorded' }
  | { kind: 'notAsked' }

/**
 * État des consentements nLPD d'un compte.
 *
 * ⚠ La RPC rend le tableau **le plus récent d'abord** (`order by accepted_at
 * desc`) : on prend donc la PREMIÈRE ligne d'un type, jamais la dernière. Sans
 * ça, le panneau afficherait la plus ANCIENNE acceptation — une version périmée,
 * datée d'une version périmée. Invisible aujourd'hui (une seule version en
 * base), le défaut apparaîtrait le jour où de nouvelles CGU sont posées,
 * c'est-à-dire quand ce panneau doit être juste.
 *
 * ⛔ Le marketing ne rend JAMAIS « refusé ». Mesuré : aucun chemin d'inscription
 * ne pose de case marketing — `marketing_consent` n'est écrit nulle part, et la
 * seule case de la vitrine couvre les CGU et la confidentialité. Rendre
 * « non accepté » affirmerait un refus que personne n'a jamais eu l'occasion de
 * formuler : c'est « jamais demandé », et rien d'autre.
 */
export function consentView(consents: ConsentRow[] | null | undefined, marketing: boolean): {
  terms: ConsentState
  privacy: ConsentState
  marketing: ConsentState
} {
  const rows = Array.isArray(consents) ? consents : []
  const dernier = (type: string): ConsentState => {
    const r = rows.find(c => c.type === type)
    return r ? { kind: 'accepted', version: r.version ?? null, at: r.accepted_at ?? null } : { kind: 'notRecorded' }
  }
  return {
    terms: dernier('terms'),
    privacy: dernier('privacy'),
    marketing: marketing ? { kind: 'accepted', version: null, at: null } : { kind: 'notAsked' },
  }
}
