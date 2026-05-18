// supabase/functions/outlook-mail-sync/index.ts
// Outlook Mail sync — save tokens, list messages, disconnect.
// Pattern aligné sur outlook-calendar-sync : OAuth refresh via Azure + service role admin.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'save_tokens' | 'list_messages' | 'list_by_contact' | 'get_message' | 'get_thread' | 'send_message' | 'mark_read' | 'disconnect'

interface SyncRequest {
  action: Action
  access_token?: string
  refresh_token?: string
  expires_in?: number
  outlook_email?: string
  query?: string
  max_results?: number
  email_address?: string
  contact_id?: string
  message_id?: string
  // send_message
  to?: string[]
  cc?: string[]
  bcc?: string[]
  subject?: string
  body_text?: string
  body_html?: string
  reply_to_message_id?: string
  // mark_read / get_thread
  thread_id?: string
  is_read?: boolean
}

interface OutlookMessageRaw {
  id: string
  conversationId: string
  subject?: string
  bodyPreview?: string
  receivedDateTime?: string
  sentDateTime?: string
  isRead?: boolean
  hasAttachments?: boolean
  from?: { emailAddress?: { name?: string; address?: string } }
  toRecipients?: { emailAddress?: { name?: string; address?: string } }[]
  ccRecipients?: { emailAddress?: { name?: string; address?: string } }[]
}

const MS_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID') ?? ''
const MS_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token?: string; expires_in: number } | null> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MS_CLIENT_ID,
      client_secret: MS_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Mail.Read offline_access User.Read',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
  }
}

