/**
 * Jetons de fournisseur Google/Microsoft : jamais dans le stockage du navigateur
 * (src/lib/authStorage.ts), éprouvé contre le VRAI auth-js.
 *
 * Contrôle positif d'abord : le même retour de liaison, rangé par un stockage
 * qui ne filtre rien, CONTIENT le jeton de rafraîchissement du fournisseur. Si
 * une version future d'auth-js cessait de le ranger, ce contrôle rougirait — et
 * le correctif serait à réévaluer, au lieu de passer au vert pour rien.
 *
 * Stockages injectés en mémoire, jamais `window.localStorage` : sous Node 26, le
 * webstorage de Node masque celui de jsdom (CI : Node 22) — un test qui s'y fie
 * passe à un endroit et casse à l'autre.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  createAuthStorage,
  scrubStoredProviderTokens,
  sessionSansJetonsFournisseur,
  takeCalendarProviderTokens,
  REMEMBER_KEY,
  type AuthStorage,
} from '@/lib/authStorage'
import type { Session } from '@supabase/supabase-js'

/** Stockage en mémoire conforme à l'interface Storage. */
class Memoire implements Storage {
  private m = new Map<string, string>()
  get length() { return this.m.size }
  clear() { this.m.clear() }
  getItem(k: string) { return this.m.has(k) ? (this.m.get(k) as string) : null }
  key(i: number) { return [...this.m.keys()][i] ?? null }
  removeItem(k: string) { this.m.delete(k) }
  setItem(k: string, v: string) { this.m.set(k, String(v)) }
  /** Tout le contenu, pour chercher un jeton quelle que soit la clé. */
  vider() { return JSON.stringify([...this.m.entries()]) }
}

const URL_PROJET = 'https://abcdefghijklmnopqrst.supabase.co'
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
// JWT non signé : auth-js ne vérifie pas la signature, il appelle /auth/v1/user.
const JWT = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u-1', aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.x`
const UTILISATEUR = { id: 'u-1', aud: 'authenticated', role: 'authenticated', email: 'agent@example.org', app_metadata: {}, user_metadata: {}, created_at: '2026-09-13T00:00:00Z' }
const FRAGMENT = `access_token=${JWT}&refresh_token=RT_T&expires_in=3600&token_type=bearer&provider_token=PT_T&provider_refresh_token=PRT_T`

/** Faux GoTrue : /user pour le flux implicite, /token?grant_type=pkce pour l'échange de code. */
const fauxFetch = vi.fn(async (input: RequestInfo | URL): Promise<Response> => {
  const url = String(input instanceof Request ? input.url : input)
  const json = (corps: unknown) => new Response(JSON.stringify(corps), { status: 200, headers: { 'Content-Type': 'application/json' } })
  if (url.includes('/auth/v1/user')) return json(UTILISATEUR)
  if (url.includes('/auth/v1/token') && url.includes('grant_type=pkce')) {
    return json({ access_token: JWT, refresh_token: 'RT_P', expires_in: 3600, token_type: 'bearer', user: UTILISATEUR, provider_token: 'PT_P', provider_refresh_token: 'PRT_P' })
  }
  return new Response('{}', { status: 404 })
})

let clients: SupabaseClient[] = []
function client(storage: AuthStorage, flowType: 'implicit' | 'pkce' = 'implicit'): SupabaseClient {
  const c = createClient(URL_PROJET, 'anon-test', {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: true, flowType },
    global: { fetch: fauxFetch },
  })
  clients.push(c)
  return c
}

let local: Memoire
let session: Memoire
const stockage = () => createAuthStorage({ local: () => local, session: () => session, location: () => window.location })
/** Un stockage qui ne filtre RIEN — le témoin du contrôle positif. */
const temoin = (): AuthStorage => ({
  getItem: (k) => local.getItem(k),
  setItem: (k, v) => local.setItem(k, v),
  removeItem: (k) => local.removeItem(k),
})

beforeEach(() => {
  local = new Memoire()
  session = new Memoire()
  // Vide un dépôt laissé par un cas précédent : un dépôt périmé est effacé.
  takeCalendarProviderTokens('google', Date.now() + 60 * 60 * 1000)
  vi.spyOn(console, 'warn').mockImplementation(() => {}) // « Multiple GoTrueClient instances »
  // Sans canal : auth-js diffuse SIGNED_IN dans un setTimeout(…, 0) qui survit au
  // test, et un canal fermé entre-temps rejette en « BroadcastChannel is closed ».
  vi.stubGlobal('BroadcastChannel', undefined)
})

afterEach(() => {
  for (const c of clients) c.auth.stopAutoRefresh()
  clients = []
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.history.replaceState(null, '', '/')
})

describe('auth-js range bien les jetons de fournisseur (contrôle positif)', () => {
  it('un stockage sans filtre reçoit PT_T et PRT_T au retour d’une liaison', async () => {
    window.history.replaceState(null, '', `/auth/callback?gcal=1#${FRAGMENT}`)
    await client(temoin()).auth.initialize()
    const contenu = local.vider()
    expect(contenu).toContain('RT_T')
    expect(contenu).toContain('PRT_T')
    expect(contenu).toContain('PT_T')
  })
})

