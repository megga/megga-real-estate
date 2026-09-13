/**
 * Les trois lecteurs de photo fournie par l'appelant passent par le fetch sûr.
 *
 * ⛔ Audit du 13.09.2026, point S6. `c2pa-sign`, `virtual-staging` et `photo-vision`
 * validaient l'URL par `assertPublicUrl`, puis la lisaient par un `fetch` direct — qui
 * SUIT les redirections : l'URL d'arrivée n'était jamais validée. Le comportement du fetch
 * sûr est éprouvé dans `supabase/functions/_shared/safe-fetch.test.ts` ; ce fichier tient
 * le CÂBLAGE — qu'aucun de ces trois fichiers ne retombe sur un fetch direct de la photo.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'

function source(path: string): string {
  const lu = readFileSafely(repoPath(path))
  return lu.status === 'ok' ? lu.value : ''
}

/** Retire les commentaires : un commentaire qui CITE l'ancien appel ne doit ni faire rougir ni verdir. */
function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

describe('lecteurs de photo fournie par l’appelant', () => {
  for (const path of ['supabase/functions/c2pa-sign/index.ts', 'supabase/functions/virtual-staging/index.ts']) {
    describe(path, () => {
      const src = sansCommentaires(source(path))

      it('a une source lisible', () => {
        expect(src.length, `${path} illisible`).toBeGreaterThan(1000)
      })

      it('lit la photo par safeFetchResponse, redirections re-validées', () => {
        expect(src).toMatch(/safeFetchResponse\(photoUrl,\s*\{[^}]*maxRedirects:\s*\d/)
      })

      it('ne fetch jamais la photo directement', () => {
        expect(src).not.toMatch(/\bfetch\(\s*photoUrl\s*[,)]/)
      })
    })
  }

  it('photo-vision n’a plus aucun fetch : elle reçoit des octets', () => {
    const src = sansCommentaires(source('supabase/functions/_shared/photo-vision.ts'))
    expect(src.length).toBeGreaterThan(500)
    expect(src).not.toMatch(/\bfetch\(/)
    expect(src).toMatch(/export async function analyzePhoto\(photo: \{ bytes: Uint8Array/)
  })
})
