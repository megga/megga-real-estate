// supabase/functions/_shared/resend.ts
//
// Envoi transactionnel Resend, en un seul endroit.
//
// POURQUOI CE MODULE. Le dépôt compte quatorze sites d'appel qui refont chacun le même
// `fetch('https://api.resend.com/emails')`, avec chacun sa propre gestion (ou absence)
// d'erreur. On n'en ajoute pas un quinzième. Les quatorze existants ne sont pas repris
// ici : les convertir est une livraison à part, avec ses propres tests.
//
// Le champ `attachments` suit la forme documentée par Resend : `content` en base64,
// `filename`, et `content_type` facultatif (déduit du nom de fichier sinon).

export interface ResendAttachment {
  filename: string
  /** Contenu encodé en base64. */
  content: string
  content_type?: string
}

export interface ResendMessage {
  to: string | string[]
  subject: string
  html: string
  from?: string
  replyTo?: string
  attachments?: ResendAttachment[]
  /** ISO 8601, ou langage naturel accepté par Resend. */
  scheduledAt?: string
}

export interface ResendResult {
  ok: boolean
  id?: string
  error?: string
}

const DEFAULT_FROM = 'MEGGA <noreply@megga.ch>'

/** Encode une chaîne UTF-8 en base64, sans dépendre de `Buffer` (absent en Deno). */
export function toBase64(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Envoie un e-mail. Ne lève jamais : l'appelant décide si un envoi raté doit faire
 * échouer son geste. Pour une confirmation de rendez-vous, non — le rendez-vous est
 * pris, et un e-mail perdu se rattrape ; faire échouer la réservation, non.
 */
export async function sendResendEmail(message: ResendMessage): Promise<ResendResult> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) return { ok: false, error: 'RESEND_API_KEY missing' }

  const recipients = Array.isArray(message.to) ? message.to : [message.to]
  const clean = recipients.filter((r) => typeof r === 'string' && r.includes('@'))
  if (clean.length === 0) return { ok: false, error: 'no valid recipient' }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: message.from ?? DEFAULT_FROM,
        to: clean,
        subject: message.subject,
        html: message.html,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
        ...(message.attachments?.length ? { attachments: message.attachments } : {}),
        ...(message.scheduledAt ? { scheduled_at: message.scheduledAt } : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      return { ok: false, error: `resend ${res.status}: ${detail.slice(0, 300)}` }
    }

    const data = await res.json().catch(() => ({}))
    return { ok: true, id: typeof data?.id === 'string' ? data.id : undefined }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'unknown error' }
  }
}
