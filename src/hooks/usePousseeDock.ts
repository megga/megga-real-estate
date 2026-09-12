/**
 * La poussée du dock MEGGA AI — QUI se comprime quand le panneau s'ouvre.
 *
 * ── POURQUOI CE N'EST PLUS LA COQUILLE ───────────────────────────────────────
 * La poussée vivait sur le conteneur d'`AgentLayout` : un `padding-right` de
 * 404 px, peint au `pageBg` de la palette. Or chaque écran peint SON fond, et la
 * gouttière ne le savait pas. Mesuré le 12 septembre 2026 en clair : « Aujourd'hui »
 * peint `#EBEDF1`, la gouttière `#F9F9F9` — une plaque de 404 px, du haut en bas,
 * derrière le dock. Même défaut sur l'Audit (un dégradé), et après chaque bascule
 * de thème sur les huit écrans qui ne la mémorisaient pas : la page passait au
 * noir, la gouttière restait blanche. Deux peintres pour une seule surface — le
 * seul correctif qui ne se désaccorde jamais est de n'en garder qu'un.
 *
 * La page s'étend donc sous le dock et peint elle-même ce qu'il y a derrière.
 * C'est son PLAN DE TRAVAIL (`CrmWorkspace` : bande d'onglets, barre latérale,
 * contenu) qui se comprime, de la même largeur qu'avant.
 *
 * ── UN REPLI PAR ÉCRAN, PAS SUR LA COQUILLE ──────────────────────────────────
 * Tout écran n'a pas de plan de travail : console, fiche visite, identité,
 * squelette de chargement, états « chargement » de la fiche bien, garde LAB…
 * Ceux-là restent comprimés par leur ÉCRAN (`EcranPousse`, dans
 * `components/layout` : il peint, ce module-ci non), exactement comme avant. La décision se prend écran par écran parce que trois écrans vivent à la
 * fois : un repli posé sur la coquille comprimerait une seconde fois un écran
 * caché qui porte déjà sa poussée — 808 px, et une bande d'onglets qui compte ses
 * puces sur une largeur fausse.
 *
 * ⛔ L'INSCRIPTION EST UN EFFET DE MISE EN PAGE, PAS UN SÉLECTEUR `:has()`. Quand
 * une frontière Suspense re-suspend, React CACHE l'ancien sous-arbre sans le
 * démonter : un `:has([data-plan])` le verrait encore et priverait le squelette
 * de sa poussée. Les effets de mise en page, eux, sont nettoyés sur un arbre
 * caché — ils disent « un plan de travail est À L'ÉCRAN », pas « existe ».
 *
 * ⛔ ET LA BASCULE N'EST JAMAIS ANIMÉE. Seule l'ouverture du dock glisse. Qu'un
 * plan de travail apparaisse (fin de chargement) ou disparaisse, le repli change
 * d'un coup : une transition ferait coexister pendant 420 ms le repli qui se
 * retire et le plan qui se comprime déjà, soit 808 px de poussée.
 */
import { createContext, useContext, useLayoutEffect } from 'react'

/** S'inscrire comme porteur de la poussée ; rend la désinscription. */
export type InscrirePoussee = () => () => void

/**
 * Fourni par l'écran (`EcranPousse`, dans `components/layout`) — le seul à savoir
 * s'il doit se comprimer lui-même. `null` hors écran porteur.
 */
export const PousseeDockContext = createContext<InscrirePoussee | null>(null)

/**
 * Déclare que le composant appelant PORTE la poussée de son écran — il se
 * comprime lui-même (`DOCK_PUSH_STYLE`), l'écran cesse de le faire. Sans écran
 * porteur (bancs `/dev/*` hors coquille), ne fait rien.
 */
export function usePorteSaPoussee(): void {
  const inscrire = useContext(PousseeDockContext)
  useLayoutEffect(() => inscrire?.(), [inscrire])
}
