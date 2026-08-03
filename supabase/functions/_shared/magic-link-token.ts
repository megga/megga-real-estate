// supabase/functions/_shared/magic-link-token.ts
// HMAC-SHA256 sign/verify pour les tokens publics du lien magique KYC (Sprint 4.7.A).
//
// Format token : <base64url(payload)>.<base64url(signature)>
//   payload : JSON { id: string, exp: number (unix seconds) }
//   signature : HMAC-SHA256(payload, MEGGA_MAGIC_LINK_HMAC_SECRET)
//
// Le payload ne contient JAMAIS dossier_id ni contact_id — uniquement le
// magic_link.id (UUID). Le serveur résout via le DB en respectant la sig.

export interface MagicLinkTokenPayload {
  id: string
  exp: number
  /** Optionnel : profile id de l'agent demandeur (rapport KYC PDF par WhatsApp).
   *  Survit au round-trip JSON ; non requis par les usages magic-link existants. */
  p?: string
  /**
   * Optionnel : NATURE de l'objet désigné par `id`.
   *
   * Le payload ne portait qu'un `id` opaque, si bien que deux familles de liens
   * signés par le même secret étaient formellement interchangeables : rien dans
   * le jeton ne disait si l'`id` désignait un lien magique KYC ou un rendez-vous.
   * En pratique la confusion échoue (les UUID ne se rencontrent pas d'une table à
   * l'autre), mais s'appuyer sur l'absence de collision n'est pas un contrôle
   * d'autorisation. `k` rend l'intention explicite et vérifiable.
   *
   * Absent = lien magique KYC — la valeur historique, préservée pour que les
   * jetons déjà en circulation restent valides.
   */
  k?: 'appt'
}

const enc = new TextEncoder()
const dec = new TextDecoder()

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4))
  const b64 = (str + pad).replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

/**
 * Signe un payload { id, exp } et retourne un token URL-safe.
 *
 * @throws si MEGGA_MAGIC_LINK_HMAC_SECRET n'est pas configuré (>= 32 chars).
 */
export async function signMagicLinkToken(payload: MagicLinkTokenPayload): Promise<string> {
  const secret = Deno.env.get('MEGGA_MAGIC_LINK_HMAC_SECRET') ?? ''
  if (secret.length < 32) {
    throw new Error('MEGGA_MAGIC_LINK_HMAC_SECRET missing or too short (>=32 chars required)')
  }
  const key = await importKey(secret)
  const payloadJson = JSON.stringify(payload)
  const payloadB64 = base64UrlEncode(enc.encode(payloadJson))
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64))
  )
  const sigB64 = base64UrlEncode(sigBytes)
  return `${payloadB64}.${sigB64}`
}

export interface MagicLinkVerifyResult {
  valid: boolean
  reason?: 'malformed' | 'invalid_signature' | 'expired' | 'no_secret'
  payload?: MagicLinkTokenPayload
}

/**
 * Vérifie un token : signature + expiration. Retourne le payload si OK.
 * Ne fait AUCUNE requête DB — c'est juste la vérification crypto.
 */
export async function verifyMagicLinkToken(token: string): Promise<MagicLinkVerifyResult> {
  const secret = Deno.env.get('MEGGA_MAGIC_LINK_HMAC_SECRET') ?? ''
  if (secret.length < 32) {
    return { valid: false, reason: 'no_secret' }
  }

  const parts = token.split('.')
  if (parts.length !== 2) {
    return { valid: false, reason: 'malformed' }
  }
  const [payloadB64, sigB64] = parts

  try {
    const key = await importKey(secret)
    const sigBytes = base64UrlDecode(sigB64)
    // Cast BufferSource : le typage Deno récent de Uint8Array<ArrayBufferLike> ne s'assigne
    // pas directement au paramètre signature (même convention que whatsapp-actions, OCR).
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes as unknown as BufferSource, enc.encode(payloadB64))
    if (!ok) return { valid: false, reason: 'invalid_signature' }

    const payloadJson = dec.decode(base64UrlDecode(payloadB64))
    const payload = JSON.parse(payloadJson) as MagicLinkTokenPayload

    if (typeof payload.id !== 'string' || typeof payload.exp !== 'number') {
      return { valid: false, reason: 'malformed' }
    }

    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return { valid: false, reason: 'expired', payload }
    }

    return { valid: true, payload }
  } catch {
    return { valid: false, reason: 'malformed' }
  }
}

/** Calcule la date d'expiration ISO à partir d'un nombre de jours. */
export function expiryFromDays(days: number): { iso: string; unix: number } {
  const ms = Date.now() + days * 24 * 60 * 60 * 1000
  return {
    iso: new Date(ms).toISOString(),
    unix: Math.floor(ms / 1000),
  }
}
