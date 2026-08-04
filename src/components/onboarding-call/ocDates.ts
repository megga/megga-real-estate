/**
 * Helpers de date du sélecteur de créneau.
 *
 * Séparés d'`OcSlotPicker.tsx` pour satisfaire `react-refresh/only-export-components` :
 * un fichier qui exporte un composant ET une fonction casse le rafraîchissement à
 * chaud. Même découpe que `adminKit.tsx` / `adminKitCore.ts`.
 *
 * Aucune couleur, aucune classe : ces quatre fonctions ont survécu telles quelles au
 * passage de l'habillage Sugar à MEGGA X (4 août 2026), qui n'a touché qu'au rendu.
 * `bookedWhenLabel` les a rejointes le même jour, pour la même raison qu'elles sont
 * ici : elle était née dans OcBookedCard.tsx, à côté du composant, et la règle ne
 * pardonne pas — c'est ELLE qui doit déménager, pas la règle qu'on désactive.
 */

/**
 * Clé de journée civile (`YYYY-MM-DD`) d'un instant, dans le fuseau donné.
 *
 * `en-CA` rend nativement l'ordre année-mois-jour avec des zéros de tête, ce qui évite
 * de recomposer la chaîne depuis `formatToParts`.
 */
export function dayKeyOf(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso))
}

/** Heure murale `HH:MM` d'un instant, dans le fuseau donné. */
export function hourLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

/**
 * Grille du mois, alignée sur une semaine qui commence le lundi. Les cases de tête
 * sont `null` (jours du mois précédent, non rendus).
 */
export function monthGrid(month: Date): (string | null)[] {
  const year = month.getFullYear()
  const m = month.getMonth()
  const daysInMonth = new Date(year, m + 1, 0).getDate()
  // getDay() rend 0 pour dimanche : on ramène à une semaine ISO commençant lundi.
  const lead = (new Date(year, m, 1).getDay() + 6) % 7

  const cells: (string | null)[] = Array.from({ length: lead }, () => null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${year}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  return cells
}

/** Clé `YYYY-MM` du mois, utilisée pour des clés de rendu stables. */
export function monthKey(month: Date): string {
  return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Date longue d'un rendez-vous confirmé, dans le fuseau du visiteur :
 * « lundi 11 août, 09:00 ».
 *
 * Un instant complet (`timestamptz`), donc `new Date()` puis `format` est ici CORRECT —
 * à la différence des dates-seules du wizard (date de naissance, péremption d'une pièce),
 * qui n'ont pas d'instant et que le fuseau décale d'un jour. Le `timeZone` explicite est
 * ce qui garantit qu'un agent en déplacement lit l'heure à laquelle il doit être là.
 *
 * Rendue en minuscule par `Intl` : c'est à l'appelant de capitaliser (classe
 * `capitalize`), la vitrine capitalisant ses intitulés sans jamais les mettre en
 * majuscules (règle §3 du CLAUDE.md).
 */
export function bookedWhenLabel(iso: string, timezone: string): string {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: timezone,
    weekday: 'long', day: 'numeric', month: 'long',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}
