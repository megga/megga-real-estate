/**
 * Catalogue des plans d'abonnement (Starter / Pro / Entreprise).
 *
 * Deux structures distinctes à ne pas confondre : `PLANS` = données d'affichage
 * (prix + liste de features pour la table de pricing), `PLAN_LIMITS` = quotas et
 * feature-flags consommés côté enforcement (gating des fonctionnalités).
 */

export interface PlanFeature {
  key: string
  label: string
  included: boolean
  limit?: number
}

export interface PlanConfig {
  id: string
  name: string
  price_monthly: number
  price_yearly: number
  features: PlanFeature[]
}

/** Données d'affichage de la table de pricing (prix mensuel/annuel + features par plan). */
export const PLANS: PlanConfig[] = [
  {
    id: 'starter',
    name: 'Starter',
    price_monthly: 0,
    price_yearly: 0,
    features: [
      { key: 'contacts', label: 'Contacts', included: true, limit: 50 },
      { key: 'properties', label: 'Biens actifs', included: true, limit: 5 },
      { key: 'ai_copilot', label: 'MEGGA AI Copilot', included: true, limit: 20 },
      { key: 'virtual_staging', label: 'Virtual Staging', included: false },
      { key: 'floor_plan', label: 'Plan interactif', included: false },
      { key: 'calendar_sync', label: 'Sync calendrier', included: false },
      { key: 'kyc_screening', label: 'Screening PEP/Sanctions', included: true, limit: 5 },
      { key: 'matching', label: 'Matching acheteurs', included: true },
      { key: 'seller_portal', label: 'Portail vendeur', included: false },
      { key: 'csv_import', label: 'Import CSV', included: true },
      { key: 'team_members', label: 'Membres equipe', included: true, limit: 1 },
      { key: 'support', label: 'Support', included: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 89,
    price_yearly: 71,
    features: [
      { key: 'contacts', label: 'Contacts', included: true, limit: 500 },
      { key: 'properties', label: 'Biens actifs', included: true, limit: 50 },
      { key: 'ai_copilot', label: 'MEGGA AI Copilot', included: true, limit: 200 },
      { key: 'virtual_staging', label: 'Virtual Staging', included: true, limit: 50 },
      { key: 'floor_plan', label: 'Plan interactif', included: true },
      { key: 'calendar_sync', label: 'Sync calendrier', included: true },
      { key: 'kyc_screening', label: 'Screening PEP/Sanctions', included: true, limit: 50 },
      { key: 'matching', label: 'Matching acheteurs', included: true },
      { key: 'seller_portal', label: 'Portail vendeur', included: true },
      { key: 'csv_import', label: 'Import CSV', included: true },
      { key: 'team_members', label: 'Membres equipe', included: true, limit: 5 },
      { key: 'support', label: 'Support prioritaire', included: true },
    ],
  },
  {
    id: 'entreprise',
    name: 'Entreprise',
    price_monthly: 249,
    price_yearly: 199,
    features: [
      { key: 'contacts', label: 'Contacts', included: true },
      { key: 'properties', label: 'Biens actifs', included: true },
      { key: 'ai_copilot', label: 'MEGGA AI Copilot', included: true },
      { key: 'virtual_staging', label: 'Virtual Staging', included: true, limit: 200 },
      { key: 'floor_plan', label: 'Plan interactif', included: true },
      { key: 'calendar_sync', label: 'Sync calendrier', included: true },
      { key: 'kyc_screening', label: 'Screening PEP/Sanctions', included: true },
      { key: 'matching', label: 'Matching acheteurs', included: true },
      { key: 'seller_portal', label: 'Portail vendeur', included: true },
      { key: 'csv_import', label: 'Import CSV', included: true },
      { key: 'team_members', label: 'Membres equipe', included: true },
      { key: 'support', label: 'Support dedie', included: true },
    ],
  },
]

/** Quotas + feature-flags par plan, consommés côté gating (`Infinity` = illimité). */
export const PLAN_LIMITS = {
  starter: {
    maxProperties: 10,
    maxContacts: 50,
    features: {
      aiSearch: false,
      aiCopilot: false,
      kycPipeline: false,
      floorPlan: false,
      prioritySupport: false,
      conversationalSearch: false,
      apiAccess: false,
      customBranding: false,
      dataExport: false,
      maxAgents: 1,
    },
  },
  pro: {
    maxProperties: Infinity,
    maxContacts: Infinity,
    features: {
      aiSearch: true,
      aiCopilot: true,
      kycPipeline: true,
      floorPlan: true,
      prioritySupport: false,
      conversationalSearch: true,
      apiAccess: false,
      customBranding: false,
      dataExport: false,
      maxAgents: 1,
    },
  },
  entreprise: {
    maxProperties: Infinity,
    maxContacts: Infinity,
    features: {
      aiSearch: true,
      aiCopilot: true,
      kycPipeline: true,
      floorPlan: true,
      prioritySupport: true,
      conversationalSearch: true,
      apiAccess: true,
      customBranding: true,
      dataExport: true,
      maxAgents: 10,
    },
  },
} as const

export type PlanType = keyof typeof PLAN_LIMITS
