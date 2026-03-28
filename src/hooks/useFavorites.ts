import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for managing favorites with localStorage persistence.
 * Supports both market listings (market-xxx) and internal listings (internal-xxx).
 * Future: Supabase persistence when user is authenticated.
 */

const STORAGE_KEY = 'megga-favorites'

function loadFavorites(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function saveFavorites(favorites: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...favorites]))
  } catch { /* ignore */ }
}

// Singleton state to share across components
const globalFavorites = loadFavorites()
const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

export function useFavorites() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick((t) => t + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const isFavorite = useCallback((id: string) => globalFavorites.has(id), [])

  const toggleFavorite = useCallback((id: string) => {
    if (globalFavorites.has(id)) {
      globalFavorites.delete(id)
    } else {
      globalFavorites.add(id)
    }
    saveFavorites(globalFavorites)
    notifyListeners()
  }, [])

  const favoriteIds = [...globalFavorites]
  const count = globalFavorites.size

  return { isFavorite, toggleFavorite, favoriteIds, count }
}
