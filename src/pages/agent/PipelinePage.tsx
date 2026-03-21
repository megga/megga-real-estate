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
  ChevronRight,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MOCK_DEALS, type MockDeal } from '@/lib/mockData'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import PageHeader from '@/components/layout/PageHeader'
import PageTransition from '@/components/layout/PageTransition'

// Pipeline columns config — subset of stages for Kanban
const PIPELINE_COLUMNS: { stage: MockDeal['stage']; color: string; headerBg: string }[] = [
  { stage: 'new_lead',      color: 'bg-primary-300', headerBg: 'bg-primary-50' },
  { stage: 'to_qualify',    color: 'bg-accent',      headerBg: 'bg-accent/5' },
  { stage: 'visit_planned', color: 'bg-warning',     headerBg: 'bg-warning/5' },
  { stage: 'offer',         color: 'bg-purple-500',  headerBg: 'bg-purple-50' },
  { stage: 'negotiation',   color: 'bg-danger',      headerBg: 'bg-danger/5' },
  { stage: 'signed',        color: 'bg-success',     headerBg: 'bg-success/5' },
]

const AGENTS = ['Gregory L.', 'Sophie M.']

// ── Deal Card (used in Kanban) ───────────────────────────────────────────────

function DealCardContent({ deal }: { deal: MockDeal }) {
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
    <div className="bg-theme-card rounded-lg shadow-card border border-theme-border p-3 cursor-grab active:cursor-grabbing hover:shadow-card-hover transition-shadow">
      <div className="flex items-start gap-2 mb-2">
        <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', deal.contact_avatar_color)}>
          <span className="text-[10px] font-semibold text-white">{initials}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-theme-primary truncate">{deal.contact_name}</p>
          <p className="text-xs text-muted-foreground truncate">{deal.property_title}</p>
        </div>
        <GripVertical className="h-4 w-4 text-theme-tertiary flex-shrink-0 mt-0.5" />
      </div>

      <p className="text-xs text-muted-foreground truncate mb-2">{deal.property_address}</p>

      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-theme-primary">{formatCHF(deal.price)}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground">{formatRelativeDate(deal.updated_at)}</span>
          <div className={cn('h-5 w-5 rounded-full flex items-center justify-center', deal.agent_avatar_color)} title={deal.agent}>
            <span className="text-[8px] font-semibold text-white">{agentInitials}</span>
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
  stage,
  color,
  headerBg,
  deals,
}: {
  stage: MockDeal['stage']
  color: string
  headerBg: string
  deals: MockDeal[]
}) {
  const label = TRANSACTION_STAGE_LABELS[stage as TransactionStage]

  return (
    <div className="flex-shrink-0 w-72 flex flex-col max-h-full">
      {/* Column header */}
      <div className={cn('rounded-t-lg px-3 py-2.5 border border-b-0 border-border', headerBg)}>
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', color)} />
          <span className="text-sm font-semibold text-theme-primary">{label}</span>
          <span className="ml-auto text-xs font-medium text-muted-foreground bg-white px-1.5 py-0.5 rounded">
            {deals.length}
          </span>
        </div>
      </div>

      {/* Column body */}
      <div className="flex-1 bg-theme-section/50 border border-t-0 border-border rounded-b-lg p-2 space-y-2 overflow-y-auto min-h-[120px]">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border-2 border-dashed border-border rounded-lg">
            Déposez ici
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stage Badge (for list view) ──────────────────────────────────────────────

function StageBadge({ stage }: { stage: string }) {
  const colorMap: Record<string, string> = {
    lead: 'bg-primary-100 text-theme-secondary',
    qualified: 'bg-accent/10 text-accent',
    visit_planned: 'bg-warning/10 text-warning',
    offer: 'bg-purple-100 text-purple-700',
    negotiation: 'bg-danger/10 text-danger',
    signed: 'bg-success/10 text-success',
  }
  const label = TRANSACTION_STAGE_LABELS[stage as TransactionStage]
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', colorMap[stage] || 'bg-primary-100 text-theme-secondary')}>
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

    // Find which column the item was dropped into
    const overDeal = deals.find((d) => d.id === overId)
    if (overDeal) {
      // Dropped on another deal card — take its stage
      setDeals((prev) =>
        prev.map((d) =>
          d.id === activeId ? { ...d, stage: overDeal.stage, updated_at: new Date().toISOString() } : d
        )
      )
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
    <PageTransition>
    <div className="space-y-6">
      <PageHeader
        title="Pipeline"
        subtitle={`${deals.length} deals au total`}
        actions={
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center bg-theme-input border border-theme-border rounded-button p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  view === 'kanban' ? 'bg-theme-card shadow-sm text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                <Kanban className="h-4 w-4" />
                Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors',
                  view === 'list' ? 'bg-theme-card shadow-sm text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
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
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
          <input
            type="text"
            placeholder="Rechercher contact ou bien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm bg-theme-card border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        <select
          value={agentFilter}
          onChange={(e) => setAgentFilter(e.target.value)}
          className="h-10 px-3 text-sm bg-theme-card border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les agents</option>
          {AGENTS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value)}
          className="h-10 px-3 text-sm bg-theme-card border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
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
          <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
            {columns.map((col) => (
              <KanbanColumn
                key={col.stage}
                stage={col.stage}
                color={col.color}
                headerBg={col.headerBg}
                deals={col.deals}
              />
            ))}
          </div>

          <DragOverlay>
            {activeDeal && (
              <div className="w-72 rotate-2">
                <DealCardContent deal={activeDeal} />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="bg-theme-card rounded-card shadow-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-theme-section">
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Contact</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden md:table-cell">
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Bien</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Prix</span>
                  </th>
                  <th className="text-left px-4 py-3">
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Étape</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Agent</span>
                  </th>
                  <th className="text-left px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Mise à jour</span>
                  </th>
                  <th className="text-right px-4 py-3">
                    <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Actions</span>
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
                      <tr key={deal.id} className="hover:bg-theme-section/50 transition-colors group">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', deal.contact_avatar_color)}>
                              <span className="text-[10px] font-semibold text-white">{initials}</span>
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-theme-primary truncate">{deal.contact_name}</p>
                              <p className="text-xs text-muted-foreground truncate md:hidden">{deal.property_title}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <div className="min-w-0">
                            <p className="text-sm text-theme-primary truncate">{deal.property_title}</p>
                            <p className="text-xs text-muted-foreground truncate">{deal.property_address}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-bold text-theme-primary">{formatCHF(deal.price)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <StageBadge stage={deal.stage} />
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell">
                          <span className="text-sm text-theme-secondary">{deal.agent}</span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className="text-xs text-muted-foreground">{formatRelativeDate(deal.updated_at)}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button className="p-1.5 rounded-md text-theme-tertiary hover:text-accent hover:bg-accent/10 transition-colors">
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
    </div>
    </PageTransition>
  )
}
