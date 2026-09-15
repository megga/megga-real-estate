// MEGGA CRM Sugar — Calendrier (refonte « façon Google »)
// Orchestrateur : cadre bento mono-page (rail mini-mois + filtres · carte
// principale toolbar + grille). Vues Jour / Semaine (défaut) / Mois, glisser-déposer
// d'une heure et d'un jour à l'autre (visites ET tâches, enregistrés), bulle détail,
// modale création/édition, créneaux « Occupé » externes.
// Source de vérité : Supabase (visites + reminders via useCalendarScreen) +
// agendas externes Google/Outlook (« Occupé », lecture seule). Libellés de
// l'agence (useCalendarLabels) : rail, clic droit sur un bloc, bulle.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { crmPalette, crmVoileEncre } from '@/components/crm/tokens'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import { CalIcon } from './CalIcon'
import { CalCircleBtn, CalViewToggle, type CalViewId } from './CalToolbar'
import { CalWeekView } from './CalWeekView'
import { CalDayView } from './CalDayView'
import { CalMonthView } from './CalMonthView'
import { CalRail } from './CalRail'
import { CalEventPopover } from './CalEventPopover'
import { CalEditModal, type CalEditing } from './CalEditModal'
import { CalEventLabelMenu, CalLabelSection } from './CalLabels'
import {
  buildCalPalette, calAppliquerLibelles, calBlankEvent, calCompteParLibelle, CalEventMenuContext, calExpandEvents,
  calMasterId, CalPaletteContext, calTypeStyle, useCalPalette, type CalEvent, type CalEventLabel, type CalPalette,
} from './data'
import { calDays, calMonths, calMonthsShort, calShortTitle, fmtDate, fmtTime } from './helpers'
import { majusculeInitiale } from '@/lib/utils'
import { useCalendarScreen } from '@/hooks/useCalendarScreen'
import { useCalendarExternal } from '@/hooks/useCalendarExternal'
import { useVisits } from '@/hooks/useVisits'
import { useReminders } from '@/hooks/useReminders'
import { useCalendarLabels } from '@/hooks/useCalendarLabels'
import { useCalendarEvents } from '@/hooks/useCalendarEvents'
import { evenementDepuisBrouillon, lireBrouillonCalendrier, oublierBrouillonCalendrier, versLigneEvenement } from '@/lib/calendrierEvenements'
import { MailLabelMenu } from '@/components/crm/messagerie/MailLabelMenu'
import { mailSurfaces } from '@/components/crm/messagerie/mailTokens'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

// Marge (jours) sous la fenêtre de lecture de useCalendarScreen (today ±60 j) :
// en-deçà, un événement créé est forcément refetché → on peut retirer l'override.
const CAL_READ_WINDOW_DAYS = 55

// ─── Toast confirmation + synchro ───────────────────────────────────────────
/**
 * `echec` : le geste a ÉCHOUÉ. ⛔ Sans lui, le toast disait « ✓ Synchronisé ·
 * … · Libellé non enregistré » — une coche verte sur un refus.
 */
