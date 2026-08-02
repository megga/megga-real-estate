// supabase/functions/_shared/booking-freebusy.ts
// Occupations issues des agendas EXTERNES de l'agent (Google / Outlook).
//
// CE FICHIER EST APPELÉ POUR UN VISITEUR ANONYME. Il ne doit donc jamais faire
// remonter autre chose que des bornes temporelles.
//
// C'est pour ça qu'on interroge `POST /freeBusy` (Google) et
// `POST /me/calendar/getSchedule` (Microsoft Graph) plutôt que les endpoints
// d'événements : ces deux API ne RENVOIENT que des couples début/fin. Aucun
// titre, aucun lieu, aucun participant ne transite — la confidentialité ne
// dépend pas d'un filtrage correct de notre part, elle est garantie en amont par
// l'API. Le CRM connecté applique déjà cette ligne en forçant le libellé à
// « Occupé » (useCalendarExternal) ; côté public on la tient par construction.
//
// FAILLE OUVERTE vs FERMÉE. Si l'agent a connecté un agenda mais qu'il est
// injoignable, on NE PROPOSE RIEN plutôt que de proposer des créneaux calculés
// sur une vision partielle : la promesse faite au client est « les disponibilités
// réelles de l'agent ». Un agent sans agenda connecté, lui, est intégralement
// décrit par la base — pas de dégradation dans ce cas.

import type { BusyRange } from './booking-slots.ts'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'
const MS_SCHEDULE_URL = 'https://graph.microsoft.com/v1.0/me/calendar/getSchedule'

/** Résultat explicite : `degraded` force l'appelant à traiter le cas injoignable. */
export type ExternalBusyResult =
  | { ok: true; busy: BusyRange[]; providers: string[] }
  | { ok: false; degraded: 'provider_unreachable'; provider: string }

/**
 * Lecture de la ligne de jetons d'un agent, injectée par l'appelant.
 *
 * Une FONCTION plutôt que le client Supabase : décrire structurellement
 * `from().select().eq().maybeSingle()` échouait au `deno check` — le builder
 * PostgREST est un thenable, pas une Promise, et faire correspondre ses
 * génériques déclenchait un TS2589 (« type instantiation excessively deep »).
 * Réduire le contrat à ce dont ce module a réellement besoin supprime le
 * problème et le rend testable sans monter de client.
 */
export type TokenRowReader = (
  table: 'google_calendar_tokens' | 'outlook_calendar_tokens',
  userId: string,
) => Promise<Record<string, unknown> | null>

/**
 * Jeton d'accès valide, rafraîchi si nécessaire. null = connexion inutilisable.
 *
 * Le jeton rafraîchi n'est PAS réécrit en base : cet appel vient d'un visiteur
 * anonyme et reste en lecture seule. La session CRM de l'agent
 * (google-calendar-sync) persiste, elle. Coût : un rafraîchissement de plus
 * quand le jeton a expiré — négligeable devant le nombre de clients par agent,
 * et préférable à ouvrir une écriture sur un chemin public.
 */
