export type UserRole = 'buyer' | 'seller' | 'particulier' | 'agent' | 'manager' | 'admin' | 'assistant'

export interface UserProfile {
  id: string
  agency_id: string | null
  email: string
  full_name: string
  avatar_url: string | null
  role: UserRole
  phone: string | null
  created_at: string
}

export const AGENT_ROLES: UserRole[] = ['agent', 'manager', 'admin', 'assistant']
export const PARTICULIER_ROLES: UserRole[] = ['buyer', 'seller', 'particulier']

export function isAgentRole(role: UserRole): boolean {
  return AGENT_ROLES.includes(role)
}

export function isParticulierRole(role: UserRole): boolean {
  return PARTICULIER_ROLES.includes(role)
}
