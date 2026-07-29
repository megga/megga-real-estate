// supabase/functions/_shared/bearer-token.ts
// Lecture du jeton porté par l'en-tête `Authorization` des Edge Functions.
//
// ⚠ Rien ici ne vérifie une signature. Ce module ne sert qu'à REFUSER PLUS TÔT
// ce qui serait refusé de toute façon : tout jeton non rejeté d'emblée continue
// de passer par la vérification réelle (`auth.getUser()`). Une garde qui
// l'utilise ne devient donc jamais plus permissive.

/** Payload d'un JWT, signature NON vérifiée ; `null` si illisible. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64.padEnd(b64.length + ((4 - (b64.length % 4)) % 4), '=')
    const parsed: unknown = JSON.parse(atob(padded))
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * Vrai si le jeton ne peut PAS désigner un utilisateur, c'est-à-dire s'il est
 * lisible mais dépourvu de revendication `sub`.
 *
 * C'est exactement le cas des deux clés d'API du projet (`anon` et
 * `service_role`) : ce sont des JWT valides dont le payload ne porte que
 * `iss / ref / role / iat / exp`. Les passer à `auth.getUser()` fait répondre à
 * GoTrue `403: invalid claim: missing sub claim` — un refus CERTAIN, qui coûte
 * pourtant un aller-retour réseau et écrit une ligne d'erreur dans les journaux
 * d'auth à chaque fois.
 *
 * Le client navigateur envoie l'anon key en `Authorization` dès qu'il invoque
 * une fonction sans session ouverte : ces refus certains représentaient donc
 * l'écrasante majorité des erreurs d'auth journalisées du projet — au point de
 * masquer les vraies, ce qui a coûté du temps pendant le diagnostic du gel de
 * `/auth/callback` (29 juil. 2026).
 *
 * Un jeton illisible renvoie `false` : on laisse GoTrue trancher plutôt que de
 * deviner à sa place.
 */
export function isNonUserToken(token: string): boolean {
  const payload = decodeJwtPayload(token)
  if (!payload) return false
  const sub = payload.sub
  return typeof sub !== 'string' || sub.length === 0
}
