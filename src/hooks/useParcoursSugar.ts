// MEGGA CRM Sugar v2 — Source de vérité pour ParcoursSugarV2Page.
// Vue panoramique des dossiers (transactions actives) avec une frise
// horizontale en 4 stages (mandat → market → nego → closing).
//
// Hors scope cette PR :
//   - PARCOURS_TEAM : équipe agence — laissée mock (chantier dédié RBAC).
//   - columns granulaires (visites/offres/photos) — dérivées heuristiquement.
//   - drag-drop de tâches entre colonnes (pas de table parcours_tasks).

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TransactionStage } from '@/lib/constants'
import {
  type ParcoursDossier,
  type ParcoursTask,
  type StageId,
  type Urgency,
} from '@/components/crm-sugar/parcours/parcoursData'

// Mapping stage transaction → stage parcours (4 colonnes)
function stageToParcours(s: TransactionStage): StageId {
  switch (s) {
    case 'new_lead':
    case 'to_qualify':
    case 'to_recontact':
      return 'mandat'
    case 'active_search':
    case 'visit_planned':
    case 'visit_done':
      return 'market'
    case 'interest_confirmed':
    case 'offer':
    case 'negotiation':
      return 'nego'
    case 'reserved':
    case 'financing':
    case 'notary':
    case 'signed':
      return 'closing'
    case 'lost':
      return 'mandat'
    default:
      return 'mandat'
  }
}

const STAGE_ORDER: StageId[] = ['mandat', 'market', 'nego', 'closing']

// Compare deux stages : a est-il <= b ? (done si stage actuel >= stage de la tâche)
function isPastOrAt(current: StageId, target: StageId): boolean {
  return STAGE_ORDER.indexOf(current) >= STAGE_ORDER.indexOf(target)
}

function isCurrent(current: StageId, target: StageId): boolean {
  return current === target
}

// Heuristique d'urgence : critique si on est en negotiation/offer et le deal
// stagne depuis > 30j, medium en mise en marché, low sur new_lead.
function urgencyFor(stage: TransactionStage, updatedAt: string): Urgency {
  const days = (Date.now() - new Date(updatedAt).getTime()) / (24 * 60 * 60 * 1000)
  if (stage === 'offer' || stage === 'negotiation' || stage === 'reserved') {
    return days > 14 ? 'high' : 'medium'
  }
  if (stage === 'new_lead' || stage === 'to_qualify') return 'low'
  return 'medium'
}

interface TransactionJoin {
  id: string
  stage: TransactionStage
  status: string
  updated_at: string
  assigned_to: string | null
  property: { title: string | null; address: string | null; city: string | null; price: number | null; surface_m2: number | null; rooms: number | null } | { title: string | null; address: string | null; city: string | null; price: number | null; surface_m2: number | null; rooms: number | null }[] | null
}

function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

function formatPrice(n: number | null): string {
  if (n == null || n === 0) return ''
  const s = String(Math.round(n))
  return "CHF " + s.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

function subtitleFor(rooms: number | null, surface: number | null, price: number | null): string {
  const parts: string[] = []
  if (rooms) parts.push(`${rooms} p`)
  if (surface) parts.push(`${surface} m²`)
  const priceStr = formatPrice(price)
  if (priceStr) parts.push(priceStr)
  return parts.join(' · ')
}

// Génère les 4 colonnes de tâches en fonction du stage courant.
// Pas de table parcours_tasks → on dérive des jalons standards (mandat signé,
// photos publiées, visites, offres, compromis, acte) avec done/active/todo.
function buildColumns(
  current: StageId,
  agentId: string,
  dossierId: string,
): Record<StageId, ParcoursTask[]> {
  const mkTask = (
    key: string,
    label: string,
    target: StageId,
    sub?: string,
    big?: boolean,
  ): ParcoursTask => {
    const state = isCurrent(current, target)
      ? 'active'
      : isPastOrAt(current, target)
      ? 'done'
      : 'todo'
    return { id: `t-${dossierId}-${key}`, agentId, label, state, sub, big }
  }

  return {
    mandat: [
      mkTask('m1', 'Mandat signé', 'mandat', undefined, true),
      mkTask('m2', 'KYC vendeur', 'mandat'),
      mkTask('m3', 'Brief commercial', 'mandat'),
    ],
    market: [
      mkTask('mk1', 'Photos & vidéo', 'market', undefined, true),
      mkTask('mk2', 'Annonce publiée', 'market'),
      mkTask('mk3', 'Visites planifiées', 'market'),
    ],
    nego: [
      mkTask('n1', 'Offres reçues', 'nego', undefined, true),
      mkTask('n2', 'Négociation', 'nego'),
    ],
    closing: [
      mkTask('c1', 'Compromis', 'closing', undefined, true),
      mkTask('c2', 'Acte authentique', 'closing'),
    ],
  }
}

export interface UseParcoursSugarReturn {
  dossiers: ParcoursDossier[]
  isLoading: boolean
}

export function useParcoursSugar(): UseParcoursSugarReturn {
  const { profile } = useAuth()
  const agencyId = profile?.agency_id

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['parcours-sugar', agencyId],
    queryFn: async (): Promise<TransactionJoin[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('transactions')
        .select('id, stage, status, updated_at, assigned_to, property:properties(title, address, city, price, surface_m2, rooms)')
        .eq('agency_id', agencyId)
        .neq('stage', 'lost')
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as TransactionJoin[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })

  const dossiers = useMemo<ParcoursDossier[]>(() => {
    return transactions.map(t => {
      const property = unwrap(t.property)
      const stageActive = stageToParcours(t.stage)
      const cityTitle = property?.city ? `${property.city} — ${property.address ?? ''}`.trim() : property?.address ?? 'Dossier'
      const title = property?.title || cityTitle
      const agentId = t.assigned_to ?? 't-greg'   // fallback team mock id si pas assigné
      const columns = buildColumns(stageActive, agentId, t.id)
      const activeTaskId = columns[stageActive].find(task => task.state === 'active')?.id
        ?? `t-${t.id}-m1`
      return {
        id: t.id,
        title,
        subtitle: subtitleFor(property?.rooms ?? null, property?.surface_m2 ?? null, property?.price ?? null),
        urgency: urgencyFor(t.stage, t.updated_at),
        stageActive,
        activeTaskId,
        team: [],                  // équipe agence laissée vide (chantier RBAC dédié)
        columns,
      }
    })
  }, [transactions])

  return { dossiers, isLoading }
}
