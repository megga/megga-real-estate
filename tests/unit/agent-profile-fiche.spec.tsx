/**
 * La fiche de l'agent (`agent_profiles`) se crée au premier enregistrement qui en a besoin.
 *
 * Sans fiche, bio, langues, spécialités et liens ne s'enregistraient pas : save() ne faisait
 * qu'un UPDATE, et l'INSERT est réservé au super-admin. Le score de profil plafonnait à 89 %,
 * la bio tapée sur mobile se perdait sans message. Ces tests gardent le chemin de save() :
 * création par la RPC quand il y a quelque chose à mettre, rien sinon, et pas de faux succès.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DEFAULT_PROFILE, type ProfileData } from '@/components/crm/settings/data'

const h = vi.hoisted(() => ({
  existingCard: null as { id: string } | null,
  rpcResult: { data: null, error: null } as { data: string | null; error: { message: string } | null },
  rpcCalls: [] as string[],
  updates: [] as { table: string; values: Record<string, unknown>; eq: [string, unknown][] }[],
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: { id: 'agent-1' } }) }))

vi.mock('@/lib/supabase', () => {
  const from = (table: string) => {
    let update: { table: string; values: Record<string, unknown>; eq: [string, unknown][] } | null = null
    const q = {
      select: () => q,
      update: (values: Record<string, unknown>) => {
        update = { table, values, eq: [] }
        h.updates.push(update)
        return q
      },
      eq: (col: string, val: unknown) => {
        update?.eq.push([col, val])
        return q
      },
      maybeSingle: async () => ({ data: table === 'agent_profiles' ? h.existingCard : null, error: null }),
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({ data: null, error: null }).then(resolve),
    }
    return q
  }
  const rpc = async (name: string) => {
    h.rpcCalls.push(name)
    return h.rpcResult
  }
  return { supabase: { from, rpc } }
})

import { useAgentProfileScreen, type UseAgentProfileScreenReturn } from '@/hooks/useAgentProfileScreen'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** Profil sans aucun champ de fiche : ni bio, ni langues, ni spécialités, ni liens. */
const sansFiche: ProfileData = { ...DEFAULT_PROFILE, bio: '', languages: [], specialties: [], website: '', linkedin: '' }

let conteneur: HTMLDivElement
let racine: Root

// Le retour du hook remonte par un effet : le réassigner pendant le rendu serait un
// effet de bord (react-hooks/globals).
function Banc({ surRendu }: { surRendu: (e: UseAgentProfileScreenReturn) => void }) {
  const ecran = useAgentProfileScreen({ enabled: false })
  useEffect(() => { surRendu(ecran) }, [ecran, surRendu])
  return null
}

async function monter() {
  let ecran: UseAgentProfileScreenReturn | null = null
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  await act(async () => {
    racine.render(createElement(QueryClientProvider, { client }, createElement(Banc, { surRendu: (e) => { ecran = e } })))
  })
  return { result: { get current() { return ecran! } } }
}

const majFiche = () => h.updates.filter((u) => u.table === 'agent_profiles')

beforeEach(() => {
  h.existingCard = null
  h.rpcResult = { data: 'fiche-neuve', error: null }
  h.rpcCalls = []
  h.updates = []
  conteneur = document.createElement('div')
  document.body.appendChild(conteneur)
  racine = createRoot(conteneur)
})

afterEach(() => {
  act(() => racine.unmount())
  conteneur.remove()
})

describe('fiche agent_profiles — créée par save() quand il y a quelque chose à y mettre', () => {
  it("sans fiche, une bio la fait créer par la RPC, puis l'enregistre dedans", async () => {
    const { result } = await monter()
    await act(async () => { await result.current.save({ ...sansFiche, bio: 'Courtier à Genève.' }) })

    expect(h.rpcCalls).toEqual(['ensure_my_agent_profile'])
    expect(majFiche()).toHaveLength(1)
    expect(majFiche()[0].values).toMatchObject({ bio: 'Courtier à Genève.' })
    expect(majFiche()[0].eq).toEqual([['id', 'fiche-neuve']])
  })

  it('les langues, les spécialités et les liens font aussi créer la fiche', async () => {
    for (const champ of [{ languages: ['Français'] }, { specialties: ['PPE'] }, { website: 'https://a.ch' }, { linkedin: 'https://linkedin.com/in/a' }]) {
      h.rpcCalls = []
      const { result } = await monter()
      await act(async () => { await result.current.save({ ...sansFiche, ...champ }) })
      expect(h.rpcCalls, JSON.stringify(champ)).toEqual(['ensure_my_agent_profile'])
    }
  })

  it("sans rien à y mettre, aucune fiche n'est créée (le reste du profil s'enregistre)", async () => {
    const { result } = await monter()
    await act(async () => { await result.current.save({ ...sansFiche, title: 'Courtier' }) })

    expect(h.rpcCalls).toEqual([])
    expect(majFiche()).toEqual([])
    expect(h.updates.find((u) => u.table === 'profiles')?.values).toMatchObject({ agent_role: 'Courtier' })
  })

  it('une fiche existante est mise à jour sans rien créer', async () => {
    h.existingCard = { id: 'fiche-1' }
    const { result } = await monter()
    await act(async () => { await result.current.save({ ...sansFiche, bio: 'Nouvelle bio' }) })

    expect(h.rpcCalls).toEqual([])
    expect(majFiche()[0].eq).toEqual([['id', 'fiche-1']])
  })

  it("si la création échoue, save() échoue : pas d'« Enregistré » sur une bio perdue", async () => {
    h.rpcResult = { data: null, error: { message: 'profile_not_found' } }
    const { result } = await monter()
    let erreur: unknown = null
    await act(async () => {
      try { await result.current.save({ ...sansFiche, bio: 'Perdue ?' }) } catch (e) { erreur = e }
    })

    expect(erreur).not.toBeNull()
    expect(majFiche()).toEqual([])
  })
})
