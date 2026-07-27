// Thème sombre partagé des écrans Sugar (Pipeline, Today, fiche Deal, modale offre).
// Source unique de vérité : la clé localStorage `megga.sugar.dark` (togglée par le
// rail d'icônes du Pipeline/Today). Les routes autonomes (fiche Deal, modale offre)
// la lisent au montage pour partager EXACTEMENT le même fond sombre (#0A0B0D).

import { useEffect, useState } from 'react'

/** Clé unique du réglage clair/sombre Sugar. Exportée : la console admin écrit
 *  dessus (AdminThemeProvider) et doit viser EXACTEMENT la même clé. */
export const SUGAR_DARK_KEY = 'megga.sugar.dark'
const STORAGE_KEY = SUGAR_DARK_KEY

/** Lecture ponctuelle de la préférence sombre (SSR-safe). */
export function readSugarDark(): boolean {
  if (typeof window === 'undefined') return false
  const saved = window.localStorage.getItem(STORAGE_KEY)
  if (saved === '1') return true
  if (saved === '0') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/**
 * Hook lecture seule du thème sombre Sugar. Se resynchronise sur les changements
 * inter-onglets (`storage`) — dans le même onglet, les routes remontent à la
 * navigation, donc la lecture au montage suffit.
 */
export function useSugarDark(): boolean {
  const [dark, setDark] = useState<boolean>(readSugarDark)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDark(readSugarDark())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return dark
}
