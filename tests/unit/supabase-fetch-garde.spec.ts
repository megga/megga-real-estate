/**
 * Garde d'identité du client Supabase (src/lib/supabase.ts, `authAwareFetch`).
 *
 * Scénario : la page est liée au compte A ; un autre onglet range la session de B
 * dans le stockage partagé. supabase-js relit le jeton à CHAQUE appel, donc la
 * requête suivante de la page de A partirait signée B. La garde la refuse sans
 * l'envoyer (401 `compte_change`). Contrôles positifs : signée A, elle part ; et
 * `/auth/v1/` part même signée B (c'est par là que la session change).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { poserStockagesMemoire, type StockageMemoire } from './helpers/stockage-memoire'
import { CLE_SESSION_AUTH, supabase } from '@/lib/supabase'
import { lierComptePage } from '@/lib/stockageParCompte'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub: string) => `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub, role: 'authenticated', exp: 9_999_999_999 })}.x`
const sessionDe = (sub: string) => JSON.stringify({
  access_token: jwt(sub), refresh_token: `rt-${sub}`, token_type: 'bearer', expires_in: 3600,
  expires_at: 9_999_999_999, user: { id: sub, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
})

let local: StockageMemoire
const reseau = vi.fn(async (): Promise<Response> => new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }))

beforeEach(() => {
  ({ local } = poserStockagesMemoire())
  reseau.mockClear()
  vi.stubGlobal('fetch', reseau)
  lierComptePage('A')
})
afterEach(() => { vi.unstubAllGlobals() })

const appelsRest = () => reseau.mock.calls.filter(([u]) => String(u instanceof Request ? u.url : u).includes('/rest/v1/'))

describe('garde d’identité du client Supabase', () => {
  it('CONTRÔLE POSITIF : signée par le compte de la page, la requête part', async () => {
    local.setItem(CLE_SESSION_AUTH, sessionDe('A'))
    const { error } = await supabase.from('contacts').select('id').limit(1)
    expect(error).toBeNull()
    expect(appelsRest()).toHaveLength(1)
  })

  it('signée par un AUTRE compte, elle ne part pas : 401 compte_change', async () => {
    local.setItem(CLE_SESSION_AUTH, sessionDe('B'))
    const { error } = await supabase.from('contacts').select('id').limit(1)
    expect(appelsRest()).toHaveLength(0)
    expect(error?.code).toBe('compte_change')
  })

  it('CONTRÔLE POSITIF : /auth/v1/ part même signé B — la session doit pouvoir changer', async () => {
    local.setItem(CLE_SESSION_AUTH, sessionDe('B'))
    await supabase.auth.getUser()
    expect(reseau.mock.calls.some(([u]) => String(u instanceof Request ? u.url : u).includes('/auth/v1/user'))).toBe(true)
  })
})
