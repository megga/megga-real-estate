// Assertion JWT du compte de service — éprouvée SANS réseau et SANS secret.
//
// Le test génère sa propre paire de clés et VÉRIFIE la signature avec la clé publique :
// c'est ce qui distingue « le code produit trois segments » de « Google acceptera cette
// assertion ». Une assertion mal signée est refusée par Google avec un motif générique
// (`invalid_grant`), donc indiscernable d'une délégation manquante — d'où l'intérêt de
// trancher ici.

import { describe, it, expect } from 'vitest'
import {
  buildAssertionClaims,
  createAssertion,
  pemToPkcs8,
  CALENDAR_SCOPE,
} from './google-service-account'

/** Encode en PEM une clé PKCS#8 exportée, comme le fait le fichier de clé Google. */
function toPem(pkcs8: ArrayBuffer): string {
  const bytes = new Uint8Array(pkcs8)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  const body = btoa(binary).match(/.{1,64}/g)?.join('\n') ?? ''
  return `-----BEGIN PRIVATE KEY-----\n${body}\n-----END PRIVATE KEY-----\n`
}

async function generatePair() {
  const pair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', pair.privateKey)
  return { publicKey: pair.publicKey, pem: toPem(pkcs8) }
}

function decodeSegment(segment: string): Record<string, unknown> {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(padded + '='.repeat((4 - (padded.length % 4)) % 4)))
}

describe('assertion du compte de service', () => {
  it('porte la boîte usurpée dans `sub` — sans quoi le lien Meet est impossible', () => {
    const claims = buildAssertionClaims('sa@projet.iam.gserviceaccount.com', 'hello@megga.ai', CALENDAR_SCOPE, 1_700_000_000)
    expect(claims.iss).toBe('sa@projet.iam.gserviceaccount.com')
    expect(claims.sub).toBe('hello@megga.ai')
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token')
    expect(claims.scope).toBe('https://www.googleapis.com/auth/calendar')
    // Google refuse une assertion de plus d'une heure.
    expect((claims.exp as number) - (claims.iat as number)).toBe(3600)
  })

  it('signe une assertion que la clé publique valide', async () => {
    const { publicKey, pem } = await generatePair()
    const nowSec = 1_700_000_000

    const assertion = await createAssertion(
      { client_email: 'sa@projet.iam.gserviceaccount.com', private_key: pem },
      'hello@megga.ai',
      CALENDAR_SCOPE,
      nowSec,
    )

    const [header, payload, signature] = assertion.split('.')
    expect(decodeSegment(header)).toEqual({ alg: 'RS256', typ: 'JWT' })
    expect(decodeSegment(payload).sub).toBe('hello@megga.ai')

    const raw = atob(signature.replace(/-/g, '+').replace(/_/g, '/'))
    const sigBytes = new Uint8Array(raw.length)
    for (let i = 0; i < raw.length; i++) sigBytes[i] = raw.charCodeAt(i)

    const valid = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      publicKey,
      sigBytes,
      new TextEncoder().encode(`${header}.${payload}`),
    )
    expect(valid).toBe(true)
  })

  it('accepte une clé dont les sauts de ligne sont échappés', async () => {
    const { pem } = await generatePair()
    // Forme fréquente quand la clé est collée dans un secret : les \n sont littéraux.
    const escaped = pem.replace(/\n/g, '\\n')
    expect(new Uint8Array(pemToPkcs8(escaped))).toEqual(new Uint8Array(pemToPkcs8(pem)))
  })
})
