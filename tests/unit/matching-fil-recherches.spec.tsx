/**
 * La lecture des recherches d'acheteur actives (`useRecherchesActives`) — ce qui décide, avec le fil, de la couverture
 * de premier lancement du Matching (lot E1, conception `2026-09-27-matching-lot-e1-bureau-design.md` §5.1) — et les
 * écritures de contacts qui la relisent (`useCreateContact`, `useUpdateContact`).
 *
 * Ce que cette spec refuse :
 *   · « aucune » rendu pendant que la session arrive, pendant la lecture ou sur un échec : la couverture passerait à
 *     tort ; ni sur l'échec d'un rafraîchissement, qui garde ce qui a été lu ;
 *   · une lecture hors du préfixe du fil — « Réessayer » ne la relirait pas — ou partagée entre deux agences ;
 *   · un acheteur créé avec ses critères, ou des critères écrits sur une fiche, sans que la lecture soit refaite, écran
 *     de Matching fermé ou caché compris : la couverture survivrait deux minutes au premier acheteur ;
 *   · une création qui rend la main avant cette lecture : « Voir ses matchs » ouvrirait le fil sur la couverture ;
 *   · le fil relu dans la foulée — le moteur note en différé —, ou une écriture sans critères qui ferait relire quoi que
 *     ce soit.
 *
 * Les crochets sont montés pour de vrai — `createRoot` + `act` — sur un vrai `QueryClient` réglé comme celui de l'app
 * (`staleTime` de deux minutes) ; Supabase et Supabase Cache Helpers sont simulés.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { act, useEffect, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { IsRestoringProvider, QueryClient, QueryClientProvider } from '@tanstack/react-query'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Reponse = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  profile: null as null | { id: string; agency_id: string | null },
  /** Ce que rend `client_searches` à la prochaine lecture. */
  reponse: (): Promise<Reponse> => Promise.resolve({ data: [], error: null }),
  /** Chaque lecture de `client_searches` partie, et sa forme. */
  lectures: [] as { table: string; select: unknown[]; eq: unknown[][]; limit: unknown[] }[],
  /** Ce qu'a rendu `useRecherchesActives`, rendu après rendu. */
  vues: [] as string[],
  creer: null as null | Creer,
  modifier: null as null | Modifier,
}))

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u-1' }, profile: h.profile }) }))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const lecture = { table, select: [] as unknown[], eq: [] as unknown[][], limit: [] as unknown[] }
      const chaine = {
        select: (...a: unknown[]) => { lecture.select = a; return chaine },
        eq: (...a: unknown[]) => { lecture.eq.push(a); return chaine },
        limit: (...a: unknown[]) => { lecture.limit = a; h.lectures.push(lecture); return h.reponse() },
      }
      return chaine
    },
  },
}))

// Les écritures de contacts, réussies : ce qui est éprouvé, c'est ce qu'elles font relire APRÈS.
vi.mock('@supabase-cache-helpers/postgrest-react-query', () => ({
  useQuery: () => ({ data: undefined, isLoading: false, error: null }),
  useInsertMutation: () => ({ mutateAsync: (lignes: unknown[]) => Promise.resolve(lignes), isPending: false }),
  useUpdateMutation: () => ({ mutateAsync: (ligne: unknown) => Promise.resolve([ligne]), isPending: false }),
  useDeleteMutation: () => ({ mutateAsync: () => Promise.resolve(), isPending: false }),
}))
vi.mock('@/lib/intercom', () => ({ INTERCOM_EVENTS: { FIRST_CONTACTS_IMPORTED: 'first_contacts_imported' } }))
vi.mock('@/lib/intercom-milestones', () => ({ syncIntercomMilestones: () => Promise.resolve() }))

import { CLE_FIL } from '@/components/matching-fil/filModele'
import { useCreateContact, useUpdateContact } from '@/hooks/useContacts'
import { useRecherchesActives } from '@/hooks/useMatchingFil'
import { queryClient as clientApp } from '@/lib/queryClients'

type Creer = ReturnType<typeof useCreateContact>['mutateAsync']
type Modifier = ReturnType<typeof useUpdateContact>['mutateAsync']

const ACTIVE: Reponse = { data: [{ id: 'cs-1' }], error: null }
const ECHEC: Reponse = { data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } }

/** Ce que lit l'écran de Matching, rendu après rendu. */
function Lecteur() {
  const vue = useRecherchesActives()
  useEffect(() => { h.vues.push(vue) })
  return null
}

/** Les deux écritures de contacts, tenues par le test. */
function Ecrivain() {
  const creer = useCreateContact().mutateAsync
  const modifier = useUpdateContact().mutateAsync
  useEffect(() => { h.creer = creer; h.modifier = modifier })
  return null
}

let client: QueryClient
let hote: HTMLDivElement | null = null
let racine: Root | null = null

