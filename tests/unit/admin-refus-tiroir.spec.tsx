/**
 * Le tiroir d'un compte dit à l'opérateur POURQUOI le serveur a refusé — rendu réel du
 * tiroir, de la confirmation et de l'i18n française, sur le chemin complet : l'opérateur
 * tape l'e-mail, confirme, l'edge refuse.
 *
 * ⛔ Avant le 13.09.2026, chaque refus rendait le même toast : « L'action a échoué. Les
 * gestes de cycle de vie sont refusés côté serveur sur un compte super-admin allowlisté. »
 * Un compte à dossier KYC ouvert se lisait comme un blocage de sécurité.
 *
 * Deux étages : le hook transforme la réponse non-2xx en `ErreurEdge` (supabase simulé), et
 * le tiroir transforme l'`ErreurEdge` en phrase (hook simulé). Idiome createRoot + act.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FunctionsHttpError } from '@supabase/supabase-js'
import i18n from '@/i18n'
import { ErreurEdge, type RefusEdge } from '@/lib/refusEdge'

const h = vi.hoisted(() => ({
  toastErreur: vi.fn(),
  toastSucces: vi.fn(),
  refusSuppression: null as null | { status: number; code: string | null; texte: string | null; count: number | null },
  invoke: vi.fn(),
}))

// Le thème de la console vit dans un contexte : on rend des couleurs neutres, le sujet est le texte.
vi.mock('@/hooks/useAdminSurfaces', () => {
  const neutre = new Proxy({}, { get: () => '#000000' })
  return { useAdminSurfaces: () => ({ sp: neutre, surf: neutre, dark: false, tones: neutre }) }
})
vi.mock('@/components/ui/Toast', () => ({
  useToast: () => ({ error: h.toastErreur, success: h.toastSucces, info: vi.fn(), warn: vi.fn(), dismiss: vi.fn() }),
}))
vi.mock('@/hooks/useAdminUsers', () => ({
  useAdminUsers: () => ({
    users: [{
      id: 'u-cible', full_name: 'Zoé Cible', email: 'cible@ex.ch', avatar_url: null, role: 'agent', phone: null,
      created_at: '2026-01-01T00:00:00Z', agency_id: 'ag-1', agency_name: 'Agence Test', is_suspended: false,
      last_activity_at: null, stale_days: null, never: false, consents: [], marketing: false,
    }],
    updateRole: { mutate: vi.fn(), isPending: false, isError: false },
  }),
  useUserActivity: () => ({ data: [], isLoading: false }),
  useDsarExport: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: h.invoke } } }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let conteneur: HTMLDivElement
let racine: Root

beforeEach(async () => {
  await i18n.changeLanguage('fr')
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
  h.toastErreur.mockReset()
  h.invoke.mockReset()
})
afterEach(() => {
  act(() => racine.unmount())
  conteneur.remove()
  document.body.innerHTML = ''
})

const boutons = (libelle: string) => [...document.querySelectorAll('button')].filter((b) => b.textContent?.includes(libelle))

/** Ouvre le tiroir, demande la suppression, tape l'e-mail, confirme — comme l'opérateur. */
async function supprimer(refusServeur: { status: number; corps: unknown }) {
  h.invoke.mockResolvedValue({
    data: null,
    error: new FunctionsHttpError(new Response(JSON.stringify(refusServeur.corps), { status: refusServeur.status })),
  })
  const { default: UserDrawer } = await import('@/components/admin/UserDrawer')
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  await act(async () => {
    racine.render(createElement(QueryClientProvider, { client },
      createElement(MemoryRouter, null, createElement(UserDrawer, { userId: 'u-cible', onClose: () => {} }))))
  })
  const [ouvrir] = boutons('Supprimer le compte')
  expect(ouvrir, 'bouton « Supprimer le compte » introuvable').toBeTruthy()
  await act(async () => { ouvrir!.click() })
  const saisie = document.querySelector('input') as HTMLInputElement
  expect(saisie, 'le champ de confirmation n’est pas monté').toBeTruthy()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(saisie, 'cible@ex.ch')
    saisie.dispatchEvent(new Event('input', { bubbles: true }))
  })
  const confirmer = boutons('Supprimer le compte').at(-1)!
  expect(confirmer.disabled, 'la confirmation reste verrouillée').toBe(false)
  await act(async () => { confirmer.click() })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
  expect(h.invoke).toHaveBeenCalledWith('delete-account', { body: { target_user_id: 'u-cible' } })
  expect(h.toastErreur, 'aucun toast d’erreur').toHaveBeenCalledTimes(1)
  return h.toastErreur.mock.calls[0] as [string, { description: string; duration: number }]
}

