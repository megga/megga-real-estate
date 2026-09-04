/**
 * Repli / dépli de la barre latérale du CRM — état persistant, partagé.
 *
 * La barre est montée PAR PAGE (chaque surface agent rend sa propre coquille),
 * donc elle se démonte à chaque navigation. Sans persistance, replier la barre
 * ne durerait que le temps d'un écran : le réglage doit survivre au démontage,
 * exactement comme le thème sombre (`crmDark.ts`, même convention de clé pointée).
 *
 * ⚠ Deux abonnements, pas un. `storage` ne notifie QUE les autres onglets ; dans
 * le même onglet, deux instances (une page qui se démonte pendant qu'une autre se
 * monte) ne se verraient pas. D'où l'événement maison, émis à l'écriture.
 */

import { useCallback, useEffect, useState } from 'react'

/** Clé unique du repli. Convention pointée, comme `megga.crm.dark`. */
export const CRM_SIDEBAR_KEY = 'megga.crm.sidebar'

/** Événement même-onglet — `storage` ne porte que le cross-onglet. */
const SIDEBAR_EVENT = 'megga:crm-sidebar'

/**
 * Lecture ponctuelle du repli (SSR-safe, et sûre là où `localStorage` jette).
 *
 * ⛔ `window` peut exister sans `localStorage` : navigation privée Safari,
 * cookies bloqués, environnement de test. L'accès LÈVE au lieu de rendre null —
 * un chrome qui jette à la lecture d'une préférence casserait la page entière.
 * Défaut : barre OUVERTE (le CRM se découvre déplié).
 */
export function readCrmSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage?.getItem(CRM_SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

/** Écrit le repli et prévient les autres instances (même onglet ET autres onglets). */
export function writeCrmSidebarCollapsed(collapsed: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.setItem(CRM_SIDEBAR_KEY, collapsed ? '1' : '0')
  } catch {
    // Stockage refusé : le repli vaut pour la session en cours, sans jeter.
  }
  window.dispatchEvent(new CustomEvent(SIDEBAR_EVENT, { detail: collapsed }))
}

/**
 * État du repli, réactif. Rend `[collapsed, setCollapsed]` — l'écriture passe
 * toujours par `writeCrmSidebarCollapsed`, donc toute autre instance suit.
 */
export function useCrmSidebarCollapsed(): [boolean, (v: boolean) => void] {
  const [collapsed, setCollapsed] = useState<boolean>(readCrmSidebarCollapsed)

  useEffect(() => {
    // ⛔ L'écho MÊME-ONGLET lit `detail`, PAS le stockage. Relire ferait de
    // l'écriture la source de vérité — or elle peut échouer sans jeter hors du
    // `try` (navigation privée, cookies bloqués, quota) : le repli serait alors
    // posé, l'événement émis, la relecture rendrait l'ANCIENNE valeur, et la
    // barre se rouvrirait dans le même tick. Le geste doit valoir pour la
    // session même quand le disque refuse.
    const onLocal = (e: Event) => setCollapsed((e as CustomEvent<boolean>).detail)
    // Le cross-onglet, lui, n'a que le stockage — et s'il a écrit là-bas, il est lisible.
    const onStorage = (e: StorageEvent) => {
      if (e.key === CRM_SIDEBAR_KEY) setCollapsed(readCrmSidebarCollapsed())
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener(SIDEBAR_EVENT, onLocal)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(SIDEBAR_EVENT, onLocal)
    }
  }, [])

  const set = useCallback((v: boolean) => {
    setCollapsed(v)
    writeCrmSidebarCollapsed(v)
  }, [])

  return [collapsed, set]
}
