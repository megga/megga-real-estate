import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { applyPreferences } from '@/hooks/usePreferences'
import { DEFAULT_PREFERENCES, type DashboardPreferences } from '@/lib/accentPresets'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

const STORAGE_KEY = 'megga-theme'
const PREFS_STORAGE_KEY = 'megga-preferences'

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  // Respect system preference
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark'
  return 'light'
}

// Cached prefs to avoid repeated JSON.parse on every toggle
let _cachedPrefs: DashboardPreferences = DEFAULT_PREFERENCES
let _cacheLoaded = false

function getStoredPreferences(): DashboardPreferences {
  if (_cacheLoaded) return _cachedPrefs
  try {
    const raw = localStorage.getItem(PREFS_STORAGE_KEY)
    if (raw) {
      _cachedPrefs = { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) }
    }
  } catch {
    // keep defaults
  }
  _cacheLoaded = true
  return _cachedPrefs
}

// Invalidate cache when preferences change from another tab
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === PREFS_STORAGE_KEY) _cacheLoaded = false
  })
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(getInitialTheme)

  const applyTheme = useCallback((t: Theme, animate = false) => {
    const root = document.documentElement
    if (animate) {
      // Enable smooth transition on all elements
      root.setAttribute('data-theme-transitioning', '')
      requestAnimationFrame(() => {
        root.setAttribute('data-theme', t)
        // Re-apply accent colors for the new theme mode
        applyPreferences(getStoredPreferences(), t)
        // Remove transition class after animation completes (matches 0.3s CSS)
        setTimeout(() => root.removeAttribute('data-theme-transitioning'), 320)
      })
    } else {
      root.setAttribute('data-theme', t)
      // Apply preferences with correct theme mode
      applyPreferences(getStoredPreferences(), t)
    }
    localStorage.setItem(STORAGE_KEY, t)
  }, [])

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t)
    applyTheme(t, true) // animate the transition
  }, [applyTheme])

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  // Apply on mount, reset to light on unmount (public pages stay light)
  useEffect(() => {
    applyTheme(theme)
    return () => {
      document.documentElement.removeAttribute('data-theme')
      document.documentElement.removeAttribute('data-density')
      document.documentElement.removeAttribute('data-sidebar-style')
      document.documentElement.removeAttribute('data-font-size')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Listen for system preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    function handler(e: MediaQueryListEvent) {
      // Only auto-switch if user hasn't explicitly set a preference
      if (!localStorage.getItem(STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within <ThemeProvider>')
  return ctx
}
