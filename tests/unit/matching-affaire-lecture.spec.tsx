/**
 * La lecture du matching de la fiche d'affaire (`useMatchingAffaire`, étape 5b-1, conception
 * `2026-09-30-fiche-affaire-matching-design.md` §6.2) : les biens de l'acheteur, par état, et les lignes que le
 * matching ajoute à l'historique de l'affaire.
 *
 * Ce que cette spec refuse :
 *   · des biens à proposer lus autrement que ceux de L'ACHETEUR, en `suggested`, par score puis id, vingt au plus ;
 *   · un journal lu ailleurs que sur le CONTACT, ou sans les trois actions du matching, ou qui garderait les lignes
 *     d'une autre affaire ;
 *   · une lecture hors de la clé du fil (`CLE_FIL`) — un geste consigné dans le fil ne la relirait pas —, ou sans
 *     l'acheteur dans sa clé ; d'autres colonnes que celles de « Sa boucle » (`COLONNES_BOUCLE`) ;
 *   · un « en lecture » perdu tant que l'une des lectures n'a pas rendu ; un second abonnement realtime ;
 *   · un bien compté deux fois quand « Sa boucle » le porte déjà ;
 *   · une lecture sans acheteur ;
 *   · un échec tu, ou un « Réessayer » qui ne relirait pas tout ; un rafraîchissement en échec qui effacerait des lignes
 *     déjà lues ; un report jugé à une autre heure que celle de la lecture.
 *
 * Le crochet est monté pour de vrai — `createRoot` + `act` — sur un vrai `QueryClient` ; Supabase est simulé : chaque
 * lecture est notée avec ses filtres, et sa réponse dépend d'eux.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface Lecture {
  table: string
  eq: [string, unknown][]
  in: [string, unknown][]
  gt: [string, unknown][]
  order: [string, unknown][]
  limit: number | null
  select: string | null
}
type Reponse = { data: unknown; error: unknown }

const h = vi.hoisted(() => ({
  lectures: [] as Lecture[],
  canaux: 0,
  repondre: (_l: Lecture): Promise<Reponse> => Promise.resolve({ data: [], error: null }),
}))

vi.mock('@/lib/supabase', () => {
  const canal = { on: () => canal, subscribe: () => canal }
  return {
    supabase: {
      channel: () => { h.canaux += 1; return canal },
      removeChannel: () => undefined,
      from: (table: string) => {
        const l: Lecture = { table, eq: [], in: [], gt: [], order: [], limit: null, select: null }
        const chaine = {
          select: (colonnes: string) => { l.select = colonnes; return chaine },
          eq: (c: string, v: unknown) => { l.eq.push([c, v]); return chaine },
          in: (c: string, v: unknown) => { l.in.push([c, v]); return chaine },
          gt: (c: string, v: unknown) => { l.gt.push([c, v]); return chaine },
          order: (c: string, o?: unknown) => { l.order.push([c, o ?? null]); return chaine },
          limit: (n: number) => { l.limit = n; return chaine },
          abortSignal: () => chaine,
          then: (ok: (r: Reponse) => unknown, ko: (e: unknown) => unknown) => {
            h.lectures.push(l)
            return h.repondre(l).then(ok, ko)
          },
        }
        return chaine
      },
    },
  }
})

import { CLE_FIL } from '@/components/matching-fil/filModele'
import { COLONNES_BOUCLE } from '@/hooks/useContactSentMatches'
import { useMatchingAffaire, type MatchingAffaire } from '@/hooks/useMatchingAffaire'

const annonce = (titre: string) => ({ title: titre, city: 'Genève', price: 1_500_000, current_price: 1_500_000, transaction_type: 'buy', status: 'active' })
const match = (id: string, status: string, score: number, sentAt: string | null = null) => ({
  id, status, score, sent_at: sentAt, response_at: null, reaction_motif: null, reaction_note: null, prix_propose: null,
  apprentissage_at: null, client_search_id: null, snoozed_until: null, property_id: null, market_listing_id: `ml-${id}`,
  market_listing: annonce(`Annonce ${id}`),
})

/** Le journal du contact : une proposition de CETTE affaire (m2), une d'une autre (m3). */
const JOURNAL = [
  { action: 'match_propose', created_at: '2026-09-29T08:00:00Z', metadata: { deal_id: 'd5', match_ids: ['m2'], nombre: 1 } },
  { action: 'match_propose', created_at: '2026-09-28T08:00:00Z', metadata: { deal_id: 'd9', match_ids: ['m3'], nombre: 1 } },
]

/**
 * Les réponses par défaut : « Sa boucle » porte m1 (proposé) ; les biens à proposer lus ramènent m1 aussi, m2 et m3 ; le
 * journal, `JOURNAL`.
 */
