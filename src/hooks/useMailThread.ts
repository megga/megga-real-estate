/**
 * Un fil ouvert : ses messages dans l'ordre, chacun avec les MÉTADONNÉES de ses
 * pièces jointes. Les octets, eux, ne viennent qu'à la demande
 * (`useMailAttachmentBlob`) — une liste ne télécharge rien.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { MailAddress } from '@/hooks/useMailThreads'

export interface MailAttachmentRow { id: string; message_id: string; filename: string; mime_type: string; size_bytes: number; is_inline: boolean; content_id: string | null; document_id: string | null }
export interface MailMessageRow {
  id: string; thread_id: string; direction: 'inbound' | 'outbound'; from_name: string | null; from_email: string | null
  to: MailAddress[]; cc: MailAddress[]; subject: string | null; snippet: string | null; body_text: string | null; body_html: string | null
  body_truncated: boolean; sent_at: string; is_read: boolean; has_attachments: boolean; contact_id: string | null
  mail_attachments: MailAttachmentRow[]
}

/** Les messages d'un fil, du plus ancien au plus récent. */
export function useMailThread(threadId: string | null) {
  return useQuery({
    queryKey: ['mail', 'thread', threadId],
    enabled: !!threadId,
    queryFn: async (): Promise<MailMessageRow[]> => {
      // `enabled` garantit l'identifiant, le typage ne le sait pas.
      if (!threadId) throw new Error('no_thread')
      const { data, error } = await supabase.from('mail_messages')
        .select('id, thread_id, direction, from_name, from_email, to, cc, subject, snippet, body_text, body_html, body_truncated, sent_at, is_read, has_attachments, contact_id, mail_attachments(id, message_id, filename, mime_type, size_bytes, is_inline, content_id, document_id)')
        .eq('thread_id', threadId).order('sent_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as MailMessageRow[]
    },
    staleTime: 10_000,
  })
}
