/**
 * « Cet écran est-il celui qu'on REGARDE ? »
 *
 * ⛔ POURQUOI CE CONTEXTE EXISTE. Depuis que la coquille garde trois écrans
 * vivants (`EcransVivants`, AgentLayout), trois copies du chrome sont montées :
 * trois barres latérales, trois bandes d'onglets. Deux d'entre elles sont
 * invisibles — mais leurs effets tournent, et un `window.addEventListener` posé
 * dans un composant caché écoute le clavier comme les autres.
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
import { createContext, useContext } from 'react'

const Ctx = createContext<boolean>(true)

export const EcranActifProvider = Ctx.Provider

/** `false` seulement dans un écran vivant mais caché. */
export function useEcranActif(): boolean {
  return useContext(Ctx)
}
