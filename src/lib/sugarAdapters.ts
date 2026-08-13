/**
 * MEGGA CRM Sugar v2 — Adaptateurs partagés Supabase → shapes mock (CrmContact / CrmBien / etc).
 * Centralise les mappings réutilisés par useMatchingSugar, useContactsSugar,
 * useDealsSugar, etc. Les pages UI continuent de consommer Crm* shapes du mock,
 * et les hooks adapter remplissent le registry runtime de mockData.ts.
 */

import type { Contact, SearchCriteria } from '@/types/contact'
import { splitZones, PROP_TYPE_EN_TO_FR } from '@/lib/contactCriteria'
import type { KycCase, KycDossierStatus } from '@/types/kyc'
import type { Property } from '@/types/listing'
import type { ContactTransaction } from '@/hooks/useTransactions'
import type { TransactionStage } from '@/lib/constants'
import type {
  CrmContact, CrmBien, CrmDeal,
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

/** Contact.type (DB) → CrmContact.type (UI). investor et lead retombent sur 'buyer'. */
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

/** SearchCriteria (DB) → bloc `criteria` du CrmContact (sépare villes/cantons, libellés de type en FR). */
export function mapCriteria(c: SearchCriteria | null): CrmContact['criteria'] {
  if (!c) return undefined
  // `zones` mélange villes et codes cantons → on sépare. `type` est en anglais
  // (apartment/house…) → on repasse au libellé FR de l'UI. `transaction_type`
  // discrimine location/vente (lu par le matching-engine).
  const { cantons, cities } = splitZones(c.zones)
  return {
    transaction: c.transaction_type === 'rent' ? 'location' : 'vente',
    types: c.type ? [PROP_TYPE_EN_TO_FR[c.type] ?? c.type] : [],
    cantons,
    cities,
    budgetMin: c.budget_min,
    budgetMax: c.budget_max ?? 0,
    areaMin: c.surface_min,
    areaMax: c.surface_max,
    roomsMin: c.rooms_min,
    mustHave: c.features ?? [],
  }
}

// ─── Couleur avatar déterministe par contact.id ────────────────────────
export const AVATAR_PALETTE = [
  '#0041D9', '#8B5CF6', '#10B981', '#F59E0B',
  '#06B6D4', '#E53935', '#6366F1', '#EC4899',
]
export function pickAvatarBg(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}

/** Score qualitatif DB (hot/warm/cold) → note numérique 0–90 attendue par l'UI. */
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

/** Assemble un CrmContact complet depuis un Contact DB et son KycCase éventuel. */
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
// ─── TransactionStage DB → StageId mock ────────────────────────────────
// Mock utilise des dashes ('new-lead'), DB utilise des underscores ('new_lead').
// Plusieurs stages DB collapsent sur un seul StageId mock (negotiation/financing/
// notary/reserved → 'offer' faute d'équivalent UI granulaire).
// Exporté pour être pinné par tests/unit/pipeline-stages.spec.ts (machine à états
// du Kanban, mapping 14 stades DB → 8 colonnes). transactionToCrmDeal reste le seul
// appelant runtime — élargir la visibilité ne change aucun comportement.
export function mapStage(s: TransactionStage): StageId {
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

// ─── Reminders (Supabase) → CrmDeal.nextAction ─────────────────────────
// Pipeline v2 : la « prochaine action » d'un deal = son prochain reminder
// actif (pending/triggered/snoozed, trigger_at le plus proche). `kind` (colonne
// dédiée, migration 20260721150000) pilote l'icône ; pour les lignes historiques
// et celles créées par l'automation (sans kind), repli statique type→kind.
export const REMINDER_KIND_BY_TYPE: Record<string, string> = {
  follow_up_sent_property: 'match',
  match_ignored: 'match',
  post_visit_feedback: 'visit',
  missing_document: 'kyc',
  dormant_lead: 'call',
  deal_stagnant: 'call',
  price_change: 'note',
  custom: 'note',
}

/** Shape minimal d'une ligne `reminders` consommée par le pipeline. */
export interface PipelineReminderRow {
  id: string
  transaction_id: string | null
  type: string
  kind: string | null
  trigger_at: string | null
  message_template: string | null
}

/** Ligne reminder → nextAction de CrmDeal. null si pas d'échéance exploitable.
 *  `note` peut être vide (message_template absent) — l'UI retombe alors sur le
 *  libellé localisé du kind (t('timeline.kind.*')). */
export function reminderToNextAction(r: PipelineReminderRow): CrmDeal['nextAction'] {
  if (!r.trigger_at) return null
  return {
    kind: r.kind ?? REMINDER_KIND_BY_TYPE[r.type] ?? 'note',
    dueAt: r.trigger_at,
    note: r.message_template?.trim() ?? '',
    reminderId: r.id,
  }
}

// ─── ContactTransaction (Supabase) → CrmDeal (mock UI shape) ───────────
// Le hook `useContactTransactions(contactId)` renvoie un shape allégé
// (id, stage, status, prix, updated_at, property). Le mock CrmDeal porte
// aussi `probability`, `nextAction`, `risk`, `bienId`, `value`. Mapping :
//   - value : price_final ?? price_offered ?? property.price ?? 0
//   - probability : dérivée du stage (heuristique simple)
//   - risk : dérivé du status DB (pas de colonne risk dédiée). Enum réel
//     transactions.status = {active,on_hold,cancelled,completed} :
//     on_hold → at-risk, cancelled → stalled, sinon healthy.
//   - nextAction : null ici — attachée par usePipelineSugar depuis `reminders`
//     (reminderToNextAction) ; les consommateurs hors pipeline la laissent nulle.
//   - won/archived : status='completed' / archived_at non NULL (exclusion board)
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
    ownerAgentId: t.assigned_to ?? '',
    nextAction: null,
    risk: t.status === 'on_hold' ? 'at-risk' :
          t.status === 'cancelled' ? 'stalled' : 'healthy',
    won: t.status === 'completed',
    archived: t.archived_at != null,
    updatedAt: t.updated_at,
  }
}

