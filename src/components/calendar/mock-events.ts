import { addDays, startOfWeek } from 'date-fns'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

/**
 * MEGGA Real Estate mock events for the calendar.
 * Maps real estate event types to CalendarCN colors:
 *   visit    → blue
 *   meeting  → purple
 *   reminder → orange
 *   signing  → green
 *   deadline → red
 *   personal → gray
 */

const today = new Date()
const weekStart = startOfWeek(today, { weekStartsOn: 1 })

function makeDate(dayOffset: number, hour: number, minute = 0): Date {
  const d = addDays(weekStart, dayOffset)
  d.setHours(hour, minute, 0, 0)
  return d
}

export const MOCK_EVENTS: CalendarEvent[] = [
  // Monday
  {
    id: 'evt-1',
    title: 'Visite — Appt 4p Champel',
    start: makeDate(0, 10, 0),
    end: makeDate(0, 11, 0),
    color: 'blue',
    description: 'Visite avec M. Dupont pour l\'appartement 4 pièces à Champel',
    location: 'Rue de Champel 12, 1206 Genève',
    visitStatus: 'confirmed',
  },
  {
    id: 'evt-2',
    title: 'RDV — Estimation villa Cologny',
    start: makeDate(0, 14, 0),
    end: makeDate(0, 15, 30),
    color: 'purple',
    description: 'Estimation pour Mme Favre, villa avec vue lac',
    location: 'Chemin du Velours 8, 1223 Cologny',
  },

  // Tuesday
  {
    id: 'evt-3',
    title: 'Rappel — Relancer M. Weber',
    start: makeDate(1, 9, 0),
    end: makeDate(1, 9, 30),
    color: 'orange',
    description: 'Relance post-visite, en attente de feedback sur le 3p Eaux-Vives',
  },
  {
    id: 'evt-4',
    title: 'Visite — Studio Plainpalais',
    start: makeDate(1, 11, 0),
    end: makeDate(1, 11, 45),
    color: 'blue',
    location: 'Rue de Carouge 45, 1205 Genève',
    visitStatus: 'done',
    feedbackAgent: 'Client très intéressé, souhaite revoir le bien avec sa femme',
    feedbackBuyer: 'Bel appartement, lumineux, quartier agréable. Prix un peu élevé.',
    rating: 4,
  },
  {
    id: 'evt-5',
    title: 'Réunion équipe',
    start: makeDate(1, 14, 0),
    end: makeDate(1, 15, 0),
    color: 'gray',
    description: 'Point hebdomadaire sur le pipeline',
  },

  // Wednesday
  {
    id: 'evt-6',
    title: 'Signature notaire — Vente Pâquis',
    start: makeDate(2, 10, 0),
    end: makeDate(2, 11, 30),
    color: 'green',
    description: 'Signature acte de vente avec les Müller',
    location: 'Étude Notariale Bonnet, Rue du Rhône 42',
  },
  {
    id: 'evt-7',
    title: 'Visite — 5p Florissant',
    start: makeDate(2, 14, 30),
    end: makeDate(2, 15, 30),
    color: 'blue',
    location: 'Avenue de Florissant 55, 1206 Genève',
  },

  // Thursday
  {
    id: 'evt-8',
    title: 'Deadline KYC — Dossier Petit',
    start: makeDate(3, 9, 0),
    end: makeDate(3, 9, 30),
    color: 'red',
    description: 'Documents KYC manquants — dernier délai',
  },
  {
    id: 'evt-9',
    title: 'Visite — Loft Carouge',
    start: makeDate(3, 11, 0),
    end: makeDate(3, 12, 0),
    color: 'blue',
    description: 'Deuxième visite avec famille Bernard',
    location: 'Rue Jacques-Dalphin 18, 1227 Carouge',
    visitStatus: 'cancelled',
  },
  {
    id: 'evt-10',
    title: 'RDV — Mandat exclusif Servet',
    start: makeDate(3, 15, 0),
    end: makeDate(3, 16, 0),
    color: 'purple',
    description: 'Signature mandat exclusif avec M. Servet',
    location: 'Nos bureaux',
  },

  // Friday
  {
    id: 'evt-11',
    title: 'Rappel — Feedback post-visite Florissant',
    start: makeDate(4, 9, 0),
    end: makeDate(4, 9, 30),
    color: 'orange',
  },
  {
    id: 'evt-12',
    title: 'Visite — Penthouse Champel',
    start: makeDate(4, 10, 30),
    end: makeDate(4, 11, 30),
    color: 'blue',
    description: 'Visite VIP avec investisseur de Zurich',
    location: 'Route de Florissant 80, 1206 Genève',
  },
  {
    id: 'evt-13',
    title: 'Deadline — Offre Müller expire',
    start: makeDate(4, 17, 0),
    end: makeDate(4, 17, 30),
    color: 'red',
    description: 'Offre conditionnelle expire à 17h',
  },

  // All-day event spanning multiple days
  {
    id: 'evt-14',
    title: 'Salon immobilier Genève',
    start: makeDate(3, 0),
    end: makeDate(5, 23, 59),
    isAllDay: true,
    color: 'purple',
    description: 'Stand MEGGA au salon immobilier',
    location: 'Palexpo, Route François-Peyrot 30',
  },
]
