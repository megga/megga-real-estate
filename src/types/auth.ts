export type UserRole = 'buyer' | 'seller' | 'particulier' | 'agent' | 'manager' | 'admin' | 'assistant' | 'super_admin'

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
  onboarding_completed: boolean
  onboarding_step: number
  // Premier jour (Day 0 calibration) — one-shot après l'onboarding wizard.
  // Voir handoff-premier-jour/HANDOFF_PREMIER_JOUR_CLAUDE_CODE.md.
  first_day_done: boolean
}

export const AGENT_ROLES: UserRole[] = ['agent', 'manager', 'admin', 'assistant']
export const PARTICULIER_ROLES: UserRole[] = ['buyer', 'seller', 'particulier']

export function isAgentRole(role: UserRole): boolean {
  return AGENT_ROLES.includes(role)
}

export function isParticulierRole(role: UserRole): boolean {
  return PARTICULIER_ROLES.includes(role)
}
