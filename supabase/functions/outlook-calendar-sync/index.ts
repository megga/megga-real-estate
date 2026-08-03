// supabase/functions/outlook-calendar-sync/index.ts
// Outlook Calendar sync via Microsoft Graph API — create/update/delete events, list events, manage tokens

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Refus d'authentification, en 401.
 *
 * Les deux contrôles d'accès sortaient par `throw`, et le catch de tête répond
 * 400 : une session absente ou expirée se présentait donc comme une requête
 * malformée. Le client ne pouvait pas distinguer « reconnecte-toi » de
 * « ta requête est fausse ».
 */
function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

type Action = 'save_tokens' | 'list_events' | 'create_event' | 'update_event' | 'delete_event' | 'sync_all' | 'disconnect'

interface SyncRequest {
  action: Action
  // save_tokens
  access_token?: string
  refresh_token?: string
  expires_in?: number
  outlook_email?: string
  // list_events
  time_min?: string
  time_max?: string
  // create_event / update_event / delete_event
  visit_id?: string
}

const MICROSOFT_CLIENT_ID = Deno.env.get('MICROSOFT_CLIENT_ID') ?? ''
const MICROSOFT_CLIENT_SECRET = Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GRAPH_API = 'https://graph.microsoft.com/v1.0'

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// Refresh Microsoft access token using stored refresh token
async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; refresh_token: string; expires_in: number } | null> {
  const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID,
      client_secret: MICROSOFT_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read',
    }),
  })
  if (!res.ok) return null
  const data = await res.json()
  // Microsoft may return a new refresh_token on each refresh
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? refreshToken,
    expires_in: data.expires_in,
  }
}

