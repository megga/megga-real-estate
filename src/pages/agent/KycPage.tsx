import { useState, useMemo } from 'react'
import {
  Search, ShieldCheck, AlertTriangle, Clock, CheckCircle2,
  ChevronRight, FileText,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import EmptyState from '@/components/ui/empty-state'

type KycStatus = 'pending' | 'in_progress' | 'review' | 'validated' | 'rejected'
type RiskLevel = 'low' | 'medium' | 'high' | 'unassessed'

interface MockKycCase {
  id: string
  contactName: string
  type: string
  status: KycStatus
  riskLevel: RiskLevel
  completionPct: number
  updatedAt: string
  documentsCount: number
  documentsTotal: number
}

const STATUS_MAP: Record<KycStatus, { label: string; cls: string; icon: typeof Clock }> = {
  pending: { label: 'En attente', cls: 'bg-primary-100 text-primary-600', icon: Clock },
  in_progress: { label: 'En cours', cls: 'bg-accent/10 text-accent', icon: FileText },
  review: { label: 'En revue', cls: 'bg-warning/10 text-warning', icon: AlertTriangle },
  validated: { label: 'Validé', cls: 'bg-success/10 text-success', icon: CheckCircle2 },
  rejected: { label: 'Rejeté', cls: 'bg-danger/10 text-danger', icon: AlertTriangle },
}

const RISK_MAP: Record<RiskLevel, { label: string; cls: string }> = {
  low: { label: 'Faible', cls: 'bg-success/10 text-success' },
  medium: { label: 'Moyen', cls: 'bg-warning/10 text-warning' },
  high: { label: 'Élevé', cls: 'bg-danger/10 text-danger' },
  unassessed: { label: 'Non évalué', cls: 'bg-primary-100 text-primary-400' },
}

const MOCK_KYC_CASES: MockKycCase[] = [
  {
    id: '1', contactName: 'Laurent Berset', type: 'Acheteur PP',
    status: 'in_progress', riskLevel: 'low', completionPct: 65,
    updatedAt: '2026-03-16T10:00:00Z', documentsCount: 4, documentsTotal: 6,
  },
  {
    id: '2', contactName: 'Claudine Thévenaz', type: 'Acheteur PM',
    status: 'review', riskLevel: 'medium', completionPct: 90,
    updatedAt: '2026-03-15T14:00:00Z', documentsCount: 8, documentsTotal: 9,
  },
  {
    id: '3', contactName: 'Pierre Lefèvre', type: 'Acheteur PP',
    status: 'pending', riskLevel: 'unassessed', completionPct: 20,
    updatedAt: '2026-03-14T09:00:00Z', documentsCount: 1, documentsTotal: 6,
  },
  {
    id: '4', contactName: 'Andreas Huber', type: 'Vendeur PP',
    status: 'validated', riskLevel: 'low', completionPct: 100,
    updatedAt: '2026-03-10T16:00:00Z', documentsCount: 5, documentsTotal: 5,
  },
  {
    id: '5', contactName: 'Sophie Müller', type: 'Vendeur PP',
    status: 'in_progress', riskLevel: 'high', completionPct: 45,
    updatedAt: '2026-03-13T11:00:00Z', documentsCount: 3, documentsTotal: 7,
  },
]

export default function KycPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = useMemo(() => {
    let list = [...MOCK_KYC_CASES]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => c.contactName.toLowerCase().includes(q))
    }
    if (statusFilter) list = list.filter((c) => c.status === statusFilter)
    return list
  }, [search, statusFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Dossiers KYC</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{MOCK_KYC_CASES.length} dossiers au total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Rechercher un dossier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un dossier KYC"
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrer par statut"
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les statuts</option>
          <option value="pending">En attente</option>
          <option value="in_progress">En cours</option>
          <option value="review">En revue</option>
          <option value="validated">Validé</option>
          <option value="rejected">Rejeté</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* KYC cases list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-card shadow-card p-12">
          <EmptyState
            icon={ShieldCheck}
            title="Aucun dossier trouvé"
            description="Essayez de modifier vos filtres."
            action={{ label: 'Effacer les filtres', onClick: () => { setSearch(''); setStatusFilter('') } }}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((kycCase) => {
            const status = STATUS_MAP[kycCase.status]
            const risk = RISK_MAP[kycCase.riskLevel]
            const StatusIcon = status.icon

            return (
              <div
                key={kycCase.id}
                className="bg-white rounded-card shadow-card p-4 hover:shadow-card-hover transition-shadow cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  {/* Icon */}
                  <div className={cn('h-10 w-10 rounded-button flex items-center justify-center flex-shrink-0', status.cls)}>
                    <StatusIcon className="h-5 w-5" aria-hidden="true" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-primary-900 group-hover:text-accent transition-colors">
                        {kycCase.contactName}
                      </h3>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">{kycCase.type}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', status.cls)}>
                        {status.label}
                      </span>
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-badge', risk.cls)}>
                        Risque {risk.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {kycCase.documentsCount}/{kycCase.documentsTotal} docs
                      </span>
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="hidden sm:flex flex-col items-end gap-1 flex-shrink-0">
                    <span className="text-xs font-medium text-primary-900">{kycCase.completionPct}%</span>
                    <div className="w-24 h-1.5 bg-primary-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          kycCase.completionPct === 100 ? 'bg-success' : 'bg-accent'
                        )}
                        style={{ width: `${kycCase.completionPct}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{formatRelativeDate(kycCase.updatedAt)}</span>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="h-4 w-4 text-primary-300 group-hover:text-accent transition-colors flex-shrink-0" aria-hidden="true" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
