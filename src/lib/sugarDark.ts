// Thème sombre partagé des écrans Sugar (Pipeline, Today, fiche Deal, modale offre).
// Source unique de vérité : la clé localStorage `megga.sugar.dark` (togglée par le
// rail d'icônes du Pipeline/Today). Les routes autonomes (fiche Deal, modale offre)
// la lisent au montage pour partager EXACTEMENT le même fond sombre (#0A0B0D).

import { useEffect, useState } from 'react'

/** Clé unique du réglage clair/sombre Sugar. Exportée : la console admin écrit
 *  dessus (AdminThemeProvider) et doit viser EXACTEMENT la même clé. */
export const SUGAR_DARK_KEY = 'megga.sugar.dark'
const STORAGE_KEY = SUGAR_DARK_KEY

/**
 * Lecture ponctuelle de la préférence sombre (SSR-safe).
 *
 * ⛔ `window` PEUT EXISTER SANS `localStorage`, et sans `matchMedia`. Tester le
 * seul `window` ne suffit donc pas : l'environnement de test de vitest fournit
 * l'un sans l'autre, et un navigateur le fait aussi — Safari en navigation
 * privée et tout contexte où les cookies sont bloqués font LEVER l'accès à
 * `localStorage`, pas rendre `null`. Une lecture de thème qui jette casserait le
 * rendu de la surface entière ; elle doit dégrader vers le clair, jamais échouer.
 *
 * Le défaut s'est révélé en donnant une branche sombre à `SugarV3` : ses maps de
 * libellés lisent le thème par un getter, donc cette fonction est devenue
 * atteignable depuis un import de module — ce qu'elle n'était pas quand seuls des
 * composants l'appelaient.
 */
export function readSugarDark(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY)
    if (saved === '1') return true
    if (saved === '0') return false
  } catch {
    // Accès refusé (navigation privée, cookies bloqués) : on retombe sur le système.
  }
  try {
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  } catch {
    return false
  }
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
