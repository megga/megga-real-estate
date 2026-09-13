// supabase/functions/_shared/mail/oauth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { randomToken, pkceChallenge, buildAuthorizeUrl, exchangeCode, fetchIdentity, revokeToken, oauthFailureCode } from './oauth.ts'

const F = (fn: (url: string, init?: RequestInit) => Promise<Response>) => fn as unknown as typeof globalThis.fetch

describe('PKCE', () => {
  it('randomToken rend de l hex de la longueur demandée', () => {
    expect(randomToken(32)).toMatch(/^[0-9a-f]{64}$/)
    expect(randomToken(32)).not.toBe(randomToken(32))
  })
  it('challenge S256 = base64url(sha256(verifier)) — vecteur RFC 7636 annexe B', async () => {
    expect(await pkceChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'))
      .toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
  })
})

describe('buildAuthorizeUrl', () => {
  const common = { clientId: 'cid', redirectUri: 'https://app.getmegga.com/oauth/mail/callback', state: 'st', codeChallenge: 'ch', loginHint: 'g@ex.ch' }
  it('Google : offline + consent + gmail.modify', () => {
    const u = new URL(buildAuthorizeUrl('gmail', common))
    expect(u.origin + u.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(u.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/gmail.modify openid email')
    expect(u.searchParams.get('access_type')).toBe('offline')
    expect(u.searchParams.get('prompt')).toBe('consent')
    expect(u.searchParams.get('code_challenge_method')).toBe('S256')
    expect(u.searchParams.get('login_hint')).toBe('g@ex.ch')
    expect(u.searchParams.get('state')).toBe('st')
  })
  it('Microsoft : scopes délégués mail', () => {
    const u = new URL(buildAuthorizeUrl('outlook', common))
    expect(u.origin + u.pathname).toBe('https://login.microsoftonline.com/common/oauth2/v2.0/authorize')
    expect(u.searchParams.get('scope')).toBe('offline_access User.Read Mail.ReadWrite Mail.Send')
    expect(u.searchParams.get('response_mode')).toBe('query')
  })
})

describe('exchangeCode', () => {
  it('envoie code + verifier + redirect_uri et rend les jetons', async () => {
    const fetch = vi.fn(async (_u: string, init?: RequestInit) => {
      const b = String(init?.body)
      expect(b).toContain('grant_type=authorization_code')
      expect(b).toContain('code=abc')
      expect(b).toContain('code_verifier=ver')
      expect(b).toContain('redirect_uri=https%3A%2F%2Fapp.getmegga.com%2Foauth%2Fmail%2Fcallback')
      return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 }), { status: 200 })
    })
    const r = await exchangeCode('gmail', { code: 'abc', codeVerifier: 'ver', clientId: 'cid', clientSecret: 's', redirectUri: 'https://app.getmegga.com/oauth/mail/callback' }, { fetch: F(fetch) })
    expect(r).toEqual({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 })
  })
  it('sans refresh_token (consentement réutilisé) : erreur explicite', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'at', expires_in: 3599 }), { status: 200 }))
    await expect(exchangeCode('gmail', { code: 'abc', codeVerifier: 'v', clientId: 'c', clientSecret: 's', redirectUri: 'r' }, { fetch: F(fetch) }))
      .rejects.toThrow(/refresh_token/)
  })
})

