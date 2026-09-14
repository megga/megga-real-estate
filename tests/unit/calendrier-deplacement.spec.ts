/**
 * Déplacer un événement du Calendrier d'un jour à l'autre (14.09.2026, Julien : « dans
 * tous les événements, tâches, on doit pouvoir switcher d'un jour à l'autre »).
 *
 * Les calculs purs du glissé — le geste lui-même est éprouvé dans un vrai navigateur,
 * sur le banc (`tests/e2e/calendrier-deplacement.spec.ts`).
 */
import { describe, expect, it } from 'vitest'
import {
  calCaler, calColonneSous, calDecalerDeJours, calDeplacable, calEcartJours, calPlacer,
} from '@/components/crm/calendar/calDeplacement'
import type { CalEvent } from '@/components/crm/calendar/data'

const ev = (partial: Partial<CalEvent> = {}): CalEvent => ({
  id: 'e1', type: 'task', title: 'Tâche', origin: 'reminder',
  start: new Date(2026, 8, 15, 18, 55), end: new Date(2026, 8, 15, 19, 25),
  ...partial,
})
const hm = (d: Date) => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`

describe('calDeplacable — ce qui se saisit', () => {
  it('une visite, une tâche, un brouillon se déplacent', () => {
    expect(calDeplacable(ev({ origin: 'visit', type: 'visite' }))).toBe(true)
    expect(calDeplacable(ev())).toBe(true)
    expect(calDeplacable(ev({ origin: undefined, id: 'draft_1' }))).toBe(true)
  })

  it('ni un créneau externe, ni une occurrence de série, ni un RDV KYC réservé par le client', () => {
    expect(calDeplacable(ev({ external: true }))).toBe(false)
    expect(calDeplacable(ev({ isOccurrence: true }))).toBe(false)
    // Le déplacer sans prévenir le client serait pire que de ne rien faire : il se
    // laissait glisser, et revenait à sa place au rechargement.
    expect(calDeplacable(ev({ origin: 'appointment', type: 'kyc' }))).toBe(false)
  })
})

describe('calPlacer — la pose dans un jour cible', () => {
  it('changer de jour ne change PAS l’heure : 18:55 reste 18:55 (le pas vise le décalage, pas l’heure)', () => {
    const { start, end } = calPlacer(ev(), new Date(2026, 8, 17), 0)
    expect(start.getDate()).toBe(17)
    expect(hm(start)).toBe('18:55')
    expect(hm(end)).toBe('19:25')
  })

  it('le décalage se cale au quart d’heure : 7 min ne bougent rien, 8 min en font 15', () => {
    expect(hm(calPlacer(ev(), new Date(2026, 8, 15), 7).start)).toBe('18:55')
    expect(hm(calPlacer(ev(), new Date(2026, 8, 15), 8).start)).toBe('19:10')
    expect(hm(calPlacer(ev(), new Date(2026, 8, 15), -52).start)).toBe('18:10')
  })

  it('la durée ne change jamais', () => {
    const v = ev({ start: new Date(2026, 8, 15, 13, 30), end: new Date(2026, 8, 15, 14, 15) })
    const { start, end } = calPlacer(v, new Date(2026, 8, 18), 95)
    expect(hm(start)).toBe('15:00')
    expect(end.getTime() - start.getTime()).toBe(45 * 60000)
  })

  it('bornée à la journée : ni avant minuit, ni au-delà du dernier créneau entier', () => {
    const tard = ev({ start: new Date(2026, 8, 15, 23, 0), end: new Date(2026, 8, 15, 23, 45) })
    expect(hm(calPlacer(tard, new Date(2026, 8, 15), 120).start)).toBe('23:15')
    const tot = ev({ start: new Date(2026, 8, 15, 0, 30), end: new Date(2026, 8, 15, 1, 0) })
    expect(hm(calPlacer(tot, new Date(2026, 8, 16), -240).start)).toBe('0:00')
  })
})

describe('calEcartJours / calDecalerDeJours — la vue Mois', () => {
  it('l’écart se compte en jours CIVILS, quelle que soit l’heure', () => {
    expect(calEcartJours(new Date(2026, 8, 15, 23, 50), new Date(2026, 8, 16, 0, 10))).toBe(1)
    expect(calEcartJours(new Date(2026, 8, 18), new Date(2026, 8, 15))).toBe(-3)
    expect(calEcartJours(new Date(2026, 8, 30), new Date(2026, 9, 2))).toBe(2)
  })

  it('par-dessus le passage à l’heure d’hiver (25.10.2026), un samedi 10:00 arrive le lundi à 10:00', () => {
    const samedi = ev({ start: new Date(2026, 9, 24, 10, 0), end: new Date(2026, 9, 24, 11, 0) })
    expect(calEcartJours(new Date(2026, 9, 24), new Date(2026, 9, 26))).toBe(2)
    const { start, end } = calDecalerDeJours(samedi, 2)
    expect(start.getDate()).toBe(26)
    expect(hm(start)).toBe('10:00')
    expect(hm(end)).toBe('11:00')
  })
})

describe('calCaler / calColonneSous', () => {
  it('calCaler arrondit au pas le plus proche', () => {
    expect(calCaler(22)).toBe(15)
    expect(calCaler(23)).toBe(30)
    expect(calCaler(-8)).toBe(-15)
  })

  it('la colonne sous le pointeur, bornée aux colonnes affichées', () => {
    const cols = [{ left: 100, right: 200 }, { left: 200, right: 300 }, { left: 300, right: 400 }]
    expect(calColonneSous(250, cols)).toBe(1)
    // Lâché dans la gouttière des heures : le premier jour, pas nulle part.
    expect(calColonneSous(40, cols)).toBe(0)
    expect(calColonneSous(900, cols)).toBe(2)
    expect(calColonneSous(250, [])).toBe(-1)
  })
})
