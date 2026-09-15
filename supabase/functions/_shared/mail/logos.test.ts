/**
 * Le résolveur de logos d'expéditeurs (`logos.ts`) — sans réseau : le `Reseau` est un
 * faux qui sert des routes et note chaque requête.
 *
 * CE QUE CES TESTS VERROUILLENT, au-delà du chemin nominal :
 *  · une messagerie de particuliers ne déclenche AUCUNE requête — le logo de Gmail sous
 *    chaque client serait faux, et la requête elle-même inutile ;
 *  · le type d'une image se lit dans ses OCTETS, et un favicon de 16 px est refusé ;
 *  · un SVG qui porte un script n'est jamais rangé ;
 *  · une échéance dépassée n'est pas un « rien » : elle lève, pour que rien ne soit caché.
 */
import { describe, expect, it } from 'vitest'
import { domainesParticuliers } from './imap-presets.ts'
import {
  DelaiDepasse, coteImage, domainesCandidats, enBase64, estGrandPublic, iconesDeLaPage, imageAcceptable,
  normaliserDomaine, reconnaitreImage, resoudreLogo, urlBimi, type ReponseHttp, type Reseau,
} from './logos.ts'

// ─── Octets d'images fabriqués ────────────────────────────────────────────────
const u32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
const png = (w: number, h: number) => new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, ...u32(w), ...u32(h), 8, 6, 0, 0, 0])
const ico = (...cotes: number[]) => new Uint8Array([0, 0, 1, 0, cotes.length, 0, ...cotes.flatMap((c) => [c % 256, c % 256, ...new Array(14).fill(0)])])
const gif = (w: number, h: number) => new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, w & 255, w >> 8, h & 255, h >> 8])
const jpeg = (w: number, h: number) => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, h >> 8, h & 255, w >> 8, w & 255, 3])
const webpVp8x = (w: number, h: number) => {
  const b = new Uint8Array(30)
  b.set([0x52, 0x49, 0x46, 0x46], 0); b.set([0x57, 0x45, 0x42, 0x50], 8); b.set([0x56, 0x50, 0x38, 0x58], 12)
  b.set([(w - 1) & 255, ((w - 1) >> 8) & 255, 0, (h - 1) & 255, ((h - 1) >> 8) & 255, 0], 24)
  return b
}
const texte = (s: string) => new TextEncoder().encode(s)
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>'

// ─── Faux réseau ──────────────────────────────────────────────────────────────
type Route = { bytes: Uint8Array; contentType?: string; finalUrl?: string }
function reseau(routes: Record<string, Route>, txt: Record<string, string[][]> = {}) {
  const lus: string[] = []
  const dns: string[] = []
  const r: Reseau = {
    lire: async (url) => {
      lus.push(url)
      const route = routes[url]
      if (!route) throw new Error('fetch: 404')
      return { bytes: route.bytes, contentType: route.contentType ?? null, finalUrl: route.finalUrl ?? url } satisfies ReponseHttp
    },
    txt: async (nom) => { dns.push(nom); return txt[nom] ?? [] },
  }
  return { r, lus, dns }
}

describe('domaines', () => {
  it('normalise une adresse ou un domaine, et refuse ce qui n’a pas la forme d’un domaine public', () => {
    expect(normaliserDomaine('Credit@Banque-Exemple.CH')).toBe('banque-exemple.ch')
    expect(normaliserDomaine('exemple.ch.')).toBe('exemple.ch')
    expect(normaliserDomaine('localhost')).toBeNull()
    expect(normaliserDomaine('192.168.0.1')).toBeNull()
    expect(normaliserDomaine('a..b.ch')).toBeNull()
    expect(normaliserDomaine('x@')).toBeNull()
  })

  it('reconnaît une messagerie de particuliers, sous-domaines compris', () => {
    expect(estGrandPublic('gmail.com')).toBe(true)
    expect(estGrandPublic('bluewin.ch')).toBe(true)
    expect(estGrandPublic('mail.yahoo.com')).toBe(true)
    expect(estGrandPublic('banque-exemple.ch')).toBe(false)
  })
  // ⛔ 21 domaines que l'assistant de connexion connaît manquaient ici : le logo d'Infomaniak
  // s'affichait sous un particulier en `@ikmail.com` (revue du 15.09.2026).
  it('toute messagerie que l assistant de connexion reconnaît est grand public', () => {
    const manquants = domainesParticuliers().filter((d) => !estGrandPublic(d))
    expect(manquants).toEqual([])
    expect(domainesParticuliers()).toEqual(expect.arrayContaining(['ikmail.com', 'posteo.de', 'ymail.com', 'aol.fr']))
  })

  it('essaie le domaine puis ses parents — jamais un suffixe qui ne désigne personne', () => {
    expect(domainesCandidats('notifications.banque-exemple.ch')).toEqual(['notifications.banque-exemple.ch', 'banque-exemple.ch'])
    expect(domainesCandidats('a.b.c.exemple.ch')).toHaveLength(3)
    expect(domainesCandidats('boutique.exemple.co.uk')).toEqual(['boutique.exemple.co.uk', 'exemple.co.uk'])
  })
})