async function freshAccessToken(
  data: Record<string, unknown>,
  table: 'google_calendar_tokens' | 'outlook_calendar_tokens',
): Promise<string | null> {
  const accessToken = String(data.access_token ?? '')
  const refreshToken = String(data.refresh_token ?? '')
  const expiresAt = new Date(String(data.token_expires_at ?? 0)).getTime()

  // Marge de 5 min, comme google-calendar-sync : un jeton qui expire pendant
  // l'appel produirait un 401 traité comme « injoignable ».
  if (expiresAt - Date.now() > 5 * 60_000 && accessToken) return accessToken
  if (!refreshToken) return null

  const isGoogle = table === 'google_calendar_tokens'
  const body = new URLSearchParams({
    client_id: Deno.env.get(isGoogle ? 'GOOGLE_CLIENT_ID' : 'MICROSOFT_CLIENT_ID') ?? '',
    client_secret: Deno.env.get(isGoogle ? 'GOOGLE_CLIENT_SECRET' : 'MICROSOFT_CLIENT_SECRET') ?? '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  if (!isGoogle) body.set('scope', 'https://graph.microsoft.com/Calendars.Read offline_access')

  const res = await fetch(isGoogle ? GOOGLE_TOKEN_URL : MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return null
  const json = await res.json()
  return typeof json.access_token === 'string' ? json.access_token : null
}

/** Ne conserve que des bornes exploitables — toute autre clé de la réponse est ignorée. */
function toRanges(pairs: Array<{ start?: string; end?: string }>): BusyRange[] {
  const out: BusyRange[] = []
  for (const p of pairs) {
    const start = Date.parse(String(p.start ?? ''))
    const end = Date.parse(String(p.end ?? ''))
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) out.push({ start, end })
  }
  return out
}

async function googleBusy(token: string, fromIso: string, toIso: string): Promise<BusyRange[] | null> {
  const res = await fetch(GOOGLE_FREEBUSY_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ timeMin: fromIso, timeMax: toIso, items: [{ id: 'primary' }] }),
  })
  if (!res.ok) return null
  const json = await res.json()
  const cal = json?.calendars?.primary
  // `errors` non vide = Google n'a pas pu lire cet agenda : c'est un échec, pas
  // une absence d'occupation. Le confondre reviendrait à proposer des créneaux pris.
  if (!cal || (Array.isArray(cal.errors) && cal.errors.length > 0)) return null
  return toRanges(Array.isArray(cal.busy) ? cal.busy : [])
}

/**
 * Graph renvoie des `dateTime` SANS suffixe de fuseau, accompagnés d'un champ
 * `timeZone` séparé (ici UTC, puisque c'est ce que la requête demande). Sans le
 * 'Z' explicite, `Date.parse` les lirait en heure LOCALE du runtime — soit un
 * décalage d'une à deux heures sur toutes les occupations Outlook.
 */
function normalizeGraphDate(v?: string): string | undefined {
  if (!v) return undefined
  return /[Zz]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v}Z`
}

async function outlookBusy(token: string, fromIso: string, toIso: string): Promise<BusyRange[] | null> {
  const res = await fetch(MS_SCHEDULE_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      schedules: ['me'],
      startTime: { dateTime: fromIso, timeZone: 'UTC' },
      endTime: { dateTime: toIso, timeZone: 'UTC' },
      availabilityViewInterval: 15,
    }),
  })
  if (!res.ok) return null
  const json = await res.json()
  const schedule = json?.value?.[0]
  if (!schedule) return null
  const items = Array.isArray(schedule.scheduleItems) ? schedule.scheduleItems : []
  return toRanges(items.map((it: Record<string, { dateTime?: string }>) => ({
    start: normalizeGraphDate(it.start?.dateTime),
    end: normalizeGraphDate(it.end?.dateTime),
  })))
}

/**
 * Occupations externes de l'agent sur la fenêtre demandée.
 *
 * Un agent sans aucun agenda connecté renvoie `{ ok: true, busy: [] }` : ce n'est
 * pas une dégradation, la base le décrit entièrement.
 */
export async function externalBusyRanges(
  readTokens: TokenRowReader,
  userId: string,
  fromIso: string,
  toIso: string,
): Promise<ExternalBusyResult> {
  const busy: BusyRange[] = []
  const providers: string[] = []

  for (const [table, provider] of [
    ['google_calendar_tokens', 'google'],
    ['outlook_calendar_tokens', 'outlook'],
  ] as const) {
    const row = await readTokens(table, userId)
    if (!row || row.sync_enabled === false) continue // agenda non connecté : rien à lire

    const token = await freshAccessToken(row, table)
    if (!token) return { ok: false, degraded: 'provider_unreachable', provider }

    const ranges = provider === 'google'
      ? await googleBusy(token, fromIso, toIso)
      : await outlookBusy(token, fromIso, toIso)
    if (ranges === null) return { ok: false, degraded: 'provider_unreachable', provider }

    busy.push(...ranges)
    providers.push(provider)
  }

  return { ok: true, busy, providers }
}
