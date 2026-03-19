import { useState, useCallback, useMemo } from 'react'

export type ActionPriority = 'urgent' | 'high' | 'medium' | 'low'
export type ActionCategory = 'urgency' | 'follow_up' | 'match_found' | 'visit_confirm' | 'suggestion'
export type ActionType = 'call' | 'email' | 'whatsapp' | 'send_property' | 'plan_visit' | 'review_document' | 'view_deal'

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
}

// Mock action data — Phase A (static, no AI)
const MOCK_ACTIONS: ActionItem[] = [
  // Urgences
  {
    id: 'a1',
    category: 'urgency',
    priority: 'urgent',
    title: 'Document manquant — Dossier KYC Schmid',
    description: 'La pièce d\'identité est requise pour finaliser le dossier. Demande envoyée il y a 5 jours sans réponse.',
    actionLabel: 'Relancer',
    actionType: 'email',
    entityType: 'contact',
    entityId: 'c2',
    isCompleted: false,
  },
  {
    id: 'a2',
    category: 'urgency',
    priority: 'urgent',
    title: 'Deal à risque — Négociation Khoury',
    description: 'Aucune réponse à la contre-offre depuis 10 jours. Risque de perdre le deal.',
    actionLabel: 'Appeler',
    actionType: 'call',
    entityType: 'deal',
    entityId: 'd10',
    isCompleted: false,
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
  },
  {
    id: 'a4',
    category: 'follow_up',
    priority: 'high',
    title: 'Feedback visite — Thomas Wenger',
    description: 'Visite effectuée le 14.03 (Penthouse Quai du Mont-Blanc). Feedback non recueilli.',
    actionLabel: 'Envoyer WhatsApp',
    actionType: 'whatsapp',
    entityType: 'contact',
    entityId: 'c3',
    isCompleted: false,
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
  },
  {
    id: 'a9',
    category: 'visit_confirm',
    priority: 'medium',
    title: 'Préparer visite — Laurent Berset',
    description: 'Appartement Eaux-Vives, demain à 10h00. Dossier du bien à imprimer.',
    actionLabel: 'Voir le dossier',
    actionType: 'view_deal',
    entityType: 'deal',
    entityId: 'd1',
    isCompleted: false,
  },
  // Suggestions IA
  {
    id: 'a10',
    category: 'suggestion',
    priority: 'low',
    title: 'Proposer une baisse de prix — Villa Cologny',
    description: 'Le bien est en vente depuis 45 jours sans offre. Le marché comparable suggère un ajustement de -5%.',
    actionLabel: 'Voir l\'analyse',
    actionType: 'view_deal',
    entityType: 'property',
    entityId: 'p3',
    isCompleted: false,
  },
  {
    id: 'a11',
    category: 'suggestion',
    priority: 'low',
    title: 'Contacter les leads dormants',
    description: '4 leads inactifs depuis plus de 30 jours. Une relance ciblée pourrait réactiver 1-2 prospects.',
    actionLabel: 'Voir la liste',
    actionType: 'view_deal',
    entityType: 'contact',
    isCompleted: false,
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
