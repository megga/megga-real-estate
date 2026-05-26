// MEGGA CRM Sugar v3 — Dashboard Analytics — Hook d'audit nLPD/LBA
// Centralise les appels à `useLogAudit()` pour les 3 points exigés par le
// handoff Sprint 4 §"Definition of Done" :
//   (a) ouverture d'une session de relance
//   (b) chaque action dans la session (envoi / appel / report)
//   (c) clic sur un CTA IA depuis le dashboard (Coach, leviers, nudges)
//
// L'événement est append-only (RLS), conservation 10 ans (nLPD art. 12),
// horodaté par Postgres, hash-chain via la migration audit_actor_kind.

import { useCallback } from 'react'
import { useLogAudit } from '@/hooks/useAuditLog'

// IMPORTANT — naming convention: actions that PHYSICALLY happen (a real
// Edge Function call, a real Supabase mutation, a real Resend send) use
// the verb directly ('relance-sent'). Actions where the agent only marked
// something as done in the UI without the system actually performing it
// use the `-marked-` prefix to make the audit trail honest.
//
// As of PR #440, the relance session calls send-relance-email. On success
// it writes 'relance-sent' + system_dispatch: true + the Resend email id.
// On failure (mock leads with synthetic domains, network errors, Resend
// 4xx) it falls back to 'relance-marked-sent' + system_dispatch: false +
// the actual error in metadata.dispatch_error.
//
// `relance-marked-called` stays — we don't auto-dial, so a "called" ack
// is always agent UI. Same for 'relance-postponed' (no system action).
export type DashboardAiAction =
  | 'open-relance-session'
  | 'relance-sent'
  | 'relance-marked-sent'
  | 'relance-marked-called'
  | 'relance-postponed'
  | 'coach-cta-clicked'
  | 'levier-cta-clicked'
  | 'nudge-cta-clicked'

export function useDashboardAudit() {
  const { mutate } = useLogAudit()

  return useCallback(
    (
      action: DashboardAiAction,
      objectLabel?: string,
      metadata?: Record<string, unknown>,
    ) => {
      // `mutate` est fire-and-forget : on ne bloque pas l'UX si l'audit échoue
      // (utilisateur non authentifié en dev, hors-ligne, etc.). Le 2e argument
      // d'options fournit un `onError` silencieux pour éviter qu'une rejection
      // remonte en `unhandled promise` côté React Query.
      mutate(
        {
          category: 'ai',
          severity: 'info',
          action,
          entityType: 'dashboard-analytics',
          objectLabel: objectLabel ?? null,
          metadata: metadata ?? {},
        },
        {
          onError: (err) => {
            // Log info-level (pas error) : un audit raté ne doit pas alarmer
            // l'agent. La perte d'événement est tracée pour debug futur.
            if (import.meta.env.DEV) {
              console.info('[dashboard-audit] event dropped:', action, err)
            }
          },
        },
      )
    },
    [mutate],
  )
}
