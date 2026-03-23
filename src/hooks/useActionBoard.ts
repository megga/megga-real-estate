import { useState, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
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

// ── Supabase match shape for Action Board ───────────────────────────────────

interface RecentMatchRow {
  id: string
  score: number
  created_at: string
  contact_id: string
  property_id: string
  contact: { first_name: string; last_name: string }[] | { first_name: string; last_name: string } | null
  property: { title: string; address: string; city: string; price: number }[] | { title: string; address: string; city: string; price: number } | null
}

interface RecentMatch {
  id: string
  score: number
  created_at: string
  contact_id: string
  property_id: string
  contact: { first_name: string; last_name: string } | null
  property: { title: string; address: string; city: string; price: number } | null
}

function normalizeMatch(row: RecentMatchRow): RecentMatch {
  return {
    ...row,
    contact: Array.isArray(row.contact) ? row.contact[0] ?? null : row.contact,
    property: Array.isArray(row.property) ? row.property[0] ?? null : row.property,
  }
}

function matchToAction(match: RecentMatch): ActionItem {
  const contactName = match.contact
    ? `${match.contact.first_name} ${match.contact.last_name}`
    : 'Contact'
  const propertyInfo = match.property
    ? `${match.property.title || match.property.address}, ${match.property.city}`
    : 'Bien'
  const priceStr = match.property ? formatCHF(match.property.price) : ''

  const createdDate = new Date(match.created_at)
  const now = new Date()
  const diffHours = Math.round((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60))
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

// ── Mock actions for categories not yet connected to Supabase ────────────────

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
    description: "Aucune activité depuis 12 jours. Le vendeur s'impatiente.",
    actionLabel: 'Relancer',
    actionType: 'relancer',
    entityType: 'deal',
    entityId: 'd10',
    isCompleted: false,
    timestamp: 'il y a 12 jours',
    isOverdue: true,
  },
  {
    id: 'a-doc-exp-1',
    category: 'urgency',
    priority: 'urgent',
    title: 'Document expiré — Attestation domicile Sophie Favre',
    description: "L'attestation de domicile a expiré le 10.03.2026. Dossier KYC bloqué.",
    actionLabel: 'Voir le dossier',
    actionType: 'review_document',
    entityType: 'contact',
    entityId: 'c3',
    isCompleted: false,
    timestamp: 'expiré il y a 11 jours',
    isOverdue: true,
  },
  {
    id: 'a-doc-exp-2',
    category: 'urgency',
    priority: 'high',
    title: 'Document expire bientôt — Passeport Pierre Keller',
    description: 'Le passeport expire le 15.04.2026 (dans 25 jours). Prévoir un renouvellement.',
    actionLabel: 'Relancer',
    actionType: 'email',
    entityType: 'contact',
    entityId: 'c4',
    isCompleted: false,
    timestamp: 'expire dans 25 jours',
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
  // Visites à confirmer
  {
    id: 'a8',
    category: 'visit_confirm',
    priority: 'medium',
    title: 'Confirmer visite — Isabelle Rochat',
    description: "Duplex Champel, aujourd'hui à 14h30. Confirmation du client en attente.",
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
    description: "Appartement Eaux-Vives, demain à 10h00. Dossier du bien à imprimer.",
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
    actionLabel: "Voir l'analyse",
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
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set())

  // ── Fetch recent matches from Supabase (last 48h, status = 'suggested') ──
  const { data: recentMatches = [] } = useQuery({
    queryKey: ['recent-matches', agencyId],
    queryFn: async () => {
      const twoDaysAgo = new Date()
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

      const { data, error } = await supabase
        .from('matches')
        .select('id, score, created_at, contact_id, property_id, contact:contacts(first_name, last_name), property:properties(title, address, city, price)')
        .eq('agency_id', agencyId)
        .eq('status', 'suggested')
        .gte('created_at', twoDaysAgo.toISOString())
        .order('score', { ascending: false })
        .limit(10)

      if (error) throw error
      return ((data || []) as RecentMatchRow[]).map(normalizeMatch)
    },
    enabled: !!agencyId,
    staleTime: 30000,
  })

  // ── Convert Supabase matches to ActionItems ──
  const supabaseMatchActions = useMemo(
    () => recentMatches.map(matchToAction),
    [recentMatches]
  )

  // ── Merge: mock actions (non-match categories) + real match actions ──
  const allActions = useMemo(() => {
    const mockNonMatch = MOCK_ACTIONS.filter((a) => a.category !== 'match_found')
    return [...mockNonMatch, ...supabaseMatchActions]
  }, [supabaseMatchActions])

  const markAsCompleted = useCallback((actionId: string) => {
    setCompletedIds((prev) => new Set([...prev, actionId]))
  }, [])

  const pending = useMemo(
    () => allActions.filter((a) => !a.isCompleted && !completedIds.has(a.id)),
    [allActions, completedIds]
  )

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
