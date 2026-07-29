// Aiguillage post-login. Séparé de AuthCallbackPage pour que la page n'exporte
// que son composant (Fast Refresh) — et parce que la règle est testée seule
// (tests/unit/auth-callback-redirect.spec.ts), sans monter la page.

import { isAgentRole } from '@/types/auth'
import type { UserRole } from '@/types/auth'

/**
 * Destination post-login selon le rôle.
 *
 * `super_admin` est traité à part parce qu'il n'est PAS dans `AGENT_ROLES` — la
 * liste décrit des rôles d'AGENCE, et un super-admin est un rôle de plateforme
 * (son `agency_id` est NULL). Il travaille pourtant dans le CRM : la console
 * admin s'ouvre DEPUIS le CRM et n'a pas de porte d'entrée propre.
 *
 * Sans ce cas il retombait sur `/portal`, devenu une redirection vers la vitrine
 * au retrait du portail vendeur (26 juil. 2026) : connexion réussie, écran de
 * chargement, puis renvoi hors de l'app sans le moindre message. Les deux
 * comptes super_admin ne pouvaient plus entrer.
 *
 * ⚠ `/portal` reste un cul-de-sac pour les rôles particuliers (`buyer`,
 * `seller`, `particulier`) : le portail n'existe plus et rien ne l'a remplacé
 * dans cette app devenue CRM-seul. Un compte `buyer` subsiste en base et vit
 * donc le même aller-retour muet. Trancher ce qu'on leur montre est une décision
 * produit, pas un correctif de routage — laissé tel quel volontairement.
 */
export function getRedirectPath(role: UserRole): string {
  if (isAgentRole(role) || role === 'super_admin') return '/dashboard'
  return '/portal'
}

/**
 * Destination quand le rôle du profil n'a PAS pu être lu (REST hors délai,
 * verrou `navigator.locks` tenu par un autre onglet, coupure).
 *
 * On entre alors dans le CRM au lieu de retomber sur la branche par défaut
 * `/portal` : le portail est un cul-de-sac depuis son retrait, donc y envoyer un
 * agent sur un simple aléa réseau l'éjecte de l'app sans retour — et l'alternative
 * (tenir l'écran d'arrivée jusqu'à la lecture) est précisément la panne du
 * 29 juil. 2026. Aucune surface du CRM n'est gatée par ce rôle-là de toute façon :
 * c'est RLS qui décide de ce qui s'affiche.
 *
 * Le rôle porté par `user_metadata` reste prioritaire quand il est exploitable —
 * un `buyer` déclaré à l'inscription n'a rien à faire dans le CRM, même en
 * dégradé. `super_admin` en est exclu à dessein : il n'est jamais auto-déclaré,
 * il se lit en base.
 */
export function getRedirectPathWithoutProfile(metadataRole: string | null | undefined): string {
  const claimable: UserRole[] = ['buyer', 'seller', 'particulier', 'agent', 'manager', 'admin', 'assistant']
  return claimable.includes(metadataRole as UserRole)
    ? getRedirectPath(metadataRole as UserRole)
    : '/dashboard'
}
