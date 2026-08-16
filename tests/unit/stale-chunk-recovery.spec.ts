/**
 * src/lib/staleChunkRecovery.ts — récupération des échecs de chargement de chunk.
 *
 * Contexte (incident du 03.08.2026) : pendant la bascule d'un déploiement, le
 * fallback SPA a servi index.html (200, max-age=14400) pour l'URL d'un chunk
 * .js ; le navigateur du premier inscrit a mis ce HTML en cache 4 heures et
 * chaque visite de /dashboard/identite finissait sur « Une erreur est
 * survenue » — un cul-de-sac dont même Recharger ne sortait pas (l'entrée de
 * cache restait « fraîche »). Ces tests éprouvent les briques pures de la
 * récupération : reconnaissance du motif, extraction de l'URL, parcours des
 * dépendances, purge bornée, drapeau de session, cache-buster.
 */
import { describe, it, expect } from 'vitest'
import {
  STALE_CHUNK_PATTERNS,
  isStaleChunkError,
  extractChunkUrl,
  parseStaticDeps,
  purgeChunkCache,
  shouldAttemptChunkRecovery,
  markChunkRecoveryAttempted,
  cacheBustedReloadUrl,
} from '@/lib/staleChunkRecovery'

/** Message réel observé dans le Chrome de l'incident (Sentry + console). */
const CHROME_MESSAGE =
  'Failed to fetch dynamically imported module: https://app.megga.ch/assets/IdentityPage-UNAb1wxY.js'

describe('isStaleChunkError', () => {
  it('reconnaît chacun des motifs du catalogue, en Error comme en chaîne', () => {
    for (const pattern of STALE_CHUNK_PATTERNS) {
      expect(isStaleChunkError(new Error(`x ${pattern} y`))).toBe(true)
      expect(isStaleChunkError(`x ${pattern} y`)).toBe(true)
    }
  })

  it('reconnaît la variante MIME de Chrome (réponse HTML en cache pour une URL .js)', () => {
    expect(isStaleChunkError(new TypeError(
      "Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of \"text/html\".",
    ))).toBe(true)
  })

  it('ignore une erreur quelconque, null et undefined', () => {
    expect(isStaleChunkError(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(isStaleChunkError(null)).toBe(false)
    expect(isStaleChunkError(undefined)).toBe(false)
  })
})

describe('extractChunkUrl', () => {
  it('extrait l\'URL absolue du message Chrome/Firefox', () => {
    expect(extractChunkUrl(new Error(CHROME_MESSAGE)))
      .toBe('https://app.megga.ch/assets/IdentityPage-UNAb1wxY.js')
  })

  it('extrait une URL relative /assets/…', () => {
    expect(extractChunkUrl('error loading dynamically imported module: /assets/Foo-abc123.js'))
      .toBe('/assets/Foo-abc123.js')
  })

  it('rend null quand le message ne porte pas d\'URL (Safari)', () => {
    expect(extractChunkUrl(new Error('Importing a module script failed.'))).toBeNull()
  })
})

describe('parseStaticDeps', () => {
  it('trouve les trois formes minifiées et dédoublonne', () => {
    const src = 'import{a}from"./useAgencyIdentity-Dp5tSm-I.js";import"./polyfill-x1.js";'
      + 'const p=import("./lazy-y2.js");import{b}from"./useAgencyIdentity-Dp5tSm-I.js";'
    expect(parseStaticDeps(src).sort()).toEqual([
      './lazy-y2.js', './polyfill-x1.js', './useAgencyIdentity-Dp5tSm-I.js',
    ])
  })

  it('ignore les imports nus (npm) et les non-.js', () => {
    const src = 'import{q}from"react";import"./style-z.css";'
    expect(parseStaticDeps(src)).toEqual([])
  })
})

/** Fabrique un faux fetch servi depuis une table URL → { corps, type, ok }. */
function fakeFetch(routes: Record<string, { body?: string; type?: string; ok?: boolean }>) {
  const calls: Array<{ url: string; cache: string | undefined }> = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    calls.push({ url, cache: init?.cache })
    const route = routes[url]
    if (!route) throw new TypeError('Failed to fetch')
    return new Response(route.body ?? '', {
      status: route.ok === false ? 404 : 200,
      headers: { 'content-type': route.type ?? 'application/javascript' },
    })
  }) as typeof fetch
  return { impl, calls }
}