describe('BIMI', () => {
  it('lit le `l=` d’un enregistrement, même découpé en morceaux', () => {
    expect(urlBimi([['v=BIMI1; l=https://banque-exemple.ch/bimi.svg; a=']])).toBe('https://banque-exemple.ch/bimi.svg')
    expect(urlBimi([['v=spf1 -all'], ['v=BIMI1; l=https://banque-exemple.ch/', 'bimi.svg']])).toBe('https://banque-exemple.ch/bimi.svg')
  })

  it('un `l=` vide (logo décliné) ou non-https ne donne rien', () => {
    expect(urlBimi([['v=BIMI1; l=; a=;']])).toBeNull()
    expect(urlBimi([['v=BIMI1; l=http://banque-exemple.ch/bimi.svg']])).toBeNull()
    expect(urlBimi([])).toBeNull()
  })
})

describe('icônes de la page d’accueil', () => {
  const html = `<html><head>
    <link rel="icon" href="/favicon-32.png" sizes="32x32">
    <link rel="apple-touch-icon" href="/apple-touch-icon.png">
    <link rel="mask-icon" href="/mask.svg" color="#000">
    <link rel="icon" type="image/svg+xml" href="/logo.svg">
    <link rel="shortcut icon" href="https://cdn.exemple.ch/f.ico?v=2&amp;x=1">
    <link rel="icon" href="http://exemple.ch/insecure.png" sizes="192x192">
    <link rel="stylesheet" href="/site.css">
  </head></html>`

  it('rend les icônes déclarées, résolues contre l’URL finale, la plus grande d’abord', () => {
    const icones = iconesDeLaPage(html, 'https://www.exemple.ch/fr/')
    expect(icones.map((i) => [i.url, i.source, i.cote])).toEqual([
      ['https://www.exemple.ch/logo.svg', 'icon', 512],
      ['https://www.exemple.ch/apple-touch-icon.png', 'apple-touch-icon', 180],
      ['https://www.exemple.ch/favicon-32.png', 'icon', 32],
      ['https://cdn.exemple.ch/f.ico?v=2&x=1', 'icon', 0],
    ])
  })

  it('ni `mask-icon` (une silhouette), ni une icône en http, ni une feuille de style', () => {
    const urls = iconesDeLaPage(html, 'https://www.exemple.ch/').map((i) => i.url)
    expect(urls.some((u) => u.includes('mask.svg') || u.startsWith('http:') || u.endsWith('.css'))).toBe(false)
  })
})

describe('images', () => {
  it('lit le type dans les octets, et le côté utile de chaque format', () => {
    expect([reconnaitreImage(png(64, 48)), coteImage(png(64, 48), 'image/png')]).toEqual(['image/png', 48])
    expect([reconnaitreImage(ico(16, 0)), coteImage(ico(16, 0), 'image/x-icon')]).toEqual(['image/x-icon', 256])
    expect([reconnaitreImage(gif(40, 50)), coteImage(gif(40, 50), 'image/gif')]).toEqual(['image/gif', 40])
    expect([reconnaitreImage(jpeg(120, 90)), coteImage(jpeg(120, 90), 'image/jpeg')]).toEqual(['image/jpeg', 90])
    expect([reconnaitreImage(webpVp8x(200, 100)), coteImage(webpVp8x(200, 100), 'image/webp')]).toEqual(['image/webp', 100])
    expect(reconnaitreImage(texte(`\uFEFF<?xml version="1.0"?>\n<!-- logo -->\n${SVG}`))).toBe('image/svg+xml')
    expect(reconnaitreImage(texte('<!DOCTYPE html><html></html>'))).toBeNull()
  })

  it('refuse un favicon trop petit, un SVG qui porte un script, un fichier trop lourd', () => {
    expect(imageAcceptable(png(16, 16), 'image/png')).toBe(false)
    expect(imageAcceptable(png(64, 64), 'image/png')).toBe(true)
    expect(imageAcceptable(texte(SVG), 'image/svg+xml')).toBe(true)
    expect(imageAcceptable(texte(SVG.replace('<rect', '<script>alert(1)</script><rect')), 'image/svg+xml')).toBe(false)
    expect(imageAcceptable(texte(SVG.replace('<rect', '<rect onload="x()"')), 'image/svg+xml')).toBe(false)
    const lourd = new Uint8Array(97 * 1024); lourd.set(png(256, 256))
    expect(imageAcceptable(lourd, 'image/png')).toBe(false)
  })

  it('encode en base64 par tranches, sans perdre un octet', () => {
    const b = Uint8Array.from({ length: 100_000 }, (_, i) => (i * 7) % 256)
    expect(enBase64(b)).toBe(Buffer.from(b).toString('base64'))
  })
})

