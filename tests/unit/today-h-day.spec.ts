// Garde-fou du Lot 0 « Aujourd'hui » (concept H) : la traduction des événements
// du Calendrier en ligne du temps, et le cadrage de la journée.
//
// Pourquoi ces tests précisément : ce sont les deux calculs qui peuvent se
// tromper SANS que ça se voie à l'écran — une durée forcée à 1 h ressemble à une
// vraie durée, et une fenêtre libre mal détectée ressemble à une journée pleine.
// Ils verrouillent aussi trois refus explicites (pas de `risk` fabriqué, pas de
// note IA inventée, pas de prix non formaté).

import { describe, it, expect } from 'vitest'
import { mapEventsToBlocks, deriveDay } from '@/components/crm-sugar/today/useTodayH'
import type { CalEvent } from '@/components/crm-sugar/calendar/data'

// Traducteur de test : rend la clé, ce qui suffit à vérifier QUELLE clé est choisie.
const tKey = (k: string) => k

/** Événement du jour à `HH:MM`, d'une durée donnée. */
function ev(over: Partial<CalEvent> & { id: string; h: number; m?: number; durMin?: number }): CalEvent {
  const start = new Date(2026, 7, 3, over.h, over.m ?? 0, 0, 0)
  const end = new Date(start.getTime() + (over.durMin ?? 60) * 60_000)
  return {
    id: over.id,
    type: over.type ?? 'visite',
    title: over.title ?? 'Événement',
    start,
    end,
    contact: over.contact,
    property: over.property,
    location: over.location,
    notes: over.notes,
    status: over.status,
    origin: over.origin,
    contactId: over.contactId,
    bienId: over.bienId,
  }
}

describe('mapEventsToBlocks — traduction des événements en blocs', () => {
  it('reprend la durée RÉELLE de l’événement, sans la forcer à une heure', () => {
    const [b] = mapEventsToBlocks([ev({ id: 'v1', h: 14, durMin: 45 })], {}, tKey)
    expect(b.dur).toBe(45)
    expect(b.from).toBe(14 * 60)
    expect(b.time).toBe('14:00')
  })

  it('plancher de 15 min : un événement de durée nulle reste cliquable', () => {
    const [b] = mapEventsToBlocks([ev({ id: 'v0', h: 9, durMin: 0 })], {}, tKey)
    expect(b.dur).toBe(15)
  })

  it('traduit les types du Calendrier vers les familles fonctionnelles de la maquette', () => {
    const blocks = mapEventsToBlocks([
      ev({ id: 'a', h: 8, type: 'visite' }),
      ev({ id: 'b', h: 9, type: 'kyc' }),
      ev({ id: 'c', h: 10, type: 'mandate' }),
      ev({ id: 'd', h: 11, type: 'notary' }),
      ev({ id: 'e', h: 12, type: 'task' }),
    ], {}, tKey)
    expect(blocks.map((b) => b.kind)).toEqual(['home', 'shield', 'doc', 'offer', 'call'])
  })

  it('une visite issue de `visits` porte un CTA routable vers SA fiche', () => {
    const [b] = mapEventsToBlocks([ev({ id: 'visit-42', h: 14, type: 'visite', origin: 'visit' })], {}, tKey)
    expect(b.route).toBe('visite-detail')
    expect(b.navRef).toBe('visit-42')
  })

  it('un rappel rattaché à un contact route vers CE contact', () => {
    const [b] = mapEventsToBlocks([ev({ id: 'r1', h: 10, type: 'task', contactId: 'c-77' })], {}, tKey)
    expect(b.route).toBe('contact-detail')
    expect(b.navRef).toBe('c-77')
  })

  it('sans référence routable, le CTA retombe sur le calendrier plutôt que de ne rien faire', () => {
    const [b] = mapEventsToBlocks([ev({ id: 'x', h: 10, type: 'task' })], {}, tKey)
    expect(b.route).toBe('calendar')
    expect(b.navRef).toBeUndefined()
  })

  it('formate le prix du bien en CHF avec l’apostrophe suisse', () => {
    const [b] = mapEventsToBlocks([ev({
      id: 'v', h: 14, type: 'visite',
      property: { id: 'p1', title: 'Carouge', area: 78, price: 890000, tone: '#000' },
    })], {}, tKey)
    expect(b.price).toBe("CHF 890'000")
  })

  it('attache la photo du bien quand elle est connue, et rien sinon', () => {
    const property = { id: 'p1', title: 'Carouge', area: 78, price: null, tone: '#000' }
    const [avec] = mapEventsToBlocks([ev({ id: 'v', h: 14, property })], { p1: 'https://x/p.jpg' }, tKey)
    const [sans] = mapEventsToBlocks([ev({ id: 'v', h: 14, property })], {}, tKey)
    expect(avec.photo).toBe('https://x/p.jpg')
    expect(sans.photo).toBeUndefined()
  })

  it('ne FABRIQUE ni risque ni note MEGGA AI : aucune source ne les porte', () => {
    const [b] = mapEventsToBlocks([ev({ id: 'v', h: 14 })], {}, tKey)
    expect(b.risk).toBeUndefined()
    expect(b.line).toBe('')
  })

  it('la couleur d’avatar est déterministe : deux appels donnent la même', () => {
    const once = mapEventsToBlocks([ev({ id: 'v', h: 9, contactId: 'c-1' })], {}, tKey)[0]
    const twice = mapEventsToBlocks([ev({ id: 'v', h: 9, contactId: 'c-1' })], {}, tKey)[0]
    expect(once.av).toBe(twice.av)
  })

  it('marque `done` sur un événement terminé', () => {
    const [b] = mapEventsToBlocks([ev({ id: 'v', h: 9, status: 'done' })], {}, tKey)
    expect(b.done).toBe(true)
  })
})

