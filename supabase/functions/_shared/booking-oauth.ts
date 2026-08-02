// supabase/functions/_shared/booking-oauth.ts
// Jetons OAuth des agendas externes de l'agent.
//
// Partagé par la LECTURE (booking-freebusy, free/busy) et l'ÉCRITURE
// (booking-calendar-write, pose de l'événement). Les deux chemins doivent
// rafraîchir de la même façon : un jeton considéré valide d'un côté et périmé
// de l'autre produirait une réservation acceptée mais jamais posée dans
// l'agenda de l'agent.

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const MS_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token'

export type CalendarProvider = 'google' | 'outlook'
export type TokenTable = 'google_calendar_tokens' | 'outlook_calendar_tokens'

export const TOKEN_TABLE: Record<CalendarProvider, TokenTable> = {
  google: 'google_calendar_tokens',
  outlook: 'outlook_calendar_tokens',
}

/**
 * Lecture de la ligne de jetons d'un agent, injectée par l'appelant.
 *
 * Une FONCTION plutôt que le client Supabase : décrire structurellement
 * `from().select().eq().maybeSingle()` échoue au `deno check` — le builder
 * PostgREST est un thenable, pas une Promise, et faire correspondre ses
 * génériques déclenche un TS2589 (« type instantiation excessively deep »).
 * Réduire le contrat à ce dont ces modules ont besoin supprime le problème et
 * les rend testables sans monter de client.
 */
export type TokenRowReader = (
  table: TokenTable,
  userId: string,
) => Promise<Record<string, unknown> | null>

/**
 * Jeton d'accès utilisable, rafraîchi si nécessaire. `null` = connexion
 * inutilisable (jeton révoqué, refresh refusé, sync désactivée).
 *
 * Le jeton rafraîchi n'est PAS réécrit en base : ces appels partent d'un
 * visiteur anonyme et restent en lecture seule côté MEGGA. La session CRM de
 * l'agent (google-calendar-sync) persiste, elle. Coût : un rafraîchissement de
 * plus quand le jeton a expiré — négligeable devant le nombre de clients par
 * agent, et préférable à ouvrir une écriture sur un chemin public.
 */
export async function accessTokenFor(
  row: Record<string, unknown>,
  table: TokenTable,
): Promise<string | null> {
  if (row.sync_enabled === false) return null

  const accessToken = String(row.access_token ?? '')
  const refreshToken = String(row.refresh_token ?? '')
  const expiresAt = new Date(String(row.token_expires_at ?? 0)).getTime()

  // Marge de 5 min, comme google-calendar-sync : un jeton qui expire pendant
  // l'appel produirait un 401 que l'appelant lirait comme « injoignable ».
  if (accessToken && expiresAt - Date.now() > 5 * 60_000) return accessToken
  if (!refreshToken) return null

  const isGoogle = table === 'google_calendar_tokens'
  const body = new URLSearchParams({
    client_id: Deno.env.get(isGoogle ? 'GOOGLE_CLIENT_ID' : 'MICROSOFT_CLIENT_ID') ?? '',
    client_secret: Deno.env.get(isGoogle ? 'GOOGLE_CLIENT_SECRET' : 'MICROSOFT_CLIENT_SECRET') ?? '',
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
  if (!isGoogle) body.set('scope', 'https://graph.microsoft.com/Calendars.ReadWrite offline_access')

  const res = await fetch(isGoogle ? GOOGLE_TOKEN_URL : MS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return null
  const json = await res.json()
  return typeof json.access_token === 'string' ? json.access_token : null
}
