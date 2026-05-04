import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Vendor dossiers — local-first store synced to Supabase when authenticated.
//
// Pattern identique à useSavedSearches v2 :
//   - Anonyme : localStorage uniquement
//   - Connecté : merge localStorage → DB au premier login (idempotent),
//     puis bascule en mode DB-first
//   - Toutes les mutations passent par DB si user connecté, sinon localStorage

export const PIPELINE_STEPS = [
  { key: 'received', label: 'Reçu', sub: 'Dossier transmis' },
  { key: 'reviewing', label: 'Examen', sub: "L'agent étudie" },
  { key: 'estimated', label: 'Estimation', sub: 'Fourchette proposée' },
  { key: 'mandate', label: 'Mandat', sub: 'Contrat signé' },
  { key: 'live', label: 'En ligne', sub: 'Annonce publiée' },
  { key: 'visits', label: 'Visites', sub: 'Acquéreurs reçus' },
  { key: 'sold', label: 'Vendu', sub: 'Acte signé' },
] as const

export type PipelineStatus = (typeof PIPELINE_STEPS)[number]['key']

export interface VendorDossier {
  id: string
  title: string
  transaction: 'vente' | 'location'
  propertyType: 'appartement' | 'maison' | 'terrain' | 'commercial'
  address: string
  surface: string | number
  rooms: number | string | null
  photos: number
  status: PipelineStatus
  statusHistory: Array<{ status: PipelineStatus; at: number; label: string }>
  createdAt: number
  agent: { name: string; role: string; initials: string }
  estimation?: {
    low: number
    mid: number
    high: number
    isRent: boolean
    comparables: Array<{ addr: string; surface: number; price: number; sold: string }>
    note: string
    issuedAt: number
  }
  publication?: {
    publicId: string
    publishedAt: number
    views: number
    contacts: number
    favorites: number
    visits: number
    listingPrice: number
  }
  nextAction?: { label: string; due: number }
  msgId?: string
}

const STORAGE_KEY = 'megga-vendor-dossiers-v1'

const STATUS_LABELS: Record<PipelineStatus, string> = {
  received: 'Dossier reçu',
  reviewing: "En cours d'examen",
  estimated: 'Estimation reçue',
  mandate: 'Mandat signé',
  live: 'Annonce en ligne',
  visits: 'Visites en cours',
  sold: 'Vendu',
}

const TYPE_LABELS: Record<VendorDossier['propertyType'], string> = {
  appartement: 'Appartement',
  maison: 'Maison',
  terrain: 'Terrain',
  commercial: 'Local commercial',
}

const AGENTS = [
  { name: 'Marc Dubois', role: 'Agent · Genève', initials: 'MD' },
  { name: 'Sophie Martin', role: 'Agente · Lausanne', initials: 'SM' },
  { name: 'Thomas Berger', role: 'Agent · Zürich', initials: 'TB' },
  { name: 'Léa Clément', role: 'Agente · Vaud', initials: 'LC' },
]

// ─── localStorage helpers ─────────────────────────────────────────────────

function loadLocal(): VendorDossier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VendorDossier[]) : []
  } catch {
    return []
  }
}

