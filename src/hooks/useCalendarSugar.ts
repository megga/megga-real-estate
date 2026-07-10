// MEGGA CRM Sugar v2 — Source de vérité pour CalendarSugarV2Page.
// Assemble les CalEvent affichés par les 4 vues (Day/Week/Month/Agenda) :
//   - Visites (table `visits`) → type='visite'
//   - Reminders actifs (table `reminders`) → type='task'
//
// Hors scope cette PR : mandate (transactions stage='mandate'), notary
// (transactions stage='notary'/'signed'), publish (properties.published_at).
// HOT_BUYERS + AI_INSIGHTS restent câblés sur le mock pour l'instant.

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { CalEvent, CalHotBuyer } from '@/components/crm-sugar/calendar/data'

interface VisitJoin {
  id: string
  scheduled_at: string
  status: string
  buyer_name: string | null
  buyer_phone: string | null
  contact: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  property: { id: string; title: string | null; address: string | null; city: string | null; price: number | null; surface_m2: number | null } | { id: string; title: string | null; address: string | null; city: string | null; price: number | null; surface_m2: number | null }[] | null
}

interface ReminderJoin {
  id: string
  type: string
  trigger_at: string
  message_template: string | null
  contact: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null
  property: { title: string | null; address: string | null } | { title: string | null; address: string | null }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

// Couleur déterministe pour le `property.tone` (CalEvent en a besoin pour
// la bordure latérale dans le mock). On dérive du hash de l'id pour rester
// stable entre re-renders.
function toneFromId(id: string): string {
  const tones = ['#C8B89E', '#B8A89E', '#A8B5BF', '#9EA7B0', '#D4DDE3', '#B5A89E']
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return tones[Math.abs(h) % tones.length]
}

function visitToCalEvent(v: VisitJoin): CalEvent {
  const contact = unwrap(v.contact)
  const property = unwrap(v.property)
  const start = new Date(v.scheduled_at)
  const end = new Date(start.getTime() + 60 * 60 * 1000) // défaut 1h, à raffiner si la table porte une durée
  const contactName = contact
    ? `${contact.first_name} ${contact.last_name}`.trim()
    : v.buyer_name ?? 'Visiteur'
  const propTitle = property?.title || property?.address || 'Bien'
  return {
    id: v.id,
    origin: 'visit',
    type: 'visite',
    title: `Visite — ${contactName}`,
    bienId: property?.id ?? null,
    property: property ? {
      id: property.id,
      title: propTitle,
      area: property.surface_m2 ?? 0,
      price: property.price ?? null,
      tone: toneFromId(property.id),
    } : undefined,
    contact: {
      name: contactName,
      role: 'Acheteur',
      phone: v.buyer_phone ?? undefined,
    },
    location: property ? [property.address, property.city].filter(Boolean).join(', ') : undefined,
    start,
    end,
  }
}

function reminderToCalEvent(r: ReminderJoin): CalEvent {
  const contact = unwrap(r.contact)
  const property = unwrap(r.property)
  const start = new Date(r.trigger_at)
  const end = new Date(start.getTime() + 30 * 60 * 1000) // 30 min de bloc visuel par défaut
  const contactName = contact ? `${contact.first_name} ${contact.last_name}`.trim() : ''
  return {
    id: r.id,
    origin: 'reminder',
    type: 'task',
    title: contactName ? `Relance ${contactName}` : 'Tâche',
    contact: contactName ? { name: contactName, role: 'Contact' } : undefined,
    location: property?.address ?? undefined,
    start,
    end,
    notes: r.message_template ?? undefined,
  }
}

export interface UseCalendarSugarReturn {
  events: CalEvent[]
  hotBuyers: CalHotBuyer[]
  isLoading: boolean
  /** true si l'une des 3 queries (visits/reminders/hotBuyers) a échoué. */
  isError: boolean
  /** relance les 3 queries du calendrier (bouton « Réessayer »). */
  refetch: () => void
}

interface HotBuyerRow {
  id: string
  first_name: string
  last_name: string
  score: 'hot' | 'warm' | 'cold' | null
  last_interaction_at: string | null
}

function initialsOf(first: string, last: string): string {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase() || '??'
}

function relativeDay(iso: string | null): string {
  if (!iso) return '—'
  const diffDays = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return "Aujourd'hui"
  if (diffDays === 1) return 'Hier'
  if (diffDays < 7) return `Il y a ${diffDays} j`
  if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} sem`
  return `Il y a ${Math.floor(diffDays / 30)} mois`
}

// Warm score 0-100 dérivé du score enum + récence d'interaction.
// hot = 90 base, warm = 70 base, cold = 40 base. -1 par jour d'inactivité (plancher 30).
function warmScore(row: HotBuyerRow): number {
  const base = row.score === 'hot' ? 90 : row.score === 'warm' ? 70 : 40
  if (!row.last_interaction_at) return base
  const days = Math.floor((Date.now() - new Date(row.last_interaction_at).getTime()) / (1000 * 60 * 60 * 24))
  return Math.max(30, base - days)
}

export function useCalendarSugar(): UseCalendarSugarReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  // Fenêtre lue : ±60 jours autour d'aujourd'hui pour couvrir les vues
  // jour/semaine/mois sans tout charger.
  const range = useMemo(() => {
    const from = new Date(); from.setDate(from.getDate() - 60)
    const to = new Date(); to.setDate(to.getDate() + 60)
    return { from: from.toISOString(), to: to.toISOString() }
  }, [])

  const { data: visits = [], isLoading: visitsLoading, isError: visitsError, refetch: refetchVisits } = useQuery({
    queryKey: ['calendar-sugar-visits', agencyId, range.from, range.to],
    queryFn: async (): Promise<VisitJoin[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('visits')
        .select('id, scheduled_at, status, buyer_name, buyer_phone, contact:contacts(first_name, last_name), property:properties(id, title, address, city, price, surface_m2)')
        .eq('agency_id', agencyId)
        .gte('scheduled_at', range.from)
        .lte('scheduled_at', range.to)
        .order('scheduled_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as VisitJoin[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const { data: reminders = [], isLoading: remindersLoading, isError: remindersError, refetch: refetchReminders } = useQuery({
    queryKey: ['calendar-sugar-reminders', agencyId, range.from, range.to],
    queryFn: async (): Promise<ReminderJoin[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('reminders')
        .select('id, type, trigger_at, message_template, contact:contacts(first_name, last_name), property:properties(title, address)')
        .eq('agency_id', agencyId)
        .in('status', ['pending', 'triggered', 'snoozed'])
        .gte('trigger_at', range.from)
        .lte('trigger_at', range.to)
        .order('trigger_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as ReminderJoin[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const events = useMemo<CalEvent[]>(() => {
    const out: CalEvent[] = []
    for (const v of visits) out.push(visitToCalEvent(v))
    for (const r of reminders) out.push(reminderToCalEvent(r))
    return out.sort((a, b) => a.start.getTime() - b.start.getTime())
  }, [visits, reminders])

  // Hot buyers : contacts.score IN ('hot','warm') ordonnés par last_interaction_at,
  // top 5 acheteurs chauds (exposés pour d'éventuels consommateurs — Today/mobile).
  const { data: hotBuyerRows = [], isLoading: hotLoading, isError: hotError, refetch: refetchHot } = useQuery({
    queryKey: ['calendar-sugar-hot-buyers', agencyId],
    queryFn: async (): Promise<HotBuyerRow[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, score, last_interaction_at')
        .eq('agency_id', agencyId)
        .in('score', ['hot', 'warm'])
        .order('last_interaction_at', { ascending: false, nullsFirst: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as HotBuyerRow[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const hotBuyers = useMemo<CalHotBuyer[]>(() => {
    return hotBuyerRows.map(c => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`.trim(),
      initials: initialsOf(c.first_name, c.last_name),
      warm: warmScore(c),
      reason: c.score === 'hot' ? 'Lead chaud · suivi prioritaire' : 'Lead tiède · à relancer',
      lastContact: relativeDay(c.last_interaction_at),
      tone: '#0B0C0E',
    }))
  }, [hotBuyerRows])

  return {
    events,
    hotBuyers,
    isLoading: visitsLoading || remindersLoading || hotLoading,
    isError: visitsError || remindersError || hotError,
    refetch: () => {
      void refetchVisits()
      void refetchReminders()
      void refetchHot()
    },
  }
}
