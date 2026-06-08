// MEGGA Marketplace — Persistence du canton de recherche.
//
// Cold start UX (Phase 2 plan post-audit) : sur première visite sans filtre,
// on demande à l'user où il cherche. La sélection est persistée en
// localStorage pour qu'à la prochaine visite, le banner pré-remplisse sa
// dernière recherche en un clic.
//
// La détection "ma position" passe par le reverse-geocoding Mapbox (token
// déjà en env). Pas de migration nécessaire — Phase 2 est full frontend.

import { useCallback, useEffect, useState } from 'react'
import { SWISS_CANTONS } from '@/lib/swissCantons'

const STORAGE_KEY = 'megga.location-preference'
const DISMISS_SESSION_KEY = 'megga.location-onboarding-dismissed'

// Custom event pour sync entre instances du hook dans le même tab. Le storage
// event natif ne fire que pour les AUTRES tabs ; on doit donc émettre nous-
// même pour que LocationSyncer + PxLocationOnboarding restent cohérents.
const CHANGE_EVENT = 'megga:location-preference-changed'

export interface LocationPreference {
  canton: string
  setAt: number
}

function readStorage(): LocationPreference | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<LocationPreference>
    if (!parsed.canton || typeof parsed.canton !== 'string') return null
    if (!(SWISS_CANTONS as readonly string[]).includes(parsed.canton)) return null
    return {
      canton: parsed.canton,
      setAt: typeof parsed.setAt === 'number' ? parsed.setAt : Date.now(),
    }
  } catch {
    return null
  }
}

function writeStorage(canton: string | null) {
  try {
    if (canton === null) {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      const next: LocationPreference = { canton, setAt: Date.now() }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  } catch {
    // Quota exceeded ou Safari ITP en mode private — ignorer.
  }
  // Notifie les autres instances du hook dans le même tab.
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // SSR / pas de window — ignorer.
  }
}

function writeDismiss(dismissed: boolean) {
  try {
    if (dismissed) sessionStorage.setItem(DISMISS_SESSION_KEY, '1')
    else sessionStorage.removeItem(DISMISS_SESSION_KEY)
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // ignore
  }
}

/**
 * Lecture/écriture de la préférence de canton. La valeur survit au reload
 * (localStorage) mais peut être effacée par l'utilisateur via la
 * réinitialisation de la session.
 */
export function useLocationPreference(): {
  saved: LocationPreference | null
  setSaved: (canton: string | null) => void
  isDismissedThisSession: boolean
  dismissForSession: () => void
  resetDismiss: () => void
} {
  const [saved, setSavedState] = useState<LocationPreference | null>(() => readStorage())
  const [dismissed, setDismissedState] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(DISMISS_SESSION_KEY) === '1'
    } catch {
      return false
    }
  })

  // Sync entre instances du hook : cross-tab via `storage`, same-tab via
  // notre custom event. Sans ça, PxLocationOnboarding et LocationSyncer
  // (qui call tous deux useLocationPreference) divergent dès qu'un seul
  // appelle setSaved.
  useEffect(() => {
    const sync = () => {
      setSavedState(readStorage())
      try {
        setDismissedState(sessionStorage.getItem(DISMISS_SESSION_KEY) === '1')
      } catch {
        // ignore
      }
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY || e.key === null) sync()
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(CHANGE_EVENT, sync)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CHANGE_EVENT, sync)
    }
  }, [])

  const setSaved = useCallback((canton: string | null) => {
    writeStorage(canton)
    // L'event listener met à jour le state (cohérent avec les autres instances).
  }, [])

  const dismissForSession = useCallback(() => {
    writeDismiss(true)
  }, [])

  const resetDismiss = useCallback(() => {
    writeDismiss(false)
  }, [])

  return {
    saved,
    setSaved,
    isDismissedThisSession: dismissed,
    dismissForSession,
    resetDismiss,
  }
}

// ─── Geolocation → canton ────────────────────────────────────────────────────
//
// Utilise Mapbox Geocoding API (token déjà setup). On filtre `country=ch`
// + `types=region` car en Suisse, Mapbox renvoie les cantons sous forme de
// régions avec un `short_code` ISO "CH-XX".

interface MapboxFeature {
  properties?: { short_code?: string }
  context?: Array<{ id: string; short_code?: string }>
}

interface MapboxResponse {
  features?: MapboxFeature[]
}

/**
 * Reverse-geocode coordonnées → canton ISO ("GE", "VD"...). Retourne null
 * si hors Suisse, si Mapbox échoue, ou si pas de token.
 */
export async function detectCantonFromCoords(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<string | null> {
  const token = import.meta.env.VITE_MAPBOX_TOKEN
  if (!token) return null

  const url = new URL(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json`,
  )
  url.searchParams.set('types', 'region')
  url.searchParams.set('country', 'ch')
  url.searchParams.set('limit', '1')
  url.searchParams.set('access_token', token)

  try {
    const res = await fetch(url.toString(), { signal })
    if (!res.ok) return null
    const data = (await res.json()) as MapboxResponse
    const feature = data.features?.[0]
    if (!feature) return null
    // Mapbox renvoie short_code "CH-XX" sur l'objet region directement, ou
    // dans le context array selon le niveau de granularité.
    const codes: string[] = []
    if (feature.properties?.short_code) codes.push(feature.properties.short_code)
    for (const ctx of feature.context ?? []) {
      if (ctx.short_code) codes.push(ctx.short_code)
    }
    for (const code of codes) {
      const match = code.toUpperCase().match(/^CH-([A-Z]{2})$/)
      if (match && (SWISS_CANTONS as readonly string[]).includes(match[1])) {
        return match[1]
      }
    }
    return null
  } catch {
    // AbortError, network fail, JSON parse, etc. — tous traités pareil.
    return null
  }
}

/**
 * Demande la position du navigateur (consent requis) puis reverse-geocode.
 * Retourne le canton ISO ou null si refusé / hors Suisse / Mapbox down.
 */
export async function detectUserCanton(): Promise<{
  canton: string | null
  reason: 'ok' | 'denied' | 'unavailable' | 'timeout' | 'outside-ch'
}> {
  if (!('geolocation' in navigator)) {
    return { canton: null, reason: 'unavailable' }
  }

  // On capture le code d'erreur pour distinguer denied / timeout / unavailable.
  // 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT.
  const result = await new Promise<
    { ok: true; pos: GeolocationPosition } | { ok: false; code: number }
  >(resolve => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ ok: true, pos }),
      err => resolve({ ok: false, code: err.code }),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 60_000 },
    )
  })

  if (!result.ok) {
    const reason: 'denied' | 'unavailable' | 'timeout' =
      result.code === 1 ? 'denied' :
      result.code === 3 ? 'timeout' :
      'unavailable'
    return { canton: null, reason }
  }

  const position = result.pos

  const canton = await detectCantonFromCoords(
    position.coords.latitude,
    position.coords.longitude,
  )
  if (!canton) return { canton: null, reason: 'outside-ch' }
  return { canton, reason: 'ok' }
}
