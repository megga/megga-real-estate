// MEGGA CRM Sugar — Calendrier (refonte « façon Google »)
// Orchestrateur : cadre bento mono-page (rail mini-mois + filtres · carte
// principale toolbar + grille). Vues Jour / Semaine (défaut) / Mois, drag&drop,
// bulle détail, modale création/édition, créneaux « Occupé » externes.
// Source de vérité : Supabase (visites + reminders via useCalendarSugar) +
// agendas externes Google/Outlook (« Occupé », lecture seule).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { crmSugarPalette, type DarkTone, sugarThemeTokens, SUGAR_DARK_TONE } from '@/components/crm-sugar/tokens'
import { SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { CalIcon } from './CalIcon'
import { CalCircleBtn, CalViewToggle, type CalViewId } from './CalToolbar'
import { CalWeekView } from './CalWeekView'
import { CalDayView } from './CalDayView'
import { CalMonthView } from './CalMonthView'
import { CalRail } from './CalRail'
import { CalEventPopover } from './CalEventPopover'
import { CalEditModal, type CalEditing } from './CalEditModal'
import {
  buildCalPalette, calBlankEvent, calExpandEvents, calMasterId, CalPaletteContext,
  calTypeStyle, useCalPalette, type CalEvent, type CalSugarPalette,
} from './data'
import { calMonths, calShortTitle, fmtDate, fmtTime } from './helpers'
import { useCalendarSugar } from '@/hooks/useCalendarSugar'
import { useCalendarExternal } from '@/hooks/useCalendarExternal'
import { useVisits } from '@/hooks/useVisits'
import { useReminders } from '@/hooks/useReminders'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

const DARK_TONE: DarkTone = SUGAR_DARK_TONE
// Marge (jours) sous la fenêtre de lecture de useCalendarSugar (today ±60 j) :
// en-deçà, un événement créé est forcément refetché → on peut retirer l'override.
const CAL_READ_WINDOW_DAYS = 55

// ─── Toast confirmation + synchro ───────────────────────────────────────────
interface ToastData { key: number; change: string; tone?: string; toneColor?: string | null }

function CalSyncToast({ data, onDone }: { data: ToastData; onDone: () => void }) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const [phase, setPhase] = useState<'sync' | 'done'>('sync')
  useEffect(() => {
    setPhase('sync')
    const t1 = setTimeout(() => setPhase('done'), 950)
    const t2 = setTimeout(onDone, 3200)
    return () => { clearTimeout(t1); clearTimeout(t2) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.key])
  const dk = SP.isDark
  const TONES: Record<string, [string, string]> = {
    danger: ['#C0392B', '#F0786C'],
    success: ['#0E9E6E', '#34C796'],
    info: ['#1E5BC6', '#5B8DEF'],
    cyan: ['#0891B2', '#22B0CE'],
    warn: ['#C45A00', '#E07A28'],
  }
  const pair = data.tone ? TONES[data.tone] : undefined
  const color = data.toneColor || (pair ? (dk ? pair[1] : pair[0]) : SP.accent)
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 26, zIndex: 999, transform: 'translateX(-50%)', animation: 'calToastIn .32s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: SP.card, color: SP.ink, borderRadius: 14, padding: '11px 17px 11px 12px', minWidth: 288, maxWidth: 460, boxShadow: dk ? SP.shadowHover : '0 20px 54px rgba(15,23,42,0.18), 0 4px 14px rgba(15,23,42,0.10)' }}>
        <div style={{ width: 28, height: 28, borderRadius: 999, flexShrink: 0, display: 'grid', placeItems: 'center', background: phase === 'done' ? color : 'transparent' }}>
          {phase === 'done'
            ? <CalIcon name="check" size={15} stroke="#FFFFFF" sw={3} />
            : <div style={{ width: 16, height: 16, borderRadius: 999, border: `2px solid ${dk ? 'rgba(255,255,255,0.16)' : 'rgba(11,12,14,0.12)'}`, borderTopColor: color, animation: 'calSpin .7s linear infinite' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color, fontWeight: 800 }}>{phase === 'done' ? t('toast.synced') : t('toast.syncing')}</span>
            <span style={{ color: SP.muted }}>{' · ' + data.change}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Toolbar (barre du haut, dans le bento) ─────────────────────────────────
interface ToolbarProps {
  view: CalViewId
  onView: (v: CalViewId) => void
  headerLabel: string
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onCreate: () => void
}
function CalToolbar({ view, onView, headerLabel, onToday, onPrev, onNext, onCreate }: ToolbarProps) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 20px', borderBottom: `1px solid ${SP.line}`, flexShrink: 0 }}>
      <button onClick={onToday} style={{ height: 38, padding: '0 16px', borderRadius: 999, border: 0, background: SP.cardSubtle, color: SP.ink, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
        {t('common:time.today', { defaultValue: 'Aujourd\'hui' })}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        <CalCircleBtn icon={<CalIcon name="chevL" size={17} stroke={SP.inkSoft} />} onClick={onPrev} title={t('common:actions.previous', { defaultValue: 'Précédent' })} size={38} />
        <CalCircleBtn icon={<CalIcon name="chevR" size={17} stroke={SP.inkSoft} />} onClick={onNext} title={t('common:actions.next', { defaultValue: 'Suivant' })} size={38} />
      </div>
      <div style={{ fontSize: 21, fontWeight: 800, color: SP.ink, letterSpacing: -0.5, marginLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{headerLabel}</div>
      <div style={{ flex: 1 }} />
      <CalViewToggle value={view} onChange={onView} />
      <button onClick={onCreate} style={{ height: 40, padding: '0 18px', borderRadius: 999, border: 0, background: SP.accent, color: SP.onAccent, fontFamily: 'inherit', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 7, boxShadow: SP.shadowSm, flexShrink: 0 }}>
        <CalIcon name="plus" size={15} stroke={SP.onAccent} sw={2.6} />{t('page.newEvent')}
      </button>
    </div>
  )
}

// ─── Invitation « Connectez votre agenda » ──────────────────────────────────
/** Actions de l'invitation ; `undefined` côté page = aucune invitation à montrer. */
export interface CalendarInvite {
  onConnectGoogle: () => void
  onConnectOutlook: () => void
  onDismiss: () => void
}

/**
 * Bandeau d'amorce de connexion Google/Outlook — écartable, jamais bloquant :
 * le calendrier reste utilisable sans agenda externe. Ne porte QUE l'amorce ;
 * le statut, la déconnexion et la synchro restent dans Réglages › Intégrations
 * (même partage que le rail, cf. en-tête de CalRail).
 */
function CalConnectBanner({ invite }: { invite: CalendarInvite }) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const btn: React.CSSProperties = {
    height: 28, padding: '0 12px', borderRadius: 999, border: `1px solid ${SP.line}`,
    background: 'transparent', color: SP.ink, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 11.5, fontWeight: 700, flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${SP.line}`, color: SP.ink }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('onboarding.title')}</div>
        <div style={{ fontSize: 11.5, color: SP.muted }}>{t('onboarding.privacy')}</div>
      </div>
      <button onClick={invite.onConnectGoogle} style={btn}>{t('onboarding.connectGoogle')}</button>
      <button onClick={invite.onConnectOutlook} style={btn}>{t('onboarding.connectOutlook')}</button>
      <button
        onClick={invite.onDismiss}
        title={t('common:actions.close', { defaultValue: 'Fermer' })}
        aria-label={t('common:actions.close', { defaultValue: 'Fermer' })}
        style={{ ...btn, width: 28, padding: 0, display: 'grid', placeItems: 'center', border: 0 }}
      >
        <CalIcon name="close" size={14} stroke={SP.muted} sw={2.2} />
      </button>
    </div>
  )
}

// ─── Orchestrateur ──────────────────────────────────────────────────────────
export interface CalendarAppProps {
  dark: boolean
  setDark: (v: boolean) => void
  /** Invitation à connecter un agenda externe ; absente si déjà connecté ou écartée. */
  invite?: CalendarInvite
}

export function CalendarApp({ dark, setDark, invite }: CalendarAppProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('calendar')
  const queryClient = useQueryClient()

  const tk = sugarThemeTokens(dark)
  const sp = crmSugarPalette(tk, dark, DARK_TONE)
  const SP: CalSugarPalette = buildCalPalette(dark, tk)

  // ── Données ──
  const { events, isError: calendarError, refetch: calendarRefetch } = useCalendarSugar()
  const { createVisit, updateVisit, deleteVisit } = useVisits()
  const { createReminder, markAsDone, cancel: cancelReminder } = useReminders()

  const [view, setView] = useState<CalViewId>('week')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [filters, setFilters] = useState<Record<string, boolean>>({})
  const [popover, setPopover] = useState<{ id: string; rect: DOMRect | null } | null>(null)
  const [editing, setEditing] = useState<CalEditing | null>(null)
  const [toast, setToast] = useState<ToastData | null>(null)

  // Couche interactive optimiste (édition/création/drag + statut + suppression).
  const [overrides, setOverrides] = useState<Record<string, CalEvent>>({})
  const [statuses, setStatuses] = useState<Record<string, 'done' | 'cancelled' | undefined>>({})
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set())

  // Fenêtre externe mémoïsée par mois (évite les refetch à chaque navigation).
  const ymKey = currentDate.getFullYear() * 12 + currentDate.getMonth()
  const extRange = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)
    const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 2, 0, 23, 59, 59)
    return { start, end }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ymKey])
  const { externalEvents, google, outlook } = useCalendarExternal(extRange, t('busy'))

  // Horloge live (ligne « maintenant »).
  const [liveNow, setLiveNow] = useState<Date>(() => new Date())
  useEffect(() => {
    // Horloge réelle re-synchronisée chaque minute (pas de dérive simulée).
    const id = window.setInterval(() => setLiveNow(new Date()), 60000)
    return () => window.clearInterval(id)
  }, [])

  // Réf. events à jour → handlers stables sans capturer `events`.
  const eventsRef = useRef<CalEvent[]>(events)
  eventsRef.current = events

  const eventToneColor = useCallback((ev: CalEvent | undefined | null): string | null => {
    if (!ev) return null
    if (ev.type === 'autre' && ev.color) return ev.color
    return calTypeStyle(ev, SP).accent
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dark])

  // Fusion render-time : Supabase + overrides, puis expansion des occurrences,
  // puis suppressions/statuts appliqués PAR OCCURRENCE (id complet master@date —
  // sinon agir sur une occurrence affecterait toute la série récurrente).
  const filtered = useMemo<CalEvent[]>(() => {
    const seen = new Set<string>()
    const merged: CalEvent[] = []
    for (const e of events) {
      seen.add(e.id)
      merged.push(overrides[e.id] ?? e)
    }
    for (const id of Object.keys(overrides)) {
      if (!seen.has(id)) merged.push(overrides[id])
    }
    const all = [...merged, ...externalEvents]
    // Fenêtre d'expansion autour de la date affichée (±45 j).
    const winStart = new Date(currentDate); winStart.setDate(winStart.getDate() - 45); winStart.setHours(0, 0, 0, 0)
    const winEnd = new Date(currentDate); winEnd.setDate(winEnd.getDate() + 45); winEnd.setHours(23, 59, 59, 999)
    const expanded = calExpandEvents(all, winStart, winEnd)
    return expanded
      .filter(e => !deletedIds.has(e.id))
      .map(e => (e.id in statuses ? { ...e, status: statuses[e.id] } : e))
      .filter(e => (e.external ? true : filters[e.type] !== false))
  }, [events, overrides, statuses, deletedIds, externalEvents, filters, currentDate])

  const railEvents = useMemo(() => filtered.filter(e => !e.external), [filtered])

  // ── Interactions ──
  const selectEvent = useCallback((id: string, rect: DOMRect | null) => { setEditing(null); setPopover({ id, rect }) }, [])
  const closePopover = useCallback(() => setPopover(null), [])
  const openDay = useCallback((d: Date) => { setCurrentDate(new Date(d)); setView('day'); setPopover(null) }, [])

  const startCreate = useCallback(() => { setPopover(null); setEditing({ mode: 'create', draft: calBlankEvent(currentDate) }) }, [currentDate])
  const startCreateAt = useCallback((dateWithTime: Date) => {
    const base = calBlankEvent(currentDate)
    const start = new Date(dateWithTime)
    const end = new Date(start); end.setHours(end.getHours() + 1)
    setPopover(null)
    setEditing({ mode: 'create', draft: { ...base, start, end } })
  }, [currentDate])
  const startEdit = useCallback((id: string) => {
    const ev = eventsRef.current.find(e => e.id === calMasterId(id)) ?? overrides[calMasterId(id)]
    if (ev && !ev.external) { setPopover(null); setEditing({ mode: 'edit', draft: { ...ev } }) }
  }, [overrides])
  const cancelEdit = useCallback(() => setEditing(null), [])

  // Propage une visite MEGGA vers les agendas connectés (best-effort).
  const propagateVisit = useCallback((visitId: string, mode: 'create' | 'update' | 'delete') => {
    const run = async () => {
      try {
        if (mode === 'delete') {
          if (google.isConnected) await google.removeFromGoogle(visitId)
          if (outlook.isConnected) await outlook.removeFromOutlook(visitId)
        } else if (mode === 'update') {
          if (google.isConnected) await google.updateVisitInGoogle(visitId)
          if (outlook.isConnected) await outlook.updateVisitInOutlook(visitId)
        } else {
          if (google.isConnected) await google.syncVisitToGoogle(visitId)
          if (outlook.isConnected) await outlook.syncVisitToOutlook(visitId)
        }
      } catch { /* best-effort — la connexion peut être expirée */ }
    }
    void run()
  }, [google, outlook])

  const persistCreate = useCallback(async (draft: CalEvent) => {
    const isVisit = draft.type === 'visite' && draft.contactId && draft.bienId
    try {
      if (isVisit) {
        const created = await createVisit({
          id: draft.id, title: draft.title, start: draft.start, end: draft.end,
          meggaType: 'visit', contactId: draft.contactId ?? undefined, propertyId: draft.bienId ?? undefined,
          description: draft.notes, location: draft.location,
        } as unknown as CalendarEvent)
        await queryClient.invalidateQueries({ queryKey: ['calendar-sugar-visits'] })
        const newId = (created as { id?: string } | undefined)?.id
        if (newId) propagateVisit(newId, 'create')
      } else {
        await createReminder({
          type: 'custom', triggerAt: draft.start, title: draft.title,
          description: draft.notes ?? draft.location ?? undefined,
          contactId: draft.contactId ?? null, propertyId: draft.bienId ?? null,
        })
        await queryClient.invalidateQueries({ queryKey: ['calendar-sugar-reminders'] })
      }
      // Succès : si l'événement tombe dans la fenêtre lue par useCalendarSugar
      // (today ±60 j), le refetch l'a rapporté → on retire le brouillon optimiste
      // pour éviter un doublon. Hors fenêtre, on GARDE l'override (sinon l'événement
      // disparaîtrait : le refetch ne le contient pas).
      const inReadWindow = Math.abs(draft.start.getTime() - Date.now()) <= CAL_READ_WINDOW_DAYS * 86400000
      if (inReadWindow) {
        setOverrides(prev => {
          if (!(draft.id in prev)) return prev
          const next = { ...prev }
          delete next[draft.id]
          return next
        })
      }
    } catch { /* échec : on garde l'override (événement visible cette session) */ }
  }, [createVisit, createReminder, queryClient, propagateVisit])

  const persistTime = useCallback(async (ev: CalEvent, start: Date, end: Date) => {
    if (ev.origin !== 'visit') return // reminders : pas de reschedule libre → optimiste
    try {
      // Pas de visitStatus → mise à jour partielle : le statut serveur est préservé.
      await updateVisit({ id: calMasterId(ev.id), start, end } as unknown as CalendarEvent)
      await queryClient.invalidateQueries({ queryKey: ['calendar-sugar-visits'] })
      propagateVisit(calMasterId(ev.id), 'update')
    } catch { /* best-effort */ }
  }, [updateVisit, queryClient, propagateVisit])

  const saveEdit = useCallback((draft: CalEvent) => {
    const isCreate = editing?.mode === 'create'
    setOverrides(prev => ({ ...prev, [draft.id]: draft }))
    setEditing(null)
    setPopover(null)
    setToast({ key: Date.now(), change: `${calShortTitle(draft.title)} · ${isCreate ? t('toast.created') : t('toast.modified')}`, tone: isCreate ? 'success' : 'info', toneColor: eventToneColor(draft) })
    if (isCreate) void persistCreate(draft)
    else if (draft.origin === 'visit') void persistTime(draft, draft.start, draft.end)
  }, [editing, t, eventToneColor, persistCreate, persistTime])

  const deleteEvent = useCallback((id: string) => {
    const mid = calMasterId(id)
    const ev = eventsRef.current.find(e => e.id === mid) ?? overrides[mid]
    // Masque UNIQUEMENT l'occurrence ciblée (id complet), pas toute la série.
    setDeletedIds(prev => { const n = new Set(prev); n.add(id); return n })
    setPopover(null)
    setEditing(null)
    if (ev) setToast({ key: Date.now(), change: `${calShortTitle(ev.title)} · ${t('toast.deleted')}`, tone: 'danger' })
    if (ev?.origin === 'visit') {
      void (async () => {
        try { await deleteVisit(mid); await queryClient.invalidateQueries({ queryKey: ['calendar-sugar-visits'] }); propagateVisit(mid, 'delete') } catch { /* best-effort */ }
      })()
    } else if (ev?.origin === 'reminder') {
      cancelReminder(mid)
      void queryClient.invalidateQueries({ queryKey: ['calendar-sugar-reminders'] })
    }
  }, [overrides, t, deleteVisit, queryClient, propagateVisit, cancelReminder])

  // Drag live → override optimiste.
  const updateEventTime = useCallback((id: string, start: Date, end: Date) => {
    const mid = calMasterId(id)
    setPopover(p => (p && p.id === id ? null : p))
    setOverrides(prev => {
      const src = prev[mid] ?? eventsRef.current.find(e => e.id === mid)
      if (!src) return prev
      return { ...prev, [mid]: { ...src, start, end } }
    })
  }, [])
  // Fin de glissé → confirmation + persistance.
  const commitEventTime = useCallback((id: string, mode: 'move' | 'resize', start: Date, end: Date, title: string) => {
    const mid = calMasterId(id)
    const ev = overrides[mid] ?? eventsRef.current.find(e => e.id === mid)
    const change = mode === 'resize'
      ? `${calShortTitle(title)} · ${t('toast.durationChanged', { start: fmtTime(start), end: fmtTime(end) })}`
      : `${calShortTitle(title)} · ${t('toast.moved', { date: fmtDate(start), time: fmtTime(start) })}`
    setToast({ key: Date.now(), change, tone: 'cyan', toneColor: ev ? eventToneColor(ev) : null })
    if (ev) void persistTime(ev, start, end)
  }, [overrides, t, eventToneColor, persistTime])

  const setStatus = useCallback((id: string, status: 'done' | 'cancelled') => {
    const mid = calMasterId(id)
    const ev = eventsRef.current.find(e => e.id === mid) ?? overrides[mid]
    // Statut appliqué à l'occurrence ciblée (id complet), pas à toute la série.
    let nowOn = false
    setStatuses(prev => {
      nowOn = prev[id] !== status
      return { ...prev, [id]: prev[id] === status ? undefined : status }
    })
    if (ev) {
      const change = status === 'done'
        ? `${calShortTitle(ev.title)} · ${nowOn ? t('toast.markedDone') : t('toast.markedTodo')}`
        : `${calShortTitle(ev.title)} · ${nowOn ? t('toast.markedCancelled') : t('toast.reactivated')}`
      const tone = status === 'done' ? (nowOn ? 'success' : 'info') : (nowOn ? 'warn' : 'info')
      setToast({ key: Date.now(), change, tone, toneColor: eventToneColor(ev) })
      // Persistance best-effort.
      if (nowOn && ev.origin === 'visit' && status === 'done') {
        void (async () => { try { await updateVisit({ id: mid, start: ev.start, end: ev.end, visitStatus: 'done' } as unknown as CalendarEvent); await queryClient.invalidateQueries({ queryKey: ['calendar-sugar-visits'] }) } catch { /* */ } })()
      } else if (nowOn && ev.origin === 'reminder') {
        if (status === 'done') markAsDone(mid)
        else cancelReminder(mid)
      }
    }
  }, [overrides, t, eventToneColor, updateVisit, queryClient, markAsDone, cancelReminder])

  // ── Libellé d'en-tête ──
  const headerLabel = (() => {
    const months = calMonths()
    if (view === 'day') return `${fmtDate(currentDate)} ${currentDate.getFullYear()}`
    if (view === 'month') return `${months[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    const monday = new Date(currentDate); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6)
    if (monday.getMonth() === sunday.getMonth()) return `${months[monday.getMonth()]} ${monday.getFullYear()}`
    const m1 = (months[monday.getMonth()] || '').slice(0, 4) + '.'
    const m2 = (months[sunday.getMonth()] || '').slice(0, 4) + '.'
    if (monday.getFullYear() === sunday.getFullYear()) return `${m1} – ${m2} ${sunday.getFullYear()}`
    return `${m1} ${monday.getFullYear()} – ${m2} ${sunday.getFullYear()}`
  })()

  const navDate = (delta: number) => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate() + delta)
    else if (view === 'week') d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  const selectedEvent = popover ? (filtered.find(e => e.id === popover.id) ?? eventsRef.current.find(e => e.id === calMasterId(popover.id)) ?? null) : null

  const onCmd = () => { /* command palette — non câblé ici */ }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'calendar': break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings?tab=integrations'); break
      default:
    }
  }

  const commonView = {
    events: filtered, currentDate, now: liveNow, selectedId: popover?.id ?? null,
    onSelectEvent: selectEvent, onUpdateEvent: updateEventTime, onCommitEvent: commitEventTime,
    onCreateAt: startCreateAt, onDateChange: setCurrentDate, onOpenDay: openDay,
  }

  return (
    <CalPaletteContext.Provider value={SP}>
      <div style={{ position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: '"Inter Tight", system-ui, sans-serif', color: sp.ink }}>
        <style>{SUGAR_KEYFRAMES}</style>
        <style>{`
          @keyframes calPopIn { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
          @keyframes calToastIn { from { opacity: 0; transform: translateX(-50%) translateY(14px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
          @keyframes calSpin { to { transform: rotate(360deg); } }
        `}</style>

        <SugarTopNav active="calendar" t={tk} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <SugarIconRail active="calendar" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />

          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
            <div style={{
              position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden',
              border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg,
              display: 'grid', gridTemplateColumns: '296px 1fr', gridTemplateRows: '1fr', minHeight: 0,
            }}>
              {/* Rail gauche */}
              <aside style={{ padding: '24px 22px', overflowY: 'auto', minHeight: 0 }}>
                <CalRail currentDate={currentDate} now={liveNow} onDateChange={setCurrentDate} events={railEvents} filters={filters} onFilters={setFilters} />
              </aside>

              {/* Carte principale */}
              <div style={{ padding: '14px 14px 14px 0', minHeight: 0, display: 'flex' }}>
                <div style={{ flex: 1, minWidth: 0, background: SP.card, borderRadius: 22, boxShadow: sp.shadow, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <CalToolbar view={view} onView={setView} headerLabel={headerLabel} onToday={() => setCurrentDate(new Date())} onPrev={() => navDate(-1)} onNext={() => navDate(1)} onCreate={startCreate} />
                  {calendarError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', borderBottom: `1px solid ${SP.line}`, color: SP.ink }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700 }}>{t('page.error.title')}</div>
                        <div style={{ fontSize: 11.5, color: SP.muted }}>{t('page.error.message')}</div>
                      </div>
                      <button onClick={() => calendarRefetch()} style={{ height: 28, padding: '0 12px', borderRadius: 999, border: `1px solid ${SP.line}`, background: 'transparent', color: SP.ink, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
                        {t('page.error.retry')}
                      </button>
                    </div>
                  )}
                  {invite && <CalConnectBanner invite={invite} />}
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {view === 'day' && <CalDayView {...commonView} />}
                    {view === 'week' && <CalWeekView {...commonView} />}
                    {view === 'month' && <CalMonthView events={filtered} currentDate={currentDate} now={liveNow} selectedId={popover?.id ?? null} onSelectEvent={selectEvent} onDateChange={setCurrentDate} onOpenDay={openDay} onCreateAt={startCreateAt} />}
                  </div>
                </div>
              </div>
            </div>
          </main>
        </div>

        {popover && selectedEvent && (
          <CalEventPopover event={selectedEvent} anchorRect={popover.rect} allEvents={filtered} onClose={closePopover} onEdit={startEdit} onDelete={deleteEvent} onStatus={setStatus} />
        )}

        {editing && (
          <CalEditModal editing={editing} onSave={saveEdit} onCancel={cancelEdit} onDelete={deleteEvent} />
        )}

        {toast && <CalSyncToast key={toast.key} data={toast} onDone={() => setToast(null)} />}
      </div>
    </CalPaletteContext.Provider>
  )
}
