// supabase/functions/_shared/client-ip.ts
//
// Résolution de l'IP cliente pour une décision de SÉCURITÉ (limitation de débit),
// par opposition à un journal best-effort.
//
// La distinction n'est pas cosmétique. Le reste du dépôt lit
// `x-forwarded-for.split(',')[0]` (appointment-book, magic-link-get,
// buyer-reception-get, detect-new-device…). C'est acceptable pour tracer, et
// faux dès qu'on compte dessus : la tête de la chaîne est précisément le segment
// que l'appelant écrit lui-même.

/** Plages non routables : un hop interne, jamais l'IP d'un client. */
const PRIVATE_V4 = [
  /^10\./,
  /^127\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
]

function isPrivate(ip: string): boolean {
  const v = ip.toLowerCase()
  if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd')) return true
  if (v.startsWith('fe80:')) return true
  // ::ffff:10.0.0.1 — v4 encapsulée en v6.
  const mapped = v.startsWith('::ffff:') ? v.slice('::ffff:'.length) : v
  return PRIVATE_V4.some((re) => re.test(mapped))
}

/**
 * IP publique attribuable de l'appelant, ou `null` si aucune ne l'est.
 *
 * `x-forwarded-for` se lit « client, proxy1, proxy2 » : chaque hop AJOUTE à
 * droite. Tout ce que l'appelant a fabriqué est donc à GAUCHE, et seul le
 * segment le plus à droite a été écrit par une machine qu'on n'a pas laissée
 * mentir. On parcourt depuis la droite et on retient la première entrée
 * publique — parcourir plutôt que prendre la dernière rend le résultat stable
 * si Supabase intercale un ou plusieurs relais internes devant la fonction.
 *
 * `cf-connecting-ip` et `x-real-ip` ne sont volontairement PAS lus : le client
 * appelle `<ref>.supabase.co/functions/v1/...` en direct via
 * `supabase.functions.invoke`, sans Cloudflare devant. Personne ne pose ces
 * en-têtes ici — sauf l'attaquant, à la valeur qui l'arrange.
 *
 * ⚠ `null` ne veut pas dire « pas d'IP », mais « pas d'IP dont je réponde ».
 * L'appelant décide quoi en faire ; il ne doit pas le traiter comme un
 * laissez-passer.
 */
export function trustedClientIp(req: Request): string | null {
  const xff = req.headers.get('x-forwarded-for')
  if (!xff) return null
  const hops = xff.split(',').map((s) => s.trim()).filter(Boolean)
  for (let i = hops.length - 1; i >= 0; i--) {
    if (!isPrivate(hops[i])) return hops[i]
  }
  return null
}
