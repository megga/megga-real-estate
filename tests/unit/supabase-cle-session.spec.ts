/**
 * Clé de session d'auth-js et lecture de l'uid rangé (src/lib/supabase.ts).
 *
 * La dérivation de la clé est ÉPINGLÉE contre le vrai client : une version
 * d'auth-js qui la changerait ferait rougir ce test, pas la production — où la
 * détection d'un changement de compte (useAuth) lirait une clé vide et laisserait
 * passer les événements d'un autre onglet.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { poserStockagesMemoire, type StockageMemoire } from './helpers/stockage-memoire'
import { CLE_SESSION_AUTH, lireUidSessionStockee, purgeAuthTokens, supabase } from '@/lib/supabase'

const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jwt = (sub: string) => `${b64({ alg: 'none' })}.${b64({ sub, exp: 9_999_999_999 })}.x`

let local: StockageMemoire
let session: StockageMemoire
beforeEach(() => { ({ local, session } = poserStockagesMemoire()) })

describe('CLE_SESSION_AUTH', () => {
  it('est exactement la clé du client supabase-js', () => {
    expect(CLE_SESSION_AUTH).toBe((supabase.auth as unknown as { storageKey: string }).storageKey)
    expect(CLE_SESSION_AUTH).toMatch(/^sb-.+-auth-token$/)
  })
})

describe('lireUidSessionStockee', () => {
  it('lit user.id ; à défaut le sub du jeton ; null si illisible', () => {
    local.setItem(CLE_SESSION_AUTH, JSON.stringify({ access_token: jwt('sub-jeton'), user: { id: 'u-1' } }))
    expect(lireUidSessionStockee()).toBe('u-1')
    local.setItem(CLE_SESSION_AUTH, JSON.stringify({ access_token: jwt('sub-jeton') }))
    expect(lireUidSessionStockee()).toBe('sub-jeton')
    local.setItem(CLE_SESSION_AUTH, '{pas du json')
    expect(lireUidSessionStockee()).toBeNull()
    local.removeItem(CLE_SESSION_AUTH)
    expect(lireUidSessionStockee()).toBeNull()
  })

  it('suit la route « Se souvenir de moi » décoché (session en sessionStorage)', () => {
    local.setItem('megga_remember', 'false')
    session.setItem(CLE_SESSION_AUTH, JSON.stringify({ user: { id: 'u-session' } }))
    expect(lireUidSessionStockee()).toBe('u-session')
  })
})

describe('purgeAuthTokens', () => {
  it('retire la session ET le vérificateur PKCE, dans les deux stockages ; rien d’autre', () => {
    local.setItem('sb-x-auth-token', '{}')
    local.setItem('sb-x-auth-token-code-verifier', '"v"')
    session.setItem('sb-y-auth-token', '{}')
    local.setItem('megga-theme', 'dark')
    local.setItem('sb-x-autre', 'garde')
    purgeAuthTokens('test')
    expect(local.cles()).toEqual(['megga-theme', 'sb-x-autre'])
    expect(session.cles()).toEqual([])
  })
})