describe('resoudreLogo', () => {
  it('une messagerie de particuliers : « rien », et AUCUNE requête', async () => {
    const { r, lus, dns } = reseau({})
    expect(await resoudreLogo('gmail.com', r)).toEqual({ status: 'none' })
    expect([...lus, ...dns]).toEqual([])
  })

  it('BIMI d’abord : le logo que le domaine publie pour son courrier', async () => {
    const { r, lus } = reseau(
      { 'https://banque-exemple.ch/bimi.svg': { bytes: texte(SVG), contentType: 'image/svg+xml' } },
      { 'default._bimi.banque-exemple.ch': [['v=BIMI1; l=https://banque-exemple.ch/bimi.svg']] },
    )
    const logo = await resoudreLogo('banque-exemple.ch', r)
    expect(logo).toMatchObject({ status: 'found', source: 'bimi', mime: 'image/svg+xml' })
    expect(lus).toEqual(['https://banque-exemple.ch/bimi.svg'])
  })

  it('sinon l’icône déclarée par la page d’accueil — le type vient des octets, pas de l’en-tête', async () => {
    const { r, lus } = reseau({
      'https://regie-exemple.ch/': { bytes: texte('<link rel="apple-touch-icon" href="/touch.png">'), contentType: 'text/html; charset=utf-8' },
      'https://regie-exemple.ch/touch.png': { bytes: png(180, 180), contentType: 'application/octet-stream' },
    })
    expect(await resoudreLogo('regie-exemple.ch', r)).toMatchObject({ status: 'found', source: 'apple-touch-icon', mime: 'image/png' })
    expect(lus).toEqual(['https://regie-exemple.ch/', 'https://regie-exemple.ch/touch.png'])
  })

  it('une page qui redirige : les chemins relatifs se résolvent contre l’URL FINALE', async () => {
    const { r } = reseau({
      'https://regie-exemple.ch/': { bytes: texte('<link rel="icon" href="img/logo.svg">'), contentType: 'text/html', finalUrl: 'https://www.regie-exemple.ch/fr/' },
      'https://www.regie-exemple.ch/fr/img/logo.svg': { bytes: texte(SVG) },
    })
    expect(await resoudreLogo('regie-exemple.ch', r)).toMatchObject({ status: 'found', mime: 'image/svg+xml' })
  })

  it('sans icône déclarée : les emplacements conventionnels, jusqu’au favicon s’il est assez grand', async () => {
    const { r } = reseau({
      'https://notaire-exemple.ch/': { bytes: texte('<html><head></head></html>'), contentType: 'text/html' },
      'https://notaire-exemple.ch/favicon.ico': { bytes: ico(16, 48) },
    })
    expect(await resoudreLogo('notaire-exemple.ch', r)).toMatchObject({ status: 'found', source: 'favicon', mime: 'image/x-icon' })
  })

  it('un favicon de 16 px seulement : « rien » — agrandi, il ne se reconnaîtrait plus', async () => {
    const { r } = reseau({
      'https://notaire-exemple.ch/': { bytes: texte('<html></html>'), contentType: 'text/html' },
      'https://notaire-exemple.ch/favicon.ico': { bytes: ico(16) },
    })
    expect(await resoudreLogo('notaire-exemple.ch', r)).toEqual({ status: 'none' })
  })

  it('un sous-domaine sans site cède la place à son parent', async () => {
    const { r, lus } = reseau({
      'https://notaire-exemple.ch/': { bytes: texte('<link rel="icon" href="/logo.svg">'), contentType: 'text/html' },
      'https://notaire-exemple.ch/logo.svg': { bytes: texte(SVG) },
    })
    expect(await resoudreLogo('etude.notaire-exemple.ch', r)).toMatchObject({ status: 'found' })
    expect(lus[0]).toBe('https://etude.notaire-exemple.ch/')
  })

  it('un site qui a RÉPONDU sans icône clôt la recherche : son parent serait un autre visage', async () => {
    const { r, lus } = reseau({ 'https://boutique.exemple.ch/': { bytes: texte('<html></html>'), contentType: 'text/html' } })
    expect(await resoudreLogo('boutique.exemple.ch', r)).toEqual({ status: 'none' })
    expect(lus.some((u) => u.startsWith('https://exemple.ch/'))).toBe(false)
  })

  it('une échéance dépassée n’est pas un « rien » : elle lève, et rien n’est conclu', async () => {
    const { r } = reseau({})
    await expect(resoudreLogo('regie-exemple.ch', r, Date.now() - 1)).rejects.toBeInstanceOf(DelaiDepasse)
  })
})
