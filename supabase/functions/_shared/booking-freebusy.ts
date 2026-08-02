// supabase/functions/_shared/booking-freebusy.ts
// Occupations issues des agendas EXTERNES de l'agent (Google / Outlook).
//
// CE MODULE EST APPELÉ POUR UN VISITEUR ANONYME. Il ne doit donc jamais faire
// remonter autre chose que des bornes temporelles.
//
// C'est pour ça qu'on interroge `POST /freeBusy` (Google) et
// `POST /me/calendar/getSchedule` (Microsoft Graph) plutôt que les endpoints
// d'événements : ces deux API ne RENVOIENT que des couples début/fin. Aucun
// titre, aucun lieu, aucun participant ne transite — la confidentialité ne
// dépend pas d'un filtrage correct de notre part, elle est garantie en amont
// par l'API. Le CRM connecté applique déjà cette ligne en forçant le libellé à
// « Occupé » (useCalendarExternal) ; côté public on la tient par construction.
//
// FAILLE OUVERTE vs FERMÉE. Si l'agent a connecté un agenda mais qu'il est
// injoignable, on NE PROPOSE RIEN plutôt que des créneaux calculés sur une
// vision partielle : la promesse faite au client est « les disponibilités
// réelles de l'agent ». Un agent sans agenda connecté, lui, est intégralement
// décrit par la base — pas de dégradation dans ce cas.

import type { BusyRange } from './booking-slots.ts'
import { accessTokenFor, TOKEN_TABLE, type TokenRowReader } from './booking-oauth.ts'

const GOOGLE_FREEBUSY_URL = 'https://www.googleapis.com/calendar/v3/freeBusy'
const MS_SCHEDULE_URL = 'https://graph.microsoft.com/v1.0/me/calendar/getSchedule'

/** Résultat explicite : `degraded` force l'appelant à traiter le cas injoignable. */
export type ExternalBusyResult =
  | { ok: true; busy: BusyRange[]; providers: string[] }
  | { ok: false; degraded: 'provider_unreachable'; provider: string }

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
  // une absence d'occupation. Les confondre reviendrait à proposer des créneaux pris.
  if (!cal || (Array.isArray(cal.errors) && cal.errors.length > 0)) return null
  return toRanges(Array.isArray(cal.busy) ? cal.busy : [])
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

  for (const provider of ['google', 'outlook'] as const) {
    const table = TOKEN_TABLE[provider]
    const row = await readTokens(table, userId)
    if (!row || row.sync_enabled === false) continue // agenda non connecté : rien à lire

    const token = await accessTokenFor(row, table)
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
