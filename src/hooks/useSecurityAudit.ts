import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string
  metadata: Record<string, unknown>
  created_at: string
  agency_id: string | null
  actor_id: string | null
  actor_name?: string
  actor_email?: string
}

// These are the sensitive actions we track
export const SENSITIVE_ACTIONS = [
  'user_login',
  'user_logout',
  'password_changed',
  'role_changed',
  'agency_suspended',
  'agency_activated',
  'kyc_validated',
  'kyc_screening_match',
  'kyc_risk_changed',
  'impersonate_start',
  'impersonate_stop',
  'data_exported',
  'moderation_flag',
  'moderation_remove',
  'subscription_cancelled',
  'subscription_changed',
  'document_accessed',
  'weekly_report_sent',
] as const

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  user_login: 'Connexion',
  user_logout: 'Deconnexion',
  password_changed: 'Mot de passe modifie',
  role_changed: 'Role modifie',
  agency_suspended: 'Agence suspendue',
  agency_activated: 'Agence activee',
  kyc_validated: 'KYC valide',
  kyc_screening_match: 'Alerte PEP/Sanctions',
  kyc_risk_changed: 'Niveau risque KYC modifie',
  impersonate_start: 'Impersonate demarre',
  impersonate_stop: 'Impersonate arrete',
  data_exported: 'Donnees exportees',
  moderation_flag: 'Bien signale',
  moderation_remove: 'Bien retire',
  subscription_cancelled: 'Abonnement annule',
  subscription_changed: 'Abonnement modifie',
  document_accessed: 'Document consulte',
  weekly_report_sent: 'Rapport hebdo envoye',
}

export const AUDIT_SEVERITY: Record<string, 'critical' | 'warning' | 'info'> = {
  user_login: 'info',
  user_logout: 'info',
  password_changed: 'warning',
  role_changed: 'critical',
  agency_suspended: 'critical',
  agency_activated: 'warning',
  kyc_validated: 'warning',
  kyc_screening_match: 'critical',
  kyc_risk_changed: 'warning',
  impersonate_start: 'critical',
  impersonate_stop: 'info',
  data_exported: 'warning',
  moderation_flag: 'warning',
  moderation_remove: 'critical',
  subscription_cancelled: 'warning',
  subscription_changed: 'info',
  document_accessed: 'info',
  weekly_report_sent: 'info',
}

interface AuditFilters {
  severity?: 'critical' | 'warning' | 'info'
  action?: string
  limit?: number
}

export function useSecurityAudit(filters?: AuditFilters) {
  return useQuery({
    queryKey: ['admin-security-audit', filters],
    queryFn: async (): Promise<AuditEntry[]> => {
      let query = supabase
        .from('activity_events')
        .select('id, action, entity_type, entity_id, metadata, created_at, agency_id, actor_id')
        .order('created_at', { ascending: false })
        .limit(filters?.limit ?? 200)

      // Filter by sensitive actions
      if (filters?.action) {
        query = query.eq('action', filters.action)
      } else {
        query = query.in('action', [...SENSITIVE_ACTIONS])
      }

      const { data, error } = await query
      if (error) throw error

      // Resolve actor names
      const actorIds = [...new Set((data ?? []).map(e => e.actor_id).filter(Boolean))]
      let actorMap: Record<string, { name: string; email: string }> = {}
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', actorIds as string[])
        actorMap = Object.fromEntries(
          (profiles ?? []).map(p => [p.id, { name: p.full_name ?? '', email: p.email ?? '' }])
        )
      }

      return (data ?? []).map(e => ({
        ...e,
        entity_id: e.entity_id ?? '',
        metadata: (e.metadata ?? {}) as Record<string, unknown>,
        actor_name: e.actor_id ? actorMap[e.actor_id]?.name : undefined,
        actor_email: e.actor_id ? actorMap[e.actor_id]?.email : undefined,
      })) as unknown as AuditEntry[]
    },
    staleTime: 15_000,
  })
}
