// supabase/functions/_shared/booking-slots.ts
// Calcul des créneaux proposés au client pour son RDV de vérification KYC.
//
// Fonctions PURES, sans aucune I/O. C'est délibéré : tout ce qui est délicat ici
// est arithmétique de fuseau, et ça doit pouvoir s'éprouver sans réseau ni base.
// Deux fois l'an, en Europe/Zurich, la même heure murale ne tombe pas au même
// instant UTC — un calcul de créneaux qui l'ignore décale toute une journée de
// rendez-vous.
//
// ⚠ RÈGLE PARTAGÉE AVEC LE SQL. La disponibilité appliquée ici doit être la même
// que celle de `kyc_slot_rejection` (migration 20260802200000) : un créneau n'est
// offert que si AUCUNE plage occupée ne recouvre [début − battement, fin + battement).
// Si les deux divergent, on propose au client des créneaux que la réservation
// refusera ensuite — le pire des deux mondes.

/** Réglages de réservation d'un agent (sous-ensemble utile au calcul). */
export interface BookingSettings {
  is_open: boolean
  timezone: string
  slot_minutes: number
  buffer_minutes: number
  min_notice_hours: number
  max_advance_days: number
  /** { "1".."7" (ISO, 1 = lundi) : [[HH:MM, HH:MM], …] }, en heure locale. */
  weekly_hours: Record<string, [string, string][]>
}

/** Plage occupée, en millisecondes epoch. */
export interface BusyRange {
  start: number
  end: number
}

/** Créneau proposable, en ISO 8601 UTC. */
export interface Slot {
  start: string
  end: string
}

/**
 * Décalage du fuseau `timeZone` à l'instant `utcMs`, en millisecondes.
 *
 * Passe par Intl plutôt que par une table de fuseaux : Deno embarque déjà l'ICU,
 * et une dépendance de plus dans une edge function se paie au démarrage à froid.
 */
export function tzOffsetMs(utcMs: number, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
  const parts = dtf.formatToParts(new Date(utcMs))
  const get = (type: string): number => Number(parts.find(p => p.type === type)?.value ?? 0)
  // `hour` peut valoir 24 en hour12:false sur certains runtimes → ramené à 0.
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'))
  return asUtc - utcMs
}

/**
 * Convertit une heure murale locale en instant UTC (ms).
 *
 * Deux passes : le décalage dépend de l'instant, et l'instant dépend du décalage.
 * La première estimation suffit partout sauf près d'une bascule DST, où la seconde
 * passe corrige. Sur une heure locale INEXISTANTE (le saut de printemps, 02:30 le
 * jour où l'on passe de 02:00 à 03:00), le résultat retombe sur le décalage
 * d'après-bascule — c'est-à-dire l'instant réel le plus proche, ce qui est le
 * comportement voulu : le créneau sera de toute façon écarté par la grille horaire.
 */
export function zonedTimeToUtc(
  year: number, month: number, day: number,
  hours: number, minutes: number,
  timeZone: string,
): number {
  const guess = Date.UTC(year, month - 1, day, hours, minutes)
  const firstPass = guess - tzOffsetMs(guess, timeZone)
  const secondOffset = tzOffsetMs(firstPass, timeZone)
  return guess - secondOffset
}

/** Date civile locale (et jour ISO 1..7) correspondant à un instant UTC. */
export function localDateParts(utcMs: number, timeZone: string): {
  year: number; month: number; day: number; isoDow: number
} {
  const shifted = new Date(utcMs + tzOffsetMs(utcMs, timeZone))
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    isoDow: ((shifted.getUTCDay() + 6) % 7) + 1, // getUTCDay : 0 = dimanche → 1 = lundi
  }
}

/** "09:30" → [9, 30]. Renvoie null si la forme n'est pas exploitable. */
function parseHhMm(value: string): [number, number] | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return [h, min]
}

function overlapsBusy(start: number, end: number, busy: readonly BusyRange[]): boolean {
  for (const b of busy) {
    if (b.start < end && start < b.end) return true // bornes semi-ouvertes, comme tstzrange '[)'
  }
  return false
}

export interface ComputeSlotsInput {
  settings: BookingSettings
  /** Occupations agrégées : base (RDV, visites, absences) + agendas externes. */
  busy: readonly BusyRange[]
  /** Instant de référence, injecté pour rendre le calcul déterministe en test. */
  nowMs: number
  /** Bornage éventuel de la fenêtre, plafonné par settings.max_advance_days. */
  horizonDays?: number
}

/**
 * Créneaux proposables sur la fenêtre, du plus proche au plus lointain.
 *
 * Renvoie une liste vide si l'agent n'a pas ouvert l'auto-réservation — c'est un
 * opt-in, et l'absence de réglages ne doit jamais se traduire par « toujours
 * disponible ».
 */
export function computeSlots({ settings, busy, nowMs, horizonDays }: ComputeSlotsInput): Slot[] {
  if (!settings.is_open) return []

  const tz = settings.timezone || 'Europe/Zurich'
  const slotMs = settings.slot_minutes * 60_000
  const bufferMs = settings.buffer_minutes * 60_000
  if (slotMs <= 0) return []

  const earliest = nowMs + settings.min_notice_hours * 3_600_000
  // Deux bornes DISTINCTES, à ne pas confondre :
  //   dayCount = combien de journées locales on parcourt (cadrage de la requête) ;
  //   latest   = jusqu'où la RÈGLE MÉTIER autorise à réserver.
  // Les fusionner faisait qu'un `horizonDays: 0` — « juste aujourd'hui » — plafonnait
  // `latest` à l'instant présent et ne rendait plus aucun créneau.
  // `latest` reprend exactement la borne de kyc_slot_rejection (`too_far`).
  const dayCount = Math.min(horizonDays ?? settings.max_advance_days, settings.max_advance_days)
  const latest = nowMs + settings.max_advance_days * 86_400_000

  // Curseur de DATE PURE en UTC : incrémenter une date civile de 24 h est exact
  // tant qu'on ne manipule pas d'heure. Itérer sur des instants réels, en
  // revanche, saute ou répète un jour aux bascules DST (23 h / 25 h).
  const first = localDateParts(nowMs, tz)
  const cursor = Date.UTC(first.year, first.month - 1, first.day)

  const slots: Slot[] = []
  for (let i = 0; i <= dayCount; i++) {
    const d = new Date(cursor + i * 86_400_000)
    const year = d.getUTCFullYear()
    const month = d.getUTCMonth() + 1
    const day = d.getUTCDate()
    const isoDow = ((d.getUTCDay() + 6) % 7) + 1

    for (const window of settings.weekly_hours?.[String(isoDow)] ?? []) {
      const from = parseHhMm(window?.[0] ?? '')
      const to = parseHhMm(window?.[1] ?? '')
      if (!from || !to) continue // grille malformée : on ignore la plage plutôt que d'inventer

      const windowStart = zonedTimeToUtc(year, month, day, from[0], from[1], tz)
      const windowEnd = zonedTimeToUtc(year, month, day, to[0], to[1], tz)

      for (let start = windowStart; start + slotMs <= windowEnd; start += slotMs) {
        if (start < earliest || start > latest) continue
        if (overlapsBusy(start - bufferMs, start + slotMs + bufferMs, busy)) continue
        slots.push({
          start: new Date(start).toISOString(),
          end: new Date(start + slotMs).toISOString(),
        })
      }
    }
  }

  slots.sort((a, b) => a.start.localeCompare(b.start))
  return slots
}
