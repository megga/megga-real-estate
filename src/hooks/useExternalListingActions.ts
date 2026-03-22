import { useState, useCallback, useMemo } from 'react'
import type { ExternalListing } from './useExternalMatching'
import { MOCK_AGENT_LISTINGS } from '@/lib/mockData'

// ── Types ────────────────────────────────────────────────────────────────

export interface ExternalNote {
  id: string
  text: string
  created_at: string
}

export interface SendRecord {
  id: string
  contact_name: string
  channel: 'email' | 'internal'
  sent_at: string
}

interface ExternalListingState {
  notes: ExternalNote[]
  sends: SendRecord[]
  imported: boolean
  imported_at: string | null
}

type StateMap = Record<string, ExternalListingState>

// ── Storage helpers ──────────────────────────────────────────────────────

const STORAGE_KEY = 'megga_external_listing_actions'

function loadState(): StateMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveState(state: StateMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

function getListingState(stateMap: StateMap, externalId: string): ExternalListingState {
  return stateMap[externalId] || { notes: [], sends: [], imported: false, imported_at: null }
}

// ── Price comparison ─────────────────────────────────────────────────────

export interface PriceComparison {
  external_price_per_m2: number
  internal_avg_price_per_m2: number
  internal_median_price_per_m2: number
  internal_min_price_per_m2: number
  internal_max_price_per_m2: number
  internal_count: number
  diff_pct: number // positive = external is more expensive
  comparable_listings: {
    title: string
    price: number
    surface_m2: number
    price_per_m2: number
    city: string
  }[]
}

function computePriceComparison(listing: ExternalListing): PriceComparison | null {
  if (!listing.price || listing.price <= 0 || !listing.surface_m2 || listing.surface_m2 <= 0) return null

  const extPricePerM2 = listing.price_per_m2 || Math.round(listing.price / listing.surface_m2)

  // Filter internal listings by same type and similar location
  const typeMap: Record<string, string[]> = {
    APARTMENT: ['apartment'],
    APPT: ['apartment'],
    HOUSE: ['house', 'villa'],
    VILLA: ['house', 'villa'],
    apartment: ['apartment'],
    house: ['house', 'villa'],
    villa: ['house', 'villa'],
    apartment_duplex: ['apartment'],
    apartment_normal: ['apartment'],
    apartment_attic: ['apartment'],
    apartment_penthouse: ['apartment'],
    apartment_terrasse_flat: ['apartment'],
    house_detached: ['house', 'villa'],
    house_semi_detached: ['house', 'villa'],
  }

  const matchingTypes = typeMap[listing.type] || typeMap[listing.property_type_detail || ''] || ['apartment', 'house', 'villa']

  const comparable = MOCK_AGENT_LISTINGS
    .filter(l => {
      if (!matchingTypes.includes(l.type)) return false
      if (l.status !== 'active' && l.status !== 'reserved') return false
      if (l.surface_m2 <= 0) return false
      return true
    })
    .map(l => ({
      title: l.title,
      price: l.price,
      surface_m2: l.surface_m2,
      price_per_m2: Math.round(l.price / l.surface_m2),
      city: l.city,
    }))
    .sort((a, b) => Math.abs(a.price_per_m2 - extPricePerM2) - Math.abs(b.price_per_m2 - extPricePerM2))

  if (comparable.length === 0) return null

  const prices = comparable.map(c => c.price_per_m2).sort((a, b) => a - b)
  const avg = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
  const median = prices[Math.floor(prices.length / 2)]
  const diffPct = Math.round(((extPricePerM2 - avg) / avg) * 100)

  return {
    external_price_per_m2: extPricePerM2,
    internal_avg_price_per_m2: avg,
    internal_median_price_per_m2: median,
    internal_min_price_per_m2: prices[0],
    internal_max_price_per_m2: prices[prices.length - 1],
    internal_count: comparable.length,
    diff_pct: diffPct,
    comparable_listings: comparable.slice(0, 5),
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────

export function useExternalListingActions(listing: ExternalListing | undefined) {
  const [stateMap, setStateMap] = useState<StateMap>(loadState)

  const externalId = listing?.external_id || ''
  const listingState = getListingState(stateMap, externalId)

  const updateState = useCallback((newListingState: ExternalListingState) => {
    setStateMap(prev => {
      const next = { ...prev, [externalId]: newListingState }
      saveState(next)
      return next
    })
  }, [externalId])

  // Add note
  const addNote = useCallback((text: string) => {
    if (!text.trim()) return
    const note: ExternalNote = {
      id: `note_${Date.now()}`,
      text: text.trim(),
      created_at: new Date().toISOString(),
    }
    updateState({
      ...listingState,
      notes: [...listingState.notes, note],
    })
  }, [listingState, updateState])

  // Delete note
  const deleteNote = useCallback((noteId: string) => {
    updateState({
      ...listingState,
      notes: listingState.notes.filter(n => n.id !== noteId),
    })
  }, [listingState, updateState])

  // Record send
  const recordSend = useCallback((contactName: string, channel: 'email' | 'internal') => {
    const send: SendRecord = {
      id: `send_${Date.now()}`,
      contact_name: contactName,
      channel,
      sent_at: new Date().toISOString(),
    }
    updateState({
      ...listingState,
      sends: [...listingState.sends, send],
    })
  }, [listingState, updateState])

  // Mark as imported
  const markImported = useCallback(() => {
    updateState({
      ...listingState,
      imported: true,
      imported_at: new Date().toISOString(),
    })
  }, [listingState, updateState])

  // Price comparison
  const priceComparison = useMemo(() => {
    if (!listing) return null
    return computePriceComparison(listing)
  }, [listing])

  return {
    notes: listingState.notes,
    sends: listingState.sends,
    imported: listingState.imported,
    importedAt: listingState.imported_at,
    addNote,
    deleteNote,
    recordSend,
    markImported,
    priceComparison,
  }
}
