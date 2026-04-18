import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Favorites — localStorage-first with Supabase sync when logged in.
 *
 * - Anonymous users: stored in localStorage only (zero friction, no login wall).
 * - Logged-in users: bidirectional sync with `market_favorites` table.
 * - On login: merge localStorage into Supabase, then pull missing ids back
 *   so the user's previous sessions and other devices all converge.
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

// Singleton state shared across components
const globalFavorites = loadFavorites()
const listeners = new Set<() => void>()
let loginPromptVisible = false
const promptListeners = new Set<() => void>()
let syncedUserId: string | null = null

function notifyListeners() { listeners.forEach((fn) => fn()) }
function notifyPromptListeners() { promptListeners.forEach((fn) => fn()) }

// ─── Supabase sync ──────────────────────────────────────────────────────────

async function fetchRemoteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('market_favorites')
    .select('listing_id')
    .eq('user_id', userId)
  if (error) return []
  return (data ?? []).map((r: { listing_id: string }) => r.listing_id)
}

async function insertRemote(userId: string, ids: string[]) {
  if (ids.length === 0) return
  await supabase
    .from('market_favorites')
    .upsert(ids.map(listing_id => ({ user_id: userId, listing_id })), { onConflict: 'user_id,listing_id' })
}

async function deleteRemote(userId: string, id: string) {
  await supabase.from('market_favorites').delete().match({ user_id: userId, listing_id: id })
}

/**
 * Merge local + remote for the given user. Called once per session when
 * the user becomes known. Idempotent: re-running it only adds missing ids.
 */
async function mergeOnLogin(userId: string) {
  if (syncedUserId === userId) return
  syncedUserId = userId

  const remoteIds = await fetchRemoteIds(userId)
  const localIds = [...globalFavorites]

  // Push local-only ids to remote
  const onlyLocal = localIds.filter(id => !remoteIds.includes(id))
  if (onlyLocal.length > 0) {
    await insertRemote(userId, onlyLocal)
  }

  // Pull remote-only ids into local
  let changed = false
  for (const id of remoteIds) {
    if (!globalFavorites.has(id)) {
      globalFavorites.add(id)
      changed = true
    }
  }
  if (changed) {
    saveFavorites(globalFavorites)
    notifyListeners()
  }
}

function resetSync() {
  syncedUserId = null
}

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useFavorites() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const listener = () => setTick((t) => t + 1)
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, [])

  // Sync with Supabase when the auth user changes
  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data.user) {
        mergeOnLogin(data.user.id).catch(() => { /* silent — fall back to local */ })
      } else {
        resetSync()
      }
    }
    run()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        mergeOnLogin(session.user.id).catch(() => { /* silent */ })
      } else {
        resetSync()
      }
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  const isFavorite = useCallback((id: string) => globalFavorites.has(id), [])

  const toggleFavorite = useCallback((id: string, isLoggedIn = false) => {
    const wasFavorite = globalFavorites.has(id)
    if (wasFavorite) {
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

    // Write-through to Supabase if we have a synced user
    if (syncedUserId) {
      if (wasFavorite) deleteRemote(syncedUserId, id).catch(() => { /* silent */ })
      else insertRemote(syncedUserId, [id]).catch(() => { /* silent */ })
    }
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
