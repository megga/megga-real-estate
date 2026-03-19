import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Kanban, List, Search, GripVertical,
  ChevronRight, AlertTriangle, TrendingUp, Clock,
  Users, DollarSign,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MOCK_DEALS, type MockDeal } from '@/lib/mockData'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

// ── Pipeline columns config — 14 colonnes Gregory ────────────────────────────

interface PipelineColumn {
  stage: TransactionStage
  borderColor: string
  headerBg: string
  dotColor: string
  isEndState?: boolean
}

const PIPELINE_COLUMNS: PipelineColumn[] = [
  { stage: 'new_lead',           borderColor: 'border-gray-400',    headerBg: 'bg-gray-50',     dotColor: 'bg-gray-400' },
  { stage: 'to_qualify',         borderColor: 'border-gray-500',    headerBg: 'bg-gray-50',     dotColor: 'bg-gray-500' },
  { stage: 'active_search',      borderColor: 'border-blue-500',    headerBg: 'bg-blue-50',     dotColor: 'bg-blue-500' },
  { stage: 'visit_planned',      borderColor: 'border-cyan-500',    headerBg: 'bg-cyan-50',     dotColor: 'bg-cyan-500' },
  { stage: 'visit_done',         borderColor: 'border-teal-500',    headerBg: 'bg-teal-50',     dotColor: 'bg-teal-500' },
  { stage: 'interest_confirmed', borderColor: 'border-green-500',   headerBg: 'bg-green-50',    dotColor: 'bg-green-500' },
  { stage: 'offer',              borderColor: 'border-emerald-600', headerBg: 'bg-emerald-50',  dotColor: 'bg-emerald-600' },
  { stage: 'negotiation',        borderColor: 'border-amber-500',   headerBg: 'bg-amber-50',    dotColor: 'bg-amber-500' },
  { stage: 'reserved',           borderColor: 'border-orange-500',  headerBg: 'bg-orange-50',   dotColor: 'bg-orange-500' },
  { stage: 'financing',          borderColor: 'border-purple-500',  headerBg: 'bg-purple-50',   dotColor: 'bg-purple-500' },
  { stage: 'notary',             borderColor: 'border-indigo-600',  headerBg: 'bg-indigo-50',   dotColor: 'bg-indigo-600' },
  { stage: 'signed',             borderColor: 'border-green-700',   headerBg: 'bg-green-50',    dotColor: 'bg-green-700' },
  // End states — visually distinct
  { stage: 'lost',               borderColor: 'border-red-500',     headerBg: 'bg-red-50',      dotColor: 'bg-red-500',    isEndState: true },
  { stage: 'to_recontact',       borderColor: 'border-yellow-500',  headerBg: 'bg-yellow-50',   dotColor: 'bg-yellow-500', isEndState: true },
]

const AGENTS = ['Gregory L.', 'Sophie M.']

// ── Deal Card Content ────────────────────────────────────────────────────────

function DealCardContent({ deal }: { deal: MockDeal }) {
  const initials = deal.contact_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="bg-white rounded-lg shadow-card border border-border p-3 cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-shadow">
      <div className="flex items-start gap-2 mb-2">
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', deal.contact_avatar_color)}>
          <span className="text-[10px] font-semibold text-white">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary-900 truncate">{deal.contact_name}</p>
          <p className="text-xs text-muted-foreground truncate">{deal.property_address}</p>
        </div>
        <GripVertical className="h-4 w-4 text-primary-200 flex-shrink-0 mt-0.5" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-primary-900">{formatCHF(deal.price)}</span>
        <div className="flex items-center gap-1.5">
          {deal.has_overdue_reminder && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-warning bg-warning/10 px-1.5 py-0.5 rounded-badge" title="Relance en retard">
              <Clock className="h-3 w-3" />
              Relance
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{formatRelativeDate(deal.updated_at)}</span>
        </div>
      </div>
    </div>
  )
}

// ── Sortable Deal Card ───────────────────────────────────────────────────────

function SortableDealCard({ deal }: { deal: MockDeal }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id, data: { deal } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <DealCardContent deal={deal} />
    </div>
  )
}

// ── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  deals,
}: {
  column: PipelineColumn
  deals: MockDeal[]
}) {
  const label = TRANSACTION_STAGE_LABELS[column.stage]

  return (
    <div className={cn(
      'flex-shrink-0 w-64 flex flex-col max-h-full',
      column.isEndState && 'opacity-70'
    )}>
      {/* Column header */}
      <div className={cn('rounded-t-lg px-3 py-2 border-t-2 border-x border-b-0 border-border', column.headerBg, column.borderColor, 'border-t-2')}>
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', column.dotColor)} />
          <span className="text-xs font-semibold text-primary-900 truncate">{label}</span>
          <span className="ml-auto text-[10px] font-medium text-muted-foreground bg-white px-1.5 py-0.5 rounded">
            {deals.length}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div className="flex-1 bg-section/50 border border-t-0 border-border rounded-b-lg p-2 space-y-2 overflow-y-auto min-h-[100px]">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground border-2 border-dashed border-border rounded-lg">
            Déposez ici
          </div>
        )}
      </div>
    </div>
  )
}

// ── KPI Summary Bar ──────────────────────────────────────────────────────────

function KpiBar({ deals }: { deals: MockDeal[] }) {
  const activeDeals = deals.filter((d) => d.stage !== 'lost')
  const totalValue = activeDeals.reduce((sum, d) => sum + d.price, 0)
  const atRisk = deals.filter((d) => d.has_overdue_reminder).length
  const signedCount = deals.filter((d) => d.stage === 'signed').length
  const conversionRate = deals.length > 0 ? Math.round((signedCount / deals.length) * 100) : 0

  const kpis = [
    { label: 'Deals actifs', value: String(activeDeals.length), icon: Users, color: 'text-accent' },
    { label: 'Valeur pipeline', value: formatCHF(totalValue), icon: DollarSign, color: 'text-success' },
    { label: 'À risque', value: String(atRisk), icon: AlertTriangle, color: atRisk > 0 ? 'text-warning' : 'text-muted-foreground' },
    { label: 'Taux conversion', value: `${conversionRate}%`, icon: TrendingUp, color: 'text-accent' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="bg-white rounded-card shadow-card p-3 flex items-center gap-3">
          <div className={cn('h-9 w-9 rounded-lg bg-section flex items-center justify-center', kpi.color)}>
            <kpi.icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-sm font-bold text-primary-900">{kpi.value}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Stage Badge (for list view) ──────────────────────────────────────────────

function StageBadge({ stage }: { stage: string }) {
  const col = PIPELINE_COLUMNS.find((c) => c.stage === stage)
  const label = TRANSACTION_STAGE_LABELS[stage as TransactionStage]
  return (
    <span className={cn(
      'text-xs font-medium px-2 py-0.5 rounded-badge border',
      col ? `${col.headerBg} ${col.borderColor}` : 'bg-primary-100 border-primary-300'
    )}>
      {label || stage}
    </span>
  )
}

// ── Lost Confirmation Dialog ─────────────────────────────────────────────────

function LostDialog({
  open,
  dealName,
  onConfirm,
  onCancel,
}: {
  open: boolean
  dealName: string
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Marquer comme perdu</DialogTitle>
          <DialogDescription>
            Vous déplacez le deal « {dealName} » vers Perdu. Indiquez la raison.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Raison de la perte (obligatoire)..."
            className="w-full text-sm text-primary-700 bg-section border border-border rounded-input p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-primary-700 border border-border rounded-button hover:bg-section transition-colors"
            >
              Annuler
            </button>
            <button
              disabled={!reason.trim()}
              onClick={() => { onConfirm(reason.trim()); setReason('') }}
              className="px-4 py-2 text-sm font-medium text-white bg-danger hover:bg-danger/90 rounded-button transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmer
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [deals, setDeals] = useState<MockDeal[]>(MOCK_DEALS)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [activeDeal, setActiveDeal] = useState<MockDeal | null>(null)

  // Lost dialog state
  const [lostDialog, setLostDialog] = useState<{ dealId: string; dealName: string; oldStage: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Filter deals
  const filtered = useMemo(() => {
    let list = [...deals]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (d) =>
          d.contact_name.toLowerCase().includes(q) ||
          d.property_title.toLowerCase().includes(q)
      )
    }
    if (agentFilter) list = list.filter((d) => d.agent === agentFilter)
    if (stageFilter) list = list.filter((d) => d.stage === stageFilter)
    return list
  }, [deals, search, agentFilter, stageFilter])

  // Group by stage for Kanban
  const columns = useMemo(() => {
    return PIPELINE_COLUMNS.map((col) => ({
      ...col,
      deals: filtered.filter((d) => d.stage === col.stage),
    }))
  }, [filtered])

  // Move deal to new stage
  function moveDeal(dealId: string, newStage: MockDeal['stage']) {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id !== dealId) return d
        const oldStage = d.stage
        // If moving to 'lost', open confirmation dialog
        if (newStage === 'lost' && oldStage !== 'lost') {
          setLostDialog({ dealId: d.id, dealName: d.contact_name, oldStage })
          return d // Don't move yet — wait for confirmation
        }
        // Normal move
        return { ...d, stage: newStage, updated_at: new Date().toISOString() }
      })
    )
  }

  function handleLostConfirm(_reason: string) {
    if (!lostDialog) return
    setDeals((prev) =>
      prev.map((d) =>
        d.id === lostDialog.dealId
          ? { ...d, stage: 'lost' as const, updated_at: new Date().toISOString() }
          : d
      )
    )
    // In production: INSERT activity_event with metadata { old_stage, new_stage, reason: _reason }
    // + UPDATE transactions.notes with _reason
    setLostDialog(null)
  }

  function handleDragStart(event: DragStartEvent) {
    const deal = deals.find((d) => d.id === event.active.id)
    setActiveDeal(deal || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null)
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string
    if (activeId === overId) return

    // Find target stage from the over element
    const overDeal = deals.find((d) => d.id === overId)
    if (overDeal) {
      moveDeal(activeId, overDeal.stage)
    }
  }

  function handleDragOver(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return

    const activeId = active.id as string
    const overId = over.id as string

    const activeDealObj = deals.find((d) => d.id === activeId)
    const overDealObj = deals.find((d) => d.id === overId)

    if (activeDealObj && overDealObj && activeDealObj.stage !== overDealObj.stage) {
      // For 'lost', don't auto-move during drag-over — only on drop
      if (overDealObj.stage === 'lost') return
      moveDeal(activeId, overDealObj.stage)
    }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{deals.length} deals au total</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex items-center bg-section border border-border rounded-button p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                view === 'kanban' ? 'bg-white shadow-sm text-primary-900' : 'text-primary-400 hover:text-primary-600'
              )}
            >
              <Kanban className="h-4 w-4" />
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                view === 'list' ? 'bg-white shadow-sm text-primary-900' : 'text-primary-400 hover:text-primary-600'
              )}
            >
              <List className="h-4 w-4" />
              Liste
            </button>
          </div>

          <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-colors">
            <Plus className="h-4 w-4" />
            Nouveau deal
          </button>
        </div>
      </div>

      {/* KPI Summary Bar */}
      <KpiBar deals={deals} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
          <input
            type="text"
            placeholder="Rechercher contact ou bien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les agents</option>
          {AGENTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Toutes les étapes</option>
          {PIPELINE_COLUMNS.map((col) => (
            <option key={col.stage} value={col.stage}>
              {TRANSACTION_STAGE_LABELS[col.stage]}
            </option>
          ))}
        </select>

        {(search || agentFilter || stageFilter) && (
          <button
            onClick={() => { setSearch(''); setAgentFilter(''); setStageFilter('') }}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
        >
          <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
            {columns.map((col, i) => (
              <div key={col.stage} className="flex gap-3">
                {/* Separator before end-state columns */}
                {i > 0 && col.isEndState && !columns[i - 1].isEndState && (
                  <div className="flex-shrink-0 w-px bg-border my-2 mx-1" />
                )}
                <KanbanColumn column={col} deals={col.deals} />
              </div>
            ))}
          </div>

          <DragOverlay>
            {activeDeal && (
              <div className="w-64 rotate-2">
                <DealCardContent deal={activeDeal} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-section">
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Contact</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Bien</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Prix</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Étape</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Agent</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Mise à jour</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <p className="text-sm text-muted-foreground">Aucun deal trouvé</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((deal) => {
                    const initials = deal.contact_name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .toUpperCase()
                      .slice(0, 2)

                    return (
                      <tr key={deal.id} className="hover:bg-section/50 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', deal.contact_avatar_color)}>
                              <span className="text-[10px] font-semibold text-white">{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-sm font-medium text-primary-900 truncate">{deal.contact_name}</p>
                                {deal.has_overdue_reminder && (
                                  <Clock className="h-3.5 w-3.5 text-warning flex-shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate md:hidden">{deal.property_title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="min-w-0">
                            <p className="text-sm text-primary-900 truncate">{deal.property_title}</p>
                            <p className="text-xs text-muted-foreground truncate">{deal.property_address}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-primary-900">{formatCHF(deal.price)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StageBadge stage={deal.stage} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-primary-600">{deal.agent}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{formatRelativeDate(deal.updated_at)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="p-1.5 rounded-md text-primary-400 hover:text-accent hover:bg-accent/10 transition-colors">
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lost confirmation dialog */}
      <LostDialog
        open={lostDialog !== null}
        dealName={lostDialog?.dealName || ''}
        onConfirm={handleLostConfirm}
        onCancel={() => setLostDialog(null)}
      />
    </div>
  )
}
