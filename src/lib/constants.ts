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
  'land',
] as const

export type PropertyType = typeof PROPERTY_TYPES[number]

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  commercial: 'Commercial',
  land: 'Terrain',
}

export const PROPERTY_STATUSES = [
  'draft',
  'active',
  'reserved',
  'sold',
  'archived',
] as const

export type PropertyStatus = typeof PROPERTY_STATUSES[number]

export const PROPERTY_STATUS_LABELS: Record<PropertyStatus, string> = {
  draft: 'Brouillon',
  active: 'Actif',
  reserved: 'Réservé',
  sold: 'Vendu',
  archived: 'Archivé',
}

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

export const TRANSACTION_STAGE_LABELS: Record<TransactionStage, string> = {
  new_lead: 'Nouveau lead',
  to_qualify: 'À qualifier',
  active_search: 'Recherche active',
  visit_planned: 'Visite planifiée',
  visit_done: 'Visite effectuée',
  interest_confirmed: 'Intérêt confirmé',
  offer: 'Offre',
  negotiation: 'Négociation',
  reserved: 'Réservé',
  financing: 'Financement',
  notary: 'Notaire',
  signed: 'Signé',
  lost: 'Perdu',
  to_recontact: 'À relancer',
}

// Legacy stage mapping for backward compatibility
export const LEGACY_STAGE_MAP: Record<string, TransactionStage> = {
  lead: 'new_lead',
  qualified: 'to_qualify',
  closed: 'signed',
}

export const KYC_RISK_LEVELS = ['low', 'medium', 'high', 'unassessed'] as const
export type KycRiskLevel = typeof KYC_RISK_LEVELS[number]

export const KYC_RISK_LABELS: Record<KycRiskLevel, string> = {
  low: 'Faible',
  medium: 'Moyen',
  high: 'Élevé',
  unassessed: 'Non évalué',
}

export const KYC_STATUSES = ['pending', 'in_progress', 'review', 'validated', 'rejected'] as const
export type KycStatus = typeof KYC_STATUSES[number]

export const KYC_STATUS_LABELS: Record<KycStatus, string> = {
  pending: 'En attente',
  in_progress: 'En cours',
  review: 'En revue',
  validated: 'Validé',
  rejected: 'Rejeté',
}

export const KYC_TYPES = ['buyer_pp', 'buyer_pm', 'seller_pp', 'seller_pm'] as const
export type KycType = typeof KYC_TYPES[number]

export const KYC_TYPE_LABELS: Record<KycType, string> = {
  buyer_pp: 'Acheteur PP',
  buyer_pm: 'Acheteur PM',
  seller_pp: 'Vendeur PP',
  seller_pm: 'Vendeur PM',
}

export const CONTACT_SCORES = ['hot', 'warm', 'cold'] as const
export type ContactScore = typeof CONTACT_SCORES[number]
