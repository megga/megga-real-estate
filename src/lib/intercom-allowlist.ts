// src/lib/intercom-allowlist.ts
// Garde-fou LPD EXÉCUTABLE. La frontière « aucune donnée client final ne part vers
// Intercom » (workspace US, flag nLPD) ne doit pas reposer que sur des commentaires :
// toute donnée envoyée à Intercom (boot/update) passe par cette allowlist, et une clé
// non listée est STRIPPÉE avant d'atteindre le SDK (fail-safe : en cas de doute, on coupe).
//
// Pour AUTORISER un nouvel attribut : l'ajouter ici EN CONSCIENCE — et JAMAIS une donnée
// dérivée d'un client final de l'agent (contact, affaire, KYC, message). Intercom ne voit
// que les attributs SaaS de l'agent / de son agence.
//
// Module volontairement SANS dépendance au SDK → testable seul (tests/unit/intercom-lpd-allowlist.test.ts).
// Appliqué par src/lib/intercom.ts (bootIntercom / updateIntercom).

/** Clés autorisées au niveau utilisateur/boot (attributs SaaS de l'agent + config SDK). */
export const INTERCOM_ALLOWED_KEYS = [
  'app_id',
  'region',
  'user_id',
  'email',
  'name',
  'created_at',
  'intercom_user_jwt',
  'role',
  'canton',
  'onboarding_completed',
  'company',
] as const

/** Clés autorisées dans l'objet `company` (données de l'AGENCE SaaS — jamais d'un client). */
export const INTERCOM_ALLOWED_COMPANY_KEYS = ['company_id', 'name', 'stripe_customer_id'] as const

const USER_SET: ReadonlySet<string> = new Set(INTERCOM_ALLOWED_KEYS)
const COMPANY_SET: ReadonlySet<string> = new Set(INTERCOM_ALLOWED_COMPANY_KEYS)

export interface SanitizeResult {
  sanitized: Record<string, unknown>
  /** Clés rejetées (chemin `company.xxx` pour les sous-clés) — à logger en dev. */
  dropped: string[]
}

/** Ne laisse passer que les clés allowlistées (récursif sur `company`). */
export function sanitizeIntercomArgs(args: Record<string, unknown> = {}): SanitizeResult {
  const sanitized: Record<string, unknown> = {}
  const dropped: string[] = []

  for (const [key, value] of Object.entries(args)) {
    if (!USER_SET.has(key)) {
      dropped.push(key)
      continue
    }
    if (key === 'company' && value && typeof value === 'object' && !Array.isArray(value)) {
      const company: Record<string, unknown> = {}
      for (const [ck, cv] of Object.entries(value as Record<string, unknown>)) {
        if (!COMPANY_SET.has(ck)) {
          dropped.push(`company.${ck}`)
          continue
        }
        company[ck] = cv
      }
      sanitized[key] = company
    } else {
      sanitized[key] = value
    }
  }

  return { sanitized, dropped }
}
