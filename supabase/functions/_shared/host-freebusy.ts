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
// TROIS SOURCES D'AGENDA, dans cet ordre de priorité :
//   1. `calendar_email` — une boîte Google Workspace de MEGGA, incarnée par délégation
//      à l'échelle du domaine (`google-workspace.ts`). C'est la voie de la plateforme :
//      aucun jeton personnel, aucun consentement à renouveler, rien qui s'arrête quand
//      quelqu'un quitte l'équipe.
//   2. `profile_id` + Google OAuth — l'agenda personnel qu'un membre a connecté depuis
//      le CRM.
//   3. `profile_id` + Outlook OAuth — idem, côté Microsoft.
// La Workspace passe DEVANT parce qu'elle est la seule que MEGGA contrôle vraiment : un
// hôte qui aurait les deux doit voir ses rendez-vous atterrir dans l'agenda d'équipe.
//
// Ces fonctions ne lèvent pas. Un hôte sans agenda connecté n'est pas une erreur : ses
// seules occupations sont ses rendez-vous déjà pris, et le moteur de créneaux s'en
// contente. Un agenda injoignable non plus, mais il vaut alors mieux proposer trop peu
// que trop : voir `readHostBusy`.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { BusyInterval } from './onboarding-slots.ts'
import { workspaceAccessToken } from './google-workspace.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const GRAPH_API = 'https://graph.microsoft.com/v1.0'
const MS_SCOPE = 'https://graph.microsoft.com/Calendars.ReadWrite offline_access User.Read'

/** Marge de sécurité avant expiration, alignée sur les deux fonctions existantes. */
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * `workspace` est un agenda Google comme un autre — mais PAS le même identifiant, et
 * c'est tout l'intérêt de la distinction : déplacer ou retirer un événement exige la
 * même clé que celle qui l'a créé. Ranger les deux sous `google` obligerait à redeviner
 * la source à chaque geste, et se tromperait le jour où un hôte change de voie.
 */
export type CalendarProvider = 'google' | 'outlook' | 'workspace'

/**
 * De quoi retrouver l'agenda d'un hôte, sans le charger deux fois.
 *
 * Les appelants tiennent déjà la ligne `onboarding_hosts` ; passer le couple plutôt
 * qu'un identifiant évite une requête par hôte et par geste.
 */
export interface HostCalendarRef {
  profileId: string | null
  calendarEmail: string | null
}

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
  /**
   * Invité à porter sur l'événement.
   *
   * ⚠ Ce n'est pas une politesse, c'est ce qui fait que le lien Meet MARCHE. Une
   * visioconférence créée par une boîte Workspace n'admet directement que les invités
   * de l'événement : un participant absent de la liste tombe sur « demander à
   * rejoindre » et attend qu'on lui ouvre. L'e-mail de confirmation, lui, part par
   * Resend — d'où `sendUpdates=none` plus bas, pour que Google ne double pas l'envoi.
   */
  attendeeEmail?: string | null
  attendeeName?: string | null
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

/**
 * Quelle clé pour quel agenda, une fois pour toutes.
 *
 * Rend `null` quand l'hôte n'a aucun agenda branché — ce qui N'EST PAS une panne : ses
 * occupations se réduisent alors à ses rendez-vous déjà pris, que le moteur connaît par
 * la base. `degraded` distingue ce cas de celui, bien plus dangereux, d'un agenda
 * déclaré mais injoignable.
 */
type HostCredential =
  | { provider: 'workspace'; token: string; mailbox: string }
  | { provider: 'google' | 'outlook'; token: string }

async function resolveHostCredential(
  db: SupabaseClient,
  ref: HostCalendarRef,
): Promise<{ credential: HostCredential | null; degraded: boolean }> {
  const mailbox = ref.calendarEmail?.trim()
  if (mailbox) {
    const { token, reason } = await workspaceAccessToken(mailbox)
    if (token) return { credential: { provider: 'workspace', token, mailbox }, degraded: false }
    // Une boîte Workspace est DÉCLARÉE sur l'hôte : ne pas pouvoir s'y authentifier est
    // une panne de configuration, jamais « pas d'agenda ». On le signale, et on ne
    // retombe surtout pas sur l'agenda personnel : le rendez-vous atterrirait ailleurs
    // que là où l'équipe le cherche.
    console.error('[host-freebusy] workspace credential unavailable', { mailbox, reason })
    return { credential: null, degraded: true }
  }

  if (!ref.profileId) return { credential: null, degraded: false }

  const googleToken = await googleAccessToken(db, ref.profileId)
  if (googleToken) return { credential: { provider: 'google', token: googleToken }, degraded: false }

  const outlookToken = await outlookAccessToken(db, ref.profileId)
  if (outlookToken) return { credential: { provider: 'outlook', token: outlookToken }, degraded: false }

  return { credential: null, degraded: false }
}

