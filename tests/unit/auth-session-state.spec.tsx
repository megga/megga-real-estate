/**
 * useAuth ne garde JAMAIS les jetons Google/Microsoft dans son état React.
 *
 * auth-js émet SIGNED_IN avec la session complète, `provider_token` et
 * `provider_refresh_token` compris ; rangée telle quelle, elle vivrait une heure
 * dans l'état de cet onglet — et de tout autre onglet qui reçoit l'événement par
 * BroadcastChannel. Le provider est monté pour de vrai (createRoot + act) avec un
 * client Supabase simulé qui émet l'événement.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Session } from '@supabase/supabase-js'

const h = vi.hoisted(() => ({
  emettre: null as null | ((event: string, s: unknown) => void),
  sessionInitiale: null as unknown,
}))

vi.mock('@/lib/supabase', () => {
  // Chaîne PostgREST minimale : la lecture de profil échoue proprement (repli
  // user_metadata), ce test ne porte que sur la session.
  const chaine = {
    select: () => chaine,
    eq: () => chaine,
    single: async () => ({ data: null, error: { message: 'absent' } }),
  }
  return {
    // Garde « un compte par page » (useAuth, S11) : ce test n'en parle pas —
    // stockage vide, aucune purge de jetons.
    CLE_SESSION_AUTH: 'sb-test-auth-token',
    lireUidSessionStockee: () => null,
    purgeAuthTokens: () => {},
    sujetDuJeton: () => null,
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: h.sessionInitiale } })),
        onAuthStateChange: vi.fn((fn: (event: string, s: unknown) => void) => {
          h.emettre = fn
          return { data: { subscription: { unsubscribe: vi.fn() } } }
        }),
      },
      from: () => chaine,
      rpc: vi.fn(),
    },
  }
})

import { AuthProvider, useAuth } from '@/hooks/useAuth'

const UTILISATEUR = { id: 'u-1', email: 'agent@example.org', user_metadata: {}, app_metadata: {}, aud: 'authenticated', created_at: '2026-09-13T00:00:00Z' }
const avecJetons = (): Session => ({
  access_token: 'AT', refresh_token: 'RT', expires_in: 3600, token_type: 'bearer',
  provider_token: 'PT', provider_refresh_token: 'PRT', user: UTILISATEUR,
}) as unknown as Session

let hote: HTMLDivElement | null = null
let racine: Root | null = null
let vue: Session | null = null

function Lecteur({ capter }: { capter: (s: Session | null) => void }) {
  const { session } = useAuth()
  useEffect(() => { capter(session) }, [session, capter])
  return null
}
const capter = (s: Session | null) => { vue = s }

async function monter() {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => { racine!.render(createElement(AuthProvider, null, createElement(Lecteur, { capter }))) })
}

beforeEach(() => {
  vue = null
  h.emettre = null
  h.sessionInitiale = null
  // reportDevice (SIGNED_IN) part en fetch direct : réponse neutre.
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  vi.unstubAllGlobals()
})

describe('useAuth — état de session', () => {
  it('SIGNED_IN : la session rangée garde son jeton d’accès, perd les jetons de fournisseur', async () => {
    await monter()
    const emise = avecJetons()
    await act(async () => { h.emettre!('SIGNED_IN', emise) })
    expect(vue?.access_token).toBe('AT') // contrôle positif : c'est bien CETTE session
    expect(vue && ('provider_token' in vue || 'provider_refresh_token' in vue)).toBe(false)
    // L'objet émis portait bien les jetons, et n'a pas été muté (auth-js le garde).
    expect(emise.provider_refresh_token).toBe('PRT')
  })

  it('getSession() au montage : même retrait', async () => {
    h.sessionInitiale = avecJetons()
    await monter()
    expect(vue?.access_token).toBe('AT')
    expect(vue && ('provider_token' in vue || 'provider_refresh_token' in vue)).toBe(false)
  })
})
