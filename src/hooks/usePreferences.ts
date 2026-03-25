import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import {
  ACCENT_PRESETS,
  BORDER_RADIUS_PRESETS,
  DEFAULT_PREFERENCES,
  generatePresetFromHex,
  type DashboardPreferences,
  type AccentColor,
  type BorderRadiusTheme,
  type DensityLevel,
  type SidebarStyle,
  type FontSizeLevel,
} from '@/lib/accentPresets'

const STORAGE_KEY = 'megga-preferences'

/* ─── Memoized preset cache for custom colors ─── */

const customPresetCache = new Map<string, ReturnType<typeof generatePresetFromHex>>()

function resolveAccentPreset(prefs: DashboardPreferences) {
  if (prefs.accentColor === 'custom' && prefs.customAccentHex) {
    const hex = prefs.customAccentHex
    let cached = customPresetCache.get(hex)
    if (!cached) {
      cached = generatePresetFromHex(hex)
      customPresetCache.set(hex, cached)
      // Keep cache small
      if (customPresetCache.size > 20) {
        const first = customPresetCache.keys().next().value
        if (first) customPresetCache.delete(first)
      }
    }
    return cached
  }
  return ACCENT_PRESETS[prefs.accentColor as Exclude<AccentColor, 'custom'>] ?? ACCENT_PRESETS.sapphire
}

/* ─── Cached localStorage read (avoid repeated JSON.parse) ─── */

let cachedPrefs: DashboardPreferences = { ...DEFAULT_PREFERENCES }
let cacheLoaded = false

function loadFromStorage(): DashboardPreferences {
  if (cacheLoaded) return cachedPrefs
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      cachedPrefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
    }
  } catch {
    // keep defaults
  }
  cacheLoaded = true
  return cachedPrefs
}

function writeToStorage(prefs: DashboardPreferences) {
  cachedPrefs = prefs
  // Defer localStorage write to avoid blocking the render
  queueMicrotask(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  })
}

/* ─── Apply preferences to CSS variables (batched DOM writes) ─── */

export function applyPreferences(prefs: DashboardPreferences, theme: 'light' | 'dark') {
  const root = document.documentElement

  // Batch all style changes in a single rAF to avoid multiple reflows
  requestAnimationFrame(() => {
    // 1. Accent color
    const preset = resolveAccentPreset(prefs)
    const colors = theme === 'dark' ? preset.dark : preset.light
    root.style.setProperty('--color-accent', colors.DEFAULT)
    root.style.setProperty('--color-accent-hover', colors.hover)
    root.style.setProperty('--color-accent-light', colors.light)
    root.style.setProperty('--color-accent-dark', colors.dark)
    root.style.setProperty('--color-accent-fg', preset.fg)
    root.style.setProperty('--color-border-focus', colors.DEFAULT)
    root.style.setProperty('--color-ring', colors.DEFAULT)

    // 2. Border radius
    const radius = BORDER_RADIUS_PRESETS[prefs.borderRadius] ?? BORDER_RADIUS_PRESETS.default
    root.style.setProperty('--radius-card', radius.card)
    root.style.setProperty('--radius-button', radius.button)
    root.style.setProperty('--radius-input', radius.input)
    root.style.setProperty('--radius-badge', radius.badge)

    // 3. Density + Font size → combined zoom
    const densityZoom: Record<string, number> = { compact: 0.92, comfortable: 1, spacious: 1.06 }
    const fontZoom: Record<string, number> = { small: 0.95, medium: 1, large: 1.04 }
    const dz = densityZoom[prefs.density] ?? 1
    const fz = fontZoom[prefs.fontSize] ?? 1
    root.style.setProperty('--content-zoom', String(dz * fz))

    // 4. Data attributes (batched)
    root.setAttribute('data-density', prefs.density)
    root.setAttribute('data-font-size', prefs.fontSize)
    root.setAttribute('data-sidebar-style', prefs.sidebarStyle)
  })
}

/* ─── Hook ─── */

export function usePreferences() {
  const { profile } = useAuth()
  const profileId = profile?.id
  const [preferences, setPreferences] = useState<DashboardPreferences>(loadFromStorage)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Apply on mount
  useEffect(() => {
    const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
    applyPreferences(preferences, theme)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync from Supabase on profile load
  useEffect(() => {
    if (!profileId) return

    supabase
      .from('profiles')
      .select('preferences')
      .eq('id', profileId)
      .single()
      .then(({ data }) => {
        if (data?.preferences && typeof data.preferences === 'object') {
          const merged = { ...DEFAULT_PREFERENCES, ...(data.preferences as Partial<DashboardPreferences>) }
          setPreferences(merged)
          writeToStorage(merged)
          const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
          applyPreferences(merged, theme)
        }
      })
  }, [profileId])

  // Save to Supabase (debounced)
  const saveToSupabase = useCallback((prefs: DashboardPreferences) => {
    if (!profileId) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      supabase
        .from('profiles')
        .update({ preferences: prefs })
        .eq('id', profileId)
        .then(() => { /* silent */ })
    }, 500)
  }, [profileId])

  // Update a single preference
  const updatePreference = useCallback(<K extends keyof DashboardPreferences>(
    key: K,
    value: DashboardPreferences[K]
  ) => {
    setPreferences((prev) => {
      const next = { ...prev, [key]: value }
      writeToStorage(next)
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
      applyPreferences(next, theme)
      saveToSupabase(next)
      return next
    })
  }, [saveToSupabase])

  // Update multiple preferences at once (for custom color)
  const updatePreferences = useCallback((updates: Partial<DashboardPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...updates }
      writeToStorage(next)
      const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
      applyPreferences(next, theme)
      saveToSupabase(next)
      return next
    })
  }, [saveToSupabase])

  // Reset to defaults
  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_PREFERENCES)
    writeToStorage(DEFAULT_PREFERENCES)
    const theme = (document.documentElement.getAttribute('data-theme') as 'light' | 'dark') || 'light'
    applyPreferences(DEFAULT_PREFERENCES, theme)
    saveToSupabase(DEFAULT_PREFERENCES)
  }, [saveToSupabase])

  return {
    preferences,
    updatePreference,
    updatePreferences,
    resetPreferences,
  }
}

// Re-export types for convenience
export type { AccentColor, BorderRadiusTheme, DensityLevel, SidebarStyle, FontSizeLevel, DashboardPreferences }