interface ToastData { key: number; change: string; tone?: string; toneColor?: string | null; echec?: boolean }

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
  const pair = data.echec ? TONES.danger : data.tone ? TONES[data.tone] : undefined
  const color = (!data.echec && data.toneColor) || (pair ? (dk ? pair[1] : pair[0]) : SP.accent)
  return (
    <div style={{ position: 'fixed', left: '50%', bottom: 26, zIndex: 999, transform: 'translateX(-50%)', animation: 'calToastIn .32s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', background: SP.card, color: SP.ink, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-lg) var(--crm-space-3xl) var(--crm-space-lg) var(--crm-space-xl)', minWidth: 288, maxWidth: 460, boxShadow: dk ? SP.shadowHover : `0 20px 54px ${crmVoileEncre(false, 0.18)}, 0 4px 14px ${crmVoileEncre(false, 0.10)}` }}>
        <div style={{ width: 28, height: 28, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, display: 'grid', placeItems: 'center', background: phase === 'done' || data.echec ? color : 'transparent' }}>
          {data.echec
            ? <CalIcon name="warn" size={15} stroke="#FFFFFF" sw={2.4} />
            : phase === 'done'
            ? <CalIcon name="check" size={15} stroke="#FFFFFF" sw={3} />
            : <div style={{ width: 16, height: 16, borderRadius: 'var(--crm-radius-pill)', border: `2px solid ${dk ? 'rgba(255,255,255,0.16)' : crmVoileEncre(false, 0.12)}`, borderTopColor: color, animation: 'calSpin .7s linear infinite' }} />}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
            {data.echec
              ? <span style={{ color: SP.ink }}>{data.change}</span>
              : <>
                <span style={{ color, fontWeight: 500 }}>{phase === 'done' ? t('toast.synced') : t('toast.syncing')}</span>
                <span style={{ color: SP.muted }}>{' · ' + data.change}</span>
              </>}
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
  /** La même période en mois abrégés — pris quand la barre manque de place. */
  headerLabelShort: string
  onToday: () => void
  onPrev: () => void
  onNext: () => void
  onCreate: () => void
}
function CalToolbar({ view, onView, headerLabel, headerLabelShort, onToday, onPrev, onNext, onCreate }: ToolbarProps) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  return (
    <div className="cal-toolbar" style={{ padding: 'var(--crm-space-xl) var(--crm-space-5xl)', borderBottom: `1px solid ${SP.line}`, flexShrink: 0 }}>
    <div className="cal-toolbar-row" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
      {/* ⚠ Le titre de la période est ce qui cède quand la barre manque de place — il
          se lisait « Septembre 2… » à 1440 px, barre latérale dépliée (~770 px utiles
          pour ~835 demandés). Sous le seuil, c'est le bouton de création qui se
          replie en « + » rond : son libellé reste dans `aria-label` et `title`. */}
      <style>{`
        .cal-toolbar { container-type: inline-size; }
        .cal-toolbar .cal-title-short { display: none; }
        @container (max-width: 880px) {
          .cal-toolbar .cal-new-label { display: none; }
          .cal-toolbar .cal-new-btn { aspect-ratio: 1; padding-inline: 0 !important; justify-content: center; }
        }
        /* Second cran (1280 px, barre latérale dépliée) : le « + » ne suffit plus, le
           mois passe en abrégé — « Sept. 2026 » plutôt que « Septembre… ». */
        @container (max-width: 760px) {
          .cal-toolbar .cal-title-long { display: none; }
          .cal-toolbar .cal-title-short { display: inline; }
        }
        /* Troisième cran (1024 px, barre repliée) : même abrégé, le titre tombait à
           « S… ». Il passe sur sa propre ligne, au-dessus des commandes. */
        @container (max-width: 590px) {
          .cal-toolbar .cal-toolbar-row { flex-wrap: wrap; row-gap: var(--crm-space-sm); }
          .cal-toolbar .cal-title { order: -1; flex-basis: 100%; margin-left: 0 !important; }
          /* Seul sur sa ligne, le titre a de nouveau la place de s'écrire en entier. */
          .cal-toolbar .cal-title-long { display: inline; }
          .cal-toolbar .cal-title-short { display: none; }
        }
      `}</style>
      <button onClick={onToday} style={{ height: 38, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: SP.cardSubtle, color: SP.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
        {t('common:time.today', { defaultValue: 'Aujourd\'hui' })}
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', flexShrink: 0 }}>
        <CalCircleBtn icon={<CalIcon name="chevL" size={17} stroke={SP.inkSoft} />} onClick={onPrev} title={t('common:actions.previous', { defaultValue: 'Précédent' })} size={38} />
        <CalCircleBtn icon={<CalIcon name="chevR" size={17} stroke={SP.inkSoft} />} onClick={onNext} title={t('common:actions.next', { defaultValue: 'Suivant' })} size={38} />
      </div>
      <div className="cal-title" style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: SP.ink, letterSpacing: -0.5, marginLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span className="cal-title-long">{headerLabel}</span>
        <span className="cal-title-short">{headerLabelShort}</span>
      </div>
      <div style={{ flex: 1 }} />
      <CalViewToggle value={view} onChange={onView} />
      <button className="cal-new-btn" onClick={onCreate} aria-label={t('page.newEvent')} title={t('page.newEvent')} style={{ height: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, background: SP.accent, color: SP.onAccent, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', boxShadow: SP.shadowSm, flexShrink: 0 }}>
        <CalIcon name="plus" size={15} stroke={SP.onAccent} sw={2.6} /><span className="cal-new-label">{t('page.newEvent')}</span>
      </button>
    </div>
    </div>
  )
}

// ─── Invitation « Connectez votre agenda » ──────────────────────────────────
/** Actions de l'invitation ; `undefined` côté page = aucune invitation à montrer. */
export interface CalendarInvite {
  onConnectGoogle: () => void
  onConnectOutlook: () => void
  onDismiss: () => void
  /** Échec de la dernière tentative de connexion (sinon la redirection a lieu). */
  error?: string | null
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
    height: 28, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${SP.line}`,
    background: 'transparent', color: SP.ink, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 'var(--crm-text-sm)', fontWeight: 500, flexShrink: 0,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-5xl)', borderBottom: `1px solid ${SP.line}`, color: SP.ink }}>
      {/* Une seule ligne. Le titre disait « Connectez votre agenda » au-dessus de
          deux boutons intitulés « Connecter Google » et « Connecter Outlook » :
          il redisait ce qu'ils annoncent. Ce qui reste ne se lit nulle part
          ailleurs — la garantie de confidentialité, et, le cas échéant, la
          raison d'un échec de connexion (le slot porte les DEUX). */}
      <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', color: invite.error ? SP.dangerInk : SP.muted }}>
        {invite.error ? t('onboarding.connectFailed', { error: invite.error }) : t('onboarding.privacy')}
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
  const { t } = useTranslation('calendar')
  const queryClient = useQueryClient()

  const sp = crmPalette(dark)
  const SP: CalPalette = buildCalPalette(dark)

  // ── Données ──
  const { events, isError: calendarError, refetch: calendarRefetch } = useCalendarScreen()
  const { createVisit, updateVisit, deleteVisit } = useVisits()
  const evenements = useCalendarEvents()
  const { createReminder, markAsDone, cancel: cancelReminder, reschedule: rescheduleReminder } = useReminders()
  const calLabels = useCalendarLabels()
  // Le créateur et le menu des libellés sont ceux de la Messagerie : ils se
  // peignent avec ses surfaces, dérivées de la même palette MEGGA X.
  const ms = mailSurfaces(sp, dark)

  const [view, setView] = useState<CalViewId>('week')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [filters, setFilters] = useState<Record<string, boolean>>({})
  /** Libellés masqués du rail (`false`), comme les types juste au-dessus. */
  const [labelShown, setLabelShown] = useState<Record<string, boolean>>({})
  const [labelCreator, setLabelCreator] = useState<{ open: boolean; editId: string | null }>({ open: false, editId: null })
  /** Clic droit sur un libellé du rail. */
  const [labelCtx, setLabelCtx] = useState<{ id: string; x: number; y: number } | null>(null)
  /** Clic droit sur un événement (ou la ligne « Libellé » de sa bulle). */
  const [eventLabelCtx, setEventLabelCtx] = useState<{ id: string; x: number; y: number } | null>(null)
  const [popover, setPopover] = useState<{ id: string; rect: DOMRect | null } | null>(null)
  /**
   * Un e-mail à planifier (Messagerie, 15.09.2026) : `?nouveau=1` ouvre la création
   * pré-remplie du brouillon que la Messagerie a déposé EN MÉMOIRE. Lu à l'initialisation,
   * comme l'`openWizard` du KYC ; l'effet qui suit l'oublie et retire le paramètre — une
   * relecture de l'écran ne rouvrira pas la modale.
   */
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<CalEditing | null>(() => {
    if (params.get('nouveau') !== '1') return null
    const b = lireBrouillonCalendrier()
    return b ? { mode: 'create', draft: evenementDepuisBrouillon(b) } : null
  })
  useEffect(() => {
    if (params.get('nouveau') !== '1') return
    oublierBrouillonCalendrier()
    const suite = new URLSearchParams(params)
    suite.delete('nouveau')
    setParams(suite, { replace: true })
  }, [params, setParams])
  const [toast, setToast] = useState<ToastData | null>(null)

  // Couche interactive optimiste (édition/création/drag + statut + suppression).
  const [overrides, setOverrides] = useState<Record<string, CalEvent>>({})
  const [statuses, setStatuses] = useState<Record<string, 'done' | 'cancelled' | undefined>>({})
  // Lu par la replanification d'une tâche : une tâche faite ou annulée ne se rouvre pas.
  const statusesRef = useRef(statuses)
  useEffect(() => { statusesRef.current = statuses }, [statuses])
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
  const labelById = useMemo(
    () => new Map<string, CalEventLabel>(calLabels.labels.map(l => [l.id, { id: l.id, name: l.name, color: l.color }])),
    [calLabels.labels],
  )

  const labelled = useMemo<CalEvent[]>(() => {
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
    const vivants = expanded
      .filter(e => !deletedIds.has(e.id))
      .map(e => (e.id in statuses ? { ...e, status: statuses[e.id] } : e))
    return calAppliquerLibelles(vivants, calLabels.assignments, labelById)
  }, [events, overrides, statuses, deletedIds, externalEvents, currentDate, calLabels.assignments, labelById])

  // Un événement est masqué par son TYPE ou par son LIBELLÉ — les deux filtres du rail.
  const filtered = useMemo<CalEvent[]>(
    () => labelled.filter(e => (e.external ? true : filters[e.type] !== false && !(e.label && labelShown[e.label.id] === false))),
    [labelled, filters, labelShown],
  )
  // Le compteur d'un libellé ne tombe pas à zéro quand on le masque : il dit ce
  // que le filtre cache, pas ce qui reste affiché.
  const labelCounts = useMemo(() => calCompteParLibelle(labelled), [labelled])

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
        await queryClient.invalidateQueries({ queryKey: ['calendar-visits'] })
        const newId = (created as { id?: string } | undefined)?.id
        if (newId) propagateVisit(newId, 'create')
      } else if (draft.type === 'task') {
        // Une TÂCHE reste une relance : elle entre dans « Relances du jour ».
        await createReminder({
          type: 'custom', triggerAt: draft.start, title: draft.title,
          description: draft.notes ?? draft.location ?? undefined,
          contactId: draft.contactId ?? null, propertyId: draft.bienId ?? null,
        })
        await queryClient.invalidateQueries({ queryKey: ['calendar-reminders'] })
      } else {
        // ⛔ Tout le reste est un ÉVÉNEMENT, gardé tel qu'on l'a saisi (20260915080300).
        // Il partait en relance, et revenait « Tâche » au rechargement.
        await evenements.creer(draft)
      }
      // Succès : si l'événement tombe dans la fenêtre lue par useCalendarScreen
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
  }, [createVisit, createReminder, evenements, queryClient, propagateVisit])

  /**
   * Enregistre un nouvel horaire ; rend `false` en échec.
   *
   * ⛔ Une TÂCHE (`reminder`) ne s'enregistrait pas : elle se déplaçait à l'écran, et le
   * rechargement la ramenait à sa place sans un mot. Et un échec était avalé : un bloc
   * laissé à sa nouvelle place quand la base l'a refusé montre un agenda qui n'existe
   * pas. L'appelant le DIT désormais, et remet l'événement à sa place (`revertTime`).
   * Un RDV KYC (`appointment`) n'arrive jamais ici : `calDeplacable` ne le laisse pas
   * saisir — le client, qui l'a réservé, doit être prévenu.
   */
  const persistTime = useCallback(async (ev: CalEvent, start: Date, end: Date): Promise<boolean> => {
    const mid = calMasterId(ev.id)
    try {
      if (ev.origin === 'visit') {
        // Pas de visitStatus → mise à jour partielle : le statut serveur est préservé.
        await updateVisit({ id: mid, start, end } as unknown as CalendarEvent)
        await queryClient.invalidateQueries({ queryKey: ['calendar-visits'] })
        propagateVisit(mid, 'update')
      } else if (ev.origin === 'reminder') {
        await rescheduleReminder(mid, start, { closed: !!statusesRef.current[ev.id] })
        await queryClient.invalidateQueries({ queryKey: ['calendar-reminders'] })
      } else if (ev.origin === 'event') {
        await evenements.modifier(mid, { starts_at: start.toISOString(), ends_at: end.toISOString() })
      }
      return true
    } catch {
      return false
    }
  }, [updateVisit, rescheduleReminder, evenements, queryClient, propagateVisit])

  /** L'horaire n'a pas pu être enregistré : l'événement reprend sa place, et le toast le dit. */
  const revertTime = useCallback((mid: string, title: string) => {
    setOverrides(prev => {
      if (!(mid in prev)) return prev
      const next = { ...prev }
      delete next[mid]
      return next
    })
    setToast({ key: Date.now(), change: `${calShortTitle(title)} · ${t('toast.moveFailed')}`, echec: true })
  }, [t])

  const saveEdit = useCallback((draft: CalEvent) => {
    const isCreate = editing?.mode === 'create'
    setOverrides(prev => ({ ...prev, [draft.id]: draft }))
    setEditing(null)
    setPopover(null)
    setToast({ key: Date.now(), change: `${calShortTitle(draft.title)} · ${isCreate ? t('toast.created') : t('toast.modified')}`, tone: isCreate ? 'success' : 'info', toneColor: eventToneColor(draft) })
    if (isCreate) { void persistCreate(draft); return }
    // Une tâche n'est réécrite que si son horaire a bougé : la réécrire pour un titre
    // la rouvrirait (`pending`) sans raison.
    const src = eventsRef.current.find(e => e.id === calMasterId(draft.id))
    const horaireChange = !src || src.start.getTime() !== draft.start.getTime()
    if (draft.origin === 'visit' || (draft.origin === 'reminder' && horaireChange)) {
      void persistTime(draft, draft.start, draft.end).then(ok => { if (!ok) revertTime(calMasterId(draft.id), draft.title) })
    } else if (draft.origin === 'event') {
      // Un événement se réécrit EN ENTIER : titre, type, lieu, notes, récurrence — pas
      // seulement son horaire, comme une visite ou une tâche.
      const mid = calMasterId(draft.id)
      void evenements.modifier(mid, versLigneEvenement(draft)).catch(() => {
        setOverrides(prev => { if (!(mid in prev)) return prev; const next = { ...prev }; delete next[mid]; return next })
        setToast({ key: Date.now(), change: `${calShortTitle(draft.title)} · ${t('toast.saveFailed')}`, echec: true })
      })
    }
  }, [editing, t, eventToneColor, persistCreate, persistTime, revertTime, evenements])

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
        try { await deleteVisit(mid); await queryClient.invalidateQueries({ queryKey: ['calendar-visits'] }); propagateVisit(mid, 'delete') } catch { /* best-effort */ }
      })()
    } else if (ev?.origin === 'reminder') {
      cancelReminder(mid)
      void queryClient.invalidateQueries({ queryKey: ['calendar-reminders'] })
    } else if (ev?.origin === 'event') {
      // Une série se supprime entière : ses occurrences ne sont pas des lignes.
      void evenements.supprimer(mid).catch(() => {
        setDeletedIds(prev => { const n = new Set(prev); n.delete(id); return n })
        setToast({ key: Date.now(), change: `${calShortTitle(ev.title)} · ${t('toast.deleteFailed')}`, echec: true })
      })
    }
  }, [overrides, t, deleteVisit, queryClient, propagateVisit, cancelReminder, evenements])

  // Un glissé part : la bulle ouverte se ferme (elle resterait accrochée au point de départ).
  const dragStartEvent = useCallback((_id: string) => setPopover(null), [])

  // Glissé (relâché, ou pas à pas du redimensionnement) → override optimiste.
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
    // Un déplacement ne se confirme que par son point d'arrivée — le jour, le mois et
    // l'heure (Julien, 14.09.2026) : le titre et le verbe redisaient ce que le geste
    // venait de montrer, et repoussaient la date en bout de ligne.
    const change = mode === 'resize'
      ? `${calShortTitle(title)} · ${t('toast.durationChanged', { start: fmtTime(start), end: fmtTime(end) })}`
      : t('toast.moved', { date: fmtDate(start), time: fmtTime(start) })
    setToast({ key: Date.now(), change, tone: 'cyan', toneColor: ev ? eventToneColor(ev) : null })
    if (ev) void persistTime(ev, start, end).then(ok => { if (!ok) revertTime(mid, title) })
  }, [overrides, t, eventToneColor, persistTime, revertTime])

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
        void (async () => { try { await updateVisit({ id: mid, start: ev.start, end: ev.end, visitStatus: 'done' } as unknown as CalendarEvent); await queryClient.invalidateQueries({ queryKey: ['calendar-visits'] }) } catch { /* */ } })()
      } else if (nowOn && ev.origin === 'reminder') {
        if (status === 'done') markAsDone(mid)
        else cancelReminder(mid)
      } else if (ev.origin === 'event') {
        // Réversible dans les deux sens : l'événement porte son statut, il ne s'éteint pas.
        void evenements.modifier(mid, { status: nowOn ? status : null }).catch(() => { /* best-effort, comme les autres sources */ })
      }
    }
  }, [overrides, t, eventToneColor, updateVisit, queryClient, markAsDone, cancelReminder, evenements])

  // ── Libellés ──
  // ⚠ Les surcharges lues par RÉFÉRENCE : le gestionnaire du clic droit descend aux
  // blocs par un contexte, et une valeur qui change à chaque pas d'un glissé
  // (les surcharges) rendait TOUS les blocs, `memo` compris, à chaque pas.
  const overridesRef = useRef(overrides)
  useEffect(() => { overridesRef.current = overrides }, [overrides])

  /** L'événement MAÎTRE d'une occurrence, s'il peut porter un libellé (enregistré, non externe). */
  const labellable = useCallback((id: string): CalEvent | null => {
    const mid = calMasterId(id)
    const ev = eventsRef.current.find(e => e.id === mid) ?? overridesRef.current[mid]
    return ev && !ev.external && ev.origin ? ev : null
  }, [])

  const openEventLabelMenu = useCallback((id: string, x: number, y: number) => {
    if (!labellable(id)) return
    setEventLabelCtx({ id, x, y })
  }, [labellable])

  const pickEventLabel = useCallback((id: string, labelId: string | null) => {
    const ev = labellable(id)
    if (!ev?.origin) return
    const l = labelId ? labelById.get(labelId) : null
    const titre = calShortTitle(ev.title)
    // `mutateAsync` et non `mutate` : les rappels par appel de TanStack ne se
    // déclenchent que pour le DERNIER appel — deux libellés posés vite, et l'échec
    // du premier passait sans un mot.
    calLabels.setEventLabel.mutateAsync({ source: ev.origin, eventId: calMasterId(id), labelId })
      .catch(() => setToast({ key: Date.now(), change: `${titre} · ${t('labels.failed')}`, echec: true }))
    // ⚠ Pas la couleur du libellé pour le toast : saisie, elle peut être pâle — le
    // mot « Synchronisé » et la coche blanche y tombaient sous 2:1.
    setToast({ key: Date.now(), change: `${titre} · ${l ? t('labels.set', { name: l.name }) : t('labels.removed')}`, tone: 'info' })
  }, [labellable, labelById, calLabels.setEventLabel, t])

  const editLabel = calLabels.labels.find(l => l.id === labelCreator.editId) ?? null
  const closeLabelCreator = useCallback(() => setLabelCreator({ open: false, editId: null }), [])
  /** Un refus de la base, dit en clair : un nom déjà pris n'est pas une panne. */
  const toastEchecLibelle = useCallback((e: unknown) => {
    const code = (e as { code?: string } | null)?.code
    setToast({ key: Date.now(), change: code === '23505' ? t('labels.duplicate') : t('labels.failed'), echec: true })
  }, [t])
  /**
   * Créer, renommer ou recolorer — le même créateur, comme dans la Messagerie.
   * ⚠ En échec, le créateur RESTE ouvert avec la saisie : le refermer faisait
   * croire au succès (un nom en double disparaissait sans un mot).
   */
  const saveLabel = useCallback((v: { name: string; color: string }) => {
    const ecriture = editLabel
      ? calLabels.update.mutateAsync({ id: editLabel.id, name: v.name, color: v.color })
      : calLabels.create.mutateAsync(v)
    ecriture.then(closeLabelCreator, toastEchecLibelle)
  }, [editLabel, calLabels.update, calLabels.create, closeLabelCreator, toastEchecLibelle])

  const deleteLabel = useCallback((id: string) => {
    const l = labelById.get(id)
    calLabels.remove.mutateAsync(id).then(() => {
      setLabelShown(prev => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n })
      if (l) setToast({ key: Date.now(), change: t('labels.deleted', { name: l.name }), tone: 'danger' })
    }, toastEchecLibelle)
  }, [labelById, calLabels.remove, t, toastEchecLibelle])

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
  const headerLabelShort = (() => {
    const ms = calMonthsShort()
    if (view === 'day') return majusculeInitiale(`${calDays()[currentDate.getDay()] ?? ''} ${currentDate.getDate()} ${ms[currentDate.getMonth()] ?? ''}`.trim())
    if (view === 'month') return majusculeInitiale(`${ms[currentDate.getMonth()]} ${currentDate.getFullYear()}`)
    const monday = new Date(currentDate); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
    const sunday = new Date(monday); sunday.setDate(sunday.getDate() + 6)
    if (monday.getMonth() === sunday.getMonth()) return majusculeInitiale(`${ms[monday.getMonth()]} ${monday.getFullYear()}`)
    return majusculeInitiale(`${ms[monday.getMonth()]} – ${ms[sunday.getMonth()]} ${sunday.getFullYear()}`)
  })()

  const navDate = (delta: number) => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate() + delta)
    else if (view === 'week') d.setDate(d.getDate() + delta * 7)
    else d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  // ⚠ Lu dans `labelled`, pas dans `filtered` : poser sur l'événement ouvert un
  // libellé MASQUÉ le retire de la grille, et la bulle retombait sur la ligne
  // brute — sans libellé, elle affichait « Ajouter un libellé ».
  const selectedEvent = popover ? (labelled.find(e => e.id === popover.id) ?? eventsRef.current.find(e => e.id === calMasterId(popover.id)) ?? null) : null

  const commonView = {
    events: filtered, currentDate, now: liveNow, selectedId: popover?.id ?? null,
    onSelectEvent: selectEvent, onUpdateEvent: updateEventTime, onCommitEvent: commitEventTime,
    onDragStartEvent: dragStartEvent,
    onCreateAt: startCreateAt, onDateChange: setCurrentDate, onOpenDay: openDay,
  }

  return (
    <CalPaletteContext.Provider value={SP}>
      <div style={{ position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: 'var(--crm-font)', color: sp.ink }}>
        <style>{CRM_KEYFRAMES}</style>
        <style>{`
          @keyframes calPopIn { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
          @keyframes calToastIn { from { opacity: 0; transform: translateX(-50%) translateY(14px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
          @keyframes calSpin { to { transform: rotate(360deg); } }
        `}</style>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
          <CrmWorkspace active="calendar" sp={sp} dark={dark} setDark={setDark}>

          <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
            <div style={{
              position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden',
              border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg,
              display: 'grid', gridTemplateColumns: '296px 1fr', gridTemplateRows: '1fr', minHeight: 0,
            }}>
              {/* Rail gauche */}
              <aside style={{ padding: 'var(--crm-space-7xl) var(--crm-space-6xl)', overflowY: 'auto', minHeight: 0 }}>
                <CalRail
                  currentDate={currentDate} now={liveNow} onDateChange={setCurrentDate} events={railEvents} filters={filters} onFilters={setFilters}
                  labels={
                    <CalLabelSection
                      ms={ms}
                      labels={calLabels.labels}
                      counts={labelCounts}
                      shown={labelShown}
                      onToggle={id => setLabelShown(prev => ({ ...prev, [id]: prev[id] === false }))}
                      creatorOpen={labelCreator.open}
                      editLabel={editLabel}
                      onOpenCreator={() => setLabelCreator({ open: true, editId: null })}
                      onCloseCreator={closeLabelCreator}
                      onSaveLabel={saveLabel}
                      busy={calLabels.create.isPending || calLabels.update.isPending}
                      onLabelContext={(e, id) => setLabelCtx({ id, x: e.clientX, y: e.clientY })}
                      isLoading={calLabels.isLoading}
                      unavailable={!!calLabels.error}
                    />
                  }
                />
              </aside>

              {/* Carte principale */}
              <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-2xl) var(--crm-space-2xl) 0', minHeight: 0, display: 'flex' }}>
                <div style={{ flex: 1, minWidth: 0, background: SP.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: sp.shadow, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <CalToolbar view={view} onView={setView} headerLabel={headerLabel} headerLabelShort={headerLabelShort} onToday={() => setCurrentDate(new Date())} onPrev={() => navDate(-1)} onNext={() => navDate(1)} onCreate={startCreate} />
                  {calendarError && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-5xl)', borderBottom: `1px solid ${SP.line}`, color: SP.ink }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500 }}>{t('page.error.title')}</div>
                        <div style={{ fontSize: 'var(--crm-text-sm)', color: SP.muted }}>{t('page.error.message')}</div>
                      </div>
                      <button onClick={() => calendarRefetch()} style={{ height: 28, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${SP.line}`, background: 'transparent', color: SP.ink, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 500, flexShrink: 0 }}>
                        {t('page.error.retry')}
                      </button>
                    </div>
                  )}
                  {invite && <CalConnectBanner invite={invite} />}
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <CalEventMenuContext.Provider value={openEventLabelMenu}>
                    {view === 'day' && <CalDayView {...commonView} />}
                    {view === 'week' && <CalWeekView {...commonView} />}
                    {view === 'month' && <CalMonthView events={filtered} currentDate={currentDate} now={liveNow} selectedId={popover?.id ?? null} onSelectEvent={selectEvent} onUpdateEvent={updateEventTime} onCommitEvent={commitEventTime} onDragStartEvent={dragStartEvent} onDateChange={setCurrentDate} onOpenDay={openDay} onCreateAt={startCreateAt} />}
                    </CalEventMenuContext.Provider>
                  </div>
                </div>
              </div>
            </div>
          </main>
          </CrmWorkspace>
        </div>

        {popover && selectedEvent && (
          <CalEventPopover
            event={selectedEvent} anchorRect={popover.rect} allEvents={filtered} onClose={closePopover} onEdit={startEdit} onDelete={deleteEvent} onStatus={setStatus}
            onLabelMenu={!selectedEvent.external && selectedEvent.origin ? (x, y) => setEventLabelCtx({ id: selectedEvent.id, x, y }) : undefined}
          />
        )}

        {eventLabelCtx && (
          <CalEventLabelMenu
            ms={ms}
            x={eventLabelCtx.x}
            y={eventLabelCtx.y}
            labels={calLabels.labels}
            currentId={calLabels.assignments.get(calMasterId(eventLabelCtx.id)) ?? null}
            onPick={labelId => pickEventLabel(eventLabelCtx.id, labelId)}
            onCreate={() => { setPopover(null); setLabelCreator({ open: true, editId: null }) }}
            onClose={() => setEventLabelCtx(null)}
          />
        )}

        {/* Clic droit sur un libellé du rail : Renommer · Changer la couleur · Supprimer. */}
        {labelCtx && (
          <MailLabelMenu
            ms={ms}
            x={labelCtx.x}
            y={labelCtx.y}
            onClose={() => setLabelCtx(null)}
            onRename={() => setLabelCreator({ open: true, editId: labelCtx.id })}
            onRecolor={() => setLabelCreator({ open: true, editId: labelCtx.id })}
            onDelete={() => deleteLabel(labelCtx.id)}
          />
        )}

        {editing && (
          <CalEditModal editing={editing} onSave={saveEdit} onCancel={cancelEdit} onDelete={deleteEvent} />
        )}

        {toast && <CalSyncToast key={toast.key} data={toast} onDone={() => setToast(null)} />}
      </div>
    </CalPaletteContext.Provider>
  )
}
