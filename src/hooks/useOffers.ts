// MEGGA CRM Sprint 2 — Hooks Offres + Contre-offres
// Source : HANDOFF_SPRINT_2_CLAUDE_CODE.md §Logique métier §4
// Migration DB : 20260517_001_sprint2_crm_offers_visits.sql
//
// La table crm_offers a un trigger AuditEvent qui logge automatiquement
// 'offer_created' / 'offer_countered' / 'offer_accepted' / 'offer_rejected' /
// 'offer_expired' / 'offer_withdrawn' dans activity_events (category='deal').
// Pas besoin de logger côté front. Ces valeurs sont des clés TECHNIQUES : le
// libellé affiché vient de `auditActionLabel()` (i18n `audit.action.*`).

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type {
  Offer,
  OfferKind,
  OfferParty,
  OfferConditions,
  OfferAttachment,
  OfferStatus,
} from '@/types/offer'
import { EMPTY_OFFER_CONDITIONS } from '@/types/offer'

// ─── Read : chaîne d'offres d'un deal ──────────────────────────────────

/** Retourne toutes les offres+contre-offres d'un deal, triées chronologiquement. */
export function useOfferChain(dealId: string | undefined) {
  return useQuery({
    queryKey: ['offer-chain', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      if (!dealId) return []
      const { data, error } = await supabase.rpc('crm_offer_chain', {
        p_deal_id: dealId,
      })
      if (error) throw error
      return (data ?? []).map(normalizeOfferRow) as Offer[]
    },
  })
}

// ─── Read : offres 'pending' proches de l'échéance (Focus radar v3) ──────
//
// Liste agence-wide des offres en attente, triées par échéance la plus proche.
// RLS scope déjà l'agence (policy agency_id IN profiles de auth.uid()) ; le
// `.eq('agency_id', …)` explicite est redondant mais conventionnel et frappe
// l'index. `.eq('status','pending')` (pas `.in`) frappe l'index partiel
// idx_crm_offers_status_expires (status, expires_at WHERE status='pending') →
// pas de tri en mémoire. Le cron crm-offers-expire-hourly bascule pending→expired,
// donc 'pending' exclut déjà les offres expirées. Pas de count:'exact'.
// SELECT explicite des seules colonnes utiles (CLAUDE.md §7) : on évite les jsonb
// lourds (conditions, attachments) inutiles pour la file. amount (bigint) → number.

/** Projection lean d'une offre pour la file Focus (pas le type Offer complet). */
export interface ExpiringOffer {
  id: string
  expires_at: string
  amount: number
  status: OfferStatus
  by_label: string
  by_id: string | null
}

/** Query agence-wide des offres 'pending', triées par échéance la plus proche (file Focus radar). */
export function useExpiringOffers(limit = 50) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  return useQuery({
    queryKey: ['expiring-offers', agencyId, limit],
    enabled: !!agencyId,
    staleTime: 60_000,
    queryFn: async (): Promise<ExpiringOffer[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('crm_offers')
        .select('id, expires_at, amount, status, by_label, by_id')
        .eq('agency_id', agencyId)
        .eq('status', 'pending')
        .order('expires_at', { ascending: true })
        .limit(limit)
      if (error) throw error
      return (data ?? []).map((r) => {
        const row = r as { id: string; expires_at: string; amount: number | string; status: OfferStatus; by_label: string; by_id: string | null }
        return {
          id: row.id,
          expires_at: row.expires_at,
          amount: typeof row.amount === 'string' ? parseInt(row.amount, 10) : row.amount,
          status: row.status,
          by_label: row.by_label,
          by_id: row.by_id,
        }
      })
    },
  })
}

// ─── Write : créer une offre ou contre-offre ────────────────────────────

export interface CreateOfferInput {
  dealId: string
  /** null = offre racine ; sinon id de l'offre parente. */
  parentOfferId: string | null
  kind: OfferKind
  fromParty: OfferParty
  /** contact.id (buyer) ou profile.id (seller agent). */
  byId: string | null
  /** Libellé d'affichage ex. "Antoine Picard" ou "MEGGA · Grégory L.". */
  byLabel: string
  amount: number
  conditions: OfferConditions
  deposit?: number | null
  closingDate?: string | null
  expiresAt: string
  attachments?: OfferAttachment[]
  notes?: string | null
}

/** Insère une offre racine ou une contre-offre ; l'audit 'deal' est loggé par trigger DB. */
export function useCreateOffer() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateOfferInput) => {
      if (!profile?.agency_id) {
        throw new Error('Création d\'offre : agence introuvable')
      }
      const row = {
        deal_id: input.dealId,
        agency_id: profile.agency_id,
        parent_offer_id: input.parentOfferId,
        kind: input.kind,
        from_party: input.fromParty,
        by_id: input.byId,
        by_label: input.byLabel,
        amount: input.amount,
        currency: 'CHF',
        conditions: (input.conditions ?? EMPTY_OFFER_CONDITIONS) as unknown as import('@/types/database').Json,
        deposit: input.deposit ?? null,
        closing_date: input.closingDate ?? null,
        expires_at: input.expiresAt,
        attachments: (input.attachments ?? []) as unknown as import('@/types/database').Json,
        notes: input.notes ?? null,
        status: 'pending' as const,
        created_by: user?.id ?? null,
      }
      const { data, error } = await supabase
        .from('crm_offers')
        .insert(row)
        .select('*')
        .single()
      if (error) throw error
      return normalizeOfferRow(data as unknown as RawOfferRow) as Offer
    },
    onSuccess: (offer) => {
      queryClient.invalidateQueries({ queryKey: ['offer-chain', offer.deal_id] })
      queryClient.invalidateQueries({ queryKey: ['offers-count', offer.deal_id] })
      queryClient.invalidateQueries({ queryKey: ['transaction', offer.deal_id] })
      // AuditEvent généré côté DB par trigger audit_crm_offer_event
      queryClient.invalidateQueries({ queryKey: ['audit-events'] })
    },
  })
}

