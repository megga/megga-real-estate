// MEGGA CRM — Cockpit « Aujourd'hui » · File de priorité FOCUS (algo réel)
// ----------------------------------------------------------------------------
// Fusionne 3 sources actionnables et les classe par un SCORE de priorité
// DÉTERMINISTE + EXPLICABLE (module pur focusScore.ts) :
//   1. Reminders du jour/échus (useReminders).
//   2. Deals (usePipelineSugar) — risque dérivé du status (on_hold/cancelled),
//      poids modeste (nextAction = placeholder, pas de vraie échéance).
//   3. Matches 'suggested' à fort score (RPC focus_top_matches via useFocusMatches)
//      — le signal vivant dominant, internes (mandat propre) vs marché distingués.
// Chaque item porte score (estimation), reason (« pourquoi #1 ») et tier
// (now/next/rest). Le tri + les caps (3 « Maintenant », 2 matches/contact)
// vivent dans finalizeQueue. Items AUTO-SUFFISANTS (contact/bien embarqués) :
// plus de dépendance au registry runtime global (fragile).
//
// Compliance : score = estimation (HITL, jamais d'action auto) ; KYC = bonus
// non-bloquant ; 0 LLM. Empty-state honnête côté UI (plus de seed démo en prod).

import { useMemo, useCallback } from 'react'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useReminders } from '@/hooks/useReminders'
import type { StageId } from '@/components/crm-sugar/tokens'
import type { FocusItem } from './focusQueue'
import { fmtCHF } from './data'
import { useFocusMatches, snoozeMatch } from './useFocusMatches'
import { useFocusConfig } from './useFocusConfig'
import {
  scoreItem,
  assignTier,
  buildReason,
  finalizeQueue,
  toDisplayScore,
  type FocusScoreInput,
  type FocusRankable,
} from './focusScore'

// Item interne = FocusItem + clés de tri (FocusRankable.due) consommées par
// finalizeQueue ; `due` n'est PAS exposé à l'UI.
type QueueItem = FocusItem & FocusRankable

function initialsOf(name: string): string {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || '··'
}
const AV_PAL = ['#5b6cff', '#E08A45', '#39B7C9', '#34C796', '#9b7cf0', '#8B5CF6', '#2370ff', '#74d184']
function avFromId(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return AV_PAL[Math.abs(h) % AV_PAL.length]
}
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}

// Étape du deal → type d'action (bouton) + libellé de catégorie (badge).
function dealType(stage: StageId): { type: string; category: string } {
  if (stage === 'offer' || stage === 'interest-confirmed') return { type: 'offer', category: 'OFFRE' }
  if (stage === 'signed') return { type: 'sign', category: 'MANDAT' }
  return { type: 'call', category: 'RELANCE' }
}

// Type de reminder → type d'action + libellé de catégorie.
function reminderType(t: string): { type: string; category: string } {
  if (t === 'missing_document') return { type: 'kyc', category: 'KYC' }
  if (t === 'price_change') return { type: 'offer', category: 'OFFRE' }
  return { type: 'call', category: 'RELANCE' }
}

export interface UseFocusQueueResult {
  items: FocusItem[]
  isLive: boolean
  /** Sources encore en chargement — évite le flash « File traitée » trompeur. */
  isLoading: boolean
  /** Geste « Fait » → clôt le reminder en base ; match/deal = UI-only en v1. */
  completeItem: (item: FocusItem) => void
  /** Geste « Replanifier » → reporte le reminder OU snooze le match en base. */
  snoozeItem: (item: FocusItem) => void
}

