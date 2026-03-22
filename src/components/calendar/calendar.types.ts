import { Eye, User, Phone, AlertTriangle, Star } from 'lucide-react'

export const EVENT_TYPES = ['visit', 'meeting', 'reminder', 'deadline', 'estimation'] as const
export type EventType = typeof EVENT_TYPES[number]

export interface CalendarEvent {
  id: string
  type: EventType
  title: string
  date: Date
  endDate: Date
  contact?: string
  property?: string
  address?: string
  notes?: string
}

export type ViewMode = 'month' | 'week' | 'day'

export const VIEW_LABELS: Record<ViewMode, string> = {
  month: 'Mois',
  week: 'Semaine',
  day: 'Jour',
}

export const EVENT_CONFIG: Record<EventType, { label: string; color: string; bg: string; dot: string; icon: React.ElementType }> = {
  visit:      { label: 'Visite',      color: 'text-accent',      bg: 'bg-accent/10 border-accent/30',       dot: 'bg-accent',      icon: Eye },
  meeting:    { label: 'RDV client',  color: 'text-success',     bg: 'bg-success/10 border-success/30',     dot: 'bg-success',     icon: User },
  reminder:   { label: 'Rappel',      color: 'text-warning',     bg: 'bg-warning/10 border-warning/30',     dot: 'bg-warning',     icon: Phone },
  deadline:   { label: 'Deadline',    color: 'text-danger',      bg: 'bg-danger/10 border-danger/30',       dot: 'bg-danger',      icon: AlertTriangle },
  estimation: { label: 'Estimation',  color: 'text-purple-600',  bg: 'bg-purple-50 border-purple-300/30',   dot: 'bg-purple-500',  icon: Star },
}

export const HOURS = Array.from({ length: 13 }, (_, i) => i + 8) // 8h-20h
