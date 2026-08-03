// supabase/functions/_shared/host-freebusy.ts
//
// Agenda externe d'un hôte MEGGA : lire ses occupations, poser l'événement du
// rendez-vous, le déplacer, le retirer.
//
// POURQUOI EXTRAIRE PLUTÔT QU'APPELER. `google-calendar-sync` et `outlook-calendar-sync`
// savent déjà faire tout cela, mais derrière un HTTP dont la garde lit le JWT de
// L'APPELANT. Or ici l'appelant est l'agence qui réserve, pas l'hôte : elle n'a aucun
// jeton d'agenda, et ne doit surtout pas en avoir. Le rafraîchissement de jeton et les
// deux API sont donc repris ici, appelables en service_role pour le compte de l'hôte.
//
// Ces fonctions ne lèvent pas. Un hôte sans agenda connecté n'est pas une erreur : ses
// seules occupations sont ses rendez-vous déjà pris, et le moteur de créneaux s'en
// contente. Un agenda injoignable non plus, mais il vaut alors mieux proposer trop peu
// que trop : voir `readHostBusy`.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { BusyInterval } from './onboarding-slots.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'
const MS_SCOPE = 'https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read'

/** Marge de sécurité avant expiration, alignée sur les deux fonctions existantes. */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

export type CalendarProvider = 'google' | 'outlook'

export interface HostBusyResult {
  provider: CalendarProvider | null
  busy: BusyInterval[]
  /** Vrai quand un agenda est branché mais n'a pas pu être lu. */
  degraded: boolean
}

export interface HostEventInput {
  summary: string
  description: string
  startMs: number
  durationMinutes: number
  timezone: string
  /** Identifiant stable, pour que Google ne crée pas deux visioconférences. */
  requestId: string
  withMeetLink: boolean
}

export interface HostEventResult {
  provider: CalendarProvider
  eventId: string
  meetingUrl: string | null
}

// ── Jetons ──────────────────────────────────────────────────────────────────

