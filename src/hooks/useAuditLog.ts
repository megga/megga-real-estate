// MEGGA CRM Sprint 1 — Hooks Journal d'audit nLPD
// Sources :
//   - HANDOFF_SPRINT_1_CLAUDE_CODE.md §Logique métier §4
//   - KYC_ENRICHISSEMENTS.md §7 AuditEvents à générer automatiquement
//
// APPEND-ONLY : porté par les triggers `trg_activity_events_immutable_update/_delete`
// (`enforce_activity_events_immutability`, dernière définition 20260801420000), pas par
// l'absence de policy — la clé de service contourne la RLS, pas un trigger. Les seuls
// UPDATE admis sont ceux des FK ON DELETE SET NULL (agence, acteur).
//
// ⛔ PÉRIMÈTRE : l'agence du profil, posée EN CLAIR (`.eq('agency_id', …)`), et AUCUNE
// lecture sans agence. La RLS ne le garantit pas seule : deux policies SELECT permissives
// s'additionnent — `events_select` (agency_id = get_my_agency_id()) ET
// `super_admin_read_all_events` (toutes agences). Le super-admin de production n'a pas
// d'agence (mesuré le 13.09.2026) : cette page listait alors la PLATEFORME — 1 189
// événements sur 30 jours, six agences — et son export CSV l'emportait, IP comprises.
// Sa vue plateforme vit dans la console. Le filtre explicite rend aussi utilisable
// l'index `idx_activity_events_audit_filters` (agency_id, created_at DESC, …) : sans lui,
// la RLS arrive en `OR` et n'est qu'un Filter.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { ACTOR_KIND_DE, type FamilleActeur } from '@/lib/auditActor'
import type { Json } from '@/types/database'
import type { AuditEvent, AuditCategory, AuditSeverity } from '@/types/kyc'

// ─── Read : liste filtrée pour le journal nLPD ─────────────────────────

export interface AuditEventsFilters {
  category?: AuditCategory | 'all'
  severity?: AuditSeverity | 'all'
  /** Qui a agi — posé sur `actor_kind` (`ACTOR_KIND_DE`), jamais sur l'absence d'acteur. */
  acteur?: FamilleActeur | 'all'
  /** Nombre de jours à remonter (7/30/90/3650 pour tout). */
  days?: number
}

/**
 * Au plus ce nombre de lignes par lecture : le `max_rows` de PostgREST (1000,
 * `supabase/config.toml`), écrit en clair. Sans lui la troncature avait lieu QUAND
 * MÊME, mais en silence — sur « Tout », la page annonçait « 1000 évènements » comme
 * un total. Écrit ici, la page sait qu'elle a touché le plafond et le dit.
 */
export const LIMITE_JOURNAL = 1000

/**
 * Lecture du journal d'audit nLPD (activity_events) DE L'AGENCE du profil : filtres
 * catégorie / sévérité / acteur / fenêtre de jours, posés dans la requête. Sans agence,
 * rien n'est lu (voir l'en-tête).
 *
 * ⚠ La recherche n'est PAS ici : elle entrait dans la clé de cache, et chaque frappe
 * relançait une lecture — la liste clignotait « Chargement du journal… » à chaque
 * lettre. Elle filtre désormais à l'écran, sur ce que l'agent VOIT
 * (`crm-dossiers/audit/journal.ts`).
 */
export function useAuditEvents(filters: AuditEventsFilters = {}) {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id ?? null
  return useQuery<AuditEvent[]>({
    // L'agence dans la clé : deux comptes successifs ne partagent pas un cache.
    queryKey: ['audit-events', agencyId, filters],
    enabled: !!agencyId,
    // Un changement de filtre garde l'historique affiché pendant la lecture, au lieu de
    // le remplacer par « Chargement… ». ⛔ Jamais d'une agence à l'autre : la liste
    // précédente n'est reprise que si elle venait de la MÊME agence.
    placeholderData: (precedent, requete) => (requete?.queryKey[1] === agencyId ? precedent : undefined),
    queryFn: async () => {
      let q = supabase
        .from('activity_events')
        .select(
          // `actor_kind` : sans lui, IA, système et agent détaché se confondent (actor_id NULL).
          'id, agency_id, actor_id, actor_kind, action, entity_type, entity_id, metadata, created_at, severity, category, object_label, ip_address',
        )
        .eq('agency_id', agencyId as string)
        .order('created_at', { ascending: false })
        .limit(LIMITE_JOURNAL)

      if (filters.category && filters.category !== 'all') {
        q = q.eq('category', filters.category)
      }
      if (filters.severity && filters.severity !== 'all') {
        q = q.eq('severity', filters.severity)
      }
      if (filters.acteur && filters.acteur !== 'all') {
        q = q.eq('actor_kind', ACTOR_KIND_DE[filters.acteur])
      }
      if (filters.days && filters.days > 0) {
        const cutoff = new Date(
          Date.now() - filters.days * 24 * 3600 * 1000,
        ).toISOString()
        q = q.gte('created_at', cutoff)
      }

      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as AuditEvent[]
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
          // Le défaut de la base, écrit en clair : c'est un humain qui agit.
          actor_kind: 'user',
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
