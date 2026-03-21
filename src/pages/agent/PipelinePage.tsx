import { useState, useMemo } from 'react'
import NewTransactionDialog from '@/components/transactions/NewTransactionDialog'
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
  Plus, Kanban, List, Search, ChevronDown,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MOCK_DEALS, type MockDeal } from '@/lib/mockData'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import PageTransition from '@/components/layout/PageTransition'

// Column config — dot colors only, no backgrounds
const PIPELINE_COLUMNS: { stage: MockDeal['stage']; dotColor: string }[] = [
  { stage: 'new_lead',      dotColor: 'bg-gray-400' },
  { stage: 'to_qualify',    dotColor: 'bg-blue-400' },
  { stage: 'visit_planned', dotColor: 'bg-amber-400' },
  { stage: 'offer',         dotColor: 'bg-purple-400' },
  { stage: 'negotiation',   dotColor: 'bg-red-400' },
  { stage: 'signed',        dotColor: 'bg-emerald-400' },
]

const AGENTS = ['Gregory L.', 'Sophie M.']

const selectClasses = 'h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'

// ── Deal Card — minimal Lovable style ─────────────────────────────────────

function DealCardContent({ deal }: { deal: MockDeal }) {
  return (
    <div className="rounded-lg border border-theme-border p-3 cursor-grab active:cursor-grabbing hover:border-theme-active hover:bg-theme-hover transition-all group">
      <p className="text-sm font-medium text-theme-primary truncate">{deal.contact_name}</p>
      <p className="text-xs text-theme-tertiary truncate mt-0.5">{deal.property_title}</p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm font-semibold text-theme-primary">{formatCHF(deal.price)}</span>
        <span className="text-[11px] text-theme-tertiary">{formatRelativeDate(deal.updated_at)}</span>
      </div>
    </div>
  )
}

// ── Sortable wrapper ──────────────────────────────────────────────────────

function SortableDealCard({ deal }: { deal: MockDeal }) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: deal.id, data: { deal } })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <DealCardContent deal={deal} />
    </div>
  )
}

// ── Kanban Column — transparent ───────────────────────────────────────────

