// Thème sombre partagé des écrans du CRM (Pipeline, Today, fiche Deal, modale offre).
// Source unique de vérité : une clé localStorage, écrite par `writeCrmDark` qui
// annonce aussi la bascule dans l'onglet ; les écrans la suivent par `useCrmDark`
// (lecture) ou `useCrmDarkPref` (lecture + bascule).

import { useCallback, useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'

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
 * La bascule, annoncée DANS l'onglet.
 *
 * ⛔ `storage` NE PART QUE VERS LES AUTRES ONGLETS. Dans celui où l'on clique, rien
 * ne prévenait les autres lecteurs : le dock MEGGA AI et la coquille relisaient
 * la clé toutes les 400 ms, et huit écrans ne l'écrivaient même pas — ils
 * gardaient le thème dans un `useState` local. Mesuré le 12 septembre 2026 sur
 * Analytics : bascule en sombre, page noire, gouttière `#F9F9F9` et dock BLANC —
 * une plaque claire de 404 px, du haut en bas, à côté d'une page noire. Et les
 * écrans gardés vivants derrière l'onglet affiché restaient dans l'ancien thème.
 */
export const CRM_DARK_EVENT = 'megga:crm-dark'

/**
 * Écrit la préférence ET l'annonce à tous les lecteurs de l'onglet.
 *
 * ⚠ L'annonce porte la VALEUR : si le stockage refuse l'écriture (cookies
 * bloqués), la bascule vaut quand même pour tout ce qui est à l'écran.
 */
export function writeCrmDark(dark: boolean): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage?.setItem(STORAGE_KEY, dark ? '1' : '0')
  } catch {
    // Stockage refusé : la bascule ne survivra pas au rechargement, rien de plus.
  }
  window.dispatchEvent(new CustomEvent<boolean>(CRM_DARK_EVENT, { detail: dark }))
}

/**
 * Le thème sombre du CRM, en lecture. Suit les bascules faites dans l'onglet
 * (`CRM_DARK_EVENT`), dans les autres (`storage`), et — tant que l'agent n'a
 * rien choisi — l'apparence du système.
 *
 * ⛔ LE SYSTÈME FAIT PARTIE DE LA SOURCE UNIQUE. Sans choix enregistré,
 * `readCrmDark()` retombe sur `prefers-color-scheme`, et le relit à chaque appel.
 * Tant que les écrans ÉCRIVAIENT la clé à leur montage, la première lecture
 * figeait la valeur pour toute la session ; ils ne l'écrivent plus (seul un geste
 * de l'agent l'écrit). Un Mac en apparence « Auto » qui passe au sombre au
 * coucher du soleil aurait alors ouvert les écrans suivants en sombre à côté d'un
 * dock resté clair — la plaque, par un autre chemin. Tous les lecteurs suivent
 * donc le changement ensemble.
 */
export function useCrmDark(): boolean {
  const [dark, setDark] = useState<boolean>(readCrmDark)
  useEffect(() => {
    const relire = () => setDark(readCrmDark())
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) relire()
    }
    const onBascule = (e: Event) => setDark((e as CustomEvent<boolean>).detail)
    window.addEventListener('storage', onStorage)
    window.addEventListener(CRM_DARK_EVENT, onBascule)
    // `readCrmDark` ignore le système dès qu'un choix est enregistré : écouter
    // l'apparence en permanence est donc sans effet pour qui a choisi.
    const systeme = window.matchMedia?.('(prefers-color-scheme: dark)')
    systeme?.addEventListener?.('change', relire)
    // Pas de relecture à l'abonnement : `writeCrmDark` écrit la clé AVANT
    // d'annoncer, donc un écran monté entre-temps l'a déjà lue à son rendu.
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener(CRM_DARK_EVENT, onBascule)
      systeme?.removeEventListener?.('change', relire)
    }
  }, [])
  return dark
}

/**
 * Le thème sombre du CRM, en lecture ET en écriture — pour l'écran qui porte la
 * bascule (sa barre latérale ou sa bande d'onglets reçoivent `setDark`).
 *
 * ⛔ C'EST CE HOOK, ET NON UN `useState` LOCAL. Avec un état local, la bascule
 * restait une affaire privée de l'écran : le dock, la coquille, les primitives
 * qui lisent `useCrmDark()` et les autres écrans vivants ne la voyaient pas.
 */
export function useCrmDarkPref(): [boolean, Dispatch<SetStateAction<boolean>>] {
  const dark = useCrmDark()
  // ⚠ La forme fonctionnelle aussi, comme le setter de `useState` qu'il remplace :
  // le tableau de bord d'Analytics bascule par `setDark((v) => !v)`.
  const setDark = useCallback(
    (v: SetStateAction<boolean>) => writeCrmDark(typeof v === 'function' ? v(dark) : v),
    [dark],
  )
  return [dark, setDark]
}
