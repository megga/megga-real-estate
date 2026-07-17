/**
 * Vestige du système de favoris (marketplace désactivée) : seul l'état du prompt
 * de connexion subsiste. Partagé entre composants via un singleton module + un
 * set de listeners ; le refus est mémorisé dans localStorage.
 */
import { useState, useEffect, useCallback } from 'react'
import { } from '@/lib/supabase'
const PROMPT_DISMISSED_KEY = 'megga-favorites-prompt-dismissed'
// Singleton state shared across components
let loginPromptVisible = false
const promptListeners = new Set<() => void>()

/** Réveille tous les composants abonnés après un changement d'état du prompt. */
function notifyPromptListeners() { promptListeners.forEach((fn) => fn()) }

// ─── Supabase sync ──────────────────────────────────────────────────────────
// ─── Hook ───────────────────────────────────────────────────────────────────
// Hook for the login prompt state
/** S'abonne au singleton et expose la visibilité du prompt de connexion + son dismiss. */
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
