// supabase/functions/_shared/google-workspace.ts
//
// Jeton d'accès Google au nom d'une boîte Workspace de MEGGA, sans aucun humain dans
// la boucle. C'est le « compte de service + délégation à l'échelle du domaine » (DWD).
//
// POURQUOI PAS L'OAUTH DÉJÀ EN PLACE. `google_calendar_tokens` garde un jeton de
// rafraîchissement PAR UTILISATEUR DU CRM, obtenu quand un agent clique « connecter mon
// agenda ». Cette porte-là ne convient pas à une boîte de PLATEFORME : elle exigerait
// que la boîte des rendez-vous soit aussi un compte CRM, donc rattachée à une agence —
// un objet de tenant pour ce qui n'appartient à aucun tenant. Et le jour où la personne
// qui a cliqué s'en va, ou révoque l'accès depuis son compte Google, la prise de
// rendez-vous de toute la plateforme s'arrête sans prévenir.
//
// La délégation, elle, est accordée UNE FOIS dans la console d'administration Workspace,
// à un identifiant de client, pour une liste de portées figée. Elle ne dépend de personne,
// n'expire pas, et se retire au même endroit. C'est le montage prévu par Google pour
// exactement ce cas : un backend qui agit au nom d'une boîte du domaine.
//
// CE QUI EST DÉLIBÉRÉMENT ABSENT : aucun repli sur un compte de service NU (sans `sub`).
// Un compte de service sans délégation possède son propre agenda, vide, et Google lui
// refuse d'inviter le moindre participant. Écrire là-dedans « marcherait » — l'appel
// rendrait 200 — mais poserait le rendez-vous dans un agenda que personne ne regarde.
// Mieux vaut rendre `null` et laisser l'appelant le dire.

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const JWT_BEARER = 'urn:ietf:params:oauth:grant-type:jwt-bearer'

/**
 * Portée demandée. `calendar` en écriture complète, et rien d'autre : c'est le
 * minimum pour lire les occupations, poser l'événement et obtenir un lien Meet.
 *
 * ⚠ Cette chaîne doit être RECOPIÉE À L'IDENTIQUE dans la console d'administration
 * Workspace au moment d'autoriser la délégation. Google compare les portées
 * littéralement : une portée autorisée `calendar.events` ne couvre pas une demande
 * `calendar`, et l'échange échoue alors en `unauthorized_client` — un message qui ne
 * dit pas quelle portée manque.
 */
export const WORKSPACE_SCOPE = 'https://www.googleapis.com/auth/calendar'

/** Durée de vie demandée. Google plafonne à une heure, on ne cherche pas plus. */
const ASSERTION_TTL_S = 3600

/** Marge avant expiration, alignée sur le reste du dépôt. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000

interface ServiceAccountKey {
  client_email: string
  private_key: string
}

/**
 * Pourquoi l'échec est une VALEUR et non une exception : ces fonctions sont appelées
 * depuis le chemin de réservation, où rien de ce qui touche à l'agenda n'a le droit de
 * faire échouer le rendez-vous lui-même. L'appelant lit `reason` pour le journal, et
 * continue.
 */
export interface WorkspaceTokenResult {
  token: string | null
  /** Motif court, destiné au journal serveur et à l'écran de diagnostic. Jamais au client. */
  reason: string | null
}

/**
 * Motifs stables, pour que l'écran de diagnostic puisse dire quoi corriger plutôt que
 * de recracher le texte de Google.
 *
 * `unauthorized_client` est LE motif qu'on rencontre en pratique, et il a exactement
 * deux causes : la délégation n'a pas été accordée à cet identifiant de client, ou elle
 * l'a été avec une portée différente.
 */
export type WorkspaceFailure =
  | 'not_configured'
  | 'bad_key'
  | 'no_subject'
  | 'unauthorized_client'
  | 'invalid_grant'
  | 'network'
  | 'google_error'

// ── La clé ──────────────────────────────────────────────────────────────────