/**
 * Clé pour un geste sur un événement DÉJÀ POSÉ (déplacer, retirer).
 *
 * On ne rejoue pas la résolution par priorité : c'est la voie qui a CRÉÉ l'événement
 * qu'il faut, et elle est enregistrée sur la ligne. Repasser par `resolveHostCredential`
 * enverrait le geste au mauvais agenda dès qu'un hôte a changé de source — l'ancien
 * événement resterait alors affiché, orphelin, à l'heure abandonnée.
 */
async function credentialForProvider(
  db: SupabaseClient,
  ref: HostCalendarRef,
  provider: CalendarProvider,
): Promise<string | null> {
  if (provider === 'workspace') {
    if (!ref.calendarEmail) return null
    return (await workspaceAccessToken(ref.calendarEmail)).token
  }
  if (!ref.profileId) return null
  return provider === 'google'
    ? await googleAccessToken(db, ref.profileId)
    : await outlookAccessToken(db, ref.profileId)
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
  ref: HostCalendarRef,
  timezone: string,
  fromMs: number,
  toMs: number,
): Promise<HostBusyResult> {
  const timeMin = new Date(fromMs).toISOString()
  const timeMax = new Date(toMs).toISOString()

  const { credential, degraded } = await resolveHostCredential(db, ref)
  if (degraded) return { provider: 'workspace', busy: [], degraded: true }
  if (!credential) return { provider: null, busy: [], degraded: false }

  if (credential.provider === 'workspace') {
    // `freeBusy` plutôt que la liste des événements : il rend directement les blocs
    // occupés, en appliquant lui-même les règles de l'agenda (entrées « disponible »,
    // invitations refusées, journées entières). Et il ne divulgue AUCUN contenu — ni
    // titre, ni participant — là où lister les événements ferait transiter l'agenda
    // entier d'une boîte de MEGGA pour n'en garder que des bornes horaires.
    const res = await fetch(`${GOOGLE_CALENDAR_API}/freeBusy`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timeMin, timeMax,
        timeZone: 'UTC',
        items: [{ id: credential.mailbox }],
      }),
    }).catch(() => null)

    if (!res || !res.ok) return { provider: 'workspace', busy: [], degraded: true }

    const data = await res.json().catch(() => null) as
      | { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }
      | null
    const entry = data?.calendars?.[credential.mailbox]
    // Un agenda en erreur (`notFound`, `accessDenied`) rend un tableau `busy` VIDE, qui
    // se lirait comme « libre toute la journée ». Il faut le traiter comme illisible,
    // sans quoi une mauvaise configuration ouvrirait toutes les heures à la réservation.
    if (!entry || (entry.errors?.length ?? 0) > 0) {
      console.error('[host-freebusy] freeBusy refused', { mailbox: credential.mailbox, errors: entry?.errors })
      return { provider: 'workspace', busy: [], degraded: true }
    }

    const busy = (entry.busy ?? [])
      .map((b) => interval(Date.parse(b.start), Date.parse(b.end)))
      .filter((b): b is BusyInterval => b !== null)
    return { provider: 'workspace', busy, degraded: false }
  }

  if (credential.provider === 'google') {
    const params = new URLSearchParams({
      timeMin, timeMax,
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    })
    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`, {
      headers: { Authorization: `Bearer ${credential.token}` },
    }).catch(() => null)

    if (!res || !res.ok) return { provider: 'google', busy: [], degraded: true }

    const data = await res.json().catch(() => null)
    if (!data) return { provider: 'google', busy: [], degraded: true }

    const busy = ((data.items ?? []) as Json[])
      .map((e) => googleEventToBusy(e, timezone))
      .filter((b): b is BusyInterval => b !== null)
    return { provider: 'google', busy, degraded: false }
  }

  {
    const outlookToken = credential.token
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

/**
 * Bloc `attendees` de l'API Google, ou rien.
 *
 * `responseStatus: 'accepted'` est délibéré : la personne vient de choisir ce créneau
 * elle-même, lui envoyer une invitation « à accepter » lui redemanderait de confirmer ce
 * qu'elle vient de confirmer. C'est aussi ce qui la fait entrer dans la visioconférence
 * sans passer par la salle d'attente.
 */
function googleAttendees(input: HostEventInput): Record<string, unknown>[] | undefined {
  const email = input.attendeeEmail?.trim()
  if (!email) return undefined
  return [{
    email,
    displayName: input.attendeeName?.trim() || undefined,
    responseStatus: 'accepted',
  }]
}

/** Pose l'événement dans l'agenda de l'hôte. Rend `null` s'il n'en a aucun de branché. */
export async function createHostEvent(
  db: SupabaseClient,
  ref: HostCalendarRef,
  input: HostEventInput,
): Promise<HostEventResult | null> {
  const startIso = new Date(input.startMs).toISOString()
  const endIso = new Date(input.startMs + input.durationMinutes * 60_000).toISOString()

  const { credential } = await resolveHostCredential(db, ref)
  if (!credential) return null

  if (credential.provider === 'workspace' || credential.provider === 'google') {
    const body: Record<string, unknown> = {
      summary: input.summary,
      description: input.description,
      start: { dateTime: startIso, timeZone: 'UTC' },
      end: { dateTime: endIso, timeZone: 'UTC' },
      attendees: googleAttendees(input),
      // Marque de fabrique : elle permet de retrouver l'événement d'un rendez-vous
      // depuis l'agenda, et de le distinguer de ce qu'un humain y a posé à la main.
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

    // `sendUpdates=none` : la confirmation part par Resend, avec son `.ics`. Laisser
    // Google écrire aussi enverrait deux invitations pour un seul rendez-vous, dont une
    // qui ne ressemble pas à MEGGA.
    const params = new URLSearchParams({ sendUpdates: 'none' })
    if (input.withMeetLink) params.set('conferenceDataVersion', '1')

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    ).catch(() => null)

    if (!res || !res.ok) {
      console.error('[host-freebusy] event creation refused', {
        provider: credential.provider,
        status: res?.status ?? null,
        detail: res ? await res.text().catch(() => null) : null,
      })
      return null
    }
    const created = await res.json().catch(() => null)
    if (!created?.id) return null

    // `hangoutLink` n'est pas toujours peuplé dans la réponse de création ; la
    // visioconférence vit sous `conferenceData.entryPoints`. Sans ce second regard, un
    // rendez-vous parfaitement créé repartait sans lien, et l'e-mail promettait un
    // « lien à venir » qui n'arrivait jamais.
    const meetingUrl: string | null = created.hangoutLink
      ?? (created.conferenceData?.entryPoints ?? [])
        .find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === 'video')?.uri
      ?? null

    return { provider: credential.provider, eventId: created.id, meetingUrl }
  }

  const res = await fetch(`${GRAPH_API}/me/events`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: input.summary,
      body: { contentType: 'Text', content: input.description },
      // `dateTime` sans suffixe + `timeZone: 'UTC'` : c'est la forme attendue par
      // Graph. On envoie donc l'ISO amputé de son Z, et non l'heure locale.
      start: { dateTime: startIso.replace('Z', ''), timeZone: 'UTC' },
      end: { dateTime: endIso.replace('Z', ''), timeZone: 'UTC' },
      isOnlineMeeting: input.withMeetLink,
      ...(input.withMeetLink ? { onlineMeetingProvider: 'teamsForBusiness' } : {}),
      ...(input.attendeeEmail
        ? {
            attendees: [{
              emailAddress: { address: input.attendeeEmail, name: input.attendeeName ?? undefined },
              type: 'required',
            }],
          }
        : {}),
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

/** Déplace un événement existant. Replanifier ne doit pas laisser deux entrées. */
export async function moveHostEvent(
  db: SupabaseClient,
  ref: HostCalendarRef,
  provider: CalendarProvider,
  eventId: string,
  startMs: number,
  durationMinutes: number,
): Promise<boolean> {
  const startIso = new Date(startMs).toISOString()
  const endIso = new Date(startMs + durationMinutes * 60_000).toISOString()

  const token = await credentialForProvider(db, ref, provider)
  if (!token) return false

  if (provider === 'workspace' || provider === 'google') {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start: { dateTime: startIso, timeZone: 'UTC' },
          end: { dateTime: endIso, timeZone: 'UTC' },
        }),
      },
    ).catch(() => null)
    return !!res?.ok
  }

  const res = await fetch(`${GRAPH_API}/me/events/${encodeURIComponent(eventId)}`, {
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
  ref: HostCalendarRef,
  provider: CalendarProvider,
  eventId: string,
): Promise<boolean> {
  const token = await credentialForProvider(db, ref, provider)
  if (!token) return false

  if (provider === 'workspace' || provider === 'google') {
    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=none`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    ).catch(() => null)
    return !!res?.ok
  }

  const res = await fetch(`${GRAPH_API}/me/events/${encodeURIComponent(eventId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)
  return !!res?.ok
}
