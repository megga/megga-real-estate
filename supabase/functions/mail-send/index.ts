// supabase/functions/mail-send/index.ts
// Envoi depuis la boîte de l'agent (D10) : jamais Resend, jamais la coquille
// transactionnelle. MIME construit ici (texte + HTML + pièces), signature
// profiles.email_signature en pied, In-Reply-To/References sur réponse.
//   { account_id, kind: 'new'|'reply'|'forward', to, cc?, bcc?, subject?, body_text,
//     thread_id?, in_reply_to_message_id?, attachments?: [{filename, mime_type, base64}], draft_id? }
// Gmail : messages.send (+ threadId) puis ingestion immédiate du message rendu.
// Graph : brouillon → send ; ligne locale provisoire `pending:<Message-ID>` rapprochée
//         par la synchro « Envoyés » (ingest.ts).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { getValidAccessToken } from '../_shared/mail/secrets.ts'
import { base64ByteLength, base64Encode, base64UrlEncode, buildMime, escapeHtml, makeMessageId, textToHtml } from '../_shared/mail/mime.ts'
import { gmailAttachment, gmailGetMessage, gmailSend, normalizeGmailMessage } from '../_shared/mail/gmail.ts'
import { GRAPH_ATTACHMENT_MAX_BYTES, graphSend } from '../_shared/mail/graph.ts'
import { ingestMessages, recomputeThread } from '../_shared/mail/ingest.ts'
import type { MailAddress, OutgoingMessage } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const MAX_TOTAL_ATTACHMENT_BYTES = 20 * 1024 * 1024
const isAddr = (a: unknown): a is MailAddress => !!a && typeof a === 'object' && typeof (a as MailAddress).email === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((a as MailAddress).email)
const addrList = (v: unknown): MailAddress[] => (Array.isArray(v) ? v.filter(isAddr).map((a) => ({ name: typeof a.name === 'string' ? a.name : null, email: a.email.toLowerCase() })) : [])

interface OriginalRow {
  id: string; thread_id: string; provider_message_id: string; rfc822_message_id: string | null; in_reply_to: string | null
  from_name: string | null; from_email: string | null; reply_to: string | null; subject: string | null
  body_text: string | null; body_html: string | null; sent_at: string; to: MailAddress[]
}

