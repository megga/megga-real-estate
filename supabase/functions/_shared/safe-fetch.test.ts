/**
 * `safeFetchResponse` — le fetch d'URL fournie par un appelant, redirections comprises.
 *
 * CE QUE CES TESTS VERROUILLENT (audit du 13.09.2026, point S6). Trois fonctions validaient
 * l'URL puis appelaient `fetch(url)`, qui SUIT les redirections par défaut : une URL
 * publique répondant `302 → http://169.254.169.254/…` passait le contrôle, et la cible
 * interne était lue. Ici, chaque saut repasse par la validation, le corps est plafonné
 * PENDANT la lecture, et le contrat historique de `safeFetch` (aucune redirection) tient.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

/** DNS de test : hôte → adresses. Un hôte absent ne résout pas. */
const DNS: Record<string, string[]> = {
  'photos.example.ch': ['203.0.113.10'],
  'cdn.example.ch': ['203.0.113.20'],
  'old-img.example.ch': ['203.0.113.30'],
  'img.getmegga.com': ['203.0.113.31'],
  'metadata.evil.ch': ['169.254.169.254'],
  'intranet.evil.ch': ['10.0.0.5'],
  'mapped.evil.ch': ['::ffff:169.254.169.254'],
}

const originalDeno = (globalThis as Record<string, unknown>).Deno
const originalFetch = globalThis.fetch
let fetched: string[] = []

/** Réponses servies par URL. */
let routes: Record<string, () => Response> = {}

beforeEach(() => {
  fetched = []
  routes = {}
  ;(globalThis as unknown as { Deno: unknown }).Deno = {
    env: { get: () => undefined },
    resolveDns: async (host: string, type: string) => {
      const ips = DNS[host] ?? []
      return type === 'A' ? ips.filter((ip) => ip.includes('.')) : ips.filter((ip) => ip.includes(':'))
    },
  }
  globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = input instanceof Request ? input.url : input.toString()
    fetched.push(url)
    expect(init?.redirect, 'le fetch ne doit jamais suivre seul').toBe('manual')
    const route = routes[url]
    if (!route) return new Response('not found', { status: 404 })
    return route()
  }) as typeof fetch
})

afterEach(() => {
  ;(globalThis as Record<string, unknown>).Deno = originalDeno
  globalThis.fetch = originalFetch
})

const { safeFetchResponse, safeFetch, isBlockedIp, safeFetchErrorCode } = await import('./safe-fetch.ts')

const jpeg = (n = 16) => new Response(new Uint8Array(n).fill(0xff), { status: 200, headers: { 'content-type': 'image/jpeg' } })
const redirect = (location: string, status = 302) => new Response(null, { status, headers: { location } })

describe('safeFetchResponse — le chemin nominal', () => {
  it('rend les octets, le type et l’URL finale', async () => {
    routes['https://photos.example.ch/a.jpg'] = () => jpeg(32)
    const r = await safeFetchResponse('https://photos.example.ch/a.jpg')
    expect(r.bytes.byteLength).toBe(32)
    expect(r.contentType).toBe('image/jpeg')
    expect(r.finalUrl).toBe('https://photos.example.ch/a.jpg')
  })

  it('suit une redirection publique quand l’appelant l’autorise — le cas de l’ancien hôte d’images en 301', async () => {
    routes['https://old-img.example.ch/p/1.jpg'] = () => redirect('https://img.getmegga.com/p/1.jpg', 301)
    routes['https://img.getmegga.com/p/1.jpg'] = () => jpeg()
    const r = await safeFetchResponse('https://old-img.example.ch/p/1.jpg', { maxRedirects: 3 })
    expect(r.finalUrl).toBe('https://img.getmegga.com/p/1.jpg')
    expect(fetched).toEqual(['https://old-img.example.ch/p/1.jpg', 'https://img.getmegga.com/p/1.jpg'])
  })

  it('résout une Location relative contre l’URL courante', async () => {
    routes['https://photos.example.ch/old/a.jpg'] = () => redirect('/new/a.jpg')
    routes['https://photos.example.ch/new/a.jpg'] = () => jpeg()
    const r = await safeFetchResponse('https://photos.example.ch/old/a.jpg', { maxRedirects: 1 })
    expect(r.finalUrl).toBe('https://photos.example.ch/new/a.jpg')
  })
})

describe('safeFetchResponse — ⛔ les redirections sont re-validées à chaque saut', () => {
  it('refuse une redirection vers un hôte qui résout en adresse de métadonnées, SANS la suivre', async () => {
    routes['https://photos.example.ch/a.jpg'] = () => redirect('https://metadata.evil.ch/latest/meta-data/')
    await expect(safeFetchResponse('https://photos.example.ch/a.jpg', { maxRedirects: 3 }))
      .rejects.toThrow('ssrf: blocked_ip')
    expect(fetched).toEqual(['https://photos.example.ch/a.jpg'])
  })

  it('refuse une redirection vers une IP privée écrite en dur', async () => {
    routes['https://photos.example.ch/a.jpg'] = () => redirect('https://10.0.0.5/admin')
    await expect(safeFetchResponse('https://photos.example.ch/a.jpg', { maxRedirects: 3 }))
      .rejects.toThrow(/ssrf:/)
    expect(fetched).toHaveLength(1)
  })

  it('refuse une redirection vers http:// — le schéma est exigé à chaque saut', async () => {
    routes['https://photos.example.ch/a.jpg'] = () => redirect('http://cdn.example.ch/a.jpg')
    await expect(safeFetchResponse('https://photos.example.ch/a.jpg', { maxRedirects: 3 }))
      .rejects.toThrow('ssrf: https_only')
  })

  it('borne le nombre de sauts', async () => {
    routes['https://photos.example.ch/1'] = () => redirect('https://photos.example.ch/2')
    routes['https://photos.example.ch/2'] = () => redirect('https://photos.example.ch/3')
    routes['https://photos.example.ch/3'] = () => jpeg()
    await expect(safeFetchResponse('https://photos.example.ch/1', { maxRedirects: 1 }))
      .rejects.toThrow('ssrf: too_many_redirects')
  })

  it('refuse une redirection sans Location', async () => {
    routes['https://photos.example.ch/a.jpg'] = () => new Response(null, { status: 302 })
    await expect(safeFetchResponse('https://photos.example.ch/a.jpg', { maxRedirects: 3 }))
      .rejects.toThrow('ssrf: redirect_without_location')
  })
})