// ⛔ S14 (13.09.2026) : `mail-oauth` rendait le message entier à l'écran, `error_description`
// compris. Les échecs passent ici par les VRAIES fonctions, pour qu'un libellé modifié dans
// `exchangeCode` casse ce test au lieu de rendre `provider_error` en silence.
describe('oauthFailureCode', () => {
  const echange = (reponse: () => Promise<Response>) =>
    exchangeCode('outlook', { code: 'c', codeVerifier: 'v', clientId: 'id', clientSecret: 's', redirectUri: 'r' }, { fetch: F(reponse) })
      .then(() => null, (e: unknown) => e)

  it('garde le code normalisé, jamais la description libre du fournisseur', async () => {
    const description = 'AADSTS54005: OAuth2 Authorization code was already redeemed. Trace ID: 4f1c Correlation ID: 9a2b Timestamp: 2026-09-13 10:00:00Z'
    const e = await echange(async () => new Response(JSON.stringify({ error: 'invalid_grant', error_description: description }), { status: 400 }))
    // Le journal garde tout — c'est lui qu'on lit pour diagnostiquer…
    expect((e as Error).message).toContain('AADSTS54005')
    // … le navigateur ne reçoit que le code.
    expect(oauthFailureCode(e)).toBe('invalid_grant')
  })

  it('un code hors de la liste fermée devient `provider_error`', async () => {
    const e = await echange(async () => new Response(JSON.stringify({ error: 'x<script>', error_description: 'y' }), { status: 400 }))
    expect(oauthFailureCode(e)).toBe('provider_error')
    const sansCode = await echange(async () => new Response('Bad Gateway', { status: 502 }))
    expect(oauthFailureCode(sansCode)).toBe('provider_error')
  })

  it('nomme le consentement réutilisé et l’identité illisible', async () => {
    const e = await echange(async () => new Response(JSON.stringify({ access_token: 'at', expires_in: 3599 }), { status: 200 }))
    expect(oauthFailureCode(e)).toBe('no_refresh_token')
    const identite = await fetchIdentity('gmail', 'at', { fetch: F(async () => new Response('{}', { status: 403 })) })
      .then(() => null, (err: unknown) => err)
    expect(oauthFailureCode(identite)).toBe('identity_failed')
  })

  it('une panne réseau ne sort que sous `provider_error`', async () => {
    const e = await echange(async () => { throw new TypeError('error sending request for url (https://login.microsoftonline.com/…): connection reset') })
    expect(oauthFailureCode(e)).toBe('provider_error')
  })
})

describe('fetchIdentity', () => {
  it('Google : userinfo → email + name', async () => {
    const fetch = vi.fn(async (u: string) => {
      expect(u).toBe('https://www.googleapis.com/oauth2/v3/userinfo')
      return new Response(JSON.stringify({ email: 'G@Ex.ch', name: 'Greg' }), { status: 200 })
    })
    expect(await fetchIdentity('gmail', 'at', { fetch: F(fetch) })).toEqual({ email: 'g@ex.ch', name: 'Greg' })
  })
  it('Microsoft : /me → mail sinon userPrincipalName', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ mail: null, userPrincipalName: 'x@Outlook.com', displayName: 'X' }), { status: 200 }))
    expect(await fetchIdentity('outlook', 'at', { fetch: F(fetch) })).toEqual({ email: 'x@outlook.com', name: 'X' })
  })
})

// ⛔ La révocation était un `.catch(() => undefined)` MUET : un refus de Google restait
// invisible, l'utilisateur lisait « déconnectée » et l'autorisation vivait toujours.
describe('revokeToken', () => {
  it('révocation acceptée ⇒ true', async () => {
    const fetch = vi.fn(async (u: string, init?: RequestInit) => {
      expect(u).toContain('https://oauth2.googleapis.com/revoke?token=rt-1')
      expect(init?.method).toBe('POST')
      return new Response(null, { status: 200 })
    })
    expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) })).toBe(true)
  })
  it('refus du fournisseur ⇒ false, pas un succès silencieux', async () => {
    for (const [statut, corps] of [[400, '{"error":"invalid_request"}'], [400, 'Bad Request'], [503, '{"error":"invalid_token"}'], [500, '']] as const) {
      const fetch = vi.fn(async () => new Response(corps, { status: statut }))
      expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) }), `${statut} ${corps}`).toBe(false)
    }
  })
  // ⛔ Jeton déjà révoqué (l'agent a retiré l'accès depuis son compte Google) ou expiré :
  // Google répond `400 {"error": "invalid_token"}` — relevé contre le vrai endpoint le
  // 13.09.2026. En échec, la boîte ne se déconnectait plus, et son compte ne se supprimait plus.
  it('400 invalid_token ⇒ true : il n y a plus rien à révoquer', async () => {
    const fetch = vi.fn(async () => new Response('{\n  "error": "invalid_token"\n}', { status: 400 }))
    expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) })).toBe(true)
  })
  it('réseau injoignable ⇒ false, jamais une exception qui remonte au milieu d une déconnexion', async () => {
    const fetch = vi.fn(async () => { throw new Error('ECONNRESET') })
    expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) })).toBe(false)
  })
  it('Microsoft n a rien à révoquer : true, et AUCUN appel réseau', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 200 }))
    expect(await revokeToken('outlook', 'rt-1', { fetch: F(fetch) })).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })
})
