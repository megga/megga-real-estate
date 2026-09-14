/**
 * La fiche d'un contact ne montre plus un courrier signalé comme spam (14.09.2026).
 *
 * Le spam arrivé comme tel n'y entre jamais : il n'est rattaché à personne et rien n'est
 * journalisé (`_shared/mail/ingest.ts`). Mais un courrier rattaché PUIS signalé garde sa
 * ligne au journal — append-only, et elle dit vrai. C'est donc la LECTURE qui l'écarte,
 * par `mail_spam_message_ids` (20260915080200), et c'est ce que ce test tient : le câblage,
 * pas seulement le filtre.
 *
 * Idiome createRoot + act (le dépôt n'a pas @testing-library/react), cf. agent-notifications-perimetre.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const h = vi.hoisted(() => ({
  rpc: [] as [string, unknown][],
  spam: [] as string[] | { message: string },
  courriers: [] as { id: string; action: string; metadata: Record<string, unknown> }[],
  /** Les faits que la fiche a reçus, dans l'ordre. */
  vu: undefined as string[] | undefined,
}))

vi.mock('@/lib/supabase', () => {
  /** Une lecture de `activity_events` : les courriers si elle filtre par `in('action')`, sinon une note. */
  const lecture = () => {
    let courrier = false
    const proxy: unknown = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'then') {
          const data = courrier
            ? h.courriers.map((c) => ({ ...c, entity_type: 'contact', entity_id: 'c1', created_at: '2026-09-14T08:00:00+00:00' }))
            : [{ id: 'e-note', action: 'note_added', entity_type: 'contact', entity_id: 'c1', metadata: null, created_at: '2026-09-01T08:00:00+00:00' }]
          return (res: (v: unknown) => unknown) => Promise.resolve({ data, error: null }).then(res)
        }
        return (...args: unknown[]) => { if (prop === 'in' && args[0] === 'action') courrier = true; return proxy }
      },
    })
    return proxy
  }
  return {
    supabase: {
      from: () => lecture(),
      rpc: async (fn: string, args: unknown) => {
        h.rpc.push([fn, args])
        return Array.isArray(h.spam) ? { data: h.spam, error: null } : { data: null, error: h.spam }
      },
    },
  }
})

const { useContactTimeline } = await import('@/hooks/useContactTimeline')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let conteneur: HTMLDivElement
let racine: Root

function Fiche() {
  const q = useContactTimeline('c1')
  useEffect(() => { h.vu = q.data?.map((e) => e.id) }, [q.data])
  return null
}

async function monter() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => { racine.render(createElement(QueryClientProvider, { client }, createElement(Fiche))) })
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const courrier = (id: string, messageId: string, sentAt: string) =>
  ({ id, action: 'email_received', metadata: { message_id: messageId, thread_id: 't', account_id: 'a', sent_at: sentAt } })

beforeEach(() => {
  h.rpc.length = 0
  h.spam = []
  h.courriers = [courrier('e-spam', 'm-spam', '2026-09-12T09:00:00.000Z'), courrier('e-vrai', 'm-vrai', '2026-09-11T09:00:00.000Z')]
  h.vu = undefined
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
})

afterEach(() => { act(() => racine.unmount()); conteneur.remove() })

describe('la fiche du contact et le spam', () => {
  it('⛔ un courrier signalé comme spam après son rattachement quitte la fiche — le reste y demeure', async () => {
    h.spam = ['m-spam']
    await monter()
    expect(h.vu).toEqual(['e-vrai', 'e-note'])
    expect(h.rpc).toEqual([['mail_spam_message_ids', { p_ids: ['m-spam', 'm-vrai'] }]])
  })

  it('contrôle positif : sans spam, les deux courriers et la note', async () => {
    await monter()
    expect(h.vu).toEqual(['e-spam', 'e-vrai', 'e-note'])
  })

  it('la lecture du spam en échec n’écarte rien : mieux vaut un spam affiché qu’un vrai courrier caché', async () => {
    h.spam = { message: 'statement timeout' }
    await monter()
    expect(h.vu).toEqual(['e-spam', 'e-vrai', 'e-note'])
  })

  it('aucun courrier, aucune question au serveur', async () => {
    h.courriers = []
    await monter()
    expect(h.vu).toEqual(['e-note'])
    expect(h.rpc).toEqual([])
  })
})
