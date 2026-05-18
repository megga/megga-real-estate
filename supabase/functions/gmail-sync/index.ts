// supabase/functions/gmail-sync/index.ts
// Gmail sync — save tokens, list messages (by contact / global), disconnect.
// Pattern aligné sur google-calendar-sync : OAuth refresh + service role admin.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'save_tokens' | 'list_messages' | 'list_by_contact' | 'get_message' | 'disconnect'

interface SyncRequest {
  action: Action
  // save_tokens
  access_token?: string
  refresh_token?: string
  expires_in?: number
  gmail_email?: string
  // list_messages
  query?: string
  max_results?: number
  // list_by_contact / get_message
  email_address?: string
  contact_id?: string
  message_id?: string
}

interface GmailMessageMeta {
  id: string
  threadId: string
  snippet?: string
  internalDate?: string
  labelIds?: string[]
  payload?: {
    headers?: { name: string; value: string }[]
  }
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1'

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  return { access_token: data.access_token, expires_in: data.expires_in }
}

async function getValidToken(userId: string): Promise<string | null> {
  const db = supabaseAdmin()
  const { data: tokenRow } = await db
    .from('gmail_tokens')
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
      .from('gmail_tokens')
      .update({ sync_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return null
  }

  await db
    .from('gmail_tokens')
    .update({
      access_token: refreshed.access_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return refreshed.access_token
}

async function gmailFetch(accessToken: string, path: string): Promise<unknown> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail API error ${res.status}: ${err}`)
  }
  return res.json()
}

function header(msg: GmailMessageMeta, name: string): string {
  return msg.payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value ?? ''
}

function parseFromHeader(value: string): { name: string; address: string } {
  // "Jean Dupont <jean@example.com>" or just "jean@example.com"
  const match = value.match(/^(.*?)\s*<([^>]+)>$/)
  if (match) return { name: match[1].replace(/^"|"$/g, '').trim(), address: match[2].trim() }
  return { name: '', address: value.trim() }
}

function parseAddressList(value: string): string[] {
  if (!value) return []
  return value.split(',').map(p => parseFromHeader(p.trim()).address).filter(Boolean)
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

function normalizeGmailMessage(meta: GmailMessageMeta): NormalizedMessage {
  const fromRaw = header(meta, 'from')
  const from = parseFromHeader(fromRaw)
  const toList = parseAddressList(header(meta, 'to'))
  const ccList = parseAddressList(header(meta, 'cc'))
  const dateMs = meta.internalDate ? Number.parseInt(meta.internalDate) : Date.now()
  const sentAt = new Date(dateMs).toISOString()
  const isUnread = (meta.labelIds ?? []).includes('UNREAD')
  return {
    id: meta.id,
    thread_id: meta.threadId,
    from_address: from.address,
    from_name: from.name,
    to_addresses: toList,
    cc_addresses: ccList,
    subject: header(meta, 'subject'),
    snippet: meta.snippet ?? '',
    sent_at: sentAt,
    is_unread: isUnread,
    has_attachments: false, // déterminé via payload parts, simplifié ici
  }
}

async function fetchMessagesList(accessToken: string, query: string, max: number): Promise<NormalizedMessage[]> {
  const params = new URLSearchParams({ q: query, maxResults: String(max) })
  const listData = await gmailFetch(accessToken, `/users/me/messages?${params}`) as { messages?: { id: string }[] }
  const ids = (listData.messages ?? []).map(m => m.id)
  if (ids.length === 0) return []

  // Fetch metadata in parallel (Gmail API doesn't have batch get without OAuth2 multipart, simpler to parallelize)
  const metas = await Promise.all(
    ids.map(id => gmailFetch(accessToken, `/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc&metadataHeaders=Subject&metadataHeaders=Date`)
      .then(v => v as GmailMessageMeta)
      .catch(() => null))
  )
  return metas.filter((m): m is GmailMessageMeta => !!m).map(normalizeGmailMessage)
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
      // ── Save tokens after OAuth callback ──
      case 'save_tokens': {
        if (!body.access_token || !body.refresh_token) throw new Error('Missing tokens')
        const expiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString()

        await db.from('gmail_tokens').upsert({
          user_id: userId,
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          token_expires_at: expiresAt,
          gmail_email: body.gmail_email ?? null,
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── List messages (free Gmail query) ──
      case 'list_messages': {
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Gmail not connected or token expired')

        const messages = await fetchMessagesList(accessToken, body.query ?? '', body.max_results ?? 20)

        await db.from('gmail_tokens')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('user_id', userId)

        return new Response(JSON.stringify({ messages }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── List messages exchanged with a specific contact ──
      case 'list_by_contact': {
        if (!body.email_address) throw new Error('Missing email_address')
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Gmail not connected or token expired')

        const max = body.max_results ?? 20
        // Gmail query: messages from OR to the contact
        const query = `from:${body.email_address} OR to:${body.email_address}`
        const messages = await fetchMessagesList(accessToken, query, max)

        // Upsert in cache for fast re-display (et future fonctionnalité offline)
        if (messages.length > 0) {
          const rows = messages.map(m => ({
            user_id: userId,
            provider: 'gmail',
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

      // ── Get a single message full body ──
      case 'get_message': {
        if (!body.message_id) throw new Error('Missing message_id')
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Gmail not connected')

        const full = await gmailFetch(accessToken, `/users/me/messages/${body.message_id}?format=full`)

        return new Response(JSON.stringify({ message: full }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Disconnect ──
      case 'disconnect': {
        const { data: tokenRow } = await db
          .from('gmail_tokens')
          .select('access_token')
          .eq('user_id', userId)
          .single()

        if (tokenRow) {
          try {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenRow.access_token}`, {
              method: 'POST',
            })
          } catch {
            // Ignore revoke errors
          }
          // Purge cache + tokens
          await db.from('email_messages_cache').delete().eq('user_id', userId).eq('provider', 'gmail')
          await db.from('gmail_tokens').delete().eq('user_id', userId)
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
