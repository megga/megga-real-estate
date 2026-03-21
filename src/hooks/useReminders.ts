import { useState, useCallback, useMemo } from 'react'

export type ReminderType = 'follow_up_sent_property' | 'post_visit_feedback' | 'dormant_lead' | 'missing_document' | 'price_change' | 'custom'
export type ReminderStatus = 'pending' | 'triggered' | 'done' | 'cancelled' | 'snoozed'
export type ReminderChannel = 'email' | 'whatsapp' | 'task' | 'notification'

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
}

export interface MessageTemplate {
  id: string
  name: string
  category: string
  channel: 'email' | 'whatsapp' | 'both'
  subject: string | null
  body: string
}

// ── Mock templates ──────────────────────────────────────────────────────────

const MOCK_TEMPLATES: MessageTemplate[] = [
  {
    id: 'tpl1',
    name: 'Relance après envoi de bien',
    category: 'follow_up',
    channel: 'email',
    subject: 'Suite à notre sélection de biens',
    body: 'Bonjour {{contact.first_name}},\n\nJe vous ai envoyé récemment une sélection de biens, dont le {{property.address}} à {{property.price}}.\n\nAvez-vous eu l\'occasion de la consulter ? Je reste à votre disposition pour organiser des visites.\n\nCordialement,\n{{agent.full_name}}\n{{agency.name}}',
  },
  {
    id: 'tpl2',
    name: 'Demande de feedback après visite',
    category: 'post_visit',
    channel: 'email',
    subject: 'Votre avis suite à la visite',
    body: 'Bonjour {{contact.first_name}},\n\nSuite à notre visite du bien situé {{property.address}} ({{property.rooms}} pièces, {{property.surface_m2}} m²), j\'aimerais connaître votre impression.\n\nQuels sont les points qui vous ont plu ? Y a-t-il des éléments qui ne correspondent pas à vos attentes ?\n\nVotre retour m\'aidera à affiner ma recherche.\n\nCordialement,\n{{agent.full_name}}',
  },
  {
    id: 'tpl3',
    name: 'Présentation de bien',
    category: 'property_presentation',
    channel: 'both',
    subject: 'Un bien qui pourrait vous intéresser',
    body: 'Bonjour {{contact.first_name}},\n\nJ\'ai le plaisir de vous présenter un bien correspondant à vos critères :\n\n{{property.address}}\nPrix : {{property.price}}\n{{property.rooms}} pièces · {{property.surface_m2}} m²\n\nSouhaitez-vous planifier une visite ?\n\n{{agent.full_name}}\n{{agent.phone}}',
  },
  {
    id: 'tpl4',
    name: 'Relance lead dormant',
    category: 'follow_up',
    channel: 'email',
    subject: 'Des nouvelles de votre projet immobilier',
    body: 'Bonjour {{contact.first_name}},\n\nJe me permets de prendre de vos nouvelles concernant votre projet immobilier.\n\nDe nouveaux biens sont disponibles qui pourraient correspondre à vos critères. Souhaitez-vous que je vous envoie une sélection actualisée ?\n\nN\'hésitez pas à me contacter si votre projet a évolué.\n\nCordialement,\n{{agent.full_name}}\n{{agency.name}}',
  },
  {
    id: 'tpl5',
    name: 'Mise à jour vendeur',
    category: 'seller_update',
    channel: 'email',
    subject: 'Point sur la vente de votre bien',
    body: 'Bonjour {{contact.first_name}},\n\nJe vous fais un point sur votre bien situé {{property.address}}.\n\nDepuis notre dernier échange, nous avons eu de nouvelles demandes et retours. Je souhaiterais faire un point avec vous pour discuter de la stratégie.\n\nQuand seriez-vous disponible pour un appel ?\n\nCordialement,\n{{agent.full_name}}',
  },
]

// ── Mock automation rules ───────────────────────────────────────────────────

