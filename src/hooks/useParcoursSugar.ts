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
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import type { TransactionStage } from '@/lib/constants'
import {
  type ParcoursDossier,
  type ParcoursTask,
  type StageId,
  type Urgency,
} from '@/components/crm-sugar/journey/journeyData'

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

/** Le stage courant est-il exactement `target` ? (colonne active de la frise). */
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

/** Supabase renvoie parfois une jointure to-one comme tableau ; renvoie le 1er élément. */
function unwrap<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? v[0] ?? null : v
}

/** Formate un prix en `CHF 720'000` (apostrophe suisse) ; chaîne vide si null/0. */
function formatPrice(n: number | null): string {
  if (n == null || n === 0) return ''
  const s = String(Math.round(n))
  return "CHF " + s.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

/** Compose le sous-titre d'un dossier : pièces · surface · prix (parties non vides jointes par ·). */
function subtitleFor(rooms: number | null, surface: number | null, price: number | null, t: TFunction): string {
  const parts: string[] = []
  if (rooms) parts.push(`${rooms} ${t('journey.roomsAbbr')}`)
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
  t: TFunction,
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
      mkTask('m1', t('journey.task.mandatSigned'), 'mandat', undefined, true),
      mkTask('m2', t('journey.task.kycSeller'), 'mandat'),
      mkTask('m3', t('journey.task.commercialBrief'), 'mandat'),
    ],
    market: [
      mkTask('mk1', t('journey.task.photosVideo'), 'market', undefined, true),
      mkTask('mk2', t('journey.task.listingPublished'), 'market'),
      mkTask('mk3', t('journey.task.visitsScheduled'), 'market'),
    ],
    nego: [
      mkTask('n1', t('journey.task.offersReceived'), 'nego', undefined, true),
      mkTask('n2', t('journey.task.negotiation'), 'nego'),
    ],
    closing: [
      mkTask('c1', t('journey.task.preliminaryAgreement'), 'closing', undefined, true),
      mkTask('c2', t('journey.task.notarialDeed'), 'closing'),
    ],
  }
}

export interface UseParcoursSugarReturn {
  dossiers: ParcoursDossier[]
  isLoading: boolean
  isError: boolean
  refetch: () => void
}

/**
 * Source de vérité de ParcoursSugarV2Page : charge les transactions actives de
 * l'agence et les projette en `ParcoursDossier[]` (frise 4 stages + colonnes de
 * jalons dérivées). Les libellés se recalculent au changement de langue.
 */
export function useParcoursSugar(): UseParcoursSugarReturn {
  const { profile } = useAuth()
  const { t, i18n } = useTranslation('pipeline')
  const agencyId = profile?.agency_id

  const { data: transactions = [], isLoading, isError, refetch } = useQuery({
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
    return transactions.map(tx => {
      const property = unwrap(tx.property)
      const stageActive = stageToParcours(tx.stage)
      const cityTitle = property?.city ? `${property.city} — ${property.address ?? ''}`.trim() : property?.address ?? t('journey.dossierFallback')
      const title = property?.title || cityTitle
      const agentId = tx.assigned_to ?? 't-greg'   // fallback team mock id si pas assigné
      const columns = buildColumns(stageActive, agentId, tx.id, t)
      const activeTaskId = columns[stageActive].find(task => task.state === 'active')?.id
        ?? `t-${tx.id}-m1`
      return {
        id: tx.id,
        title,
        subtitle: subtitleFor(property?.rooms ?? null, property?.surface_m2 ?? null, property?.price ?? null, t),
        urgency: urgencyFor(tx.stage, tx.updated_at),
        stageActive,
        activeTaskId,
        team: [],                  // équipe agence laissée vide (chantier RBAC dédié)
        columns,
      }
    })
    // i18n.language dans les deps : recalcule les libellés au changement de langue.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, i18n.language])

  return { dossiers, isLoading, isError, refetch: () => void refetch() }
}
