import { describe, it, expect } from 'vitest'
import {
  computeSlots, zonedTimeToUtc, localDateParts, tzOffsetMs,
  type BookingSettings,
} from './booking-slots.ts'

// Bascules DST européennes 2026 : début le dimanche 29 mars, fin le dimanche
// 25 octobre. C'est le seul endroit du calcul de créneaux où une erreur est
// silencieuse — elle décale toute une journée de rendez-vous d'une heure, deux
// fois par an, et personne ne s'en aperçoit avant que le client se présente à
// la mauvaise heure.
const TZ = 'Europe/Zurich'
const H = 3_600_000

const settings = (over: Partial<BookingSettings> = {}): BookingSettings => ({
  is_open: true,
  timezone: TZ,
  slot_minutes: 60,
  buffer_minutes: 0,
  min_notice_hours: 0,
  max_advance_days: 30,
  weekly_hours: Object.fromEntries(
    ['1', '2', '3', '4', '5', '6', '7'].map(d => [d, [['09:00', '12:00']]]),
  ) as BookingSettings['weekly_hours'],
  ...over,
})

describe('booking-slots — arithmétique de fuseau', () => {
  it('applique CET (UTC+1) avant la bascule de printemps', () => {
    // 28 mars 2026, 09:00 à Zurich = 08:00 UTC
    expect(zonedTimeToUtc(2026, 3, 28, 9, 0, TZ)).toBe(Date.parse('2026-03-28T08:00:00Z'))
  })

  it('applique CEST (UTC+2) après la bascule de printemps', () => {
    // 30 mars 2026, 09:00 à Zurich = 07:00 UTC — une heure de MOINS qu'avant
    expect(zonedTimeToUtc(2026, 3, 30, 9, 0, TZ)).toBe(Date.parse('2026-03-30T07:00:00Z'))
  })

  it('applique CEST avant la bascule d\'automne, CET après', () => {
    expect(zonedTimeToUtc(2026, 10, 24, 9, 0, TZ)).toBe(Date.parse('2026-10-24T07:00:00Z'))
    expect(zonedTimeToUtc(2026, 10, 26, 9, 0, TZ)).toBe(Date.parse('2026-10-26T08:00:00Z'))
  })

  it('expose le bon décalage de part et d\'autre de la bascule', () => {
    expect(tzOffsetMs(Date.parse('2026-03-28T12:00:00Z'), TZ)).toBe(1 * H)
    expect(tzOffsetMs(Date.parse('2026-03-30T12:00:00Z'), TZ)).toBe(2 * H)
  })

  it('donne le jour ISO local, pas le jour UTC', () => {
    // 23:30 UTC un dimanche = 01:30 le LUNDI à Zurich (CEST)
    const p = localDateParts(Date.parse('2026-06-07T23:30:00Z'), TZ)
    expect(p.day).toBe(8)
    expect(p.isoDow).toBe(1) // lundi
  })
})