const INITIAL_RULES: AutomationRule[] = [
  {
    id: 'rule1',
    name: 'Relance J+3 après envoi de bien',
    triggerEvent: 'property_sent',
    triggerLabel: 'Quand un bien est envoyé à un client',
    action: 'create_reminder',
    actionLabel: 'Créer un rappel pour l\'agent',
    delayDays: 3,
    templateId: 'tpl1',
    isActive: true,
    autoSend: false,
    generatedCount: 12,
  },
  {
    id: 'rule2',
    name: 'Feedback J+1 après visite',
    triggerEvent: 'visit_completed',
    triggerLabel: 'Quand une visite est effectuée',
    action: 'create_reminder',
    actionLabel: 'Créer un rappel pour l\'agent',
    delayDays: 1,
    templateId: 'tpl2',
    isActive: true,
    autoSend: false,
    generatedCount: 8,
  },
  {
    id: 'rule3',
    name: 'Relance lead inactif J+30',
    triggerEvent: 'lead_inactive',
    triggerLabel: 'Quand un lead est inactif depuis 30 jours',
    action: 'create_reminder',
    actionLabel: 'Créer un rappel pour l\'agent',
    delayDays: 30,
    templateId: 'tpl4',
    isActive: true,
    autoSend: false,
    generatedCount: 5,
  },
  {
    id: 'rule4',
    name: 'Alerte acheteur chaud non relancé J+7',
    triggerEvent: 'lead_inactive',
    triggerLabel: 'Quand un acheteur chaud n\'a pas été relancé',
    action: 'notify_agent',
    actionLabel: 'Notification agent',
    delayDays: 7,
    templateId: null,
    isActive: true,
    autoSend: false,
    generatedCount: 3,
  },
  {
    id: 'rule5',
    name: 'Suivi vendeur J+14',
    triggerEvent: 'lead_inactive',
    triggerLabel: 'Quand un vendeur n\'a pas eu de suivi récent',
    action: 'notify_agent',
    actionLabel: 'Notification agent + suggestion',
    delayDays: 14,
    templateId: 'tpl5',
    isActive: true,
    autoSend: false,
    generatedCount: 2,
  },
  {
    id: 'rule6',
    name: 'Relance document manquant KYC J+3',
    triggerEvent: 'document_missing',
    triggerLabel: 'Quand un document KYC est manquant',
    action: 'send_email',
    actionLabel: 'Envoyer un email au client',
    delayDays: 3,
    templateId: null,
    isActive: false,
    autoSend: false,
    generatedCount: 1,
  },
]

// ── Mock reminders ──────────────────────────────────────────────────────────

