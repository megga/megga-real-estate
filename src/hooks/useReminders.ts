/**
 * Rappels/relances de l'agence (table `reminders`) : liste filtrée aux
 * statuts actifs, création manuelle (dialog Calendrier) et transitions
 * (fait / snooze +3 j / annulé / replanifié). Migré vers @supabase-cache-helpers.
 */
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
import {
  useQuery,
  useInsertMutation,
  useUpdateMutation,
} from '@supabase-cache-helpers/postgrest-react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { messageDeRelance } from '@/lib/calendrierEvenements'

export type ReminderType = 'follow_up_sent_property' | 'post_visit_feedback' | 'dormant_lead' | 'missing_document' | 'price_change' | 'custom' | 'deal_stagnant' | 'match_ignored'
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
  /** Property attached to this reminder (null when contact-only). */
  propertyId: string | null
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

// ── Label mappings ─────────────────────────────────────────────────────────
const REMINDER_TYPE_TITLES: Record<string, string> = {
  follow_up_sent_property: 'Relance envoi de bien',
  post_visit_feedback: 'Feedback post-visite',
  dormant_lead: 'Lead dormant',
  missing_document: 'Document manquant',
  price_change: 'Changement de prix',
  custom: 'Relance personnalisée',
  deal_stagnant: 'Dossier à faire avancer',
  match_ignored: 'Correspondance à envoyer',
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

// ── Row converters ─────────────────────────────────────────────────────────

/** Convertit une ligne DB (jointures contact/property parfois en tableau) en `Reminder` d'UI ; la raison chiffrée prime sur le libellé de type. */
function rowToReminder(row: ReminderRow): Reminder {
  const contact = Array.isArray(row.contact) ? row.contact[0] : row.contact
  const property = Array.isArray(row.property) ? row.property[0] : row.property
  const contactName = contact ? `${contact.first_name} ${contact.last_name}` : 'Contact'
  const propertyTitle = property?.title || property?.address || undefined

  const typeTitle = REMINDER_TYPE_TITLES[row.type] || row.type
  const title = `${typeTitle} — ${contactName}`
  // La raison chiffrée (message_template, ex. signaux radar « Dossier sans
  // avancement depuis 14 jours ») prime sur le libellé générique quand elle existe.
  const description = row.message_template?.trim()
    ? row.message_template.trim()
    : (propertyTitle ? `${typeTitle} (${propertyTitle}).` : typeTitle)

  return {
    id: row.id,
    contactName,
    contactId: row.contact_id,
    transactionId: row.transaction_id,
    propertyId: row.property_id,
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



// ── Hooks ──────────────────────────────────────────────────────────────────

/** Rappels actifs de l'agence + mutateurs (create/markAsDone/snooze/cancel/reschedule) et sous-listes dérivées (active/triggered/pending). */
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
  const insertReminder = useInsertMutation(supabase.from('reminders'), ['id'])

  /**
   * Create a custom reminder from the Calendar dialog (meeting / reminder /
   * signing / deadline / personal). All fields optional except agency_id
   * (set automatically from profile).
   */
  const createReminder = useCallback(
    async (input: {
      type: ReminderType
      triggerAt: Date
      title?: string
      description?: string
      contactId?: string | null
      propertyId?: string | null
      transactionId?: string | null
      channel?: ReminderChannel
    }) => {
      if (!agencyId) throw new Error('Aucune agence rattachée')
      const message = messageDeRelance(input.title, input.description)
      const rows = await insertReminder.mutateAsync([
        {
          agency_id: agencyId,
          type: input.type,
          status: 'pending',
          trigger_at: input.triggerAt.toISOString(),
          trigger_rule: 'manual',
          channel: input.channel ?? 'task',
          contact_id: input.contactId ?? null,
          property_id: input.propertyId ?? null,
          transaction_id: input.transactionId ?? null,
          message_template: message,
        },
      ])
      return Array.isArray(rows) ? rows[0] : rows
    },
    [agencyId, insertReminder],
  )

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

  /**
   * Replanifie un rappel à `triggerAt` (glissé dans le Calendrier, date changée dans
   * sa modale). Rejette en cas d'échec : l'appelant doit pouvoir le dire.
   *
   * Un rappel encore OUVERT redevient `pending` : `automation-engine` ne déclenche que
   * les `pending`, et un rappel déjà `triggered` (ou `snoozed`) replacé à la semaine
   * prochaine doit sonner à sa nouvelle date — pas rester « à traiter » dès maintenant.
   * Un rappel CLOS (fait, annulé) ne change que de date : le rouvrir déferait un geste
   * de l'agent.
   */
  const reschedule = useCallback(
    async (id: string, triggerAt: Date, opts?: { closed?: boolean }) => {
      await updateReminder.mutateAsync({
        id,
        trigger_at: triggerAt.toISOString(),
        ...(opts?.closed ? {} : { status: 'pending' }),
      })
    },
    [updateReminder]
  )

  /**
   * Réécrit une tâche modifiée dans le Calendrier : son titre et ses notes (le message), son
   * contact, son bien — et son horaire s'il a bougé, qui la rouvre comme `reschedule`. Rejette
   * en cas d'échec. ⛔ Seul l'horaire s'écrivait : un titre renommé tenait jusqu'au
   * rechargement, qui relisait l'ancien (revue du 15.09.2026).
   */
  const rewrite = useCallback(
    async (id: string, p: { title: string; notes: string | null; contactId: string | null; propertyId: string | null; triggerAt?: Date; closed?: boolean }) => {
      await updateReminder.mutateAsync({
        id,
        message_template: messageDeRelance(p.title, p.notes),
        contact_id: p.contactId,
        property_id: p.propertyId,
        ...(p.triggerAt ? { trigger_at: p.triggerAt.toISOString(), ...(p.closed ? {} : { status: 'pending' as const }) } : {}),
      })
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
    createReminder,
    isCreating: insertReminder.isPending,
    markAsDone,
    snooze,
    cancel,
    reschedule,
    rewrite,
    isLoading: remindersQuery.isLoading,
    isError: remindersQuery.isError,
  }
}

// Kept on classic React Query — the queryFn issues N dependent sub-queries
// per rule (count generated, count active, last triggered) which Cache
// Helpers' declarative API can't express. A DB view would be the proper
// migration path; out of scope here.
// ── Helpers ────────────────────────────────────────────────────────────────