/**
 * Lit et valide la clé du compte de service.
 *
 * Accepte le JSON brut ET sa version base64. Ce n'est pas de la complaisance : le JSON
 * d'un compte de service contient une clé PEM, donc des sauts de ligne réels, et la
 * moitié des interfaces de gestion de secrets les mange en les collant. Un secret ainsi
 * abîmé échoue au SIGNAGE, plusieurs couches plus bas, avec une erreur de WebCrypto qui
 * ne dit rien de la cause. Accepter le base64 donne une forme qui ne peut pas s'abîmer.
 */
function readServiceAccount(): ServiceAccountKey | null {
  const raw = (Deno.env.get('GOOGLE_WORKSPACE_SA_KEY') ?? '').trim()
  if (!raw) return null

  let text = raw
  if (!text.startsWith('{')) {
    try {
      text = new TextDecoder().decode(
        Uint8Array.from(atob(text.replace(/\s/g, '')), (c) => c.charCodeAt(0)),
      )
    } catch {
      return null
    }
  }

  try {
    const parsed = JSON.parse(text) as Partial<ServiceAccountKey>
    if (!parsed.client_email || !parsed.private_key) return null
    // Un JSON re-sérialisé à la main porte souvent `\n` en deux caractères plutôt qu'un
    // saut de ligne. Le PEM est alors syntaxiquement faux et `importKey` le refuse.
    const privateKey = parsed.private_key.includes('\\n')
      ? parsed.private_key.replace(/\\n/g, '\n')
      : parsed.private_key
    return { client_email: parsed.client_email, private_key: privateKey }
  } catch {
    return null
  }
}

/** Vrai quand la plateforme porte une clé de compte de service exploitable. */
export function workspaceConfigured(): boolean {
  return readServiceAccount() !== null
}

/** Adresse du compte de service, à recopier dans la console Workspace. Jamais un secret. */
export function workspaceClientEmail(): string | null {
  return readServiceAccount()?.client_email ?? null
}

// ── Signature ───────────────────────────────────────────────────────────────

function base64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlText(text: string): string {
  return base64url(new TextEncoder().encode(text))
}

/** PEM PKCS#8 → clé de signature RS256. */
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

/** Assertion JWT signée, `sub` portant la boîte à incarner. */
async function buildAssertion(key: ServiceAccountKey, subject: string): Promise<string> {
  const nowS = Math.floor(Date.now() / 1000)
  const header = base64urlText(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64urlText(JSON.stringify({
    iss: key.client_email,
    // C'est CE champ qui fait toute la délégation : sans lui, Google délivre un jeton
    // pour le compte de service lui-même, dont l'agenda n'intéresse personne.
    sub: subject,
    scope: WORKSPACE_SCOPE,
    aud: TOKEN_URL,
    iat: nowS,
    exp: nowS + ASSERTION_TTL_S,
  }))
  const signed = `${header}.${claims}`
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    await importPrivateKey(key.private_key),
    new TextEncoder().encode(signed),
  )
  return `${signed}.${base64url(new Uint8Array(signature))}`
}

// ── Le jeton ────────────────────────────────────────────────────────────────

/**
 * Cache par boîte, en mémoire d'instance.
 *
 * Une instance d'edge function sert plusieurs requêtes, et le calcul des créneaux
 * interroge l'agenda à chaque ouverture de l'écran de réservation. Sans ce cache, chaque
 * ouverture paierait une signature RSA et un aller-retour chez Google avant même de
 * commencer à lire l'agenda. Le cache disparaît avec l'instance, ce qui est très bien :
 * il n'a pas à survivre, seulement à éviter la rafale.
 */
const tokenCache = new Map<string, { token: string; expiresAtMs: number }>()

/**
 * Jeton d'accès au nom de `subject`.
 *
 * Ne lève jamais. Rend `{ token: null, reason }` : l'appelant décide quoi faire d'un
 * agenda injoignable, et cette décision n'est pas la même selon qu'on affiche des
 * créneaux (il faut alors écarter l'hôte) ou qu'on pose un événement (le rendez-vous
 * est déjà pris, on ne le perd pas pour autant).
 */
