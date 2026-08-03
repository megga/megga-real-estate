// supabase/functions/_shared/onboarding-slots.ts
//
// Moteur de créneaux de l'appel d'accueil. Module PUR : aucun accès réseau, aucune
// base, aucune horloge implicite (`nowMs` est un paramètre). C'est ce qui le rend
// testable au Vitest alors qu'il tourne en Deno.
//
// Il applique, dans cet ordre, les retranchements décrits dans la conception :
//   horaires hebdomadaires -> exceptions datées -> préavis et horizon
//   -> occupations (agenda externe + appels déjà pris, tampon compris)
//   -> plafond journalier -> découpe au pas de créneau.
//
// POURQUOI L'HEURE MURALE ET PAS UN DÉCALAGE. Les plages d'un hôte sont écrites en
// heure murale (« je reçois de 09:00 à 12:00 »). Les convertir avec un décalage fixe
// décale toutes ses journées d'une heure les 29 mars et 25 octobre. On passe donc par
// `Intl.DateTimeFormat`, seule source qui connaisse les règles de chaque fuseau, et on
// vérifie le résultat par aller-retour : une heure murale qui n'existe pas ce jour-là
// (le trou du passage à l'heure d'été) ne produit aucun créneau plutôt qu'un créneau faux.

/** Plage hebdomadaire, en heure murale du fuseau de l'hôte. `dow` ISO : 1 = lundi, 7 = dimanche. */
export interface WeeklySlice {
  dow: number
  start: string
  end: string
}

/** Exception datée. `day` au format `YYYY-MM-DD` dans le fuseau de l'hôte. */
export interface DateException {
  day: string
  isClosed: boolean
  slices?: WeeklySlice[]
}

/** Occupation, en instants absolus. */
export interface BusyInterval {
  startMs: number
  endMs: number
}

export interface HostSchedule {
  hostId: string
  timezone: string
  weeklyHours: WeeklySlice[]
  exceptions: DateException[]
  /** Agenda externe + appels déjà pris. Ce qui bloque réellement le créneau. */
  busy: BusyInterval[]
  /** Débuts des appels déjà pris, pour le seul comptage du plafond journalier. */
  bookedStartsMs: number[]
  slotMinutes: number
  durationMinutes: number
  bufferAfterMinutes: number
  minNoticeHours: number
  horizonDays: number
  maxPerDay: number | null
}

export interface HostSlot {
  hostId: string
  startMs: number
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/** Nombre maximal de replanifications d'un même rendez-vous. Doit rester aligné sur
 *  `can_reschedule` dans la migration `20260803214105_onboarding_calls.sql`. */
export const MAX_RESCHEDULES = 3

/**
 * Fenêtre à demander pour revérifier UN créneau précis, avant de l'écrire.
 *
 * ⚠ Elle ne peut pas se réduire à « le créneau, à une minute près ». `computeHostSlots`
 * n'expose un créneau que si le rendez-vous ENTIER tient dans la fenêtre demandée
 * (`end > latest` le rejette), tampon compris. Une fenêtre de deux minutes ne peut
 * donc jamais contenir un rendez-vous de trente : la revérification ne rendait rien et
 * TOUTE réservation échouait en « créneau déjà pris » — un refus qui accusait un autre
 * client alors que le créneau était libre. Mesuré de bout en bout le 03.08.2026.
 *
 * La borne haute couvre les plafonds de la table : durée ≤ 480 min et tampon ≤ 240 min
 * (contraintes `onboarding_hosts_duration_positive` / `_buffer_sane`), donc 12 h suffit
 * quelle que soit la configuration d'un hôte.
 */
export const SLOT_RECHECK_TAIL_MS = 12 * 60 * 60 * 1000

/** Bornes de revérification d'un créneau unique. */
export function recheckWindow(slotMs: number): { fromMs: number; toMs: number } {
  return { fromMs: slotMs - MINUTE_MS, toMs: slotMs + SLOT_RECHECK_TAIL_MS }
}

const HHMM_RE = /^([01][0-9]|2[0-3]):([0-5][0-9])$/

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

function zonedFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone)
  if (cached) return cached
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  formatterCache.set(timeZone, dtf)
  return dtf
}

