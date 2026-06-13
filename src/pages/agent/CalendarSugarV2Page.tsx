// MEGGA CRM Sugar v2 — Calendrier (Tier 3.i)
// 1:1 port from the Claude Design bundle (`crm-calendar-sugar.jsx`).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CalIcon } from '@/components/crm-sugar/calendar/CalIcon'
import {
  CalCircleBtn, CalViewToggle, type CalViewId,
} from '@/components/crm-sugar/calendar/CalToolbar'
import { CalDayView } from '@/components/crm-sugar/calendar/CalDayView'
import { CalWeekView } from '@/components/crm-sugar/calendar/CalWeekView'
import { CalMonthView } from '@/components/crm-sugar/calendar/CalMonthView'
import { CalAgendaView } from '@/components/crm-sugar/calendar/CalAgendaView'
import { CalLeftPanel } from '@/components/crm-sugar/calendar/CalLeftPanel'
import { CalRightPanel } from '@/components/crm-sugar/calendar/CalRightPanel'
import { CalEditPanel, type CalEditing } from '@/components/crm-sugar/calendar/CalEditPanel'
import {
  buildCalPalette, calBlankEvent, calParseNL, CalPaletteContext, type CalEvent,
} from '@/components/crm-sugar/calendar/data'
import {
  CAL_MONTHS, fmtDate,
} from '@/components/crm-sugar/calendar/helpers'
import { useCalendarSugar } from '@/hooks/useCalendarSugar'
import { useVisits } from '@/hooks/useVisits'
import { useReminders } from '@/hooks/useReminders'
import { useToast } from '@/components/ui/Toast'
import { useQueryClient } from '@tanstack/react-query'
import CreateVisitDialog from '@/components/calendar/CreateVisitDialog'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

const DARK_TONE: DarkTone = 'meggaAi'

