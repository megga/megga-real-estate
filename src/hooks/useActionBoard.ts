import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { formatCHF } from '@/lib/utils'

export type ActionPriority = 'urgent' | 'high' | 'medium' | 'low'
export type ActionCategory = 'urgency' | 'follow_up' | 'match_found' | 'visit_confirm' | 'suggestion'
export type ActionType =
  | 'call'
  | 'email'
  | 'send_property'
  | 'plan_visit'
  | 'review_document'
  | 'view_deal'
  | 'view_list'
  | 'view_analysis'
  | 'relancer'

export interface ActionItem {
  id: string
  category: ActionCategory
  priority: ActionPriority
  title: string
  description: string
  actionLabel: string
  actionType: ActionType
  entityType?: 'contact' | 'deal' | 'property' | 'visit'
  entityId?: string
  isCompleted: boolean
  timestamp: string // relative or absolute time label
  isOverdue?: boolean // > 3 days late
}

// ── DB row types ────────────────────────────────────────────────────────────

interface ReminderRow {
  id: string
  type: string
  status: string
  trigger_at: string
  channel: string
  contact_id: string
  property_id: string | null
  transaction_id: string | null
  match_id: string | null
  contact: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
  property: { title: string; address: string }[] | { title: string; address: string } | null
}

interface NormalizedReminder {
  id: string
  type: string
  status: string
  trigger_at: string
  channel: string
  contact_id: string
  property_id: string | null
  transaction_id: string | null
  match_id: string | null
  contact: { first_name: string; last_name: string } | null
  property: { title: string; address: string } | null
}

interface MatchRow {
  id: string
  score: number
  created_at: string
  contact_id: string
  property_id: string
  contact: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
  property: { title: string; address: string; city: string; price: number }[] | { title: string; address: string; city: string; price: number } | null
}

interface NormalizedMatch {
  id: string
  score: number
  created_at: string
  contact_id: string
  property_id: string
  contact: { first_name: string; last_name: string } | null
  property: { title: string; address: string; city: string; price: number } | null
}

interface VisitRow {
  id: string
  scheduled_at: string
  status: string
  contact_id: string
  property_id: string
  contact: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
  property: { title: string; address: string }[] | { title: string; address: string } | null
}

interface NormalizedVisit {
  id: string
  scheduled_at: string
  status: string
  contact_id: string
  property_id: string
  contact: { first_name: string; last_name: string } | null
  property: { title: string; address: string } | null
}

// ── Normalizers (Supabase joins may return array or object) ────────────────

function normalizeReminder(row: ReminderRow): NormalizedReminder {
  return {
    ...row,
    contact: Array.isArray(row.contact) ? row.contact[0] ?? null : row.contact,
    property: Array.isArray(row.property) ? row.property[0] ?? null : row.property,
  }
}

function normalizeMatch(row: MatchRow): NormalizedMatch {
  return {
    ...row,
    contact: Array.isArray(row.contact) ? row.contact[0] ?? null : row.contact,
    property: Array.isArray(row.property) ? row.property[0] ?? null : row.property,
  }
}

function normalizeVisit(row: VisitRow): NormalizedVisit {
  return {
    ...row,
    contact: Array.isArray(row.contact) ? row.contact[0] ?? null : row.contact,
    property: Array.isArray(row.property) ? row.property[0] ?? null : row.property,
  }
}

// ── Converters: DB → ActionItem ────────────────────────────────────────────

function formatRelativeTimestamp(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 0) {
    const absDays = Math.abs(days)
    if (absDays === 0) return "aujourd'hui"
    if (absDays === 1) return 'demain'
    return `dans ${absDays} jours`
  }
  if (days === 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  return `il y a ${days} jours`
}

