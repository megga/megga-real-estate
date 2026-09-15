/**
 * Les événements du Calendrier (15.09.2026) — la partie pure : ce qu'on écrit en base, ce
 * qu'on relit d'une tâche.
 */
import { describe, it, expect } from 'vitest'
import { titreDeRelance, versLigneEvenement } from '@/lib/calendrierEvenements'
import type { CalEvent } from '@/components/crm/calendar/data'

const ev = (o: Partial<CalEvent> = {}): CalEvent => ({
  id: 'e1', type: 'notary', title: 'Signature', start: new Date('2026-09-18T12:00:00Z'), end: new Date('2026-09-18T13:30:00Z'), ...o,
})

describe('versLigneEvenement — ce que le calendrier écrit', () => {
  it('garde l’événement TEL QU’ON L’A SAISI : titre, début, fin, type, journée, récurrence, liens', () => {
    const l = versLigneEvenement(ev({ allDay: true, location: ' Étude ', notes: ' RDV ', recurrence: { freq: 'weekly' }, contactId: 'c1', bienId: 'p1', mailThreadId: 't1' }))
    expect(l).toEqual({
      type: 'notary', title: 'Signature', starts_at: '2026-09-18T12:00:00.000Z', ends_at: '2026-09-18T13:30:00.000Z',
      all_day: true, location: 'Étude', notes: 'RDV', color: null, recurrence: { freq: 'weekly' }, status: null,
      contact_id: 'c1', property_id: 'p1', mail_thread_id: 't1',
    })
  })
  it('respecte les bornes de la table : fin jamais avant le début, couleur réservée à « autre », 200 caractères', () => {
    expect(versLigneEvenement(ev({ end: new Date('2026-09-18T11:00:00Z') })).ends_at).toBe('2026-09-18T12:00:00.000Z')
    expect(versLigneEvenement(ev({ color: '#112233' })).color).toBeNull()
    expect(versLigneEvenement(ev({ type: 'autre', color: '#112233' })).color).toBe('#112233')
    expect(versLigneEvenement(ev({ type: 'autre', color: 'rouge' })).color).toBeNull()
    expect(versLigneEvenement(ev({ title: 'x'.repeat(250) })).title).toHaveLength(200)
  })
})

describe('titreDeRelance — le titre d’une tâche relu', () => {
  it('« [Titre] notes » rend le titre et les notes', () => {
    expect(titreDeRelance('[Appeler la banque] dossier Champel')).toEqual({ titre: 'Appeler la banque', reste: 'dossier Champel' })
    expect(titreDeRelance('[Appeler la banque]')).toEqual({ titre: 'Appeler la banque', reste: null })
  })
  it('un message du système, sans crochets, reste tel quel', () => {
    expect(titreDeRelance('Bonjour, pensez au dossier')).toEqual({ titre: null, reste: 'Bonjour, pensez au dossier' })
    expect(titreDeRelance(null)).toEqual({ titre: null, reste: null })
  })
})
