// Garde-fou du moteur de créneaux de l'appel d'accueil.
//
// Le cas qui justifie à lui seul ce fichier est le passage à l'heure d'été : un hôte
// qui reçoit « de 09:00 à 12:00 » doit continuer à recevoir de 09:00 à 12:00 le
// lendemain du changement d'heure. Une implémentation à décalage fixe passe tous les
// autres tests et échoue celui-là, deux fois par an, sans rien casser de visible.

import { describe, it, expect } from 'vitest'
import {
  computeHostSlots,
  unionSlotStarts,
  pickHostForSlot,
  wallTimeToInstant,
  zonedDayKey,
  isoDayOfWeek,
  parseWeeklyHours,
  recheckWindow,
  type HostSchedule,
} from './onboarding-slots.ts'

const ZURICH = 'Europe/Zurich'
const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Hôte de référence : lundi à vendredi, 09:00-12:00, créneaux de 30 min. */
function host(overrides: Partial<HostSchedule> = {}): HostSchedule {
  return {
    hostId: 'host-a',
    timezone: ZURICH,
    weeklyHours: [1, 2, 3, 4, 5].map((dow) => ({ dow, start: '09:00', end: '12:00' })),
    exceptions: [],
    busy: [],
    bookedStartsMs: [],
    slotMinutes: 30,
    durationMinutes: 30,
    bufferAfterMinutes: 0,
    minNoticeHours: 0,
    horizonDays: 30,
    maxPerDay: null,
    ...overrides,
  }
}

