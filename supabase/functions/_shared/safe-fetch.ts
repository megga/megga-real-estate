// supabase/functions/_shared/safe-fetch.ts
// Fetch d'une URL fournie par un appelant, durci contre le SSRF.
//
// Refuse : schéma non-https, hôtes résolvant vers une IP privée/loopback/
// link-local (169.254.x, 127.x, 10.x, 172.16-31.x, 192.168.x, ::1, fc00::/7,
// fe80::/10), réponses trop volumineuses, timeouts. Les redirections sont
// refusées par défaut, ou suivies SAUT PAR SAUT quand l'appelant l'autorise —
// chaque `Location` repasse alors par la même validation que l'URL de départ.
//
// Lève une `Error` préfixée `ssrf:` ou `fetch:` que l'appelant doit traduire en 400.
//
// ⛔ POURQUOI LE SUIVI DES REDIRECTIONS VIT ICI (audit du 13.09.2026, point S6).
// `c2pa-sign`, `virtual-staging` et `photo-vision` validaient l'URL par
// `assertPublicUrl`, puis appelaient `fetch(url)` — dont le défaut est
// `redirect: 'follow'`. Une URL publique qui répond `302 Location: http://169.254.169.254/…`
// passait le contrôle, et le fetch suivait vers l'adresse interne ; dans le staging
// virtuel, les octets récupérés étaient ensuite publiés dans le bucket PUBLIC
// `property-photos` — la réponse d'une cible interne devenait lisible par l'appelant.
// Refuser toute redirection aurait cassé les photos encore enregistrées sous l'ANCIEN hôte
// d'images, qui répond 301 vers `img.getmegga.com` depuis la migration de domaine.
// D'où un suivi manuel, borné, re-validé à chaque saut.
//
// ⚠ RISQUE RÉSIDUEL, ASSUMÉ : entre la résolution DNS de `assertPublicUrl` et celle du
// `fetch`, un DNS hostile peut changer de réponse (rebinding). Deno n'offre pas d'épingler
// l'IP résolue sans casser le SNI TLS ; l'exigence https et le TTL court du rebinding
// rendent l'exploitation étroite, pas nulle.

const BLOCKED_IP: RegExp[] = [
  /^127\./,                       // loopback
  /^10\./,                        // private A
  /^0\./,                         // "this" network
  /^169\.254\./,                  // link-local (métadonnées cloud !)
  /^172\.(1[6-9]|2\d|3[01])\./,   // private B
  /^192\.168\./,                  // private C
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT 100.64/10 (métadonnées de certains clouds)
  /^::1$/,                        // IPv6 loopback
  /^::$/,                         // IPv6 non spécifiée
  /^fe80:/i,                      // IPv6 link-local
  /^f[cd][0-9a-f][0-9a-f]:/i,     // IPv6 unique-local (fc00::/7)
]

/**
 * Une IPv6 qui ENCAPSULE une IPv4 (`::ffff:169.254.169.254`, `::ffff:a9fe:a9fe`) se juge
 * sur son IPv4 : sans ce dépliage, un AAAA hostile contournait toute la liste ci-dessus.
 */
