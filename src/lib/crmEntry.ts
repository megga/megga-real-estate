/**
 * Drapeau « on est entré dans le CRM » pour le chargement de la page courante.
 *
 * Sert à distinguer les deux sens d'une même attente :
 *  - AVANT la première peinture du CRM, l'agent arrive de megga.ch/login et
 *    doit voir l'écran d'arrivée ([[BootCurtain]]) — un squelette gris ne lui
 *    apprendrait rien, il casserait juste la transition ;
 *  - APRÈS, la même attente veut dire « la page se construit », et c'est le
 *    squelette de route (SmartPageLoader) qui est juste.
 *
 * Volontairement au niveau du module, pas dans un contexte React : les routes
 * sont keyées par `pathname` (cf. AnimatedRoutes), donc TOUT l'arbre protégé se
 * remonte à chaque navigation. Un état React serait remis à zéro et le rideau
 * se rejouerait à chaque changement de page — exactement ce qu'on ne veut pas.
 * Le drapeau meurt avec le document, ce qui est la bonne durée de vie : un vrai
 * rechargement est bien une nouvelle arrivée.
 */

let entered = false

/** Vrai dès que l'arbre protégé a rendu une page réelle au moins une fois. */
export function hasEnteredCrm(): boolean {
  return entered
}

/** Appelé une fois, à la première peinture d'une surface protégée. */
export function markCrmEntered(): void {
  entered = true
}
