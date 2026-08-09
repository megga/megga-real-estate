/**
 * Direction artistique active du CRM (Sugar / MEGGA X) — lecture réactive.
 *
 * Calqué sur `useDarkTone` : qui écrit la direction persiste, publie sur
 * `window.__meggaDa` puis notifie, et tout composant abonné se re-teinte sans
 * rechargement. `window.__meggaDa` est la source lue par `crmDa()`, donc aussi
 * par `crmSugarPalette()` appelée hors composant.
 *
 * L'attribut `data-crm-da` posé sur `<html>` ne sert PAS aux couleurs — elles
 * passent par la palette. Il ne porte que ce qu'une palette ne peut pas dire :
 * la police, et plus tard les barreaux de grammaire.
 */
import { useSyncExternalStore } from 'react'
import { crmDa, DA_KEY, type CrmDa } from '@/components/megga-x-crm/tokens'

/** Événement interne — `storage` ne se déclenche pas dans l'onglet qui écrit. */
const DA_EVENT = 'megga:da'

function subscribe(onChange: () => void): () => void {
  window.addEventListener(DA_EVENT, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(DA_EVENT, onChange)
    window.removeEventListener('storage', onChange)
  }
}

/** Bascule la direction : persiste, publie sur `window`, puis notifie. */
export function setCrmDa(da: CrmDa): void {
  try {
    window.localStorage.setItem(DA_KEY, da)
  } catch {
    // Mode privé / quota : la direction vaut au moins pour la session en cours.
  }
  ;(window as Window & { __meggaDa?: CrmDa }).__meggaDa = da
  window.dispatchEvent(new Event(DA_EVENT))
}

/** Direction active, re-rendue à chaque bascule (même onglet ET onglets voisins). */
export function useCrmDa(): CrmDa {
  return useSyncExternalStore(subscribe, crmDa, crmDa)
}
