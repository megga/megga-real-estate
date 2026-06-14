// MEGGA CRM Sugar v2 — Adaptateurs partagés Supabase → shapes mock (CrmContact / CrmBien / etc).
// Centralise les mappings réutilisés par useMatchingSugar, useContactsSugar,
// useDealsSugar, etc. Les pages UI continuent de consommer Crm* shapes du mock,
// et les hooks adapter remplissent le registry runtime de mockData.ts.

import type { Contact, SearchCriteria } from '@/types/contact'
import type { KycCase, KycDossierStatus } from '@/types/kyc'
import type { Property } from '@/types/listing'
import type { ContactTransaction } from '@/hooks/useTransactions'
import type { TimelineEvent } from '@/hooks/useContactTimeline'
import type { TransactionStage } from '@/lib/constants'
import type {
  CrmContact, CrmBien, CrmDeal, CrmActivity,
} from '@/components/crm-sugar/mockData'
import type { StageId } from '@/components/crm-sugar/tokens'

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

// ─── TransactionStage DB → StageId mock ────────────────────────────────
// Mock utilise des dashes ('new-lead'), DB utilise des underscores ('new_lead').
// Plusieurs stages DB collapsent sur un seul StageId mock (negotiation/financing/
// notary/reserved → 'offer' faute d'équivalent UI granulaire).
function mapStage(s: TransactionStage): StageId {
  switch (s) {
    case 'new_lead':           return 'new-lead'
    case 'to_qualify':         return 'to-qualify'
    case 'active_search':      return 'searching'
    case 'visit_planned':      return 'visit-scheduled'
    case 'visit_done':         return 'visit-done'
    case 'interest_confirmed': return 'interest-confirmed'
    case 'offer':              return 'offer'
    case 'negotiation':        return 'offer'
    case 'reserved':           return 'offer'
    case 'financing':          return 'offer'
    case 'notary':             return 'offer'
    case 'signed':             return 'signed'
    case 'lost':               return 'lost'
    case 'to_recontact':       return 'to-qualify'
    default:                   return 'new-lead'
  }
}

// ─── StageId UI → TransactionStage DB (inverse de mapStage) ─────────────
// Utilisé par PipelineSugarV2Page lors du drag-drop d'une colonne UI vers une
// autre. Note : 'offer' DB est un sur-ensemble (negotiation/reserved/financing/
// notary collapsent sur 'offer' UI). Si l'agent drop sur la colonne 'offer'
// alors que la transaction est déjà en negotiation, le code page court-circuite
// via `deal.stage === targetStage` (les deux valent 'offer' StageId).
export function stageIdToTransactionStage(s: StageId): TransactionStage {
  switch (s) {
    case 'new-lead':           return 'new_lead'
    case 'to-qualify':         return 'to_qualify'
    case 'searching':          return 'active_search'
    case 'visit-scheduled':    return 'visit_planned'
    case 'visit-done':         return 'visit_done'
    case 'interest-confirmed': return 'interest_confirmed'
    case 'offer':              return 'offer'
    case 'signed':             return 'signed'
    case 'lost':               return 'lost'
  }
}

// ─── ContactTransaction (Supabase) → CrmDeal (mock UI shape) ───────────
// Le hook `useContactTransactions(contactId)` renvoie un shape allégé
// (id, stage, status, prix, updated_at, property). Le mock CrmDeal porte
// aussi `probability`, `nextAction`, `risk`, `bienId`, `value`. Mapping :
//   - value : price_final ?? price_offered ?? property.price ?? 0
//   - probability : dérivée du stage (heuristique simple)
//   - risk : 'healthy' par défaut (pas de champ risk en DB)
//   - nextAction : placeholder (à brancher quand `tasks` table existe)
//   - bienId : transaction.property?.id (peut être null)
const STAGE_PROBABILITY: Record<StageId, number> = {
  'new-lead': 5, 'to-qualify': 15, 'searching': 30,
  'visit-scheduled': 45, 'visit-done': 60, 'interest-confirmed': 75,
  'offer': 85, 'signed': 100, 'lost': 0,
}

export function transactionToCrmDeal(
  t: ContactTransaction,
  contactId: string,
  propertyId: string | null = null,
): CrmDeal {
  const stage = mapStage(t.stage as TransactionStage)
  const value = t.price_final ?? t.price_offered ?? t.property?.price ?? 0
  return {
    id: t.id,
    contactId,
    bienId: propertyId,
    stage,
    value,
    probability: STAGE_PROBABILITY[stage] ?? 0,
    ownerAgentId: '',
    nextAction: { kind: 'note', dueAt: t.updated_at, note: 'Prochaine étape à définir' },
    risk: t.status === 'paused' ? 'at-risk' :
          t.status === 'cancelled' ? 'stalled' : 'healthy',
    updatedAt: t.updated_at,
  }
}

