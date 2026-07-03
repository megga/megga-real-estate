// supabase/functions/_shared/safe-fetch.ts
// Fetch d'une URL fournie par un appelant, durci contre le SSRF.
//
// Refuse : schéma non-https, hôtes résolvant vers une IP privée/loopback/
// link-local (169.254.x, 127.x, 10.x, 172.16-31.x, 192.168.x, ::1, fc00::/7,
// fe80::/10), redirections (manual), réponses trop volumineuses, timeouts.
//
// Renvoie les octets du corps (Uint8Array). Lève une `Error` préfixée `ssrf:`
// ou `fetch:` que l'appelant doit traduire en 400.
//
// Le repo utilise déjà ce patron (allowlist + timeout) dans extract-property-url ;
// on le généralise ici avec le blocage explicite des IP internes.

const BLOCKED_IP: RegExp[] = [
  /^127\./,                       // loopback
  /^10\./,                        // private A
  /^0\./,                         // "this" network
  /^169\.254\./,                  // link-local (métadonnées cloud !)
  /^172\.(1[6-9]|2\d|3[01])\./,   // private B
  /^192\.168\./,                  // private C
  /^::1$/,                        // IPv6 loopback
  /^fe80:/i,                      // IPv6 link-local
  /^f[cd][0-9a-f][0-9a-f]:/i,     // IPv6 unique-local (fc00::/7)
]

async function resolveAll(hostname: string): Promise<string[]> {
  const [a, aaaa] = await Promise.all([
    Deno.resolveDns(hostname, 'A').catch(() => [] as string[]),
    Deno.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
  ])
  return [...a, ...aaaa]
}

export async function safeFetch(
  rawUrl: string,
  { maxBytes = 8_000_000, timeoutMs = 8_000 }: { maxBytes?: number; timeoutMs?: number } = {},
): Promise<Uint8Array> {
  let u: URL
  try {
    u = new URL(rawUrl)
  } catch {
    throw new Error('ssrf: invalid_url')
  }
  if (u.protocol !== 'https:') throw new Error('ssrf: https_only')

  // Résolution DNS + refus des cibles internes (bloque aussi un rebinding basique
  // puisqu'on vérifie l'IP effective au moment de l'appel).
  const ips = await resolveAll(u.hostname)
  if (ips.length === 0) throw new Error('ssrf: dns_unresolved')
  if (ips.some((ip) => BLOCKED_IP.some((r) => r.test(ip)))) throw new Error('ssrf: blocked_ip')

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(u, { redirect: 'manual', signal: ctrl.signal })
    if (res.status >= 300 && res.status < 400) throw new Error('ssrf: redirect_blocked')
    if (!res.ok) throw new Error(`fetch: ${res.status}`)

    const declared = Number(res.headers.get('content-length') ?? '0')
    if (declared > maxBytes) throw new Error('ssrf: too_large')

    const buf = new Uint8Array(await res.arrayBuffer())
    if (buf.byteLength > maxBytes) throw new Error('ssrf: too_large')
    return buf
  } finally {
    clearTimeout(timer)
  }
}
