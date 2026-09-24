/**
 * Le fil de matchs — les signaux « pourquoi maintenant » (lot C, conception de la boucle §4.1). Module PUR : ni
 * React, ni Supabase, ni traduction.
 *
 * Trois signaux, lus sur le BIEN : une baisse de prix récente (une annonce du marché), une annonce nouvelle sur le
 * marché, un nouveau mandat. Plus celui du lot B, porté par le MATCH (`signalPrix`) : la baisse depuis que le bien a
 * été proposé ou refusé — il passe avant, parce qu'il parle de CET acheteur.
 *
 * ⛔ LES SEUILS SONT AUSSI CEUX DE LA BASE : `matching_fil_marche_resume()` (migration `…_matching_explique.sql`)
 * compte les annonces nouvelles et en baisse de la ligne « Marché » avec les mêmes ; `matching-fil-signaux.spec.ts`
 * lit la migration pour les confronter.
 */
import { temps, type FilBien, type FilMatch } from './filModele'
import { signalPrix } from './filBoucle'

/** Une annonce vue pour la première fois il y a 3 jours au plus est « nouvelle » (§4.1). */
export const JOURS_NOUVEAU = 3
/** Une baisse de prix de 14 jours au plus dit « pourquoi maintenant » ; au-delà, c'est son prix. */
export const JOURS_BAISSE = 14
/** Un mandat signé ou mis en service il y a 7 jours au plus est « nouveau ». */
export const JOURS_MANDAT = 7
const JOUR = 86_400_000

export type SignalBien =
  | { genre: 'baisse'; montant: number; le: string }
  | { genre: 'nouveau'; le: string }
  | { genre: 'mandat'; le: string }

/** Une date des `jours` derniers jours ; une date future est une saisie fautive, pas un signal. */
function recente(iso: string | null | undefined, jours: number, maintenant: number): iso is string {
  const t = temps(iso ?? null)
  return t > 0 && t <= maintenant && maintenant - t <= jours * JOUR
}

/**
 * Le signal d'un bien, ou `null`. Une annonce du marché : sa baisse d'abord, puis sa nouveauté. Un mandat : sa
 * signature ou sa mise en service (la plus récente des deux, `mandatLe`).
 *
 * ⛔ Un prix nul (« prix sur demande ») n'est pas une baisse, pas plus qu'une hausse : même règle que `signalPrix`.
 */
export function signalBien(bien: FilBien, maintenant: number): SignalBien | null {
  if (bien.marche) {
    const prix = bien.prix
    const premier = bien.prixInitial
    if (prix != null && prix > 0 && premier != null && premier > prix && recente(bien.baisseLe, JOURS_BAISSE, maintenant)) {
      return { genre: 'baisse', montant: premier - prix, le: bien.baisseLe }
    }
    return recente(bien.vuLe, JOURS_NOUVEAU, maintenant) ? { genre: 'nouveau', le: bien.vuLe } : null
  }
  return recente(bien.mandatLe, JOURS_MANDAT, maintenant) ? { genre: 'mandat', le: bien.mandatLe } : null
}

/** Un match porte un signal : le sien (lot B), ou celui de son bien. C'est ce qui le fait passer devant, à score égal. */
export function aUnSignal(m: FilMatch, maintenant: number): boolean {
  return signalPrix(m) != null || signalBien(m.bien, maintenant) != null
}
