// supabase/functions/_shared/svix-signature.ts
//
// Vérification de la signature Svix, celle que Resend pose sur ses webhooks.
//
// POURQUOI UN MODULE À PART, ET PUR. L'endpoint est PUBLIC (verify_jwt=false, comme les
// trois webhooks existants) : c'est la signature qui tient lieu d'authentification, et
// rien d'autre. Isolée ici, elle s'éprouve sans réseau ni base, avec des vecteurs connus.
//
// Le contrat Svix (https://docs.svix.com/receiving/verifying-payloads) :
//   · en-têtes `svix-id`, `svix-timestamp`, `svix-signature`
//   · contenu signé = `{id}.{timestamp}.{corps brut}` — le corps EXACT reçu, jamais un
//     JSON re-sérialisé : `JSON.parse` puis `JSON.stringify` réordonne les clés et change
//     l'empreinte, ce qui ferait échouer toute vérification pour une bonne requête
//   · secret = `whsec_<base64>` ; SEULE la partie après le préfixe est la clé
//   · `svix-signature` peut porter PLUSIEURS signatures séparées par des espaces
//     (`v1,<b64> v1,<b64>`), pendant une rotation de secret : il suffit qu'UNE corresponde

import { timingSafeEqual } from './esign-gateway.ts'

/**
 * Tolérance sur l'horodatage. Sans elle, un message intercepté resterait rejouable pour
 * toujours : la signature d'un corps donné ne périme pas d'elle-même.
 */
export const SVIX_TOLERANCE_SECONDS = 5 * 60

export type SvixVerdict =
  | { valid: true }
  | { valid: false; reason: 'no_secret' | 'missing_headers' | 'bad_timestamp' | 'expired' | 'no_match' }

export interface SvixHeaders {
  id: string | null
  timestamp: string | null
  signature: string | null
}

/** Lit les trois en-têtes Svix d'une requête. */
export function readSvixHeaders(req: Request): SvixHeaders {
  return {
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary)
}

/**
 * Vérifie la signature d'un webhook Svix.
 *
 * `nowSeconds` est un paramètre et non `Date.now()` : c'est ce qui rend la fenêtre de
 * rejeu testable sans figer l'horloge du processus.
 *
 * Rend un MOTIF en cas d'échec, pour le journal côté serveur uniquement. ⚠ Ne jamais le
 * renvoyer à l'appelant : il renseignerait un tiers sur la configuration (secret posé ou
 * non), exactement la fuite que la PR #1114 a fermée sur les liens magiques.
 */
export async function verifySvixSignature(
  rawBody: string,
  headers: SvixHeaders,
  secret: string | undefined,
  nowSeconds: number,
): Promise<SvixVerdict> {
  if (!secret || !secret.startsWith('whsec_') || secret.length < 12) {
    return { valid: false, reason: 'no_secret' }
  }
  if (!headers.id || !headers.timestamp || !headers.signature) {
    return { valid: false, reason: 'missing_headers' }
  }

  const envoye = Number(headers.timestamp)
  if (!Number.isFinite(envoye)) return { valid: false, reason: 'bad_timestamp' }
  if (Math.abs(nowSeconds - envoye) > SVIX_TOLERANCE_SECONDS) return { valid: false, reason: 'expired' }

  const key = await crypto.subtle.importKey(
    'raw',
    base64ToBytes(secret.slice('whsec_'.length)) as unknown as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signe = `${headers.id}.${headers.timestamp}.${rawBody}`
  const attendu = bytesToBase64(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signe)))

  // Plusieurs signatures possibles pendant une rotation : une seule doit correspondre.
  // On parcourt TOUT le lot même après une correspondance — sortir au premier succès
  // rendrait le temps d'exécution dépendant de la position, ce que `timingSafeEqual`
  // s'applique justement à éviter au niveau de l'octet.
  let trouve = false
  for (const partie of headers.signature.split(' ')) {
    const [version, valeur] = partie.split(',')
    if (version !== 'v1' || !valeur) continue
    if (timingSafeEqual(valeur, attendu)) trouve = true
  }

  return trouve ? { valid: true } : { valid: false, reason: 'no_match' }
}
