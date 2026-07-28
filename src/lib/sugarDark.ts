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
 * Applique le mode sombre sur `<html>`, à la convention des surfaces Sugar :
 * l'attribut porte 'dark', et le clair se dit par son ABSENCE.
 *
 * ⚠️ Le CRM, lui, pose toujours `data-theme` explicitement ('light' ou 'dark').
 * Les deux conventions coexistent sur le même attribut, d'où `captureThemeAttribute`.
 */
export function applySugarThemeAttribute(root: Element, dark: boolean): void {
  if (dark) root.setAttribute('data-theme', 'dark')
  else root.removeAttribute('data-theme')
}

/**
 * Capture `data-theme` et rend de quoi le remettre tel quel.
 *
 * `data-theme` est GLOBAL et partagé : une surface qui l'impose le temps de sa
 * vie doit le rendre en partant, sinon elle laisse le reste de l'application
 * dans SON réglage. C'est ce qui arrivait en quittant la console admin — le CRM
 * héritait de son mode jusqu'à la prochaine bascule manuelle.
 */
export function captureThemeAttribute(root: Element): () => void {
  const previous = root.getAttribute('data-theme')
  return () => {
    if (previous === null) root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', previous)
  }
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
