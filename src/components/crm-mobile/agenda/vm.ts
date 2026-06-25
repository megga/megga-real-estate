// Agenda mobile — view-model + helpers + démo.
//
// Le calendrier réel (`useCalendarSugar`) ne produit que deux types d'events :
// `visite` (table `visits`) et `task` (table `reminders`). On projette les
// `CalEvent` en `AgEventVM` (présentation pure) ; aucune donnée fabriquée.

import type { TFunction } from 'i18next'
import type { CalEvent } from '@/components/crm-sugar/calendar/data'

export type AgEventType = 'visite' | 'task'

export interface AgEventVM {
  id: string
  type: AgEventType
  title: string
  start: Date
  end: Date
  /** minutes depuis minuit (positionnement grille time-block) */
  startMin: number
  durMin: number
  contactName: string | null
  phone: string | null
  location: string | null
  propertyId: string | null
  propertyTitle: string | null
  propertyPrice: number | null
  note: string | null
}

// Couleurs fonctionnelles (pastilles data-only — jamais l'accent UI), clair/sombre.
export const AG_TONE: Record<AgEventType, { light: string; dark: string }> = {
  visite: { light: '#0E7490', dark: '#5FBFD4' },
  task: { light: '#5B6CFF', dark: '#8E9BFF' },
}
export const agTone = (type: AgEventType, isDark: boolean): string =>
  AG_TONE[type][isDark ? 'dark' : 'light']
export const agIcon = (type: AgEventType): 'home' | 'clock' => (type === 'visite' ? 'home' : 'clock')

// ─── format ────────────────────────────────────────────────────────────────
const pad2 = (n: number): string => String(n).padStart(2, '0')
export const fmtTime = (d: Date): string => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
export const minutesOf = (d: Date): number => d.getHours() * 60 + d.getMinutes()
export const sameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** « 45 min » · « 1 h » · « 1 h 30 » (i18n) */
export function fmtDur(min: number, t: TFunction): string {
  if (min < 60) return t('mobile.durMin', { count: min })
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? t('mobile.durH', { count: h }) : t('mobile.durHM', { h, m })
}

// ─── mapper réel ─────────────────────────────────────────────────────────────
export function calEventToVM(e: CalEvent): AgEventVM {
  const type: AgEventType = e.type === 'visite' ? 'visite' : 'task'
  const durMin = Math.max(0, Math.round((e.end.getTime() - e.start.getTime()) / 60000))
  return {
    id: e.id,
    type,
    title: e.title,
    start: e.start,
    end: e.end,
    startMin: minutesOf(e.start),
    durMin,
    contactName: e.contact?.name ?? null,
    phone: e.contact?.phone ?? null,
    location: e.location ?? null,
    propertyId: e.property?.id ?? null,
    propertyTitle: e.property?.title ?? null,
    propertyPrice: e.property?.price ?? null,
    note: e.notes ?? null,
  }
}

// ─── démo (harnais /dev/mobile, no-auth) ───────────────────────────────────
// Personas fictifs, journée d'aujourd'hui — aucune écriture en mode démo.
export function demoEvents(): AgEventVM[] {
  const at = (h: number, m: number): Date => {
    const d = new Date()
    d.setHours(h, m, 0, 0)
    return d
  }
  const mk = (
    id: string,
    type: AgEventType,
    title: string,
    sh: number,
    sm: number,
    durMin: number,
    rest: Partial<AgEventVM>,
  ): AgEventVM => {
    const start = at(sh, sm)
    const end = new Date(start.getTime() + durMin * 60000)
    return {
      id, type, title, start, end, startMin: minutesOf(start), durMin,
      contactName: null, phone: null, location: null,
      propertyId: null, propertyTitle: null, propertyPrice: null, note: null,
      ...rest,
    }
  }
  return [
    mk('e1', 'task', 'Relance Pierre Vionnet', 9, 30, 30, { contactName: 'Pierre Vionnet', phone: '+41 79 000 00 00', note: '3 nouveaux matchs à présenter.' }),
    mk('e2', 'visite', 'Visite — Marie Bertrand', 11, 0, 45, { contactName: 'Marie Bertrand', phone: '+41 79 111 11 11', location: 'Rue Ancienne 12, Carouge', propertyId: 'p1', propertyTitle: '5 pièces familial · Carouge', propertyPrice: 1100000 }),
    mk('e3', 'task', 'KYC Élodie Schmidt', 14, 0, 30, { contactName: 'Élodie Schmidt' }),
    mk('e4', 'visite', 'Visite — Antoine Picard', 16, 30, 60, { contactName: 'Antoine Picard', phone: '+41 79 222 22 22', location: 'Route de la Capite, Cologny', propertyId: 'p4', propertyTitle: 'Villa contemporaine · Cologny', propertyPrice: 3850000 }),
  ]
}