function saveLocal(items: VendorDossier[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

function clearLocal() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

// ─── DB row ↔ frontend type mapping ───────────────────────────────────────

interface DbRow {
  id: string
  user_id: string
  title: string
  transaction: VendorDossier['transaction']
  property_type: VendorDossier['propertyType']
  address: string
  surface: string | null
  rooms: number | null
  photos_count: number
  status: PipelineStatus
  status_history: VendorDossier['statusHistory']
  agent: VendorDossier['agent']
  estimation: VendorDossier['estimation'] | null
  publication: VendorDossier['publication'] | null
  next_action: VendorDossier['nextAction'] | null
  msg_id: string | null
  created_at: string
  updated_at: string
}

function dbToFrontend(row: DbRow): VendorDossier {
  return {
    id: row.id,
    title: row.title,
    transaction: row.transaction,
    propertyType: row.property_type,
    address: row.address,
    surface: row.surface ?? '',
    rooms: row.rooms,
    photos: row.photos_count,
    status: row.status,
    statusHistory: row.status_history ?? [],
    createdAt: new Date(row.created_at).getTime(),
    agent: row.agent,
    estimation: row.estimation ?? undefined,
    publication: row.publication ?? undefined,
    nextAction: row.next_action ?? undefined,
    msgId: row.msg_id ?? undefined,
  }
}

function frontendToDb(d: VendorDossier, userId: string): Omit<DbRow, 'created_at' | 'updated_at'> {
  return {
    id: d.id,
    user_id: userId,
    title: d.title,
    transaction: d.transaction,
    property_type: d.propertyType,
    address: d.address,
    surface: typeof d.surface === 'number' ? String(d.surface) : d.surface || null,
    rooms: typeof d.rooms === 'number' ? d.rooms : null,
    photos_count: d.photos,
    status: d.status,
    status_history: d.statusHistory,
    agent: d.agent,
    estimation: d.estimation ?? null,
    publication: d.publication ?? null,
    next_action: d.nextAction ?? null,
    msg_id: d.msgId ?? null,
  }
}

// ─── Singleton state ──────────────────────────────────────────────────────

let cache: VendorDossier[] = typeof window === 'undefined' ? [] : loadLocal()
const listeners = new Set<() => void>()
let migratedUserId: string | null = null

function notify() {
  listeners.forEach((fn) => fn())
}

// ─── DB sync ──────────────────────────────────────────────────────────────

async function fetchRemote(userId: string): Promise<VendorDossier[]> {
  const { data, error } = await supabase
    .from('vendor_dossiers')
    .select(
      'id, user_id, title, transaction, property_type, address, surface, rooms, photos_count, status, status_history, agent, estimation, publication, next_action, msg_id, created_at, updated_at'
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) return []
  return ((data ?? []) as DbRow[]).map(dbToFrontend)
}

async function upsertRemote(d: VendorDossier, userId: string) {
  await supabase.from('vendor_dossiers').upsert(frontendToDb(d, userId))
}

async function deleteRemote(id: string, userId: string) {
  await supabase.from('vendor_dossiers').delete().match({ id, user_id: userId })
}

async function migrateOnLogin(userId: string) {
  if (migratedUserId === userId) return
  migratedUserId = userId

  const local = loadLocal()
  const remote = await fetchRemote(userId)

  // Push local-only dossiers to remote (idempotent — id is the same)
  const remoteIds = new Set(remote.map((d) => d.id))
  const onlyLocal = local.filter((d) => !remoteIds.has(d.id))
  if (onlyLocal.length > 0) {
    await Promise.all(onlyLocal.map((d) => upsertRemote(d, userId)))
  }

  // Use union (remote + local-only) as the new cache, sorted by createdAt
  const union = [...remote, ...onlyLocal].sort((a, b) => b.createdAt - a.createdAt)
  cache = union
  saveLocal(union)
  notify()
}

function resetSync() {
  migratedUserId = null
  // Reload from localStorage (anonymous mode)
  cache = loadLocal()
  notify()
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useVendorDossiers() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  // Sync with auth user on mount + auth changes
  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data.user) {
        migrateOnLogin(data.user.id).catch(() => {
          /* silent — fall back to local */
        })
      } else {
        resetSync()
      }
    }
    run()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        migrateOnLogin(session.user.id).catch(() => {
          /* silent */
        })
      } else {
        resetSync()
      }
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [])

  const submit = useCallback(
    (input: Partial<VendorDossier> & {
      propertyType: VendorDossier['propertyType']
      transaction: VendorDossier['transaction']
      address: string
    }) => {
      const id = `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      const agent = AGENTS[cache.length % AGENTS.length]
      const now = Date.now()

      const typeLabel = TYPE_LABELS[input.propertyType]
      const baseTitle =
        input.title?.trim() ||
        `${typeLabel}${input.rooms ? ` ${input.rooms} pces` : ''}${
          input.address ? ` · ${input.address.split(',')[0]}` : ''
        }`

      const dossier: VendorDossier = {
        id,
        title: baseTitle,
        transaction: input.transaction,
        propertyType: input.propertyType,
        address: input.address,
        surface: input.surface ?? '',
        rooms: input.rooms ?? null,
        photos: input.photos ?? 0,
        status: 'received',
        statusHistory: [{ status: 'received', at: now, label: STATUS_LABELS.received }],
        createdAt: now,
        agent,
        nextAction: { label: "L'agent vous contacte sous 48h", due: now + 48 * 3600 * 1000 },
      }

      cache = [dossier, ...cache]
      saveLocal(cache)
      notify()

      // Write-through to DB if synced
      if (migratedUserId) {
        upsertRemote(dossier, migratedUserId).catch(() => {
          /* silent */
        })
      }
      return dossier
    },
    []
  )

  const advance = useCallback((id: string, status: PipelineStatus) => {
    cache = cache.map((d) => {
      if (d.id !== id) return d
      const next: VendorDossier = {
        ...d,
        status,
        statusHistory: [
          ...d.statusHistory,
          { status, at: Date.now(), label: STATUS_LABELS[status] || status },
        ],
      }

      if (status === 'estimated' && !next.estimation) {
        const surface = Number(d.surface) || 100
        const isLand = d.propertyType === 'terrain'
        const isRent = d.transaction === 'location'
        const baseM2 = isRent ? 35 : isLand ? 1800 : 11500
        const mid = Math.round((surface * baseM2) / 1000) * 1000
        const lo = Math.round((mid * 0.92) / 1000) * 1000
        const hi = Math.round((mid * 1.08) / 1000) * 1000
        next.estimation = {
          low: lo,
          mid,
          high: hi,
          isRent,
          comparables: [
            { addr: 'Rue voisine 8', surface: surface - 6, price: Math.round((mid * 0.95) / 1000) * 1000, sold: 'il y a 2 mois' },
            { addr: 'Avenue centrale 21', surface: surface + 4, price: Math.round((mid * 1.04) / 1000) * 1000, sold: 'il y a 4 mois' },
            { addr: 'Chemin du parc 3', surface, price: Math.round((mid * 0.98) / 1000) * 1000, sold: 'il y a 6 mois' },
          ],
          note: 'Fourchette indicative basée sur 3 ventes comparables récentes. À affiner après la visite.',
          issuedAt: Date.now(),
        }
      }

      if (status === 'live' && !next.publication) {
        next.publication = {
          publicId: 'MG-' + Math.random().toString(36).slice(2, 7).toUpperCase(),
          publishedAt: Date.now(),
          views: 142,
          contacts: 7,
          favorites: 19,
          visits: 0,
          listingPrice: next.estimation ? Math.round(next.estimation.mid / 1000) * 1000 : 1200000,
        }
      }

      // Write-through to DB
      if (migratedUserId) {
        upsertRemote(next, migratedUserId).catch(() => {
          /* silent */
        })
      }

      return next
    })
    saveLocal(cache)
    notify()
  }, [])

  const remove = useCallback((id: string) => {
    cache = cache.filter((d) => d.id !== id)
    saveLocal(cache)
    notify()
    if (migratedUserId) {
      deleteRemote(id, migratedUserId).catch(() => {
        /* silent */
      })
    }
  }, [])

  const clearAll = useCallback(() => {
    cache = []
    saveLocal(cache)
    notify()
    if (migratedUserId) {
      void supabase.from('vendor_dossiers').delete().eq('user_id', migratedUserId)
    }
  }, [])

  return {
    dossiers: cache,
    submit,
    advance,
    remove,
    clearAll,
  }
}

export { STATUS_LABELS, TYPE_LABELS, clearLocal as _clearLocalDossiersStorage }