/** Décompose un instant en date et heure murales du fuseau demandé. */
export function zonedParts(instantMs: number, timeZone: string): ZonedParts {
  const parts = zonedFormatter(timeZone).formatToParts(new Date(instantMs))
  const pick = (type: string): number => {
    const found = parts.find((p) => p.type === type)
    return found ? Number(found.value) : 0
  }
  // Certaines versions d'ICU rendent « 24 » pour minuit en hour12:false.
  const hour = pick('hour') % 24
  return {
    year: pick('year'),
    month: pick('month'),
    day: pick('day'),
    hour,
    minute: pick('minute'),
    second: pick('second'),
  }
}

/** Décalage du fuseau à cet instant précis, en millisecondes. */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const p = zonedParts(instantMs, timeZone)
  const asIfUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  // L'instant a été tronqué à la seconde par le formateur : on retire la même
  // fraction des deux côtés pour que le décalage reste un multiple de minute.
  return asIfUtc - (instantMs - (instantMs % 1000))
}

/** Clé de journée civile (`YYYY-MM-DD`) dans le fuseau demandé. */
export function zonedDayKey(instantMs: number, timeZone: string): string {
  const p = zonedParts(instantMs, timeZone)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
}

/**
 * Instant UTC correspondant à une heure murale d'un jour donné dans un fuseau.
 * Rend `null` quand cette heure murale n'existe pas ce jour-là (heure sautée au
 * passage à l'heure d'été) : mieux vaut aucun créneau qu'un créneau décalé.
 */
export function wallTimeToInstant(
  dayKey: string,
  hhmm: string,
  timeZone: string,
): number | null {
  const m = HHMM_RE.exec(hhmm)
  if (!m) return null
  const [y, mo, d] = dayKey.split('-').map(Number)
  if (!y || !mo || !d) return null
  const hour = Number(m[1])
  const minute = Number(m[2])

  const naive = Date.UTC(y, mo - 1, d, hour, minute, 0)
  // Première approximation avec le décalage tel qu'il est à l'instant naïf, puis une
  // correction : au bord d'un changement d'heure, les deux décalages diffèrent.
  let candidate = naive - zoneOffsetMs(naive, timeZone)
  candidate = naive - zoneOffsetMs(candidate, timeZone)

  const back = zonedParts(candidate, timeZone)
  if (back.hour !== hour || back.minute !== minute) return null
  const backKey = `${String(back.year).padStart(4, '0')}-${String(back.month).padStart(2, '0')}-${String(back.day).padStart(2, '0')}`
  if (backKey !== dayKey) return null

  return candidate
}

/** Jour de semaine ISO (1 = lundi … 7 = dimanche) d'une clé `YYYY-MM-DD`. */
export function isoDayOfWeek(dayKey: string): number {
  const [y, mo, d] = dayKey.split('-').map(Number)
  const dow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay()
  return dow === 0 ? 7 : dow
}

function addDays(dayKey: string, delta: number): string {
  const [y, mo, d] = dayKey.split('-').map(Number)
  const next = new Date(Date.UTC(y, mo - 1, d) + delta * DAY_MS)
  return `${String(next.getUTCFullYear()).padStart(4, '0')}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`
}

/** Plages applicables à une journée : l'exception datée l'emporte sur l'hebdomadaire. */
function slicesForDay(host: HostSchedule, dayKey: string): WeeklySlice[] {
  const exception = host.exceptions.find((e) => e.day === dayKey)
  if (exception) {
    if (exception.isClosed) return []
    return exception.slices ?? []
  }
  const dow = isoDayOfWeek(dayKey)
  return host.weeklyHours.filter((s) => s.dow === dow)
}

/**
 * Un candidat entre en conflit avec une occupation dès que l'écart entre les deux
 * descend sous le tampon. Le test est symétrique à dessein : le tampon protège aussi
 * bien la fin de l'occupation précédente que le début de la suivante.
 */
function collides(
  startMs: number,
  endMs: number,
  busy: BusyInterval[],
  bufferMs: number,
): boolean {
  for (const b of busy) {
    if (startMs < b.endMs + bufferMs && b.startMs < endMs + bufferMs) return true
  }
  return false
}

export interface SlotComputationInput {
  hosts: HostSchedule[]
  /** Fenêtre demandée par le client, bornée ensuite par préavis et horizon. */
  fromMs: number
  toMs: number
  nowMs: number
}

/**
 * Créneaux libres, hôte par hôte. L'appelant décide ensuite quoi en faire :
 * l'union pour l'affichage, un hôte précis pour l'écriture.
 */
