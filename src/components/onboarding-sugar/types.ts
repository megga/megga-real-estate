// MEGGA Onboarding — Types partagés
// Source : handoff-onboarding/HANDOFF_ONBOARDING_CLAUDE_CODE.md §"Modèle de données"

export type ObAgency = {
  id: string
  name: string
  city: string
  canton: string
  agents: number
  since: number
  initials: string
  tint: string
}

export type AgenceMode = 'search' | 'create'
export type AgentRole = 'courtier' | 'direction' | 'admin' | 'stagiaire'
export type Language = 'fr' | 'en' | 'de' | 'it' | 'es' | 'pt'
export type Plan = 'free' | 'pro' | null
export type Billing = 'monthly' | 'yearly'

export type AgenceCreated = {
  name: string
  city: string
  canton: string
  solo: boolean
}

export type AgenceProfile = {
  name: string
  city: string
  canton: string
  street: string
  npa: string
  phone: string
  website: string
  logo: string | null
}

export type AgentProfile = {
  firstName: string
  lastName: string
  avatar: string | null
  role: AgentRole
  phone: string
  languages: Language[]
}

export type OnboardingData = {
  agenceMode: AgenceMode
  agenceQuery: string
  agenceSelected: ObAgency | null
  agenceSent: boolean
  agenceValidated: boolean
  agenceCreated: AgenceCreated | null
  /** Set after a successful `create_agency_and_join` RPC. */
  agenceCreatedId: string | null
  _agenceDone: boolean
  agenceProfile?: AgenceProfile
  agentProfile?: AgentProfile
  plan: Plan
  billing: Billing
}

export const INITIAL_DATA: OnboardingData = {
  agenceMode: 'search',
  agenceQuery: '',
  agenceSelected: null,
  agenceSent: false,
  agenceValidated: false,
  agenceCreated: null,
  agenceCreatedId: null,
  _agenceDone: false,
  plan: 'pro',
  billing: 'monthly',
}

export type Setter = (patch: Partial<OnboardingData>) => void