describe('purgeChunkCache', () => {
  it('purge l\'entrée puis ses dépendances, chacune avec cache:reload, sans doublon', async () => {
    const { impl, calls } = fakeFetch({
      '/assets/Entry-a.js': { body: 'import"./Dep-b.js";import"./Dep-c.js";' },
      '/assets/Dep-b.js': { body: 'import"./Dep-c.js";' },
      '/assets/Dep-c.js': { body: '' },
    })
    const purged = await purgeChunkCache('/assets/Entry-a.js', impl)
    expect(purged).toBe(3)
    expect(calls.map((c) => c.url)).toEqual(['/assets/Entry-a.js', '/assets/Dep-b.js', '/assets/Dep-c.js'])
    expect(calls.every((c) => c.cache === 'reload')).toBe(true)
  })

  it('purge une réponse HTML (fallback SPA) sans essayer de la parcourir', async () => {
    const { impl, calls } = fakeFetch({
      '/assets/Entry-a.js': { body: '<!doctype html><script src="./piege.js"></script>', type: 'text/html; charset=utf-8' },
    })
    const purged = await purgeChunkCache('/assets/Entry-a.js', impl)
    expect(purged).toBe(1)
    expect(calls).toHaveLength(1)
  })

  it('continue après un échec réseau sur une dépendance', async () => {
    const { impl } = fakeFetch({
      '/assets/Entry-a.js': { body: 'import"./Morte-x.js";import"./Dep-c.js";' },
      '/assets/Dep-c.js': { body: '' },
    })
    // Morte-x jette (absente de la table) : l'entrée et Dep-c sont quand même purgées.
    const purged = await purgeChunkCache('/assets/Entry-a.js', impl)
    expect(purged).toBe(2)
  })

  it('borne le parcours à 40 fichiers sur un graphe plus large', async () => {
    const routes: Record<string, { body: string }> = {}
    for (let i = 0; i < 60; i += 1) {
      routes[`/assets/C${i}.js`] = { body: `import"./C${i + 1}.js";` }
    }
    const { impl, calls } = fakeFetch(routes)
    await purgeChunkCache('/assets/C0.js', impl)
    expect(calls.length).toBe(40)
  })

  it('ne lève jamais, même quand l\'entrée elle-même échoue', async () => {
    const { impl } = fakeFetch({})
    await expect(purgeChunkCache('/assets/Inconnue-z.js', impl)).resolves.toBe(0)
  })
})

describe('drapeau de session (une seule tentative automatique)', () => {
  function memoryStorage(): Pick<Storage, 'getItem' | 'setItem'> {
    const map = new Map<string, string>()
    return {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => { map.set(k, v) },
    }
  }

  it('autorise puis refuse après la pose du drapeau', () => {
    const storage = memoryStorage()
    expect(shouldAttemptChunkRecovery(storage)).toBe(true)
    markChunkRecoveryAttempted(storage)
    expect(shouldAttemptChunkRecovery(storage)).toBe(false)
  })

  it('autorise quand le stockage est indisponible (fail-open : au pire un rechargement de trop)', () => {
    expect(shouldAttemptChunkRecovery(null)).toBe(true)
    expect(() => markChunkRecoveryAttempted(null)).not.toThrow()
  })
})

describe('cacheBustedReloadUrl', () => {
  it('ajoute _v en préservant chemin et query, et écrase un _v précédent', () => {
    const once = cacheBustedReloadUrl('https://app.megga.ch/dashboard/identite?tab=2', 1700000000000)
    expect(once).toBe('https://app.megga.ch/dashboard/identite?tab=2&_v=1700000000000')
    const twice = cacheBustedReloadUrl(once, 1700000000001)
    expect(twice).toBe('https://app.megga.ch/dashboard/identite?tab=2&_v=1700000000001')
  })
})
