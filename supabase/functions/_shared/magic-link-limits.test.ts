/**
 * Plafonds d'un lien magique KYC (audit S10, 13.09.2026) : le tri d'une requête avant lecture
 * du corps, et la frontière exacte des deux plafonds par lien.
 *
 * Chaque refus est confronté à son témoin juste en deçà : un tri qui refuserait TOUT
 * (411 pour tout le monde) passerait les tests de refus, pas ceux-là.
 */
import { describe, it, expect } from 'vitest'
import {
  ALLOWED_UPLOAD_MIME,
  MAGIC_LINK_OPEN_STATUSES,
  MAX_BYTES_PER_LINK,
  MAX_FILE_BYTES,
  MAX_FILES_PER_LINK,
  MAX_REQUEST_BYTES,
  exceedsLinkCaps,
  screenUploadRequest,
} from './magic-link-limits.ts'

describe('screenUploadRequest — le corps est borné AVANT d’être lu', () => {
  it('sans Content-Length → 411 (un envoi chunked n’aurait aucune borne)', () => {
    expect(screenUploadRequest(null)).toEqual({ ok: false, status: 411, reason: 'length_required' })
    expect(screenUploadRequest('')).toEqual({ ok: false, status: 411, reason: 'length_required' })
  })

  it('une longueur illisible vaut une absence → 411', () => {
    for (const v of ['abc', '-1', '1.5', '12abc', '0x10', '1e6']) {
      expect(screenUploadRequest(v), v).toEqual({ ok: false, status: 411, reason: 'length_required' })
    }
  })

  it('au-delà du plafond de requête → 413, y compris un nombre hors des entiers sûrs', () => {
    expect(screenUploadRequest(String(MAX_REQUEST_BYTES + 1))).toEqual({ ok: false, status: 413, reason: 'too_large' })
    expect(screenUploadRequest('99999999999999999999')).toEqual({ ok: false, status: 413, reason: 'too_large' })
  })

  it('TÉMOIN — une requête au plafond exact, ou ordinaire, passe', () => {
    expect(screenUploadRequest(String(MAX_REQUEST_BYTES))).toEqual({ ok: true, declaredBytes: MAX_REQUEST_BYTES })
    expect(screenUploadRequest(' 2048 ')).toEqual({ ok: true, declaredBytes: 2048 })
  })

  it('le plafond de requête laisse passer une pièce au plafond unitaire, et pas deux', () => {
    expect(MAX_REQUEST_BYTES).toBeGreaterThan(MAX_FILE_BYTES)
    expect(MAX_REQUEST_BYTES).toBeLessThan(2 * MAX_FILE_BYTES)
  })
})

describe('exceedsLinkCaps — même frontière que le trigger', () => {
  it('la 21ᵉ pièce est refusée, la 20ᵉ acceptée', () => {
    expect(exceedsLinkCaps({ files: MAX_FILES_PER_LINK - 1, bytes: 0 }, 1)).toBe(false)
    expect(exceedsLinkCaps({ files: MAX_FILES_PER_LINK, bytes: 0 }, 1)).toBe(true)
  })

  it('exactement 100 Mo passent, un octet de plus non', () => {
    expect(exceedsLinkCaps({ files: 9, bytes: MAX_BYTES_PER_LINK - MAX_FILE_BYTES }, MAX_FILE_BYTES)).toBe(false)
    expect(exceedsLinkCaps({ files: 10, bytes: MAX_BYTES_PER_LINK }, 1)).toBe(true)
  })

  it('les valeurs sont celles qu’annonce l’audit (20 pièces, 100 Mo, 10 Mo par pièce)', () => {
    expect(MAX_FILES_PER_LINK).toBe(20)
    expect(MAX_BYTES_PER_LINK).toBe(104_857_600)
    expect(MAX_FILE_BYTES).toBe(10_485_760)
  })
})

describe('listes fermées', () => {
  it('les formats acceptés sont ceux du bucket kyc-magic-link', () => {
    expect([...ALLOWED_UPLOAD_MIME].sort()).toEqual(
      ['application/pdf', 'image/heic', 'image/jpeg', 'image/png', 'image/webp'],
    )
  })

  it('les statuts ouverts excluent les deux statuts terminaux', () => {
    expect([...MAGIC_LINK_OPEN_STATUSES].sort()).toEqual(['opened', 'pending', 'uploading', 'verifying'])
    const ouverts: readonly string[] = MAGIC_LINK_OPEN_STATUSES
    expect(ouverts).not.toContain('submitted')
    expect(ouverts).not.toContain('expired')
  })
})