function KanbanColumn({ stage, dotColor, deals }: {
  stage: MockDeal['stage']
  dotColor: string
  deals: MockDeal[]
}) {
  const label = TRANSACTION_STAGE_LABELS[stage as TransactionStage]

  return (
    <div className="flex-shrink-0 w-64 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-1 py-2 mb-2">
        <div className={cn('h-2 w-2 rounded-full', dotColor)} />
        <span className="text-xs font-medium text-theme-primary">{label}</span>
        <span className="text-[11px] text-theme-tertiary ml-auto">{deals.length}</span>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2 min-h-[100px]">
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <SortableDealCard key={deal.id} deal={deal} />
          ))}
        </SortableContext>

        {deals.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-theme-tertiary border border-dashed border-theme-border rounded-lg">
            Déposez ici
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stage dot for list view ───────────────────────────────────────────────

const STAGE_DOTS: Record<string, string> = {
  new_lead: 'bg-gray-400',
  to_qualify: 'bg-blue-400',
  visit_planned: 'bg-amber-400',
  offer: 'bg-purple-400',
  negotiation: 'bg-red-400',
  signed: 'bg-emerald-400',
}

// ── Main Page ─────────────────────────────────────────────────────────────

export default function PipelinePage() {
  const [deals, setDeals] = useState<MockDeal[]>(MOCK_DEALS)
  const [view, setView] = useState<'kanban' | 'list'>('kanban')
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [activeDeal, setActiveDeal] = useState<MockDeal | null>(null)
  const [showNewTransaction, setShowNewTransaction] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const filtered = useMemo(() => {
    let list = [...deals]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((d) => d.contact_name.toLowerCase().includes(q) || d.property_title.toLowerCase().includes(q))
    }
    if (agentFilter) list = list.filter((d) => d.agent === agentFilter)
    if (stageFilter) list = list.filter((d) => d.stage === stageFilter)
    return list
  }, [deals, search, agentFilter, stageFilter])

  const columns = useMemo(() =>
    PIPELINE_COLUMNS.map((col) => ({ ...col, deals: filtered.filter((d) => d.stage === col.stage) })),
    [filtered]
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveDeal(deals.find((d) => d.id === event.active.id) || null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveDeal(null)
    const { active, over } = event
    if (!over) return
    const overDeal = deals.find((d) => d.id === over.id)
    if (overDeal) {
      setDeals((prev) => prev.map((d) => d.id === active.id ? { ...d, stage: overDeal.stage, updated_at: new Date().toISOString() } : d))
    }
  }

  function handleDragOver(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const activeDealObj = deals.find((d) => d.id === active.id)
    const overDealObj = deals.find((d) => d.id === over.id)
    if (activeDealObj && overDealObj && activeDealObj.stage !== overDealObj.stage) {
      setDeals((prev) => prev.map((d) => d.id === active.id ? { ...d, stage: overDealObj.stage } : d))
    }
  }

  const hasFilters = search || agentFilter || stageFilter

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header — minimal */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Pipeline</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">{deals.length} deals</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center border border-theme-border rounded-lg p-0.5">
              <button
                onClick={() => setView('kanban')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'kanban' ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  view === 'list' ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                <List className="h-3.5 w-3.5" />
                Liste
              </button>
            </div>

            <button
              onClick={() => setShowNewTransaction(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Nouveau deal
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="relative">
            <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className={selectClasses}>
              <option value="">Agent</option>
              {AGENTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          <div className="relative">
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={selectClasses}>
              <option value="">Étape</option>
              {PIPELINE_COLUMNS.map((col) => (
                <option key={col.stage} value={col.stage}>{TRANSACTION_STAGE_LABELS[col.stage as TransactionStage]}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {hasFilters && (
            <button onClick={() => { setSearch(''); setAgentFilter(''); setStageFilter('') }} className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors">
              Effacer
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
                <KanbanColumn key={col.stage} stage={col.stage} dotColor={col.dotColor} deals={col.deals} />
              ))}
            </div>

            <DragOverlay>
              {activeDeal && (
                <div className="w-64 rotate-2 opacity-90">
                  <DealCardContent deal={activeDeal} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}

        {/* List View — transparent bento */}
        {view === 'list' && (
          <div className="rounded-xl border border-theme-border">
            {/* Header */}
            <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
              <span className="flex-1">Contact</span>
              <span className="w-40 hidden md:block">Bien</span>
              <span className="w-28">Prix</span>
              <span className="w-28">Étape</span>
              <span className="w-24 text-right hidden sm:block">Activité</span>
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-sm text-theme-tertiary">Aucun deal trouvé</p>
              </div>
            ) : (
              filtered.map((deal, i) => (
                <div
                  key={deal.id}
                  className={cn(
                    'flex items-center px-4 py-3 hover:bg-theme-hover transition-colors cursor-pointer group',
                    i < filtered.length - 1 && 'border-b border-theme-border'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">{deal.contact_name}</p>
                  </div>
                  <div className="w-40 hidden md:block">
                    <p className="text-xs text-theme-tertiary truncate">{deal.property_title}</p>
                  </div>
                  <span className="w-28 text-sm font-medium text-theme-primary">{formatCHF(deal.price)}</span>
                  <div className="w-28 flex items-center gap-1.5">
                    <div className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOTS[deal.stage] || 'bg-gray-400')} />
                    <span className="text-xs text-theme-secondary">{TRANSACTION_STAGE_LABELS[deal.stage as TransactionStage] || deal.stage}</span>
                  </div>
                  <span className="w-24 text-xs text-theme-tertiary text-right hidden sm:block">{formatRelativeDate(deal.updated_at)}</span>
                </div>
              ))
            )}
          </div>
        )}

        <NewTransactionDialog open={showNewTransaction} onClose={() => setShowNewTransaction(false)} />
      </div>
    </PageTransition>
  )
}
