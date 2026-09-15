// Les événements d'une journée vus du serveur : ponctuels et séries, en heure de Zurich.
import { describe, it, expect } from 'vitest'
import { filtreEvenementsDuJour, occurrencesDuJour, type EvenementServeur } from './calendar-events.ts'

// Mardi 15.09.2026 à Zurich (UTC+2) : [14.09 22:00Z, 15.09 22:00Z).
const DEBUT = '2026-09-14T22:00:00.000Z'
const FIN = '2026-09-15T22:00:00.000Z'
const ev = (o: Partial<EvenementServeur> & { id?: string }): EvenementServeur & { id: string } => ({
  id: 'e', type: 'notary', starts_at: '2026-09-15T12:00:00.000Z', status: null, recurrence: null, ...o,
})
const ids = (l: Array<{ id: string }>) => l.map((e) => e.id)

describe('occurrencesDuJour — ponctuels', () => {
  it('garde ce qui commence dans la journée, trié ; écarte la veille, le lendemain et les clos', () => {
    const r = occurrencesDuJour([
      ev({ id: 'apres-midi', starts_at: '2026-09-15T12:00:00.000Z' }),
      ev({ id: 'matin', starts_at: '2026-09-15T06:30:00.000Z' }),
      ev({ id: 'veille', starts_at: '2026-09-14T21:59:00.000Z' }),
      ev({ id: 'lendemain', starts_at: '2026-09-15T22:00:00.000Z' }),
      ev({ id: 'fait', status: 'done' }),
      ev({ id: 'annule', status: 'cancelled' }),
    ], DEBUT, FIN)
    expect(ids(r)).toEqual(['matin', 'apres-midi'])
    expect(r[0].debut).toBe('2026-09-15T06:30:00.000Z')
  })
})

describe('occurrencesDuJour — séries', () => {
  // Née le mardi 01.09.2026 à 09:30 heure de Zurich.
  const NEE = '2026-09-01T07:30:00.000Z'
  it('hebdomadaire : un mardi sur deux pour la bimensuelle, chaque jour pour la quotidienne', () => {
    const r = occurrencesDuJour([
      ev({ id: 'hebdo', starts_at: NEE, recurrence: { freq: 'weekly' } }),
      ev({ id: 'bimensuelle', starts_at: NEE, recurrence: { freq: 'biweekly' } }),
      ev({ id: 'quinzaine-decalee', starts_at: '2026-09-08T07:30:00.000Z', recurrence: { freq: 'biweekly' } }),
      ev({ id: 'quotidienne', starts_at: NEE, recurrence: { freq: 'daily' } }),
      ev({ id: 'mercredi', starts_at: '2026-09-02T07:30:00.000Z', recurrence: { freq: 'weekly' } }),
    ], DEBUT, FIN)
    expect(ids(r).sort()).toEqual(['bimensuelle', 'hebdo', 'quotidienne'])
    // L'heure MURALE est gardée : 09:30 à Zurich.
    expect(new Set(r.map((e) => e.debut))).toEqual(new Set(['2026-09-15T07:30:00.000Z']))
  })

  it('mensuelle : ancrée sur le jour du mois, bornée au mois', () => {
    const r = occurrencesDuJour([ev({ id: 'le-15', starts_at: '2026-08-15T07:30:00.000Z', recurrence: { freq: 'monthly' } })], DEBUT, FIN)
    expect(ids(r)).toEqual(['le-15'])
    // Née un 31 : en février, elle tombe le 28.
    const fev = occurrencesDuJour([ev({ id: 'le-31', starts_at: '2026-01-31T08:30:00.000Z', recurrence: { freq: 'monthly' } })],
      '2026-02-27T23:00:00.000Z', '2026-02-28T23:00:00.000Z')
    expect(ids(fev)).toEqual(['le-31'])
    expect(fev[0].debut).toBe('2026-02-28T08:30:00.000Z')
  })

  it('l’heure d’été se traverse : 09:30 à Zurich reste 09:30, en hiver comme en été', () => {
    const hiver = occurrencesDuJour([ev({ id: 'h', starts_at: NEE, recurrence: { freq: 'weekly' } })],
      '2026-12-14T23:00:00.000Z', '2026-12-15T23:00:00.000Z')
    expect(hiver[0].debut).toBe('2026-12-15T08:30:00.000Z')
  })

  it('une occurrence retirée, close à elle seule, avant la naissance ou après la fin n’y figure pas', () => {
    const r = occurrencesDuJour([
      ev({ id: 'retiree', starts_at: NEE, recurrence: { freq: 'weekly', sauf: ['2026-9-15'] } }),
      ev({ id: 'faite', starts_at: NEE, recurrence: { freq: 'weekly', etats: { '2026-9-15': 'done' } } }),
      ev({ id: 'autre-faite', starts_at: NEE, recurrence: { freq: 'weekly', etats: { '2026-9-8': 'done' } } }),
      ev({ id: 'finie', starts_at: NEE, recurrence: { freq: 'weekly', until: '2026-09-10T00:00:00.000Z' } }),
      ev({ id: 'pas-nee', starts_at: '2026-09-22T07:30:00.000Z', recurrence: { freq: 'weekly' } }),
      ev({ id: 'serie-close', starts_at: NEE, status: 'cancelled', recurrence: { freq: 'weekly' } }),
    ], DEBUT, FIN)
    expect(ids(r)).toEqual(['autre-faite'])
  })

  it('une journée UTC (le copilote) touche deux jours de Zurich, sans doublon', () => {
    const r = occurrencesDuJour([ev({ id: 'quotidienne-tard', starts_at: '2026-09-01T21:30:00.000Z', recurrence: { freq: 'daily' } })],
      '2026-09-15T00:00:00.000Z', '2026-09-15T23:59:59.999Z')
    // 23:30 à Zurich le 15 = 21:30Z ; celle du 14 (21:30Z le 14) est hors fenêtre.
    expect(r.map((e) => e.debut)).toEqual(['2026-09-15T21:30:00.000Z'])
  })
})

describe('filtreEvenementsDuJour', () => {
  it('les ponctuels de la journée, et les séries nées avant sa fin', () => {
    expect(filtreEvenementsDuJour(DEBUT, FIN)).toBe(
      `and(starts_at.gte.${DEBUT},starts_at.lt.${FIN}),and(recurrence.not.is.null,starts_at.lt.${FIN})`)
  })
})
