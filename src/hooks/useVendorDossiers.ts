import { useCallback, useEffect, useState } from 'react'

// Vendor dossiers — local-first store mirroring what /vendre's wizard
// will eventually persist to Supabase. For now it lives in localStorage so
// the account page can show realistic pipeline cards without a new migration.
//
// When a `vendor_dossiers` table lands, swap the read/write paths to mirror
// the saved_searches pattern (localStorage → DB on login, then DB-only).

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

function load(): VendorDossier[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as VendorDossier[]) : []
  } catch {
    return []
  }
}

function save(items: VendorDossier[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
  } catch {
    /* ignore */
  }
}

let global = typeof window === 'undefined' ? [] : load()
const listeners = new Set<() => void>()
function notify() {
  listeners.forEach((fn) => fn())
}

const AGENTS = [
  { name: 'Marc Dubois', role: 'Agent · Genève', initials: 'MD' },
  { name: 'Sophie Martin', role: 'Agente · Lausanne', initials: 'SM' },
  { name: 'Thomas Berger', role: 'Agent · Zürich', initials: 'TB' },
  { name: 'Léa Clément', role: 'Agente · Vaud', initials: 'LC' },
]

export function useVendorDossiers() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  const submit = useCallback(
    (input: Partial<VendorDossier> & { propertyType: VendorDossier['propertyType']; transaction: VendorDossier['transaction']; address: string }) => {
      const id = `L${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`
      const agent = AGENTS[global.length % AGENTS.length]
      const now = Date.now()

      const typeLabel = TYPE_LABELS[input.propertyType]
      const baseTitle =
        input.title?.trim() ||
        `${typeLabel}${input.rooms ? ` ${input.rooms} pces` : ''}${input.address ? ` · ${input.address.split(',')[0]}` : ''}`

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

      global = [dossier, ...global]
      save(global)
      notify()
      return dossier
    },
    []
  )

  const advance = useCallback((id: string, status: PipelineStatus) => {
    global = global.map((d) => {
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

      return next
    })
    save(global)
    notify()
  }, [])

  const remove = useCallback((id: string) => {
    global = global.filter((d) => d.id !== id)
    save(global)
    notify()
  }, [])

  return {
    dossiers: global,
    submit,
    advance,
    remove,
  }
}

export { STATUS_LABELS, TYPE_LABELS }
