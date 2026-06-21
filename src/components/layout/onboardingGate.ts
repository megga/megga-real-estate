import { isAgentRole, type UserProfile } from '@/types/auth'

export type OnboardingGateRedirect =
  | '/dashboard/onboarding'
  | '/dashboard/premier-jour'
  | null

/**
 * Décide la redirection du gate CRM pour un profil donné (pur → testable).
 *
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
  const needsAgency = isAgentRole(profile.role) && !profile.agency_id
  if (profile.onboarding_completed === false || needsAgency) {
    return '/dashboard/onboarding'
  }
  if (profile.first_day_done === false) {
    return '/dashboard/premier-jour'
  }
  return null
}