// ─── Write : transition de status (accept / reject / withdraw) ──────────

export interface UpdateOfferStatusInput {
  offerId: string
  dealId: string
  status: Exclude<OfferStatus, 'pending'>
}

/** Applique une transition de status (accept/reject/withdraw) ; accepter SIGNE le deal (cf. corps). */
export function useUpdateOfferStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: UpdateOfferStatusInput) => {
      const { data, error } = await supabase
        .from('crm_offers')
        .update({
          status: input.status,
          responded_at: new Date().toISOString(),
        })
        .eq('id', input.offerId)
        .select('*')
        .single()
      if (error) throw error

      // Contrat handoff « boucle de négociation » : accepter une offre SIGNE le
      // deal (transactions.stage='signed', ex-`deal.won=true` du prototype).
      // ATOMICITÉ : le trigger DB `trg_crm_offer_sign_deal`
      // (migration 20260704140000_crm_offer_accept_signs_deal) signe le deal DANS
      // la même transaction que l'update de l'offre. Cet update client est un
      // FILET idempotent : no-op quand le trigger est déployé (garde `stage <>
      // 'signed'` côté trigger + garde stage-change de capture_transaction_lifecycle
      // → 0 audit en double), mais garantit le comportement sur un environnement
      // où le trigger n'est pas (encore) appliqué. Le refus ne change PAS l'étape.
      // Audits : audit_crm_offer_event → 'offer_accepted' ; trg_transaction_lifecycle → 'stage_change'.
      if (input.status === 'accepted') {
        const { error: stageErr } = await supabase
          .from('transactions')
          .update({ stage: 'signed' })
          .eq('id', input.dealId)
        if (stageErr) throw stageErr
      }

      return normalizeOfferRow(data as unknown as RawOfferRow) as Offer
    },
    onSuccess: (offer) => {
      queryClient.invalidateQueries({ queryKey: ['offer-chain', offer.deal_id] })
      queryClient.invalidateQueries({ queryKey: ['transaction', offer.deal_id] })
      // Board pipeline (usePipelineSugar) — même invalidation que useUpdateTransactionStage.
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['audit-events'] })
    },
  })
}

// ─── Normalisation row Supabase → type Offer ────────────────────────────

interface RawOfferRow {
  id: string
  deal_id: string
  agency_id: string
  parent_offer_id: string | null
  kind: OfferKind
  from_party: OfferParty
  by_id: string | null
  by_label: string
  amount: number | string
  currency: string
  conditions: unknown
  deposit: number | string | null
  closing_date: string | null
  expires_at: string
  attachments: unknown
  notes: string | null
  status: OfferStatus
  created_at: string
  responded_at: string | null
}

/** Convertit une row `crm_offers` brute (bigint sérialisé en string, jsonb) vers le type `Offer`. */
function normalizeOfferRow(row: RawOfferRow): Offer {
  return {
    id: row.id,
    deal_id: row.deal_id,
    agency_id: row.agency_id,
    parent_offer_id: row.parent_offer_id,
    kind: row.kind,
    from_party: row.from_party,
    by_id: row.by_id,
    by_label: row.by_label,
    amount: typeof row.amount === 'string' ? parseInt(row.amount, 10) : row.amount,
    currency: 'CHF',
    conditions: normalizeConditions(row.conditions),
    deposit:
      row.deposit == null
        ? null
        : typeof row.deposit === 'string'
          ? parseInt(row.deposit, 10)
          : row.deposit,
    closing_date: row.closing_date,
    expires_at: row.expires_at,
    attachments: Array.isArray(row.attachments)
      ? (row.attachments as OfferAttachment[])
      : [],
    notes: row.notes,
    status: row.status,
    created_at: row.created_at,
    responded_at: row.responded_at,
  }
}

/** Normalise le jsonb `conditions` en `OfferConditions` complet (valeurs par défaut si absent/malformé). */
function normalizeConditions(raw: unknown): OfferConditions {
  if (!raw || typeof raw !== 'object') return EMPTY_OFFER_CONDITIONS
  const r = raw as Partial<OfferConditions>
  return {
    financing: {
      active: r.financing?.active ?? false,
      days: r.financing?.days ?? null,
      note: r.financing?.note ?? null,
    },
    sale: {
      active: r.sale?.active ?? false,
      note: r.sale?.note ?? null,
    },
    diagnostic: {
      active: r.diagnostic?.active ?? false,
      note: r.diagnostic?.note ?? null,
    },
    occupancy: {
      active: r.occupancy?.active ?? false,
      note: r.occupancy?.note ?? null,
    },
    other: typeof r.other === 'string' ? r.other : '',
  }
}

// ─── Helpers utilitaires ────────────────────────────────────────────────

/** L'offre en cours = la plus récente. */
export function lastOffer(chain: Offer[] | undefined): Offer | undefined {
  if (!chain || chain.length === 0) return undefined
  return chain[chain.length - 1]
}

/**
 * Pré-remplissage intelligent du montant d'une nouvelle offre/contre-offre.
 * - Contre-offre : (parent + askingPrice) / 2
 * - Première offre : askingPrice
 */
export function suggestedOfferAmount(
  parent: Offer | undefined,
  askingPrice: number | null | undefined,
): number {
  if (parent && askingPrice && askingPrice > 0) {
    return Math.round((parent.amount + askingPrice) / 2)
  }
  if (parent) return parent.amount
  return askingPrice ?? 0
}