async function getValidToken(userId: string): Promise<string | null> {
  const db = supabaseAdmin()
  const { data: tokenRow } = await db
    .from('outlook_mail_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!tokenRow) return null

  const now = new Date()
  const expiresAt = new Date(tokenRow.token_expires_at)

  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokenRow.access_token
  }

  const refreshed = await refreshAccessToken(tokenRow.refresh_token)
  if (!refreshed) {
    await db
      .from('outlook_mail_tokens')
      .update({ sync_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return null
  }

  // Microsoft peut rotater le refresh_token : on persiste le nouveau si fourni.
  await db
    .from('outlook_mail_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token ?? tokenRow.refresh_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return refreshed.access_token
}

async function graphFetch(accessToken: string, path: string): Promise<unknown> {
  const res = await fetch(`${GRAPH_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Graph API error ${res.status}: ${err}`)
  }
  return res.json()
}

interface NormalizedMessage {
  id: string
  thread_id: string
  from_address: string
  from_name: string
  to_addresses: string[]
  cc_addresses: string[]
  subject: string
  snippet: string
  sent_at: string
  is_unread: boolean
  has_attachments: boolean
}

function normalizeOutlookMessage(raw: OutlookMessageRaw): NormalizedMessage {
  const fromAddr = raw.from?.emailAddress?.address ?? ''
  const fromName = raw.from?.emailAddress?.name ?? ''
  const toAddresses = (raw.toRecipients ?? []).map(r => r.emailAddress?.address ?? '').filter(Boolean)
  const ccAddresses = (raw.ccRecipients ?? []).map(r => r.emailAddress?.address ?? '').filter(Boolean)
  const sentAt = raw.receivedDateTime ?? raw.sentDateTime ?? new Date().toISOString()
  return {
    id: raw.id,
    thread_id: raw.conversationId,
    from_address: fromAddr,
    from_name: fromName,
    to_addresses: toAddresses,
    cc_addresses: ccAddresses,
    subject: raw.subject ?? '',
    snippet: raw.bodyPreview ?? '',
    sent_at: sentAt,
    is_unread: !(raw.isRead ?? true),
    has_attachments: raw.hasAttachments ?? false,
  }
}

interface GraphMessagesPage { value: OutlookMessageRaw[] }

async function fetchMessagesList(
  accessToken: string,
  filter: string,
  max: number,
): Promise<NormalizedMessage[]> {
  const params = new URLSearchParams({
    $top: String(max),
    $orderby: 'receivedDateTime desc',
    $select: 'id,conversationId,subject,bodyPreview,receivedDateTime,sentDateTime,isRead,hasAttachments,from,toRecipients,ccRecipients',
  })
  if (filter) params.set('$filter', filter)
  const data = await graphFetch(accessToken, `/me/messages?${params}`) as GraphMessagesPage
  return (data.value ?? []).map(normalizeOutlookMessage)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SyncRequest = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const userId = user.id
    const db = supabaseAdmin()

    switch (body.action) {
      case 'save_tokens': {
        if (!body.access_token || !body.refresh_token) throw new Error('Missing tokens')
        const expiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString()

        await db.from('outlook_mail_tokens').upsert({
          user_id: userId,
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          token_expires_at: expiresAt,
          outlook_email: body.outlook_email ?? null,
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'list_messages': {
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Mail not connected or token expired')

        const messages = await fetchMessagesList(accessToken, body.query ?? '', body.max_results ?? 20)

        await db.from('outlook_mail_tokens')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('user_id', userId)

        return new Response(JSON.stringify({ messages }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'list_by_contact': {
        if (!body.email_address) throw new Error('Missing email_address')
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Mail not connected or token expired')

        const max = body.max_results ?? 20
        // Filter Graph : messages reçus DE l'adresse OU envoyés VERS l'adresse
        const safeAddr = body.email_address.replace(/'/g, "''")
        const filter = `(from/emailAddress/address eq '${safeAddr}') or (toRecipients/any(r:r/emailAddress/address eq '${safeAddr}'))`
        const messages = await fetchMessagesList(accessToken, filter, max)

        if (messages.length > 0) {
          const rows = messages.map(m => ({
            user_id: userId,
            provider: 'outlook',
            external_message_id: m.id,
            external_thread_id: m.thread_id,
            from_address: m.from_address,
            from_name: m.from_name,
            to_addresses: m.to_addresses,
            cc_addresses: m.cc_addresses,
            subject: m.subject,
            snippet: m.snippet,
            contact_id: body.contact_id ?? null,
            sent_at: m.sent_at,
            is_unread: m.is_unread,
            has_attachments: m.has_attachments,
            fetched_at: new Date().toISOString(),
          }))
          await db.from('email_messages_cache').upsert(rows, {
            onConflict: 'user_id,provider,external_message_id',
          })
        }

        return new Response(JSON.stringify({ messages }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'send_message': {
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Mail not connected')
        if (!body.to || body.to.length === 0) throw new Error('Missing recipient')

        // Récup signature email du profil
        const { data: profile } = await db
          .from('profiles')
          .select('email_signature')
          .eq('id', userId)
          .single()
        const signature = profile?.email_signature ?? null

        const textBody = body.body_text ?? ''
        const fullText = signature ? `${textBody}\n\n--\n${signature}` : textBody

        const message = {
          subject: body.subject ?? '(Sans objet)',
          body: {
            contentType: 'Text' as const,
            content: fullText,
          },
          toRecipients: body.to.map(addr => ({ emailAddress: { address: addr } })),
          ccRecipients: (body.cc ?? []).map(addr => ({ emailAddress: { address: addr } })),
          bccRecipients: (body.bcc ?? []).map(addr => ({ emailAddress: { address: addr } })),
        }

        // Microsoft Graph : si reply_to_message_id, on utilise /reply au lieu de /sendMail
        // pour préserver le thread et le subject. Sinon /sendMail standard.
        if (body.reply_to_message_id) {
          const replyRes = await fetch(`${GRAPH_API}/me/messages/${body.reply_to_message_id}/reply`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ comment: fullText }),
          })
          if (!replyRes.ok) {
            const err = await replyRes.text()
            throw new Error(`Outlook reply error ${replyRes.status}: ${err}`)
          }
        } else {
          const sendRes = await fetch(`${GRAPH_API}/me/sendMail`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, saveToSentItems: true }),
          })
          if (!sendRes.ok) {
            const err = await sendRes.text()
            throw new Error(`Outlook send error ${sendRes.status}: ${err}`)
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_message': {
        if (!body.message_id) throw new Error('Missing message_id')
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Mail not connected')

        const full = await graphFetch(accessToken, `/me/messages/${body.message_id}`)

        return new Response(JSON.stringify({ message: full }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'mark_read': {
        if (!body.message_id) throw new Error('Missing message_id')
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Mail not connected')

        const isRead = body.is_read ?? true
        const res = await fetch(`${GRAPH_API}/me/messages/${body.message_id}`, {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ isRead }),
        })
        if (!res.ok) {
          const err = await res.text()
          throw new Error(`Outlook mark_read error ${res.status}: ${err}`)
        }

        await db.from('email_messages_cache')
          .update({ is_unread: !isRead })
          .eq('user_id', userId)
          .eq('provider', 'outlook')
          .eq('external_message_id', body.message_id)

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'get_thread': {
        if (!body.thread_id) throw new Error('Missing thread_id')
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Mail not connected')

        // Graph : threads = filtre par conversationId. On récupère le body + attachments
        // de chaque message du thread.
        const params = new URLSearchParams({
          $filter: `conversationId eq '${body.thread_id.replace(/'/g, "''")}'`,
          $orderby: 'receivedDateTime asc',
          $top: '50',
          $select: 'id,conversationId,subject,bodyPreview,receivedDateTime,sentDateTime,isRead,hasAttachments,from,toRecipients,ccRecipients,body',
        })
        const data = await graphFetch(accessToken, `/me/messages?${params}`) as {
          value: Array<OutlookMessageRaw & { body?: { contentType: string; content: string }; hasAttachments?: boolean }>
        }

        const messages = await Promise.all((data.value ?? []).map(async raw => {
          const normalized = normalizeOutlookMessage(raw)
          const bodyText = raw.body?.contentType === 'html'
            ? raw.body.content.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim()
            : (raw.body?.content ?? raw.bodyPreview ?? '')

          // Liste les pièces jointes si présentes
          let attachments: { filename: string; mime_type: string; size: number; attachment_id: string }[] = []
          if (raw.hasAttachments) {
            try {
              const att = await graphFetch(accessToken, `/me/messages/${raw.id}/attachments?$select=id,name,contentType,size`) as {
                value: Array<{ id: string; name: string; contentType: string; size: number }>
              }
              attachments = (att.value ?? []).map(a => ({
                filename: a.name,
                mime_type: a.contentType,
                size: a.size,
                attachment_id: a.id,
              }))
            } catch { /* ignore */ }
          }
          return { ...normalized, body_text: bodyText, attachments }
        }))

        return new Response(JSON.stringify({ thread_id: body.thread_id, messages }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      case 'disconnect': {
        const { data: tokenRow } = await db
          .from('outlook_mail_tokens')
          .select('id')
          .eq('user_id', userId)
          .single()

        if (tokenRow) {
          // Pas d'endpoint revoke pour Graph — la suppression locale + l'expiration
          // du refresh_token côté Microsoft suffisent. L'utilisateur peut révoquer
          // manuellement sur account.microsoft.com/privacy/app-access.
          await db.from('email_messages_cache').delete().eq('user_id', userId).eq('provider', 'outlook')
          await db.from('outlook_mail_tokens').delete().eq('user_id', userId)
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      default:
        throw new Error(`Unknown action: ${body.action}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