/** TanStack notifie ses observateurs par `setTimeout(0)` : les lectures en vol se posent. */
const laisserLire = () => act(async () => { await new Promise((r) => setTimeout(r, 10)) })

async function rendre(arbre: ReactNode): Promise<void> {
  if (!racine) {
    hote = document.createElement('div')
    document.body.appendChild(hote)
    racine = createRoot(hote)
  }
  await act(async () => { racine!.render(<QueryClientProvider client={client}>{arbre}</QueryClientProvider>) })
  await laisserLire()
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { ...clientApp.getDefaultOptions().queries, retry: false } } })
  h.profile = { id: 'u-1', agency_id: 'ag-1' }
  h.reponse = () => Promise.resolve({ data: [], error: null })
  h.lectures = []
  h.vues = []
  h.creer = null
  h.modifier = null
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  client.clear()
})

describe('useRecherchesActives — ce que la page 0 sait des recherches de l’agence', () => {
  it('une recherche active : « actives », d’une lecture légère — un identifiant, sous la RLS de l’agent', async () => {
    h.reponse = () => Promise.resolve(ACTIVE)
    await rendre(<Lecteur />)
    expect(h.vues.at(-1)).toBe('actives')
    expect(h.lectures).toEqual([{ table: 'client_searches', select: ['id'], eq: [['is_active', true]], limit: [1] }])
  })

  it('aucune : « chargement » le temps de la lire, puis « aucune »', async () => {
    await rendre(<Lecteur />)
    expect(h.vues[0]).toBe('chargement')
    expect(h.vues.at(-1)).toBe('aucune')
  })

  it('pendant que la session arrive : « chargement », sans lecture — jamais « aucune »', async () => {
    h.profile = null
    await rendre(<Lecteur />)
    expect(new Set(h.vues)).toEqual(new Set(['chargement']))
    expect(h.lectures).toHaveLength(0)
  })

  it('pendant la lecture : « chargement »', async () => {
    h.reponse = () => new Promise<Reponse>(() => undefined)
    await rendre(<Lecteur />)
    expect(h.lectures).toHaveLength(1)
    expect(new Set(h.vues)).toEqual(new Set(['chargement']))
  })

  it('un échec, rien de lu : « erreur » — l’état d’erreur du fil, jamais la couverture', async () => {
    h.reponse = () => Promise.resolve(ECHEC)
    await rendre(<Lecteur />)
    expect(h.vues.at(-1)).toBe('erreur')
    expect(h.vues).not.toContain('aucune')
  })

  it('un rafraîchissement en échec garde ce qui a été lu', async () => {
    h.reponse = () => Promise.resolve(ACTIVE)
    await rendre(<Lecteur />)
    h.reponse = () => Promise.resolve(ECHEC)
    await act(async () => { await client.invalidateQueries({ queryKey: [CLE_FIL] }) })
    await laisserLire()
    expect(h.lectures).toHaveLength(2)
    expect(h.vues.at(-1)).toBe('actives')
  })

  it('sous le préfixe du fil : l’invalider — « Réessayer », un geste — relit aussi les recherches', async () => {
    await rendre(<Lecteur />)
    h.reponse = () => Promise.resolve(ACTIVE)
    await act(async () => { await client.invalidateQueries({ queryKey: [CLE_FIL] }) })
    await laisserLire()
    expect(h.lectures).toHaveLength(2)
    expect(h.vues.at(-1)).toBe('actives')
  })

  it('une lecture par agence : ce qu’une agence a lu ne répond jamais pour une autre', async () => {
    await rendre(<Lecteur />)
    h.profile = { id: 'u-1', agency_id: 'ag-2' }
    h.reponse = () => Promise.resolve(ACTIVE)
    await rendre(<Lecteur />)
    expect(h.lectures).toHaveLength(2)
    expect(h.vues.at(-1)).toBe('actives')
    // De retour sur la première : sa propre lecture, encore fraîche.
    h.profile = { id: 'u-1', agency_id: 'ag-1' }
    await rendre(<Lecteur />)
    expect(h.lectures).toHaveLength(2)
    expect(h.vues.at(-1)).toBe('aucune')
  })

  it('sans agence, la lecture ne part pas : « aucune », une recherche appartenant toujours à une agence', async () => {
    h.profile = { id: 'u-1', agency_id: null }
    await rendre(<Lecteur />)
    expect(h.lectures).toHaveLength(0)
    expect(h.vues.at(-1)).toBe('aucune')
  })
})