describe('createAuthStorage — retour de liaison d’agenda', () => {
  it('range la session SANS jetons de fournisseur, et les confie au dépôt une seule fois', async () => {
    window.history.replaceState(null, '', `/auth/callback?gcal=1#${FRAGMENT}`)
    await client(stockage()).auth.initialize()
    const contenu = local.vider()
    expect(contenu).toContain('RT_T') // la session est bien là
    expect(contenu).not.toContain('PRT_T')
    expect(contenu).not.toContain('PT_T')
    // Aussitôt initialize() résolu, sans vider les minuteurs : pas de course
    // avec la sonde getSession() de la page de retour.
    expect(takeCalendarProviderTokens('azure')).toBeNull() // l'autre fournisseur ne consomme rien
    expect(takeCalendarProviderTokens('google')).toEqual({ providerToken: 'PT_T', providerRefreshToken: 'PRT_T' })
    expect(takeCalendarProviderTokens('google')).toBeNull() // lu une seule fois
  })

  it('une écriture ultérieure SANS jeton (rafraîchissement) ne vide pas le dépôt', async () => {
    window.history.replaceState(null, '', `/auth/callback?gcal=1#${FRAGMENT}`)
    const s = stockage()
    await client(s).auth.initialize()
    s.setItem('sb-abcdefghijklmnopqrst-auth-token', JSON.stringify({ access_token: 'A2', refresh_token: 'R2' }))
    expect(takeCalendarProviderTokens('google')).toEqual({ providerToken: 'PT_T', providerRefreshToken: 'PRT_T' })
  })

  it('Outlook : dépôt pour `azure` seulement', async () => {
    window.history.replaceState(null, '', `/auth/callback?outlook=1#${FRAGMENT}`)
    await client(stockage()).auth.initialize()
    expect(takeCalendarProviderTokens('google')).toBeNull()
    expect(takeCalendarProviderTokens('azure')).toEqual({ providerToken: 'PT_T', providerRefreshToken: 'PRT_T' })
  })

  it('une connexion ordinaire (sans drapeau d’agenda) est filtrée et ne dépose RIEN', async () => {
    window.history.replaceState(null, '', `/auth/callback#${FRAGMENT}`)
    await client(stockage()).auth.initialize()
    expect(local.vider()).not.toContain('PRT_T')
    expect(takeCalendarProviderTokens('google')).toBeNull()
    expect(takeCalendarProviderTokens('azure')).toBeNull()
  })

  it('le dépôt se périme au bout de deux minutes', async () => {
    window.history.replaceState(null, '', `/auth/callback?gcal=1#${FRAGMENT}`)
    await client(stockage()).auth.initialize()
    expect(takeCalendarProviderTokens('google', Date.now() + 3 * 60 * 1000)).toBeNull()
    expect(takeCalendarProviderTokens('google')).toBeNull() // effacé, pas seulement masqué
  })

  it('« Se souvenir de moi » décoché : la session filtrée vit en sessionStorage seulement', async () => {
    local.setItem(REMEMBER_KEY, 'false')
    window.history.replaceState(null, '', `/auth/callback?gcal=1#${FRAGMENT}`)
    await client(stockage()).auth.initialize()
    expect(local.vider()).not.toContain('RT_T')
    expect(session.vider()).toContain('RT_T')
    expect(session.vider()).not.toContain('PRT_T')
  })

  it('flux PKCE (couverture de l’adaptateur seul) : filtré et déposé de même', async () => {
    window.history.replaceState(null, '', '/auth/callback?gcal=1&code=abc')
    const s = stockage()
    s.setItem('sb-abcdefghijklmnopqrst-auth-token-code-verifier', JSON.stringify('VERIFIER'))
    await client(s, 'pkce').auth.initialize()
    // Contrôle : l'échange de code a bien eu lieu (sinon le filtre n'aurait rien vu).
    expect(fauxFetch.mock.calls.some(([u]) => String(u).includes('grant_type=pkce'))).toBe(true)
    expect(local.vider()).toContain('RT_P')
    expect(local.vider()).not.toContain('PRT_P')
    expect(takeCalendarProviderTokens('google')).toEqual({ providerToken: 'PT_P', providerRefreshToken: 'PRT_P' })
  })
})

describe('scrubStoredProviderTokens — nettoyage au démarrage', () => {
  it('réécrit une session qui porte des jetons, et ne touche à rien d’autre', () => {
    const m = new Memoire()
    m.setItem('sb-x-auth-token', JSON.stringify({ access_token: 'a', refresh_token: 'r', provider_token: 'PT', provider_refresh_token: 'PRT' }))
    m.setItem('sb-x-auth-token-code-verifier', '"PRT-lookalike"')
    m.setItem('sb-y-auth-token', 'pas du json')
    m.setItem('autre', JSON.stringify({ provider_token: 'hors-perimetre' }))
    expect(scrubStoredProviderTokens(m)).toBe(1)
    expect(JSON.parse(m.getItem('sb-x-auth-token') as string)).toEqual({ access_token: 'a', refresh_token: 'r' })
    expect(m.getItem('sb-x-auth-token-code-verifier')).toBe('"PRT-lookalike"')
    expect(m.getItem('sb-y-auth-token')).toBe('pas du json')
    expect(m.getItem('autre')).toContain('hors-perimetre')
  })
})

describe('sessionSansJetonsFournisseur — l’état de useAuth', () => {
  it('retire les deux champs et garde le reste ; même référence sans champ à retirer', () => {
    const avec = { access_token: 'a', refresh_token: 'r', provider_token: 'PT', provider_refresh_token: 'PRT', user: UTILISATEUR } as unknown as Session
    const sans = sessionSansJetonsFournisseur(avec) as Session
    expect(sans.access_token).toBe('a')
    expect('provider_token' in sans || 'provider_refresh_token' in sans).toBe(false)
    expect('provider_token' in avec).toBe(true) // l'objet reçu n'est pas muté
    const deja = { access_token: 'a' } as unknown as Session
    expect(sessionSansJetonsFournisseur(deja)).toBe(deja)
    expect(sessionSansJetonsFournisseur(null)).toBeNull()
  })
})
