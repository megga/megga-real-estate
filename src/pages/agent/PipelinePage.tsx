import { useState, useMemo } from 'react'
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Plus, Kanban, List, Search, GripVertical,
  ChevronRight, Briefcase, DollarSign, Trophy,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MOCK_DEALS, type MockDeal } from '@/lib/mockData'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import { toast } from '@/hooks/useToast'
import EmptyState from '@/components/ui/empty-state'

// Pipeline columns config
const PIPELINE_COLUMNS: { stage: MockDeal['stage']; color: string; dotColor: string }[] = [
  { stage: 'lead',          color: 'text-primary-500',  dotColor: 'bg-primary-400' },
  { stage: 'qualified',     color: 'text-accent',       dotColor: 'bg-accent' },
  { stage: 'visit_planned', color: 'text-warning',      dotColor: 'bg-warning' },
  { stage: 'offer',         color: 'text-accent-dark',  dotColor: 'bg-accent-dark' },
  { stage: 'negotiation',   color: 'text-danger',       dotColor: 'bg-danger' },
  { stage: 'signed',        color: 'text-success',      dotColor: 'bg-success' },
]

const AGENTS = ['Gregory L.', 'Sophie M.']

// ── Deal Card (used in Kanban) ───────────────────────────────────────────────

function DealCardContent({ deal, isDragOverlay }: { deal: MockDeal; isDragOverlay?: boolean }) {
  const initials = deal.contact_name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const agentInitials = deal.agent
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div
      className={cn(
        'bg-white rounded-card border border-border p-3.5 cursor-grab active:cursor-grabbing transition-all duration-200',
        isDragOverlay
          ? 'shadow-modal rotate-1 scale-105'
          : 'shadow-card hover:shadow-card-hover'
      )}
    >
      {/* Top row: avatar + name + grip */}
      <div className="flex items-start gap-3 mb-3">
        <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0', deal.contact_avatar_color)}>
          <span className="text-[11px] font-semibold text-white">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-primary-900 truncate">{deal.contact_name}</p>
          <p className="text-xs text-muted-foreground truncate">{deal.property_title}</p>
        </div>
        <GripVertical className="h-4 w-4 text-primary-200 flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
      </div>

      {/* Address */}
      <p className="text-[11px] text-muted-foreground truncate mb-3">{deal.property_address}</p>

      {/* Bottom row: price + date + agent avatar */}
      <div className="flex items-center justify-between pt-2.5 border-t border-border/60">
        <span className="text-sm font-bold text-accent">{formatCHF(deal.price)}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">{formatRelativeDate(deal.updated_at)}</span>
          <div
            className={cn('h-5 w-5 rounded-full flex items-center justify-center ring-2 ring-white', deal.agent_avatar_color)}
            title={deal.agent}
          >
            <span className="text-[7px] font-bold text-white">{agentInitials}</span>
          </div>
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
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group"
      role="option"
      aria-label={`${deal.contact_name} — ${deal.property_title} — ${formatCHF(deal.price)}`}
    >
      <DealCardContent deal={deal} />
    </div>
  )
}

// ── Kanban Column ────────────────────────────────────────────────────────────

