/**
 * Un seul compte par vie de page (useAuth, invariant 3 — audit S11).
 *
 * Le provider est monté pour de vrai ; le client Supabase est simulé : on émet
 * les événements d'auth à la main, on choisit ce que le stockage de l'onglet
 * « contient » (`lireUidSessionStockee`), et `quitterPourNouveauCompte` est un
 * espion — le rechargement dur ne peut pas avoir lieu dans jsdom.
 *
 * Chaque refus a son contrôle positif : un rafraîchissement du MÊME compte ne
 * recharge rien ; une déconnexion réussie ne purge pas les jetons à la main.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { User } from '@supabase/supabase-js'
import { poserStockagesMemoire, type StockageMemoire } from './helpers/stockage-memoire'

const h = vi.hoisted(() => ({
  emettre: null as null | ((event: string, s: unknown) => void),
  sessionInitiale: null as unknown,
  stocke: null as string | null,
  signOut: (async () => ({ error: null })) as () => Promise<{ error: unknown }>,
  ordre: [] as string[],
  quitter: 0,
  purges: 0,
}))

vi.mock('@/lib/supabase', () => {
  const chaine = { select: () => chaine, eq: () => chaine, single: async () => ({ data: null, error: { message: 'absent' } }) }
  return {
    CLE_SESSION_AUTH: 'sb-test-auth-token',
    lireUidSessionStockee: () => h.stocke,
    purgeAuthTokens: () => { h.ordre.push('purgeAuthTokens'); h.purges++ },
    sujetDuJeton: () => null,
    supabase: {
      auth: {
        getSession: async () => ({ data: { session: h.sessionInitiale } }),
        onAuthStateChange: (fn: (event: string, s: unknown) => void) => {
          h.emettre = fn
          return { data: { subscription: { unsubscribe() {} } } }
        },
        signOut: () => { h.ordre.push('signOut'); return h.signOut() },
      },
      from: () => chaine,
      rpc: async (nom: string, args: Record<string, unknown>) => { h.ordre.push(`rpc:${nom}:${String(args.p_action)}`); return { data: null, error: null } },
    },
  }
})

vi.mock('@/lib/stockageParCompte', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/stockageParCompte')>()),
  quitterPourNouveauCompte: () => { h.quitter++ },
}))
vi.mock('@/lib/intercom', () => ({ shutdownIntercom: () => { h.ordre.push('intercom') } }))
vi.mock('@/lib/posthog', () => ({ resetPostHog: () => {} }))

import { AuthProvider, useAuth } from '@/hooks/useAuth'

const session = (id: string) => ({
  access_token: `at-${id}`, refresh_token: `rt-${id}`, expires_in: 3600, token_type: 'bearer',
  user: { id, email: `${id}@example.org`, user_metadata: {}, app_metadata: {}, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' },
})

let local: StockageMemoire
let sess: StockageMemoire
let hote: HTMLDivElement | null = null
let racine: Root | null = null
let vue: { user: User | null; signOut: () => Promise<void> } | null = null

function Lecteur() {
  const a = useAuth()
  useEffect(() => { vue = { user: a.user, signOut: a.signOut } })
  return null
}

async function monter() {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => { racine!.render(createElement(AuthProvider, null, createElement(Lecteur))) })
}
const emettre = async (event: string, s: unknown) => { await act(async () => { h.emettre!(event, s) }) }

beforeEach(() => {
  ({ local, session: sess } = poserStockagesMemoire())
  local.setItem('megga-theme', 'dark')
  local.setItem('megga-impersonate:A', JSON.stringify({ id: 'cible-1', full_name: 'Cible Un' }))
  sess.setItem('megga.crm.tabs:A:AG1', '{"tabs":[{"label":"Jean Dupont"}]}')
  h.emettre = null
  h.sessionInitiale = null
  h.stocke = null
  h.signOut = async () => ({ error: null })
  h.ordre = []
  h.quitter = 0
  h.purges = 0
  vue = null
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('useAuth — un seul compte par vie de page', () => {
  it('CONTRÔLE POSITIF : le même compte qui se rafraîchit ne recharge rien', async () => {
    await monter()
    h.stocke = 'A'
    await emettre('SIGNED_IN', session('A'))
    await emettre('TOKEN_REFRESHED', session('A'))
    expect(h.quitter).toBe(0)
    expect(vue?.user?.id).toBe('A')
    expect(sess.getItem('megga.stockage.compte')).toBe('A') // la page s'est liée à A
  })

  it('A puis B dans cet onglet : purge du sortant et rechargement, SANS adopter B', async () => {
    await monter()
    h.stocke = 'A'
    await emettre('SIGNED_IN', session('A'))
    h.stocke = 'B'
    await emettre('SIGNED_IN', session('B'))
    expect(h.quitter).toBe(1)
    expect(vue?.user?.id).toBe('A') // aucun setSession(B) : la page part
    expect(sess.getItem('megga.crm.tabs:A:AG1')).toBeNull()
    expect(local.getItem('megga-impersonate:A')).toBeNull()
    expect(local.getItem('megga-theme')).toBe('dark')
  })

  it('un SIGNED_IN(B) relayé d’un autre onglet, quand CE stockage dit A : ignoré', async () => {
    await monter()
    h.stocke = 'A'
    await emettre('SIGNED_IN', session('A'))
    await emettre('SIGNED_IN', session('B'))
    expect(h.quitter).toBe(0)
    expect(vue?.user?.id).toBe('A')
    expect(sess.getItem('megga.crm.tabs:A:AG1')).not.toBeNull()
  })

  it('SIGNED_OUT avec le stockage vide : purge du sensible, l’appareil reste', async () => {
    await monter()
    h.stocke = 'A'
    await emettre('SIGNED_IN', session('A'))
    h.stocke = null
    await emettre('SIGNED_OUT', null)
    expect(local.getItem('megga-impersonate:A')).toBeNull()
    expect(local.getItem('megga-theme')).toBe('dark')
    expect(vue?.user).toBeNull()
  })

  it('SIGNED_OUT relayé alors que CE stockage garde A : ignoré, rien n’est purgé', async () => {
    await monter()
    h.stocke = 'A'
    await emettre('SIGNED_IN', session('A'))
    await emettre('SIGNED_OUT', null)
    expect(local.getItem('megga-impersonate:A')).not.toBeNull()
    expect(vue?.user?.id).toBe('A')
  })

  it('écriture de la session de B par un autre onglet (événement storage) : rechargement', async () => {
    await monter()
    h.stocke = 'A'
    await emettre('SIGNED_IN', session('A'))
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'sb-test-auth-token', newValue: JSON.stringify(session('B')) }))
    })
    expect(h.quitter).toBe(1)
  })
})

describe('useAuth — déconnexion ordonnée', () => {
  async function connecteA() {
    await monter()
    h.stocke = 'A'
    await emettre('SIGNED_IN', session('A'))
  }

  it('CONTRÔLE POSITIF : signOut réussi — les jetons ne sont PAS purgés à la main', async () => {
    await connecteA()
    await act(async () => { await vue!.signOut() })
    expect(h.purges).toBe(0)
    expect(vue?.user).toBeNull()
  })

  it('signOut qui RENVOIE une erreur (réseau, 5xx) : les jetons sont purgés à la main', async () => {
    await connecteA()
    h.signOut = async () => ({ error: { name: 'AuthRetryableFetchError', status: 0 } })
    await act(async () => { await vue!.signOut() })
    expect(h.purges).toBe(1)
  })

  it('signOut qui ne répond jamais : la session tient jusqu’au délai, PUIS jetons purgés, PUIS état nul', async () => {
    await connecteA()
    vi.useFakeTimers()
    h.signOut = () => new Promise(() => {})
    let fini = false
    await act(async () => { void vue!.signOut().then(() => { fini = true }) })
    await act(async () => { await vi.advanceTimersByTimeAsync(4000) })
    expect(fini).toBe(false)
    expect(vue?.user?.id).toBe('A') // ProtectedRoute ne peut pas encore partir
    expect(h.purges).toBe(0)
    await act(async () => { await vi.advanceTimersByTimeAsync(1500) })
    expect(fini).toBe(true)
    expect(h.purges).toBe(1)
    expect(vue?.user).toBeNull()
    expect(h.ordre.indexOf('purgeAuthTokens')).toBeGreaterThan(h.ordre.indexOf('signOut'))
  })

  it('en impersonation : la fin est journalisée AVANT signOut ; le stockage du compte est purgé', async () => {
    await connecteA()
    await act(async () => { await vue!.signOut() })
    const audit = h.ordre.indexOf('rpc:admin_log_impersonation:impersonate_stop')
    expect(audit).toBeGreaterThanOrEqual(0)
    expect(audit).toBeLessThan(h.ordre.indexOf('signOut'))
    expect(h.ordre.indexOf('intercom')).toBeLessThan(h.ordre.indexOf('signOut'))
    expect(local.getItem('megga-impersonate:A')).toBeNull()
    expect(sess.getItem('megga.crm.tabs:A:AG1')).toBeNull()
  })
})
