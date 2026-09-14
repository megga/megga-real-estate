// supabase/functions/_shared/client-ip.ts
//
// Résolution de l'IP cliente pour une décision de SÉCURITÉ (limitation de débit),
// par opposition à un journal best-effort.
//
// La distinction n'est pas cosmétique. Le reste du dépôt lit
// `x-forwarded-for.split(',')[0]` (appointment-book, appointment-manage,
// magic-link-get, buyer-reception-get). C'est acceptable pour tracer, et faux dès
// qu'on compte dessus : la tête de la chaîne est précisément le segment que
// l'appelant écrit lui-même.
//
// ⛔ ET DÈS QU'ON L'ÉCRIT QUELQUE PART QUE QUELQU'UN LIRA (audit du 13.09.2026, S14).
// `detect-new-device` prenait cette tête pour la géolocaliser chez ipapi.co puis
// l'imprimer dans l'alerte « nouvelle connexion » : qui volait un mot de passe
// posait `x-forwarded-for: <l'IP habituelle de sa victime>`, et l'alerte montrait à
// la victime sa propre ville. Une alerte de sécurité falsifiable par celui qu'elle
// signale est pire qu'aucune. Elle lit désormais `trustedClientIp`, et n'interpole
// que ce qui passe `isIpAddress`.

/** Octet décimal d'une IPv4 : 0 à 255, SANS zéro de tête — « 010 » se lit en octal ailleurs. */
const OCTET = '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)'
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`)
const HEXTET = /^[0-9a-f]{1,4}$/i

/**
 * Vrai si la chaîne est une adresse IP LITTÉRALE — IPv4 pointée, ou IPv6 (compressée
 * ou non, IPv4 encapsulée comprise) — et rien d'autre : ni port, ni crochets, ni zone
 * (`%eth0`), ni nom d'hôte, ni espace.
 *
 * `trustedClientIp` ne le vérifie PAS, et c'est voulu : il sert de clé de limitation de
 * débit, où une valeur étrange reste une clé. Ce contrôle est celui de l'INTERPOLATION —
 * dans une URL, un e-mail, une colonne qu'un écran affiche. Là, une chaîne qui n'est pas
 * une IP n'a rien à faire, quelle que soit sa provenance.
 */
export function isIpAddress(s: string): boolean {
  // La plus longue forme valide (six groupes + IPv4 encapsulée) fait 45 caractères.
  if (s.length === 0 || s.length > 45) return false
  if (IPV4.test(s)) return true
  if (!s.includes(':')) return false

  const moities = s.split('::')
  if (moities.length > 2) return false
  const groupes = (part: string) => (part === '' ? [] : part.split(':'))
  const tete = groupes(moities[0])
  const queue = moities.length === 2 ? groupes(moities[1]) : []

  // Une IPv4 encapsulée ne peut que TERMINER l'adresse, et vaut deux groupes.
  const fin = moities.length === 2 ? queue : tete
  let largeur = tete.length + queue.length
  if (fin.length > 0 && fin[fin.length - 1].includes('.')) {
    if (!IPV4.test(fin.pop() as string)) return false
    largeur += 1
  }
  if (![...tete, ...queue].every((g) => HEXTET.test(g))) return false
  // `::` remplace au moins un groupe : sept explicites au plus avec lui, huit sans.
  return moities.length === 2 ? largeur <= 7 : largeur === 8
}

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
