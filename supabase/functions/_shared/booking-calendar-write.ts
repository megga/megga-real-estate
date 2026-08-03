// supabase/functions/_shared/booking-calendar-write.ts
// Pose / met à jour / retire le rendez-vous dans l'agenda externe de l'agent.
//
// Symétrique de booking-freebusy : la lecture évite le double-booking côté
// MEGGA, l'écriture l'évite côté agent — sans elle, l'agent verrait un créneau
// libre dans Google alors qu'un client vient de le prendre.
//
// ⚠ TOUJOURS EN MEILLEUR EFFORT, JAMAIS BLOQUANT. La source de vérité du
// rendez-vous est `public.appointments`. Si Google ou Graph est indisponible, la
// réservation reste valide et le client garde son créneau ; on perd seulement
// l'écho dans l'agenda externe. Faire échouer la réservation pour un incident
// chez un tiers punirait le client d'un problème qui n'est pas le sien.
//
// À la différence de `visits`, aucune table de correspondance n'est nécessaire :
// `appointments.external_provider` / `external_event_id` portent le lien.

import { accessTokenFor, TOKEN_TABLE, type CalendarProvider, type TokenRowReader } from './booking-oauth.ts'

const GOOGLE_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'
const MS_EVENTS_URL = 'https://graph.microsoft.com/v1.0/me/events'

export interface BookingEventInput {
  appointmentId: string
  summary: string
  description: string
  location?: string | null
  startIso: string
  endIso: string
  timeZone: string
}

export interface WrittenEvent {
  provider: CalendarProvider
  eventId: string
}

/** Premier agenda connecté et utilisable, ou null si l'agent n'en a aucun. */
async function firstConnected(
  readTokens: TokenRowReader,
  userId: string,
): Promise<{ provider: CalendarProvider; token: string } | null> {
  for (const provider of ['google', 'outlook'] as const) {
    const table = TOKEN_TABLE[provider]
    const row = await readTokens(table, userId)
    if (!row || row.sync_enabled === false) continue
    const token = await accessTokenFor(row, table)
    if (token) return { provider, token }
  }
  return null
}

function googleBody(e: BookingEventInput): Record<string, unknown> {
  return {
    summary: e.summary,
    location: e.location ?? undefined,
    description: e.description,
    start: { dateTime: e.startIso, timeZone: e.timeZone },
    end: { dateTime: e.endIso, timeZone: e.timeZone },
    // Permet de retrouver l'événement depuis MEGGA même si external_event_id
    // se perdait, et de le reconnaître dans l'agenda de l'agent.
    extendedProperties: { private: { megga_appointment_id: e.appointmentId } },
  }
}

/**
 * Graph attend un `dateTime` SANS suffixe de fuseau, le fuseau étant porté par
 * le champ voisin. Envoyer un ISO terminé par 'Z' avec timeZone séparé fait
 * décaler l'événement.
 */
function graphBody(e: BookingEventInput): Record<string, unknown> {
  const strip = (iso: string) => iso.replace(/Z$/, '')
  return {
    subject: e.summary,
    body: { contentType: 'Text', content: e.description },
    location: e.location ? { displayName: e.location } : undefined,
    start: { dateTime: strip(e.startIso), timeZone: 'UTC' },
    end: { dateTime: strip(e.endIso), timeZone: 'UTC' },
    singleValueExtendedProperties: [{
      id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name megga_appointment_id',
      value: e.appointmentId,
    }],
  }
}

/** Pose l'événement. `null` si aucun agenda connecté ou si le tiers a échoué. */
export async function createBookingEvent(
  readTokens: TokenRowReader,
  userId: string,
  event: BookingEventInput,
): Promise<WrittenEvent | null> {
  const conn = await firstConnected(readTokens, userId)
  if (!conn) return null

  try {
    const isGoogle = conn.provider === 'google'
    const res = await fetch(isGoogle ? GOOGLE_EVENTS_URL : MS_EVENTS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${conn.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isGoogle ? googleBody(event) : graphBody(event)),
    })
    if (!res.ok) return null
    const json = await res.json()
    return typeof json?.id === 'string' ? { provider: conn.provider, eventId: json.id } : null
  } catch {
    return null // meilleur effort : jamais propagé à l'appelant
  }
}

/** Déplace l'événement existant. `false` si l'écho n'a pas pu être mis à jour. */
export async function updateBookingEvent(
  readTokens: TokenRowReader,
  userId: string,
  provider: CalendarProvider,
  eventId: string,
  event: BookingEventInput,
): Promise<boolean> {
  const table = TOKEN_TABLE[provider]
  const row = await readTokens(table, userId)
  if (!row) return false
  const token = await accessTokenFor(row, table)
  if (!token) return false

  try {
    const isGoogle = provider === 'google'
    const url = isGoogle ? `${GOOGLE_EVENTS_URL}/${eventId}` : `${MS_EVENTS_URL}/${eventId}`
    const res = await fetch(url, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(isGoogle ? googleBody(event) : graphBody(event)),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Retire l'événement après annulation.
 *
 * Un 404 vaut succès : l'événement a pu être supprimé à la main dans l'agenda de
 * l'agent, et l'état voulu — il n'y est plus — est atteint.
 */
export async function deleteBookingEvent(
  readTokens: TokenRowReader,
  userId: string,
  provider: CalendarProvider,
  eventId: string,
): Promise<boolean> {
  const table = TOKEN_TABLE[provider]
  const row = await readTokens(table, userId)
  if (!row) return false
  const token = await accessTokenFor(row, table)
  if (!token) return false

  try {
    const isGoogle = provider === 'google'
    const url = isGoogle ? `${GOOGLE_EVENTS_URL}/${eventId}` : `${MS_EVENTS_URL}/${eventId}`
    const res = await fetch(url, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    return res.ok || res.status === 404
  } catch {
    return false
  }
}
