import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'

// Profile metadata store — local-first synced to Supabase when authenticated.
//
// Pattern : localStorage initial pour les anonymous + cache, table
// `user_profile_meta` (1 ligne par user) pour la persistance cross-device.
// Au login, on merge localStorage → DB (si pas déjà sync). Toutes les
// mutations passent par DB si user connecté, sinon localStorage.

export type ProfileMode = 'buyer' | 'seller' | 'mixed'

export interface ProfileVerifications {
  email: boolean
  phone: boolean
  id: boolean
}

export interface ProfileNotifications {
  email: boolean
  push: boolean
  sms: boolean
  searchFreq: 'instant' | 'daily' | 'weekly'
}

export interface ProfileSecurity {
  twoFactor: boolean
  passkeys: boolean
  loginAlerts: boolean
  passwordAgeDays: number
}

export interface ProfilePrivacy {
  profilePublic: boolean
  analytics: boolean
  marketing: boolean
}

export interface ProfileSession {
  id: string
  device: string
  location: string
  lastActive: string
  current: boolean
}

export interface ProfilePreferences {
  languages: string[]
  currency: 'CHF' | 'EUR'
  areaUnit: 'm2' | 'ft2'
  defaultSort: 'relevance' | 'price' | 'date'
}

export interface ProfileMeta {
  mode: ProfileMode
  bio: string
  verifications: ProfileVerifications
  notifications: ProfileNotifications
  security: ProfileSecurity
  privacy: ProfilePrivacy
  sessions: ProfileSession[]
  preferences: ProfilePreferences
}

const STORAGE_KEY = 'megga-profile-meta-v1'

export const DEFAULT_PROFILE_META: ProfileMeta = {
  mode: 'mixed',
  bio: '',
  verifications: { email: false, phone: false, id: false },
  notifications: { email: true, push: true, sms: false, searchFreq: 'daily' },
  security: { twoFactor: false, passkeys: false, loginAlerts: true, passwordAgeDays: 0 },
  privacy: { profilePublic: false, analytics: true, marketing: false },
  sessions: [
    {
      id: 'current',
      device:
        typeof navigator !== 'undefined' && navigator.userAgent.includes('Macintosh')
          ? 'Mac · Navigateur'
          : 'Cet appareil',
      location: '—',
      lastActive: 'Maintenant',
      current: true,
    },
  ],
  preferences: { languages: ['FR'], currency: 'CHF', areaUnit: 'm2', defaultSort: 'relevance' },
}

// ─── localStorage helpers ─────────────────────────────────────────────────

function loadLocal(): ProfileMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE_META }
    const parsed = JSON.parse(raw) as Partial<ProfileMeta>
    return mergeWithDefaults(parsed)
  } catch {
    return { ...DEFAULT_PROFILE_META }
  }
}

function saveLocal(meta: ProfileMeta) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

function mergeWithDefaults(parsed: Partial<ProfileMeta>): ProfileMeta {
  return {
    ...DEFAULT_PROFILE_META,
    ...parsed,
    verifications: { ...DEFAULT_PROFILE_META.verifications, ...(parsed.verifications ?? {}) },
    notifications: { ...DEFAULT_PROFILE_META.notifications, ...(parsed.notifications ?? {}) },
    security: { ...DEFAULT_PROFILE_META.security, ...(parsed.security ?? {}) },
    privacy: { ...DEFAULT_PROFILE_META.privacy, ...(parsed.privacy ?? {}) },
    preferences: { ...DEFAULT_PROFILE_META.preferences, ...(parsed.preferences ?? {}) },
    sessions:
      parsed.sessions && parsed.sessions.length > 0 ? parsed.sessions : DEFAULT_PROFILE_META.sessions,
  }
}

// ─── DB sync ──────────────────────────────────────────────────────────────

interface DbRow {
  user_id: string
  mode: ProfileMode
  bio: string
  verifications: ProfileVerifications
  notifications: ProfileNotifications
  security: ProfileSecurity
  privacy: ProfilePrivacy
  preferences: ProfilePreferences
  created_at: string
  updated_at: string
}

