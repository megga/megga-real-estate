// supabase/functions/_shared/mail/oauth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { randomToken, pkceChallenge, buildAuthorizeUrl, exchangeCode, fetchIdentity, revokeToken } from './oauth.ts'

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
  const common = { clientId: 'cid', redirectUri: 'https://app.megga.ch/oauth/mail/callback', state: 'st', codeChallenge: 'ch', loginHint: 'g@ex.ch' }
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
      expect(b).toContain('redirect_uri=https%3A%2F%2Fapp.megga.ch%2Foauth%2Fmail%2Fcallback')
      return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 }), { status: 200 })
    })
    const r = await exchangeCode('gmail', { code: 'abc', codeVerifier: 'ver', clientId: 'cid', clientSecret: 's', redirectUri: 'https://app.megga.ch/oauth/mail/callback' }, { fetch: F(fetch) })
    expect(r).toEqual({ access_token: 'at', refresh_token: 'rt', expires_in: 3599 })
  })
  it('sans refresh_token (consentement réutilisé) : erreur explicite', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ access_token: 'at', expires_in: 3599 }), { status: 200 }))
    await expect(exchangeCode('gmail', { code: 'abc', codeVerifier: 'v', clientId: 'c', clientSecret: 's', redirectUri: 'r' }, { fetch: F(fetch) }))
      .rejects.toThrow(/refresh_token/)
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
    const fetch = vi.fn(async () => new Response('{"error":"invalid_token"}', { status: 400 }))
    expect(await revokeToken('gmail', 'rt-1', { fetch: F(fetch) })).toBe(false)
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
