import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

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
  energyLabel?: string
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

// ─── localStorage helpers ───────────────────────────────────────────────

function readLocalSearches(): SavedSearch[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeLocalSearches(searches: SavedSearch[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(searches))
}

// ─── DB row → frontend type ────────────────────────────────────────────

interface DbSavedSearch {
  id: string
  name: string
  filters: SavedSearchFilters
  alert_enabled: boolean
  alert_frequency: string
  alert_email: string | null
  results_count: number
  created_at: string
}

function dbToFrontend(row: DbSavedSearch): SavedSearch {
  return {
    id: row.id,
    name: row.name,
    filters: row.filters,
    alertEnabled: row.alert_enabled,
    alertFrequency: (row.alert_frequency as 'daily' | 'weekly') || 'daily',
    email: row.alert_email || undefined,
    resultsCount: row.results_count,
    createdAt: row.created_at,
  }
}

// ─── Hook ───────────────────────────────────────────────────────────────

export function useSavedSearches() {
  const { user } = useAuth()
  const isAuthenticated = !!user
  const queryClient = useQueryClient()

  // ─── Supabase path (authenticated) ─────────────────────────────────

  const { data: dbSearches } = useQuery({
    queryKey: ['saved-searches', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('id, name, filters, alert_enabled, alert_frequency, alert_email, results_count, created_at')
        .order('created_at', { ascending: false })
        .limit(MAX_SEARCHES)
      if (error) throw error
      return (data as DbSavedSearch[]).map(dbToFrontend)
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  })

  // ─── localStorage path (anonymous) ─────────────────────────────────

  const [localSearches, setLocalSearches] = useState<SavedSearch[]>(readLocalSearches)

  useEffect(() => {
    if (!isAuthenticated) {
      writeLocalSearches(localSearches)
    }
  }, [localSearches, isAuthenticated])

  // ─── One-time migration: localStorage → Supabase ──────────────────

  useEffect(() => {
    if (!isAuthenticated || !user) return
    const local = readLocalSearches()
    if (local.length === 0) return

    // Migrate localStorage searches to Supabase
    const migrateAsync = async () => {
      for (const s of local) {
        await supabase.from('saved_searches').upsert({
          id: s.id.length === 36 ? s.id : undefined, // only use valid UUIDs
          user_id: user.id,
          name: s.name,
          filters: s.filters,
          alert_enabled: s.alertEnabled,
          alert_email: s.email || null,
          alert_frequency: s.alertFrequency || 'daily',
          results_count: s.resultsCount,
        })
      }
      localStorage.removeItem(STORAGE_KEY)
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] })
    }
    migrateAsync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated])

  // ─── Mutations (Supabase) ─────────────────────────────────────────

  const saveMutation = useMutation({
    mutationFn: async (params: {
      name: string
      filters: SavedSearchFilters
      alertEnabled: boolean
      alertFrequency: 'daily' | 'weekly'
      email?: string
      resultsCount?: number
    }) => {
      const { error } = await supabase.from('saved_searches').insert({
        user_id: user!.id,
        name: params.name,
        filters: params.filters,
        alert_enabled: params.alertEnabled,
        alert_email: params.email || null,
        alert_frequency: params.alertFrequency,
        results_count: params.resultsCount || 0,
      })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saved_searches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  const toggleAlertMutation = useMutation({
    mutationFn: async (id: string) => {
      const search = (dbSearches || []).find(s => s.id === id)
      if (!search) return
      const { error } = await supabase
        .from('saved_searches')
        .update({ alert_enabled: !search.alertEnabled })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  const updateFreqMutation = useMutation({
    mutationFn: async ({ id, frequency }: { id: string; frequency: 'daily' | 'weekly' }) => {
      const { error } = await supabase
        .from('saved_searches')
        .update({ alert_frequency: frequency })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-searches'] }),
  })

  // ─── Unified API ──────────────────────────────────────────────────

  const searches = isAuthenticated ? (dbSearches || []) : localSearches

  const saveSearch = useCallback((
    name: string,
    filters: SavedSearchFilters,
    alertEnabled: boolean,
    alertFrequency: 'daily' | 'weekly',
    email?: string,
    resultsCount?: number,
  ) => {
    if (isAuthenticated) {
      saveMutation.mutate({ name, filters, alertEnabled, alertFrequency, email, resultsCount })
    } else {
      setLocalSearches(prev => [{
        id: Date.now().toString(),
        name,
        filters,
        alertEnabled,
        alertFrequency,
        email,
        resultsCount: resultsCount || 0,
        createdAt: new Date().toISOString(),
      }, ...prev].slice(0, MAX_SEARCHES))
    }
  }, [isAuthenticated, saveMutation])

  const deleteSearch = useCallback((id: string) => {
    if (isAuthenticated) {
      deleteMutation.mutate(id)
    } else {
      setLocalSearches(prev => prev.filter(s => s.id !== id))
    }
  }, [isAuthenticated, deleteMutation])

  const toggleAlert = useCallback((id: string) => {
    if (isAuthenticated) {
      toggleAlertMutation.mutate(id)
    } else {
      setLocalSearches(prev => prev.map(s =>
        s.id === id ? { ...s, alertEnabled: !s.alertEnabled } : s
      ))
    }
  }, [isAuthenticated, toggleAlertMutation])

  const updateFrequency = useCallback((id: string, frequency: 'daily' | 'weekly') => {
    if (isAuthenticated) {
      updateFreqMutation.mutate({ id, frequency })
    } else {
      setLocalSearches(prev => prev.map(s =>
        s.id === id ? { ...s, alertFrequency: frequency } : s
      ))
    }
  }, [isAuthenticated, updateFreqMutation])

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
  if (filters.energyLabel) parts.push(filters.energyLabel === 'minergie' ? 'Minergie' : `CECB ${filters.energyLabel}`)
  return parts.length > 0 ? parts.join(' · ') : 'Ma recherche'
}
