// Migrated to @supabase-cache-helpers/postgrest-react-query.
//
// useReminders + useMessageTemplates: fully migrated — list query + simple
// CRUD mutations. Cache Helpers auto-invalidates queries against the same
// table on Insert/Update/Delete, so we removed manual queryClient.invalidate
// calls.
//
// useAutomationRules: kept on classic React Query because the queryFn issues
// 3 dependent sub-queries (count generated, count active, last triggered) per
// rule. Cache Helpers' declarative query API doesn't model dependent fetches
// that join data from one query into the WHERE of another. Migrating it
// would require either a database VIEW (server-side) or two separate hooks
// that the consumer assembles — both larger changes outside this PR scope.

import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient, useQuery as useRqQuery } from '@tanstack/react-query'
import {
  useQuery,
  useInsertMutation,
  useUpdateMutation,
  useDeleteMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TablesUpdate } from '@/types/database'

export type ReminderType = 'follow_up_sent_property' | 'post_visit_feedback' | 'dormant_lead' | 'missing_document' | 'price_change' | 'custom'
export type ReminderStatus = 'pending' | 'triggered' | 'done' | 'cancelled' | 'snoozed'
export type ReminderChannel = 'email' | 'task' | 'notification'

export interface Reminder {
  id: string
  contactName: string
  contactId: string
  /** Transaction this reminder belongs to (null when the reminder is
   * attached to a contact directly without a deal). Consumed by the
   * Pipeline DealDetailDrawer to find the active next-action per deal. */
  transactionId: string | null
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
  auto_send: boolean
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
    transactionId: row.transaction_id,
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
    autoSend: row.auto_send ?? false,
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

  // Build the query lazily — if agencyId is missing, we still need a valid
  // query expression for Cache Helpers to inspect (it short-circuits via
  // `enabled` before any fetch fires).
  const remindersQuery = useQuery(
    supabase
      .from('reminders')
      .select('id, type, status, trigger_at, channel, contact_id, property_id, transaction_id, match_id, message_template, created_at, completed_at, contact:contacts(first_name, last_name), property:properties(title, address)')
      .eq('agency_id', agencyId ?? '00000000-0000-0000-0000-000000000000')
      .in('status', ['pending', 'triggered', 'snoozed'])
      .order('trigger_at', { ascending: true })
      .limit(100),
    { enabled: !!agencyId, staleTime: 30_000 }
  )

  const reminders = useMemo(
    () => ((remindersQuery.data ?? []) as unknown as ReminderRow[]).map(rowToReminder),
    [remindersQuery.data]
  )

  // Mutations: useUpdateMutation auto-invalidates any cached query against
  // `reminders` (including the list above), so manual invalidations are
  // gone. action-board components share the same table, so they invalidate
  // automatically too.
  const updateReminder = useUpdateMutation(supabase.from('reminders'), ['id'])

  const markAsDone = useCallback(
    (id: string) => {
      void updateReminder.mutateAsync({
        id,
        status: 'done',
        completed_at: new Date().toISOString(),
      })
    },
    [updateReminder]
  )

  const snooze = useCallback(
    async (id: string) => {
      // Need current trigger_at to compute the new value; fetch directly
      // (one-shot, not cached).
      const { data: current, error: fetchErr } = await supabase
        .from('reminders')
        .select('trigger_at')
        .eq('id', id)
        .single()
      if (fetchErr || !current) return

      const newTrigger = new Date(current.trigger_at ?? Date.now())
      newTrigger.setDate(newTrigger.getDate() + 3)

      await updateReminder.mutateAsync({
        id,
        status: 'snoozed',
        trigger_at: newTrigger.toISOString(),
      })
    },
    [updateReminder]
  )

  const cancel = useCallback(
    (id: string) => {
      void updateReminder.mutateAsync({ id, status: 'cancelled' })
    },
    [updateReminder]
  )

