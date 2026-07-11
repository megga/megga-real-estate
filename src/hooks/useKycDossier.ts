// MEGGA CRM Sprint 1 — Hooks KYC Sugar v3
// Couvre les opérations nouvelles introduites par la migration 20260516_002 :
//   - useKycDossiers : liste avec dossier_status + compteurs checks
//   - useKycDossierByContact : RPC kyc_by_contact_id (deep-link)
//   - useKycCountByStatus : RPC kyc_count_by_status (KPIs)
//   - useMarkKycCheck : coche un check (trigger auto-valide le dossier)
//   - useMarkAllChecks : coche tous les checks requis d'un dossier
//   - useCreateKycDossier : crée un dossier (trigger seed 5 checks + AuditEvent)
//
// Spec : docs/handoff/sprint-1-kyc/HANDOFF_SPRINT_1_CLAUDE_CODE.md
//        docs/handoff/sprint-1-kyc/KYC_ENRICHISSEMENTS.md

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type {
  KycCase,
  KycChecklistItem,
  KycDossierStatus,
  KycDossierSummary,
  KycVigilance,
  KycType,
} from '@/types/kyc'
import type { TablesUpdate } from '@/types/database'

/** Ligne enrichie pour la liste : KycCase + contact + compteurs. */
export interface KycDossierRow extends Omit<KycCase, 'contact'> {
  contact: {
    id: string
    first_name: string
    last_name: string
    type: string | null
  } | null
  checks_total: number
  checks_completed: number
}

// ─── Liste de dossiers (avec contacts joints + compteurs) ──────────────

interface KycDossiersFilter {
  status?: KycDossierStatus | 'all' | 'blocking' | 'risk'
}

export function useKycDossiers(filters?: KycDossiersFilter, opts?: { enabled?: boolean }) {
  return useQuery<KycDossierRow[]>({
    queryKey: ['kyc-dossiers', filters],
    queryFn: async () => {
      // On charge les dossiers + le contact + on compte les checks via subqueries.
      const { data, error } = await supabase
        .from('kyc_cases')
        .select(
          `
          *,
          contact:contacts(id, first_name, last_name, type),
          checks:kyc_checklist_items(id, is_completed, is_required)
        `,
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows: KycDossierRow[] = (data ?? []).map((raw) => {
        const checks = (raw as { checks?: Array<{ is_completed: boolean; is_required: boolean }> }).checks ?? []
        const checksTotal = checks.length
        // « Fait » = complété OU non requis (règle canonique LBA, miroir du détail
        // KycDossierDetail.tsx:223-226) — sinon la jauge de la liste diverge du détail.
        const checksCompleted = checks.filter((c) => c.is_completed || c.is_required === false).length
        // Strip nested checks from the returned row (UI consumes counters only).
        const { checks: _omit, ...rest } = raw as unknown as KycDossierRow & {
          checks?: unknown
        }
        void _omit
        return {
          ...rest,
          checks_total: checksTotal,
          checks_completed: checksCompleted,
        }
      })

      // Filtre côté client pour les vues spéciales (handoff KycListView).
      if (!filters?.status || filters.status === 'all') return rows
      if (filters.status === 'blocking')
        return rows.filter((r) => r.dossier_status !== 'verified')
      if (filters.status === 'risk')
        return rows.filter((r) => r.risk_level === 'high' || r.risk_level === 'medium')
      return rows.filter((r) => r.dossier_status === filters.status)
    },
    // Rétro-compatible : enabled=true par défaut (appelants existants inchangés).
    // Permet aux surfaces démo de rester inertes (aucun fetch KYC PII).
    enabled: opts?.enabled ?? true,
  })
}

// ─── Dossier par contact (deep-link RPC) ──────────────────────────────

export function useKycDossierByContact(contactId: string | undefined) {
  return useQuery<KycDossierSummary | null>({
    queryKey: ['kyc-dossier-by-contact', contactId],
    queryFn: async () => {
      if (!contactId) return null
      const { data, error } = await supabase.rpc('kyc_by_contact_id', {
        p_contact_id: contactId,
      })
      if (error) throw error
      // RPC retourne un array (TABLE-returning function)
      const rows = (data as KycDossierSummary[]) ?? []
      return rows[0] ?? null
    },
    enabled: !!contactId,
  })
}

// ─── Compteurs par statut (KPIs) ───────────────────────────────────────
// ─── Mark check completed (trigger auto-valide le dossier) ─────────────

export function useMarkKycCheck() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      checkId,
      is_completed,
      actorId,
    }: {
      checkId: string
      is_completed: boolean
      actorId: string
    }) => {
      const updates: Record<string, unknown> = {
        is_completed,
        completed_at: is_completed ? new Date().toISOString() : null,
        completed_by: is_completed ? actorId : null,
      }
      const { data, error } = await supabase
        .from('kyc_checklist_items')
        .update(updates as TablesUpdate<'kyc_checklist_items'>)
        .eq('id', checkId)
        .select('*')
        .single()
      if (error) throw error
      // Le trigger DB auto_verify_kyc_dossier log l'AuditEvent + auto-valide le dossier.
      return data as KycChecklistItem
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-dossiers'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-dossier-by-contact'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-count-by-status'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-case'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit'] })
      queryClient.invalidateQueries({ queryKey: ['audit-events'] })
    },
  })
}

