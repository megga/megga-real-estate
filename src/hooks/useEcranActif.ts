/**
 * « Cet écran est-il celui qu'on REGARDE ? »
 *
 * ⛔ POURQUOI CE CONTEXTE EXISTE. La coquille garde plusieurs écrans vivants
 * (`EcransVivants`, AgentLayout), donc plusieurs copies de chaque écran et de son
 * chrome sont montées ; une seule est montrée. Les autres sont invisibles — mais
 * leurs effets tournent, et un `window.addEventListener` posé dans un composant
 * caché écoute le clavier comme les autres.
 *
 * Mesuré le 7 septembre 2026 : une frappe `Alt+1` déclenchait **trois** fois le
 * raccourci de la bande. Le résultat visible était juste (les trois appels
 * visent le même onglet), mais chacun appelle `navigate()` avec la même URL
 * pendant que `useLocation()` rend encore l'ancienne — donc **trois entrées
 * d'historique**, et un bouton « précédent » qu'il faut presser trois fois pour
 * quitter l'écran.
 *
 * ⚠ Le défaut par défaut est `true`, et c'est délibéré : tout ce qui est monté
 * HORS du porteur d'écrans vivants — le CRM mobile, la console super-admin, les
 * bancs `/dev/*` — n'a qu'une copie de son chrome et doit continuer d'écouter.
 * Un défaut à `false` y couperait les raccourcis sans que rien ne le dise.
 */
import { createContext, useContext, useEffect, useRef } from 'react'

const Ctx = createContext<boolean>(true)

export const EcranActifProvider = Ctx.Provider

/** `false` seulement dans un écran vivant mais caché. */
export function useEcranActif(): boolean {
  return useContext(Ctx)
}

/**
 * Le même drapeau, lisible depuis un GESTIONNAIRE d'événement déjà posé.
 *
 * ⛔ POUR LES ÉCOUTEURS GLOBAUX QU'ON NE VEUT PAS RE-POSER. Six pagers écoutent
 * `keydown` sur `window` et font `preventDefault()` sur ↑/↓/PageUp/PageDown : dans
 * un écran caché, ils volaient les flèches à l'écran montré (plus de défilement)
 * et changeaient de page en silence — reproduit le 12 septembre 2026, frappe
 * réelle. Leur effet pose aussi la molette et le tactile ; le relancer sur la
 * visibilité réarmerait tout pour une seule garde. Le gestionnaire lit donc ce
 * drapeau et sort tôt.
 *
 * ⚠ Mis à jour en effet et non au rendu : écrire une ref pendant le rendu est
 * refusé par la règle `react-hooks` du dépôt.
 */
export function useEcranActifRef(): { readonly current: boolean } {
  const actif = useEcranActif()
  const ref = useRef(actif)
  useEffect(() => { ref.current = actif }, [actif])
  return ref
}
