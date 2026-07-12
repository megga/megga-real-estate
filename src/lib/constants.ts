// Ce module n'expose plus qu'UNE map de libellés rendue en live :
// PROPERTY_TYPE_LABELS (ListingFormPage) → getters singleton vers les clés
// canoniques listings:type.*. Les anciennes maps de libellés mortes
// (PROPERTY_STATUS / TRANSACTION_STAGE / KYC_RISK / KYC_STATUS / KYC_TYPE /
// PEP / SANCTIONS_STATUS_LABELS) ont été retirées ; les libellés KYC réellement
// rendus vivent dans crm-sugar-v3/tokens.ts (forme {label,tone}). Restent ici les
// codes/enums (`*_STATUSES`, `*_TYPES`, `*_LEVELS`) et leurs types dérivés.
import i18n from '@/i18n'

export const CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU',
  'BS', 'BL', 'AG', 'SO', 'ZH', 'LU', 'ZG',
  'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG',
  'AR', 'AI', 'SG', 'GR', 'TI',
] as const

export type Canton = typeof CANTONS[number]

export const PROPERTY_TYPES = [
  'apartment',
  'house',
  'villa',
  'commercial',
  'office',
  'parking',
  'storage',
  'land',
] as const

export type PropertyType = typeof PROPERTY_TYPES[number]

// Libellés rendus en live (ListingForm, fiches) → clés canoniques listings:type.*.
export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  get apartment()  { return i18n.t('listings:type.apartment') },
  get house()      { return i18n.t('listings:type.house') },
  get villa()      { return i18n.t('listings:type.villa') },
  get commercial() { return i18n.t('listings:type.commercial') },
  get office()     { return i18n.t('listings:type.office') },
  get parking()    { return i18n.t('listings:type.parking') },
  get storage()    { return i18n.t('listings:type.storage') },
  get land()       { return i18n.t('listings:type.land') },
}

export const PROPERTY_STATUSES = [
  'draft',
  'active',
  'reserved',
  'sold',
  'archived',
] as const

export type PropertyStatus = typeof PROPERTY_STATUSES[number]

export const TRANSACTION_STAGES = [
  'new_lead',
  'to_qualify',
  'active_search',
  'visit_planned',
  'visit_done',
  'interest_confirmed',
  'offer',
  'negotiation',
  'reserved',
  'financing',
  'notary',
  'signed',
  'lost',
  'to_recontact',
] as const

export type TransactionStage = typeof TRANSACTION_STAGES[number]

// Legacy stage mapping for backward compatibility
export const KYC_RISK_LEVELS = ['low', 'medium', 'high', 'unassessed'] as const
export type KycRiskLevel = typeof KYC_RISK_LEVELS[number]

export const KYC_STATUSES = ['pending', 'in_progress', 'review', 'validated', 'rejected'] as const
export type KycStatus = typeof KYC_STATUSES[number]

export const KYC_TYPES = ['buyer_pp', 'buyer_pm', 'seller_pp', 'seller_pm'] as const
export type KycType = typeof KYC_TYPES[number]

export const CONTACT_SCORES = ['hot', 'warm', 'cold'] as const
export type ContactScore = typeof CONTACT_SCORES[number]

// ─── KYC Compliance ─────────────────────────────────────────────────────────

/** GAFI/FATF high-risk jurisdictions — call for enhanced due diligence */
export const FATF_HIGH_RISK_COUNTRIES = [
  'AF', 'KP', 'IR', 'MM', 'SY', 'YE', 'RU', 'BY',
] as const

/** GAFI/FATF jurisdictions under increased monitoring */
export const FATF_INCREASED_MONITORING = [
  'BF', 'CM', 'CD', 'HT', 'KE', 'ML', 'MZ', 'NG',
  'PH', 'SN', 'ZA', 'SS', 'TZ', 'VN',
] as const

export type PepStatus = 'clear' | 'match' | 'pending' | 'not_checked'
export type SanctionsStatus = 'clear' | 'match' | 'pending' | 'not_checked'

// Stripe Price IDs (from env vars, configured in Stripe Dashboard)
export const STRIPE_PRICES = {
  pro: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_PRO_MONTHLY as string,
    yearly: import.meta.env.VITE_STRIPE_PRICE_PRO_YEARLY as string,
  },
  entreprise: {
    monthly: import.meta.env.VITE_STRIPE_PRICE_ENTREPRISE_MONTHLY as string,
    yearly: import.meta.env.VITE_STRIPE_PRICE_ENTREPRISE_YEARLY as string,
  },
} as const
