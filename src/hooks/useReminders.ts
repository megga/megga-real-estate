import { useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export type ReminderType = 'follow_up_sent_property' | 'post_visit_feedback' | 'dormant_lead' | 'missing_document' | 'price_change' | 'custom'
export type ReminderStatus = 'pending' | 'triggered' | 'done' | 'cancelled' | 'snoozed'
export type ReminderChannel = 'email' | 'task' | 'notification'

export interface Reminder {
  id: string
  contactName: string
  contactId: string
  type: ReminderType
  status: ReminderStatus
  title: string
  description: string
  channel: ReminderChannel
  triggerAt: string
  createdAt: string
  completedAt: string | null
  propertyTitle?: string
}

export interface AutomationRule {
  id: string
  name: string
  triggerEvent: string
  triggerLabel: string
  action: string
  actionLabel: string
  delayDays: number
  templateId: string | null
  isActive: boolean
  autoSend: boolean
  generatedCount: number
  activeCount: number
  lastTriggeredAt: string | null
}

export interface MessageTemplate {
  id: string
  name: string
  category: string
  channel: 'email' | 'notification'
  subject: string | null
  body: string
}

// ── Label mappings ─────────────────────────────────────────────────────────

const TRIGGER_LABELS: Record<string, string> = {
  property_sent: 'Quand un bien est envoyé à un client',
  visit_completed: 'Quand une visite est effectuée',
  lead_inactive: 'Quand un lead est inactif',
  document_missing: 'Quand un document KYC est manquant',
  new_match: 'Quand un nouveau match est trouvé',
}

const ACTION_LABELS: Record<string, string> = {
  create_reminder: "Créer un rappel pour l'agent",
  send_email: 'Envoyer un email au client',
  send_whatsapp: 'Envoyer un WhatsApp au client',
  notify_agent: 'Notification agent',
  create_task: 'Créer une tâche',
}

const REMINDER_TYPE_TITLES: Record<string, string> = {
  follow_up_sent_property: 'Relance envoi de bien',
  post_visit_feedback: 'Feedback post-visite',
  dormant_lead: 'Lead dormant',
  missing_document: 'Document manquant',
  price_change: 'Changement de prix',
  custom: 'Relance personnalisée',
}

// ── DB row types ───────────────────────────────────────────────────────────

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
  message_template: string | null
  created_at: string
  completed_at: string | null
  contact: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
  property: { title: string; address: string }[] | { title: string; address: string } | null
}

interface RuleRow {
  id: string
  name: string
  trigger_event: string
  action: string
  delay_days: number
  template_id: string | null
  is_active: boolean
  created_at: string
}

interface TemplateRow {
  id: string
  name: string
  category: string
  channel: string
  subject: string | null
  body: string
}

// ── Row converters ─────────────────────────────────────────────────────────

function rowToReminder(row: ReminderRow): Reminder {
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
  const property = Array.isArray(row.property) ? row.property[0] : row.property
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Contact'
  const propertyTitle = property?.title || property?.address || undefined

  const typeTitle = REMINDER_TYPE_TITLES[row.type] || row.type
  const title = `${typeTitle} — ${contactName}`
  const description = propertyTitle
    ? `${typeTitle} (${propertyTitle}).`
    : typeTitle

  return {
    id: row.id,
    contactName,
    contactId: row.contact_id,
    type: row.type as ReminderType,
    status: row.status as ReminderStatus,
    title,
    description,
    channel: (row.channel || 'email') as ReminderChannel,
    triggerAt: row.trigger_at,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    propertyTitle,
  }
}

function rowToRule(row: RuleRow, generatedCount: number, activeCount: number, lastTriggeredAt: string | null): AutomationRule {
  return {
    id: row.id,
    name: row.name,
    triggerEvent: row.trigger_event,
    triggerLabel: TRIGGER_LABELS[row.trigger_event] || row.trigger_event,
    action: row.action,
    actionLabel: ACTION_LABELS[row.action] || row.action,
    delayDays: row.delay_days,
    templateId: row.template_id,
    isActive: row.is_active,
    autoSend: false, // auto_send column not yet in schema — default off
    generatedCount,
    activeCount,
    lastTriggeredAt,
  }
}

