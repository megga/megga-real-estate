/**
 * Types et helpers du profil utilisateur / rôles.
 *
 * Deux familles de rôles cohabitent : côté agence (agent/manager/admin/assistant)
 * et côté particulier (buyer/seller/particulier), plus `super_admin`. Les helpers
 * `isAgentRole` / `isParticulierRole` servent au routage et aux gardes d'accès.
 */

/** Rôle applicatif d'un compte (source : colonne `role` du profil). */
export type UserRole = 'buyer' | 'seller' | 'particulier' | 'agent' | 'manager' | 'admin' | 'assistant' | 'super_admin'

/** Profil utilisateur tel que stocké dans la table `profiles` (miroir de la ligne DB). */
export interface UserProfile {
  id: string
  agency_id: string | null
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  phone: string | null
  canton: string | null
  created_at: string
}

/** Rôles donnant accès au CRM agent. */
export const AGENT_ROLES: UserRole[] = ['agent', 'manager', 'admin', 'assistant']
/** Rôles côté particulier (acheteur/vendeur, hors CRM agent). */
export const PARTICULIER_ROLES: UserRole[] = ['buyer', 'seller', 'particulier']

/** True si le rôle appartient à l'espace agence (utilisé pour le routage post-login). */
export function isAgentRole(role: UserRole): boolean {
  return AGENT_ROLES.includes(role)
}

/** True si le rôle relève de l'espace particulier. */
export function isParticulierRole(role: UserRole): boolean {
  return PARTICULIER_ROLES.includes(role)
}
