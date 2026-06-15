// MEGGA CRM — Refonte « Aujourd'hui » · File de priorités RÉELLE (colonne Focus)
// ----------------------------------------------------------------------------
// Agrège « la priorité du moment » depuis le vrai CRM (logique validée 15 juin) :
//   1. Deals sous tension (usePipelineSugar : risk 'at-risk' / 'stalled')
//      → bien réel (coverPhoto + prix), contact résolu, type selon l'étape.
//   2. Reminders du jour échus/à échoir (useReminders : pending/triggered, dus
//      aujourd'hui ou avant) → relance / KYC selon le type du reminder.
// Ordre : urgents (en retard) d'abord, puis par échéance.
//
// UI-first (option B validée) : la file alimente FocusColumn/FocusMode qui la
// font avancer LOCALEMENT (Fait / Replanifier). Les écritures réelles
// (markAsDone / snooze des reminders, etc.) sont un fast-follow — `markAsDone` et
// `snooze` existent déjà sur useReminders.
//
// Fallback : si aucun item réel (ou session non authentifiée), le composant
// retombe sur le seed FOCUS_QUEUE pour garder la démo utilisable.

import { useMemo } from 'react'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useReminders } from '@/hooks/useReminders'
import { crmContactById, crmBienById } from '@/components/crm-sugar/mockData'
import type { StageId } from '@/components/crm-sugar/tokens'
import type { FocusItem } from './focusQueue'
import { PHOTO, fmtCHF } from './data'

// Item de file = FocusItem + clés de tri internes.
type QueueItem = FocusItem & { _due: number; _urgent: number }

const PLACEHOLDER_PHOTO = PHOTO.champel

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
function dueMs(iso: string | null | undefined): number {
  return iso ? new Date(iso).getTime() : Date.now() + 36e5
}
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
}
function relEta(ms: number): string {
  const diffMin = Math.round((ms - Date.now()) / 60000)
  if (diffMin < 0) {
    const d = Math.abs(diffMin)
    return d < 60 ? `en retard de ${d} min` : `en retard de ${Math.round(d / 60)} h`
  }
  if (diffMin < 60) return `dans ${diffMin} min`
  return `dans ${Math.round(diffMin / 60)} h`
}

// Étape du deal → type d'action (bouton) + libellé de catégorie.
function dealType(stage: StageId): { type: string; kind: string } {
  if (stage === 'offer' || stage === 'interest-confirmed') return { type: 'offer', kind: 'OFFRE' }
  if (stage === 'signed') return { type: 'sign', kind: 'MANDAT' }
  return { type: 'call', kind: 'RELANCE' }
}

// Type de reminder → type d'action.
function reminderType(t: string): { type: string; kind: string } {
  if (t === 'missing_document') return { type: 'kyc', kind: 'KYC' }
  if (t === 'price_change') return { type: 'offer', kind: 'OFFRE' }
  return { type: 'call', kind: 'RELANCE' }
}

export interface UseFocusQueueResult {
  items: FocusItem[]
  isLive: boolean
}

export function useFocusQueue(): UseFocusQueueResult {
  const { deals, isLoading: dealsLoading } = usePipelineSugar()
  const { reminders, isLoading: remLoading } = useReminders()

  const items = useMemo<QueueItem[]>(() => {
    const out: QueueItem[] = []
    // Snapshot du temps courant : la file est volontairement FIGÉE à l'instant
    // du calcul (urgence/échéance), et recalculée quand deals/reminders changent
    // (refetch 60 s). Un ref stable est requis : sinon FocusColumn se reset à
    // chaque render. C'est donc un usage intentionnel — on tait la règle purity.
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    const endOfToday = new Date()
    endOfToday.setHours(23, 59, 59, 999)
    const endMs = endOfToday.getTime()

    // 1. Deals sous tension
    for (const d of deals) {
      if (d.risk !== 'at-risk' && d.risk !== 'stalled') continue
      const c = crmContactById(d.contactId)
      const b = d.bienId ? crmBienById(d.bienId) : undefined
      const { type, kind } = dealType(d.stage)
      const due = dueMs(d.nextAction?.dueAt)
      const urgent = d.risk === 'at-risk' || due < now
      const contact = c ? `${c.firstName} ${c.lastName}`.trim() : 'Contact'
      out.push({
        id: `deal-${d.id}`,
        type,
        contact,
        initials: c ? initialsOf(contact) : '··',
        av: c?.avatarBg || '#6F8CFF',
        kind,
        time: fmtTime(d.nextAction?.dueAt),
        eta: relEta(due),
        sub: d.nextAction?.note || (b?.title ? `${b.title} — deal sous tension.` : 'Deal sous tension — à traiter.'),
        urgent,
        bien: { photo: b?.coverPhoto || PLACEHOLDER_PHOTO, price: fmtCHF(d.value) },
        _due: due,
        _urgent: urgent ? 1 : 0,
      })
    }

    // 2. Reminders du jour (échus ou à échoir aujourd'hui), encore actifs
    for (const r of reminders) {
      if (r.status !== 'pending' && r.status !== 'triggered') continue
      const due = dueMs(r.triggerAt)
      if (due > endMs) continue // après aujourd'hui → pas (encore) une priorité du jour
      const { type, kind } = reminderType(r.type)
      const urgent = due < now
      out.push({
        id: `rem-${r.id}`,
        type,
        contact: r.contactName || 'Contact',
        initials: initialsOf(r.contactName || ''),
        av: avFromId(r.contactId || r.id),
        kind,
        time: fmtTime(r.triggerAt),
        eta: relEta(due),
        sub: r.description || r.title || (kind === 'KYC' ? "Vérification d'identité à compléter." : 'À relancer.'),
        urgent,
        bien: { photo: PLACEHOLDER_PHOTO, price: r.propertyTitle ? r.propertyTitle : '—' },
        _due: due,
        _urgent: urgent ? 1 : 0,
      })
    }

    // Tri : urgents d'abord, puis par échéance croissante.
    return out.sort((a, b) => b._urgent - a._urgent || a._due - b._due)
  }, [deals, reminders])

  const isLive = !dealsLoading && !remLoading && items.length > 0
  return { items, isLive }
}
