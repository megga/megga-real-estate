// supabase/functions/_shared/mail/oauth.ts
// Flux code + PKCE pour Google et Microsoft (D1). Le `state` et le `code_verifier`
// sont générés ici et STOCKÉS PAR L'EDGE dans mail_oauth_states ; le navigateur ne
// voit que l'URL. PUR : `fetch` injectable, `crypto` WebCrypto (Node ≥ 20 et Deno).
import { base64UrlEncode } from './mime.ts'
import { GOOGLE_MAIL_SCOPE, MS_MAIL_SCOPE, MailAuthError } from './secrets.ts'

export type OAuthProvider = 'gmail' | 'outlook'
export interface OAuthDeps { fetch?: typeof fetch }

const PROVIDERS: Record<OAuthProvider, { authorize: string; token: string; scope: string; extra: Record<string, string> }> = {
  gmail: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    scope: GOOGLE_MAIL_SCOPE,
    // offline + consent : sans les deux, Google ne rend PAS de refresh_token à
    // une seconde autorisation du même compte.
    extra: { access_type: 'offline', prompt: 'consent', include_granted_scopes: 'false' },
  },
  outlook: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    scope: MS_MAIL_SCOPE,
    extra: { response_mode: 'query', prompt: 'select_account' },
  },
}

export function randomToken(bytes = 32): string {
  const b = new Uint8Array(bytes)
  crypto.getRandomValues(b)
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer)
  return base64UrlEncode(new Uint8Array(digest))
}

export function buildAuthorizeUrl(
  provider: OAuthProvider,
  a: { clientId: string; redirectUri: string; state: string; codeChallenge: string; loginHint?: string | null },
): string {
  const p = PROVIDERS[provider]
  const u = new URL(p.authorize)
  u.searchParams.set('client_id', a.clientId)
  u.searchParams.set('redirect_uri', a.redirectUri)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', p.scope)
  u.searchParams.set('state', a.state)
  u.searchParams.set('code_challenge', a.codeChallenge)
  u.searchParams.set('code_challenge_method', 'S256')
  if (a.loginHint) u.searchParams.set('login_hint', a.loginHint)
  for (const [k, v] of Object.entries(p.extra)) u.searchParams.set(k, v)
  return u.toString()
}

export async function exchangeCode(
  provider: OAuthProvider,
  a: { code: string; codeVerifier: string; clientId: string; clientSecret: string; redirectUri: string },
  deps: OAuthDeps = {},
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const f = deps.fetch ?? globalThis.fetch
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: a.code,
    code_verifier: a.codeVerifier,
    client_id: a.clientId,
    client_secret: a.clientSecret,
    redirect_uri: a.redirectUri,
  })
  if (provider === 'outlook') body.set('scope', PROVIDERS.outlook.scope)
  const res = await f(PROVIDERS[provider].token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new MailAuthError('provider_error', `${provider} token exchange: ${json.error ?? res.status} ${json.error_description ?? ''}`.trim())
  }
  if (!json.refresh_token) {
    throw new MailAuthError('provider_error', `${provider} token exchange: no refresh_token in response (consent screen skipped?)`)
  }
  return { access_token: json.access_token, refresh_token: json.refresh_token, expires_in: json.expires_in ?? 3600 }
}

/**
 * Codes d'un refus au point de jeton : RFC 6749 §5.2, plus les deux que Google et
 * Microsoft ajoutent. Une liste FERMÉE, parce que `json.error` est écrit par le
 * fournisseur et que seul ce qui figure ici peut atteindre le navigateur.
 */
const CODES_OAUTH = new Set([
  'invalid_request', 'invalid_client', 'invalid_grant', 'unauthorized_client',
  'unsupported_grant_type', 'invalid_scope', 'redirect_uri_mismatch', 'access_denied',
])