function rowToTemplate(row: TemplateRow): MessageTemplate {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    channel: (row.channel === 'whatsapp' ? 'email' : row.channel) as 'email' | 'notification',
    subject: row.subject,
    body: row.body,
  }
}

// ── Hooks ──────────────────────────────────────────────────────────────────

export function useReminders() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const queryClient = useQueryClient()

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders', agencyId],
    queryFn: async () => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('reminders')
        .select('id, type, status, trigger_at, channel, contact_id, property_id, transaction_id, match_id, message_template, created_at, completed_at, contact:contacts(first_name, last_name), property:properties(title, address)')
        .eq('agency_id', agencyId)
        .in('status', ['pending', 'triggered', 'snoozed'])
        .order('trigger_at', { ascending: true })
        .limit(100)

      if (error) throw error
      return ((data || []) as ReminderRow[]).map(rowToReminder)
    },
    enabled: !!agencyId,
    staleTime: 30_000,
  })

  const markAsDoneMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'done', completed_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['action-board', 'reminders'] })
    },
  })

  const snoozeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: current, error: fetchErr } = await supabase
        .from('reminders')
        .select('trigger_at')
        .eq('id', id)
        .single()

      if (fetchErr || !current) throw fetchErr || new Error('Reminder not found')

      const newTrigger = new Date(current.trigger_at)
      newTrigger.setDate(newTrigger.getDate() + 3)

      const { error } = await supabase
        .from('reminders')
        .update({ status: 'snoozed', trigger_at: newTrigger.toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['action-board', 'reminders'] })
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reminders')
        .update({ status: 'cancelled' })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
      queryClient.invalidateQueries({ queryKey: ['action-board', 'reminders'] })
    },
  })

  const markAsDone = useCallback((id: string) => markAsDoneMutation.mutate(id), [markAsDoneMutation])
  const snooze = useCallback((id: string) => snoozeMutation.mutate(id), [snoozeMutation])
  const cancel = useCallback((id: string) => cancelMutation.mutate(id), [cancelMutation])

  const active = useMemo(() => reminders.filter((r) => r.status === 'pending' || r.status === 'triggered'), [reminders])
  const triggered = useMemo(() => reminders.filter((r) => r.status === 'triggered'), [reminders])
  const pending = useMemo(() => reminders.filter((r) => r.status === 'pending'), [reminders])

  return { reminders, active, triggered, pending, markAsDone, snooze, cancel, isLoading }
}

