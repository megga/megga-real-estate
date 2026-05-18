// MEGGA CRM Sugar v2 — Today screen (page d'atterrissage agent)
// 1:1 port from the Claude Design bundle (crm-screen-today-sugar.jsx).
//
// Cartes flottantes, parcours horizontal avec connecteurs courbes,
// chips d'équipe circulaires, Focus mode, drag/drop des colonnes.

import { useState, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import { CRM_AGENT, crmContactById } from '@/components/crm-sugar/mockData'
import { useTodaySugarKpi } from '@/hooks/useTodaySugarKpi'
import CRMIcon from '@/components/crm-sugar/CRMIcon'
import {
  SugarTopNav, SugarIconRail, SugarFrame, SugarRoundIconBtn,
  SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import {
  SugarConnector, SugarTeamChip, SugarColumn, SugarKnowledgeTable,
  SugarDonut, SugarPipelineStat, SugarFocusView,
  COLUMNS_DEFS, type ColumnId, type KnowledgeRow,
} from '@/components/crm-sugar/SugarTodayComponents'
import {
  useSugarPopover, SugarPopover, SugarToast,
  SugarQuickAdd, SugarReschedule, SugarMiniCalendar,
  SugarRowMenu, SugarAILeads, SugarStatusMenu, SugarPipelineDrill,
  type PipelineDrillKind, type StatusId,
} from '@/components/crm-sugar/SugarPopovers'
import SugarContactDetail from '@/components/crm-sugar/SugarContactDetail'
import type { CrmContact } from '@/components/crm-sugar/mockData'

const DARK_TONE: DarkTone = 'meggaAi'

export default function TodaySugarPage() {
  const navigate = useNavigate()

  // ─── Theme: dark/light, tied to the icon-rail toggle ─────────────────
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

  // ─── KPIs live (Supabase) ───────────────────────────────────────────
  // Les 5 tuiles en tête de page lisent reminders / transactions / matches.
  // Les colonnes (relances/qualif/offres/comm) et la knowledge table restent
  // mockées pour cette PR — chantier séparé.
  const kpi = useTodaySugarKpi()

  // ─── Page state ─────────────────────────────────────────────────────
  const [detailContact, setDetailContact] = useState<CrmContact | null>(null)
  const [columnOrder, setColumnOrder] = useState<ColumnId[]>([
    'relances', 'qualif', 'offres', 'comm',
  ])
  const [draggingCol, setDraggingCol] = useState<ColumnId | null>(null)
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)
  const [focusMode, setFocusMode] = useState(false)
  const [doneSet, setDoneSet] = useState<Set<string>>(() => new Set())
  const [toast, setToast] = useState<string | null>(null)

  // ─── Popovers (each one is independently anchored) ──────────────────
  const quickAdd    = useSugarPopover<{ scope: 'journey' | 'tasks' | 'deal' }>()
  const calPop      = useSugarPopover()
  const reschedPop  = useSugarPopover<{ taskId: string; label: string }>()
  const rowMenuPop  = useSugarPopover<{ taskId: string; label: string }>()
  const aiPop       = useSugarPopover()
  const statusPop   = useSugarPopover<{ rowId: string; currentStatus: KnowledgeRow['status']; applyStatus: (s: KnowledgeRow['status']) => void }>()
  const pipelinePop = useSugarPopover<{ kind: PipelineDrillKind }>()

  // ─── Toast helper ───────────────────────────────────────────────────
  // useRef pour éviter la stale closure module-scope qui leak entre re-renders.
  const toastTimerRef = useRef<number | null>(null)
  const flashToast = (msg: string) => {
    setToast(msg)
    if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2200)
  }
  useEffect(() => {
    return () => {
      if (toastTimerRef.current != null) window.clearTimeout(toastTimerRef.current)
    }
  }, [])
  const toggleDone = (id: string) => {
    setDoneSet(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id); flashToast('Tâche remise à faire') }
      else { next.add(id); flashToast('Tâche marquée exécutée') }
      return next
    })
  }
  const openSchedule = (e: ReactMouseEvent<HTMLButtonElement>, taskId: string, label: string) =>
    reschedPop.openAt(e, 'resched', { taskId, label })
  const openMenu = (e: ReactMouseEvent<HTMLButtonElement>, taskId: string, label: string) =>
    rowMenuPop.openAt(e, 'menu', { taskId, label })
  const openAILeads = (e: ReactMouseEvent<HTMLDivElement>) => aiPop.openAt(e, 'ai')

  // ─── CSV export of "Tâches suggérées" ───────────────────────────────
  const exportCsv = () => {
    const rows = [
      ['Subject', 'Status', 'Start', 'End', 'Assigned'],
      ['Visite Carouge — Marie Bertrand', 'Planifié', '2026-05-01 14:00', '2026-05-01 14:45', 'Gregory L.'],
      ['Relance Pierre Vionnet',          'À faire',  '2026-05-01 09:30', '2026-05-01 10:00', 'Gregory L.'],
      ['KYC Élodie Schmidt',              'En cours', '2026-05-01 11:00', '2026-05-01 11:30', 'Sophie M.'],
      ['Suivi offre Antoine Picard',      'Bloqué',   '2026-04-30 18:00', '2026-05-02 18:00', 'Gregory L.'],
      ['Premier appel Catherine Loreau',  'Exécuté',  '2026-04-30 15:00', '2026-04-30 15:20', 'Gregory L.'],
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `megga-aujourdhui-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    flashToast('Parcours exporté (CSV)')
  }

  // ─── Cmd palette (placeholder — opens own search) ───────────────────
  const onCmd = () => flashToast('Recherche — ⌘K (à venir)')

  // ─── Top-nav navigation: route within /dashboard for the screens we have ─
  // Sugar screens not yet implemented show a toast.
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':     navigate('/dashboard'); break
      case 'pipeline':  navigate('/dashboard/pipeline'); break
      case 'matching':  navigate('/dashboard/matching'); break
      case 'contacts':  navigate('/dashboard/contacts'); break
      case 'biens':     navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar':  navigate('/dashboard/calendar'); break
      case 'docs':      navigate('/dashboard/documents'); break
      case 'kyc':       navigate('/dashboard/kyc'); break
      case 'reseau':    navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien':    navigate('/dashboard/julien'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings':  navigate('/dashboard/settings'); break
      case 'parcours':
      case 'julien':
      case 'ai':
      case 'add':
      case 'search':
        flashToast(`${id} — à venir dans Tier 3`); break
      default:
        flashToast(`${id} — à venir`)
    }
  }

  // ─── Contact lookups (used by columns) ──────────────────────────────
  const c001 = crmContactById('c-001')!
  const c002 = crmContactById('c-002')!
  const c003 = crmContactById('c-003')!
  const c004 = crmContactById('c-004')!
  const c005 = crmContactById('c-005')!
  const c006 = crmContactById('c-006')!
  const c007 = crmContactById('c-007')!
  const c008 = crmContactById('c-008')!

  // ─── Today's date label ─────────────────────────────────────────────
  // Hard-coded to match the prototype's mock-data state (frozen on 1 May 2026 = vendredi).
  // This stays consistent with `Aujourd'hui · 6 actions` in the mini calendar
  // and the timestamps in the Knowledge table (2026-05-01).
  const dateLabel = (
    <span style={{ fontSize: 13, color: sp.sub, marginLeft: 6, fontWeight: 500, textTransform: 'capitalize' }}>
      vendredi 1<sup>er</sup> mai 2026
    </span>
  )

  return (
    <div style={{
      background: sp.pageBg,
      minHeight: '100vh',
      fontFamily: 'Manrope, system-ui, sans-serif',
      color: sp.ink,
      // Greedy reset so the page doesn't inherit the default body padding/bg
      // when AgentSugarLayout is used.
    }}>
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarContactDetail contact={detailContact} onClose={() => setDetailContact(null)} sp={sp} dark={dark} />
      <SugarTopNav active="today" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
          active="today"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main style={{ flex: 1, padding: '32px 40px 80px 0', minWidth: 0 }}>
          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 28 }}>
            <h1 style={{
              margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: -1.2, color: sp.ink,
              lineHeight: 1,
            }}>Aujourd'hui</h1>
            {dateLabel}
            <div style={{ flex: 1 }} />
            <button
              onClick={() => setFocusMode(f => !f)}
              style={{
                height: 38, padding: '0 16px', borderRadius: 999, border: 0, cursor: 'pointer',
                background: focusMode ? sp.ink : sp.cardBg,
                color: focusMode ? sp.pageBg : sp.ink,
                boxShadow: focusMode ? sp.focusShadow : sp.shadowSm,
                backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                display: 'flex', alignItems: 'center', gap: 8,
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                transition: 'all 240ms cubic-bezier(.22,1,.36,1)',
              }}>
              <CRMIcon name={focusMode ? 'eye' : 'spark'} size={14} stroke={focusMode ? sp.pageBg : sp.ink} />
              {focusMode ? 'Quitter Focus' : 'Mode Focus'}
            </button>
          </div>

          {focusMode ? (
            <SugarFocusView sp={sp} contacts={[c001, c004, c003]} onContactClick={setDetailContact} />
          ) : (
            <>
              {/* HERO FRAME — Customer Journey */}
              <SugarFrame
                sp={sp}
                title="Parcours du jour"
                badge={<span style={{
                  padding: '3px 10px', borderRadius: 999, background: sp.ink, color: sp.pageBg,
                  fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
                }}>6 actions</span>}
                teamChips={
                  <>
                    <SugarTeamChip sp={sp} contact={c008} count={2} color="#0041D9" />
                    <SugarTeamChip sp={sp} contact={c003} count={3} color="#0041D9" offset={1} />
                    <SugarTeamChip sp={sp} contact={c001} count={2} color="#E53935" offset={1} />
                    <SugarTeamChip sp={sp} contact={c005} count={1} color="#E53935" offset={1} />
                    <SugarTeamChip sp={sp} contact={c004} count={1} color="#F59E0B" offset={1} />
                    <SugarTeamChip sp={sp} contact={c007} count={1} color="#E53935" offset={1} />
                    <SugarTeamChip sp={sp} contact={c002} count={null} color="#7A8079" offset={1} />
                  </>
                }
                actions={
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SugarRoundIconBtn sp={sp} onClick={e => quickAdd.openAt(e, 'quick', { scope: 'journey' })}>
                      <CRMIcon name="plus" size={18} stroke={sp.soft} />
                    </SugarRoundIconBtn>
                    <SugarRoundIconBtn sp={sp} onClick={() => exportCsv()}>
                      <CRMIcon name="download" size={18} stroke={sp.soft} />
                    </SugarRoundIconBtn>
                    <SugarRoundIconBtn sp={sp} onClick={e => calPop.openAt(e, 'cal')}>
                      <CRMIcon name="cal" size={18} stroke={sp.soft} />
                    </SugarRoundIconBtn>
                  </div>
                }
              >
                <div style={{ position: 'relative' }}>
                  {/* Connectors layer */}
                  <svg style={{
                    position: 'absolute', inset: 0, width: '100%', height: '100%',
                    pointerEvents: 'none', zIndex: 0,
                  }} preserveAspectRatio="none">
                    <defs>
                      <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
                        <circle cx="3" cy="3" r="2.5" fill="#0041D9" />
                      </marker>
                    </defs>
                    <SugarConnector x1="22%" y1="22%" x2="28%" y2="22%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[0]} toCol={columnOrder[1]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="22%" y1="22%" x2="28%" y2="42%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[0]} toCol={columnOrder[1]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="22%" y1="22%" x2="28%" y2="62%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[0]} toCol={columnOrder[1]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="22%" y1="78%" x2="28%" y2="78%" color="#E53935" fromCol={columnOrder[0]} toCol={columnOrder[1]} hoveredCol={hoveredCol} accentColor="#E53935" />
                    <SugarConnector x1="22%" y1="78%" x2="28%" y2="92%" color="#E53935" fromCol={columnOrder[0]} toCol={columnOrder[1]} hoveredCol={hoveredCol} accentColor="#E53935" />
                    <SugarConnector x1="48%" y1="78%" x2="54%" y2="50%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[1]} toCol={columnOrder[2]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="48%" y1="92%" x2="54%" y2="78%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[1]} toCol={columnOrder[2]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="48%" y1="22%" x2="54%" y2="22%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[1]} toCol={columnOrder[2]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="48%" y1="42%" x2="54%" y2="35%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[1]} toCol={columnOrder[2]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="48%" y1="62%" x2="54%" y2="64%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[1]} toCol={columnOrder[2]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="74%" y1="50%" x2="80%" y2="34%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[2]} toCol={columnOrder[3]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                    <SugarConnector x1="74%" y1="50%" x2="80%" y2="50%" color={dark ? '#3A4660' : '#C7CFDB'} fromCol={columnOrder[2]} toCol={columnOrder[3]} hoveredCol={hoveredCol} accentColor="#0041D9" />
                  </svg>

                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 1fr 1fr',
                    gap: 28,
                    position: 'relative', zIndex: 1,
                  }}>
                    {columnOrder.map((colId) => {
                      const col = COLUMNS_DEFS[colId]
                      return (
                        <SugarColumn
                          key={colId}
                          sp={sp}
                          label={col.label}
                          columnId={colId}
                          isDragging={draggingCol === colId}
                          isDragOver={dragOverCol === colId && draggingCol !== colId}
                          onMouseEnter={() => setHoveredCol(colId)}
                          onMouseLeave={() => setHoveredCol(null)}
                          onDragStart={() => setDraggingCol(colId)}
                          onDragOver={() => setDragOverCol(colId)}
                          onDrop={() => {
                            if (!draggingCol || draggingCol === colId) {
                              setDraggingCol(null); setDragOverCol(null); return
                            }
                            const next = [...columnOrder]
                            const from = next.indexOf(draggingCol)
                            const to   = next.indexOf(colId)
                            next.splice(from, 1)
                            next.splice(to, 0, draggingCol)
                            setColumnOrder(next)
                            setDraggingCol(null); setDragOverCol(null)
                          }}
                        >
                          {col.render({
                            sp, dark,
                            c001, c002, c003, c004, c005, c006, c007, c008,
                            setDetailContact, openSchedule, openMenu, openAILeads,
                            toggleDone, doneSet, flashToast,
                          })}
                        </SugarColumn>
                      )
                    })}
                  </div>
                </div>
              </SugarFrame>

              {/* TWO COLUMNS: Suggested Knowledge + Pipeline Snapshot */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginTop: 18,
              }}>
                <SugarFrame
                  sp={sp}
                  title="Tâches suggérées"
                  index={1}
                  actions={
                    <div style={{ display: 'flex', gap: 8 }}>
                      <SugarRoundIconBtn sp={sp} onClick={e => quickAdd.openAt(e, 'quick', { scope: 'tasks' })}>
                        <CRMIcon name="plus" size={18} stroke={sp.soft} />
                      </SugarRoundIconBtn>
                      <SugarRoundIconBtn sp={sp} onClick={() => exportCsv()}>
                        <CRMIcon name="download" size={18} stroke={sp.soft} />
                      </SugarRoundIconBtn>
                      <SugarRoundIconBtn sp={sp} onClick={e => calPop.openAt(e, 'cal')}>
                        <CRMIcon name="cal" size={18} stroke={sp.soft} />
                      </SugarRoundIconBtn>
                    </div>
                  }
                >
                  <SugarKnowledgeTable
                    sp={sp}
                    flashToast={flashToast}
                    onOpenStatus={(e, rowId, currentStatus, applyStatus) => {
                      statusPop.openAt(e, 'status', { rowId, currentStatus, applyStatus })
                    }}
                    onOpenRow={r => {
                      if (r.contactId) {
                        const c = crmContactById(r.contactId)
                        if (c) { setDetailContact(c); return }
                      }
                      flashToast(`Tâche ouverte — ${r.subject}`)
                    }}
                  />
                </SugarFrame>

                <SugarFrame
                  sp={sp}
                  title="Pipeline du jour"
                  index={2}
                  actions={
                    <div style={{ display: 'flex', gap: 8 }}>
                      <SugarRoundIconBtn sp={sp} onClick={e => quickAdd.openAt(e, 'quick', { scope: 'deal' })}>
                        <CRMIcon name="plus" size={18} stroke={sp.soft} />
                      </SugarRoundIconBtn>
                      <SugarRoundIconBtn sp={sp} onClick={e => calPop.openAt(e, 'cal')}>
                        <CRMIcon name="cal" size={18} stroke={sp.soft} />
                      </SugarRoundIconBtn>
                    </div>
                  }
                >
                  <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0 4px' }}>
                    <SugarDonut sp={sp} value={kpi.executedToday} total={Math.max(kpi.executedTotal, 1)}
                      color="#0041D9" bg={dark ? '#1A2A4D' : '#E8EFFE'} label="Exécutées"
                      onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'executed' })} />
                    <SugarDonut sp={sp} value={kpi.activeTasks} total={kpi.activeTarget}
                      color="#E53935" bg={dark ? '#3A1F22' : '#FDECEA'} label="Actives"
                      onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'active' })} />
                  </div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-around', marginTop: 10,
                    fontSize: 11.5, color: sp.sub,
                  }}>
                    <SugarPipelineStat sp={sp}
                      value={`CHF ${(kpi.pipelineValue / 1e6).toFixed(1)}M`}
                      valueColor={sp.ink} label="Pipeline"
                      onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'pipeline' })} />
                    <SugarPipelineStat sp={sp}
                      value={kpi.newMatchesToday > 0 ? `+${kpi.newMatchesToday}` : '0'}
                      valueColor="#0E9F6E" label="Nouveaux matchs"
                      onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'matches' })} />
                    <SugarPipelineStat sp={sp}
                      value={String(kpi.atRisk)}
                      valueColor="#F59E0B" label="À risque"
                      onClick={e => pipelinePop.openAt(e, 'pipeline', { kind: 'risk' })} />
                  </div>
                </SugarFrame>
              </div>
            </>
          )}

          {/* Popovers */}
          {quickAdd.open && (
            <SugarPopover anchorRect={quickAdd.anchorRect} sp={sp} dark={dark} onClose={quickAdd.close} width={300}>
              <SugarQuickAdd sp={sp} onPick={id => {
                quickAdd.close()
                const labels: Record<string, string> = {
                  task: 'Tâche créée', visit: 'Visite planifiée', contact: 'Contact ajouté',
                  deal: 'Offre lancée', note: 'Note enregistrée',
                }
                flashToast(labels[id] || 'Action ajoutée')
              }} />
            </SugarPopover>
          )}
          {calPop.open && (
            <SugarPopover anchorRect={calPop.anchorRect} sp={sp} dark={dark} onClose={calPop.close} width={320}>
              <SugarMiniCalendar sp={sp} dark={dark} />
            </SugarPopover>
          )}
          {reschedPop.open && (
            <SugarPopover anchorRect={reschedPop.anchorRect} sp={sp} dark={dark} onClose={reschedPop.close} width={280}>
              <SugarReschedule sp={sp}
                currentLabel={reschedPop.payload?.label}
                onClose={reschedPop.close}
                onPick={s => flashToast(`Replanifié — ${s.label}`)} />
            </SugarPopover>
          )}
          {rowMenuPop.open && (
            <SugarPopover anchorRect={rowMenuPop.anchorRect} sp={sp} dark={dark} onClose={rowMenuPop.close} width={280}>
              <SugarRowMenu sp={sp}
                label={rowMenuPop.payload?.label}
                onClose={rowMenuPop.close}
                onPick={it => {
                  const taskId = rowMenuPop.payload?.taskId
                  if (it.id === 'complete' && taskId) toggleDone(taskId)
                  const msgs: Record<string, string> = {
                    open:       'Fiche ouverte',
                    reschedule: 'Replanification',
                    priority:   'Marqué prioritaire',
                    assign:     'Assigné',
                    complete:   'Tâche terminée',
                    delete:     'Supprimé',
                  }
                  flashToast(msgs[it.id] || 'Action exécutée')
                }} />
            </SugarPopover>
          )}
          {aiPop.open && (
            <SugarPopover anchorRect={aiPop.anchorRect} sp={sp} dark={dark} onClose={aiPop.close} width={420}>
              <SugarAILeads sp={sp}
                onClose={aiPop.close}
                onAccept={l => flashToast(l.id === 'all' ? "4 leads qualifiés par l'IA" : `Lead accepté — ${l.name ?? ''}`)}
                onReject={l => flashToast(`Lead rejeté — ${l.name}`)}
                onPickLead={() => flashToast('Examen un par un')}
              />
            </SugarPopover>
          )}
          {pipelinePop.open && (
            <SugarPopover anchorRect={pipelinePop.anchorRect} sp={sp} dark={dark} onClose={pipelinePop.close} width={340}>
              <SugarPipelineDrill sp={sp}
                kind={pipelinePop.payload?.kind}
                onClose={pipelinePop.close}
                onPickItem={it => {
                  if (it.id === 'all') { onNavigate('pipeline'); flashToast('Ouverture du pipeline') }
                  else { flashToast(`Deal ouvert — ${it.label || 'détail'}`) }
                }} />
            </SugarPopover>
          )}
          {statusPop.open && (
            <SugarPopover anchorRect={statusPop.anchorRect} sp={sp} dark={dark} onClose={statusPop.close} width={260}>
              <SugarStatusMenu sp={sp}
                currentStatus={statusPop.payload?.currentStatus as StatusId | undefined}
                onClose={statusPop.close}
                onPick={it => {
                  const p = statusPop.payload
                  if (p?.applyStatus) p.applyStatus(it.id)
                }} />
            </SugarPopover>
          )}
          <SugarToast message={toast} sp={sp} />
        </main>
      </div>

      {/* Hidden agent ref so unused import elimination doesn't strip it during refactors */}
      <span style={{ display: 'none' }} aria-hidden>{CRM_AGENT.initials}</span>
    </div>
  )
}
