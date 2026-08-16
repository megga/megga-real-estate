// Thème sombre partagé des écrans du CRM (Pipeline, Today, fiche Deal, modale offre).
// Source unique de vérité : une clé localStorage, togglée par le rail d'icônes. Les
// routes autonomes la lisent au montage pour partager EXACTEMENT le même fond.

import { useEffect, useState } from 'react'

/**
 * Clé unique du réglage clair/sombre. Exportée : la console admin écrit dessus
 * (AdminThemeProvider) et doit viser EXACTEMENT la même clé.
 *
 * ⛔ CETTE CLÉ A ÉTÉ RENOMMÉE (17 août 2026), ET C'EST LE SEUL RENOMMAGE DU LOT
 * QUI NE SOIT PAS LEXICAL. Les 200 autres portaient sur du code ; celle-ci
 * désigne une DONNÉE déjà écrite chez l'utilisateur. La renommer sèchement
 * aurait fait repasser au réglage système tout agent ayant choisi le sombre —
 * une régression visible, silencieuse, et impossible à distinguer d'un bug.
 *
 * D'où la migration : on lit la NOUVELLE clé, et si elle est absente on retombe
 * sur l'ANCIENNE puis on la réécrit sous le nouveau nom. Le premier chargement
 * après déploiement transporte donc la préférence, sans que l'agent voie quoi
 * que ce soit.
 *
 * ⚠ `LEGACY_KEY` ne se retire pas « quand on aura le temps » : tant qu'un agent
 * peut revenir après une longue absence avec l'ancienne clé et AUCUNE nouvelle,
 * la retirer lui reprend son thème. Elle est gardée par
 * `tests/unit/crm-dark-migration.spec.ts`.
 */
export const CRM_DARK_KEY = 'megga.crm.dark'
/** L'ancienne clé — lue en repli, jamais écrite. Voir le bloc ci-dessus. */
export const LEGACY_DARK_KEY = 'megga.sugar.dark'
const STORAGE_KEY = CRM_DARK_KEY

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
 * Le défaut s'est révélé en donnant une branche sombre à `DossierTokens` : ses maps de
 * libellés lisent le thème par un getter, donc cette fonction est devenue
 * atteignable depuis un import de module — ce qu'elle n'était pas quand seuls des
 * composants l'appelaient.
 */
export function readCrmDark(): boolean {
  if (typeof window === 'undefined') return false
  try {
    const saved = window.localStorage?.getItem(STORAGE_KEY)
    if (saved === '1') return true
    if (saved === '0') return false
    // ⚠ MIGRATION : rien sous la nouvelle clé → on reprend l'ancienne ET on la
    // transcrit, pour que la lecture suivante n'ait plus à y penser. L'écriture
    // est dans le même `try` : si le stockage refuse, on dégrade sans jeter.
    const legacy = window.localStorage?.getItem(LEGACY_DARK_KEY)
    if (legacy === '1' || legacy === '0') {
      window.localStorage?.setItem(STORAGE_KEY, legacy)
      return legacy === '1'
    }
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
export function applyCrmThemeAttribute(root: Element, dark: boolean): void {
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
export function useCrmDark(): boolean {
  const [dark, setDark] = useState<boolean>(readCrmDark)
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setDark(readCrmDark())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])
  return dark
}