export async function workspaceAccessToken(subject: string): Promise<WorkspaceTokenResult> {
  const mailbox = subject.trim().toLowerCase()
  if (!mailbox) return { token: null, reason: 'no_subject' satisfies WorkspaceFailure }

  const key = readServiceAccount()
  if (!key) return { token: null, reason: 'not_configured' satisfies WorkspaceFailure }

  const cached = tokenCache.get(mailbox)
  if (cached && cached.expiresAtMs - Date.now() > REFRESH_BUFFER_MS) {
    return { token: cached.token, reason: null }
  }

  let assertion: string
  try {
    assertion = await buildAssertion(key, mailbox)
  } catch {
    // Signature impossible : la clé PEM est abîmée. Rien ne se répare en réessayant.
    return { token: null, reason: 'bad_key' satisfies WorkspaceFailure }
  }

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: JWT_BEARER, assertion }),
  }).catch(() => null)

  if (!res) return { token: null, reason: 'network' satisfies WorkspaceFailure }

  const data = await res.json().catch(() => null) as
    | { access_token?: string; expires_in?: number; error?: string; error_description?: string }
    | null

  if (!res.ok || !data?.access_token) {
    // Les deux erreurs de configuration réelles portent un nom chez Google, et on le
    // garde tel quel : `unauthorized_client` (délégation absente ou portée qui ne
    // correspond pas) et `invalid_grant` (la boîte incarnée n'existe pas dans le
    // domaine, ou est suspendue). Tout le reste devient `google_error`.
    const code = data?.error === 'unauthorized_client' || data?.error === 'invalid_grant'
      ? data.error
      : 'google_error'
    console.error('[google-workspace] token exchange refused', {
      mailbox,
      status: res.status,
      error: data?.error ?? null,
      description: data?.error_description ?? null,
    })
    return { token: null, reason: code }
  }

  const expiresAtMs = Date.now() + (data.expires_in ?? ASSERTION_TTL_S) * 1000
  tokenCache.set(mailbox, { token: data.access_token, expiresAtMs })
  return { token: data.access_token, reason: null }
}

/**
 * Vérifie que la chaîne entière tient, du bout d'où on ne peut pas se mentir : on
 * demande à Google l'agenda principal de la boîte.
 *
 * Obtenir un jeton ne prouve pas grand-chose — la délégation peut être accordée pour la
 * bonne portée et la boîte n'avoir aucun agenda accessible. Un aller-retour réel sur
 * `calendars/primary` est la seule réponse honnête à « est-ce que ça marche ? », et
 * c'est ce que l'écran de diagnostic de la console affiche.
 */
export async function probeWorkspaceCalendar(subject: string): Promise<{
  ok: boolean
  reason: string | null
  /** Fuseau déclaré de l'agenda, utile pour préremplir l'hôte sans le demander. */
  timezone: string | null
  calendarId: string | null
}> {
  const { token, reason } = await workspaceAccessToken(subject)
  if (!token) return { ok: false, reason, timezone: null, calendarId: null }

  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)

  if (!res) return { ok: false, reason: 'network', timezone: null, calendarId: null }
  if (!res.ok) {
    console.error('[google-workspace] probe refused', { subject, status: res.status })
    // 403 ici, avec un jeton valide, veut dire que l'API Calendar n'est pas activée sur
    // le projet Google Cloud du compte de service. C'est une case à cocher distincte de
    // la délégation, et celle qu'on oublie.
    return {
      ok: false,
      reason: res.status === 403 ? 'calendar_api_disabled' : 'google_error',
      timezone: null,
      calendarId: null,
    }
  }

  const data = await res.json().catch(() => null) as
    | { id?: string; timeZone?: string }
    | null
  return {
    ok: true,
    reason: null,
    timezone: data?.timeZone ?? null,
    calendarId: data?.id ?? null,
  }
}