// Get a valid access token for a user (refresh if expired)
async function getValidToken(userId: string): Promise<string | null> {
  const db = supabaseAdmin()
  const { data: tokenRow } = await db
    .from('outlook_calendar_tokens')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!tokenRow) return null

  const now = new Date()
  const expiresAt = new Date(tokenRow.token_expires_at)

  // Token still valid (with 5 min buffer)
  if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
    return tokenRow.access_token
  }

  // Refresh needed
  const refreshed = await refreshAccessToken(tokenRow.refresh_token)
  if (!refreshed) {
    // Refresh failed — mark sync as disabled
    await db
      .from('outlook_calendar_tokens')
      .update({ sync_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return null
  }

  // Save new tokens (Microsoft may rotate refresh_token)
  await db
    .from('outlook_calendar_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return refreshed.access_token
}

// Microsoft Graph API helper
async function graphFetch(accessToken: string, path: string, options?: RequestInit) {
  const res = await fetch(`${GRAPH_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Microsoft Graph API error ${res.status}: ${err}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// Build Microsoft Graph event from a MEGGA visit
function visitToOutlookEvent(visit: Record<string, unknown>) {
  const contact = visit.contact as Record<string, string> | null
  const property = visit.property as Record<string, string> | null
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : ''
  const propertyTitle = property?.title ?? ''
  const scheduledAt = visit.scheduled_at as string

  // Default 1h duration
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  return {
    subject: `Visite — ${propertyTitle}${contactName ? ` (${contactName})` : ''}`,
    body: {
      contentType: 'Text',
      content: [
        'Visite planifiée via MEGGA Real Estate',
        contactName ? `Contact : ${contactName}` : null,
        propertyTitle ? `Bien : ${propertyTitle}` : null,
      ].filter(Boolean).join('\n'),
    },
    start: {
      dateTime: start.toISOString().replace('Z', ''),
      timeZone: 'Europe/Zurich',
    },
    end: {
      dateTime: end.toISOString().replace('Z', ''),
      timeZone: 'Europe/Zurich',
    },
    location: property
      ? { displayName: `${property.address ?? ''}, ${property.city ?? ''}`.replace(/^, |, $/g, '') }
      : undefined,
    singleValueExtendedProperties: [{
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name megga_visit_id',
      value: visit.id as string,
    }],
  }
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SyncRequest = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return unauthorized('Missing authorization header')

    // Get the user from the JWT
    const supabaseUser = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser()
    if (userError || !user) return unauthorized('Unauthorized')

    const userId = user.id
    const db = supabaseAdmin()

    /**
     * Agence de l'appelant, résolue au plus une fois.
     *
     * `db` est un client service-role : la RLS est contournée, donc une requête
     * filtrée sur le seul id venu du corps atteint N'IMPORTE quelle ligne de la
     * plateforme. Toute branche qui charge une visite par `body.visit_id` doit
     * s'y restreindre — `sync_all` le faisait déjà, `create_event` et
     * `update_event` non, ce qui suffisait à pousser les coordonnées de
     * l'acheteur d'une autre agence dans le calendrier de l'appelant.
     * Paresseux à dessein : `save_tokens` et `disconnect` n'ont pas besoin d'un
     * profil et ne doivent pas se mettre à échouer s'il manque.
     */
    let cachedAgencyId: string | null | undefined
    const callerAgencyId = async (): Promise<string> => {
      if (cachedAgencyId === undefined) {
        const { data } = await db.from('profiles').select('agency_id').eq('id', userId).maybeSingle()
        cachedAgencyId = (data?.agency_id as string | null) ?? null
      }
      if (!cachedAgencyId) throw new Error('Profile not found')
      return cachedAgencyId
    }

    switch (body.action) {
      // ── Save tokens after OAuth callback ──
      case 'save_tokens': {
        if (!body.access_token || !body.refresh_token) throw new Error('Missing tokens')
        const expiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString()

        await db.from('outlook_calendar_tokens').upsert({
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

      // ── List Outlook Calendar events ──
      case 'list_events': {
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Calendar not connected or token expired')

        const timeMin = body.time_min ?? new Date().toISOString()
        const timeMax = body.time_max ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const params = new URLSearchParams({
          startDateTime: timeMin,
          endDateTime: timeMax,
          $top: '100',
          $orderby: 'start/dateTime',
          $select: 'id,subject,bodyPreview,start,end,location,isAllDay',
        })

        const data = await graphFetch(accessToken, `/me/calendarview?${params}`)
        return new Response(JSON.stringify({ events: data.value ?? [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Create event from MEGGA visit ──
      case 'create_event': {
        if (!body.visit_id) throw new Error('Missing visit_id')

        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Calendar not connected')

        // Check if already synced
        const { data: existing } = await db
          .from('outlook_calendar_sync')
          .select('outlook_event_id')
          .eq('user_id', userId)
          .eq('visit_id', body.visit_id)
          .single()

        if (existing) {
          return new Response(JSON.stringify({ success: true, event_id: existing.outlook_event_id, already_synced: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Fetch visit with relations
        const { data: visit } = await db
          .from('visits')
          .select('*, contact:contacts(first_name, last_name), property:properties(title, address, city)')
          .eq('id', body.visit_id)
          .eq('agency_id', await callerAgencyId())
          .single()

        if (!visit) throw new Error('Visit not found')

        const outlookEvent = visitToOutlookEvent(visit)
        const created = await graphFetch(accessToken, '/me/events', {
          method: 'POST',
          body: JSON.stringify(outlookEvent),
        })

        // Save mapping
        await db.from('outlook_calendar_sync').insert({
          user_id: userId,
          visit_id: body.visit_id,
          outlook_event_id: created.id,
          last_synced_at: new Date().toISOString(),
        })

        // Update last_sync_at
        await db.from('outlook_calendar_tokens')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('user_id', userId)

        return new Response(JSON.stringify({ success: true, event_id: created.id }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Update event when visit changes ──
      case 'update_event': {
        if (!body.visit_id) throw new Error('Missing visit_id')

        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Calendar not connected')

        // Find mapping
        const { data: syncRow } = await db
          .from('outlook_calendar_sync')
          .select('outlook_event_id')
          .eq('user_id', userId)
          .eq('visit_id', body.visit_id)
          .single()

        if (!syncRow) {
          // Not synced yet — create instead
          return new Response(JSON.stringify({ success: false, not_synced: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Fetch visit
        const { data: visit } = await db
          .from('visits')
          .select('*, contact:contacts(first_name, last_name), property:properties(title, address, city)')
          .eq('id', body.visit_id)
          .eq('agency_id', await callerAgencyId())
          .single()

        if (!visit) throw new Error('Visit not found')

        const outlookEvent = visitToOutlookEvent(visit)
        await graphFetch(accessToken, `/me/events/${syncRow.outlook_event_id}`, {
          method: 'PATCH',
          body: JSON.stringify(outlookEvent),
        })

        await db.from('outlook_calendar_sync')
          .update({ last_synced_at: new Date().toISOString() })
          .eq('user_id', userId)
          .eq('visit_id', body.visit_id)

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Delete event when visit is deleted ──
      case 'delete_event': {
        if (!body.visit_id) throw new Error('Missing visit_id')

        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Calendar not connected')

        const { data: syncRow } = await db
          .from('outlook_calendar_sync')
          .select('outlook_event_id')
          .eq('user_id', userId)
          .eq('visit_id', body.visit_id)
          .single()

        if (syncRow) {
          try {
            await graphFetch(accessToken, `/me/events/${syncRow.outlook_event_id}`, {
              method: 'DELETE',
            })
          } catch {
            // Event may already be deleted in Outlook — ignore
          }
          await db.from('outlook_calendar_sync')
            .delete()
            .eq('user_id', userId)
            .eq('visit_id', body.visit_id)
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Full sync (push all unsynced visits) ──
      case 'sync_all': {
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Outlook Calendar not connected')

        const agencyId = await callerAgencyId()

        // Get all planned/confirmed visits for the next 30 days
        const now = new Date()
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const { data: visits } = await db
          .from('visits')
          .select('id, scheduled_at, status, contact:contacts(first_name, last_name), property:properties(title, address, city)')
          .eq('agency_id', agencyId)
          .in('status', ['planned', 'confirmed'])
          .gte('scheduled_at', now.toISOString())
          .lte('scheduled_at', in30Days.toISOString())

        if (!visits || visits.length === 0) {
          return new Response(JSON.stringify({ success: true, synced: 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Get already synced visit IDs
        const { data: synced } = await db
          .from('outlook_calendar_sync')
          .select('visit_id')
          .eq('user_id', userId)

        const syncedIds = new Set((synced ?? []).map(s => s.visit_id))
        const toSync = visits.filter(v => !syncedIds.has(v.id))

        let syncCount = 0
        for (const visit of toSync) {
          try {
            const outlookEvent = visitToOutlookEvent(visit)
            const created = await graphFetch(accessToken, '/me/events', {
              method: 'POST',
              body: JSON.stringify(outlookEvent),
            })
            await db.from('outlook_calendar_sync').insert({
              user_id: userId,
              visit_id: visit.id,
              outlook_event_id: created.id,
              last_synced_at: new Date().toISOString(),
            })
            syncCount++
          } catch {
            // Skip failed events, continue with rest
          }
        }

        await db.from('outlook_calendar_tokens')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('user_id', userId)

        return new Response(JSON.stringify({ success: true, synced: syncCount, total: visits.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Disconnect (revoke token + cleanup) ──
      case 'disconnect': {
        // Microsoft doesn't have a simple revoke endpoint like Google
        // Just delete tokens and sync mappings
        await db.from('outlook_calendar_sync').delete().eq('user_id', userId)
        await db.from('outlook_calendar_tokens').delete().eq('user_id', userId)

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