const INITIAL_REMINDERS: Reminder[] = [
  {
    id: 'rem1',
    contactName: 'Marie Dupont',
    contactId: 'c1',
    type: 'follow_up_sent_property',
    status: 'triggered',
    title: 'Relancer Marie Dupont',
    description: 'Bien envoyé il y a 5 jours (Appartement Eaux-Vives). Pas de réponse.',
    channel: 'email',
    triggerAt: '2026-03-17T09:00:00Z',
    createdAt: '2026-03-14T09:00:00Z',
    completedAt: null,
    propertyTitle: 'Appartement Eaux-Vives',
  },
  {
    id: 'rem2',
    contactName: 'Thomas Wenger',
    contactId: 'c12',
    type: 'post_visit_feedback',
    status: 'triggered',
    title: 'Demander feedback visite — Thomas Wenger',
    description: 'Visite effectuée le 14.03 (Penthouse Quai du Mont-Blanc). Feedback non recueilli.',
    channel: 'whatsapp',
    triggerAt: '2026-03-15T09:00:00Z',
    createdAt: '2026-03-14T14:00:00Z',
    completedAt: null,
    propertyTitle: 'Penthouse Quai du Mont-Blanc',
  },
  {
    id: 'rem3',
    contactName: 'Marc Delarue',
    contactId: 'c16',
    type: 'follow_up_sent_property',
    status: 'triggered',
    title: 'Relancer Marc Delarue — lead dormant',
    description: 'Aucune interaction depuis 27 jours. 2 nouveaux biens compatibles.',
    channel: 'email',
    triggerAt: '2026-03-19T09:00:00Z',
    createdAt: '2026-02-20T14:00:00Z',
    completedAt: null,
  },
  {
    id: 'rem4',
    contactName: 'Nathalie Schmid',
    contactId: 'c9',
    type: 'follow_up_sent_property',
    status: 'pending',
    title: 'Relancer Nathalie Schmid',
    description: 'Bien envoyé le 16.03 (Villa vue lac Cologny). Relance prévue le 19.03.',
    channel: 'email',
    triggerAt: '2026-03-19T09:00:00Z',
    createdAt: '2026-03-16T10:00:00Z',
    completedAt: null,
    propertyTitle: 'Villa vue lac Cologny',
  },
  {
    id: 'rem5',
    contactName: 'Pierre Müller',
    contactId: 'c2',
    type: 'follow_up_sent_property',
    status: 'pending',
    title: 'Point vendeur — Pierre Müller',
    description: 'Pas de suivi depuis 14 jours. Offre en attente à CHF 2\'800\'000.',
    channel: 'notification',
    triggerAt: '2026-03-26T09:00:00Z',
    createdAt: '2026-03-12T11:00:00Z',
    completedAt: null,
  },
  {
    id: 'rem6',
    contactName: 'Hans Zimmermann',
    contactId: 'c4',
    type: 'missing_document',
    status: 'pending',
    title: 'Document manquant — Hans Zimmermann',
    description: 'Attestation de financement requise pour poursuivre le dossier.',
    channel: 'email',
    triggerAt: '2026-03-22T09:00:00Z',
    createdAt: '2026-03-19T09:00:00Z',
    completedAt: null,
  },
]

// ── Hooks ───────────────────────────────────────────────────────────────────

export function useReminders() {
  const [reminders, setReminders] = useState<Reminder[]>(INITIAL_REMINDERS)

  const markAsDone = useCallback((id: string) => {
    setReminders((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: 'done' as const, completedAt: new Date().toISOString() } : r)
    )
  }, [])

  const snooze = useCallback((id: string) => {
    setReminders((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r
        const newTrigger = new Date(r.triggerAt)
        newTrigger.setDate(newTrigger.getDate() + 3)
        return { ...r, status: 'snoozed' as const, triggerAt: newTrigger.toISOString() }
      })
    )
  }, [])

  const cancel = useCallback((id: string) => {
    setReminders((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: 'cancelled' as const } : r)
    )
  }, [])

  const active = useMemo(() => reminders.filter((r) => r.status === 'pending' || r.status === 'triggered'), [reminders])
  const triggered = useMemo(() => reminders.filter((r) => r.status === 'triggered'), [reminders])
  const pending = useMemo(() => reminders.filter((r) => r.status === 'pending'), [reminders])

  return { reminders, active, triggered, pending, markAsDone, snooze, cancel }
}

export function useAutomationRules() {
  const [rules, setRules] = useState<AutomationRule[]>(INITIAL_RULES)

  const toggleRule = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r)
    )
  }, [])

  const toggleAutoSend = useCallback((id: string) => {
    setRules((prev) =>
      prev.map((r) => r.id === id ? { ...r, autoSend: !r.autoSend } : r)
    )
  }, [])

  const addRule = useCallback((rule: Omit<AutomationRule, 'id' | 'generatedCount'>) => {
    setRules((prev) => [...prev, { ...rule, id: `rule-${Date.now()}`, generatedCount: 0 }])
  }, [])

  return { rules, toggleRule, toggleAutoSend, addRule }
}

export function useMessageTemplates() {
  const [templates] = useState<MessageTemplate[]>(MOCK_TEMPLATES)
  return { templates }
}