describe('safeFetchResponse — plafond et erreurs', () => {
  it('coupe un corps SANS longueur annoncée dès qu’il dépasse le plafond', async () => {
    let pulls = 0
    routes['https://photos.example.ch/big'] = () => new Response(new ReadableStream({
      pull(c) { pulls++; if (pulls > 100) { c.close(); return } c.enqueue(new Uint8Array(1024)) },
    }), { status: 200 })
    await expect(safeFetchResponse('https://photos.example.ch/big', { maxBytes: 4096 }))
      .rejects.toThrow('ssrf: too_large')
    // La lecture s'est arrêtée peu après le plafond, pas à la fin du flux.
    expect(pulls).toBeLessThan(20)
  })

  it('refuse d’emblée une longueur annoncée au-delà du plafond', async () => {
    routes['https://photos.example.ch/big'] = () => new Response('x', { status: 200, headers: { 'content-length': '99999999' } })
    await expect(safeFetchResponse('https://photos.example.ch/big', { maxBytes: 1000 }))
      .rejects.toThrow('ssrf: too_large')
  })

  it('traduit un statut d’erreur en fetch:<code>', async () => {
    await expect(safeFetchResponse('https://photos.example.ch/absente')).rejects.toThrow('fetch: 404')
  })

  it('refuse une URL de départ interne avant tout fetch', async () => {
    await expect(safeFetchResponse('https://intranet.evil.ch/x')).rejects.toThrow('ssrf: blocked_ip')
    expect(fetched).toHaveLength(0)
  })
})

describe('safeFetch — le contrat historique ne bouge pas', () => {
  it('refuse toute redirection, même publique', async () => {
    routes['https://old-img.example.ch/p/1.jpg'] = () => redirect('https://img.getmegga.com/p/1.jpg', 301)
    await expect(safeFetch('https://old-img.example.ch/p/1.jpg')).rejects.toThrow('ssrf: redirect_blocked')
  })

  it('rend les octets bruts', async () => {
    routes['https://photos.example.ch/a.jpg'] = () => jpeg(8)
    expect((await safeFetch('https://photos.example.ch/a.jpg')).byteLength).toBe(8)
  })
})

describe('isBlockedIp — les plages internes, y compris déguisées', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '0.0.0.0',
    '100.64.0.1', '100.100.100.200', '100.127.255.254', '::1', '::', 'fe80::1', 'fd00::1',
    '::ffff:169.254.169.254', '::ffff:a9fe:a9fe', '::ffff:10.0.0.1', '::FFFF:7f00:1',
  ])('bloque %s', (ip) => expect(isBlockedIp(ip)).toBe(true))

  it.each(['203.0.113.10', '100.63.255.255', '100.128.0.1', '2001:db8::1', '::ffff:203.0.113.10'])(
    'laisse passer %s', (ip) => expect(isBlockedIp(ip)).toBe(false))

  it('refuse un hôte dont le AAAA encapsule l’adresse de métadonnées', async () => {
    await expect(safeFetchResponse('https://mapped.evil.ch/x')).rejects.toThrow('ssrf: blocked_ip')
  })
})

// S14 (13.09.2026) : ce que `c2pa-verify`, endpoint PUBLIC, peut rendre d'un échec.
describe('safeFetchErrorCode — les motifs du module passent, le texte du runtime non', () => {
  const echec = (url: string) => safeFetchResponse(url).then(() => null, (e: unknown) => e)

  it('rend tel quel un refus `ssrf:` et un statut `fetch:`', async () => {
    expect(safeFetchErrorCode(await echec('https://metadata.evil.ch/x'))).toBe('ssrf: blocked_ip')
    expect(safeFetchErrorCode(await echec('http://photos.example.ch/a.jpg'))).toBe('ssrf: https_only')
    expect(safeFetchErrorCode(await echec('https://photos.example.ch/absente.jpg'))).toBe('fetch: 404')
  })

  it('⛔ remplace le message d’une erreur réseau par un motif fixe', async () => {
    // Le texte que Deno lève sur un port fermé : il distingue « refusé » de « muet » et
    // nomme l'hôte — un oracle de balayage si l'endpoint public le recopiait.
    routes['https://photos.example.ch/port-ferme.jpg'] = () => {
      throw new TypeError('error sending request for url (https://photos.example.ch/port-ferme.jpg): tcp connect error: Connection refused (os error 111)')
    }
    const e = await echec('https://photos.example.ch/port-ferme.jpg')
    expect(e).toBeInstanceOf(TypeError)
    expect(safeFetchErrorCode(e)).toBe('fetch_failed')
  })

  it('ne se laisse pas prendre par un message qui ne fait que COMMENCER comme un motif', () => {
    expect(safeFetchErrorCode(new Error('ssrf: blocked_ip (169.254.169.254)'))).toBe('fetch_failed')
    expect(safeFetchErrorCode(new Error('fetch: 404 {"detail":"…"}'))).toBe('fetch_failed')
    expect(safeFetchErrorCode('ssrf: blocked_ip')).toBe('fetch_failed')
  })
})
