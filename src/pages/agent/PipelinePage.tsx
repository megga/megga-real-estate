import { useState, useMemo, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import EmptyPipelineIllustration from '@/components/illustrations/EmptyPipelineIllustration'
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
  Plus, Kanban, List, Search, ChevronDown, AlertTriangle, Loader2,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { useTransactions, useUpdateTransactionStage } from '@/hooks/useTransactions'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import PageTransition from '@/components/layout/PageTransition'
import DealDetailModal from '@/components/transactions/DealDetailModal'

// ── Pipeline Deal shape (derived from Supabase Transaction + joins) ────────

interface PipelineDeal {
  id: string
  contact_name: string
  property_title: string
  price: number
  stage: TransactionStage
  agent: string
  updated_at: string
  has_overdue_reminder: boolean
  contact_id?: string
}

function transactionToDeal(t: Record<string, unknown>): PipelineDeal {
  const buyer = t.buyer as { first_name?: string; last_name?: string } | null
  const seller = t.seller as { first_name?: string; last_name?: string } | null
  const property = t.property as { title?: string; address?: string; city?: string; price?: number; photos?: string[] } | null
  const agent = t.agent as { full_name?: string } | null

  const contactName = buyer
    ? `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim()
    : seller
      ? `${seller.first_name || ''} ${seller.last_name || ''}`.trim()
      : 'Contact'

  return {
    id: t.id as string,
    contact_name: contactName || 'Contact',
    property_title: property?.title || property?.address || 'Bien',
    price: (t.price_offered as number) || (t.price_final as number) || property?.price || 0,
    stage: t.stage as TransactionStage,
    agent: agent?.full_name || 'Agent',
    updated_at: t.updated_at as string,
    has_overdue_reminder: false,
    contact_id: (t.contact_buyer_id as string) || (t.contact_seller_id as string) || undefined,
  }
}

// ── Column config — all 14 columns ──────────────────────────────────────────

const PIPELINE_COLUMNS: { stage: TransactionStage; dotColor: string; isArchive?: boolean }[] = [
  { stage: 'new_lead',            dotColor: 'bg-gray-400' },
  { stage: 'to_qualify',          dotColor: 'bg-gray-500' },
  { stage: 'active_search',       dotColor: 'bg-blue-500' },
  { stage: 'visit_planned',       dotColor: 'bg-cyan-500' },
  { stage: 'visit_done',          dotColor: 'bg-teal-500' },
  { stage: 'interest_confirmed',  dotColor: 'bg-green-500' },
  { stage: 'offer',               dotColor: 'bg-emerald-600' },
  { stage: 'negotiation',         dotColor: 'bg-amber-500' },
  { stage: 'reserved',            dotColor: 'bg-orange-500' },
  { stage: 'financing',           dotColor: 'bg-purple-500' },
  { stage: 'notary',              dotColor: 'bg-indigo-600' },
  { stage: 'signed',              dotColor: 'bg-green-700' },
  { stage: 'lost',                dotColor: 'bg-red-500', isArchive: true },
  { stage: 'to_recontact',        dotColor: 'bg-yellow-500', isArchive: true },
]

const selectClasses = 'h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'

// ── Stage dot map for list view ─────────────────────────────────────────────

const STAGE_DOTS: Record<string, string> = Object.fromEntries(
  PIPELINE_COLUMNS.map((c) => [c.stage, c.dotColor])
)

// ── Avatar helper ───────────────────────────────────────────────────────────

function DealAvatar({ name, size = 'default' }: { name: string; size?: 'default' | 'small' }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const s = size === 'small' ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'
  return (
    <div className={cn('rounded-full bg-theme-active text-theme-secondary font-semibold flex items-center justify-center shrink-0', s)}>
      {initials}
    </div>
  )
}

// ── Deal Card — minimal Lovable style ───────────────────────────────────────

function DealCardContent({ deal, onSelect }: { deal: PipelineDeal; onSelect?: (deal: PipelineDeal) => void }) {
  return (
    <div
      className="rounded-lg border border-theme-border p-3 cursor-grab active:cursor-grabbing hover:border-theme-active hover:bg-theme-hover transition-all group"
      onDoubleClick={() => onSelect?.(deal)}
    >
      <div className="flex items-center gap-2">
        <DealAvatar name={deal.contact_name} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme-primary truncate">{deal.contact_name}</p>
          <p className="text-xs text-theme-tertiary truncate">{deal.property_title}</p>
        </div>
        {deal.has_overdue_reminder && (
          <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Relance en retard" />
        )}
      </div>
      <div className="flex items-center justify-between mt-2.5">
        <span className="text-sm font-semibold text-theme-primary">{formatCHF(deal.price)}</span>
        <span className="text-[11px] text-theme-tertiary">{formatRelativeDate(deal.updated_at)}</span>
      </div>
      {/* Agent — visible on hover */}
      <div className="flex items-center gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <DealAvatar name={deal.agent} size="small" />
        <span className="text-[10px] text-theme-muted">{deal.agent}</span>
      </div>
    </div>
  )
}

// ── Sortable wrapper ────────────────────────────────────────────────────────

function SortableDealCard({ deal }: { deal: PipelineDeal }) {
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

// ── Kanban Column ───────────────────────────────────────────────────────────

function KanbanColumn({ stage, dotColor, deals, isArchive }: {
  stage: TransactionStage
  dotColor: string
  deals: PipelineDeal[]
  isArchive?: boolean
}) {
  const label = TRANSACTION_STAGE_LABELS[stage]
  const totalValue = deals.reduce((sum, d) => sum + d.price, 0)

  return (
    <div className={cn('flex-shrink-0 w-64 flex flex-col', isArchive && 'opacity-60')}>
      {/* Header */}
      <div className="px-1 py-2 mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('h-2 w-2 rounded-full', dotColor)} />
          <span className="text-xs font-medium text-theme-primary">{label}</span>
          <span className="text-[11px] text-theme-tertiary ml-auto">{deals.length}</span>
        </div>
        {deals.length > 0 && (
          <p className="text-[10px] text-theme-muted mt-0.5 pl-4">{formatCHF(totalValue)}</p>
        )}
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

// ── Confirmation dialog for "Perdu" ─────────────────────────────────────────

function LostConfirmDialog({ dealName, onConfirm, onCancel }: {
  dealName: string
  onConfirm: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div className="bg-theme-card border border-theme-border rounded-xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
          <h3 className="text-base font-semibold text-theme-primary">Marquer comme perdu ?</h3>
        </div>
        <p className="text-sm text-theme-secondary">
          Le deal de <span className="font-medium text-theme-primary">{dealName}</span> sera déplacé dans la colonne "Perdu".
        </p>

        <div className="mt-4">
          <label className="text-sm font-medium text-theme-primary block mb-1.5">Raison de la perte *</label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
          >
            <option value="">Sélectionner...</option>
            <option value="budget">Budget insuffisant</option>
            <option value="concurrent">Bien acheté ailleurs</option>
            <option value="financement">Financement refusé</option>
            <option value="desistement">Désistement client</option>
            <option value="prix">Prix trop élevé</option>
            <option value="autre">Autre raison</option>
          </select>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            className="text-sm text-theme-secondary hover:text-theme-primary transition-colors"
            onClick={onCancel}
          >
            Annuler
          </button>
          <button
            disabled={!reason}
            className={cn(
              'h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors',
              !reason && 'opacity-50 cursor-not-allowed'
            )}
            onClick={() => onConfirm(reason)}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function PipelinePage() {
  // Hide parent scrollbar for immersive kanban
  useEffect(() => {
    const main = document.querySelector('main')
    if (main) {
      main.classList.add('scrollbar-hide')
      main.style.scrollbarWidth = 'none'
    }
    return () => {
      if (main) {
        main.classList.remove('scrollbar-hide')
        main.style.scrollbarWidth = ''
      }
    }
  }, [])

  // Supabase data
  const { data: transactions = [], isLoading } = useTransactions()
  const updateStage = useUpdateTransactionStage()

  // Map transactions to pipeline deals
  const deals = useMemo(
    () => (transactions as unknown as Record<string, unknown>[]).map(transactionToDeal),
    [transactions]
  )

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768
  const [view, setView] = useState<'kanban' | 'list'>(isMobile ? 'list' : 'kanban')
  const [search, setSearch] = useState('')
  const [agentFilter, setAgentFilter] = useState('')
  const [stageFilter, setStageFilter] = useState('')
  const [activeDeal, setActiveDeal] = useState<PipelineDeal | null>(null)
  const [showNewTransaction, setShowNewTransaction] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<PipelineDeal | null>(null)
  const [lostConfirm, setLostConfirm] = useState<{ dealId: string; dealName: string } | null>(null)

  // Unique agents from real data
  const agents = useMemo(() => {
    const set = new Set(deals.map(d => d.agent).filter(a => a !== 'Agent'))
    return [...set].sort()
  }, [deals])

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

  // ── Pipeline KPIs ──
  const activeDeals = useMemo(() => deals.filter((d) => !['lost', 'signed'].includes(d.stage)), [deals])
  const pipelineValue = useMemo(() => activeDeals.reduce((sum, d) => sum + d.price, 0), [activeDeals])
  const atRiskCount = useMemo(() => deals.filter((d) => d.has_overdue_reminder).length, [deals])
  const conversionRate = useMemo(() => {
    const signed = deals.filter((d) => d.stage === 'signed').length
    return deals.length > 0 ? Math.round((signed / deals.length) * 100) : 0
  }, [deals])

  function handleDragStart(event: DragStartEvent) {
    setActiveDeal(deals.find((d) => d.id === event.active.id) || null)
  }

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveDeal(null)
    const { active, over } = event
    if (!over) return

    // Find the target stage — either from the over deal or from the column container
    const overDeal = deals.find((d) => d.id === over.id)
    if (!overDeal) return

    const targetStage = overDeal.stage
    const activeDealObj = deals.find((d) => d.id === active.id)
    if (!activeDealObj || activeDealObj.stage === targetStage) return

    // Confirmation required for "lost"
    if (targetStage === 'lost') {
      setLostConfirm({ dealId: activeDealObj.id, dealName: activeDealObj.contact_name })
      return
    }

    // Update in Supabase
    updateStage.mutate({ id: activeDealObj.id, stage: targetStage })
  }, [deals, updateStage])

  function confirmLost(reason: string) {
    if (!lostConfirm) return
    updateStage.mutate({
      id: lostConfirm.dealId,
      stage: 'lost',
      notes: `Perdu — raison : ${reason}`,
      lostReason: reason,
    })
    setLostConfirm(null)
  }

  const hasFilters = search || agentFilter || stageFilter

  // Check if archive separator is needed
  const mainColumns = columns.filter((c) => !c.isArchive)
  const archiveColumns = columns.filter((c) => c.isArchive)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-theme-tertiary" />
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Pipeline</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">{deals.length} deals</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center border border-theme-border rounded-lg p-0.5">
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

        {/* Summary bar — KPIs */}
        <div className="flex items-center gap-6 py-3 px-4 rounded-xl border border-theme-border">
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">Actifs</p>
            <p className="text-lg font-semibold text-theme-primary">{activeDeals.length}</p>
          </div>
          <div className="h-8 w-px bg-theme-border" />
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">Valeur pipeline</p>
            <p className="text-lg font-semibold text-theme-primary">{formatCHF(pipelineValue)}</p>
          </div>
          <div className="h-8 w-px bg-theme-border" />
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">À risque</p>
            <p className={cn('text-lg font-semibold', atRiskCount > 0 ? 'text-orange-500' : 'text-theme-primary')}>{atRiskCount}</p>
          </div>
          <div className="h-8 w-px bg-theme-border" />
          <div>
            <p className="text-[11px] text-theme-tertiary uppercase tracking-wider">Conversion</p>
            <p className="text-lg font-semibold text-theme-primary">{conversionRate}%</p>
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
              {agents.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          <div className="relative">
            <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)} className={selectClasses}>
              <option value="">Étape</option>
              {PIPELINE_COLUMNS.map((col) => (
                <option key={col.stage} value={col.stage}>{TRANSACTION_STAGE_LABELS[col.stage]}</option>
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
          <div>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCorners}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
                {/* Main columns */}
                {mainColumns.map((col) => (
                  <KanbanColumn key={col.stage} stage={col.stage} dotColor={col.dotColor} deals={col.deals} />
                ))}

                {/* Archive separator */}
                {archiveColumns.length > 0 && (
                  <div className="flex-shrink-0 w-px bg-theme-border mx-2 self-stretch" />
                )}

                {/* Archive columns */}
                {archiveColumns.map((col) => (
                  <KanbanColumn key={col.stage} stage={col.stage} dotColor={col.dotColor} deals={col.deals} isArchive />
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
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="rounded-xl border border-theme-border">
            <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
              <span className="flex-1">Contact</span>
              <span className="w-40 hidden md:block">Bien</span>
              <span className="w-28">Prix</span>
              <span className="w-28">Étape</span>
              <span className="w-24 text-right hidden sm:block">Activité</span>
            </div>

            {filtered.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <div className="w-40 h-28 mx-auto mb-4"><EmptyPipelineIllustration /></div>
                <p className="text-sm font-medium text-theme-secondary">Créez votre premier deal pour suivre vos transactions</p>
                <p className="text-xs text-theme-tertiary mt-1">Chaque transaction suit un pipeline de 14 étapes.</p>
              </div>
            ) : (
              filtered.map((deal, i) => (
                <div
                  key={deal.id}
                  onClick={() => setSelectedDeal(deal)}
                  className={cn(
                    'flex items-center px-4 py-3 hover:bg-theme-hover transition-colors cursor-pointer group',
                    i < filtered.length - 1 && 'border-b border-theme-border'
                  )}
                >
                  <div className="flex-1 min-w-0 flex items-center gap-2">
                    <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">{deal.contact_name}</p>
                    {deal.has_overdue_reminder && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" title="Relance en retard" />
                    )}
                  </div>
                  <div className="w-40 hidden md:block">
                    <p className="text-xs text-theme-tertiary truncate">{deal.property_title}</p>
                  </div>
                  <span className="w-28 text-sm font-medium text-theme-primary">{formatCHF(deal.price)}</span>
                  <div className="w-28 flex items-center gap-1.5">
                    <div className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOTS[deal.stage] || 'bg-gray-400')} />
                    <span className="text-xs text-theme-secondary">{TRANSACTION_STAGE_LABELS[deal.stage] || deal.stage}</span>
                  </div>
                  <span className="w-24 text-xs text-theme-tertiary text-right hidden sm:block">{formatRelativeDate(deal.updated_at)}</span>
                </div>
              ))
            )}
          </div>
        )}

        <NewTransactionDialog open={showNewTransaction} onClose={() => setShowNewTransaction(false)} />

        {selectedDeal && (
          <DealDetailModal deal={selectedDeal} onClose={() => setSelectedDeal(null)} />
        )}

        {lostConfirm && (
          <LostConfirmDialog
            dealName={lostConfirm.dealName}
            onConfirm={confirmLost}
            onCancel={() => setLostConfirm(null)}
          />
        )}
      </div>
    </PageTransition>
  )
}