async function googleAccessToken(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data: row } = await db
    .from('google_calendar_tokens')
    .select('access_token, refresh_token, token_expires_at, sync_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (!row || row.sync_enabled === false) return null

  const expiresAt = new Date(row.token_expires_at).getTime()
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return row.access_token
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  }).catch(() => null)

  if (!res || !res.ok) {
    await db.from('google_calendar_tokens')
      .update({ sync_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return null
  }

  const data = await res.json()
  await db.from('google_calendar_tokens')
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return data.access_token ?? null
}

async function outlookAccessToken(db: SupabaseClient, userId: string): Promise<string | null> {
  const { data: row } = await db
    .from('outlook_calendar_tokens')
    .select('access_token, refresh_token, token_expires_at, sync_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (!row || row.sync_enabled === false) return null

  const expiresAt = new Date(row.token_expires_at).getTime()
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > TOKEN_REFRESH_BUFFER_MS) {
    return row.access_token
  }

  const res = await fetch(MICROSOFT_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('MICROSOFT_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET') ?? '',
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
      scope: MS_SCOPE,
    }),
  }).catch(() => null)

  if (!res || !res.ok) {
    await db.from('outlook_calendar_tokens')
      .update({ sync_enabled: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
    return null
  }

  const data = await res.json()
  // Microsoft peut faire tourner le jeton de rafraîchissement à chaque échange.
  await db.from('outlook_calendar_tokens')
    .update({
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? row.refresh_token,
      token_expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)

  return data.access_token ?? null
}

// ── Lecture des occupations ─────────────────────────────────────────────────

type Json = Record<string, unknown>

/** Sous-objet d'une charge utile JSON, ou un objet vide. */
function obj(source: Json, key: string): Json {
  const value = source[key]
  return value && typeof value === 'object' ? (value as Json) : {}
}

/** Champ texte d'une charge utile JSON, ou `undefined`. */
function str(source: Json, key: string): string | undefined {
  const value = source[key]
  return typeof value === 'string' ? value : undefined
}

function interval(startMs: number, endMs: number): BusyInterval | null {
  return Number.isFinite(startMs) && Number.isFinite(endMs) && endMs > startMs
    ? { startMs, endMs }
    : null
}

/**
 * Convertit une entrée d'agenda en intervalle occupé. Rend `null` pour ce qui ne
 * bloque pas : une entrée marquée « disponible », ou une date illisible.
 */
function googleEventToBusy(event: Json, timezone: string): BusyInterval | null {
  if (event.status === 'cancelled') return null
  // `transparent` = l'hôte a explicitement marqué l'entrée comme n'occupant pas.
  if (event.transparency === 'transparent') return null

  const start = obj(event, 'start')
  const end = obj(event, 'end')

  const startDateTime = str(start, 'dateTime')
  const endDateTime = str(end, 'dateTime')
  if (startDateTime && endDateTime) {
    return interval(Date.parse(startDateTime), Date.parse(endDateTime))
  }

  // Journée entière : les bornes sont des dates civiles, à ancrer dans le fuseau
  // de l'hôte. `end.date` est exclusif chez Google.
  const startDate = str(start, 'date')
  const endDate = str(end, 'date')
  if (startDate && endDate) {
    return interval(
      Date.parse(`${startDate}T00:00:00${zoneSuffix(startDate, timezone)}`),
      Date.parse(`${endDate}T00:00:00${zoneSuffix(endDate, timezone)}`),
    )
  }

  return null
}

function outlookEventToBusy(event: Json): BusyInterval | null {
  if (event.isCancelled === true) return null
  if (event.showAs === 'free') return null

  const start = obj(event, 'start')
  const end = obj(event, 'end')
  const startRaw = str(start, 'dateTime')
  const endRaw = str(end, 'dateTime')
  if (!startRaw || !endRaw) return null

  // Graph rend une heure sans suffixe de fuseau, accompagnée de `timeZone`. Quand ce
  // fuseau est UTC (ce que demande la requête ci-dessous), on peut suffixer en Z.
  const suffix = /^utc$/i.test(str(start, 'timeZone') ?? 'UTC') ? 'Z' : ''
  return interval(Date.parse(`${startRaw}${suffix}`), Date.parse(`${endRaw}${suffix}`))
}

/** Décalage `+HH:MM` du fuseau à minuit de la date donnée, pour ancrer une journée entière. */
function zoneSuffix(dayKey: string, timezone: string): string {
  const [y, m, d] = dayKey.split('-').map(Number)
  const naive = Date.UTC(y, (m || 1) - 1, d || 1)
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(naive))
  const pick = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0)
  const asIfUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour') % 24, pick('minute'))
  const offsetMin = Math.round((asIfUtc - naive) / 60000)
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  return `${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
}

/**
 * Occupations de l'hôte sur la fenêtre demandée.
 *
 * `degraded` signale un agenda branché mais illisible. L'appelant DOIT alors refuser
 * de proposer des créneaux plutôt que d'en proposer trop : un double booking coûte
 * plus cher à l'hôte qu'une journée qui paraît complète.
 */
export async function readHostBusy(
  db: SupabaseClient,
  userId: string,
  timezone: string,
  fromMs: number,
  toMs: number,
): Promise<HostBusyResult> {
  const timeMin = new Date(fromMs).toISOString()
  const timeMax = new Date(toMs).toISOString()

  const googleToken = await googleAccessToken(db, userId)
  if (googleToken) {
    const params = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${googleToken}` },
    }).catch(() => null)

    if (!res || !res.ok) return { provider: 'google', busy: [], degraded: true }

    const data = await res.json().catch(() => null)
    if (!data) return { provider: 'google', busy: [], degraded: true }

    const busy = ((data.items ?? []) as Json[])
      .map((e) => googleEventToBusy(e, timezone))
      .filter((b): b is BusyInterval => b !== null)
    return { provider: 'google', busy, degraded: false }
  }

  const outlookToken = await outlookAccessToken(db, userId)
  if (outlookToken) {
    const params = new URLSearchParams({
      startDateTime: timeMin,
      endDateTime: timeMax,
      $top: '250',
      $orderby: 'start/dateTime',
      $select: 'id,start,end,isCancelled,showAs',
    })
    const res = await fetch(`${GRAPH_API}/me/calendarview?${params}`, {
      headers: {
        Authorization: `Bearer ${outlookToken}`,
        // Demande explicite d'UTC : sans cet en-tête, Graph répond dans le fuseau
        // du compte, que l'on ne connaît pas ici.
        Prefer: 'outlook.timezone="UTC"',
      },
    }).catch(() => null)

    if (!res || !res.ok) return { provider: 'outlook', busy: [], degraded: true }

    const data = await res.json().catch(() => null)
    if (!data) return { provider: 'outlook', busy: [], degraded: true }

    const busy = ((data.value ?? []) as Json[])
      .map((e) => outlookEventToBusy(e))
      .filter((b): b is BusyInterval => b !== null)
    return { provider: 'outlook', busy, degraded: false }
  }

  return { provider: null, busy: [], degraded: false }
}

