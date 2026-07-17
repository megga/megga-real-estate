// MEGGA CRM Sprint 2 — Hooks Visite (single + bon + rapport)
// Source : HANDOFF_SPRINT_2_CLAUDE_CODE.md §Logique métier §5 §6
// Migration : 20260517_001_sprint2_crm_offers_visits.sql
//
// Distinct de useVisits.ts (qui sert le calendrier + booking public).
// Ici on cible la fiche Visite + la vue mobile compagnon /visit/:id/companion.

import { useEffect, useId } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type {
  VisitBon,
  VisitRapport,
  VisitKind,
} from '@/types/visit'
import { visitStatusToKind } from '@/types/visit'
import type { Json, TablesInsert } from '@/types/database'

// ─── Type enrichi Sprint 2 ──────────────────────────────────────────────

export interface VisitDetail {
  id: string
  agency_id: string
  property_id: string
  contact_id: string
  transaction_id: string | null
  scheduled_at: string
  duration_minutes: number
  status: string
  /** Mapping frontend Sprint 2 dérivé de status. */
  kind: VisitKind
  agent_id: string | null
  bon: VisitBon | null
  rapport: VisitRapport | null
  created_at: string
  property?: {
    id: string
    title: string
    address: string
    city: string
    canton: string
    photos: string[] | null
    type: string | null
    surface_m2: number | null
    rooms: number | null
    price: number | null
  } | null
  contact?: {
    id: string
    first_name: string
    last_name: string
    email: string | null
    phone: string | null
  } | null
  agent?: {
    id: string
    full_name: string | null
    avatar_url: string | null
  } | null
}

// ─── Read : single visit avec joins ─────────────────────────────────────

/** Charge une visite unique avec ses joins (bien, contact, agent), normalisée en `VisitDetail`. */
export function useVisitDetail(visitId: string | undefined) {
  return useQuery({
    queryKey: ['visit-detail', visitId],
    enabled: !!visitId,
    queryFn: async () => {
      if (!visitId) throw new Error('No visit ID')
      const { data, error } = await supabase
        .from('visits')
        .select(
          `id, agency_id, property_id, contact_id, transaction_id,
           scheduled_at, duration_minutes, status, agent_id, bon, rapport, created_at,
           property:properties(id, title, address, city, canton, photos, type, surface_m2, rooms, price),
           contact:contacts(id, first_name, last_name, email, phone),
           agent:profiles!agent_id(id, full_name, avatar_url)`,
        )
        .eq('id', visitId)
        .single()
      if (error) throw error
      return normalizeVisitRow(data)
    },
  })
}

// ─── Realtime : sync mobile compagnon ↔ desktop ─────────────────────────
//
// CLAUDE.md §7 — TOUJOURS useId() pour le channel name (sinon crash re-mount
// en StrictMode/navigation). Pattern obligatoire.

/** Invalide le cache `visit-detail` sur UPDATE de la ligne (sync compagnon mobile ↔ desktop). */
export function useVisitRealtime(visitId: string | undefined) {
  const queryClient = useQueryClient()
  const channelId = useId()

  useEffect(() => {
    if (!visitId) return
    const channel = supabase
      .channel(`visit-${channelId}-${visitId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'visits',
          filter: `id=eq.${visitId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['visit-detail', visitId] })
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [visitId, channelId, queryClient])
}

// ─── Write : créer une visite (agent CRM) ───────────────────────────────

export interface CreateVisitInput {
  bienId: string
  contactId: string
  dealId?: string | null
  scheduledAt: string
  durationMinutes: number
  generateBon?: boolean
  visitorNames?: string[]
  visitorIds?: string[]
  /** Toggles automatisations (handoff Sprint 2 — modal Visite étape 3). */
  automations?: {
    emailVisitor: boolean
    askSignature: boolean
  }
}

/** Crée une visite côté agent ; génère optionnellement le bon de visite et les toggles d'automatisation. */
export function useCreateAgentVisit() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateVisitInput) => {
      if (!profile?.agency_id) {
        throw new Error('Création visite : agence introuvable')
      }
      const bon: VisitBon | null = input.generateBon
        ? {
            generatedAt: new Date().toISOString(),
            signedAt: null,
            docId: `doc-${crypto.randomUUID().slice(0, 8)}`,
            visitorNames: input.visitorNames ?? [],
            visitorIds: input.visitorIds ?? [input.contactId],
          }
        : null

      const qualification =
        input.automations || input.generateBon
          ? {
              automations: {
                generateBon: !!input.generateBon,
                emailVisitor: input.automations?.emailVisitor ?? false,
                askSignature: input.automations?.askSignature ?? false,
              },
            }
          : null

      const { data, error } = await supabase
        .from('visits')
        .insert({
          agency_id: profile.agency_id,
          property_id: input.bienId,
          contact_id: input.contactId,
          transaction_id: input.dealId ?? null,
          scheduled_at: input.scheduledAt,
          duration_minutes: input.durationMinutes,
          agent_id: user?.id ?? null,
          status: 'planned',
          bon: bon as unknown as Json,
          rapport: null,
          qualification: qualification as unknown as Json,
        } as unknown as TablesInsert<'visits'>)
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits'] })
      queryClient.invalidateQueries({ queryKey: ['visit-detail'] })
    },
  })
}

// ─── Write : signer le bon ──────────────────────────────────────────────

/** Horodate `signedAt` sur le bon de visite (signature du visiteur). */
export function useSignVisitBon() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ visitId, bon }: { visitId: string; bon: VisitBon }) => {
      const signed: VisitBon = {
        ...bon,
        signedAt: new Date().toISOString(),
      }
      const { data, error } = await supabase
        .from('visits')
        .update({ bon: signed as unknown as Json })
        .eq('id', visitId)
        .select('id')
        .single()
      if (error) throw error
      return data as { id: string }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['visit-detail', vars.visitId] })
    },
  })
}

// ─── Write : enregistrer le rapport (marque la visite 'done') ───────────
// ─── Normalisation row Supabase → type VisitDetail ──────────────────────

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null
  return v ?? null
}

/** Convertit une row Supabase brute en `VisitDetail` typé (déballe les joins, dérive `kind`). */
function normalizeVisitRow(row: unknown): VisitDetail {
  const r = row as Record<string, unknown>
  return {
    id: String(r.id),
    agency_id: String(r.agency_id),
    property_id: String(r.property_id),
    contact_id: String(r.contact_id),
    transaction_id: (r.transaction_id as string | null) ?? null,
    scheduled_at: String(r.scheduled_at),
    duration_minutes: Number(r.duration_minutes ?? 45),
    status: String(r.status ?? 'planned'),
    kind: visitStatusToKind(r.status as string),
    agent_id: (r.agent_id as string | null) ?? null,
    bon: (r.bon as VisitBon | null) ?? null,
    rapport: (r.rapport as VisitRapport | null) ?? null,
    created_at: String(r.created_at),
    property: unwrap(r.property as VisitDetail['property']),
    contact: unwrap(r.contact as VisitDetail['contact']),
    agent: unwrap(r.agent as VisitDetail['agent']),
  }
}
