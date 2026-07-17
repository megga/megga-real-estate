// MEGGA CRM Sprint 1 — Hooks Journal d'audit nLPD
// Sources :
//   - HANDOFF_SPRINT_1_CLAUDE_CODE.md §Logique métier §4
//   - KYC_ENRICHISSEMENTS.md §7 AuditEvents à générer automatiquement
//
// Append-only garanti par RLS (003_rls_policies.sql) : pas de policy UPDATE/DELETE.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { Json } from '@/types/database'
import type { AuditEvent, AuditCategory, AuditSeverity } from '@/types/kyc'

// ─── Read : liste filtrée pour le journal nLPD ─────────────────────────

export interface AuditEventsFilters {
  category?: AuditCategory | 'all'
  severity?: AuditSeverity | 'all'
  /** Nombre de jours à remonter (7/30/90/3650 pour tout). */
  days?: number
  search?: string
}

/** Lecture du journal d'audit nLPD (activity_events) : filtres catégorie/sévérité/fenêtre jours + recherche plein-texte côté client (action, libellé, metadata). */
export function useAuditEvents(filters: AuditEventsFilters = {}) {
  return useQuery<AuditEvent[]>({
    queryKey: ['audit-events', filters],
    queryFn: async () => {
      let q = supabase
        .from('activity_events')
        .select(
          'id, agency_id, actor_id, action, entity_type, entity_id, metadata, created_at, severity, category, object_label, ip_address',
        )
        .order('created_at', { ascending: false })

      if (filters.category && filters.category !== 'all') {
        q = q.eq('category', filters.category)
      }
      if (filters.severity && filters.severity !== 'all') {
        q = q.eq('severity', filters.severity)
      }
      if (filters.days && filters.days > 0) {
        const cutoff = new Date(
          Date.now() - filters.days * 24 * 3600 * 1000,
        ).toISOString()
        q = q.gte('created_at', cutoff)
      }

      const { data, error } = await q
      if (error) throw error

      let rows = (data ?? []) as AuditEvent[]
      if (filters.search) {
        const s = filters.search.toLowerCase()
        rows = rows.filter(
          (e) =>
            e.action.toLowerCase().includes(s) ||
            (e.object_label ?? '').toLowerCase().includes(s) ||
            JSON.stringify(e.metadata ?? {})
              .toLowerCase()
              .includes(s),
        )
      }
      return rows
    },
  })
}

// ─── Write : crée un AuditEvent append-only ────────────────────────────

export interface LogAuditInput {
  category: AuditCategory
  severity?: AuditSeverity
  action: string
  entityType: string
  entityId?: string | null
  objectLabel?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}

/** Écrit un AuditEvent (insert append-only — aucune policy UPDATE/DELETE) et invalide la liste. */
export function useLogAudit() {
  const { user, profile } = useAuth()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: LogAuditInput) => {
      if (!profile?.agency_id || !user?.id) {
        throw new Error('Audit : utilisateur ou agence introuvable')
      }
      const { data, error } = await supabase
        .from('activity_events')
        .insert({
          agency_id: profile.agency_id,
          actor_id: user.id,
          category: input.category,
          severity: input.severity ?? 'info',
          action: input.action,
          entity_type: input.entityType,
          entity_id: input.entityId ?? null,
          object_label: input.objectLabel ?? null,
          metadata: (input.metadata ?? {}) as unknown as Json,
          ip_address: input.ipAddress ?? null,
        })
        .select('*')
        .single()
      if (error) throw error
      return data as AuditEvent
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['audit-events'] })
    },
  })
}
