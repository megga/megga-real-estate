/**
 * La cloche de l'agent lit SON agence, posée en clair — et rien sans agence.
 *
 * ⛔ Mesuré le 13.09.2026 : la requête n'avait AUCUN filtre d'agence et se fiait à la RLS.
 * Or deux policies SELECT permissives s'additionnent sur `activity_events` —
 * `events_select` (agency_id = get_my_agency_id()) ET `super_admin_read_all_events`
 * (toutes agences). Le super-admin de prod n'a pas d'agence : sa cloche rendait les 30
 * derniers événements système de la PLATEFORME (plusieurs agences mêlées), titrés par des
 * libellés d'agences qui ne sont pas les siennes. Et le canal Realtime, sans filtre, poussait
 * dans son navigateur le contenu de chaque insertion de la plateforme.
 *
 * Idiome createRoot + act (le dépôt n'a pas @testing-library/react), cf. lab-guard-banner.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({
  appels: [] as [string, unknown[]][],
  canaux: [] as { nom: string; filtre: unknown }[],
  profil: null as null | { role: string; agency_id: string | null },
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: h.profil }) }))

vi.mock('@/lib/supabase', () => {
  const chaine = (): unknown => {
    const proxy: unknown = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') return (res: (v: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(res)
        return (...args: unknown[]) => { h.appels.push([String(prop), args]); return proxy }
      },
    })
    return proxy
  }
  const canal = (nom: string) => {
    const ch = {
      on: (_evt: string, filtre: unknown) => { h.canaux.push({ nom, filtre }); return ch },
      subscribe: () => ch,
    }
    return ch
  }
  return {
    supabase: {
      from: (t: string) => { h.appels.push(['from', [t]]); return chaine() },
      channel: canal,
      removeChannel: () => undefined,
    },
  }
})

const { useAgentNotifications, useAgentNotificationsRealtime } = await import('@/hooks/useAgentNotifications')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Cloche() { useAgentNotifications(); return null }
function Canal() { useAgentNotificationsRealtime(); return null }

let conteneur: HTMLDivElement
let racine: Root
let client: QueryClient

async function monter(el: () => null) {
  await act(async () => {
    racine.render(createElement(QueryClientProvider, { client }, createElement(el)))
  })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const lecturesDuJournal = () => h.appels.filter(([m, a]) => m === 'from' && a[0] === 'activity_events')

beforeEach(() => {
  h.appels.length = 0
  h.canaux.length = 0
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  act(() => racine.unmount())
  conteneur.remove()
})

describe('cloche agent — le périmètre de l’agence, en clair', () => {
  it('un agent : la requête porte SON agence, le filtre non-utilisateur et l’exclusion du courrier', async () => {
    h.profil = { role: 'agent', agency_id: 'agence-A' }
    await monter(Cloche)
    expect(lecturesDuJournal()).toHaveLength(1)
    expect(h.appels).toContainEqual(['eq', ['agency_id', 'agence-A']])
    expect(h.appels).toContainEqual(['neq', ['actor_kind', 'user']])
    expect(h.appels).toContainEqual(['not', ['action', 'in', '(email_received,email_sent)']])
  })

  it('le super-admin sans agence (la forme de prod) : AUCUNE lecture du journal', async () => {
    h.profil = { role: 'super_admin', agency_id: null }
    await monter(Cloche)
    expect(lecturesDuJournal()).toEqual([])
  })

  it('profil pas encore chargé : aucune lecture', async () => {
    h.profil = null
    await monter(Cloche)
    expect(lecturesDuJournal()).toEqual([])
  })

  it('le canal Realtime : filtré sur l’agence, et aucun canal sans agence', async () => {
    h.profil = { role: 'agent', agency_id: 'agence-A' }
    await monter(Canal)
    expect(h.canaux).toHaveLength(1)
    expect(h.canaux[0].filtre).toMatchObject({ event: 'INSERT', table: 'activity_events', filter: 'agency_id=eq.agence-A' })

    act(() => racine.unmount())
    racine = createRoot(conteneur)
    h.canaux.length = 0
    h.profil = { role: 'super_admin', agency_id: null }
    await monter(Canal)
    expect(h.canaux, 'sans agence, aucun abonnement : il pousserait chaque insertion de la plateforme').toEqual([])
  })
})
