/**
 * Déplacer un événement du Calendrier — d'une heure à l'autre, et d'un JOUR à l'autre.
 *
 * Les calculs purs du glissé, tenus hors des composants pour être éprouvés sans
 * navigateur (`calendrier-deplacement.spec.ts`) : ce qui se saisit, le calage au
 * quart d'heure, la pose dans un jour cible et le décalage de N jours civils.
 *
 * ⚠ LE PAS S'APPLIQUE AU DÉCALAGE, JAMAIS À L'HEURE. Une tâche de 18:55 glissée
 * d'un jour vers la droite arrive le lendemain à 18:55 — caler l'heure elle-même
 * la ferait arriver à 19:00, et « changer de jour » changerait aussi l'heure sans
 * que personne ne l'ait demandé.
 */
import type { CalEvent } from './data'
import { CAL_HOUR_END, CAL_HOUR_START } from './helpers'

/** Le pas du glissé, en minutes — celui du redimensionnement. */
export const CAL_PAS_MIN = 15

/**
 * Un événement se déplace-t-il à la main ?
 *
 * Non pour trois familles, et aucune pour une raison technique :
 *  - un créneau EXTERNE « Occupé » appartient à l'agenda Google/Outlook de l'agent ;
 *  - une OCCURRENCE de série n'est qu'une projection de sa série ;
 *  - un RDV de vérification KYC (`appointment`) a été réservé par le CLIENT : le
 *    déplacer sans le prévenir serait pire que de ne rien faire (cf. `CalEvent.origin`).
 *    ⛔ Il se laissait pourtant glisser jusqu'au 14.09.2026 — et revenait à sa place
 *    au rechargement, rien ne l'enregistrant : un geste qui ment.
 */
export function calDeplacable(e: CalEvent): boolean {
  return !e.external && !e.isOccurrence && e.origin !== 'appointment'
}

/** Minutes calées au pas le plus proche. */
export function calCaler(min: number, pas = CAL_PAS_MIN): number {
  return Math.round(min / pas) * pas
}

/** Minutes écoulées depuis minuit. */
export function calMinutesDuJour(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

/**
 * Pose un événement dans `jour`, son début décalé de `deltaMin` (calé au pas) et
 * borné à la journée affichée ; la durée ne change pas.
 */
export function calPlacer(
  e: { start: Date; end: Date },
  jour: Date,
  deltaMin: number,
): { start: Date; end: Date } {
  const duree = Math.round((e.end.getTime() - e.start.getTime()) / 60000)
  const min = CAL_HOUR_START * 60
  const max = Math.max(min, CAL_HOUR_END * 60 - duree)
  const debut = Math.max(min, Math.min(calMinutesDuJour(e.start) + calCaler(deltaMin), max))
  const start = new Date(jour)
  start.setHours(0, 0, 0, 0)
  start.setMinutes(debut)
  const end = new Date(start)
  end.setMinutes(end.getMinutes() + duree)
  return { start, end }
}

/** Écart en JOURS CIVILS de `a` à `b` — indifférent à l'heure et au changement d'heure. */
export function calEcartJours(a: Date, b: Date): number {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate())
  return Math.round((ub - ua) / 86400000)
}

/**
 * Décale un événement de `jours` jours civils, heure et durée intactes (vue Mois).
 * `setDate` plutôt que 24 h en millisecondes : un samedi 10:00 glissé par-dessus
 * le passage à l'heure d'hiver arrive le lundi à 10:00, pas à 09:00.
 */
export function calDecalerDeJours(e: { start: Date; end: Date }, jours: number): { start: Date; end: Date } {
  const start = new Date(e.start)
  start.setDate(start.getDate() + jours)
  const end = new Date(e.end)
  end.setDate(end.getDate() + jours)
  return { start, end }
}

/**
 * L'index de la colonne sous le pointeur, borné aux colonnes affichées : lâcher un
 * bloc dans la gouttière des heures le pose sur le premier jour, pas nulle part.
 * `-1` s'il n'y a aucune colonne.
 */
export function calColonneSous(x: number, colonnes: readonly { left: number; right: number }[]): number {
  if (!colonnes.length) return -1
  for (let i = 0; i < colonnes.length; i++) if (x < colonnes[i].right) return i
  return colonnes.length - 1
}
