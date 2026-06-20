// MEGGA CRM Sugar v2 — Calendar helpers (formatters + briefing + shading)
// 1:1 port from `crm-calendar-sugar-shell.jsx` and `crm-calendar-sugar-panels.jsx`.

import type { CalEvent } from './data'
// i18n : noms de jours/mois via clés-tableaux (returnObjects), lus sur l'instance
// i18n singleton (rendus dans des composants re-rendus au changement de langue).
// Cf docs/i18n-conventions §6. Les anciens CAL_DAYS/CAL_MONTHS (const) deviennent
// des fonctions calDays()/calDaysFull()/calMonths().
import i18n from '@/i18n'

export const calDays = (): string[] => i18n.t('calendar:days', { returnObjects: true }) as string[]
export const calDaysFull = (): string[] => i18n.t('calendar:daysFull', { returnObjects: true }) as string[]
export const calMonths = (): string[] => i18n.t('calendar:months', { returnObjects: true }) as string[]

export function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function fmtDate(d: Date): string {
  const month = calMonths()[d.getMonth()] ?? ''
  // En FR le mois est en minuscules dans cette forme ; on garde la casse en EN.
  const mShown = (i18n.language || 'fr').startsWith('fr') ? month.toLowerCase() : month
  return `${calDaysFull()[d.getDay()]} ${d.getDate()} ${mShown}`
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function shadeMix(hex: string, amt: number): string {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  const adj = (v: number) => Math.max(0, Math.min(255, Math.round(v + 255 * amt)))
  return `rgb(${adj(r)}, ${adj(g)}, ${adj(b)})`
}

export function generateBrief(event: CalEvent): string {
  if (event.type === 'visite' && (event.contact?.warm ?? 0) >= 85) {
    return `Acheteur chaud (${event.contact!.warm}%). ${event.contact!.name} a déjà fait au moins une visite — préparez les arguments décisionnels (financement, délais, comparables). Probabilité d'offre cette semaine : élevée.`
  }
  if (event.type === 'visite') {
    return 'Première visite. Préparez la fiche complète + 2 comparables récents. Tournez la visite sur les points forts du bien et observez les questions sur le quartier.'
  }
  if (event.type === 'mandate') {
    return 'RDV vendeur — préparez la grille comparables + argumentaire mandat exclusif. Apportez tablette pour signature numérique. Estimez 90 min sur place.'
  }
  if (event.type === 'notary') {
    return "Acte chez notaire — vérifiez 24h avant : pièces d'identité, IBAN, dossier complet. Confirmez présence des deux parties la veille."
  }
  if (event.type === 'task') {
    return 'Tâche interne. Bloquez 15-20 min de focus sans interruption.'
  }
  if (event.type === 'publish') {
    return 'Publication automatique programmée. Vérifiez la veille : 8+ photos, description complète, prix validé.'
  }
  return 'Pas de brief disponible pour ce type d\'événement.'
}
