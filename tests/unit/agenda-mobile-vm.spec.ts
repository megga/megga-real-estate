/**
 * L'agenda mobile ne présente en « visite » — la seule qui s'ouvre sur une fiche — qu'une
 * ligne de `visits` (revue du 15.09.2026).
 */
import { describe, it, expect } from 'vitest'
import { calEventToVM } from '@/components/crm-mobile/agenda/vm'
import type { CalEvent } from '@/components/crm/calendar/data'

const ev = (o: Partial<CalEvent>): CalEvent => ({
  id: 'e1', type: 'visite', title: 'Visite', start: new Date('2026-09-18T10:00:00Z'), end: new Date('2026-09-18T11:00:00Z'), ...o,
})

describe('calEventToVM — la visite se lit à la table, pas au type', () => {
  it('une visite (table `visits`) s’ouvre sur sa fiche', () => {
    expect(calEventToVM(ev({ origin: 'visit' })).type).toBe('visite')
  })
  it('un événement de type « Visite » n’est pas une visite : pas de fiche à ouvrir', () => {
    expect(calEventToVM(ev({ origin: 'event' })).type).toBe('task')
    expect(calEventToVM(ev({ origin: 'reminder', type: 'task' })).type).toBe('task')
  })
})