function reminderToAction(rem: NormalizedReminder): ActionItem {
  const contactName = rem.contact
    ? `${rem.contact.first_name} ${rem.contact.last_name}`
    : 'Contact'
  const propertyInfo = rem.property?.title || rem.property?.address || ''
  const isOverdue = new Date(rem.trigger_at) < new Date()

  let category: ActionCategory = 'follow_up'
  let priority: ActionPriority = 'high'
  let title = ''
  let description = ''
  let actionLabel = 'Traiter'
  let actionType: ActionType = 'email'

  switch (rem.type) {
    case 'follow_up_sent_property':
      category = isOverdue && rem.status === 'triggered' ? 'urgency' : 'follow_up'
      priority = isOverdue ? 'urgent' : 'high'
      title = `Relancer ${contactName}`
      description = propertyInfo
        ? `Bien envoyé sans réponse (${propertyInfo}).`
        : "Pas de retour depuis l'envoi."
      actionLabel = 'Relancer'
      actionType = rem.channel === 'notification' ? 'call' : 'email'
      break
    case 'post_visit_feedback':
      category = 'follow_up'
      priority = 'high'
      title = `Feedback visite — ${contactName}`
      description = propertyInfo
        ? `Visite effectuée (${propertyInfo}). Feedback non recueilli.`
        : 'Feedback visite non recueilli.'
      actionLabel = 'Demander le feedback'
      actionType = 'email'
      break
    case 'dormant_lead':
      category = isOverdue ? 'urgency' : 'follow_up'
      priority = isOverdue ? 'high' : 'medium'
      title = `Lead dormant — ${contactName}`
      description = 'Aucune interaction depuis plus de 30 jours.'
      actionLabel = 'Relancer'
      actionType = 'send_property'
      break
    case 'missing_document':
      category = 'urgency'
      priority = 'urgent'
      title = `Document manquant — ${contactName}`
      description = 'Dossier KYC incomplet.'
      actionLabel = 'Voir le dossier'
      actionType = 'review_document'
      break
    case 'custom':
      category = 'follow_up'
      priority = 'medium'
      title = `Suivi vendeur — ${contactName}`
      description = 'Vendeur sans suivi récent.'
      actionLabel = 'Contacter'
      actionType = 'call'
      break
    default:
      title = `Relance — ${contactName}`
      description = rem.type
  }

  return {
    id: `rem-${rem.id}`,
    category,
    priority,
    title,
    description,
    actionLabel,
    actionType,
    entityType: rem.transaction_id ? 'deal' : 'contact',
    entityId: rem.transaction_id || rem.contact_id,
    isCompleted: false,
    timestamp: formatRelativeTimestamp(rem.trigger_at),
    isOverdue,
  }
}

function matchToAction(match: NormalizedMatch): ActionItem {
  const contactName = match.contact
    ? `${match.contact.first_name} ${match.contact.last_name}`
    : 'Contact'
  const propertyInfo = match.property
    ? `${match.property.title || match.property.address}, ${match.property.city}`
    : 'Bien'
  const priceStr = match.property ? formatCHF(match.property.price) : ''

  const createdDate = new Date(match.created_at)
  const diffHours = Math.round((Date.now() - createdDate.getTime()) / (1000 * 60 * 60))
  const timestamp = diffHours < 1
    ? "à l'instant"
    : diffHours < 24
      ? `il y a ${diffHours}h`
      : `il y a ${Math.round(diffHours / 24)}j`

  return {
    id: `match-${match.id}`,
    category: 'match_found',
    priority: 'medium',
    title: `Nouveau match — ${contactName}`,
    description: `${propertyInfo}, ${priceStr}, ${match.score}% compatible.`,
    actionLabel: 'Envoyer le bien',
    actionType: 'send_property',
    entityType: 'contact',
    entityId: match.contact_id,
    isCompleted: false,
    timestamp,
  }
}

