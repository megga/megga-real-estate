/**
 * Envoi d'un email libre rédigé par l'agent (souvent depuis un brouillon MEGGA AI).
 * S'appuie sur l'edge function `send-email` (`agent_freeform`, gaté requireAgentAuth).
 *
 * ⚠ ON ENVOIE LE TEXTE, PAS DU HTML. Ce hook fabriquait ici un document HTML complet —
 * une QUATORZIÈME coquille d'e-mail, dans le bundle NAVIGATEUR, invisible à la porte
 * `lint:email-shell` qui ne scannait alors que `supabase/functions/`. Le front n'a aucune
 * raison de composer un e-mail : il dit quoi envoyer, le serveur dit à quoi ça ressemble.
 * (15.08.2026 — la porte couvre `src/` depuis.)
 * Human-in-the-loop : cet envoi est toujours déclenché par l'agent depuis le modal
 * de revue (EmailReviewModal), jamais automatiquement (règle CLAUDE.md).
 */
import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

export interface SendAgentEmailParams {
  to: string
  subject: string
  /** Corps en texte brut (les sauts de ligne deviennent des paragraphes). */
  body: string
  /** ISO 8601 → planification native Resend. Absent = envoi immédiat. */
  scheduledAt?: string
}

interface SendAgentEmailResult {
  success?: boolean
  emailId?: string
}

/** Mutation d'envoi de l'email agent : met le corps en forme puis invoque `send-email`. */
export function useSendAgentEmail() {
  return useMutation({
    mutationFn: async ({ to, subject, body, scheduledAt }: SendAgentEmailParams): Promise<SendAgentEmailResult> => {
      // On envoie le TEXTE, jamais du HTML : la mise en forme est faite côté serveur par
      // la coquille commune (`_shared/email-shell.ts`). invoke() attache le JWT de session.
      const { data, error } = await supabase.functions.invoke<SendAgentEmailResult>('send-email', {
        body: {
          to, subject, template: 'agent_freeform', data: { body },
          ...(scheduledAt ? { scheduled_at: scheduledAt } : {}),
        },
      })
      if (error) {
        let detail = error.message
        if (error instanceof FunctionsHttpError) {
          try {
            const b = await error.context.json()
            if (b?.error) detail = b.error as string
          } catch {
            /* garde le message générique */
          }
        }
        throw new Error(detail)
      }
      return data ?? {}
    },
  })
}
