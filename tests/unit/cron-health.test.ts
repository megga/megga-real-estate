import { describe, it, expect } from 'vitest'
import { cronStale } from '@/lib/cronHealth'

const NOW = Date.parse('2026-06-04T12:00:00Z')

describe('cronStale', () => {
  it('flague un échec quel que soit le timing', () => {
    expect(cronStale('40 4 * * *', '2026-06-04T11:59:00Z', 'failed', NOW).stale).toBe(true)
  })
  it('flague un job jamais exécuté', () => {
    expect(cronStale('40 4 * * *', null, null, NOW)).toEqual({ stale: true, reason: 'never' })
  })
  it('quotidien : OK si <26h, en retard si >26h', () => {
    expect(cronStale('40 4 * * *', '2026-06-04T05:00:00Z', 'succeeded', NOW).stale).toBe(false)
    expect(cronStale('40 4 * * *', '2026-06-03T05:00:00Z', 'succeeded', NOW)).toEqual({ stale: true, reason: 'overdue' })
  })
  it('chaque minute : OK si <15min, en retard sinon', () => {
    expect(cronStale('* * * * *', '2026-06-04T11:58:00Z', 'succeeded', NOW).stale).toBe(false)
    expect(cronStale('* * * * *', '2026-06-04T11:30:00Z', 'succeeded', NOW).stale).toBe(true)
  })
  it('horaire : OK si <2h, en retard sinon', () => {
    expect(cronStale('15 * * * *', '2026-06-04T11:15:00Z', 'succeeded', NOW).stale).toBe(false)
    expect(cronStale('15 * * * *', '2026-06-04T09:00:00Z', 'succeeded', NOW).stale).toBe(true)
  })
})