function unwrapMappedV4(ip: string): string {
  const m = /^::ffff:(.+)$/i.exec(ip)
  if (!m) return ip
  const tail = m[1]
  if (tail.includes('.')) return tail
  const hex = /^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(tail)
  if (!hex) return ip
  const hi = parseInt(hex[1], 16), lo = parseInt(hex[2], 16)
  return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`
}

/** Vrai si l'adresse est interne (privée, loopback, link-local, CGNAT, ou IPv4 interne encapsulée). */
export function isBlockedIp(ip: string): boolean {
  const v = unwrapMappedV4(ip.trim())
  return BLOCKED_IP.some((r) => r.test(v))
}

async function resolveAll(hostname: string, signal?: AbortSignal): Promise<string[]> {
  // ⚠ NOM COMPLET, point final compris. Sans lui, un nom qui n'a pas d'enregistrement du
  // type demandé — l'AAAA d'un site sans IPv6, le cas courant — repart vers le domaine de
  // recherche du résolveur (`….home`, `….compute.internal`) : mesuré le 14.09.2026, 5 s
  // perdues par requête sur un résolveur lent, assez pour faire tomber les délais des
  // appelants. Un nom interne COURT, lui, cesse de résoudre par ce détour : c'est
  // précisément ce que ce module refuse.
  //
  // ⛔ ET SOUS L'ÉCHÉANCE DE L'APPELANT (`signal`) : le délai de `safeFetchResponse` n'annulait
  // que le `fetch`, et un nom dont les serveurs faisant autorité se taisent tenait la requête
  // quinze secondes — le délai du résolveur — au lieu de quatre (revue du 15.09.2026).
  const fqdn = hostname.endsWith('.') ? hostname : `${hostname}.`
  const opts = signal ? { signal } : undefined
  const [a, aaaa] = await Promise.all([
    Deno.resolveDns(fqdn, 'A', opts).catch(() => [] as string[]),
    Deno.resolveDns(fqdn, 'AAAA', opts).catch(() => [] as string[]),
  ])
  if (signal?.aborted) throw new Error('fetch: timeout')
  return [...a, ...aaaa]
}

// Valide qu'une URL fournie par un appelant est publique et https, SANS la fetch.
// Utile quand l'appelant a besoin de la Response brute (blob/formData) tout en
// gardant le garde-fou SSRF. Lève une Error `ssrf:` sinon.
export async function assertPublicUrl(rawUrl: string, signal?: AbortSignal): Promise<URL> {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    throw new Error('ssrf: invalid_url')
  }
  if (u.protocol !== 'https:') throw new Error('ssrf: https_only')
  const ips = await resolveAll(u.hostname, signal)
  if (ips.length === 0) throw new Error('ssrf: dns_unresolved')
  if (ips.some(isBlockedIp)) throw new Error('ssrf: blocked_ip')
  return u
}

/**
 * Valide qu'un NOM D'HÔTE fourni par un appelant ne résout que vers des adresses
 * PUBLIQUES — pour une connexion TCP qui n'a pas d'URL : le serveur IMAP ou SMTP que
 * l'agent saisit en ajoutant sa boîte. Sans elle, l'assistant ouvrait une socket vers
 * l'hôte de son choix : `169.254.169.254:993`, un service interne, un balayage de ports.
 * Lève une `Error` préfixée `ssrf:` ; même risque résiduel de rebinding que plus haut.
 *
 * ⚠ Une adresse IP LITTÉRALE est refusée : un serveur de courrier a un nom, et c'est ce
 * nom que le certificat TLS atteste.
 */
export async function assertPublicHost(hostname: string): Promise<void> {
  await resolvePublicHost(hostname)
}

/**
 * Comme `assertPublicHost`, et rend l'adresse vérifiée (IPv4 d'abord) à laquelle se
 * connecter : la socket s'ouvre sur ELLE, le nom ne servant plus qu'au certificat. C'est ce
 * qui ferme, pour une connexion TCP, le rebinding que `fetch` laisse ouvert (cf. l'en-tête).
 */
export async function resolvePublicHost(hostname: string): Promise<string> {
  const h = hostname.trim().toLowerCase().replace(/\.$/, '')
  if (!/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(h)) throw new Error('ssrf: invalid_host')
  const ips = await resolveAll(h)
  if (ips.length === 0) throw new Error('ssrf: dns_unresolved')
  if (ips.some(isBlockedIp)) throw new Error('ssrf: blocked_ip')
  return ips.find((ip) => !ip.includes(':')) ?? ips[0]
}

export interface SafeFetchOptions {
  /** Taille maximale du corps, vérifiée PENDANT la lecture (défaut 8 Mo). */
  maxBytes?: number
  /** Délai total, redirections comprises (défaut 8 s). */
  timeoutMs?: number
  /** Redirections suivies, chacune re-validée (défaut 0 : toute redirection est refusée). */
  maxRedirects?: number
}

export interface SafeFetchResult {
  /** Adossé à un ArrayBuffer ordinaire : utilisable tel quel par `Blob` et `crypto.subtle`. */
  bytes: Uint8Array<ArrayBuffer>
  /** `content-type` de la réponse finale, ou null s'il est absent. */
  contentType: string | null
  /** L'URL qui a réellement servi les octets (après redirections). */
  finalUrl: string
}

/** Lit le corps en s'arrêtant dès que `maxBytes` est dépassé — un corps sans longueur annoncée ne peut pas remplir la mémoire. */
async function readCapped(res: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  if (!res.body) return new Uint8Array(0)
  const reader = res.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel().catch(() => {})
      throw new Error('ssrf: too_large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength }
  return out
}

/**
 * Le cœur : valide l'URL, fetch sans suivre, re-valide chaque `Location` jusqu'à
 * `maxRedirects` sauts, puis lit le corps sous plafond.
 */
export async function safeFetchResponse(
  rawUrl: string,
  { maxBytes = 8_000_000, timeoutMs = 8_000, maxRedirects = 0 }: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    let current = await assertPublicUrl(rawUrl, ctrl.signal)
    for (let hop = 0; ; hop++) {
      const res = await fetch(current, { redirect: 'manual', signal: ctrl.signal })

      if (res.status >= 300 && res.status < 400) {
        await res.body?.cancel().catch(() => {})
        if (maxRedirects === 0) throw new Error('ssrf: redirect_blocked')
        if (hop >= maxRedirects) throw new Error('ssrf: too_many_redirects')
        const location = res.headers.get('location')
        if (!location) throw new Error('ssrf: redirect_without_location')
        // Relative ou absolue : résolue contre l'URL courante, puis RE-VALIDÉE comme
        // l'URL de départ — schéma https et IP publique, à chaque saut.
        let next: string
        try {
          next = new URL(location, current).toString()
        } catch {
          throw new Error('ssrf: invalid_url')
        }
        current = await assertPublicUrl(next, ctrl.signal)
        continue
      }

      if (!res.ok) {
        await res.body?.cancel().catch(() => {})
        throw new Error(`fetch: ${res.status}`)
      }

      const declared = Number(res.headers.get('content-length') ?? '0')
      if (declared > maxBytes) {
        await res.body?.cancel().catch(() => {})
        throw new Error('ssrf: too_large')
      }

      const bytes = await readCapped(res, maxBytes)
      return { bytes, contentType: res.headers.get('content-type'), finalUrl: current.toString() }
    }
  } finally {
    clearTimeout(timer)
  }
}

/** Les deux familles de motifs que CE module lève, et que l'appelant peut rendre telles quelles. */
const MOTIF_PUBLIC = /^(?:ssrf: [a-z_]+|fetch: \d{3})$/

/**
 * Le motif d'un échec, tel qu'on peut le rendre à l'appelant : `ssrf: <motif>` ou
 * `fetch: <statut>`, sinon `fetch_failed`.
 *
 * ⛔ Jamais le message brut d'une autre erreur (audit du 13.09.2026, S14). C'est celui du
 * runtime — « error sending request for url (…): tcp connect error: Connection refused » —
 * qui distingue un port fermé d'un hôte muet ou d'un certificat refusé : recopié par un
 * endpoint public comme `c2pa-verify`, il en ferait un scanner de ports à la demande.
 */
export function safeFetchErrorCode(e: unknown): string {
  const message = e instanceof Error ? e.message : ''
  return MOTIF_PUBLIC.test(message) ? message : 'fetch_failed'
}

/** Les octets seuls, redirections refusées — le contrat historique (c2pa-verify). */
export async function safeFetch(
  rawUrl: string,
  { maxBytes = 8_000_000, timeoutMs = 8_000 }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Uint8Array> {
  const { bytes } = await safeFetchResponse(rawUrl, { maxBytes, timeoutMs, maxRedirects: 0 })
  return bytes
}
