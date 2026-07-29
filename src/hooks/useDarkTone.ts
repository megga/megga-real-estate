/**
 * Teinte sombre active du CRM (Graphite / Noir pur) — lecture réactive.
 *
 * Le proto pose la teinte sur `window.__meggaDarkTone` et force un re-render
 * global depuis `App()`. Ici le même contrat est tenu par un store externe :
 * qui écrit la teinte notifie, et tout composant abonné se re-teinte sans
 * rechargement (exigence de la recette du handoff).
 *
 * Côté écriture, `setDarkTone` arrive avec le réglage Apparence — tant que rien
 * ne permet de changer de teinte, il n'y a rien à publier.
 *
 * `window.__meggaDarkTone` est la source lue par `crmDarkTone()`, donc aussi
 * par `crmStep()` appelé hors composant.
 */
import { useSyncExternalStore } from 'react'
import { crmDarkTone, type DarkTone } from '@/components/crm-sugar/tokens'

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

/** Teinte active, re-rendue à chaque bascule (même onglet ET onglets voisins). */
export function useDarkTone(): DarkTone {
  return useSyncExternalStore(subscribe, crmDarkTone, crmDarkTone)
}