// ─── TimelineEvent (Supabase activity_events) → CrmActivity ────────────
// Le mock CrmActivity attend `text` (string narratif). On dérive le texte
// depuis action + metadata (best-effort, fallback action brut). bienId/
// contactId sont laissés undefined (les widgets s'en sortent sans).
// ─── Property (Supabase) → CrmBien (mock) — pour CtSellerStats ─────────
// Utilisé pour afficher les biens dont un contact vendeur est propriétaire.
// Le mock CrmBien est très riche (mandat, stats, photoCount/signedPhotoCount,
// energy, accent). On remplit ce qu'on peut depuis Property + listing joints.
/** `properties.mandate_type` (texte libre : enum DB 'exclusive|semi_exclusive|simple'
 *  OU valeurs héritées) → CrmBien.mandat.type. semi_exclusive retombe sur 'simple'
 *  (l'UI ne réserve le badge exclusif qu'au vrai mandat exclusif). */
function mapMandateType(t?: string | null): CrmBien['mandat']['type'] {
  switch ((t ?? '').toLowerCase()) {
    case 'exclusive':
    case 'exclusif':
      return 'exclusif'
    case 'recherche':
    case 'search':
      return 'recherche'
    default:
      return 'simple'
  }
}

export function propertyToCrmBien(p: Property, ownerContactId: string | null): CrmBien {
  const typeMap: Record<string, CrmBien['type']> = {
    apartment: 'appartement', appartement: 'appartement',
    house: 'maison', maison: 'maison', villa: 'villa',
    commercial: 'commercial', office: 'office',
    parking: 'parking', storage: 'storage', land: 'land',
  }
  // Vente/Location = vrai `transaction_type` DB ('buy' | 'rent') en priorité ;
  // repli sur l'heuristique de prix quand la colonne n'est pas renseignée.
  const isRental = p.transaction_type
    ? p.transaction_type === 'rent'
    : (!!p.price && p.price < 20000)
  return {
    id: p.id,
    ref: p.id.slice(0, 12).toUpperCase(),
    status: (p.status as CrmBien['status']) || 'active',
    type: typeMap[p.type?.toLowerCase()] ?? 'appartement',
    transaction: isRental ? 'location' : 'vente',
    title: p.title || `${typeMap[p.type] ?? 'Bien'} ${p.city ?? ''}`.trim(),
    addr: [p.address, p.city].filter(Boolean).join(', '),
    canton: p.canton ?? '',
    city: p.city ?? undefined,
    price: isRental ? null : (p.price || null),
    rent: isRental ? p.price : null,
    charges: p.charges_monthly ?? null,
    area: p.surface_m2 ?? 0,
    rooms: p.rooms ?? 0,
    beds: p.bedrooms ?? 0,
    baths: p.bathrooms ?? 0,
    year: p.year_built ?? 0,
    energy: p.energy_class ?? '',
    ownerContactId,
    // Mandat réel (colonnes `mandate_*` du bien) — alimente le bucket « Mandats à
    // renouveler » de « À suivre » et le §Mandat de la fiche. `expiresAt` est
    // informatif (le cron d'auto-dépublication à l'échéance est dormant).
    mandat: {
      type: mapMandateType(p.mandate_type),
      commission: p.mandate_commission_pct ?? undefined,
      signedAt: p.mandate_signed_at ?? undefined,
      expiresAt: p.mandate_expires_at ?? undefined,
    },
    visibility: 'agency',
    stats: { views: 0, favorites: 0, visitRequests: 0 },
    photoCount: p.photos?.length ?? 0,
    signedPhotoCount: p.photos?.length ?? 0,
    coverPhoto: p.photos?.[0] ?? null,
    accent: pickAvatarBg(p.id),
  }
}