export function computeHostSlots(input: SlotComputationInput): HostSlot[] {
  const { hosts, fromMs, toMs, nowMs } = input
  const out: HostSlot[] = []

  for (const host of hosts) {
    const durationMs = host.durationMinutes * MINUTE_MS
    const bufferMs = Math.max(0, host.bufferAfterMinutes) * MINUTE_MS
    const stepMs = Math.max(1, host.slotMinutes) * MINUTE_MS

    const earliest = Math.max(fromMs, nowMs + host.minNoticeHours * HOUR_MS)
    const latest = Math.min(toMs, nowMs + host.horizonDays * DAY_MS)
    if (!(earliest < latest)) continue

    // Le premier et le dernier jour civils sont pris avec une marge d'un jour de
    // chaque côté : une plage du soir en heure locale peut appartenir au jour civil
    // précédent une fois ramenée en UTC.
    let dayKey = zonedDayKey(earliest - DAY_MS, host.timezone)
    const lastDayKey = zonedDayKey(latest + DAY_MS, host.timezone)

    // Comptage du plafond, par journée civile de l'hôte.
    const bookedPerDay = new Map<string, number>()
    if (host.maxPerDay != null) {
      for (const startMs of host.bookedStartsMs) {
        const key = zonedDayKey(startMs, host.timezone)
        bookedPerDay.set(key, (bookedPerDay.get(key) ?? 0) + 1)
      }
    }

    // Garde-fou de boucle : une clé de jour qui n'avance pas bloquerait la fonction.
    for (let guard = 0; guard < 400; guard++) {
      if (host.maxPerDay != null && (bookedPerDay.get(dayKey) ?? 0) >= host.maxPerDay) {
        if (dayKey === lastDayKey) break
        dayKey = addDays(dayKey, 1)
        continue
      }

      for (const slice of slicesForDay(host, dayKey)) {
        const sliceStart = wallTimeToInstant(dayKey, slice.start, host.timezone)
        const sliceEnd = wallTimeToInstant(dayKey, slice.end, host.timezone)
        if (sliceStart == null || sliceEnd == null || sliceEnd <= sliceStart) continue

        for (let start = sliceStart; start + durationMs <= sliceEnd; start += stepMs) {
          const end = start + durationMs
          if (start < earliest || end > latest) continue
          if (collides(start, end, host.busy, bufferMs)) continue
          out.push({ hostId: host.hostId, startMs: start })
        }
      }

      if (dayKey === lastDayKey) break
      dayKey = addDays(dayKey, 1)
    }
  }

  out.sort((a, b) => a.startMs - b.startMs || a.hostId.localeCompare(b.hostId))
  return out
}

/**
 * Instants proposables à l'écran : l'union des hôtes, dédupliquée et triée. Le client
 * ne doit jamais savoir quel hôte prendra le rendez-vous, ni pouvoir le choisir.
 */
export function unionSlotStarts(slots: HostSlot[]): number[] {
  const seen = new Set<number>()
  for (const s of slots) seen.add(s.startMs)
  return [...seen].sort((a, b) => a - b)
}

/**
 * Attribution tournante : parmi les hôtes libres à cet instant, celui qui porte le
 * moins de rendez-vous à venir. Départage par identifiant, pour que deux exécutions
 * sur le même état donnent le même résultat (sans quoi le test devient instable).
 */
export function pickHostForSlot(
  slots: HostSlot[],
  startMs: number,
  loadByHost: Record<string, number>,
): string | null {
  const eligible = slots.filter((s) => s.startMs === startMs).map((s) => s.hostId)
  if (eligible.length === 0) return null

  let best = eligible[0]
  for (const hostId of eligible) {
    const load = loadByHost[hostId] ?? 0
    const bestLoad = loadByHost[best] ?? 0
    if (load < bestLoad || (load === bestLoad && hostId < best)) best = hostId
  }
  return best
}

/** Normalise les plages lues en base : rejette silencieusement ce qui est mal formé. */
export function parseWeeklyHours(raw: unknown): WeeklySlice[] {
  if (!Array.isArray(raw)) return []
  const out: WeeklySlice[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const slice = item as Record<string, unknown>
    const dow = Number(slice.dow)
    const start = String(slice.start ?? '')
    const end = String(slice.end ?? '')
    if (!Number.isInteger(dow) || dow < 1 || dow > 7) continue
    if (!HHMM_RE.test(start) || !HHMM_RE.test(end) || start >= end) continue
    out.push({ dow, start, end })
  }
  return out
}
