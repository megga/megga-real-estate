// MEGGA — Computeur de créneaux libres pour la planification de visites (Tier 2).
// Croise les events de plusieurs sources (visites MEGGA, Google, Outlook) et
// renvoie une liste de slots libres triée par préférence agent.

export interface BusyWindow {
  start: Date
  end: Date
}

export interface FreeSlot {
  /** Début du slot — déjà ancré sur l'heure pile (HH:00 ou HH:30) */
  start: Date
  /** Fin du slot = start + durationMinutes */
  end: Date
  /** Score 0-100 — créneaux du matin et tôt après-midi favorisés */
  score: number
}

interface ComputeOptions {
  /** Fenêtre d'analyse — typiquement les 7 prochains jours */
  from: Date
  to: Date
  /** Durée souhaitée de la visite, en minutes */
  durationMinutes: number
  /** Pas entre 2 candidats successifs (30 min par défaut) */
  stepMinutes?: number
  /** Heure de début de journée de travail (incluse) — 9 = 09:00 */
  workdayStartHour?: number
  /** Heure de fin de journée de travail (exclue) — 18 = 18:00 */
  workdayEndHour?: number
  /** Pas de visite le dimanche par défaut (samedi OK) */
  skipSundays?: boolean
  /** Limite max de résultats retournés (triés par score puis date) */
  maxResults?: number
}

/**
 * Renvoie les meilleurs créneaux libres dans la fenêtre demandée.
 *
 * Algorithme :
 *  1. Itère sur chaque jour entre from et to (saute dimanches si configuré)
 *  2. Pour chaque pas (toutes les 30 min de workdayStartHour à workdayEndHour),
 *     candidate = [start, start + duration]
 *  3. Si candidate n'overlap aucune BusyWindow, c'est un slot libre
 *  4. Score : créneaux 10h-15h favorisés (sweet spot visite immobilière)
 *  5. Tri par score desc, puis date asc, top N
 */
export function computeFreeSlots(
  busy: BusyWindow[],
  options: ComputeOptions,
): FreeSlot[] {
  const {
    from,
    to,
    durationMinutes,
    stepMinutes = 30,
    workdayStartHour = 9,
    workdayEndHour = 18,
    skipSundays = true,
    maxResults = 5,
  } = options

  const result: FreeSlot[] = []
  const now = new Date()

  // Tri pour binary lookup éventuel (mais l'algo naïf O(N*M) tient ici)
  const sortedBusy = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime())

  function isBusy(slotStart: Date, slotEnd: Date): boolean {
    for (const b of sortedBusy) {
      if (b.end <= slotStart) continue
      if (b.start >= slotEnd) break
      return true
    }
    return false
  }

  function slotScore(d: Date): number {
    const h = d.getHours()
    // Sweet spot 10h-15h = 100. Décroît en s'éloignant. Min 40.
    const distFromIdeal = Math.abs(h - 12.5)
    const base = Math.max(40, 100 - distFromIdeal * 10)
    // Léger bonus pour les créneaux à l'heure pile vs demi-heure (UX cleaner)
    return d.getMinutes() === 0 ? base + 2 : base
  }

  const day = new Date(from)
  day.setHours(0, 0, 0, 0)
  while (day <= to) {
    const dow = day.getDay()
    if (!(skipSundays && dow === 0)) {
      // Itère sur chaque pas dans la journée de travail
      for (let h = workdayStartHour; h < workdayEndHour; ) {
        for (let m = 0; m < 60; m += stepMinutes) {
          const start = new Date(day)
          start.setHours(h, m, 0, 0)
          const end = new Date(start.getTime() + durationMinutes * 60_000)
          // Skip si déjà passé OU si la fin dépasse l'horaire de travail
          if (start <= now) continue
          if (end.getHours() > workdayEndHour ||
              (end.getHours() === workdayEndHour && end.getMinutes() > 0)) continue
          if (!isBusy(start, end)) {
            result.push({ start, end, score: slotScore(start) })
          }
        }
        h += 1 // on incrémente d'1h après avoir parcouru les minutes
      }
    }
    day.setDate(day.getDate() + 1)
  }

  // Tri par score desc, puis date asc en cas d'égalité (préfère le plus proche)
  return result
    .sort((a, b) => b.score - a.score || a.start.getTime() - b.start.getTime())
    .slice(0, maxResults)
}

/**
 * Formate un slot pour l'UI : "Mer. 21 mai · 14:30"
 */
export function formatSlotLabel(slot: FreeSlot): string {
  const days = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.']
  const months = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
  const d = slot.start
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / 86_400_000)
  let dayLabel: string
  if (diff === 0) dayLabel = "Aujourd'hui"
  else if (diff === 1) dayLabel = 'Demain'
  else if (diff < 7) dayLabel = days[d.getDay()]
  else dayLabel = `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${dayLabel} · ${time}`
}
