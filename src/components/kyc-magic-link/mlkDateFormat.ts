// MEGGA — Formatage des dates du parcours client (fuseau de l'agent).
//
// Séparé des composants pour la même raison que mlkTokens.ts : un fichier qui
// exporte des composants ET des fonctions casse le Fast Refresh de Vite
// (react-refresh/only-export-components), toute édition rechargeant la page au
// lieu de préserver l'état.
//
// FUSEAU. Les instants arrivent en UTC, accompagnés du fuseau de l'AGENT. Tout
// est rendu dans ce fuseau via TZDate : un client qui ouvre son lien en voyage
// doit lire l'heure telle qu'elle sera vécue sur place, pas celle de son
// téléphone. C'est aussi ce qui garde une liste juste lorsqu'elle chevauche une
// bascule DST — deux jours consécutifs n'y ont pas le même décalage UTC.

import { TZDate } from '@date-fns/tz'
import { format } from 'date-fns'
import { dfLocale } from '@/lib/utils'

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

export interface ZonedLabels {
  /** Clé de regroupement par journée locale (yyyy-MM-dd). */
  dayKey: string
  /** « Lundi 1 septembre », capitalisé — date-fns rend les jours en minuscules. */
  dayLabel: string
  time: string
  full: string
}

/** Libellés jour / heure d'un instant ISO, dans le fuseau donné. */
export function inZone(iso: string, timeZone: string): ZonedLabels {
  const d = new TZDate(Date.parse(iso), timeZone)
  const dayLabel = cap(format(d, 'EEEE d MMMM', { locale: dfLocale() }))
  const time = format(d, 'HH:mm')
  return { dayKey: format(d, 'yyyy-MM-dd'), dayLabel, time, full: `${dayLabel} · ${time}` }
}
