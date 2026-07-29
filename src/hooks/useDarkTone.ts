/**
 * Teinte sombre active du CRM (Graphite / Noir pur) — lecture réactive.
 *
 * Le proto pose la teinte sur `window.__meggaDarkTone` et force un re-render
 * global depuis `App()`. Ici le même contrat est tenu par un store externe :
 * qui écrit la teinte notifie, et tout composant abonné se re-teinte sans
 * rechargement (exigence de la recette du handoff).
 *
 * `window.__meggaDarkTone` est la source lue par `crmDarkTone()`, donc aussi
 * par `crmStep()` appelé hors composant.
 */
import { useSyncExternalStore } from 'react'
import { crmDarkTone, DARK_TONE_KEY, type DarkTone } from '@/components/crm-sugar/tokens'

/** Événement interne — `storage` ne se déclenche pas dans l'onglet qui écrit. */
const TONE_EVENT = 'megga:darkTone'

function subscribe(onChange: () => void): () => void {
  window.addEventListener(TONE_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(TONE_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/**
 * Bascule la teinte sombre : persiste, publie sur `window`, puis notifie.
 *
 * ⚠️ Ne touche PAS au mode clair/sombre — choisir une teinte depuis le clair
 * n'a aucun effet visible tant qu'on n'allume pas le sombre. C'est l'appelant
 * (le réglage Apparence) qui allume le sombre, comme acté au handoff.
 */
export function setDarkTone(tone: DarkTone): void {
  try {
    window.localStorage.setItem(DARK_TONE_KEY, tone)
  } catch {
    // Mode privé / quota : la teinte vaut au moins pour la session en cours.
  }
  ;(window as Window & { __meggaDarkTone?: DarkTone }).__meggaDarkTone = tone
  window.dispatchEvent(new Event(TONE_EVENT))
}

/** Teinte active, re-rendue à chaque bascule (même onglet ET onglets voisins). */
export function useDarkTone(): DarkTone {
  return useSyncExternalStore(subscribe, crmDarkTone, crmDarkTone)
}
