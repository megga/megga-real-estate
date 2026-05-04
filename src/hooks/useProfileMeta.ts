import { useCallback, useEffect, useState } from 'react'

// Profile metadata store — local-first.
//
// Holds the rich profile fields the design needs (mode toggle, verification
// state, notification prefs, security flags, privacy flags, session list)
// that don't yet exist as columns in `profiles`. Persists to localStorage so
// the user's choices stick across reloads. When the corresponding Supabase
// columns land, swap the read/write paths to mirror the localStorage→DB
// migration done by useSavedSearches.

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

function loadMeta(): ProfileMeta {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PROFILE_META }
    const parsed = JSON.parse(raw) as Partial<ProfileMeta>
    return {
      ...DEFAULT_PROFILE_META,
      ...parsed,
      verifications: { ...DEFAULT_PROFILE_META.verifications, ...(parsed.verifications ?? {}) },
      notifications: { ...DEFAULT_PROFILE_META.notifications, ...(parsed.notifications ?? {}) },
      security: { ...DEFAULT_PROFILE_META.security, ...(parsed.security ?? {}) },
      privacy: { ...DEFAULT_PROFILE_META.privacy, ...(parsed.privacy ?? {}) },
      preferences: { ...DEFAULT_PROFILE_META.preferences, ...(parsed.preferences ?? {}) },
      sessions: parsed.sessions && parsed.sessions.length > 0 ? parsed.sessions : DEFAULT_PROFILE_META.sessions,
    }
  } catch {
    return { ...DEFAULT_PROFILE_META }
  }
}

function saveMeta(meta: ProfileMeta) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
}

let globalMeta = typeof window === 'undefined' ? { ...DEFAULT_PROFILE_META } : loadMeta()
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

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
      out[k] = deepMerge(
        baseVal as Record<string, unknown>,
        v as DeepPartial<Record<string, unknown>>
      )
    } else {
      out[k] = v
    }
  }
  return out as T
}

export function useProfileMeta() {
  const [, setTick] = useState(0)

  useEffect(() => {
    const fn = () => setTick((t) => t + 1)
    listeners.add(fn)
    return () => {
      listeners.delete(fn)
    }
  }, [])

  const update = useCallback((patch: DeepPartial<ProfileMeta>) => {
    globalMeta = deepMerge(
      globalMeta as unknown as Record<string, unknown>,
      patch as DeepPartial<Record<string, unknown>>
    ) as unknown as ProfileMeta
    saveMeta(globalMeta)
    notify()
  }, [])

  const setMode = useCallback((mode: ProfileMode) => update({ mode }), [update])

  const reset = useCallback(() => {
    globalMeta = { ...DEFAULT_PROFILE_META }
    saveMeta(globalMeta)
    notify()
  }, [])

  return {
    meta: globalMeta,
    update,
    setMode,
    reset,
  }
}