describe('deriveDay — cadrage de la journée et fenêtre libre', () => {
  const at = (h: number, m = 0) => new Date(2026, 7, 3, h, m, 0, 0).getTime()
  const blocks = (...spec: Array<[string, number, number]>) =>
    mapEventsToBlocks(spec.map(([id, h, durMin]) => ev({ id, h, durMin })), {}, tKey)

  it('cadre sur le 1er→dernier créneau, arrondi à l’heure pleine', () => {
    const day = deriveDay(blocks(['a', 9, 30], ['b', 16, 45]), at(10))
    expect(day.startMin).toBe(9 * 60)   // 09:00
    expect(day.endMin).toBe(17 * 60)    // 16:45 arrondi au-dessus
  })

  it('arrondit le début vers le BAS quand le premier créneau ne tombe pas sur l’heure', () => {
    const day = deriveDay(mapEventsToBlocks([ev({ id: 'a', h: 9, m: 30, durMin: 30 })], {}, tKey), at(10))
    expect(day.startMin).toBe(9 * 60)
  })

  it('retient le PLUS GRAND trou d’au moins 45 min', () => {
    // 09:00-10:00 · trou 60 min · 11:00-11:30 · trou 150 min · 14:00-15:00
    const day = deriveDay(blocks(['a', 9, 60], ['b', 11, 30], ['c', 14, 60]), at(10))
    expect(day.free).toEqual({ from: 11 * 60 + 30, to: 14 * 60 })
  })

  it('ne propose aucune fenêtre libre quand les trous sont trop courts', () => {
    // 09:00-10:00 · trou 30 min · 10:30-11:00
    const day = deriveDay(blocks(['a', 9, 60], ['b', 10, 30]), at(9))
    expect(day.free).toBeNull()
  })

  it('un trou d’exactement 45 min compte', () => {
    const day = deriveDay(blocks(['a', 9, 60], ['b', 10, 30]).concat(
      mapEventsToBlocks([ev({ id: 'c', h: 11, m: 15, durMin: 30 })], {}, tKey),
    ), at(9))
    expect(day.free).toEqual({ from: 10 * 60 + 30, to: 11 * 60 + 15 })
  })

  it('journée dégagée : aucune fenêtre libre, et un cadre centré sur « maintenant »', () => {
    const day = deriveDay([], at(14, 20))
    expect(day.blocks).toHaveLength(0)
    expect(day.free).toBeNull()
    expect(day.nowMin).toBe(14 * 60 + 20)
    expect(day.startMin).toBe(12 * 60)  // 14:20 − 2 h, arrondi à l'heure
    expect(day.endMin).toBe(20 * 60)
  })

  it('« maintenant » est lu en heure LOCALE, libellé compris', () => {
    const day = deriveDay(blocks(['a', 9, 60]), at(10, 7))
    expect(day.nowMin).toBe(10 * 60 + 7)
    expect(day.nowLabel).toBe('10:07')
  })

  it('ne sort jamais du cadre d’une journée civile', () => {
    const day = deriveDay([], at(23, 50))
    expect(day.startMin).toBeGreaterThanOrEqual(0)
    expect(day.endMin).toBeLessThanOrEqual(24 * 60)
  })
})
