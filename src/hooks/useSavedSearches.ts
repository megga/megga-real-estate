import { useState, useEffect, useCallback } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────

export interface SavedSearchFilters {
  context: 'buy' | 'rent'
  q?: string
  types?: string[]
  minPrice?: string
  maxPrice?: string
  rooms?: string
  bedrooms?: string
  bathrooms?: string
  city?: string
  canton?: string
  lifestyleTags?: string[]
}

export interface SavedSearch {
  id: string
  name: string
  filters: SavedSearchFilters
  alertEnabled: boolean
  alertFrequency: 'daily' | 'weekly'
  email?: string
  resultsCount: number
  createdAt: string
}

const STORAGE_KEY = 'megga-saved-searches-v2'
const MAX_SEARCHES = 10

// ─── Hook ───────────────────────────────────────────────────────────────

export function useSavedSearches() {
  const [searches, setSearches] = useState<SavedSearch[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
  }, [searches])

  const saveSearch = useCallback((
    name: string,
    filters: SavedSearchFilters,
    alertEnabled: boolean,
    alertFrequency: 'daily' | 'weekly',
    email?: string,
    resultsCount?: number,
  ) => {
    setSearches(prev => {
      // Limit to MAX_SEARCHES
      const updated = [
        {
          id: Date.now().toString(),
          name,
          filters,
          alertEnabled,
          alertFrequency,
          email,
          resultsCount: resultsCount || 0,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ].slice(0, MAX_SEARCHES)
      return updated
    })
  }, [])

  const deleteSearch = useCallback((id: string) => {
    setSearches(prev => prev.filter(s => s.id !== id))
  }, [])

  const toggleAlert = useCallback((id: string) => {
    setSearches(prev => prev.map(s =>
      s.id === id ? { ...s, alertEnabled: !s.alertEnabled } : s
    ))
  }, [])

  const updateFrequency = useCallback((id: string, frequency: 'daily' | 'weekly') => {
    setSearches(prev => prev.map(s =>
      s.id === id ? { ...s, alertFrequency: frequency } : s
    ))
  }, [])

  return {
    searches,
    saveSearch,
    deleteSearch,
    toggleAlert,
    updateFrequency,
    count: searches.length,
    maxReached: searches.length >= MAX_SEARCHES,
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────

export function generateSearchName(filters: SavedSearchFilters): string {
  const parts: string[] = []
  if (filters.canton) parts.push(filters.canton)
  if (filters.city) parts.push(filters.city)
  if (filters.types?.length) {
    const typeLabels: Record<string, string> = {
      apartment: 'Appt', house: 'Maison', villa: 'Villa', land: 'Terrain', commercial: 'Commercial',
    }
    parts.push(filters.types.map(t => typeLabels[t] || t).join('/'))
  }
  if (filters.rooms) parts.push(`${filters.rooms}+ pièces`)
  if (filters.maxPrice) {
    const p = Number(filters.maxPrice)
    if (p >= 1000000) parts.push(`max ${(p / 1000000).toFixed(1)}M`)
    else if (p > 0) parts.push(`max ${Math.round(p / 1000)}K`)
  }
  return parts.length > 0 ? parts.join(' · ') : 'Ma recherche'
}
