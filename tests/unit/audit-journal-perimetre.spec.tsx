/**
 * Garde-fou : `/dashboard/audit` lit le journal de L'AGENCE du profil — posée en
 * clair dans la requête — et ne lit RIEN sans agence.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * `useAuditEvents` ne filtrait pas l'agence : il s'en remettait à la RLS. Or deux
 * policies SELECT PERMISSIVES s'additionnent sur `activity_events` —
 * `events_select` (`agency_id = get_my_agency_id()`) ET `super_admin_read_all_events`
 * (`is_super_admin()`, toutes agences). Le super-admin de production n'a pas
 * d'agence (mesuré le 13.09.2026) : sa page d'audit du CRM listait la PLATEFORME —
 * 1 189 événements sur 30 jours, six agences mêlées — et son export CSV emportait
 * ce journal, `ip_address` et `metadata` compris. Le bouton PDF, lui, appelait
 * `audit-pdf-export` sans `agency_id`, donc la branche « Plateforme MEGGA » que la
 * décision du 14.08.2026 réserve à la console.
 *
 * Le filtre explicite a un second effet, mesuré par EXPLAIN : sans lui la RLS arrive
 * en `is_super_admin() OR agency_id = …`, un Filter ; avec lui, une Index Cond sur
 * `idx_activity_events_audit_filters` — l'index fait pour cette page.
 *
 * ── CE QUE LA GARDE FIGE ─────────────────────────────────────────────────────
 * Le COMPORTEMENT du hook, monté pour de vrai sous React Query, avec un client
 * Supabase qui journalise chaque appel de la chaîne : agence → `eq agency_id` ;
 * sans agence → aucun `from`. Et, statiquement, le `disabled` du bouton PDF.
 * Monter AuditPage entière coûterait la coquille du CRM pour une ligne.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { createElement, act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query'
import { readFileSafely, repoPath } from './helpers/fs-scan'
import type { AuditEvent } from '@/types/kyc'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/**
 * ⚠ `vi.hoisted` : les deux fabriques de `vi.mock` sont remontées au-dessus de tout le
 * fichier, et elles LISENT ce journal et ce profil. Déclarés en `const` ordinaires,
 * ils seraient encore dans leur zone morte au moment où la fabrique s'exécute.
 */
const { journal, etat, chaine } = vi.hoisted(() => {
  const journal: Array<[string, unknown[]]> = []
  const etat: { profil: { role: string; agency_id: string | null } | null } = { profil: null }
  /** Chaîne PostgREST factice : chaque méthode s'inscrit et rend la chaîne ; `await` rend une page vide. */
  const chaine = (): unknown => {
    const proxy: unknown = new Proxy({}, {
      get(_cible, cle) {
        if (cle === 'then') {
          return (resoudre: (v: unknown) => void) => resoudre({ data: [], error: null })
        }
        return (...args: unknown[]) => {
          journal.push([String(cle), args])
          return proxy
        }
      },
    })
    return proxy
  }
  return { journal, etat, chaine }
})

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ profile: etat.profil, user: etat.profil ? { id: 'u1' } : null }),
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      journal.push(['from', [table]])
      return chaine()
    },
  },
}))

const { useAuditEvents } = await import('@/hooks/useAuditLog')

let racine: Root | null = null
let hote: HTMLDivElement | null = null
let client: QueryClient
const sortie: { q: UseQueryResult<AuditEvent[]> | null } = { q: null }

/** La sonde : le hook, et son dernier état remonté par un effet (jamais écrit pendant le rendu). */
function Sonde({ remonter }: { remonter: (q: UseQueryResult<AuditEvent[]>) => void }) {
  const q = useAuditEvents({ days: 30, category: 'kyc' })
  useEffect(() => { remonter(q) })
  return null
}
const remonter = (q: UseQueryResult<AuditEvent[]>) => { sortie.q = q }

/** Laisse React Query lancer (ou ne pas lancer) sa requête et la résoudre. */
const vider = () => act(async () => { await new Promise((r) => setTimeout(r, 0)) })

async function monter() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  hote = document.createElement('div')
  document.body.appendChild(hote)
  racine = createRoot(hote)
  act(() => racine!.render(createElement(QueryClientProvider, { client }, createElement(Sonde, { remonter }))))
  await vider()
}

async function rerendre() {
  act(() => racine!.render(createElement(QueryClientProvider, { client }, createElement(Sonde, { remonter }))))
  await vider()
}

const appels = (nom: string) => journal.filter(([n]) => n === nom).map(([, a]) => a)
const froms = () => appels('from').filter(([t]) => t === 'activity_events')

afterEach(() => {
  if (racine) act(() => racine!.unmount())
  racine = null
  hote?.remove()
  hote = null
  client?.clear()
  journal.length = 0
  etat.profil = null
  sortie.q = null
})

describe('/dashboard/audit — le périmètre est l’agence du profil', () => {
  it('(a) agent d’une agence : la requête porte `eq agency_id` EN CLAIR', async () => {
    etat.profil = { role: 'agent', agency_id: 'agence-A' }
    await monter()
    expect(froms(), 'la page doit lire activity_events').toHaveLength(1)
    expect(appels('eq'), 'sans filtre explicite, la RLS du super-admin rend la plateforme')
      .toContainEqual(['agency_id', 'agence-A'])
    expect(appels('eq'), 'le filtre de catégorie reste posé').toContainEqual(['category', 'kyc'])
  })

  it('(b) super-admin SANS agence (la forme de la production) : aucune lecture', async () => {
    etat.profil = { role: 'super_admin', agency_id: null }
    await monter()
    expect(froms(), 'sans agence, la page lisait le journal de TOUTE la plateforme').toHaveLength(0)
    // L'état vide existant (`audit.empty`) prend le relais : pas de chargement infini.
    expect(sortie.q?.isLoading).toBe(false)
    expect(sortie.q?.fetchStatus).toBe('idle')
  })

  it('(c) profil pas encore chargé : aucune lecture', async () => {
    etat.profil = null
    await monter()
    expect(froms()).toHaveLength(0)
  })

  it('(d) changement d’agence : nouvelle lecture, la clé de cache porte l’agence', async () => {
    etat.profil = { role: 'agent', agency_id: 'agence-A' }
    await monter()
    etat.profil = { role: 'agent', agency_id: 'agence-B' }
    await rerendre()
    expect(froms(), 'un second compte ne doit pas hériter du cache du premier').toHaveLength(2)
    expect(appels('eq')).toContainEqual(['agency_id', 'agence-B'])
  })

  it('le bouton PDF est désactivé sans agence — sinon l’export part en « Plateforme MEGGA »', () => {
    const r = readFileSafely(repoPath('src', 'pages', 'agent', 'AuditPage.tsx'))
    expect(r.status).toBe('ok')
    const code = (r.status === 'ok' ? r.value : '')
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/\/\/[^\n]*/g, ' ')
    const appel = code.indexOf('downloadAuditPdf(')
    expect(appel, 'appel de downloadAuditPdf introuvable : la garde ne mesure plus rien').toBeGreaterThan(-1)
    const ouverture = code.lastIndexOf('<KycBlackPill', appel)
    expect(ouverture, 'le bouton qui appelle downloadAuditPdf n’est plus un KycBlackPill').toBeGreaterThan(-1)
    const disabled = /disabled=\{([^}]*)\}/.exec(code.slice(ouverture, appel))
    expect(disabled?.[1], '`disabled` du bouton PDF').toMatch(/agency_?[iI]d/)
  })
})