/**
 * Ce qu'on peut dire au navigateur d'un échec d'`exchangeCode` ou de `fetchIdentity` :
 * un code de `CODES_OAUTH`, `no_refresh_token`, `identity_failed`, sinon `provider_error`.
 *
 * ⛔ Jamais `error_description` (audit du 13.09.2026, S14) : texte libre du fournisseur,
 * où Microsoft glisse identifiant de trace, de corrélation et horodatage. `mail-oauth` le
 * rendait tel quel à l'écran ; il part désormais dans les journaux. Le code, lui, reste
 * utile : `invalid_client` dit « le secret ne correspond pas au client » sans rien
 * apprendre à personne.
 *
 * Lit les messages que CE module compose juste au-dessus — les tests passent par
 * `exchangeCode` lui-même, pour qu'un changement de libellé casse ici et pas en silence.
 */
export function oauthFailureCode(e: unknown): string {
  const message = e instanceof Error ? e.message : ''
  const code = /token exchange: ([a-z_]+)(?:\s|$)/.exec(message)?.[1]
  if (code && CODES_OAUTH.has(code)) return code
  if (message.includes('no refresh_token')) return 'no_refresh_token'
  if (/ identity: /.test(message)) return 'identity_failed'
  return 'provider_error'
}

export async function fetchIdentity(provider: OAuthProvider, accessToken: string, deps: OAuthDeps = {}): Promise<{ email: string; name: string | null }> {
  const f = deps.fetch ?? globalThis.fetch
  const url = provider === 'gmail' ? 'https://www.googleapis.com/oauth2/v3/userinfo' : 'https://graph.microsoft.com/v1.0/me'
  const res = await f(url, { headers: { Authorization: `Bearer ${accessToken}` } })
  if (!res.ok) throw new MailAuthError('provider_error', `${provider} identity: http ${res.status}`)
  const j = (await res.json()) as { email?: string; name?: string; mail?: string | null; userPrincipalName?: string; displayName?: string }
  const email = (provider === 'gmail' ? j.email : (j.mail ?? j.userPrincipalName)) ?? ''
  if (!email.includes('@')) throw new MailAuthError('provider_error', `${provider} identity: no email`)
  return { email: email.toLowerCase(), name: (provider === 'gmail' ? j.name : j.displayName) ?? null }
}

/**
 * Google révoque ; Microsoft n'a pas d'endpoint de révocation de jeton (on efface Vault).
 *
 * ⛔ L'ÉCHEC EST RENDU, PLUS AVALÉ. Le `.catch(() => undefined)` d'origine rendait
 * INVISIBLE un 400 ou un 500 de Google : l'utilisateur voyait « déconnectée », et
 * l'autorisation restait vivante chez Google — MEGGA gardant le droit de lire sa boîte.
 * `false` ⇒ l'appelant décide (garder la ligne pour pouvoir réessayer, prévenir), et
 * la raison est journalisée avec le compte.
 *
 * ⚠ SAUF `400 invalid_token` : Google rend cette réponse pour un jeton déjà révoqué ou
 * expiré (relevé le 13.09.2026 contre oauth2.googleapis.com : `{"error": "invalid_token"}`).
 * Il n'y a plus rien à révoquer, et le traiter en échec rendait la boîte INDÉCONNECTABLE —
 * précisément celles dont l'agent a déjà retiré l'accès chez Google, ou passées en
 * `reauth_required` —, et le compte qui la porte INSUPPRIMABLE (delete-account).
 */
export async function revokeToken(provider: OAuthProvider, token: string, deps: OAuthDeps = {}): Promise<boolean> {
  // Microsoft n'expose rien à révoquer : ce n'est pas un échec, il n'y a rien à faire.
  if (provider !== 'gmail') return true
  const f = deps.fetch ?? globalThis.fetch
  try {
    const res = await f(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' })
    if (res.ok) return true
    const texte = await res.text().catch(() => '')
    let code = ''
    try { code = String((JSON.parse(texte) as { error?: unknown }).error ?? '') } catch { /* corps non JSON : un vrai refus */ }
    if (res.status === 400 && code === 'invalid_token') return true
    console.error(`[mail oauth] révocation Google refusée: http ${res.status} ${texte.slice(0, 200)}`)
    return false
  } catch (e) {
    console.error('[mail oauth] révocation Google injoignable:', e instanceof Error ? e.message : String(e))
    return false
  }
}
