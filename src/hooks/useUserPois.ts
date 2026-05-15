// MEGGA Marketplace — "Mes lieux" multi-POI storage.
//
// L'utilisateur enregistre jusqu'à 3 adresses (travail, école, sport…) et la
// grid affiche le temps de trajet vers chacun sur chaque carte. Trait
// différenciateur identifié dans l'audit : personne en CH ne combine POI
// multi-points + filtrage de liste (ImmoScout24 a les isochrones mais elles
// ne filtrent pas).
//
// Persistance : localStorage. Sync entre instances du hook via le même
// pattern de custom event que useLocationPreference.

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'megga.user-pois'
const CHANGE_EVENT = 'megga:user-pois-changed'
const MAX_POIS = 3

export interface UserPoi {
  /** Identifiant local stable (uuid v4 ou timestamp + random). Sert de key React. */
  id: string
  /** Libellé court affiché à l'utilisateur (« Bureau », « École des enfants »). */
  label: string
  /** Adresse text utilisée pour le géocodage initial. Affichée en tooltip. */
  address: string
  /** Coordonnées résolues par Mapbox Geocoding. */
  lat: number
  lng: number
  /** Timestamp d'ajout — sert juste pour tri par date d'ajout. */
  addedAt: number
}

function isValidPoi(p: unknown): p is UserPoi {
  if (!p || typeof p !== 'object') return false
  const r = p as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.label === 'string' &&
    typeof r.address === 'string' &&
    typeof r.lat === 'number' &&
    typeof r.lng === 'number' &&
    Number.isFinite(r.lat) &&
    Number.isFinite(r.lng) &&
    Math.abs(r.lat) <= 90 &&
    Math.abs(r.lng) <= 180
  )
}

function readStorage(): UserPoi[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidPoi).slice(0, MAX_POIS)
  } catch {
    return []
  }
}

function writeStorage(pois: UserPoi[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pois.slice(0, MAX_POIS)))
  } catch {
    // quota / private mode → ignorer
  }
  try {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT))
  } catch {
    // ignore
  }
}

function genId(): string {
  // crypto.randomUUID() si dispo, sinon timestamp + random
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function useUserPois() {
  const [pois, setPoisState] = useState<UserPoi[]>(() => readStorage())

  useEffect(() => {
    const sync = () => setPoisState(readStorage())
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

  const addPoi = useCallback(
    (poi: Omit<UserPoi, 'id' | 'addedAt'>): UserPoi | null => {
      const current = readStorage()
      if (current.length >= MAX_POIS) return null
      const next: UserPoi = { ...poi, id: genId(), addedAt: Date.now() }
      writeStorage([...current, next])
      return next
    },
    [],
  )

  const removePoi = useCallback((id: string) => {
    const current = readStorage()
    writeStorage(current.filter(p => p.id !== id))
  }, [])

  const updatePoi = useCallback((id: string, patch: Partial<Omit<UserPoi, 'id'>>) => {
    const current = readStorage()
    writeStorage(current.map(p => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const clearAll = useCallback(() => {
    writeStorage([])
  }, [])

  return {
    pois,
    addPoi,
    removePoi,
    updatePoi,
    clearAll,
    canAddMore: pois.length < MAX_POIS,
    maxPois: MAX_POIS,
  }
}

// Suggestions de labels pré-remplis (UX rapide pour l'ajout)
export const POI_LABEL_PRESETS = [
  'Bureau',
  'École',
  'Gare',
  'Sport',
  'Famille',
] as const