// ─── TimelineEvent (Supabase activity_events) → CrmActivity ────────────
// Le mock CrmActivity attend `text` (string narratif). On dérive le texte
// depuis action + metadata (best-effort, fallback action brut). bienId/
// contactId sont laissés undefined (les widgets s'en sortent sans).
const ACTION_LABELS: Record<string, string> = {
  stage_change:         'Étape changée',
  match_sent:           'Dossier matching envoyé',
  visit_planned:        'Visite planifiée',
  visit_done:           'Visite effectuée',
  kyc_created:          'Dossier KYC ouvert',
  kyc_validated:        'KYC validé',
  property_sent:        'Bien envoyé au client',
  email_sent:           'Email envoyé',
  call_logged:          'Appel enregistré',
  note_added:           'Note ajoutée',
  seller_lead_created:  'Lead vendeur reçu',
}

export function timelineToActivity(e: TimelineEvent, contactId?: string): CrmActivity {
  const baseLabel = ACTION_LABELS[e.action] ?? e.action
  const meta = e.metadata ?? {}
  let text = baseLabel
  // Enrichir si metadata pertinent (best-effort, ne crash pas si shape diffère)
  if (e.action === 'stage_change' && typeof meta.new_stage === 'string') {
    text = `Étape passée à « ${meta.new_stage} »`
  } else if (e.action === 'match_sent' && typeof meta.count === 'number') {
    text = `${meta.count} bien${meta.count > 1 ? 's' : ''} envoyé${meta.count > 1 ? 's' : ''} au client`
  } else if (e.action === 'property_sent' && typeof meta.property_title === 'string') {
    text = `« ${meta.property_title} » envoyé au client`
  } else if (e.action === 'email_sent' && typeof meta.subject === 'string') {
    text = `Email envoyé — « ${meta.subject} »`
  } else if (e.action === 'visit_done' && typeof meta.property_title === 'string') {
    text = `Visite effectuée — ${meta.property_title}`
  }
  return {
    id: e.id,
    at: e.created_at,
    kind: e.action,
    contactId,
    text,
  }
}

// ─── Property (Supabase) → CrmBien (mock) — pour CtSellerStats ─────────
// Utilisé pour afficher les biens dont un contact vendeur est propriétaire.
// Le mock CrmBien est très riche (mandat, stats, photoCount/signedPhotoCount,
// energy, accent). On remplit ce qu'on peut depuis Property + listing joints.
export function propertyToCrmBien(p: Property, ownerContactId: string | null): CrmBien {
  const typeMap: Record<string, CrmBien['type']> = {
    apartment: 'appartement', appartement: 'appartement',
    house: 'maison', maison: 'maison', villa: 'villa',
    commercial: 'commercial', office: 'office',
    parking: 'parking', storage: 'storage', land: 'land',
  }
  const isRental = !!p.price && p.price < 20000   // heuristique idem listingToBien
  return {
    id: p.id,
    ref: p.id.slice(0, 12).toUpperCase(),
    status: (p.status as CrmBien['status']) || 'active',
    type: typeMap[p.type?.toLowerCase()] ?? 'appartement',
    transaction: isRental ? 'location' : 'vente',
    title: p.title || `${typeMap[p.type] ?? 'Bien'} ${p.city ?? ''}`.trim(),
    addr: [p.address, p.city].filter(Boolean).join(', '),
    canton: p.canton ?? '',
    price: isRental ? null : (p.price || null),
    rent: isRental ? p.price : null,
    charges: p.charges_monthly ?? null,
    area: p.surface_m2 ?? 0,
    rooms: p.rooms ?? 0,
    beds: p.bedrooms ?? 0,
    baths: p.bathrooms ?? 0,
    year: p.year_built ?? 0,
    energy: '',
    ownerContactId,
    mandat: { type: 'simple' },
    visibility: 'agency',
    stats: { views: 0, favorites: 0, visitRequests: 0 },
    photoCount: p.photos?.length ?? 0,
    signedPhotoCount: p.photos?.length ?? 0,
    coverPhoto: p.photos?.[0] ?? null,
    accent: pickAvatarBg(p.id),
  }
}
