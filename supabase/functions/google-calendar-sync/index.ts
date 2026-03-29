// supabase/functions/google-calendar-sync/index.ts
// Google Calendar sync — create/update/delete events, list events, manage tokens

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type Action = 'save_tokens' | 'list_events' | 'create_event' | 'update_event' | 'delete_event' | 'sync_all' | 'disconnect'

interface SyncRequest {
  action: Action
  // save_tokens
  access_token?: string
  refresh_token?: string
  expires_in?: number
  google_email?: string
  // list_events
  time_min?: string
  time_max?: string
  // create_event / update_event / delete_event
  visit_id?: string
}

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? ''
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3'

function supabaseAdmin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// Refresh Google access token using stored refresh token
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

// Get a valid access token for a user (refresh if expired)
async function getValidToken(userId: string): Promise<string | null> {
  const db = supabaseAdmin()
  const { data: tokenRow } = await db
    .from('google_calendar_tokens')
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
      .from('google_calendar_tokens')
      .update({ sync_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return null
  }

  // Save new access token
  await db
    .from('google_calendar_tokens')
    .update({
      access_token: refreshed.access_token,
      token_expires_at: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return refreshed.access_token
}

// Google Calendar API helper
async function gcalFetch(accessToken: string, path: string, options?: RequestInit) {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Google Calendar API error ${res.status}: ${err}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// Build Google Calendar event from a MEGGA visit
function visitToGoogleEvent(visit: Record<string, unknown>) {
  const contact = visit.contact as Record<string, string> | null
  const property = visit.property as Record<string, string> | null
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : ''
  const propertyTitle = property?.title ?? ''
  const scheduledAt = visit.scheduled_at as string
  const isVideoMeet = visit.visit_type === 'video' && visit.video_platform === 'google_meet'

  // Default 1h duration
  const start = new Date(scheduledAt)
  const end = new Date(start.getTime() + 60 * 60 * 1000)

  const event: Record<string, unknown> = {
    summary: `${isVideoMeet ? '📹 ' : ''}Visite — ${propertyTitle}${contactName ? ` (${contactName})` : ''}`,
    location: isVideoMeet ? undefined : (property ? `${property.address ?? ''}, ${property.city ?? ''}`.replace(/^, |, $/g, '') : undefined),
    start: { dateTime: start.toISOString(), timeZone: 'Europe/Zurich' },
    end: { dateTime: end.toISOString(), timeZone: 'Europe/Zurich' },
    description: [
      isVideoMeet ? 'Visite vidéo via Google Meet — planifiée via MEGGA' : 'Visite planifiée via MEGGA Real Estate',
      contactName ? `Contact : ${contactName}` : null,
      propertyTitle ? `Bien : ${propertyTitle}` : null,
      visit.buyer_email ? `Email : ${visit.buyer_email}` : null,
      visit.buyer_phone ? `Tél : ${visit.buyer_phone}` : null,
    ].filter(Boolean).join('\n'),
    extendedProperties: { private: { megga_visit_id: visit.id as string } },
  }

  // Add Google Meet conference data for video visits
  if (isVideoMeet) {
    event.conferenceData = {
      createRequest: {
        requestId: `megga-${visit.id}`,
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    }
  }

  return event
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body: SyncRequest = await req.json()
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    // Get the user from the JWT
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

        await db.from('google_calendar_tokens').upsert({
          user_id: userId,
          access_token: body.access_token,
          refresh_token: body.refresh_token,
          token_expires_at: expiresAt,
          google_email: body.google_email ?? null,
          sync_enabled: true,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── List Google Calendar events ──
      case 'list_events': {
        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Google Calendar not connected or token expired')

        const timeMin = body.time_min ?? new Date().toISOString()
        const timeMax = body.time_max ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        const params = new URLSearchParams({
          timeMin,
          timeMax,
          singleEvents: 'true',
          orderBy: 'startTime',
          maxResults: '100',
        })

        const data = await gcalFetch(accessToken, `/calendars/primary/events?${params}`)
        return new Response(JSON.stringify({ events: data.items ?? [] }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Create event from MEGGA visit ──
      case 'create_event': {
        if (!body.visit_id) throw new Error('Missing visit_id')

        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Google Calendar not connected')

        // Check if already synced
        const { data: existing } = await db
          .from('calendar_sync')
          .select('google_event_id')
          .eq('user_id', userId)
          .eq('visit_id', body.visit_id)
          .single()

        if (existing) {
          return new Response(JSON.stringify({ success: true, event_id: existing.google_event_id, already_synced: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }

        // Fetch visit with relations
        const { data: visit } = await db
          .from('visits')
          .select('*, contact:contacts(first_name, last_name), property:properties(title, address, city)')
          .eq('id', body.visit_id)
          .single()
        // Note: visit_type, video_platform, buyer_email, buyer_phone are included via '*'

        if (!visit) throw new Error('Visit not found')

        const googleEvent = visitToGoogleEvent(visit)
        const isVideoMeet = visit.visit_type === 'video' && visit.video_platform === 'google_meet'

        // conferenceDataVersion=1 tells Google to auto-generate a Meet link
        const endpoint = isVideoMeet
          ? '/calendars/primary/events?conferenceDataVersion=1'
          : '/calendars/primary/events'

        const created = await gcalFetch(accessToken, endpoint, {
          method: 'POST',
          body: JSON.stringify(googleEvent),
        })

        // If Google Meet link was generated, save it to the visit
        if (created.hangoutLink) {
          await db.from('visits')
            .update({ video_link: created.hangoutLink })
            .eq('id', body.visit_id)
        }

        // Save mapping
        await db.from('calendar_sync').insert({
          user_id: userId,
          visit_id: body.visit_id,
          google_event_id: created.id,
          last_synced_at: new Date().toISOString(),
        })

        // Update last_sync_at
        await db.from('google_calendar_tokens')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('user_id', userId)

        return new Response(JSON.stringify({
          success: true,
          event_id: created.id,
          meet_link: created.hangoutLink || null,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Update event when visit changes ──
      case 'update_event': {
        if (!body.visit_id) throw new Error('Missing visit_id')

        const accessToken = await getValidToken(userId)
        if (!accessToken) throw new Error('Google Calendar not connected')

        // Find mapping
        const { data: syncRow } = await db
          .from('calendar_sync')
          .select('google_event_id')
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
          .single()

        if (!visit) throw new Error('Visit not found')

        const googleEvent = visitToGoogleEvent(visit)
        await gcalFetch(accessToken, `/calendars/primary/events/${syncRow.google_event_id}`, {
          method: 'PUT',
          body: JSON.stringify(googleEvent),
        })

        await db.from('calendar_sync')
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
        if (!accessToken) throw new Error('Google Calendar not connected')

        const { data: syncRow } = await db
          .from('calendar_sync')
          .select('google_event_id')
          .eq('user_id', userId)
          .eq('visit_id', body.visit_id)
          .single()

        if (syncRow) {
          try {
            await gcalFetch(accessToken, `/calendars/primary/events/${syncRow.google_event_id}`, {
              method: 'DELETE',
            })
          } catch {
            // Event may already be deleted in Google — ignore
          }
          await db.from('calendar_sync')
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
        if (!accessToken) throw new Error('Google Calendar not connected')

        // Get user's agency
        const { data: profile } = await db
          .from('profiles')
          .select('agency_id')
          .eq('id', userId)
          .single()

        if (!profile) throw new Error('Profile not found')

        // Get all planned/confirmed visits for the next 30 days
        const now = new Date()
        const in30Days = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        const { data: visits } = await db
          .from('visits')
          .select('id, scheduled_at, status, contact:contacts(first_name, last_name), property:properties(title, address, city)')
          .eq('agency_id', profile.agency_id)
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
          .from('calendar_sync')
          .select('visit_id')
          .eq('user_id', userId)

        const syncedIds = new Set((synced ?? []).map(s => s.visit_id))
        const toSync = visits.filter(v => !syncedIds.has(v.id))

        let syncCount = 0
        for (const visit of toSync) {
          try {
            const googleEvent = visitToGoogleEvent(visit)
            const created = await gcalFetch(accessToken, '/calendars/primary/events', {
              method: 'POST',
              body: JSON.stringify(googleEvent),
            })
            await db.from('calendar_sync').insert({
              user_id: userId,
              visit_id: visit.id,
              google_event_id: created.id,
              last_synced_at: new Date().toISOString(),
            })
            syncCount++
          } catch {
            // Skip failed events, continue with rest
          }
        }

        await db.from('google_calendar_tokens')
          .update({ last_sync_at: new Date().toISOString() })
          .eq('user_id', userId)

        return new Response(JSON.stringify({ success: true, synced: syncCount, total: visits.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // ── Disconnect (revoke token + cleanup) ──
      case 'disconnect': {
        const { data: tokenRow } = await db
          .from('google_calendar_tokens')
          .select('access_token')
          .eq('user_id', userId)
          .single()

        if (tokenRow) {
          // Revoke token with Google
          try {
            await fetch(`https://oauth2.googleapis.com/revoke?token=${tokenRow.access_token}`, {
              method: 'POST',
            })
          } catch {
            // Ignore revoke errors
          }

          // Delete tokens and sync mappings
          await db.from('calendar_sync').delete().eq('user_id', userId)
          await db.from('google_calendar_tokens').delete().eq('user_id', userId)
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