// ── Écriture de l'événement ─────────────────────────────────────────────────

/** Pose l'événement dans l'agenda de l'hôte. Rend `null` s'il n'en a aucun de branché. */
export async function createHostEvent(
  db: SupabaseClient,
  userId: string,
  input: HostEventInput,
): Promise<HostEventResult | null> {
  const startIso = new Date(input.startMs).toISOString()
  const endIso = new Date(input.startMs + input.durationMinutes * 60_000).toISOString()

  const googleToken = await googleAccessToken(db, userId)
  if (googleToken) {
    const body: Record<string, unknown> = {
      summary: input.summary,
      description: input.description,
      start: { dateTime: startIso, timeZone: 'UTC' },
      end: { dateTime: endIso, timeZone: 'UTC' },
      extendedProperties: { private: { megga_onboarding_call: input.requestId } },
    }
    if (input.withMeetLink) {
      body.conferenceData = {
        createRequest: {
          requestId: input.requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      }
    }

    const path = input.withMeetLink
      ? '/calendars/primary/events?conferenceDataVersion=1'
      : '/calendars/primary/events'

    const res = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${googleToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => null)

    if (!res || !res.ok) return null
    const created = await res.json().catch(() => null)
    if (!created?.id) return null

    return { provider: 'google', eventId: created.id, meetingUrl: created.hangoutLink ?? null }
  }

  const outlookToken = await outlookAccessToken(db, userId)
  if (outlookToken) {
    const res = await fetch(`${GRAPH_API}/me/events`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${outlookToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: input.summary,
        body: { contentType: 'Text', content: input.description },
        // `dateTime` sans suffixe + `timeZone: 'UTC'` : c'est la forme attendue par
        // Graph. On envoie donc l'ISO amputé de son Z, et non l'heure locale.
        start: { dateTime: startIso.replace('Z', ''), timeZone: 'UTC' },
        end: { dateTime: endIso.replace('Z', ''), timeZone: 'UTC' },
        isOnlineMeeting: input.withMeetLink,
        ...(input.withMeetLink ? { onlineMeetingProvider: 'teamsForBusiness' } : {}),
      }),
    }).catch(() => null)

    if (!res || !res.ok) return null
    const created = await res.json().catch(() => null)
    if (!created?.id) return null

    return {
      provider: 'outlook',
      eventId: created.id,
      meetingUrl: created.onlineMeeting?.joinUrl ?? null,
    }
  }

  return null
}

/** Déplace un événement existant. Replanifier ne doit pas laisser deux entrées. */
export async function moveHostEvent(
  db: SupabaseClient,
  userId: string,
  provider: CalendarProvider,
  eventId: string,
  startMs: number,
  durationMinutes: number,
): Promise<boolean> {
  const startIso = new Date(startMs).toISOString()
  const endIso = new Date(startMs + durationMinutes * 60_000).toISOString()

  if (provider === 'google') {
    const token = await googleAccessToken(db, userId)
    if (!token) return false
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start: { dateTime: startIso, timeZone: 'UTC' },
        end: { dateTime: endIso, timeZone: 'UTC' },
      }),
    }).catch(() => null)
    return !!res?.ok
  }

  const token = await outlookAccessToken(db, userId)
  if (!token) return false
  const res = await fetch(`${GRAPH_API}/me/events/${eventId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      start: { dateTime: startIso.replace('Z', ''), timeZone: 'UTC' },
      end: { dateTime: endIso.replace('Z', ''), timeZone: 'UTC' },
    }),
  }).catch(() => null)
  return !!res?.ok
}

/** Retire l'événement. Un échec est sans gravité : le rendez-vous est déjà annulé en base. */
export async function deleteHostEvent(
  db: SupabaseClient,
  userId: string,
  provider: CalendarProvider,
  eventId: string,
): Promise<boolean> {
  if (provider === 'google') {
    const token = await googleAccessToken(db, userId)
    if (!token) return false
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events/${eventId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null)
    return !!res?.ok
  }

  const token = await outlookAccessToken(db, userId)
  if (!token) return false
  const res = await fetch(`${GRAPH_API}/me/events/${eventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)
  return !!res?.ok
}