function KanbanColumn({
  stage,
  dotColor,
  deals,
}: {
  stage: MockDeal['stage']
  dotColor: string
  deals: MockDeal[]
}) {
  const label = TRANSACTION_STAGE_LABELS[stage as TransactionStage]

  // Calculate column total value
  const totalValue = deals.reduce((sum, d) => sum + d.price, 0)

  return (
    <div className="flex-shrink-0 w-[280px] flex flex-col max-h-full">
      {/* Column header */}
      <div className="bg-white rounded-t-card px-4 py-3 border border-b-0 border-border">
        <div className="flex items-center gap-2.5">
          <div className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', dotColor)} />
          <span className="text-sm font-semibold text-primary-900 flex-1">{label}</span>
          <span className="text-[11px] font-semibold text-muted-foreground bg-section px-2 py-0.5 rounded-badge">
            {deals.length}
          </span>
        </div>
        {deals.length > 0 && (
          <p className="text-[10px] text-muted-foreground mt-1 ml-5">
            {formatCHF(totalValue)}
          </p>
        )}
      </div>

      {/* Column body */}
      <div className="flex-1 bg-section/40 border border-t-0 border-border rounded-b-card p-2.5 space-y-2.5 overflow-y-auto min-h-[140px]">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-24 text-xs text-muted-foreground border-2 border-dashed border-accent/20 rounded-card bg-white/50">
            Déposez un deal ici
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stage Badge (for list view) ──────────────────────────────────────────────

function StageBadge({ stage }: { stage: string }) {
  const colorMap: Record<string, string> = {
    lead: 'bg-primary-100 text-primary-600',
    qualified: 'bg-accent/10 text-accent',
    visit_planned: 'bg-warning/10 text-warning',
    offer: 'bg-accent-light text-accent-dark',
    negotiation: 'bg-danger/10 text-danger',
    signed: 'bg-success/10 text-success',
  }
  const label = TRANSACTION_STAGE_LABELS[stage as TransactionStage]
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', colorMap[stage] || 'bg-primary-100 text-primary-600')}>
      {label || stage}
    </span>
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
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

  // Summary stats
  const totalValue = deals.reduce((sum, d) => sum + d.price, 0)
  const signedDeals = deals.filter((d) => d.stage === 'signed')
  const signedValue = signedDeals.reduce((sum, d) => sum + d.price, 0)

  // Group by stage for Kanban
  const columns = useMemo(() => {
    return PIPELINE_COLUMNS.map((col) => ({
      ...col,
      deals: filtered.filter((d) => d.stage === col.stage),
    }))
  }, [filtered])

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

    const overDeal = deals.find((d) => d.id === overId)
    const activeDealObj = deals.find((d) => d.id === activeId)
    if (overDeal && activeDealObj && activeDealObj.stage !== overDeal.stage) {
      const newStageLabel = TRANSACTION_STAGE_LABELS[overDeal.stage as TransactionStage]
      setDeals((prev) =>
        prev.map((d) =>
          d.id === activeId ? { ...d, stage: overDeal.stage, updated_at: new Date().toISOString() } : d
        )
      )
      toast.success('Deal déplacé', `${activeDealObj.contact_name} → ${newStageLabel}`)
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
      setDeals((prev) =>
        prev.map((d) =>
          d.id === activeId ? { ...d, stage: overDealObj.stage } : d
        )
      )
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
          <div className="flex items-center bg-white border border-border rounded-button p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-sm font-medium transition-all duration-200',
                view === 'kanban' ? 'bg-accent text-white shadow-sm' : 'text-primary-400 hover:text-primary-700'
              )}
            >
              <Kanban className="h-4 w-4" aria-hidden="true" />
              Kanban
            </button>
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-sm font-medium transition-all duration-200',
                view === 'list' ? 'bg-accent text-white shadow-sm' : 'text-primary-400 hover:text-primary-700'
              )}
            >
              <List className="h-4 w-4" aria-hidden="true" />
              Liste
            </button>
          </div>

          <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-all duration-200 shadow-sm hover:shadow-md">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nouveau deal
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-card border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-button bg-accent/10 flex items-center justify-center flex-shrink-0">
            <Briefcase className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-bold text-primary-900">{deals.length}</p>
            <p className="text-xs text-muted-foreground">Deals actifs</p>
          </div>
        </div>
        <div className="bg-white rounded-card border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-button bg-warning/10 flex items-center justify-center flex-shrink-0">
            <DollarSign className="h-5 w-5 text-warning" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-bold text-primary-900">{formatCHF(totalValue)}</p>
            <p className="text-xs text-muted-foreground">Valeur totale</p>
          </div>
        </div>
        <div className="bg-white rounded-card border border-border p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-button bg-success/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="h-5 w-5 text-success" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xl font-bold text-success">{signedDeals.length}</p>
            <p className="text-xs text-muted-foreground">Signés · {formatCHF(signedValue)}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Rechercher contact ou bien..."
            aria-label="Rechercher un contact ou un bien"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all duration-200"
          />
        </div>

        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          aria-label="Filtrer par agent"
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
        >
          <option value="">Tous les agents</option>
          {AGENTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          aria-label="Filtrer par étape"
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
        >
          <option value="">Toutes les étapes</option>
          {PIPELINE_COLUMNS.map((col) => (
            <option key={col.stage} value={col.stage}>
              {TRANSACTION_STAGE_LABELS[col.stage as TransactionStage]}
            </option>
          ))}
        </select>

        {(search || agentFilter || stageFilter) && (
          <button
            onClick={() => { setSearch(''); setAgentFilter(''); setStageFilter('') }}
            className="text-xs text-accent hover:text-accent/80 font-medium transition-colors"
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
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
            {columns.map((col) => (
              <KanbanColumn
                key={col.stage}
                stage={col.stage}
                dotColor={col.dotColor}
                deals={col.deals}
              />
            ))}
          </div>

          <DragOverlay dropAnimation={null}>
            {activeDeal && (
              <div className="w-[280px]">
                <DealCardContent deal={activeDeal} isDragOverlay />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-white rounded-card shadow-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-section/50">
                  <th scope="col" className="text-left px-5 py-3.5">
                    <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">Contact</span>
                  </th>
                  <th scope="col" className="text-left px-5 py-3.5 hidden md:table-cell">
                    <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">Bien</span>
                  </th>
                  <th scope="col" className="text-left px-5 py-3.5">
                    <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">Prix</span>
                  </th>
                  <th scope="col" className="text-left px-5 py-3.5">
                    <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">Étape</span>
                  </th>
                  <th scope="col" className="text-left px-5 py-3.5 hidden lg:table-cell">
                    <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">Agent</span>
                  </th>
                  <th scope="col" className="text-left px-5 py-3.5 hidden sm:table-cell">
                    <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">Mise à jour</span>
                  </th>
                  <th scope="col" className="text-right px-5 py-3.5">
                    <span className="text-[11px] font-semibold text-primary-500 uppercase tracking-wider">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12">
                      <EmptyState
                        icon={Briefcase}
                        title="Aucun deal trouvé"
                        description="Essayez de modifier vos filtres ou créez un nouveau deal."
                        action={{
                          label: 'Effacer les filtres',
                          onClick: () => { setSearch(''); setAgentFilter(''); setStageFilter('') },
                        }}
                      />
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
                      <tr key={deal.id} className="hover:bg-section/30 transition-colors duration-150 group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0', deal.contact_avatar_color)}>
                              <span className="text-[11px] font-semibold text-white">{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-primary-900 truncate group-hover:text-accent transition-colors">{deal.contact_name}</p>
                              <p className="text-xs text-muted-foreground truncate md:hidden">{deal.property_title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 hidden md:table-cell">
                          <div className="min-w-0">
                            <p className="text-sm text-primary-900 truncate">{deal.property_title}</p>
                            <p className="text-[11px] text-muted-foreground truncate">{deal.property_address}</p>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="text-sm font-bold text-accent">{formatCHF(deal.price)}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <StageBadge stage={deal.stage} />
                        </td>
                        <td className="px-5 py-3.5 hidden lg:table-cell">
                          <span className="text-sm text-primary-600">{deal.agent}</span>
                        </td>
                        <td className="px-5 py-3.5 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{formatRelativeDate(deal.updated_at)}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            className="p-1.5 rounded-button text-primary-400 hover:text-accent hover:bg-accent/10 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/20"
                            aria-label={`Voir le deal de ${deal.contact_name}`}
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
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
    </div>
  )
}