describe('tiroir d’un compte — le motif du refus de suppression', () => {
  it('dossier KYC en cours : le nombre, et ce qu’on attend', async () => {
    const [titre, opts] = await supprimer({ status: 400, corps: { error: 'KYC_PENDING', message: 'Vous avez 2 dossier(s)…', count: 2 } })
    expect(titre).toBe('Suppression refusée')
    expect(opts.description).toBe('2 dossier(s) KYC en cours sur ce compte : la suppression attend leur finalisation.')
    expect(opts.description).not.toMatch(/allowlist/i)
  })

  it('dernier administrateur : la consigne, pas un blocage de sécurité', async () => {
    const [, opts] = await supprimer({ status: 400, corps: { error: 'SOLE_ADMIN', message: 'Vous êtes le seul…', agency_id: 'ag-1' } })
    expect(opts.description).toBe("Seul administrateur de son agence : transférez d'abord ses droits à un autre membre.")
  })

  it('boîte mail non déconnectée : rien n’a été supprimé, et on peut réessayer', async () => {
    const [, opts] = await supprimer({ status: 502, corps: { error: 'MAILBOX_DISCONNECT_FAILED', message: '…', reason: 'provider_refused' } })
    expect(opts.description).toMatch(/^Une boîte mail connectée n'a pas pu être déconnectée\. Rien n'a été supprimé/)
  })

  it('effacement à moitié fait : le compte est déjà anonymisé, et c’est dit', async () => {
    const [, opts] = await supprimer({ status: 500, corps: { error: 'Auth user deletion failed: db. Data was anonymised but the auth record remains — contact support.' } })
    expect(opts.description).toMatch(/^Données anonymisées, mais le compte d'authentification n'a pas pu être supprimé/)
  })

  it('panne inconnue : le statut et le texte du serveur, plutôt qu’une cause inventée', async () => {
    const [, opts] = await supprimer({ status: 500, corps: { error: 'Audit log failed: timeout' } })
    expect(opts.description).toBe('Refus du serveur (500) : Audit log failed: timeout')
    expect(opts.duration, 'le toast doit laisser le temps de lire').toBeGreaterThanOrEqual(8_000)
  })
})

describe('useAdminUserLifecycle — le refus voyage jusqu’à l’écran', () => {
  it('une réponse non-2xx devient une ErreurEdge qui porte le motif', async () => {
    h.invoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ error: 'SOLE_ADMIN', message: 'm' }), { status: 400 })),
    })
    const { useAdminUserLifecycle } = await import('@/hooks/useAdminUserLifecycle')
    type Api = ReturnType<typeof useAdminUserLifecycle>
    let api: Api | null = null
    function Sonde({ surApi }: { surApi: (a: Api) => void }) {
      const a = useAdminUserLifecycle()
      useEffect(() => { surApi(a) })
      return null
    }
    await act(async () => {
      racine.render(createElement(QueryClientProvider, { client: new QueryClient() },
        createElement(Sonde, { surApi: (a: Api) => { api = a } })))
    })
    let leve: unknown = null
    await act(async () => { await api!.deleteAccount.mutateAsync({ userId: 'u-1' }).catch((e: unknown) => { leve = e }) })
    expect(leve).toBeInstanceOf(ErreurEdge)
    expect((leve as ErreurEdge).refus).toEqual<RefusEdge>({ status: 400, code: 'SOLE_ADMIN', texte: 'm', count: null })
  })
})