/** Heure murale de Zurich lisible, pour que les attentes des tests restent lisibles. */
function wall(instantMs: number): string {
  return new Intl.DateTimeFormat('fr-CH', {
    timeZone: ZURICH,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(instantMs)).replace(', ', ' ')
}

/** Fenêtre couvrant une seule journée civile de Zurich. */
function dayWindow(dayKey: string) {
  const from = wallTimeToInstant(dayKey, '00:00', ZURICH)!
  return { fromMs: from, toMs: from + DAY }
}

describe('conversion heure murale vers instant', () => {
  it('applique le bon décalage en hiver et en été', () => {
    // 15 janvier : Zurich est à UTC+1, donc 09:00 locale = 08:00 UTC.
    expect(new Date(wallTimeToInstant('2027-01-15', '09:00', ZURICH)!).toISOString())
      .toBe('2027-01-15T08:00:00.000Z')
    // 15 juillet : Zurich est à UTC+2, donc 09:00 locale = 07:00 UTC.
    expect(new Date(wallTimeToInstant('2027-07-15', '09:00', ZURICH)!).toISOString())
      .toBe('2027-07-15T07:00:00.000Z')
  })

  it('refuse une heure murale qui n_existe pas (heure sautée au printemps)', () => {
    // Le 28 mars 2027, Zurich passe de 02:00 à 03:00 : 02:30 n'existe pas ce jour-là.
    expect(wallTimeToInstant('2027-03-28', '02:30', ZURICH)).toBeNull()
    // Le lendemain, la même heure murale existe de nouveau.
    expect(wallTimeToInstant('2027-03-29', '02:30', ZURICH)).not.toBeNull()
  })

  it('rend une clé de journée et un jour de semaine ISO cohérents', () => {
    const instant = wallTimeToInstant('2027-01-15', '09:00', ZURICH)!
    expect(zonedDayKey(instant, ZURICH)).toBe('2027-01-15')
    expect(isoDayOfWeek('2027-01-15')).toBe(5) // vendredi
    expect(isoDayOfWeek('2027-01-17')).toBe(7) // dimanche
  })
})

describe('passage a l_heure d_ete et a l_heure d_hiver', () => {
  it('garde la meme heure murale de part et d_autre du passage a l_heure d_ete', () => {
    // 28 mars 2027 = dimanche du changement. On regarde le vendredi d'avant et le
    // lundi d'après : mêmes heures murales, décalages UTC différents.
    const before = computeHostSlots({
      hosts: [host()],
      ...dayWindow('2027-03-26'),
      nowMs: wallTimeToInstant('2027-03-01', '00:00', ZURICH)!,
    })
    const after = computeHostSlots({
      hosts: [host()],
      ...dayWindow('2027-03-29'),
      nowMs: wallTimeToInstant('2027-03-01', '00:00', ZURICH)!,
    })

    expect(before.map((s) => wall(s.startMs))).toEqual([
      '26.03.2027 09:00', '26.03.2027 09:30', '26.03.2027 10:00',
      '26.03.2027 10:30', '26.03.2027 11:00', '26.03.2027 11:30',
    ])
    expect(after.map((s) => wall(s.startMs))).toEqual([
      '29.03.2027 09:00', '29.03.2027 09:30', '29.03.2027 10:00',
      '29.03.2027 10:30', '29.03.2027 11:00', '29.03.2027 11:30',
    ])

    // La preuve que le fuseau a bien bougé : le même 09:00 mural n'est pas le même
    // instant UTC. Un décalage figé aurait donné deux fois la même heure UTC.
    expect(new Date(before[0].startMs).toISOString()).toBe('2027-03-26T08:00:00.000Z')
    expect(new Date(after[0].startMs).toISOString()).toBe('2027-03-29T07:00:00.000Z')
  })

  it('garde la meme heure murale de part et d_autre du passage a l_heure d_hiver', () => {
    // 31 octobre 2027 = dimanche du retour à l'heure d'hiver. `nowMs` est pris peu
    // avant, sans quoi le lundi d'après sortirait de l'horizon de 30 jours.
    const now = wallTimeToInstant('2027-10-20', '00:00', ZURICH)!
    const before = computeHostSlots({
      hosts: [host()],
      ...dayWindow('2027-10-29'),
      nowMs: now,
    })
    const after = computeHostSlots({
      hosts: [host()],
      ...dayWindow('2027-11-01'),
      nowMs: now,
    })

    expect(wall(before[0].startMs)).toBe('29.10.2027 09:00')
    expect(wall(after[0].startMs)).toBe('01.11.2027 09:00')
    expect(new Date(before[0].startMs).toISOString()).toBe('2027-10-29T07:00:00.000Z')
    expect(new Date(after[0].startMs).toISOString()).toBe('2027-11-01T08:00:00.000Z')
  })
})

describe('retranchements', () => {
  const NOW = wallTimeToInstant('2027-01-11', '06:00', ZURICH)! // lundi, avant l'ouverture

  it('ne propose rien un jour non ouvre', () => {
    const slots = computeHostSlots({
      hosts: [host()],
      ...dayWindow('2027-01-16'), // samedi
      nowMs: NOW,
    })
    expect(slots).toEqual([])
  })

  it('retire le creneau qui chevauche une occupation externe', () => {
    const busyStart = wallTimeToInstant('2027-01-12', '10:00', ZURICH)!
    const slots = computeHostSlots({
      hosts: [host({ busy: [{ startMs: busyStart, endMs: busyStart + HOUR }] })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(slots.map((s) => wall(s.startMs))).toEqual([
      '12.01.2027 09:00', '12.01.2027 09:30', '12.01.2027 11:00', '12.01.2027 11:30',
    ])
  })

  it('le tampon de fin mange le creneau suivant', () => {
    const busyStart = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const slots = computeHostSlots({
      hosts: [host({
        bufferAfterMinutes: 15,
        busy: [{ startMs: busyStart, endMs: busyStart + 30 * MINUTE }],
      })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    // L'occupation finit à 09:30 ; 09:30 est mangé par le tampon, 10:00 revient.
    expect(slots.map((s) => wall(s.startMs))).toEqual([
      '12.01.2027 10:00', '12.01.2027 10:30', '12.01.2027 11:00', '12.01.2027 11:30',
    ])
  })

  it('le preavis minimum coupe le debut de la fenetre', () => {
    const slots = computeHostSlots({
      hosts: [host({ minNoticeHours: 4 })],
      ...dayWindow('2027-01-11'),
      nowMs: wallTimeToInstant('2027-01-11', '08:00', ZURICH)!,
    })
    // 08:00 + 4 h = 12:00 : plus rien ce jour-là, la plage s'arrête à 12:00.
    expect(slots).toEqual([])
  })

  it('l_horizon coupe la fin de la fenetre', () => {
    // L'horizon court depuis `now` (lundi 06:00), pas depuis la fin de la journée :
    // 2 jours mènent au mercredi 06:00, donc avant l'ouverture du mercredi.
    const slots = computeHostSlots({
      hosts: [host({ horizonDays: 2 })],
      fromMs: NOW,
      toMs: NOW + 30 * DAY,
      nowMs: NOW,
    })
    const days = new Set(slots.map((s) => zonedDayKey(s.startMs, ZURICH)))
    expect([...days]).toEqual(['2027-01-11', '2027-01-12'])
  })

  it('une exception datee ferme la journee', () => {
    const slots = computeHostSlots({
      hosts: [host({ exceptions: [{ day: '2027-01-12', isClosed: true }] })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(slots).toEqual([])
  })

  it('une exception datee peut remplacer les plages du jour', () => {
    const slots = computeHostSlots({
      hosts: [host({
        exceptions: [{ day: '2027-01-12', isClosed: false, slices: [{ dow: 2, start: '14:00', end: '15:00' }] }],
      })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(slots.map((s) => wall(s.startMs))).toEqual(['12.01.2027 14:00', '12.01.2027 14:30'])
  })

  it('le plafond journalier ferme la journee une fois atteint', () => {
    const booked = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const slots = computeHostSlots({
      hosts: [host({ maxPerDay: 1, bookedStartsMs: [booked] })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(slots).toEqual([])
  })

  it('ne propose pas un creneau dont la duree deborde la plage', () => {
    const slots = computeHostSlots({
      hosts: [host({ durationMinutes: 45, slotMinutes: 30 })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    // 09:00, 09:30, 10:00, 10:30 tiennent (fin <= 12:00) ; 11:00 finirait à 11:45,
    // donc tient aussi ; 11:30 finirait à 12:15, donc non.
    expect(slots.map((s) => wall(s.startMs))).toEqual([
      '12.01.2027 09:00', '12.01.2027 09:30', '12.01.2027 10:00',
      '12.01.2027 10:30', '12.01.2027 11:00',
    ])
  })
})

describe('plusieurs hotes', () => {
  const NOW = wallTimeToInstant('2027-01-11', '06:00', ZURICH)!

  it('deux hotes libres au meme creneau ne produisent qu_un creneau propose', () => {
    const slots = computeHostSlots({
      hosts: [host({ hostId: 'a' }), host({ hostId: 'b' })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(slots).toHaveLength(12) // 6 créneaux x 2 hôtes
    expect(unionSlotStarts(slots)).toHaveLength(6)
  })

  it('l_union expose le creneau tant qu_au moins un hote est libre', () => {
    const nine = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const slots = computeHostSlots({
      hosts: [
        host({ hostId: 'a', busy: [{ startMs: nine, endMs: nine + 3 * HOUR }] }),
        host({ hostId: 'b' }),
      ],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(unionSlotStarts(slots)).toHaveLength(6)
    expect(slots.every((s) => s.hostId === 'b')).toBe(true)
  })

  it('l_attribution tournante choisit l_hote le moins charge', () => {
    const nine = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const slots = computeHostSlots({
      hosts: [host({ hostId: 'a' }), host({ hostId: 'b' })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(pickHostForSlot(slots, nine, { a: 5, b: 2 })).toBe('b')
    expect(pickHostForSlot(slots, nine, { a: 1, b: 9 })).toBe('a')
  })

  it('departage a charge egale de facon deterministe', () => {
    const nine = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const slots = computeHostSlots({
      hosts: [host({ hostId: 'b' }), host({ hostId: 'a' })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(pickHostForSlot(slots, nine, { a: 3, b: 3 })).toBe('a')
    expect(pickHostForSlot(slots, nine, {})).toBe('a')
  })

  it('rend null quand plus personne n_est libre au creneau demande', () => {
    const nine = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const slots = computeHostSlots({
      hosts: [host({ hostId: 'a', busy: [{ startMs: nine, endMs: nine + 3 * HOUR }] })],
      ...dayWindow('2027-01-12'),
      nowMs: NOW,
    })
    expect(pickHostForSlot(slots, nine, {})).toBeNull()
  })
})

describe('fenetre de reverification avant ecriture', () => {
  // Regression mesuree de bout en bout le 03.08.2026 : la reservation revérifiait le
  // créneau sur +/- 1 minute. Le moteur n'expose un creneau que si le rendez-vous
  // ENTIER tient dans la fenetre, donc un rendez-vous de 30 min n'y tenait jamais :
  // TOUTE reservation echouait en « creneau deja pris », en accusant un autre client
  // alors que le creneau etait libre.
  it('contient le rendez-vous entier, tampon compris', () => {
    const slot = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const { fromMs, toMs } = recheckWindow(slot)

    // Le pire cas admis par les contraintes de la table : 480 min de duree + 240 de tampon.
    expect(toMs - slot).toBeGreaterThanOrEqual((480 + 240) * MINUTE)
    expect(slot - fromMs).toBeGreaterThan(0)
  })

  it('le creneau demande est bien rendu sur cette fenetre', () => {
    const slot = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const { fromMs, toMs } = recheckWindow(slot)

    const found = computeHostSlots({
      hosts: [host({ durationMinutes: 30, bufferAfterMinutes: 15 })],
      fromMs,
      toMs,
      nowMs: wallTimeToInstant('2027-01-11', '06:00', ZURICH)!,
    })
    expect(found.some((s) => s.startMs === slot)).toBe(true)
  })

  it('une fenetre trop etroite ne rend rien — ce qui justifie la precedente', () => {
    const slot = wallTimeToInstant('2027-01-12', '09:00', ZURICH)!
    const found = computeHostSlots({
      hosts: [host()],
      fromMs: slot - MINUTE,
      toMs: slot + MINUTE,
      nowMs: wallTimeToInstant('2027-01-11', '06:00', ZURICH)!,
    })
    expect(found).toEqual([])
  })
})

describe('parseWeeklyHours', () => {
  it('garde les plages valides et rejette le reste sans lever', () => {
    expect(parseWeeklyHours([
      { dow: 1, start: '09:00', end: '12:00' },
      { dow: 8, start: '09:00', end: '12:00' },   // jour hors bornes
      { dow: 2, start: '12:00', end: '09:00' },   // fin avant le début
      { dow: 3, start: '9:00', end: '12:00' },    // format non respecté
      { dow: 4, start: '14:00', end: '18:30' },
      null,
      'nope',
    ])).toEqual([
      { dow: 1, start: '09:00', end: '12:00' },
      { dow: 4, start: '14:00', end: '18:30' },
    ])
  })

  it('rend un tableau vide sur une entree qui n_est pas un tableau', () => {
    expect(parseWeeklyHours(null)).toEqual([])
    expect(parseWeeklyHours({ dow: 1 })).toEqual([])
  })
})