export default function CalendarSugarV2Page() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)
  const SP = buildCalPalette(dark, t)

  // Source de vérité : Supabase via useCalendarSugar (visites + reminders).
  const { events, hotBuyers } = useCalendarSugar()
  const { createVisit, isCreating: isCreatingVisit } = useVisits()
  const { createReminder, isCreating: isCreatingReminder } = useReminders()
  const queryClient = useQueryClient()
  const toast = useToast()
  const isCreating = isCreatingVisit || isCreatingReminder

  const [view, setView] = useState<CalViewId>('day')
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<Record<string, boolean>>({})
  const [createOpen, setCreateOpen] = useState(false)

  // Couche interactive (#6/#7/#9/#10) : surcouches locales appliquées AU RENDER
  // par-dessus les events Supabase — édition/création (overrides) + statut.
  // Pas d'effet de miroir (qui bouclait quand `events` change de référence
  // à chaque render, ex. agent sans données → « Maximum update depth »).
  const [overrides, setOverrides] = useState<Record<string, CalEvent>>({})
  const [statuses, setStatuses] = useState<Record<string, 'done' | 'cancelled' | undefined>>({})
  const [editing, setEditing] = useState<CalEditing | null>(null)
  const [aiText, setAiText] = useState('')

  /**
   * Route selon event.meggaType :
   *   - 'visit' → insert dans table visits (requiert contact + bien)
   *   - autres  → insert dans table reminders avec type='custom' + title
   *               + description, channel='task' par défaut.
   * Les 2 cas invalident le calendar-sugar query pour refresh la vue.
   */
  const handleCreateVisit = async (event: CalendarEvent) => {
    const meggaType = event.meggaType ?? 'visit'
    const successLabels: Record<NonNullable<CalendarEvent['meggaType']>, string> = {
      visit: 'Visite planifiée',
      meeting: 'Rendez-vous planifié',
      reminder: 'Relance créée',
      signing: 'Signature planifiée',
      deadline: 'Échéance ajoutée',
      personal: 'Événement personnel ajouté',
    }
    try {
      if (meggaType === 'visit') {
        // Visite réelle : exige contact + bien (FK constraint table visits).
        if (!event.contactId || !event.propertyId) {
          toast.error('Sélectionnez un contact ET un bien pour planifier une visite')
          return
        }
        await createVisit(event)
        await queryClient.invalidateQueries({ queryKey: ['visits'] })
        await queryClient.invalidateQueries({ queryKey: ['calendar-sugar-visits'] })
      } else {
        // Tous les autres types → reminder custom (contact + bien optionnels).
        await createReminder({
          type: 'custom',
          triggerAt: event.start,
          title: event.title,
          description: event.description ?? event.location,
          contactId: event.contactId ?? null,
          propertyId: event.propertyId ?? null,
        })
        await queryClient.invalidateQueries({ queryKey: ['calendar-sugar-reminders'] })
      }
      toast.success(successLabels[meggaType], { duration: 2400 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue'
      toast.error(`Échec : ${msg}`)
    }
  }

  // Fusion render-time : events Supabase + overrides (édition/création) + statuts.
  const displayEvents = useMemo<CalEvent[]>(() => {
    const seen = new Set<string>()
    const merged: CalEvent[] = events.map(e => {
      seen.add(e.id)
      return overrides[e.id] ?? e
    })
    for (const id of Object.keys(overrides)) {
      if (!seen.has(id)) merged.push(overrides[id])
    }
    return merged.map(e => (e.id in statuses ? { ...e, status: statuses[e.id] } : e))
  }, [events, overrides, statuses])

  const filtered = useMemo(
    () => displayEvents.filter(e => filters[e.type] !== false),
    [displayEvents, filters],
  )
  const selected = filtered.find(e => e.id === selectedId)

  // ── Édition / création / statut / barre IA ──
  const startEdit = (id: string) => {
    const ev = displayEvents.find(e => e.id === id)
    if (ev) setEditing({ mode: 'edit', draft: { ...ev } })
  }
  const startCreate = () => setEditing({ mode: 'create', draft: calBlankEvent(currentDate) })
  const cancelEdit = () => setEditing(null)
  const saveEdit = (draft: CalEvent) => {
    const isNew = !displayEvents.some(e => e.id === draft.id)
    setOverrides(prev => ({ ...prev, [draft.id]: draft }))
    setSelectedId(draft.id)
    setEditing(null)
    // Persistance best-effort à la création (non-visites → reminder Supabase).
    if (isNew) {
      void handleCreateVisit({
        id: draft.id,
        title: draft.title,
        start: draft.start,
        end: draft.end,
        meggaType:
          draft.type === 'visite' ? 'visit'
          : draft.type === 'notary' ? 'signing'
          : draft.type === 'mandate' ? 'meeting'
          : draft.type === 'publish' ? 'deadline'
          : 'reminder',
        contactId: null,
        propertyId: null,
        description: draft.notes ?? draft.location ?? null,
        location: draft.location ?? null,
      } as unknown as CalendarEvent)
    }
  }
  const setStatus = (id: string, status: 'done' | 'cancelled') => {
    setStatuses(prev => ({ ...prev, [id]: prev[id] === status ? undefined : status }))
  }
  const submitAI = () => {
    const text = aiText.trim()
    if (!text) return
    const draft = calParseNL(text, currentDate)
    setCurrentDate(new Date(draft.start))
    setEditing({ mode: 'create', draft })
    setAiText('')
  }

  // Live clock simulé
  const [liveNow, setLiveNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => {
      setLiveNow(prev => {
        const n = new Date(prev)
        n.setMinutes(n.getMinutes() + 1)
        return n
      })
    }, 30000)
    return () => window.clearInterval(id)
  }, [])

  const headerLabel = (() => {
    if (view === 'day') return fmtDate(currentDate)
    if (view === 'week') {
      const monday = new Date(currentDate)
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
      const sunday = new Date(monday)
      sunday.setDate(sunday.getDate() + 6)
      return `Semaine du ${monday.getDate()} ${CAL_MONTHS[
        monday.getMonth()
      ].toLowerCase()} – ${sunday.getDate()} ${CAL_MONTHS[sunday.getMonth()].toLowerCase()}`
    }
    if (view === 'month')
      return `${CAL_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`
    return 'Agenda complet'
  })()

  const navDate = (delta: number) => {
    const d = new Date(currentDate)
    if (view === 'day') d.setDate(d.getDate() + delta)
    else if (view === 'week') d.setDate(d.getDate() + delta * 7)
    else if (view === 'month') d.setMonth(d.getMonth() + delta)
    setCurrentDate(d)
  }

  const renderView = () => {
    if (view === 'day')
      return (
        <CalDayView
          events={filtered}
          currentDate={currentDate}
          now={liveNow}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={startEdit}
        />
      )
    if (view === 'week')
      return (
        <CalWeekView
          events={filtered}
          currentDate={currentDate}
          now={liveNow}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onEdit={startEdit}
          onDateChange={setCurrentDate}
        />
      )
    if (view === 'month')
      return (
        <CalMonthView
          events={filtered}
          currentDate={currentDate}
          now={liveNow}
          onDateChange={setCurrentDate}
        />
      )
    return (
      <CalAgendaView
        events={filtered}
        now={liveNow}
        selectedId={selectedId}
        onSelect={setSelectedId}
        onEdit={startEdit}
      />
    )
  }

  const isAgendaOrMonth = view === 'agenda' || view === 'month'

  const onCmd = () => {
    /* placeholder */
  }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':
        navigate('/dashboard'); break
      case 'pipeline':
        navigate('/dashboard/pipeline'); break
      case 'matching':
        navigate('/dashboard/matching'); break
      case 'contacts':
        navigate('/dashboard/contacts'); break
      case 'biens':
        navigate('/dashboard/listings'); break
      case 'biens-new':
        navigate('/dashboard/listings/new'); break
      case 'parcours':
        navigate('/dashboard/journey'); break
      case 'calendar':
        break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'reseau':
        navigate('/dashboard/network'); break
      case 'ai':
      case 'julien':
        navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      default:
    }
  }

  return (
    <CalPaletteContext.Provider value={SP}>
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: sp.pageBg,
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes calPulseDot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>

      <SugarTopNav
        active="calendar"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="calendar"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main
          style={{
            flex: 1,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            padding: '24px 40px 24px 0',
            gap: 14,
          }}
        >
          {/* Toolbar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: SP.card,
              borderRadius: 18,
              padding: '12px 16px',
              boxShadow: SP.shadowSm,
            }}
          >
            <div style={{ flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: SP.muted,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                Calendrier
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: SP.ink,
                  letterSpacing: -0.4,
                  marginTop: 4,
                  lineHeight: 1.1,
                }}
              >
                {headerLabel}
              </div>
            </div>

            <div
              style={{
                width: 1,
                height: 32,
                background: SP.line,
                marginLeft: 4,
              }}
            />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalCircleBtn
                icon={<CalIcon name="chevL" size={14} stroke={SP.inkSoft} />}
                onClick={() => navDate(-1)}
                title="Précédent"
                size={34}
              />
              <button
                onClick={() => setCurrentDate(new Date())}
                style={{
                  height: 34,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: 0,
                  background: SP.cardSubtle,
                  color: SP.ink,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Aujourd'hui
              </button>
              <CalCircleBtn
                icon={<CalIcon name="chevR" size={14} stroke={SP.inkSoft} />}
                onClick={() => navDate(1)}
                title="Suivant"
                size={34}
              />
            </div>

            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <CalViewToggle value={view} onChange={setView} />
            </div>

            <button
              onClick={startCreate}
              disabled={isCreating}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: 0,
                background: SP.accent,
                color: SP.onAccent,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: isCreating ? 'wait' : 'pointer',
                opacity: isCreating ? 0.7 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                boxShadow: SP.shadow,
                flexShrink: 0,
              }}
            >
              <CalIcon name="plus" size={14} stroke={SP.onAccent} sw={2.4} />
              {isCreating ? 'Création…' : 'Nouvel événement'}
            </button>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              gap: 14,
            }}
          >
            <CalLeftPanel
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              events={events}
              filters={filters}
              onFilters={setFilters}
              hotBuyers={hotBuyers}
              aiInsights={[]}
              onSelectEvent={setSelectedId}
            />

            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
              }}
            >
              {renderView()}
            </div>

            {editing ? (
              <CalEditPanel
                key={editing.draft.id + editing.mode}
                editing={editing}
                onSave={saveEdit}
                onCancel={cancelEdit}
              />
            ) : !isAgendaOrMonth ? (
              <CalRightPanel event={selected} onEdit={startEdit} onSetStatus={setStatus} />
            ) : null}
          </div>

          {/* Footer — barre MEGGA AI (#9). La pastille « RDV restants » a été
              retirée (#13) : langage naturel → création pré-remplie. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px 8px 16px',
              borderRadius: 999,
              background: SP.card,
              boxShadow: SP.shadowSm,
              flexShrink: 0,
            }}
          >
            <CalIcon name="sparkle" size={15} stroke={SP.muted} sw={2} />
            <input
              value={aiText}
              onChange={e => setAiText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') submitAI()
              }}
              placeholder="Demandez à MEGGA AI — ex : « visite Marie demain 14h »"
              style={{
                flex: 1,
                height: 32,
                border: 0,
                background: 'transparent',
                color: SP.ink,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 500,
                outline: 'none',
              }}
            />
            <button
              onClick={submitAI}
              aria-label={aiText.trim() ? 'Créer' : 'Dicter'}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 0,
                cursor: 'pointer',
                background: aiText.trim() ? SP.accent : SP.cardSubtle,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                transition: 'background .15s',
              }}
            >
              <CalIcon
                name={aiText.trim() ? 'arrowR' : 'mic'}
                size={15}
                stroke={aiText.trim() ? SP.onAccent : SP.inkSoft}
                sw={2}
              />
            </button>
          </div>
        </main>
      </div>

      <CreateVisitDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        initialDate={currentDate}
        onCreateEvent={handleCreateVisit}
      />
    </div>
    </CalPaletteContext.Provider>
  )
}