  const active = useMemo(() => reminders.filter((r) => r.status === 'pending' || r.status === 'triggered'), [reminders])
  const triggered = useMemo(() => reminders.filter((r) => r.status === 'triggered'), [reminders])
  const pending = useMemo(() => reminders.filter((r) => r.status === 'pending'), [reminders])

  return {
    reminders,
    active,
    triggered,
    pending,
    markAsDone,
    snooze,
    cancel,
    isLoading: remindersQuery.isLoading,
  }
}

// Kept on classic React Query — the queryFn issues N dependent sub-queries
// per rule (count generated, count active, last triggered) which Cache
// Helpers' declarative API can't express. A DB view would be the proper
// migration path; out of scope here.
export function useAutomationRules() {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id
  const queryClient = useQueryClient()

  const { data: rules = [], isLoading } = useRqQuery({
    queryKey: ['automation-rules', agencyId],
    queryFn: async () => {
      if (!agencyId) return []

      const { data: rulesData, error: rulesErr } = await supabase
        .from('automation_rules')
        .select('id, name, trigger_event, action, delay_days, template_id, is_active, auto_send, created_at')
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
  const toggleAutoSendMutation = useMutation({
    mutationFn: async ({ id, autoSend }: { id: string; autoSend: boolean }) => {
      const { error } = await supabase
        .from('automation_rules')
        .update({ auto_send: !autoSend })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] })
    },
  })

  const toggleAutoSend = useCallback((id: string) => {
    const rule = rules.find((r) => r.id === id)
    if (rule) toggleAutoSendMutation.mutate({ id, autoSend: rule.autoSend })
  }, [rules, toggleAutoSendMutation])

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

  const templatesQuery = useQuery(
    supabase
      .from('message_templates')
      .select('id, name, category, channel, subject, body')
      .eq('agency_id', agencyId ?? '00000000-0000-0000-0000-000000000000')
      .order('created_at', { ascending: false }),
    { enabled: !!agencyId, staleTime: 60_000 }
  )

  const templates = useMemo(
    () => ((templatesQuery.data ?? []) as unknown as TemplateRow[]).map(rowToTemplate),
    [templatesQuery.data]
  )

  const insertTemplate = useInsertMutation(supabase.from('message_templates'), ['id'])
  const updateTemplate = useUpdateMutation(supabase.from('message_templates'), ['id'])
  const deleteTemplateMutation = useDeleteMutation(supabase.from('message_templates'), ['id'])

  const addTemplate = useCallback(
    async (template: Omit<MessageTemplate, 'id'>) => {
      if (!agencyId) throw new Error('No agency')
      await insertTemplate.mutateAsync([
        {
          agency_id: agencyId,
          name: template.name,
          category: template.category,
          channel: template.channel,
          subject: template.subject,
          body: template.body,
          is_ai_generated: false,
        },
      ])
    },
    [agencyId, insertTemplate]
  )

  const updateTemplateFn = useCallback(
    async (id: string, updates: Partial<Omit<MessageTemplate, 'id'>>) => {
      const dbUpdates: Record<string, unknown> = {}
      if (updates.name !== undefined) dbUpdates.name = updates.name
      if (updates.category !== undefined) dbUpdates.category = updates.category
      if (updates.channel !== undefined) dbUpdates.channel = updates.channel
      if (updates.subject !== undefined) dbUpdates.subject = updates.subject
      if (updates.body !== undefined) dbUpdates.body = updates.body
      await updateTemplate.mutateAsync({
        id,
        ...dbUpdates,
      } as unknown as TablesUpdate<'message_templates'>)
    },
    [updateTemplate]
  )

  const deleteTemplate = useCallback(
    async (id: string) => {
      await deleteTemplateMutation.mutateAsync({ id })
    },
    [deleteTemplateMutation]
  )

  return {
    templates,
    addTemplate,
    updateTemplate: updateTemplateFn,
    deleteTemplate,
    isLoading: templatesQuery.isLoading,
  }
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
