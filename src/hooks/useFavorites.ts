import { useState, useEffect, useCallback } from 'react'

/**
 * Hook for managing favorites with localStorage persistence.
 * Supports both market listings (market-xxx) and internal listings (internal-xxx).
 * Shows a login prompt when the user adds a 3rd favorite without being logged in.
 */

const STORAGE_KEY = 'megga-favorites'
const PROMPT_DISMISSED_KEY = 'megga-favorites-prompt-dismissed'
const PROMPT_THRESHOLD = 3

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
let loginPromptVisible = false
const promptListeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

function notifyPromptListeners() {
  promptListeners.forEach((fn) => fn())
}

export function useFavorites() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick((t) => t + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  const isFavorite = useCallback((id: string) => globalFavorites.has(id), [])

  const toggleFavorite = useCallback((id: string, isLoggedIn = false) => {
    if (globalFavorites.has(id)) {
      globalFavorites.delete(id)
    } else {
      globalFavorites.add(id)

      // Show login prompt at threshold if not logged in and not dismissed
      if (!isLoggedIn && globalFavorites.size >= PROMPT_THRESHOLD) {
        const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY)
        if (!dismissed) {
          loginPromptVisible = true
          notifyPromptListeners()
        }
      }
    }
    saveFavorites(globalFavorites)
    notifyListeners()
  }, [])

  const favoriteIds = [...globalFavorites]
  const count = globalFavorites.size

  return { isFavorite, toggleFavorite, favoriteIds, count }
}

// Hook for the login prompt state
export function useFavoritesLoginPrompt() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick((t) => t + 1)
    promptListeners.add(listener)
    return () => { promptListeners.delete(listener) }
  }, [])

  const dismiss = useCallback(() => {
    loginPromptVisible = false
    localStorage.setItem(PROMPT_DISMISSED_KEY, '1')
    notifyPromptListeners()
  }, [])

  return { showLoginPrompt: loginPromptVisible, dismissLoginPrompt: dismiss }
}