function dbToFrontend(row: DbRow, fallbackSessions: ProfileSession[]): ProfileMeta {
  return {
    mode: row.mode,
    bio: row.bio ?? '',
    verifications: { ...DEFAULT_PROFILE_META.verifications, ...row.verifications },
    notifications: { ...DEFAULT_PROFILE_META.notifications, ...row.notifications },
    security: { ...DEFAULT_PROFILE_META.security, ...row.security },
    privacy: { ...DEFAULT_PROFILE_META.privacy, ...row.privacy },
    preferences: { ...DEFAULT_PROFILE_META.preferences, ...row.preferences },
    // sessions stay client-side only — they're per-device snapshots
    sessions: fallbackSessions,
  }
}

async function fetchRemote(userId: string): Promise<ProfileMeta | null> {
  const { data, error } = await supabase
    .from('user_profile_meta')
    .select('user_id, mode, bio, verifications, notifications, security, privacy, preferences, created_at, updated_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return null
  return dbToFrontend(data as unknown as DbRow, globalMeta.sessions)
}

async function upsertRemote(meta: ProfileMeta, userId: string) {
  await supabase.from('user_profile_meta').upsert(
    {
      user_id: userId,
      mode: meta.mode,
      bio: meta.bio,
      verifications: meta.verifications as unknown as Json,
      notifications: meta.notifications as unknown as Json,
      security: meta.security as unknown as Json,
      privacy: meta.privacy as unknown as Json,
      preferences: meta.preferences as unknown as Json,
    },
    { onConflict: 'user_id' }
  )
}

// ─── Singleton state ──────────────────────────────────────────────────────

let globalMeta = typeof window === 'undefined' ? { ...DEFAULT_PROFILE_META } : loadLocal()
const listeners = new Set<() => void>()
let syncedUserId: string | null = null

function notify() {
  listeners.forEach((fn) => fn())
}

async function migrateOnLogin(userId: string) {
  if (syncedUserId === userId) return
  syncedUserId = userId

  const remote = await fetchRemote(userId)
  if (remote) {
    // DB row exists — adopt as truth (user has touched settings on another device)
    globalMeta = remote
    saveLocal(globalMeta)
    notify()
  } else {
    // No DB row — push current local state as the initial row
    await upsertRemote(globalMeta, userId)
  }
}

function resetSync() {
  syncedUserId = null
  // On logout, keep localStorage as fallback (don't reset to defaults)
  globalMeta = loadLocal()
  notify()
}

// ─── DeepPartial helper for nested updates ────────────────────────────────

type DeepPartial<T> = T extends object ? { [K in keyof T]?: DeepPartial<T[K]> } : T

function deepMerge<T extends Record<string, unknown>>(base: T, patch: DeepPartial<T>): T {
  const out: Record<string, unknown> = { ...base }
  for (const [k, raw] of Object.entries(patch)) {
    const v = raw as unknown
    const baseVal = (base as Record<string, unknown>)[k]
    if (
      v &&
      typeof v === 'object' &&
      !Array.isArray(v) &&
      baseVal &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      out[k] = deepMerge(baseVal as Record<string, unknown>, v as DeepPartial<Record<string, unknown>>)
    } else {
      out[k] = v
    }
  }
  return out as T
}

// ─── Hook ─────────────────────────────────────────────────────────────────

export function useProfileMeta() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  // Sync with auth user
  useEffect(() => {
    let cancelled = false
    async function run() {
      const { data } = await supabase.auth.getUser()
      if (cancelled) return
      if (data.user) {
        migrateOnLogin(data.user.id).catch(() => {
          /* silent */
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

  const update = useCallback((patch: DeepPartial<ProfileMeta>) => {
    globalMeta = deepMerge(
      globalMeta as unknown as Record<string, unknown>,
      patch as DeepPartial<Record<string, unknown>>
    ) as unknown as ProfileMeta
    saveLocal(globalMeta)
    notify()
    if (syncedUserId) {
      upsertRemote(globalMeta, syncedUserId).catch(() => {
        /* silent */
      })
    }
  }, [])

  const setMode = useCallback((mode: ProfileMode) => update({ mode }), [update])

  const reset = useCallback(() => {
    globalMeta = { ...DEFAULT_PROFILE_META }
    saveLocal(globalMeta)
    notify()
    if (syncedUserId) {
      upsertRemote(globalMeta, syncedUserId).catch(() => {
        /* silent */
      })
    }
  }, [])

  return {
    meta: globalMeta,
    update,
    setMode,
    reset,
  }
}
