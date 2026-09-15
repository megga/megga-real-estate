/**
 * Le statut et la suppression dans le VRAI `CalendarApp` (revue de sécurité du 15.09.2026).
 *
 * ⛔ Deux défauts, rejoués ici comme un navigateur les produit — clics réels, React 19 du
 * dépôt, aucun `act` :
 *  - « Marquer terminé » calculait sa bascule DANS l'updater de `setStatuses` et la lisait
 *    aussitôt. Quand React diffère l'updater — après l'extinction d'un toast —, le geste disait
 *    « Marqué à faire », n'enregistrait rien pour une visite ou une tâche, et écrivait
 *    `status: null` sur un événement.
 *  - Sur UNE occurrence d'une série, « Supprimer » et « Marquer terminé » écrivaient la ligne
 *    maîtresse : toute la série effacée d'un clic, ou « terminée » d'un coup.
 *
 * Les hooks de données sont doublés (aucun réseau) ; `useCalendarScreen` l'est par un magasin
 * lu via `useSyncExternalStore`, comme TanStack Query fait rendre l'écran quand une requête
 * revient. Idiome createRoot (le dépôt n'a pas @testing-library/react).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useSyncExternalStore, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { CalEvent } from '@/components/crm/calendar/data'

const h = vi.hoisted(() => {
  let events: unknown[] = []
  const listeners = new Set<() => void>()
  const EMPTY: unknown[] = []
  return {
    EMPTY,
    get: () => events,
    set: (e: unknown[]) => { events = e; listeners.forEach((l) => l()) },
    subscribe: (l: () => void) => { listeners.add(l); return () => { listeners.delete(l) } },
    creer: vi.fn(async () => 'new-id'),
    modifier: vi.fn(async (_id: string, _patch: Record<string, unknown>) => {}),
    supprimer: vi.fn(async (_id: string) => {}),
    createVisit: vi.fn(async () => ({ id: 'nv' })),
    updateVisit: vi.fn(async (_v: Record<string, unknown>) => {}),
    deleteVisit: vi.fn(async () => {}),
    createReminder: vi.fn(async () => ({})),
    markAsDone: vi.fn(),
    cancel: vi.fn(),
    reschedule: vi.fn(async () => {}),
    labels: {
      labels: EMPTY, assignments: new Map<string, string>(),
      setEventLabel: { mutateAsync: vi.fn(async () => {}) },
      create: { mutateAsync: vi.fn(async () => {}), isPending: false },
      update: { mutateAsync: vi.fn(async () => {}), isPending: false },
      remove: { mutateAsync: vi.fn(async () => {}), isPending: false },
      isLoading: false, error: null,
    },
    google: { isConnected: false }, outlook: { isConnected: false },
  }
})

vi.mock('@/hooks/useCalendarScreen', () => ({
  useCalendarScreen: () => {
    const events = useSyncExternalStore(h.subscribe, h.get)
    // Le Calendrier lit les SÉRIES (il les développe après ses surcharges) ; `events`, les
    // occurrences des autres écrans, lui est vide ici — le lire n'afficherait rien.
    return { events: [], series: events, hotBuyers: [], isLoading: false, isError: false, refetch: () => {} }
  },
}))
vi.mock('@/hooks/useCalendarEvents', () => ({ useCalendarEvents: () => ({ creer: h.creer, modifier: h.modifier, supprimer: h.supprimer }) }))
vi.mock('@/hooks/useVisits', () => ({ useVisits: () => ({ createVisit: h.createVisit, updateVisit: h.updateVisit, deleteVisit: h.deleteVisit }) }))
vi.mock('@/hooks/useReminders', () => ({ useReminders: () => ({ createReminder: h.createReminder, markAsDone: h.markAsDone, cancel: h.cancel, reschedule: h.reschedule }) }))
vi.mock('@/hooks/useCalendarLabels', () => ({ useCalendarLabels: () => h.labels }))
vi.mock('@/hooks/useCalendarExternal', () => ({ useCalendarExternal: () => ({ externalEvents: h.EMPTY, google: h.google, outlook: h.outlook }) }))
vi.mock('@/components/crm/CrmWorkspace', () => ({ default: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/hooks/useContacts', () => ({ useContacts: () => ({ data: [], isLoading: false }) }))
vi.mock('@/hooks/useProperties', () => ({ useAgencyProperties: () => ({ data: [], isLoading: false }) }))
vi.mock('@/lib/supabase', () => ({ supabase: {} }))

import { CalendarApp } from '@/components/crm/calendar/CalendarApp'

const attendre = (ms = 40) => new Promise((r) => setTimeout(r, ms))
/** Plus que la vie d'un toast (3,2 s) : son extinction rend l'écran « propre ». */
const TOAST_ETEINT = 3400
const a = (jours: number, hh: number) => { const d = new Date(); d.setDate(d.getDate() + jours); d.setHours(hh, 0, 0, 0); return d }
const plus = (d: Date, min: number) => new Date(d.getTime() + min * 60000)
const DEBUT_SERIE = a(-21, 8)
/** La clé de l'occurrence du jour dans la série (`AAAA-M-J`). */
const cleDuJour = (() => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` })()

function evenements(): CalEvent[] {
  return [
    { id: 'e1', origin: 'event', type: 'notary', title: 'Notaire Dupont', start: a(0, 10), end: plus(a(0, 10), 60) },
    { id: 'e2', origin: 'event', type: 'mandate', title: 'Mandat Favre', start: a(0, 12), end: plus(a(0, 12), 60) },
    { id: 'v1', origin: 'visit', type: 'visite', title: 'Visite Martin', start: a(0, 14), end: plus(a(0, 14), 60) },
    { id: 'r1', origin: 'reminder', type: 'task', title: 'Relance Rochat', start: a(0, 16), end: plus(a(0, 16), 30) },
    // Une série hebdomadaire née il y a trois semaines : l'occurrence du jour est `s1@<clé>`.
    { id: 's1', origin: 'event', type: 'autre', title: 'Point hebdo', start: DEBUT_SERIE, end: plus(DEBUT_SERIE, 60), recurrence: { freq: 'weekly', until: null } },
  ] as CalEvent[]
}

const texte = () => document.body.textContent ?? ''
const bulle = (): HTMLElement | null => document.querySelector('[role="dialog"]')
function bloc(titre: string): HTMLButtonElement {
  const b = Array.from(document.querySelectorAll('button')).find((x) => x.textContent?.includes(titre) && x.style.position === 'absolute')
  if (!b) throw new Error(`bloc introuvable : ${titre}`)
  return b as HTMLButtonElement
}
function boutonStatut(): HTMLButtonElement {
  const b = Array.from(bulle()?.querySelectorAll('button') ?? []).find((x) => /Marquer terminé|^Terminé$/.test((x.textContent ?? '').trim()))
  if (!b) throw new Error('bouton de statut introuvable')
  return b as HTMLButtonElement
}
async function ouvrir(titre: string) {
  // La bulle ouverte pose un voile plein écran : on la ferme d'abord.
  if (bulle()) { (bulle()!.previousElementSibling as HTMLElement).click(); await attendre() }
  bloc(titre).click(); await attendre()
  if (!bulle()) throw new Error(`bulle non ouverte pour ${titre}`)
}

async function monter() {
  h.set(evenements())
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  root.render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/dashboard/calendar']}>
        <CalendarApp dark={false} setDark={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  await attendre(80)
  return root
}

beforeEach(() => {
  document.body.innerHTML = ''
  for (const k of ['creer', 'modifier', 'supprimer', 'createVisit', 'updateVisit', 'deleteVisit', 'createReminder', 'markAsDone', 'cancel', 'reschedule'] as const) h[k].mockClear()
})

describe('« Marquer terminé » : la bascule se décide hors de l’updater', () => {
  it('⛔ après l’extinction d’un toast, un événement est bien marqué terminé — pas remis à null', async () => {
    const root = await monter()
    await ouvrir('Notaire Dupont')
    boutonStatut().click(); await attendre()
    expect(h.modifier).toHaveBeenLastCalledWith('e1', { status: 'done' })
    await ouvrir('Mandat Favre')
    await attendre(TOAST_ETEINT)
    h.modifier.mockClear()
    boutonStatut().click(); await attendre()
    expect(h.modifier).toHaveBeenCalledWith('e2', { status: 'done' })
    expect(texte()).toContain('Marqué terminé')
    expect(boutonStatut().textContent?.trim()).toBe('Terminé')
    root.unmount()
  }, 20_000)

  it('⛔ la même séquence enregistre une visite, puis une tâche', async () => {
    const root = await monter()
    await ouvrir('Notaire Dupont')
    boutonStatut().click(); await attendre()
    await ouvrir('Visite Martin')
    await attendre(TOAST_ETEINT)
    boutonStatut().click(); await attendre()
    expect(h.updateVisit).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1', visitStatus: 'done' }))
    await ouvrir('Relance Rochat')
    await attendre(TOAST_ETEINT)
    boutonStatut().click(); await attendre()
    expect(h.markAsDone).toHaveBeenCalledWith('r1')
    root.unmount()
  }, 20_000)

  it('un événement se décoche comme il se coche, toast éteint ou non', async () => {
    const root = await monter()
    await ouvrir('Notaire Dupont')
    boutonStatut().click(); await attendre()
    await attendre(TOAST_ETEINT)
    boutonStatut().click(); await attendre()
    boutonStatut().click(); await attendre()
    expect(h.modifier.mock.calls.map((c) => c[1])).toEqual([{ status: 'done' }, { status: null }, { status: 'done' }])
    expect(boutonStatut().textContent?.trim()).toBe('Terminé')
    root.unmount()
  }, 20_000)
})

describe('une occurrence n’est pas la série', () => {
  it('⛔ « Marquer terminé » sur l’occurrence du jour : elle seule, rangée dans la série', async () => {
    const root = await monter()
    await ouvrir('Point hebdo')
    boutonStatut().click(); await attendre()
    expect(h.modifier).toHaveBeenCalledTimes(1)
    const [id, patch] = h.modifier.mock.calls[0]
    expect(id).toBe('s1')
    expect(patch).not.toHaveProperty('status')
    expect(patch).toEqual({ recurrence: { freq: 'weekly', until: null, etats: { [cleDuJour]: 'done' } } })
    // Décochée, elle quitte les états — la série n'a jamais été touchée.
    boutonStatut().click(); await attendre()
    expect(h.modifier.mock.calls[1]).toEqual(['s1', { recurrence: { freq: 'weekly', until: null, etats: {} } }])
    root.unmount()
  })

  it('⛔ « Supprimer » sur l’occurrence du jour la retire de la série — la série reste', async () => {
    const root = await monter()
    await ouvrir('Point hebdo')
    const corbeille = bulle()!.querySelector('button[title="Supprimer"]') as HTMLButtonElement
    corbeille.click(); await attendre()
    expect(h.supprimer).not.toHaveBeenCalled()
    expect(h.modifier).toHaveBeenCalledWith('s1', { recurrence: { freq: 'weekly', until: null, sauf: [cleDuJour] } })
    // La base relue porte l'exception : la semaine suivante montre toujours la série.
    h.set(evenements().map((e) => (e.id === 's1' ? { ...e, recurrence: { freq: 'weekly', until: null, sauf: [cleDuJour] } } : e)))
    await attendre()
    const suivant = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title') === 'Suivant')!
    suivant.click(); await attendre()
    expect(Array.from(document.querySelectorAll('button')).some((b) => b.textContent?.includes('Point hebdo'))).toBe(true)
    root.unmount()
  })

  it('deux occurrences cochées d’affilée : la seconde écriture garde la première', async () => {
    const root = await monter()
    await ouvrir('Point hebdo')
    boutonStatut().click(); await attendre()
    const suivant = Array.from(document.querySelectorAll('button')).find((b) => b.getAttribute('title') === 'Suivant')!
    ;(bulle()!.previousElementSibling as HTMLElement).click(); await attendre()
    suivant.click(); await attendre()
    await ouvrir('Point hebdo')
    boutonStatut().click(); await attendre()
    const etats = (h.modifier.mock.calls[1][1] as { recurrence: { etats: Record<string, string> } }).recurrence.etats
    expect(Object.keys(etats)).toHaveLength(2)
    expect(etats[cleDuJour]).toBe('done')
    root.unmount()
  })
})
