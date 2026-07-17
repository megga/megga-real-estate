/**
 * Décision pure (testable, sans effet de bord) de la redirection du gate CRM :
 * onboarding → agence → premier-jour. Consommée par `ProtectedRoute`.
 */
import { isAgentRole, type UserProfile } from '@/types/auth'

export type OnboardingGateRedirect =
  | '/dashboard/onboarding'
  | '/dashboard/premier-jour'
  | null

/**
 * Décide la redirection du gate CRM pour un profil donné (pur → testable).
 *
 * - Super-admin plateforme → JAMAIS de gate (ni onboarding, ni premier-jour) :
 *   il n'a pas de parcours agent, `agency_id` null est légitime, et il lit via
 *   les policies `super_admin`. Sans cette sortie, un super-admin dont
 *   `onboarding_completed` vaut `false` (ex. compte promu par la migration
 *   d'allowlist sans avoir joué l'onboarding) serait piégé dans le wizard agent.
 * - Onboarding pas terminé → wizard onboarding.
 * - Agent (rôle agence) SANS `agency_id` → wizard onboarding. Sans agence, la RLS
 *   le verrouille hors de TOUTES les surfaces du CRM (contacts/biens/pipeline/
 *   matching : policies `agency_id = get_my_agency_id()`/`get_user_agency_id()`).
 *   Il atterrirait sur un dashboard vide et ne pourrait RIEN créer (insert RLS
 *   rejeté), sans aucune explication. L'onboarding force l'étape Agence
 *   (`canNext` step 1 = agence créée/rejointe via `create_agency_and_join`/
 *   `join_agency`) → il en ressort avec un `agency_id`. Les super-admins et les
 *   particuliers (hors `AGENT_ROLES`) ne sont pas concernés : un super-admin a
 *   légitimement `agency_id` null (il lit via les policies `super_admin`).
 * - Premier jour pas joué → écran premier-jour.
 * - Sinon → null (accès CRM autorisé).
 *
 * NB : les routes onboarding/premier-jour elles-mêmes passent `skipOnboardingCheck`
 * (cf ProtectedRoute) → pas de boucle de redirection.
 */
export function resolveOnboardingGate(
  profile: Pick<
    UserProfile,
    'role' | 'agency_id' | 'onboarding_completed' | 'first_day_done'
  >,
): OnboardingGateRedirect {
  // Les super-admins plateforme ne passent jamais par l'onboarding/premier-jour agent.
  if (profile.role === 'super_admin') return null

  const needsAgency = isAgentRole(profile.role) && !profile.agency_id
  if (profile.onboarding_completed === false || needsAgency) {
    return '/dashboard/onboarding'
  }
  if (profile.first_day_done === false) {
    return '/dashboard/premier-jour'
  }
  return null
}