/** Coche en masse tous les checks d'un dossier (action "Tout marquer vérifié"). */
export function useMarkAllChecksCompleted() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      kycCaseId,
      actorId,
    }: {
      kycCaseId: string
      actorId: string
    }) => {
      const nowIso = new Date().toISOString()
      const { data, error } = await supabase
        .from('kyc_checklist_items')
        .update({
          is_completed: true,
          completed_at: nowIso,
          completed_by: actorId,
        })
        .eq('kyc_case_id', kycCaseId)
        .eq('is_completed', false)
        .select('*')
      if (error) throw error
      // Triggers DB se chargent de l'AuditEvent et de l'auto-validation.
      return data as KycChecklistItem[]
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-dossiers'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-dossier-by-contact'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-count-by-status'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-case'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-audit'] })
      queryClient.invalidateQueries({ queryKey: ['audit-events'] })
    },
  })
}

// ─── Invalidation KYC à l'édition d'identité (règle métier LBA) ───────
// Refonte Contacts : modifier l'identité (prénom/nom) d'un contact au KYC
// VÉRIFIÉ invalide la vérification — toute la procédure LBA doit être
// recommencée (refs/CLAUDE.md §215). On downgrade le dossier vérifié le plus
// récent (verified → pending, validated_at effacé) + trace un AuditEvent.
// Le trigger guard_manual_kyc_verified n'interdit QUE le passage VERS 'verified',
// pas ce downgrade. Human-in-the-loop : appelé après confirmation + consentement.
export function useInvalidateKycForContact() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ contactId, actorId }: { contactId: string; actorId: string }) => {
      const { data: cases, error: selErr } = await supabase
        .from('kyc_cases')
        .select('id, agency_id, dossier_status')
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false })
      if (selErr) throw selErr
      // Un contact peut détenir plusieurs dossiers : on invalide TOUS ceux qui
      // sont vérifiés (sinon un dossier vérifié « oublié » resterait valide).
      const verifiedCases = (cases ?? []).filter((c) => c.dossier_status === 'verified')
      if (verifiedCases.length === 0) return null // rien à invalider

      for (const vc of verifiedCases) {
        const { error: updErr } = await supabase
          .from('kyc_cases')
          .update({ dossier_status: 'pending', status: 'pending', validated_at: null } as TablesUpdate<'kyc_cases'>)
          .eq('id', vc.id)
        if (updErr) throw updErr

        await supabase.from('activity_events').insert({
          agency_id: vc.agency_id,
          actor_id: actorId,
          action: 'KYC invalidé — identité du contact modifiée',
          entity_type: 'contact',
          entity_id: contactId,
          metadata: { reason: 'identity_change', kyc_case_id: vc.id },
        })
      }
      return verifiedCases.map((v) => v.id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-dossier-by-contact'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-dossiers'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-count-by-status'] })
      queryClient.invalidateQueries({ queryKey: ['audit-events'] })
    },
  })
}

// ─── Créer un dossier KYC (déclenche seed 5 checks + AuditEvent) ──────

interface CreateKycDossierInput {
  contactId: string
  agencyId: string
  transactionId?: string | null
  type: KycType
  vigilance: KycVigilance
  transactionAmount?: number | null
}

export function useCreateKycDossier() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateKycDossierInput) => {
      const { data, error } = await supabase
        .from('kyc_cases')
        .insert({
          contact_id: input.contactId,
          agency_id: input.agencyId,
          transaction_id: input.transactionId ?? null,
          type: input.type,
          vigilance: input.vigilance,
          transaction_amount: input.transactionAmount ?? null,
          risk_level:
            input.vigilance === 'renforced' ? 'medium' : 'low',
          // dossier_status default 'none', le trigger seed_kyc_lba_checks
          // crée 5 kyc_checklist_items + log AuditEvent "Dossier KYC ouvert".
        })
        .select('*')
        .single()
      if (error) throw error
      return data as KycCase
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kyc-dossiers'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-dossier-by-contact'] })
      queryClient.invalidateQueries({ queryKey: ['kyc-count-by-status'] })
      queryClient.invalidateQueries({ queryKey: ['audit-events'] })
    },
  })
}
