import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Hide-listing hook — localStorage-first with Supabase sync when logged in.
 * Mirrors the useFavorites pattern: anonymous users stay local, login
 * triggers a one-shot merge, further toggles write through to the base.
 */

const STORAGE_KEY = 'megga-hidden'

function loadHidden(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function saveHidden(set: Set<string>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...set])) } catch { /* ignore */ }
}

const globalHidden = loadHidden()
const listeners = new Set<() => void>()
let syncedUserId: string | null = null

function notifyListeners() { listeners.forEach(fn => fn()) }

async function fetchRemoteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('market_hidden')
    .select('listing_id')
    .eq('user_id', userId)
  if (error) return []
  return (data ?? []).map((r: { listing_id: string }) => r.listing_id)
}

async function insertRemote(userId: string, ids: string[]) {
  if (ids.length === 0) return
  await supabase
    .from('market_hidden')
    .upsert(ids.map(listing_id => ({ user_id: userId, listing_id })), { onConflict: 'user_id,listing_id' })
}

async function deleteRemote(userId: string, id: string) {
  await supabase.from('market_hidden').delete().match({ user_id: userId, listing_id: id })
}

async function mergeOnLogin(userId: string) {
  if (syncedUserId === userId) return
  syncedUserId = userId
  const remote = await fetchRemoteIds(userId)
  const local = [...globalHidden]
  const onlyLocal = local.filter(id => !remote.includes(id))
  if (onlyLocal.length > 0) await insertRemote(userId, onlyLocal)
  let changed = false
  for (const id of remote) {
    if (!globalHidden.has(id)) { globalHidden.add(id); changed = true }
  }
  if (changed) { saveHidden(globalHidden); notifyListeners() }
}

function resetSync() { syncedUserId = null }

export function useHiddenListings() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const l = () => setTick(t => t + 1)
    listeners.add(l)
    return () => { listeners.delete(l) }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data.user) mergeOnLogin(data.user.id).catch(() => { /* silent */ })
      else resetSync()
    }
    run()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) mergeOnLogin(session.user.id).catch(() => { /* silent */ })
      else resetSync()
    })
    return () => { cancelled = true; sub.subscription.unsubscribe() }
  }, [])

  const isHidden = useCallback((id: string) => globalHidden.has(id), [])

  const hide = useCallback((id: string) => {
    globalHidden.add(id)
    saveHidden(globalHidden)
    notifyListeners()
    if (syncedUserId) insertRemote(syncedUserId, [id]).catch(() => { /* silent */ })
  }, [])

  const unhide = useCallback((id: string) => {
    globalHidden.delete(id)
    saveHidden(globalHidden)
    notifyListeners()
    if (syncedUserId) deleteRemote(syncedUserId, id).catch(() => { /* silent */ })
  }, [])

  return { isHidden, hide, unhide, hiddenIds: [...globalHidden], count: globalHidden.size }
}
