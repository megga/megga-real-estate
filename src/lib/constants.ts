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

export const TRANSACTION_STAGES = [
  'lead',
  'qualified',
  'visit_planned',
  'offer',
  'negotiation',
  'reserved',
  'financing',
  'notary',
  'signed',
  'closed',
] as const

export type TransactionStage = typeof TRANSACTION_STAGES[number]

export const TRANSACTION_STAGE_LABELS: Record<TransactionStage, string> = {
  lead: 'Nouveau lead',
  qualified: 'Qualifié',
  visit_planned: 'Visite planifiée',
  offer: 'Offre',
  negotiation: 'Négociation',
  reserved: 'Réservé',
  financing: 'Financement',
  notary: 'Notaire',
  signed: 'Signé',
  closed: 'Clôturé',
}

export const KYC_RISK_LEVELS = ['low', 'medium', 'high', 'unassessed'] as const
export type KycRiskLevel = typeof KYC_RISK_LEVELS[number]

export const CONTACT_SCORES = ['hot', 'warm', 'cold'] as const
export type ContactScore = typeof CONTACT_SCORES[number]
