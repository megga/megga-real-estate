// MEGGA CRM Sugar v2 — Adaptateurs partagés Supabase → shapes mock (CrmContact / CrmBien / etc).
// Centralise les mappings réutilisés par useMatchingSugar, useContactsSugar,
// useDealsSugar, etc. Les pages UI continuent de consommer Crm* shapes du mock,
// et les hooks adapter remplissent le registry runtime de mockData.ts.

import type { Contact, SearchCriteria } from '@/types/contact'
import type { KycCase, KycDossierStatus } from '@/types/kyc'
import type { CrmContact, CrmBien } from '@/components/crm-sugar/mockData'

// ─── Mapping KycDossierStatus → CrmContact.kyc.status ──────────────────
// `dossier_status` (Sprint 1 LBA, migration 20260516_002) est la source de vérité,
// calculé par triggers SQL (passe auto à 'stale' après 12 mois). Mapping 1:1.
export function mapKycStatus(
  dbDossierStatus: KycDossierStatus | undefined,
): CrmContact['kyc']['status'] {
  if (!dbDossierStatus) return 'none'
  if (dbDossierStatus === 'failed') return 'none'  // pas d'état UI dédié
  return dbDossierStatus  // 'none' | 'pending' | 'verified' | 'stale'
}

// ─── Mapping Contact.type DB → CrmContact.type ─────────────────────────
export function mapContactType(t: Contact['type']): CrmContact['type'] {
  switch (t) {
    case 'buyer':    return 'buyer'
    case 'seller':   return 'seller'
    case 'tenant':   return 'tenant'
    case 'landlord': return 'landlord'
    case 'both':     return 'mixed'
    case 'investor': return 'buyer'  // investor = acheteur côté UI
    case 'lead':     return 'buyer'  // lead → traité buyer (pas encore qualifié)
    default:         return 'buyer'
  }
}

// ─── SearchCriteria DB → CrmContact.criteria ───────────────────────────
export function mapCriteria(c: SearchCriteria | null): CrmContact['criteria'] {
  if (!c) return undefined
  return {
    transaction: 'vente',  // pas de discriminant côté DB pour l'instant
    types: c.type ? [c.type] : [],
    cantons: [],
    cities: c.zones ?? [],
    budgetMin: c.budget_min,
    budgetMax: c.budget_max ?? 0,
    areaMin: c.surface_min,
    areaMax: c.surface_max,
    roomsMin: c.rooms_min,
    mustHave: c.features ?? [],
  }
}

// ─── Couleur avatar déterministe par contact.id ────────────────────────
const AVATAR_PALETTE = [
  '#0041D9', '#8B5CF6', '#10B981', '#F59E0B',
  '#06B6D4', '#E53935', '#6366F1', '#EC4899',
]
export function pickAvatarBg(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

// ─── Score (ContactScore enum DB) → number UI ──────────────────────────
export function mapContactScore(score: Contact['score']): number {
  return score === 'hot' ? 90 : score === 'warm' ? 60 : score === 'cold' ? 30 : 0
}

// ─── Statut contact DB → CrmContact.status ─────────────────────────────
// Le mock a 'lead' | 'qualified' | 'active' | 'archived'. Le DB n'a pas de
// statut de contact explicite — on dérive un statut 'active' par défaut,
// ou 'lead' si type='lead'. À étendre si Sprint introduit `contacts.status`.
function mapContactStatus(t: Contact['type']): CrmContact['status'] {
  return t === 'lead' ? 'lead' : 'active'
}

// ─── Contact + KycCase → CrmContact ────────────────────────────────────
export function contactToCrm(c: Contact, kyc: KycCase | undefined): CrmContact {
  return {
    id: c.id,
    type: mapContactType(c.type),
    firstName: c.first_name,
    lastName: c.last_name,
    email: c.email ?? '',
    phone: c.phone ?? '',
    lang: (c.language as CrmContact['lang']) || 'fr',
    status: mapContactStatus(c.type),
    score: mapContactScore(c.score),
    source: (c.source as CrmContact['source']) || 'website',
    assignedTo: '',
    createdAt: c.created_at,
    lastActivityAt: c.last_interaction_at ?? c.created_at,
    kyc: {
      status: mapKycStatus(kyc?.dossier_status),
      riskLevel:
        kyc?.risk_level === 'high' ? 'high' :
        kyc?.risk_level === 'medium' ? 'medium' : 'low',
      expiresAt: kyc?.expires_at ?? undefined,
    },
    criteria: mapCriteria(c.search_criteria),
    tags: c.tags ?? [],
    notes: c.notes ?? undefined,
    avatarBg: pickAvatarBg(c.id),
  }
}

// ─── MatchResult.listing → CrmBien ─────────────────────────────────────
// (utilisé par useMatchingSugar — exposé ici pour partage potentiel futur)
import type { MatchResult } from '@/hooks/useMatching'
export function listingToBien(m: MatchResult): CrmBien {
  const l = m.listing
  const bienId = m.propertyId ?? m.marketListingId ?? m.id
  const typeMap: Record<string, CrmBien['type']> = {
    apartment:   'appartement',
    appartement: 'appartement',
    house:       'maison',
    maison:      'maison',
    villa:       'villa',
    commercial:  'commercial',
    office:      'office',
    parking:     'parking',
    storage:     'storage',
    land:        'land',
  }
  // Heuristique location/vente quand pas de discriminant explicite : un loyer
  // dépasse rarement CHF 20'000/mois. À remplacer dès qu'un champ
  // `transaction` apparaît dans MatchResult.listing.
  const isRental = l.days_on_market !== undefined && l.price > 0 && l.price < 20000
  return {
    id: bienId,
    ref: bienId.slice(0, 12).toUpperCase(),
    status: 'active',
    type: typeMap[l.type?.toLowerCase()] ?? 'appartement',
    transaction: isRental ? 'location' : 'vente',
    title: l.title || `${typeMap[l.type] ?? 'Bien'} ${l.city ?? ''}`.trim(),
    addr: [l.address, l.city].filter(Boolean).join(', '),
    canton: l.canton ?? '',
    price: isRental ? null : (l.price || null),
    rent: isRental ? l.price : null,
    charges: l.charges_monthly || null,
    area: l.surface_m2 || 0,
    rooms: l.rooms || 0,
    beds: l.bedrooms || 0,
    baths: 0,
    year: l.year_built || 0,
    energy: '',
    ownerContactId: null,
    mandat: { type: 'simple' },
    visibility: m.source === 'market' ? 'public' : 'agency',
    stats: { views: 0, favorites: 0, visitRequests: 0 },
    photoCount: l.photos?.length ?? 0,
    signedPhotoCount: l.photos?.length ?? 0,
    accent: pickAvatarBg(bienId),
  }
}
