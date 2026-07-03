// Envoi d'un email libre rédigé par l'agent (souvent depuis un brouillon MEGGA AI).
// S'appuie sur l'edge function `send-email` (case `default`, gaté requireAgentAuth) :
// on passe le corps déjà mis en forme dans `data.html`. AUCUN backend neuf.
// Human-in-the-loop : cet envoi est toujours déclenché par l'agent depuis le modal
// de revue (EmailReviewModal), jamais automatiquement (règle CLAUDE.md).

import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { FunctionsHttpError } from '@supabase/supabase-js'

export interface SendAgentEmailParams {
  to: string
  subject: string
  /** Corps en texte brut (les sauts de ligne deviennent des paragraphes). */
  body: string
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Gabarit MEGGA (repris de la structure de send-email/wrapHTML) — corps en
// paragraphes, sauts de ligne simples en <br>.
function buildEmailHtml(body: string): string {
  const paragraphs = body
    .trim()
    .split(/\n{2,}/)
    .map(
      (par) =>
        `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">${escapeHtml(par).replace(/\n/g, '<br>')}</p>`,
    )
    .join('')
  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif"><div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb"><div style="background:#1a1a1a;padding:24px 32px;text-align:center"><span style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:1px">MEGGA</span></div><div style="padding:32px">${paragraphs}</div><div style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center"><span style="font-size:12px;color:#9ca3af">MEGGA Real Estate — Genève</span></div></div></body></html>`
}

interface SendAgentEmailResult {
  success?: boolean
  emailId?: string
}

export function useSendAgentEmail() {
  return useMutation({
    mutationFn: async ({ to, subject, body }: SendAgentEmailParams): Promise<SendAgentEmailResult> => {
      const html = buildEmailHtml(body)
      // template hors switch → case `default` de send-email (rend data.html tel quel,
      // exige une session agent). invoke() attache le JWT de session.
      const { data, error } = await supabase.functions.invoke<SendAgentEmailResult>('send-email', {
        body: { to, subject, template: 'agent_freeform', data: { html } },
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