function visitToAction(visit: NormalizedVisit): ActionItem {
  const contactName = visit.contact
    ? `${visit.contact.first_name} ${visit.contact.last_name}`
    : 'Contact'
  const propertyInfo = visit.property?.title || visit.property?.address || 'Bien'
  const time = new Date(visit.scheduled_at)
  const timeStr = `${time.getHours().toString().padStart(2, '0')}h${time.getMinutes().toString().padStart(2, '0')}`

  return {
    id: `visit-${visit.id}`,
    category: 'visit_confirm',
    priority: 'medium',
    title: `${visit.status === 'planned' ? 'Confirmer' : 'Préparer'} visite — ${contactName}`,
    description: `${propertyInfo}, aujourd'hui à ${timeStr}.`,
    actionLabel: visit.status === 'planned' ? 'Confirmer' : 'Voir le dossier',
    actionType: visit.status === 'planned' ? 'call' : 'review_document',
    entityType: 'visit',
    entityId: visit.id,
    isCompleted: false,
    timestamp: `aujourd'hui ${timeStr}`,
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useActionBoard() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const queryClient = useQueryClient()

  // ── Reminders: urgencies + follow-ups ──
  const remindersQuery = useQuery({
    queryKey: ['action-board', 'reminders', agencyId],
    queryFn: async () => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('reminders')
        .select('id, type, status, trigger_at, channel, contact_id, property_id, transaction_id, match_id, contact:contacts(first_name, last_name), property:properties(title, address)')
        .eq('agency_id', agencyId)
        .in('status', ['pending', 'triggered'])
        .order('trigger_at', { ascending: true })
        .limit(50)

      if (error) throw error
      return ((data || []) as ReminderRow[]).map(normalizeReminder)
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  // ── Recent matches (suggested, last 48h) ──
  const matchesQuery = useQuery({
    queryKey: ['action-board', 'matches', agencyId],
    queryFn: async () => {
      if (!agencyId) return []
      const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

      const { data, error } = await supabase
        .from('matches')
        .select('id, score, created_at, contact_id, property_id, contact:contacts(first_name, last_name), property:properties(title, address, city, price)')
        .eq('agency_id', agencyId)
        .eq('status', 'suggested')
        .gte('created_at', twoDaysAgo)
        .order('score', { ascending: false })
        .limit(20)

      if (error) throw error
      return ((data || []) as MatchRow[]).map(normalizeMatch)
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  // ── Today's visits ──
  const visitsQuery = useQuery({
    queryKey: ['action-board', 'visits', agencyId],
    queryFn: async () => {
      if (!agencyId) return []
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const { data, error } = await supabase
        .from('visits')
        .select('id, scheduled_at, status, contact_id, property_id, contact:contacts(first_name, last_name), property:properties(title, address)')
        .eq('agency_id', agencyId)
        .in('status', ['planned', 'confirmed'])
        .gte('scheduled_at', todayStart.toISOString())
        .lte('scheduled_at', todayEnd.toISOString())
        .order('scheduled_at', { ascending: true })

      if (error) throw error
      return ((data || []) as VisitRow[]).map(normalizeVisit)
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  // ── Combine all into ActionItems ──
  const allActions = useMemo(() => {
    const items: ActionItem[] = []

    for (const rem of remindersQuery.data || []) {
      items.push(reminderToAction(rem))
    }
    for (const match of matchesQuery.data || []) {
      items.push(matchToAction(match))
    }
    for (const visit of visitsQuery.data || []) {
      items.push(visitToAction(visit))
    }

    return items
  }, [remindersQuery.data, matchesQuery.data, visitsQuery.data])

  // ── Categorize ──
  const pending = useMemo(() => allActions.filter((a) => !a.isCompleted), [allActions])

  const byCategory = useMemo(() => ({
    urgencies: pending.filter((a) => a.category === 'urgency'),
    followUps: pending.filter((a) => a.category === 'follow_up'),
    matches: pending.filter((a) => a.category === 'match_found'),
    visits: pending.filter((a) => a.category === 'visit_confirm'),
    suggestions: pending.filter((a) => a.category === 'suggestion'),
  }), [pending])

  const totalPending = pending.length

  // ── Mutations ──
  const completeReminderMutation = useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', reminderId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-board', 'reminders'] })
    },
  })

  const snoozeReminderMutation = useMutation({
    mutationFn: async ({ reminderId, days }: { reminderId: string; days: number }) => {
      // Fetch current trigger_at, then add days
      const { data: current, error: fetchErr } = await supabase
        .from('reminders')
        .select('trigger_at')
        .eq('id', reminderId)
        .single()

      if (fetchErr || !current) throw fetchErr || new Error('Reminder not found')

      const newTrigger = new Date(current.trigger_at)
      newTrigger.setDate(newTrigger.getDate() + days)

      const { error } = await supabase
        .from('reminders')
        .update({ status: 'snoozed', trigger_at: newTrigger.toISOString() })
        .eq('id', reminderId)

      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-board', 'reminders'] })
    },
  })

  const markAsCompleted = useCallback((actionId: string) => {
    if (actionId.startsWith('rem-')) {
      completeReminderMutation.mutate(actionId.replace('rem-', ''))
    }
    // Matches and visits are acted upon through their respective pages
  }, [completeReminderMutation])

  const snoozeReminder = useCallback((actionId: string, days = 3) => {
    if (actionId.startsWith('rem-')) {
      snoozeReminderMutation.mutate({ reminderId: actionId.replace('rem-', ''), days })
    }
  }, [snoozeReminderMutation])

  const isLoading = remindersQuery.isLoading || matchesQuery.isLoading || visitsQuery.isLoading

  return {
    actions: pending,
    byCategory,
    totalPending,
    markAsCompleted,
    snoozeReminder,
    isLoading,
  }
}
