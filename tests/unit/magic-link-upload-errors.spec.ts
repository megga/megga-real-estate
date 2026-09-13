/**
 * Refus d'un dépôt sur la page publique KYC : une catégorie, une phrase traduite — jamais le
 * corps reçu (audit S10, 13.09.2026).
 *
 * La page affichait le corps BRUT de l'erreur, JSON compris. Trois choses sont tenues ici :
 * le rangement statut → catégorie (chaque refus de `magic-link-upload` a la sienne), le fait
 * que l'erreur levée ne transporte AUCUN texte serveur, et la présence des phrases dans les
 * quatre langues — une clé absente afficherait son identifiant à la cliente.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'
import { MagicLinkUploadError, magicLinkUploadFailure } from '@/lib/magicLinkUploadErrors'

const sansCommentaires = (c: string): string =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, ' ')).replace(/\/\/[^\n]*/g, ' ')

describe('magicLinkUploadFailure — chaque refus de magic-link-upload a sa catégorie', () => {
  it.each([
    [411, 'length_required', 'length_required'],
    [413, 'too_large', 'too_large'],
    [409, 'upload_limit', 'upload_limit'],
    [409, 'not_uploadable', 'not_uploadable'],
    [410, 'expired', 'expired'],
    [410, 'regenerated', 'expired'],
    [401, 'expired', 'expired'],
    [401, 'invalid', 'invalid'],
    [400, 'format', 'format'],
  ] as const)('HTTP %i, reason %s → %s', (status, reason, attendu) => {
    expect(magicLinkUploadFailure(status, reason)).toBe(attendu)
  })

  it('un 409 sans motif reconnu reste « non recevable » — jamais « plafond »', () => {
    expect(magicLinkUploadFailure(409, null)).toBe('not_uploadable')
  })

  it('le reste — 500, 400 sans motif, statut inconnu — tombe sur le message générique', () => {
    for (const [status, reason] of [[500, null], [400, 'empty'], [400, null], [404, null], [0, null]] as const) {
      expect(magicLinkUploadFailure(status, reason), `${status}/${reason}`).toBe('other')
    }
  })
})

describe('MagicLinkUploadError — la catégorie, sans le corps', () => {
  it('porte la catégorie calculée et un message sans texte serveur', () => {
    const e = new MagicLinkUploadError(409, 'upload_limit')
    expect(e).toBeInstanceOf(Error)
    expect(e.failure).toBe('upload_limit')
    expect(e.message).toBe('Upload failed: HTTP 409')
    // Rien d'autre n'est attaché à l'erreur : ni motif brut, ni corps de réponse.
    expect(Object.keys(e).sort()).toEqual(['failure', 'name'])
  })

  it('le hook lève cette erreur, et ne lit plus le corps en texte', () => {
    const hook = sansCommentaires(readFileSync(repoPath('src/hooks/useMagicLinkClient.ts'), 'utf-8'))
    const upload = hook.slice(hook.indexOf('export function useMagicLinkUploadClient'))
    expect(upload).toContain('new MagicLinkUploadError(res.status')
    expect(upload.slice(0, upload.indexOf('export function', 10))).not.toContain('res.text()')
  })

  it('la page ne recopie jamais `err.message` à l’écran', () => {
    const page = sansCommentaires(readFileSync(repoPath('src/pages/public/KycPublicPage.tsx'), 'utf-8'))
    expect(page).toContain('err instanceof MagicLinkUploadError')
    expect(page).not.toMatch(/err\.message/)
  })
})

describe('les phrases de refus existent dans les quatre langues', () => {
  const page = sansCommentaires(readFileSync(repoPath('src/pages/public/KycPublicPage.tsx'), 'utf-8'))
  const debut = page.indexOf('const messageDeRefus')
  const bloc = page.slice(debut, page.indexOf('return phrases[failure]', debut))
  const cles = [...bloc.matchAll(/t\('([\w.]+)'/g)].map((m) => m[1])

  it('la page nomme une phrase par catégorie (témoin : huit clés lues)', () => {
    expect(debut).toBeGreaterThan(-1)
    expect(cles).toHaveLength(8)
    expect(cles).toContain('client.upload.error_limit')
    expect(cles).toContain('client.upload.error_length_required')
    expect(cles).toContain('client.upload.error_not_uploadable')
  })

  it.each(['fr', 'de', 'en', 'it'])('%s : chaque clé est présente et non vide', (langue) => {
    const kyc = JSON.parse(readFileSync(repoPath('src/i18n/locales', langue, 'kyc.json'), 'utf-8')) as Record<string, unknown>
    for (const cle of cles) {
      const valeur = cle.split('.').reduce<unknown>(
        (noeud, segment) => (noeud && typeof noeud === 'object' ? (noeud as Record<string, unknown>)[segment] : undefined),
        kyc,
      )
      expect(typeof valeur === 'string' && valeur.trim().length > 0, `${langue} — ${cle}`).toBe(true)
    }
  })

  it('la phrase de plafond cite les deux plafonds ({{max}} et {{mb}}) dans chaque langue', () => {
    for (const langue of ['fr', 'de', 'en', 'it']) {
      const kyc = JSON.parse(readFileSync(repoPath('src/i18n/locales', langue, 'kyc.json'), 'utf-8')) as {
        client: { upload: Record<string, string> }
      }
      expect(kyc.client.upload.error_limit, langue).toMatch(/\{\{max\}\}[\s\S]*\{\{mb\}\}/)
    }
  })
})