describe('booking-slots — génération des créneaux', () => {
  const nowMs = Date.parse('2026-06-01T06:00:00Z') // lundi

  it('découpe la plage hebdomadaire en créneaux de la bonne durée', () => {
    const slots = computeSlots({ settings: settings(), busy: [], nowMs, horizonDays: 0 })
    // 09:00-12:00 locale, créneaux d'1 h → 3 créneaux le jour même
    expect(slots).toHaveLength(3)
    expect(slots[0].start).toBe('2026-06-01T07:00:00.000Z') // 09:00 CEST
    expect(slots[2].end).toBe('2026-06-01T10:00:00.000Z')   // 12:00 CEST
  })

  it('ne propose rien si l\'agent n\'a pas ouvert l\'auto-réservation', () => {
    expect(computeSlots({ settings: settings({ is_open: false }), busy: [], nowMs })).toHaveLength(0)
  })

  it('respecte le délai de prévenance', () => {
    const slots = computeSlots({
      settings: settings({ min_notice_hours: 24 }), busy: [], nowMs, horizonDays: 1,
    })
    // Tout ce qui est à moins de 24 h est écarté → rien le 1er juin
    expect(slots.every(s => Date.parse(s.start) >= nowMs + 24 * H)).toBe(true)
    expect(slots.some(s => s.start.startsWith('2026-06-02'))).toBe(true)
  })

  it('respecte l\'horizon maximal', () => {
    const slots = computeSlots({
      settings: settings({ max_advance_days: 2 }), busy: [], nowMs, horizonDays: 30,
    })
    expect(slots.every(s => Date.parse(s.start) <= nowMs + 2 * 86_400_000)).toBe(true)
  })

  it('écarte un créneau recouvert par une occupation', () => {
    const busy = [{
      start: Date.parse('2026-06-01T08:00:00Z'), // 10:00 locale
      end: Date.parse('2026-06-01T09:00:00Z'),
    }]
    const slots = computeSlots({ settings: settings(), busy, nowMs, horizonDays: 0 })
    expect(slots.map(s => s.start)).toEqual([
      '2026-06-01T07:00:00.000Z',
      '2026-06-01T09:00:00.000Z',
    ])
  })

  it('applique le battement des DEUX côtés d\'une occupation', () => {
    // Même règle que kyc_slot_rejection : [début − battement, fin + battement).
    const busy = [{
      start: Date.parse('2026-06-01T08:00:00Z'),
      end: Date.parse('2026-06-01T08:30:00Z'),
    }]
    const slots = computeSlots({
      settings: settings({ buffer_minutes: 15 }), busy, nowMs, horizonDays: 0,
    })
    // 07:00 et 08:00 tombent dans [08:00 − 15 min, 08:30 + 15 min) → écartés.
    // 09:00 démarre après 08:45, il survit : le battement protège, il ne rase pas.
    expect(slots.map(s => s.start)).toEqual(['2026-06-01T09:00:00.000Z'])
  })

  it('traverse la bascule de printemps sans décaler les heures locales', () => {
    // Du 27 au 31 mars 2026 : la bascule tombe le 29.
    const slots = computeSlots({
      settings: settings({ weekly_hours: Object.fromEntries(
        ['1', '2', '3', '4', '5', '6', '7'].map(d => [d, [['09:00', '10:00']]]),
      ) as BookingSettings['weekly_hours'] }),
      busy: [],
      nowMs: Date.parse('2026-03-27T00:00:00Z'),
      horizonDays: 4,
    })
    const starts = slots.map(s => s.start)
    expect(starts).toContain('2026-03-28T08:00:00.000Z') // 09:00 CET
    expect(starts).toContain('2026-03-30T07:00:00.000Z') // 09:00 CEST — 1 h de moins en UTC
    // Aucun jour sauté ni dupliqué malgré la journée de 23 h du 29 mars.
    expect(new Set(starts.map(s => s.slice(0, 10))).size).toBe(starts.length)
  })

  it('traverse la bascule d\'automne sans dupliquer de créneau', () => {
    const slots = computeSlots({
      settings: settings({ weekly_hours: Object.fromEntries(
        ['1', '2', '3', '4', '5', '6', '7'].map(d => [d, [['09:00', '10:00']]]),
      ) as BookingSettings['weekly_hours'] }),
      busy: [],
      nowMs: Date.parse('2026-10-23T00:00:00Z'),
      horizonDays: 4,
    })
    const starts = slots.map(s => s.start)
    expect(starts).toContain('2026-10-24T07:00:00.000Z') // 09:00 CEST
    expect(starts).toContain('2026-10-26T08:00:00.000Z') // 09:00 CET
    expect(new Set(starts).size).toBe(starts.length)     // la journée de 25 h ne double rien
  })

  it('ignore une plage malformée au lieu d\'inventer un horaire', () => {
    const slots = computeSlots({
      settings: settings({ weekly_hours: { '1': [['pasuneheure', '12:00']] } as never }),
      busy: [], nowMs, horizonDays: 0,
    })
    expect(slots).toHaveLength(0)
  })
})
