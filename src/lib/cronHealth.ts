export type CronHealthRow = {
  jobname: string
  schedule: string
  active: boolean
  last_start: string | null
  last_status: string | null
}

export type CronStale = { stale: boolean; reason?: 'failed' | 'never' | 'overdue' }

/** Seuil de retard (ms) déduit de la cadence cron. Heuristique simple, suffisante pour un témoin. */
function thresholdMs(schedule: string): number {
  const s = (schedule ?? '').trim()
  if (s === '* * * * *') return 15 * 60_000                 // chaque minute → 15 min
  if (/^\S+ \* \* \* \*$/.test(s)) return 2 * 60 * 60_000   // horaire (min fixe, heure *) → 2 h
  return 26 * 60 * 60_000                                    // quotidien / autre → 26 h
}

/** Détermine si un job cron est « en retard »/en échec. `now` injectable pour les tests. */
export function cronStale(
  schedule: string, lastStart: string | null, lastStatus: string | null, now: number = Date.now(),
): CronStale {
  if (lastStatus === 'failed') return { stale: true, reason: 'failed' }
  if (!lastStart) return { stale: true, reason: 'never' }
  const age = now - Date.parse(lastStart)
  if (age > thresholdMs(schedule)) return { stale: true, reason: 'overdue' }
  return { stale: false }
}
