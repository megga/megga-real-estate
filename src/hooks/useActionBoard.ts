import { useState, useCallback, useMemo } from 'react'

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

// Mock action data — Phase A (static, no AI)
const MOCK_ACTIONS: ActionItem[] = [
  // Urgences
  {
    id: 'a1',
    category: 'urgency',
    priority: 'urgent',
    title: 'Dossier KYC incomplet — Famille Müller',
    description: 'Document manquant depuis 5 jours. KYC bloqué.',
    actionLabel: 'Voir le dossier',
    actionType: 'review_document',
    entityType: 'contact',
    entityId: 'c2',
    isCompleted: false,
    timestamp: 'il y a 5 jours',
    isOverdue: true,
  },
  {
    id: 'a2',
    category: 'urgency',
    priority: 'urgent',
    title: 'Deal à risque — Villa Champel',
    description: 'Aucune activité depuis 12 jours. Le vendeur s\'impatiente.',
    actionLabel: 'Relancer',
    actionType: 'relancer',
    entityType: 'deal',
    entityId: 'd10',
    isCompleted: false,
    timestamp: 'il y a 12 jours',
    isOverdue: true,
  },
  // Relances du jour
  {
    id: 'a3',
    category: 'follow_up',
    priority: 'high',
    title: 'Relancer Marie Dupont',
    description: 'Pas de retour depuis la visite du 14.03. Bien envoyé : Appartement Eaux-Vives.',
    actionLabel: 'Appeler',
    actionType: 'call',
    entityType: 'contact',
    entityId: 'c1',
    isCompleted: false,
    timestamp: 'il y a 3 jours',
    isOverdue: true,
  },
  {
    id: 'a4',
    category: 'follow_up',
    priority: 'high',
    title: 'Feedback visite — Thomas Wenger',
    description: 'Visite effectuée le 14.03 (Penthouse Quai du Mont-Blanc). Feedback non recueilli.',
    actionLabel: 'Envoyer un email',
    actionType: 'email',
    entityType: 'contact',
    entityId: 'c3',
    isCompleted: false,
    timestamp: 'il y a 2 jours',
  },
  {
    id: 'a5',
    category: 'follow_up',
    priority: 'medium',
    title: 'Relancer Marc Delarue',
    description: 'Lead inactif depuis 27 jours. 2 nouveaux biens correspondent à ses critères.',
    actionLabel: 'Envoyer une sélection',
    actionType: 'send_property',
    entityType: 'contact',
    entityId: 'c4',
    isCompleted: false,
    timestamp: 'il y a 27 jours',
    isOverdue: true,
  },
  // Matchs trouvés
  {
    id: 'a6',
    category: 'match_found',
    priority: 'medium',
    title: 'Nouveau match — Marie Dupont',
    description: '3 pièces Rue du Rhône, CHF 820\'000, 92% compatible. Budget, zone et surface OK.',
    actionLabel: 'Envoyer le bien',
    actionType: 'send_property',
    entityType: 'contact',
    entityId: 'c1',
    isCompleted: false,
    timestamp: 'hier 09:15',
  },
  {
    id: 'a7',
    category: 'match_found',
    priority: 'medium',
    title: 'Nouveau match — Hans Zimmermann',
    description: 'Duplex Florissant, CHF 1\'180\'000, 85% compatible. Type et zone correspondants.',
    actionLabel: 'Envoyer le bien',
    actionType: 'send_property',
    entityType: 'contact',
    entityId: 'c3',
    isCompleted: false,
    timestamp: 'hier 14:20',
  },
  // Visites à confirmer
  {
    id: 'a8',
    category: 'visit_confirm',
    priority: 'medium',
    title: 'Confirmer visite — Isabelle Rochat',
    description: 'Duplex Champel, aujourd\'hui à 14h30. Confirmation du client en attente.',
    actionLabel: 'Appeler',
    actionType: 'call',
    entityType: 'visit',
    entityId: 'v1',
    isCompleted: false,
    timestamp: "aujourd'hui 14h30",
  },
  {
    id: 'a9',
    category: 'visit_confirm',
    priority: 'medium',
    title: 'Préparer visite — Laurent Berset',
    description: 'Appartement Eaux-Vives, demain à 10h00. Dossier du bien à imprimer.',
    actionLabel: 'Voir le dossier',
    actionType: 'review_document',
    entityType: 'deal',
    entityId: 'd1',
    isCompleted: false,
    timestamp: 'demain 10h00',
  },
  // Suggestions IA
  {
    id: 'a10',
    category: 'suggestion',
    priority: 'low',
    title: 'Proposer une baisse de prix — Villa Cologny',
    description: 'Le bien est en vente depuis 45 jours sans offre. Le marché comparable suggère un ajustement de -5%.',
    actionLabel: 'Voir l\'analyse',
    actionType: 'view_analysis',
    entityType: 'property',
    entityId: 'p3',
    isCompleted: false,
    timestamp: 'généré ce matin',
  },
  {
    id: 'a11',
    category: 'suggestion',
    priority: 'low',
    title: 'Contacter les leads dormants',
    description: '4 leads inactifs depuis plus de 30 jours. Une relance ciblée pourrait réactiver 1-2 prospects.',
    actionLabel: 'Voir la liste',
    actionType: 'view_list',
    entityType: 'contact',
    isCompleted: false,
    timestamp: 'généré ce matin',
  },
]

export function useActionBoard() {
  const [actions, setActions] = useState<ActionItem[]>(MOCK_ACTIONS)

  const markAsCompleted = useCallback((actionId: string) => {
    setActions((prev) =>
      prev.map((a) => (a.id === actionId ? { ...a, isCompleted: true } : a))
    )
  }, [])

  const pending = useMemo(() => actions.filter((a) => !a.isCompleted), [actions])

  const byCategory = useMemo(() => ({
    urgencies: pending.filter((a) => a.category === 'urgency'),
    followUps: pending.filter((a) => a.category === 'follow_up'),
    matches: pending.filter((a) => a.category === 'match_found'),
    visits: pending.filter((a) => a.category === 'visit_confirm'),
    suggestions: pending.filter((a) => a.category === 'suggestion'),
  }), [pending])

  const totalPending = pending.length

  return {
    actions: pending,
    byCategory,
    totalPending,
    markAsCompleted,
    isLoading: false,
  }
}
