// supabase/functions/_shared/onboarding-availability.ts
//
// Assemble ce dont le moteur de créneaux a besoin : le pool d'hôtes, leurs exceptions,
// les appels déjà pris, et les occupations de leurs agendas externes.
//
// Partagé par `onboarding-slots` (afficher) et `onboarding-call-book` (écrire), pour
// que les deux voient exactement la même disponibilité. Un affichage et une écriture
// qui calculent différemment produisent des refus incompréhensibles pour le client.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  computeHostSlots,
  parseWeeklyHours,
  type HostSchedule,
  type HostSlot,
} from './onboarding-slots.ts'
import { readHostBusy } from './host-freebusy.ts'

const DAY_MS = 24 * 60 * 60 * 1000

export interface HostRow {
  id: string
  /** Nul pour un hôte Workspace : sa seule identité est son agenda. */
  profile_id: string | null
  /** Boîte Google Workspace de MEGGA, quand l'agenda est celui de la plateforme. */
  calendar_email: string | null
  display_name: string
  timezone: string
  weekly_hours: unknown
  slot_minutes: number
  duration_minutes: number
  buffer_after_minutes: number
  min_notice_hours: number
  horizon_days: number
  max_per_day: number | null
}

export interface AvailabilitySnapshot {
  slots: HostSlot[]
  hostsById: Map<string, HostRow>
  /** Rendez-vous à venir par hôte, pour l'attribution tournante. */
  loadByHost: Record<string, number>
  /** Hôtes écartés parce que leur agenda est branché mais illisible. */
  degradedHostIds: string[]
  /** Vrai quand il n'existe aucun hôte actif : ce n'est pas la même chose qu'un agenda plein. */
  poolEmpty: boolean
}

/**
 * Charge tout et calcule. `windowFromMs`/`windowToMs` bornent la demande du client ;
 * le préavis et l'horizon de chaque hôte les resserrent ensuite.
 *
 * Un hôte dont l'agenda répond mal est ÉCARTÉ, pas traité comme libre : proposer un
 * créneau déjà pris coûte plus cher à l'hôte qu'une journée qui paraît complète.
 */
export async function loadAvailability(
  db: SupabaseClient,
  windowFromMs: number,
  windowToMs: number,
  nowMs: number,
): Promise<AvailabilitySnapshot> {
  const { data: hostRows } = await db
    .from('onboarding_hosts')
    .select('id, profile_id, calendar_email, display_name, timezone, weekly_hours, slot_minutes, duration_minutes, buffer_after_minutes, min_notice_hours, horizon_days, max_per_day')
    .eq('is_active', true)

  const hosts = (hostRows ?? []) as HostRow[]
  const hostsById = new Map(hosts.map((h) => [h.id, h]))
  if (hosts.length === 0) {
    return { slots: [], hostsById, loadByHost: {}, degradedHostIds: [], poolEmpty: true }
  }

  const hostIds = hosts.map((h) => h.id)

  // La fenêtre de lecture est élargie d'un jour de chaque côté : une occupation qui
  // commence la veille au soir peut empiéter sur le premier créneau du matin.
  const readFrom = new Date(windowFromMs - DAY_MS).toISOString()
  const readTo = new Date(windowToMs + DAY_MS).toISOString()

  const [{ data: exceptionRows }, { data: callRows }] = await Promise.all([
    db.from('onboarding_host_exceptions')
      .select('host_id, day, is_closed, slices')
      .in('host_id', hostIds),
    db.from('onboarding_calls')
      .select('host_id, scheduled_at, duration_minutes')
      .eq('status', 'confirmed')
      .in('host_id', hostIds)
      .gte('scheduled_at', readFrom)
      .lte('scheduled_at', readTo),
  ])

  // Charge à venir, tous horizons confondus : c'est elle qui pilote l'attribution
  // tournante, pas seulement la fenêtre affichée.
  const { data: loadRows } = await db
    .from('onboarding_calls')
    .select('host_id')
    .eq('status', 'confirmed')
    .in('host_id', hostIds)
    .gte('scheduled_at', new Date(nowMs).toISOString())

  const loadByHost: Record<string, number> = {}
  for (const row of loadRows ?? []) {
    loadByHost[row.host_id] = (loadByHost[row.host_id] ?? 0) + 1
  }

  const busyFromCalls = new Map<string, { startMs: number; endMs: number }[]>()
  const bookedStarts = new Map<string, number[]>()
  for (const row of callRows ?? []) {
    const startMs = Date.parse(row.scheduled_at)
    if (!Number.isFinite(startMs)) continue
    const endMs = startMs + (row.duration_minutes ?? 30) * 60_000
    const list = busyFromCalls.get(row.host_id) ?? []
    list.push({ startMs, endMs })
    busyFromCalls.set(row.host_id, list)
    const starts = bookedStarts.get(row.host_id) ?? []
    starts.push(startMs)
    bookedStarts.set(row.host_id, starts)
  }

  const exceptionsByHost = new Map<string, { day: string; isClosed: boolean; slices: never[] }[]>()
  for (const row of exceptionRows ?? []) {
    const list = exceptionsByHost.get(row.host_id) ?? []
    list.push({
      day: row.day as string,
      isClosed: row.is_closed !== false,
      slices: (Array.isArray(row.slices) ? parseWeeklyHours(row.slices) : []) as never[],
    })
    exceptionsByHost.set(row.host_id, list)
  }

  const externalBusy = await Promise.all(
    hosts.map(async (h) => ({
      hostId: h.id,
      result: await readHostBusy(
        db,
        { profileId: h.profile_id, calendarEmail: h.calendar_email },
        h.timezone,
        windowFromMs - DAY_MS,
        windowToMs + DAY_MS,
      ),
    })),
  )

  const degradedHostIds = externalBusy.filter((e) => e.result.degraded).map((e) => e.hostId)
  const degraded = new Set(degradedHostIds)
  const externalByHost = new Map(externalBusy.map((e) => [e.hostId, e.result.busy]))

  const schedules: HostSchedule[] = hosts
    .filter((h) => !degraded.has(h.id))
    .map((h) => ({
      hostId: h.id,
      timezone: h.timezone,
      weeklyHours: parseWeeklyHours(h.weekly_hours),
      exceptions: exceptionsByHost.get(h.id) ?? [],
      busy: [...(busyFromCalls.get(h.id) ?? []), ...(externalByHost.get(h.id) ?? [])],
      bookedStartsMs: bookedStarts.get(h.id) ?? [],
      slotMinutes: h.slot_minutes,
      durationMinutes: h.duration_minutes,
      bufferAfterMinutes: h.buffer_after_minutes,
      minNoticeHours: h.min_notice_hours,
      horizonDays: h.horizon_days,
      maxPerDay: h.max_per_day,
    }))

  const slots = computeHostSlots({
    hosts: schedules,
    fromMs: windowFromMs,
    toMs: windowToMs,
    nowMs,
  })

  return { slots, hostsById, loadByHost, degradedHostIds, poolEmpty: false }
}