export function useFocusQueue(): UseFocusQueueResult {
  const { deals, contactsById, biensById, isLoading: dealsLoading } = usePipelineSugar()
  const { reminders, isLoading: remLoading, markAsDone, snooze } = useReminders()
  const { matches, isLoading: matchesLoading } = useFocusMatches()
  const cfg = useFocusConfig()

  const items = useMemo<QueueItem[]>(() => {
    // Snapshot du temps courant : la file est FIGÉE à l'instant du calcul et
    // recalculée quand les sources changent. Usage intentionnel (sinon la file
    // se reset à chaque render) — on tait la règle purity.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const out: QueueItem[] = []

    // 1. Deals (hors 'lost') — le score/tier décide de la visibilité.
    for (const d of deals) {
      if (d.stage === 'lost') continue
      const c = contactsById.get(d.contactId)
      const b = d.bienId ? biensById.get(d.bienId) : undefined
      const { type, category } = dealType(d.stage)
      const input: FocusScoreInput = {
        signalKind: 'deal',
        stageProb: d.probability,
        dealRisk: d.risk,
        dealStage: d.stage,
        dealValue: d.value,
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      const contact = c ? `${c.firstName} ${c.lastName}`.trim() : 'Contact'
      out.push({
        id: `deal-${d.id}`,
        type,
        signalKind: 'deal',
        contact,
        contactId: d.contactId,
        initials: c ? initialsOf(contact) : '··',
        av: c?.avatarBg || '#6F8CFF',
        category,
        time: fmtTime(d.nextAction?.dueAt),
        eta: '',
        sub: b?.title ? `${b.title} — à faire avancer.` : 'Deal à faire avancer.',
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: b?.coverPhoto || '', price: fmtCHF(d.value), title: b?.title || undefined },
        due: d.nextAction?.dueAt ? new Date(d.nextAction.dueAt).getTime() : new Date(d.updatedAt).getTime(),
      })
    }

    // 2. Reminders actifs (pending/triggered). Le tier filtre les futurs en « rest ».
    for (const r of reminders) {
      if (r.status !== 'pending' && r.status !== 'triggered') continue
      const { type, category } = reminderType(r.type)
      const input: FocusScoreInput = {
        signalKind: 'reminder',
        reminderTriggerAt: r.triggerAt,
        reminderType: r.type,
        reminderTime: fmtTime(r.triggerAt),
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      out.push({
        id: `rem-${r.id}`,
        type,
        signalKind: 'reminder',
        contact: r.contactName || 'Contact',
        contactId: r.contactId || r.id,
        initials: initialsOf(r.contactName || ''),
        av: avFromId(r.contactId || r.id),
        category,
        time: fmtTime(r.triggerAt),
        eta: '',
        sub: r.description || r.title || (category === 'KYC' ? "Vérification d'identité à compléter." : 'À relancer.'),
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        tier,
        urgent: tier === 'now',
        bien: { photo: '', price: '—', title: r.propertyTitle },
        due: r.triggerAt ? new Date(r.triggerAt).getTime() : undefined,
      })
    }

    // 3. Matches (RPC) — déjà gatés + cappés en SQL ; on score et on tiers.
    for (const m of matches) {
      const input: FocusScoreInput = {
        signalKind: m.signalKind,
        matchScore: m.score,
        reasonsMatchCount: m.reasonsMatchCount,
        reasonKeys: m.reasonKeys,
        kyc: m.kyc,
      }
      const score = scoreItem(input, now, cfg)
      const tier = assignTier(input, now, cfg)
      const contact = m.contactName || 'Contact'
      out.push({
        id: `match-${m.matchId}`,
        type: 'match',
        signalKind: m.signalKind,
        contact,
        contactId: m.contactId,
        initials: initialsOf(contact),
        av: avFromId(m.contactId),
        category: 'MATCH',
        time: '',
        eta: '',
        sub: m.propertyTitle
          ? `${m.propertyTitle}${m.city ? ` · ${m.city}` : ''}`
          : 'Bien proposé — à présenter.',
        reason: buildReason(input, now, cfg),
        score,
        displayScore: toDisplayScore(score, cfg),
        scoreBrut: m.score,
        tier,
        urgent: tier === 'now',
        bien: {
          photo: m.propertyPhoto || '',
          price: m.propertyPrice != null ? fmtCHF(m.propertyPrice) : '—',
          title: m.propertyTitle || undefined,
        },
        due: undefined,
      })
    }

    return finalizeQueue(out, cfg)
  }, [deals, contactsById, biensById, reminders, matches, cfg])

  const isLoading = dealsLoading || remLoading || matchesLoading
  const hasData = deals.length > 0 || reminders.length > 0 || matches.length > 0
  const isLive = !isLoading && hasData

  // Gestes réels (HITL) : Fait clôt le reminder ; Replanifier reporte le
  // reminder OU snooze le match (+3 j). Fait sur un match = UI-only en v1 (ne PAS
  // écrire matches.status/sent_at — ça fausserait le pipeline matching/analytics).
  // Item deal = UI-only (pas de mutation deal dédiée). Fire-and-forget : le
  // refetch rafraîchit la file au prochain montage.
  const completeItem = useCallback((item: FocusItem) => {
    if (item.id.startsWith('rem-')) markAsDone(item.id.slice(4))
  }, [markAsDone])

  const snoozeItem = useCallback((item: FocusItem) => {
    if (item.id.startsWith('rem-')) void snooze(item.id.slice(4))
    else if (item.id.startsWith('match-')) void snoozeMatch(item.id.slice(6))
  }, [snooze])

  return { items, isLive, isLoading, completeItem, snoozeItem }
}