function repondreParDefaut(l: Lecture): Promise<Reponse> {
  if (l.table === 'activity_events') return Promise.resolve({ data: JOURNAL, error: null })
  const statut = l.eq.find(([c]) => c === 'status')?.[1]
  if (l.table === 'matches' && l.in.length) return Promise.resolve({ data: [match('m1', 'sent', 90, '2026-09-28T08:00:00Z')], error: null })
  if (l.table === 'matches' && statut === 'suggested' && l.gt.length) return Promise.resolve({ data: [], error: null })
  if (l.table === 'matches' && statut === 'suggested') {
    return Promise.resolve({ data: [match('m2', 'suggested', 99), match('m3', 'suggested', 97), match('m1', 'suggested', 90)], error: null })
  }
  return Promise.resolve({ data: [], error: null })
}

const vues: MatchingAffaire[] = []
function Lecteur({ contactId }: { contactId: string | undefined }) {
  const v = useMatchingAffaire(contactId, 'd5')
  useEffect(() => { vues.push(v) })
  return null
}

let hote: HTMLDivElement | null = null
let racine: Root | null = null
let client: QueryClient

async function monter(contactId: string | undefined): Promise<void> {
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  await act(async () => {
    racine!.render(<QueryClientProvider client={client}><Lecteur contactId={contactId} /></QueryClientProvider>)
  })
  // Les lectures résolues, puis leur rendu.
  await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

const derniere = (): MatchingAffaire => vues.at(-1)!
/** Les lectures des biens à proposer : `suggested`, sans le filtre des revenus de « Sa boucle ». */
const lecturesAProposer = () => h.lectures.filter((l) => l.table === 'matches' && !l.in.length && !l.gt.length)

beforeEach(() => {
  h.lectures = []
  h.canaux = 0
  h.repondre = repondreParDefaut
  vues.length = 0
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  client.clear()
})

describe('useMatchingAffaire', () => {
  it('les biens à proposer de L’ACHETEUR : `suggested`, par score puis id, vingt au plus', async () => {
    await monter('c9')
    const [l] = lecturesAProposer()
    expect(l).toMatchObject({
      select: COLONNES_BOUCLE,
      eq: [['contact_id', 'c9'], ['status', 'suggested']],
      order: [['score', { ascending: false }], ['id', null]],
      limit: 20,
    })
  })

  it('le journal du CONTACT : les trois actions du matching, du plus récent au plus ancien, cent au plus', async () => {
    await monter('c9')
    const [l] = h.lectures.filter((x) => x.table === 'activity_events')
    expect(l).toMatchObject({
      eq: [['entity_type', 'contact'], ['entity_id', 'c9']],
      in: [['action', ['match_propose', 'visit_scheduled', 'match_reaction']]],
      order: [['created_at', { ascending: false }], ['id', { ascending: false }]],
      limit: 100,
    })
  })

  it('le journal ne garde que les lignes de CETTE affaire, nommées par les biens lus', async () => {
    await monter('c9')
    expect(derniere().journal).toEqual([{ quand: '2026-09-29T08:00:00Z', genre: 'propose', bien: 'Annonce m2', nombre: 1 }])
  })

  it('le journal nomme aussi un bien que « Sa boucle » seule lit — ici, un proposé', async () => {
    h.repondre = (l) => {
      if (l.table === 'activity_events') {
        return Promise.resolve({ data: [{ action: 'match_propose', created_at: '2026-09-29T08:00:00Z', metadata: { deal_id: 'd5', match_ids: ['m1'], nombre: 1 } }], error: null })
      }
      // Les biens à proposer lus ne ramènent PAS m1 : seule « Sa boucle » le lit.
      if (l.table === 'matches' && !l.in.length && !l.gt.length) return Promise.resolve({ data: [match('m2', 'suggested', 99)], error: null })
      return repondreParDefaut(l)
    }
    await monter('c9')
    expect(derniere().journal).toEqual([{ quand: '2026-09-29T08:00:00Z', genre: 'propose', bien: 'Annonce m1', nombre: 1 }])
  })

  it('en lecture tant que le journal l’est', async () => {
    let liberer: () => void = () => undefined
    const attente = new Promise<void>((r) => { liberer = r })
    h.repondre = (l) => (l.table === 'activity_events' ? attente.then(() => repondreParDefaut(l)) : repondreParDefaut(l))
    await monter('c9')
    expect(derniere().isLoading).toBe(true)
    await act(async () => { liberer() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(derniere().isLoading).toBe(false)
  })

  it('un échec du journal se dit aussi, sans données déjà lues', async () => {
    h.repondre = (l) => (l.table === 'activity_events'
      ? Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } })
      : repondreParDefaut(l))
    await monter('c9')
    expect(derniere()).toMatchObject({ isError: true, aDesDonnees: false })
  })

  it('un bien que « Sa boucle » porte déjà n’est pas compté deux fois ; il y garde son état', async () => {
    await monter('c9')
    expect(derniere().lignes.map((b) => [b.id, b.etat.cle])).toEqual([['m1', 'propose'], ['m2', 'aProposer'], ['m3', 'aProposer']])
    expect(derniere().total).toBe(3)
  })

  it('sous la clé du fil : un geste consigné dans le fil (`CLE_FIL` invalidée) relit les biens à proposer', async () => {
    await monter('c9')
    expect(lecturesAProposer()).toHaveLength(1)
    await act(async () => { await client.invalidateQueries({ queryKey: [CLE_FIL] }) })
    expect(lecturesAProposer()).toHaveLength(2)
  })

  it('chaque lecture sous la clé du fil, à l’acheteur près : deux fiches ne partagent pas leurs biens', async () => {
    await monter('c9')
    // TOUTES les lectures du cache, pas celles d'un préfixe : une lecture hors de `CLE_FIL` se verrait.
    const cles = client.getQueryCache().getAll().map((q) => q.queryKey)
    expect(cles).toEqual(expect.arrayContaining([[CLE_FIL, 'affaire-a-proposer', 'c9'], [CLE_FIL, 'sa-boucle', 'c9']]))
    expect(cles.every((k) => k[0] === CLE_FIL && k.at(-1) === 'c9'), JSON.stringify(cles)).toBe(true)
  })

  it('« Sa boucle » telle quelle : un seul abonnement realtime', async () => {
    await monter('c9')
    expect(h.canaux).toBe(1)
  })

  it('« Réessayer » garde son identité d’un rendu à l’autre', async () => {
    await monter('c9')
    expect(vues.length).toBeGreaterThan(1)
    expect(new Set(vues.map((v) => v.refetch)).size).toBe(1)
  })

  it('en lecture tant que les biens à proposer le sont', async () => {
    let liberer: () => void = () => undefined
    const attente = new Promise<void>((r) => { liberer = r })
    h.repondre = (l) => (l.table === 'matches' && !l.in.length && !l.gt.length ? attente.then(() => repondreParDefaut(l)) : repondreParDefaut(l))
    await monter('c9')
    expect(derniere().isLoading).toBe(true)
    await act(async () => { liberer() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(derniere().isLoading).toBe(false)
  })

  it('en lecture aussi tant que « Sa boucle » l’est — elle rend d’ordinaire après, ayant ses recherches à relire', async () => {
    let liberer: () => void = () => undefined
    const attente = new Promise<void>((r) => { liberer = r })
    h.repondre = (l) => (l.table === 'matches' && (l.in.length > 0 || l.gt.length > 0) ? attente.then(() => repondreParDefaut(l)) : repondreParDefaut(l))
    await monter('c9')
    expect(derniere().isLoading).toBe(true)
    await act(async () => { liberer() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(derniere().isLoading).toBe(false)
  })

  it('sans acheteur, aucune lecture', async () => {
    await monter(undefined)
    expect(h.lectures).toEqual([])
    expect(derniere()).toMatchObject({ lignes: [], total: 0, journal: [], isLoading: false, isError: false })
  })

  it('sans acheteur, « Réessayer » ne lit rien non plus : `refetch` passe outre `enabled`', async () => {
    await monter(undefined)
    await act(async () => { await derniere().refetch() })
    expect(h.lectures).toEqual([])
  })

  it('un échec de « Sa boucle » se dit aussi : sans elle, un bien proposé se lirait « à proposer »', async () => {
    h.repondre = (l) => (l.table === 'matches' && l.in.length
      ? Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } })
      : repondreParDefaut(l))
    await monter('c9')
    expect(derniere()).toMatchObject({ isError: true, aDesDonnees: false })
  })

  it('un rafraîchissement en échec garde ses lignes (`aDesDonnees`) : le bloc ne les remplace pas par l’erreur', async () => {
    await monter('c9')
    expect(derniere()).toMatchObject({ isError: false, aDesDonnees: true })
    h.repondre = (l) => (l.table === 'matches' && !l.in.length && !l.gt.length
      ? Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } })
      : repondreParDefaut(l))
    await act(async () => { await client.invalidateQueries({ queryKey: [CLE_FIL] }) })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(derniere()).toMatchObject({ isError: true, aDesDonnees: true })
    expect(derniere().lignes).toHaveLength(3)
  })

  it('un report se juge à l’heure de la lecture : échu, le bien revient à proposer ; à venir, il attend', async () => {
    h.repondre = (l) => (l.table === 'matches' && !l.in.length && !l.gt.length
      ? Promise.resolve({ data: [{ ...match('m2', 'suggested', 99), snoozed_until: '2020-01-01T00:00:00Z' },
        { ...match('m3', 'suggested', 97), snoozed_until: '2999-01-01T00:00:00Z' }], error: null })
      : repondreParDefaut(l))
    await monter('c9')
    expect(derniere().lignes.map((b) => [b.id, b.etat.cle])).toEqual([['m1', 'propose'], ['m2', 'aProposer']])
  })

  it('un échec se dit ; « Réessayer » relit tout', async () => {
    h.repondre = (l) => (l.table === 'matches' && !l.in.length && !l.gt.length
      ? Promise.resolve({ data: null, error: { code: '57014', message: 'canceling statement due to statement timeout' } })
      : repondreParDefaut(l))
    await monter('c9')
    expect(derniere()).toMatchObject({ isError: true, aDesDonnees: false })
    h.repondre = repondreParDefaut
    const avant = h.lectures.length
    await act(async () => { await derniere().refetch() })
    await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
    expect(derniere().isError).toBe(false)
    // « Sa boucle » (ses deux lectures de matchs), les biens à proposer et le journal.
    expect(h.lectures.length - avant).toBe(4)
  })
})