describe('des critères écrits sur un contact relisent les recherches (`useContacts`)', () => {
  const RECHERCHES = [CLE_FIL, 'recherches', 'ag-1']
  const FIL = [CLE_FIL, 'ag-1']
  const ACHETEUR = {
    firstName: 'Julie', lastName: 'Sturm', email: null,
    search_criteria: { transaction: 'vente', cantons: ['GE'], budget_max: 1_300_000 },
  }
  let lectureRecherches: Mock<() => Promise<boolean>>
  let lectureFil: Mock<() => Promise<unknown>>

  /** Les deux lectures en cache et INACTIVES — l'écran de Matching fermé —, puis les écritures montées. */
  async function amorcer(): Promise<void> {
    lectureRecherches = vi.fn(() => Promise.resolve(false))
    lectureFil = vi.fn(() => Promise.resolve({ matchs: [] }))
    await client.fetchQuery({ queryKey: RECHERCHES, queryFn: lectureRecherches })
    await client.fetchQuery({ queryKey: FIL, queryFn: lectureFil })
    await rendre(<Ecrivain />)
  }

  it('un acheteur créé avec ses critères : les recherches relues aussitôt ; le fil marqué périmé, pas relu', async () => {
    await amorcer()
    await act(async () => { await h.creer!(ACHETEUR) })
    expect(lectureRecherches).toHaveBeenCalledTimes(2)
    expect(lectureFil).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(FIL)?.isInvalidated).toBe(true)
  })

  it('un contact créé sans critères : rien de relu, rien de périmé', async () => {
    await amorcer()
    await act(async () => { await h.creer!({ firstName: 'Marc', lastName: 'Keller', email: null }) })
    expect(lectureRecherches).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(RECHERCHES)?.isInvalidated).toBe(false)
    expect(client.getQueryState(FIL)?.isInvalidated).toBe(false)
  })

  it('des critères écrits sur la fiche, vidés, ou une agence changée : relues à chaque fois ; le fil marqué périmé', async () => {
    await amorcer()
    const ecritures = [
      { id: 'c-1', search_criteria: { transaction: 'location', cantons: ['VD'] } },
      // Vidés : le déclencheur désactive la recherche, et la couverture peut revenir.
      { id: 'c-1', search_criteria: null },
      { id: 'c-1', agency_id: 'ag-1' },
    ]
    for (const [i, ecriture] of ecritures.entries()) {
      await act(async () => { await h.modifier!(ecriture) })
      expect(lectureRecherches, JSON.stringify(ecriture)).toHaveBeenCalledTimes(i + 2)
    }
    expect(lectureFil).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(FIL)?.isInvalidated).toBe(true)
  })

  it('un autre champ — une note, un nom — : rien de relu, rien de périmé', async () => {
    await amorcer()
    await act(async () => { await h.modifier!({ id: 'c-1', notes: 'Rappeler jeudi' }) })
    await act(async () => { await h.modifier!({ id: 'c-1', first_name: 'Julia', last_name: 'Sturm' }) })
    expect(lectureRecherches).toHaveBeenCalledTimes(1)
    expect(client.getQueryState(FIL)?.isInvalidated).toBe(false)
  })

  it('la création ne rend la main qu’une fois les recherches relues : « Voir ses matchs » ne la devance pas', async () => {
    let relacher: (actives: boolean) => void = () => undefined
    lectureRecherches = vi.fn<() => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockImplementationOnce(() => new Promise<boolean>((r) => { relacher = r }))
    await client.fetchQuery({ queryKey: RECHERCHES, queryFn: lectureRecherches })
    await rendre(<Ecrivain />)
    let rendue = false
    let creation: Promise<void> = Promise.resolve()
    await act(async () => { creation = h.creer!(ACHETEUR).then(() => { rendue = true }) })
    await laisserLire()
    expect(lectureRecherches).toHaveBeenCalledTimes(2)
    expect(rendue).toBe(false)
    await act(async () => { relacher(true); await creation })
    expect(rendue).toBe(true)
    expect(client.getQueryData(RECHERCHES)).toBe(true)
  })

  it('l’écran de Matching caché pendant la création : de retour, « actives » dès le premier rendu, sans relire', async () => {
    // Un écran d'onglet caché est désabonné de ses requêtes (`IsRestoringProvider`, `AgentLayout`).
    const ecrans = (cache: boolean) => (
      <>
        <Ecrivain />
        <IsRestoringProvider value={cache}><Lecteur /></IsRestoringProvider>
      </>
    )
    await rendre(ecrans(false))
    expect(h.vues.at(-1)).toBe('aucune')
    await rendre(ecrans(true))
    // Le déclencheur active la recherche de l'acheteur, dans la transaction qui le crée.
    h.reponse = () => Promise.resolve(ACTIVE)
    await act(async () => { await h.creer!(ACHETEUR) })
    expect(h.lectures).toHaveLength(2)
    h.vues = []
    await rendre(ecrans(false))
    expect(h.vues[0]).toBe('actives')
    expect(new Set(h.vues)).toEqual(new Set(['actives']))
    expect(h.lectures).toHaveLength(2)
  })
})