export function useAutomationRules() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const queryClient = useQueryClient()

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['automation-rules', agencyId],
    queryFn: async () => {
      if (!agencyId) return []

      const { data: rulesData, error: rulesErr } = await supabase
        .from('automation_rules')
        .select('id, name, trigger_event, action, delay_days, template_id, is_active, created_at')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })

      if (rulesErr) throw rulesErr

      // For each rule, count generated + active reminders
      const results: AutomationRule[] = []
      for (const row of rulesData || []) {
        // Count reminders generated by this rule type
        const { count: generatedCount } = await supabase
          .from('reminders')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('type', mapTriggerToReminderType(row.trigger_event))

        const { count: activeCount } = await supabase
          .from('reminders')
          .select('id', { count: 'exact', head: true })
          .eq('agency_id', agencyId)
          .eq('type', mapTriggerToReminderType(row.trigger_event))
          .in('status', ['pending', 'triggered'])

        // Get last triggered
        const { data: lastReminder } = await supabase
          .from('reminders')
          .select('created_at')
          .eq('agency_id', agencyId)
          .eq('type', mapTriggerToReminderType(row.trigger_event))
          .order('created_at', { ascending: false })
          .limit(1)

        results.push(rowToRule(
          row as RuleRow,
          generatedCount || 0,
          activeCount || 0,
          lastReminder?.[0]?.created_at || null,
        ))
      }

      return results
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const toggleRuleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('automation_rules')
        .update({ is_active: !isActive })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
    },
  })

  const addRuleMutation = useMutation({
    mutationFn: async (rule: Omit<AutomationRule, 'id' | 'generatedCount' | 'activeCount' | 'lastTriggeredAt'>) => {
      if (!agencyId) throw new Error('No agency')
      const { error } = await supabase
        .from('automation_rules')
        .insert({
          agency_id: agencyId,
          name: rule.name,
          trigger_event: rule.triggerEvent,
          action: rule.action,
          delay_days: rule.delayDays,
          template_id: rule.templateId,
          is_active: rule.isActive,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
    },
  })

  const duplicateRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!agencyId) throw new Error('No agency')
      const source = rules.find((r) => r.id === id)
      if (!source) return
      const { error } = await supabase
        .from('automation_rules')
        .insert({
          agency_id: agencyId,
          name: `${source.name} (copie)`,
          trigger_event: source.triggerEvent,
          action: source.action,
          delay_days: source.delayDays,
          template_id: source.templateId,
          is_active: false,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
    },
  })

  const toggleRule = useCallback((id: string) => {
    const rule = rules.find((r) => r.id === id)
    if (rule) toggleRuleMutation.mutate({ id, isActive: rule.isActive })
  }, [rules, toggleRuleMutation])

  // autoSend not yet persisted (no column in DB) — keep as no-op
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const toggleAutoSend = useCallback((_id: string) => {
    // Future: UPDATE automation_rules SET auto_send = NOT auto_send WHERE id = _id
  }, [])

  const addRule = useCallback(
    (rule: Omit<AutomationRule, 'id' | 'generatedCount' | 'activeCount' | 'lastTriggeredAt'>) =>
      addRuleMutation.mutate(rule),
    [addRuleMutation]
  )

  const deleteRule = useCallback((id: string) => deleteRuleMutation.mutate(id), [deleteRuleMutation])
  const duplicateRule = useCallback((id: string) => duplicateRuleMutation.mutate(id), [duplicateRuleMutation])

  return { rules, toggleRule, toggleAutoSend, addRule, deleteRule, duplicateRule, isLoading }
}

export function useMessageTemplates() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const queryClient = useQueryClient()

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['message-templates', agencyId],
    queryFn: async () => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('message_templates')
        .select('id, name, category, channel, subject, body')
        .eq('agency_id', agencyId)
        .order('created_at', { ascending: false })

      if (error) throw error
      return ((data || []) as TemplateRow[]).map(rowToTemplate)
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const addTemplateMutation = useMutation({
    mutationFn: async (template: Omit<MessageTemplate, 'id'>) => {
      if (!agencyId) throw new Error('No agency')
      const { error } = await supabase
        .from('message_templates')
        .insert({
          agency_id: agencyId,
          name: template.name,
          category: template.category,
          channel: template.channel,
          subject: template.subject,
          body: template.body,
          is_ai_generated: false,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] })
    },
  })

  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Omit<MessageTemplate, 'id'>> }) => {
      const dbUpdates: Record<string, unknown> = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.category !== undefined) dbUpdates.category = updates.category
      if (updates.channel !== undefined) dbUpdates.channel = updates.channel
      if (updates.subject !== undefined) dbUpdates.subject = updates.subject
      if (updates.body !== undefined) dbUpdates.body = updates.body

      const { error } = await supabase
        .from('message_templates')
        .update(dbUpdates)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] })
    },
  })

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['message-templates'] })
    },
  })

  const addTemplate = useCallback(
    (template: Omit<MessageTemplate, 'id'>) => addTemplateMutation.mutate(template),
    [addTemplateMutation]
  )

  const updateTemplate = useCallback(
    (id: string, updates: Partial<Omit<MessageTemplate, 'id'>>) => updateTemplateMutation.mutate({ id, updates }),
    [updateTemplateMutation]
  )

  const deleteTemplate = useCallback(
    (id: string) => deleteTemplateMutation.mutate(id),
    [deleteTemplateMutation]
  )

  return { templates, addTemplate, updateTemplate, deleteTemplate, isLoading }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function mapTriggerToReminderType(trigger: string): string {
  switch (trigger) {
    case 'property_sent': return 'follow_up_sent_property'
    case 'visit_completed': return 'post_visit_feedback'
    case 'lead_inactive': return 'dormant_lead'
    case 'document_missing': return 'missing_document'
    case 'new_match': return 'follow_up_sent_property'
    default: return 'custom'
  }
}