function quoteHeader(o: OriginalRow, lang: string): string {
  const d = new Date(o.sent_at).toLocaleString(lang === 'de' ? 'de-CH' : lang === 'it' ? 'it-CH' : lang === 'en' ? 'en-GB' : 'fr-CH', { timeZone: 'Europe/Zurich', dateStyle: 'medium', timeStyle: 'short' })
  const who = o.from_name ? `${o.from_name} <${o.from_email}>` : (o.from_email ?? '')
  return ({ fr: `Le ${d}, ${who} a écrit :`, de: `Am ${d} schrieb ${who}:`, en: `On ${d}, ${who} wrote:`, it: `Il ${d}, ${who} ha scritto:` } as Record<string, string>)[lang] ?? `Le ${d}, ${who} a écrit :`
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), { userId: user.id, agencyId: profile.agency_id })
  if (!account) return json({ error: 'not_found' }, 404)
  if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
  const kind = body.kind === 'reply' || body.kind === 'forward' ? body.kind : 'new'
  const text = typeof body.body_text === 'string' ? body.body_text.trim() : ''
  let to = addrList(body.to)
  const cc = addrList(body.cc)
  const bcc = addrList(body.bcc)
  let subject = typeof body.subject === 'string' ? body.subject.trim() : ''
  const attachments = (Array.isArray(body.attachments) ? body.attachments : []) as { filename: string; mime_type: string; base64: string }[]
  if (attachments.reduce((n, a) => n + base64ByteLength(a.base64), 0) > MAX_TOTAL_ATTACHMENT_BYTES) return json({ error: 'attachments_too_large' }, 413)

  // Original (réponse/transfert) — TOUJOURS relu par account_id : un id étranger rend 404.
  let original: OriginalRow | null = null
  if (kind !== 'new') {
    const { data } = await admin.from('mail_messages')
      .select('id, thread_id, provider_message_id, rfc822_message_id, in_reply_to, from_name, from_email, reply_to, subject, body_text, body_html, sent_at, to')
      .eq('id', String(body.in_reply_to_message_id ?? '')).eq('account_id', account.id).maybeSingle()
    if (!data) return json({ error: 'original_not_found' }, 404)
    original = data as OriginalRow
    if (kind === 'reply' && to.length === 0) to = [{ name: original.from_name, email: (original.reply_to ?? original.from_email ?? '').toLowerCase() }].filter(isAddr)
    if (!subject) subject = `${kind === 'reply' ? 'Re' : 'Fwd'}: ${(original.subject ?? '').replace(/^(re|fwd?|tr)\s*:\s*/i, '')}`
  }
  if (to.length === 0) return json({ error: 'recipient_required' }, 400)
  if (!subject && kind === 'new') return json({ error: 'subject_required' }, 400)

  // Signature + citation
  const { data: prof } = await admin.from('profiles').select('email_signature, language, full_name').eq('id', user.id).maybeSingle()
  const lang = (prof?.language as string | null) ?? 'fr'
  const signature = (prof?.email_signature as string | null)?.trim() ?? ''
  let fullText = signature ? `${text}\n\n-- \n${signature}` : text
  let fullHtml = textToHtml(fullText)
  if (original) {
    const qh = quoteHeader(original, lang)
    fullText += `\n\n${qh}\n${(original.body_text ?? '').split('\n').map((l) => `> ${l}`).join('\n')}`
    fullHtml += `<p style="margin-top:16px;color:#686868">${escapeHtml(qh)}</p><blockquote style="margin:0 0 0 8px;padding-left:12px;border-left:2px solid #cccccc">${original.body_html ?? textToHtml(original.body_text ?? '')}</blockquote>`
  }

  // Transfert Gmail : on rattache les pièces de l'original (Graph le fait seul via createForward).
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
  const outAtts = attachments.map((a) => ({ filename: String(a.filename).slice(0, 200), mimeType: String(a.mime_type || 'application/octet-stream'), base64: String(a.base64) }))
  let token: string
  try { token = await getValidAccessToken(admin, account, account.provider === 'gmail' ? cfg.gmail : cfg.outlook) }
  catch (e) { return json({ error: 'provider_auth', detail: e instanceof Error ? e.message : String(e) }, 502) }

  if (kind === 'forward' && original && account.provider === 'gmail') {
    const { data: origAtts } = await admin.from('mail_attachments').select('provider_attachment_id, filename, mime_type').eq('message_id', original.id).eq('is_inline', false)
    for (const a of origAtts ?? []) {
      const bytes = await gmailAttachment(token, original.provider_message_id, a.provider_attachment_id)
      outAtts.push({ filename: a.filename, mimeType: a.mime_type, base64: base64Encode(bytes) })
    }
  }

  // ⛔ Graph refuse une pièce de 3 Mo ou plus dans la collection d'un brouillon
  // (« limits the size of the attachment you can add to under 3 MB ») et ce build
  // n'implémente pas `createUploadSession`. Sans ce contrôle, un PDF de 4 Mo envoyé à
  // un acheteur passait sur Gmail et rendait 502 `send_failed` sur Outlook, sans que
  // rien ne dise que la TAILLE était en cause.
  if (account.provider === 'outlook') {
    const tooBig = outAtts.find((a) => base64ByteLength(a.base64) >= GRAPH_ATTACHMENT_MAX_BYTES)
    if (tooBig) return json({ error: 'attachment_too_large_outlook', filename: tooBig.filename, limit_bytes: GRAPH_ATTACHMENT_MAX_BYTES }, 413)
  }

  const messageId = makeMessageId(account.email.split('@')[1] ?? 'megga.ch')
  // ⛔ UN TRANSFERT N'EST PAS UNE RÉPONSE. Coller `In-Reply-To`/`References` de
  // l'original sur un transfert le range, chez le DESTINATAIRE, dans une conversation
  // à laquelle il n'a jamais participé (RFC 5322 : ces en-têtes désignent le message
  // auquel on RÉPOND). Ils ne sont posés que pour `reply`.
  const isReply = kind === 'reply'
  const outgoing: OutgoingMessage = {
    from: { name: account.display_name ?? (prof?.full_name as string | null) ?? null, email: account.email },
    to, cc, bcc, subject, text: fullText, html: fullHtml,
    inReplyTo: isReply ? (original?.rfc822_message_id ?? null) : null,
    references: isReply && original ? [...(original.in_reply_to ? [original.in_reply_to] : []), ...(original.rfc822_message_id ? [original.rfc822_message_id] : [])] : [],
    messageId, attachments: outAtts,
  }

  let localMessageId: string | null = null
  let threadId: string | null = original?.thread_id ?? null
  if (account.provider !== 'gmail' && account.provider !== 'outlook') return json({ error: 'provider_not_supported' }, 501)

  /**
   * ⛔ DEUX PHASES, DEUX VERDICTS — et la frontière est l'ACCEPTATION PAR LE
   * FOURNISSEUR. Un seul `try` couvrait l'appel fournisseur ET toute la comptabilité
   * locale : `gmailSend` réussissait (le courrier est PARTI, le client l'a), puis
   * `ingestMessages` levait sur n'importe quelle écriture — insertion de fil, de
   * message, de pièce — et l'edge répondait `send_failed` en 502. Côté Outlook,
   * `t!.id` sur une insertion non vérifiée levait un TypeError dans le même catch.
   * L'agent lit « échec », renvoie, et le client reçoit le message DEUX fois. Rien ne
   * distinguait « le fournisseur a refusé » de « le fournisseur a accepté et nous
   * n'avons pas su l'écrire ».
   *
   * Après acceptation, la réponse est donc 200 avec un drapeau que le lot 2 peut
   * afficher (« envoyé ; copie locale incomplète, elle se rattrapera à la synchro »),
   * jamais une erreur d'envoi. Le rattrapage existe : Gmail réingère le message à la
   * passe suivante, et Graph rapproche la copie « Envoyés » par Message-ID.
   */
  let sentProviderMessageId: string | null = null
  try {
    if (account.provider === 'gmail') {
      const { data: th } = threadId ? await admin.from('mail_threads').select('provider_thread_id').eq('id', threadId).single() : { data: null }
      // ⛔ PAS DE threadId POUR UN TRANSFERT. Le guide d'envoi de Gmail pose les
      // conditions pour qu'un message rejoigne un fil existant : « The Subject headers
      // match » et « The References and In-Reply-To headers follow the RFC 2822
      // standard ». Un transfert porte `Fwd: <objet>`, qui ne concorde PAS. Les deux
      // issues étaient mauvaises : ou Gmail refusait l'envoi (502 `send_failed`, le
      // transfert devenait impossible), ou il l'acceptait en ouvrant un fil à part —
      // et le CRM gardait le transfert dans l'ancien fil pendant que Gmail le rangeait
      // ailleurs, les deux boîtes divergeant définitivement. Le fil CRM suit désormais
      // le fournisseur : la ligne relue après ingestion porte le vrai `thread_id`.
      const providerThreadId = kind === 'forward' ? null : (th?.provider_thread_id ?? null)
      const sent = await gmailSend(token, base64UrlEncode(new TextEncoder().encode(buildMime(outgoing))), providerThreadId)
      sentProviderMessageId = sent.id
    } else {
      const mode = original ? { kind: kind as 'reply' | 'forward', providerMessageId: original.provider_message_id } : { kind: 'new' as const }
      await graphSend(token, { subject, html: fullHtml, to, cc, bcc, internetMessageId: messageId, attachments: outAtts }, mode)
    }
  } catch (e) {
    return json({ error: 'send_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
  }

  // ── Le courrier est PARTI. Tout ce qui suit est de la comptabilité locale. ───────
  let bookkeeping: string | null = null
  try {
    if (account.provider === 'gmail') {
      // Gmail rend l'id du message envoyé ; sans lui il n'y a rien à réingérer.
      if (!sentProviderMessageId) throw new Error('gmail: aucun id de message rendu par messages.send')
      const full = await gmailGetMessage(token, sentProviderMessageId)
      await ingestMessages(admin, account, [normalizeGmailMessage(full, account.email)], { skipAudit: true })
      const { data: row, error } = await admin.from('mail_messages').select('id, thread_id').eq('account_id', account.id).eq('provider_message_id', sentProviderMessageId).maybeSingle()
      if (error) throw new Error(`relecture du message envoyé: ${error.message}`)
      localMessageId = row?.id ?? null; threadId = row?.thread_id ?? threadId
    } else {
      // Ligne provisoire : la synchro « Envoyés » la rapproche par Message-ID.
      if (!threadId) {
        const { data: t, error } = await admin.from('mail_threads').insert({
          account_id: account.id, agency_id: account.agency_id, provider_thread_id: `pending-thread:${messageId}`,
          subject, snippet: text.slice(0, 160), participants: to, from_name: outgoing.from.name, from_email: account.email,
          last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), message_count: 0, is_read: true,
        }).select('id').single()
        // ⚠ `t!.id` sur un résultat non vérifié levait un TypeError — dans l'ancien
        // `try` unique, cela devenait `send_failed` sur un courrier DÉJÀ PARTI.
        if (error || !t) throw new Error(`fil provisoire: ${error?.message ?? 'aucune ligne rendue'}`)
        threadId = t.id
      }
      const { data: m, error: eMsg } = await admin.from('mail_messages').insert({
        thread_id: threadId, account_id: account.id, agency_id: account.agency_id,
        provider_message_id: `pending:${messageId}`, rfc822_message_id: messageId, in_reply_to: outgoing.inReplyTo,
        direction: 'outbound', from_name: outgoing.from.name, from_email: account.email, to, cc, bcc,
        subject, snippet: text.slice(0, 160), body_text: fullText, body_html: fullHtml, sent_at: new Date().toISOString(),
        is_read: true, has_attachments: outAtts.length > 0,
      }).select('id').single()
      if (eMsg) throw new Error(`message provisoire: ${eMsg.message}`)
      localMessageId = m?.id ?? null
      const { error: eThread } = await admin.from('mail_threads').update({ last_message_at: new Date().toISOString(), last_outbound_at: new Date().toISOString(), snippet: text.slice(0, 160) }).eq('id', threadId)
      if (eThread) throw new Error(`fil, dates: ${eThread.message}`)
      // Le compteur et les dates viennent des messages : la ligne provisoire compte déjà.
      // ⚠ `threadId` est `string | null` ici pour TypeScript (il vient de `original?.thread_id`) :
      // sans cette garde, `deno check` rend TS2345 et l'étape CI « Type-check Edge Functions »,
      // déclarée bloquante, rougit.
      if (threadId) await recomputeThread(admin, threadId)
    }
  } catch (e) {
    // JAMAIS 502 ici : le fournisseur a accepté. Un refus renvoyé à l'agent le ferait
    // renvoyer, et le client recevrait le courrier deux fois.
    bookkeeping = e instanceof Error ? e.message : String(e)
    console.error(`[mail-send] ${account.provider} ${account.id}: envoyé mais NON enregistré — ${bookkeeping}`)
  }

  // Audit avec l'acteur (l'ingestion a été appelée en skipAudit).
  const { data: th } = threadId ? await admin.from('mail_threads').select('contact_id').eq('id', threadId).maybeSingle() : { data: null }
  if (th?.contact_id) {
    await admin.from('activity_events').insert({
      agency_id: account.agency_id, actor_id: user.id, actor_kind: 'user', action: 'email_sent', category: 'messaging', severity: 'info',
      entity_type: 'contact', entity_id: th.contact_id, object_label: subject,
      metadata: { thread_id: threadId, message_id: localMessageId, account_id: account.id, to: to.map((a) => a.email), kind },
    })
  }
  if (typeof body.draft_id === 'string') await admin.from('mail_drafts').delete().eq('id', body.draft_id).eq('author_id', user.id)
  // `ok: true` parce que le courrier est parti — `warning` dit que la copie locale est
  // incomplète, pour que l'UI l'annonce au lieu d'inviter à renvoyer.
  return json(bookkeeping
    ? { ok: true, message_id: localMessageId, thread_id: threadId, warning: 'sent_but_not_recorded', detail: bookkeeping.slice(0, 300) }
    : { ok: true, message_id: localMessageId, thread_id: threadId })
})
