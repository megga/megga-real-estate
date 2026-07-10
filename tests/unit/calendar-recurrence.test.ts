import { describe, it, expect } from 'vitest'
import { calExpandEvents, calConflicts, type CalEvent } from '@/components/crm-sugar/calendar/data'

// Régression des correctifs de revue adverse (juil. 2026) :
//  - récurrence mensuelle ancrée au jour du mois (pas de dérive via setMonth)
//  - fast-forward vers la fenêtre (série démarrée loin dans le passé)
//  - calConflicts : chevauchement strict, externes inclus, annulés/journée exclus

function ev(partial: Partial<CalEvent>): CalEvent {
  return {
    id: 'e1', type: 'visite', title: 'T',
    start: new Date('2026-01-31T10:00:00'), end: new Date('2026-01-31T11:00:00'),
    ...partial,
  }
}
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

describe('calExpandEvents — récurrence mensuelle', () => {
  it('ancre le jour du mois et clampe à la longueur du mois (31 janv. → 28/31/30…)', () => {
    const e = ev({ recurrence: { freq: 'monthly' } })
    const out = calExpandEvents([e], new Date('2026-01-01T00:00:00'), new Date('2026-05-31T23:59:59'))
    expect(out.map(o => ymd(o.start))).toEqual([
      '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31',
    ])
    // conserve l'heure d'origine + durée
    expect(out[1].start.getHours()).toBe(10)
    expect(out[1].end.getTime() - out[1].start.getTime()).toBe(60 * 60 * 1000)
    // ids d'occurrence distincts, rattachés au maître
    expect(out[0].masterId).toBe('e1')
    expect(out[0].isOccurrence).toBe(true)
    expect(new Set(out.map(o => o.id)).size).toBe(out.length)
  })

  it('année bissextile : 31 janv. → 29 févr. 2028', () => {
    const e = ev({ start: new Date('2028-01-31T09:00:00'), end: new Date('2028-01-31T10:00:00'), recurrence: { freq: 'monthly' } })
    const out = calExpandEvents([e], new Date('2028-02-01T00:00:00'), new Date('2028-02-29T23:59:59'))
    expect(out.map(o => ymd(o.start))).toEqual(['2028-02-29'])
  })
})

describe('calExpandEvents — fast-forward', () => {
  it('série quotidienne démarrée 400 j avant : les occurrences de la fenêtre existent (garde non épuisé)', () => {
    const start = new Date(); start.setHours(9, 0, 0, 0); start.setDate(start.getDate() - 400)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    const e = ev({ start, end, recurrence: { freq: 'daily' } })
    const winStart = new Date(); winStart.setDate(winStart.getDate() - 2); winStart.setHours(0, 0, 0, 0)
    const winEnd = new Date(); winEnd.setDate(winEnd.getDate() + 2); winEnd.setHours(23, 59, 59, 999)
    const out = calExpandEvents([e], winStart, winEnd)
    expect(out.length).toBe(5) // -2, -1, 0, +1, +2
    expect(out.every(o => o.start >= winStart && o.start <= winEnd)).toBe(true)
  })

  it('hebdomadaire + until : borne la série', () => {
    const e = ev({ start: new Date('2026-03-02T14:00:00'), end: new Date('2026-03-02T15:00:00'), recurrence: { freq: 'weekly', until: '2026-03-20T23:59:59' } })
    const out = calExpandEvents([e], new Date('2026-03-01T00:00:00'), new Date('2026-04-30T23:59:59'))
    expect(out.map(o => ymd(o.start))).toEqual(['2026-03-02', '2026-03-09', '2026-03-16'])
  })
})

describe('calExpandEvents — non récurrent', () => {
  it('renvoie l’événement tel quel (même référence → React.memo tient)', () => {
    const e = ev({})
    const out = calExpandEvents([e], new Date('2026-01-01'), new Date('2026-12-31'))
    expect(out).toHaveLength(1)
    expect(out[0]).toBe(e)
  })
})

describe('calConflicts', () => {
  const base = new Date('2026-04-10T10:00:00')
  const mk = (id: string, h: number, m: number, durMin: number, extra?: Partial<CalEvent>): CalEvent =>
    ev({ id, start: new Date(2026, 3, 10, h, m), end: new Date(2026, 3, 10, h, m + durMin), ...extra })

  it('détecte un chevauchement le même jour, exclut l’événement lui-même', () => {
    const a = mk('a', 10, 0, 60)
    const b = mk('b', 10, 30, 60)
    const list = [a, b]
    expect(calConflicts(a, list).map(x => x.id)).toEqual(['b'])
  })

  it('adjacence (fin = début) ne chevauche pas', () => {
    const a = mk('a', 10, 0, 60) // 10:00–11:00
    const c = mk('c', 11, 0, 60) // 11:00–12:00
    expect(calConflicts(a, [a, c])).toHaveLength(0)
  })

  it('inclut les blocs externes « Occupé » mais exclut annulés et journée entière', () => {
    const a = mk('a', 10, 0, 60)
    const ext = mk('x', 10, 30, 60, { external: true, source: 'google' })
    const cancelled = mk('y', 10, 15, 60, { status: 'cancelled' })
    const allDay = mk('z', 0, 0, 60, { allDay: true })
    const res = calConflicts(a, [a, ext, cancelled, allDay])
    expect(res.map(x => x.id)).toEqual(['x'])
  })

  it('un événement annulé n’a pas de conflit', () => {
    const a = mk('a', 10, 0, 60, { status: 'cancelled' })
    const b = mk('b', 10, 30, 60)
    expect(calConflicts(a, [a, b])).toHaveLength(0)
  })

  void base
})
