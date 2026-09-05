/**
 * Envoi depuis la boîte de l'agent (D10) — jamais par Resend : un mail parti de
 * Resend ne serait ni dans son fil, ni dans ses « Envoyés », ni aligné DKIM sur
 * son domaine.
 *
 * ⚠ `mail-send` peut répondre 200 avec `warning: 'sent_but_not_recorded'` : le
 * fournisseur a ACCEPTÉ le message, seule la copie locale est incomplète. Ce
 * n'est pas un échec — le client a reçu le mail —, et l'écran ne doit jamais le
 * présenter comme tel.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invokeMail } from '@/lib/mail/invoke'
import type { MailAddress } from '@/hooks/useMailThreads'

export interface MailSendInput {
  kind: 'new' | 'reply' | 'forward'
  to: MailAddress[]; cc?: MailAddress[]; bcc?: MailAddress[]
  subject?: string; body_text: string
  in_reply_to_message_id?: string
  attachments?: { filename: string; mime_type: string; base64: string }[]
  draft_id?: string
}
export interface MailSendResult { ok: true; message_id: string | null; thread_id: string | null; warning?: string }

/** Envoie (nouveau, réponse ou transfert) et rafraîchit ce que l'envoi déplace. */
export function useMailSend(accountId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: MailSendInput) => {
      const r = await invokeMail<MailSendResult>('mail-send', { account_id: accountId, ...input })
      if (r.error) throw new Error(r.detail ? `${r.error}: ${r.detail}` : r.error)
      return r.data!
    },
    onSuccess: (d) => {
      void qc.invalidateQueries({ queryKey: ['mail', 'threads', accountId] })
      void qc.invalidateQueries({ queryKey: ['mail', 'folder-counts', accountId] })
      if (d.thread_id) void qc.invalidateQueries({ queryKey: ['mail', 'thread', d.thread_id] })
      void qc.invalidateQueries({ queryKey: ['mail', 'drafts', accountId] })
    },
  })
}
