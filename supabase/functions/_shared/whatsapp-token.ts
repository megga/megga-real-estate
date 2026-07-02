// Monitoring d'expiration du token Meta WhatsApp. Le token (env META_WHATSAPP_TOKEN)
// peut expirer → panne silencieuse des envois. On l'interroge via Graph debug_token
// pour savoir s'il est valide et dans combien de jours il expire.
//
// `parseDebugToken` est PUR (horloge injectée) → testable ; `checkMetaToken` fait
// l'appel réseau et ne lève jamais.

export interface MetaTokenHealth {
  isValid: boolean
  expiresAt: number | null // unix secondes ; null = n'expire jamais (token system-user)
  daysLeft: number | null  // null = n'expire jamais
  error: string | null
}

/** Parse la réponse Graph `debug_token`. Pur. `nowMs` injecté pour la testabilité. */
export function parseDebugToken(json: unknown, nowMs: number): MetaTokenHealth {
  const data = (json as { data?: Record<string, unknown> } | null)?.data
  if (!data || typeof data !== 'object') {
    return { isValid: false, expiresAt: null, daysLeft: null, error: 'unparseable' }
  }
  const isValid = data.is_valid === true
  const rawExp = typeof data.expires_at === 'number' ? data.expires_at : 0
  const expiresAt = rawExp > 0 ? rawExp : null // 0 = jamais (token longue durée)
  const daysLeft = expiresAt != null ? Math.floor((expiresAt * 1000 - nowMs) / 86_400_000) : null
  const errObj = data.error as { message?: string } | undefined
  const error = isValid ? null : (errObj?.message ?? 'invalid')
  return { isValid, expiresAt, daysLeft, error }
}

/** Interroge Graph `debug_token` (le token se vérifie lui-même). Ne lève jamais. */
export async function checkMetaToken(token: string, apiVersion: string, nowMs: number): Promise<MetaTokenHealth> {
  if (!token) return { isValid: false, expiresAt: null, daysLeft: null, error: 'no_token' }
  try {
    const url = `https://graph.facebook.com/${apiVersion}/debug_token`
      + `?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(token)}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return { isValid: false, expiresAt: null, daysLeft: null, error: `http_${res.status}` }
    return parseDebugToken(await res.json(), nowMs)
  } catch (e) {
    return { isValid: false, expiresAt: null, daysLeft: null, error: (e as Error)?.name ?? 'fetch_error' }
  }
}

/** Métrique numérique pour platform_metrics : -1 invalide, 9999 n'expire jamais, sinon jours restants. */
export function tokenDaysMetric(h: MetaTokenHealth): number {
  if (!h.isValid) return -1
  return h.daysLeft ?? 9999
}

/** Faut-il alerter ? (token invalide, ou expire sous `warnDays` jours). */
export function tokenNeedsAlert(h: MetaTokenHealth, warnDays = 7): boolean {
  return !h.isValid || (h.daysLeft != null && h.daysLeft <= warnDays)
}
