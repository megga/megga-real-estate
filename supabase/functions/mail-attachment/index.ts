// supabase/functions/mail-attachment/index.ts
// GET  ?id=<mail_attachments.id>       → octets de la pièce, streamés depuis le fournisseur
//                                        (jamais d'URL publique ; type SERVI décidé par la
//                                        liste blanche `attachmentServing`, jamais celui
//                                        que l'expéditeur a déclaré).
// POST { action:'file', attachment_id, contact_id, document_type, name?, category? }
//                                      → copie dans le bucket `documents` + ligne `documents`
//                                        (contact_id, sha256), mail_attachments.document_id posé.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { accountVisibleTo, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { attachmentServing } from '../_shared/mail/mime.ts'
import { getValidAccessToken } from '../_shared/mail/secrets.ts'
import { gmailAttachment } from '../_shared/mail/gmail.ts'
import { graphAttachmentBytes } from '../_shared/mail/graph.ts'
import type { MailAccountRow } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const MAX_BYTES = 25 * 1024 * 1024
// Allowlist du bucket `documents` (migration 20260802140000) — la même liste, sinon l'upload échoue après téléchargement.
const DOC_MIME: Record<string, string> = {
  'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
}
const CATEGORY_BY_TYPE: Record<string, string> = { piece_identite: 'identity', justificatif_domicile: 'domicile', financement: 'financial', contrat: 'compliance', mandat: 'compliance' }

interface AttRow { id: string; message_id: string; account_id: string; agency_id: string; provider_attachment_id: string; filename: string; mime_type: string; size_bytes: number; document_id: string | null }

async function loadAttachment(admin: SupabaseClient, id: string, ctx: { userId: string; agencyId: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data: att } = await admin.from('mail_attachments').select('*').eq('id', id).maybeSingle()
  if (!att) return null
  const { data: account } = await admin.from('mail_accounts').select('*').eq('id', att.account_id).maybeSingle()
  if (!account || !accountVisibleTo(account as MailAccountRow, ctx)) return null
  const { data: msg } = await admin.from('mail_messages').select('provider_message_id').eq('id', att.message_id).single()
  return { att: att as AttRow, account: account as MailAccountRow, providerMessageId: msg!.provider_message_id as string }
}

async function fetchBytes(admin: SupabaseClient, a: NonNullable<Awaited<ReturnType<typeof loadAttachment>>>): Promise<Uint8Array> {
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
  const token = await getValidAccessToken(admin, a.account, a.account.provider === 'gmail' ? cfg.gmail : cfg.outlook)
  if (a.account.provider === 'gmail') return gmailAttachment(token, a.providerMessageId, a.att.provider_attachment_id)
  if (a.account.provider === 'outlook') return graphAttachmentBytes(token, a.providerMessageId, a.att.provider_attachment_id)
  throw new Error('provider_not_supported')
}

const toBuffer = (b: Uint8Array): ArrayBuffer => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', toBuffer(bytes))
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('')
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  const ctx = { userId: user.id, agencyId: profile.agency_id }

  if (req.method === 'GET') {
    const id = new URL(req.url).searchParams.get('id') ?? ''
    const a = await loadAttachment(admin, id, ctx)
    if (!a) return json({ error: 'not_found' }, 404)
    if (a.att.size_bytes > MAX_BYTES) return json({ error: 'too_large' }, 413)
    let bytes: Uint8Array
    try { bytes = await fetchBytes(admin, a) } catch (e) { return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502) }
    const name = encodeURIComponent(a.att.filename).replace(/['()]/g, escape)
    // Le type vient de l'EXPÉDITEUR du courrier : il ne traverse jamais tel quel.
    // `attachmentServing` (mime.ts) rend l'essence autorisée pour un rendu en ligne, ou
    // `application/octet-stream` + `attachment` pour tout le reste — sans quoi une pièce
    // déclarée `text/html` s'exécutait dans la session de l'agent.
    const serving = attachmentServing(a.att.mime_type)
    return new Response(toBuffer(bytes), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': serving.contentType,
        'Content-Length': String(bytes.byteLength),
        'Content-Disposition': `${serving.disposition}; filename*=UTF-8''${name}`,
        'Cache-Control': 'private, max-age=300',
        'X-Content-Type-Options': 'nosniff',
        // Ceinture et bretelles : même si un jour une essence scriptable entrait dans la
        // liste, la page servie ici n'a droit à rien.
        'Content-Security-Policy': "default-src 'none'; sandbox",
      },
    })
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (body.action !== 'file') return json({ error: 'unknown_action' }, 400)
  const a = await loadAttachment(admin, String(body.attachment_id ?? ''), ctx)
  if (!a) return json({ error: 'not_found' }, 404)
  const contactId = String(body.contact_id ?? '')
  const { data: contact } = await admin.from('contacts').select('id').eq('id', contactId).eq('agency_id', profile.agency_id).maybeSingle()
  if (!contact) return json({ error: 'contact_not_found' }, 404)
  const ext = DOC_MIME[a.att.mime_type]
  if (!ext) return json({ error: 'unsupported_type', mime: a.att.mime_type, allowed: Object.keys(DOC_MIME) }, 415)
  if (a.att.size_bytes > 20 * 1024 * 1024) return json({ error: 'too_large' }, 413)

  let bytes: Uint8Array
  try { bytes = await fetchBytes(admin, a) } catch (e) { return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502) }
  const documentId = crypto.randomUUID()
  const storagePath = `${profile.agency_id}/${documentId}.${ext}`
  const { error: upErr } = await admin.storage.from('documents').upload(storagePath, toBuffer(bytes), { contentType: a.att.mime_type, upsert: false })
  if (upErr) return json({ error: 'upload_failed', detail: upErr.message }, 500)
  const docType = typeof body.document_type === 'string' && body.document_type ? body.document_type.slice(0, 40) : 'autre'
  const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 160) : a.att.filename
  const { error: insErr } = await admin.from('documents').insert({
    id: documentId, agency_id: profile.agency_id, contact_id: contactId, name, type: docType,
    document_category: CATEGORY_BY_TYPE[docType] ?? 'other', storage_path: storagePath, size_bytes: bytes.byteLength,
    status: 'available', uploaded_by: user.id, sha256_hash: await sha256Hex(bytes),
  })
  if (insErr) {
    await admin.storage.from('documents').remove([storagePath])
    return json({ error: 'document_insert_failed', detail: insErr.message }, 500)
  }
  await admin.from('mail_attachments').update({ document_id: documentId }).eq('id', a.att.id)
  await admin.from('activity_events').insert({
    agency_id: profile.agency_id, actor_id: user.id, actor_kind: 'user', action: 'document_filed_from_email', category: 'doc', severity: 'info',
    entity_type: 'contact', entity_id: contactId, object_label: name,
    metadata: { document_id: documentId, attachment_id: a.att.id, message_id: a.att.message_id, document_type: docType },
  })
  return json({ ok: true, document_id: documentId, storage_path: storagePath })
})
