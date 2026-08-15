// Vérification de signature Svix — le seul contrôle d'accès de `resend-webhook`.
//
// L'endpoint est public : si cette fonction se trompe, n'importe qui peut fabriquer un
// faux rebond, donc faire taire ou crier l'alerte à volonté. Les signatures ci-dessous
// sont CALCULÉES dans le test avec la même primitive que Svix (HMAC-SHA256 sur
// `{id}.{timestamp}.{corps}`, clé = base64 après `whsec_`), jamais recopiées d'une
// exécution : un test qui figerait la sortie du code qu'il vérifie ne prouverait rien.
import { describe, it, expect } from 'vitest'
import { verifySvixSignature, SVIX_TOLERANCE_SECONDS, type SvixHeaders } from './svix-signature'

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const ID = 'msg_2b3c4d5e'
const CORPS = '{"type":"email.bounced","data":{"email_id":"abc","to":["mort@example.ch"]}}'
const MAINTENANT = 1_755_264_000

/** Signe comme Svix, pour fabriquer un en-tête authentique dans le test. */
async function signer(id: string, ts: number, corps: string, secret = SECRET): Promise<string> {
  const brut = atob(secret.slice('whsec_'.length))
  const octets = new Uint8Array(brut.length)
  for (let i = 0; i < brut.length; i += 1) octets[i] = brut.charCodeAt(i)
  const key = await crypto.subtle.importKey('raw', octets, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${ts}.${corps}`))
  let binaire = ''
  for (const o of new Uint8Array(sig)) binaire += String.fromCharCode(o)
  return btoa(binaire)
}

const entetes = (over: Partial<SvixHeaders> = {}): SvixHeaders => ({
  id: ID, timestamp: String(MAINTENANT), signature: null, ...over,
})

describe('verifySvixSignature — accepte le vrai, refuse tout le reste', () => {
  it('signature authentique -> valide', async () => {
    const sig = await signer(ID, MAINTENANT, CORPS)
    const v = await verifySvixSignature(CORPS, entetes({ signature: `v1,${sig}` }), SECRET, MAINTENANT)
    expect(v.valid).toBe(true)
  })

  it('plusieurs signatures (rotation de secret) : une seule correspondance suffit', async () => {
    const bonne = await signer(ID, MAINTENANT, CORPS)
    const v = await verifySvixSignature(
      CORPS, entetes({ signature: `v1,ZmF1c3NlU2lnbmF0dXJl v1,${bonne}` }), SECRET, MAINTENANT,
    )
    expect(v.valid).toBe(true)
  })

  it('⛔ SANS SECRET : refuse, jamais d\'ouverture par omission', async () => {
    const sig = await signer(ID, MAINTENANT, CORPS)
    const v = await verifySvixSignature(CORPS, entetes({ signature: `v1,${sig}` }), undefined, MAINTENANT)
    expect(v).toEqual({ valid: false, reason: 'no_secret' })
  })

  it('⛔ corps modifié d\'un seul caractère -> refus', async () => {
    const sig = await signer(ID, MAINTENANT, CORPS)
    const altere = CORPS.replace('email.bounced', 'email.delivered')
    const v = await verifySvixSignature(altere, entetes({ signature: `v1,${sig}` }), SECRET, MAINTENANT)
    expect(v).toEqual({ valid: false, reason: 'no_match' })
  })

  it('⛔ signature d\'un AUTRE secret -> refus', async () => {
    const sig = await signer(ID, MAINTENANT, CORPS, 'whsec_YXV0cmVzZWNyZXRhdXRyZXNlY3JldA==')
    const v = await verifySvixSignature(CORPS, entetes({ signature: `v1,${sig}` }), SECRET, MAINTENANT)
    expect(v).toEqual({ valid: false, reason: 'no_match' })
  })

  it('⛔ rejeu hors fenêtre -> refus, avec contrôle négatif juste dedans', async () => {
    const sig = await signer(ID, MAINTENANT, CORPS)
    const h = entetes({ signature: `v1,${sig}` })
    // Juste à l'intérieur de la tolérance : accepté.
    expect((await verifySvixSignature(CORPS, h, SECRET, MAINTENANT + SVIX_TOLERANCE_SECONDS - 1)).valid).toBe(true)
    // Au-delà : refusé. Sans cette borne, un message intercepté resterait rejouable à vie.
    expect(await verifySvixSignature(CORPS, h, SECRET, MAINTENANT + SVIX_TOLERANCE_SECONDS + 1))
      .toEqual({ valid: false, reason: 'expired' })
  })

  it('⛔ en-têtes manquants ou horodatage non numérique -> refus', async () => {
    const sig = await signer(ID, MAINTENANT, CORPS)
    expect(await verifySvixSignature(CORPS, entetes({ signature: null }), SECRET, MAINTENANT))
      .toEqual({ valid: false, reason: 'missing_headers' })
    expect(await verifySvixSignature(CORPS, entetes({ id: null, signature: `v1,${sig}` }), SECRET, MAINTENANT))
      .toEqual({ valid: false, reason: 'missing_headers' })
    expect(await verifySvixSignature(CORPS, entetes({ timestamp: 'hier', signature: `v1,${sig}` }), SECRET, MAINTENANT))
      .toEqual({ valid: false, reason: 'bad_timestamp' })
  })

  it('⛔ une version de signature inconnue ne passe pas pour une v1', async () => {
    const sig = await signer(ID, MAINTENANT, CORPS)
    const v = await verifySvixSignature(CORPS, entetes({ signature: `v2,${sig}` }), SECRET, MAINTENANT)
    expect(v).toEqual({ valid: false, reason: 'no_match' })
  })
})
