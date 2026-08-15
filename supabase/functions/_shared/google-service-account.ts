// supabase/functions/_shared/google-service-account.ts
//
// Jeton d'accès Google obtenu par COMPTE DE SERVICE, en usurpant une boîte Workspace
// (délégation à l'échelle du domaine).
//
// POURQUOI CETTE VOIE À CÔTÉ DE L'OAUTH UTILISATEUR. L'agenda des appels d'accueil est
// celui de l'ENTREPRISE (hello@megga.ai), pas celui d'une personne. Un jeton OAuth
// utilisateur en fait dépendre le fonctionnement d'un consentement individuel : il se
// révoque au changement de mot de passe, expire tous les 7 jours tant que l'écran de
// consentement n'est pas publié, et disparaît le jour où la personne quitte MEGGA. Le
// compte de service ne dépend de personne.
//
// ⚠ L'USURPATION (`sub`) N'EST PAS UN DÉTAIL — c'est elle qui rend le lien Meet possible.
// Un compte de service qui écrit dans un agenda simplement PARTAGÉ avec lui n'a pas le
// droit de créer une visioconférence : Google exige un utilisateur organisateur. En
// usurpant `hello@megga.ai`, l'événement est créé PAR cette boîte, donc `conferenceData`
// aboutit et `calendars/primary` désigne bien son agenda.
//
// PRÉALABLE HORS DÉPÔT, sans lequel tout échoue en `unauthorized_client` : la délégation
// doit être accordée dans la console d'administration Workspace (Sécurité › Contrôle des
// API › Délégation à l'échelle du domaine) au client OAuth du compte de service, avec le
// scope ci-dessous et lui seul.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

/** Le moindre privilège qui permette lire + écrire + créer une visioconférence. */
export const CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'

/** Marge avant expiration, alignée sur les jetons utilisateur de `host-freebusy`. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

/** Durée de vie demandée pour l'assertion. Google refuse au-delà d'une heure. */
const ASSERTION_TTL_SEC = 3600

/** Champs de la clé JSON dont on se sert ; le fichier en contient davantage. */
export interface ServiceAccountKey {
  client_email: string
  private_key: string
}

/** Jetons déjà obtenus, par boîte usurpée. Une invocation sert plusieurs hôtes. */
const cache = new Map<string, { token: string; expiresAtMs: number }>()

function b64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Corps DER d'une clé privée PEM (PKCS#8).
 *
 * ⚠ Le dépliage des blancs n'est pas cosmétique : selon la façon dont la clé a été
 * collée dans le secret, les sauts de ligne sont réels ou échappés, et `atob` rejette
 * tout caractère hors alphabet base64.
 *
 * Rend un `ArrayBuffer` et non un `Uint8Array` : depuis que TypeScript paramètre les
 * tableaux typés par leur tampon, un `Uint8Array<ArrayBufferLike>` n'est plus accepté
 * comme `BufferSource` par `importKey` (erreur relevée par `deno check`, invisible à
 * `tsc -b` qui ne couvre que `src/`).
 */
export function pemToPkcs8(pem: string): ArrayBuffer {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const buffer = new ArrayBuffer(binary.length)
  const bytes = new Uint8Array(buffer)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return buffer
}

/**
 * Revendications de l'assertion. Extraite pour être éprouvée sans réseau ni secret.
 *
 * `sub` porte la boîte usurpée : sans lui, le jeton vaut pour le compte de service
 * lui-même, dont l'agenda est vide et qui ne sait pas créer de visioconférence.
 */
export function buildAssertionClaims(
  clientEmail: string,
  subject: string,
  scope: string,
  nowSec: number,
): Record<string, string | number> {
  return {
    iss: clientEmail,
    sub: subject,
    scope,
    aud: TOKEN_URL,
    iat: nowSec,
    exp: nowSec + ASSERTION_TTL_SEC,
  }
}

/** Assertion JWT signée RS256, prête à être échangée contre un jeton d'accès. */
export async function createAssertion(
  key: ServiceAccountKey,
  subject: string,
  scope: string,
  nowSec: number,
): Promise<string> {
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(JSON.stringify(buildAssertionClaims(key.client_email, subject, scope, nowSec)))
  const signingInput = `${header}.${claims}`

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8(key.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput),
  )

  return `${signingInput}.${b64url(new Uint8Array(signature))}`
}

/** La clé du secret, ou `null` s'il est absent ou illisible. */
function readKey(): ServiceAccountKey | null {
  const raw = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_KEY')
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccountKey>
    if (!parsed.client_email || !parsed.private_key) {
      console.error('[google-service-account] clé incomplète (client_email/private_key)')
      return null
    }
    return { client_email: parsed.client_email, private_key: parsed.private_key }
  } catch {
    // Le contenu n'est jamais journalisé : c'est une clé privée.
    console.error('[google-service-account] GOOGLE_SERVICE_ACCOUNT_KEY n est pas du JSON')
    return null
  }
}

/**
 * Jeton d'accès pour la boîte demandée, ou `null`.
 *
 * Ne lève jamais : l'appelant décide quoi faire d'un agenda injoignable, et cette
 * décision n'est pas la même pour une lecture (écarter l'hôte) et pour une écriture
 * (réserver quand même, sans écho d'agenda).
 */
export async function serviceAccountAccessToken(subject: string): Promise<string | null> {
  const cached = cache.get(subject)
  if (cached && cached.expiresAtMs - Date.now() > REFRESH_BUFFER_MS) return cached.token

  const key = readKey()
  if (!key) return null

  let assertion: string
  try {
    assertion = await createAssertion(key, subject, CALENDAR_SCOPE, Math.floor(Date.now() / 1000))
  } catch (error) {
    console.error('[google-service-account] signature impossible', (error as Error)?.name)
    return null
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: JWT_BEARER, assertion }),
  }).catch(() => null)

  if (!res || !res.ok) {
    // `unauthorized_client` = la délégation n'est pas accordée côté Workspace pour ce
    // client et ce scope. C'est LA panne attendue tant que l'étape d'administration
    // n'est pas faite : on la nomme, sinon elle se diagnostique en heures.
    const detail = res ? await res.text().catch(() => '') : 'réseau'
    console.error(`[google-service-account] jeton refusé pour ${subject}: ${detail.slice(0, 300)}`)
    cache.delete(subject)
    return null
  }

  const data = await res.json().catch(() => null)
  if (!data?.access_token) return null

  cache.set(subject, {
    token: data.access_token,
    expiresAtMs: Date.now() + (data.expires_in ?? 3600) * 1000,
  })
  return data.access_token
}
