// @vitest-environment node
// (Node et non jsdom : l'analyseur multipart de Node exige SES File/FormData, que jsdom
// remplace — le module testé est du code Deno, où les deux sont les mêmes.)
/**
 * Plafonds d'un lien magique KYC (audit S10, 13.09.2026) : le tri d'une requête avant lecture
 * du corps, et la frontière exacte des deux plafonds par lien.
 *
 * Chaque refus est confronté à son témoin juste en deçà : un tri qui refuserait TOUT
 * passerait les tests de refus, pas ceux-là.
 */
import { describe, it, expect } from 'vitest'
import {
  ALLOWED_UPLOAD_MIME,
  MAGIC_LINK_BOOKING_STATUSES,
  MAGIC_LINK_OPEN_STATUSES,
  MAX_BYTES_PER_LINK,
  MAX_FILE_BYTES,
  MAX_FILES_PER_LINK,
  MAX_REQUEST_BYTES,
  exceedsLinkCaps,
  isMagicLinkBookable,
  lireFormulaireBorne,
  screenUploadRequest,
} from './magic-link-limits.ts'

describe('screenUploadRequest — une longueur déclarée trop grande est refusée sans lecture', () => {
  it('sans Content-Length : PAS de refus — la lecture elle-même est bornée (lireFormulaireBorne)', () => {
    // Exiger l'en-tête (411) couperait TOUS les dépôts le jour où la passerelle réécrit un
    // corps en chunked et le retire.
    expect(screenUploadRequest(null)).toEqual({ ok: true, declaredBytes: null })
    expect(screenUploadRequest('')).toEqual({ ok: true, declaredBytes: null })
  })

  it('une longueur illisible vaut une absence — la lecture bornée tranchera', () => {
    for (const v of ['abc', '-1', '1.5', '12abc', '0x10', '1e6']) {
      expect(screenUploadRequest(v), v).toEqual({ ok: true, declaredBytes: null })
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

  it('les statuts qui réservent : les ouverts PLUS `submitted` — soumettre ferme le dépôt, pas le rendez-vous', () => {
    expect([...MAGIC_LINK_BOOKING_STATUSES].sort()).toEqual([...MAGIC_LINK_OPEN_STATUSES, 'submitted'].sort())
    const reservent: readonly string[] = MAGIC_LINK_BOOKING_STATUSES
    expect(reservent).not.toContain('expired')
  })
})

describe('isMagicLinkBookable — liste BLANCHE (un lien révoqué ne réserve plus)', () => {
  it('`expired` refuse, qu’il vienne de l’échéance ou d’une révocation', () => {
    expect(isMagicLinkBookable('expired')).toBe(false)
  })

  it('un statut INCONNU refuse — celui qu’on ajouterait demain à l’enum, comme toute valeur hors liste', () => {
    for (const v of ['revoked', 'cancelled', '', 'SUBMITTED', ' submitted', 'submitted ', null, undefined, 0, true, {}, ['submitted']]) {
      expect(isMagicLinkBookable(v), JSON.stringify(v) ?? String(v)).toBe(false)
    }
  })

  it('TÉMOIN — chacun des cinq statuts vivants réserve, `submitted` compris (c’est là que la page propose le rendez-vous)', () => {
    for (const s of ['pending', 'opened', 'uploading', 'verifying', 'submitted']) {
      expect(isMagicLinkBookable(s), s).toBe(true)
    }
  })
})

describe('lireFormulaireBorne — la lecture compte les octets', () => {
  // Corps multipart écrit à la main : sous jsdom, un FormData de l'environnement n'est pas
  // reconnu par le Request de Node — en production (Deno), les deux sont les mêmes.
  const FRONTIERE = '----sonde-s10'
  const enc = new TextEncoder()
  function corpsMultipart(octets: number): Uint8Array {
    const tete = enc.encode(
      `--${FRONTIERE}\r\nContent-Disposition: form-data; name="type"\r\n\r\nid_front\r\n` +
      `--${FRONTIERE}\r\nContent-Disposition: form-data; name="file"; filename="piece.pdf"\r\n` +
      'Content-Type: application/pdf\r\n\r\n',
    )
    const fin = enc.encode(`\r\n--${FRONTIERE}--\r\n`)
    const tout = new Uint8Array(tete.length + octets + fin.length)
    tout.set(tete, 0)
    tout.fill(65, tete.length, tete.length + octets)
    tout.set(fin, tete.length + octets)
    return tout
  }
  // Un corps en FLUX, par morceaux de 16 Kio, SANS Content-Length : ce qu'une passerelle
  // peut transmettre.
  function requeteFlux(octets: number): Request {
    const corps = corpsMultipart(octets)
    const flux = new ReadableStream<Uint8Array>({
      start(c) {
        for (let i = 0; i < corps.length; i += 16 * 1024) c.enqueue(corps.slice(i, i + 16 * 1024))
        c.close()
      },
    })
    return new Request('https://exemple.test/upload', {
      method: 'POST',
      body: flux,
      headers: { 'content-type': `multipart/form-data; boundary=${FRONTIERE}` },
      duplex: 'half',
    } as RequestInit)
  }

  it('TÉMOIN — un formulaire sous le plafond est lu en entier, fichier compris', async () => {
    const lu = await lireFormulaireBorne(requeteFlux(2048), 64 * 1024)
    expect(lu).not.toBe('trop_grand')
    const fichier = (lu as FormData).get('file') as unknown as { size: number; name: string }
    expect(fichier.size).toBe(2048)
    expect(fichier.name).toBe('piece.pdf')
    expect((lu as FormData).get('type')).toBe('id_front')
  })

  it('au-delà du plafond, sans Content-Length : la lecture est coupée → « trop_grand »', async () => {
    expect(await lireFormulaireBorne(requeteFlux(200 * 1024), 64 * 1024)).toBe('trop_grand')
  })

  it('un corps qui n’est pas un formulaire jette (400 chez l’appelant), il ne passe pas pour vide', async () => {
    const r = new Request('https://exemple.test/upload', { method: 'POST', body: 'pas un formulaire', headers: { 'content-type': 'text/plain' } })
    await expect(lireFormulaireBorne(r, 64 * 1024)).rejects.toThrow()
  })
})
