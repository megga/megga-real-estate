export const colors = {
  primary: {
    DEFAULT: '#1A1A1A',
    50: '#F7F7F7',
    100: '#E8E8E8',
    200: '#D1D1D1',
    300: '#B0B0B0',
    400: '#888888',
    500: '#6D6D6D',
    600: '#5D5D5D',
    700: '#4F4F4F',
    800: '#3D3D3D',
    900: '#1A1A1A',
  },
  accent: {
    DEFAULT: '#2563EB',
    hover: '#1D4ED8',
    light: '#EFF6FF',
    dark: '#1E40AF',
  },
  success: {
    DEFAULT: '#059669',
    light: '#ECFDF5',
    dark: '#047857',
  },
  warning: {
    DEFAULT: '#D97706',
    light: '#FFFBEB',
    dark: '#B45309',
  },
  danger: {
    DEFAULT: '#DC2626',
    light: '#FEF2F2',
    dark: '#B91C1C',
  },
  bg: {
    page: '#FFFFFF',
    section: '#F9FAFB',
    card: '#FFFFFF',
    sidebar: '#FAFAFA',
    input: '#F3F4F6',
    overlay: 'rgba(0,0,0,0.5)',
  },
  border: {
    DEFAULT: '#E5E7EB',
    light: '#F3F4F6',
    focus: '#2563EB',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#6B7280',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
    link: '#2563EB',
  },
} as const

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
