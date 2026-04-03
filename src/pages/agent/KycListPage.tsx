import { useState, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import {
  Search, Eye, ChevronLeft, ChevronRight,
  ChevronUp, ChevronDown, AlertTriangle, ShieldCheck,
  Loader2, Plus, X, Copy, CheckCircle2,
} from 'lucide-react'
import EmptyKycIllustration from '@/components/illustrations/EmptyKycIllustration'
import { cn, formatRelativeDate } from '@/lib/utils'
import { calculateRiskScore } from '@/lib/kycUtils'
import {
  KYC_STATUS_LABELS, KYC_RISK_LABELS, KYC_TYPE_LABELS,
  KYC_STATUSES, KYC_RISK_LEVELS, KYC_TYPES,
} from '@/lib/constants'
import type { PepStatus, KycType as KycTypeConst } from '@/lib/constants'
import { useKycCases, useCreateKycCase, useScreenKycCase, useUpdateKycStatus, useValidateKycCase } from '@/hooks/useKyc'
import { useContacts } from '@/hooks/useContacts'
import { useTransactions } from '@/hooks/useTransactions'
import { useAuth } from '@/hooks/useAuth'
import type { KycCase, KycStatus, KycType } from '@/types/kyc'
import {
  ContextMenu, ContextMenuTrigger, ContextMenuContent,
  ContextMenuItem, ContextMenuSeparator, ContextMenuLabel,
  ContextMenuSub, ContextMenuSubTrigger, ContextMenuSubContent,
} from '@/components/ui/context-menu'

type SortField = 'contact' | 'completion' | 'updated'
type SortDir = 'asc' | 'desc'

const ITEMS_PER_PAGE = 10

function progressColor(pct: number) {
  if (pct < 40) return 'bg-danger'
  if (pct < 70) return 'bg-warning'
  return 'bg-success'
}

function statusBadge(status: KycStatus) {
  const map: Record<KycStatus, string> = {
    pending:     'text-theme-tertiary',
    in_progress: 'text-accent',
    review:      'text-warning',
    validated:   'text-success',
    rejected:    'text-danger',
  }
  return (
    <span className={cn('text-xs font-medium', map[status])}>
      {KYC_STATUS_LABELS[status]}
    </span>
  )
}

function ContactAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 bg-theme-active">
      <span className="text-xs font-semibold text-theme-primary">{initials}</span>
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) return <ChevronUp className="h-3.5 w-3.5 text-theme-tertiary" />
  return sortDir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 text-accent" />
    : <ChevronDown className="h-3.5 w-3.5 text-accent" />
}

function getContactName(kyc: KycCase): string {
  if (kyc.contact) return `${kyc.contact.first_name} ${kyc.contact.last_name}`
  return `Dossier ${kyc.type === 'buyer_pp' || kyc.type === 'buyer_pm' ? 'Acheteur' : 'Vendeur'}`
}

function pepSanctionsIcon(pepStatus: string, sanctionsStatus: string) {
  const pep = pepStatus ?? 'not_checked'
  const sanctions = sanctionsStatus ?? 'not_checked'
  const hasMatch = pep === 'match' || sanctions === 'match'
  const isPending = pep === 'pending' || sanctions === 'pending'
  const isClear = pep === 'clear' && sanctions === 'clear'

  if (hasMatch) return <AlertTriangle className="w-4 h-4 text-red-500" />
  if (isPending) return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />
  if (isClear) return <ShieldCheck className="w-4 h-4 text-emerald-500" />
  return <span className="text-xs text-theme-tertiary">—</span>
}

// ─── Create KYC Modal ──────────────────────────────────────────────────────

interface CreateKycModalProps {
  onClose: () => void
  onCreated: (id: string) => void
}

function CreateKycModal({ onClose, onCreated }: CreateKycModalProps) {
  const { profile } = useAuth()
  const { contacts } = useContacts()
  const { data: transactionsData } = useTransactions()
  const createMutation = useCreateKycCase()

  const [contactId, setContactId] = useState('')
  const [transactionId, setTransactionId] = useState('')
  const [kycType, setKycType] = useState<KycType>('buyer_pp')
  const [nationality, setNationality] = useState('CH')
  const [amount, setAmount] = useState('')

  const contactList = contacts ?? []
  const transactionList = transactionsData ?? []

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!contactId || !profile?.agency_id) return

    createMutation.mutate({
      agencyId: profile.agency_id,
      contactId,
      transactionId: transactionId || undefined,
      type: kycType,
      contactNationality: nationality || undefined,
      transactionAmount: amount ? parseFloat(amount) : undefined,
    }, {
      onSuccess: (data) => onCreated(data.id),
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-theme-card border border-theme-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-theme-primary">Nouveau dossier KYC</h3>
          <button onClick={onClose} className="text-theme-tertiary hover:text-theme-primary transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Contact */}
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">Contact *</label>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              required
              className="w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">Sélectionner un contact</option>
              {contactList.map((c: { id: string; first_name: string; last_name: string; type: string }) => (
                <option key={c.id} value={c.id}>
                  {c.first_name} {c.last_name} ({c.type})
                </option>
              ))}
            </select>
          </div>

          {/* Type KYC */}
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">Type de dossier *</label>
            <select
              value={kycType}
              onChange={(e) => setKycType(e.target.value as KycType)}
              className="w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              {KYC_TYPES.map((t) => (
                <option key={t} value={t}>{KYC_TYPE_LABELS[t as KycTypeConst]}</option>
              ))}
            </select>
          </div>

          {/* Transaction (optionnel) */}
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">Transaction liée (optionnel)</label>
            <select
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              className="w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            >
              <option value="">Aucune transaction</option>
              {transactionList.map((t) => {
                const tx = t as unknown as Record<string, unknown>
                const buyer = tx.buyer as { first_name: string; last_name: string } | null
                const property = tx.property as { address?: string } | null
                const label = buyer
                  ? `${buyer.first_name} ${buyer.last_name} — ${property?.address ?? 'Bien'}`
                  : `Transaction ${String(tx.id).slice(0, 8)}`
                return (
                  <option key={String(tx.id)} value={String(tx.id)}>{label}</option>
                )
              })}
            </select>
          </div>

          {/* Nationalité */}
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">Nationalité du contact</label>
            <input
              type="text"
              value={nationality}
              onChange={(e) => setNationality(e.target.value.toUpperCase())}
              placeholder="CH"
              maxLength={2}
              className="w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
            <p className="text-[11px] text-theme-tertiary mt-1">Code pays ISO 2 lettres (CH, FR, DE...)</p>
          </div>

          {/* Montant */}
          <div>
            <label className="block text-sm font-medium text-theme-secondary mb-1.5">Montant de la transaction (CHF)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="850000"
              min="0"
              className="w-full h-10 px-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          {createMutation.isError && (
            <p className="text-xs text-red-500">Erreur lors de la création du dossier</p>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-theme-secondary hover:text-theme-primary transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={!contactId || createMutation.isPending}
              className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50"
            >
              {createMutation.isPending ? 'Création...' : 'Créer le dossier'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function KycListPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [riskFilter, setRiskFilter] = useState<string>('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('updated')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { profile } = useAuth()
  const { data: kycCases, isLoading, error } = useKycCases()
  const screenMutation = useScreenKycCase()
  const statusMutation = useUpdateKycStatus()
  const validateMutation = useValidateKycCase()

  const dataSource = useMemo(() => kycCases ?? [], [kycCases])

  const handleScreen = useCallback((kyc: KycCase) => {
    const contactName = getContactName(kyc)
    const entityType = kyc.type.includes('_pm') ? 'entity' as const : 'individual' as const
    screenMutation.mutate({
      kycCaseId: kyc.id,
      contactName,
      contactNationality: kyc.contact_nationality ?? 'CH',
      entityType,
    })
  }, [screenMutation])

  const handleStatusChange = useCallback((id: string, status: KycStatus) => {
    statusMutation.mutate({ id, status })
  }, [statusMutation])

  const handleValidate = useCallback((id: string) => {
    if (!profile) return
    validateMutation.mutate({ id, validated_by: profile.full_name || profile.email })
  }, [validateMutation, profile])

  const handleCopyId = useCallback((id: string) => {
    navigator.clipboard.writeText(id)
  }, [])

  const filtered = useMemo(() => {
    let list = [...dataSource]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) => {
        const name = getContactName(c).toLowerCase()
        return name.includes(q)
      })
    }
    if (statusFilter) list = list.filter((c) => c.status === statusFilter)
    if (riskFilter) list = list.filter((c) => c.risk_level === riskFilter)
    if (typeFilter) list = list.filter((c) => c.type === typeFilter)

    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'contact') {
        cmp = getContactName(a).localeCompare(getContactName(b))
      } else if (sortField === 'completion') {
        cmp = a.completion_pct - b.completion_pct
      } else if (sortField === 'updated') {
        cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [dataSource, search, statusFilter, riskFilter, typeFilter, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'contact' ? 'asc' : 'desc')
    }
  }

  const counts = useMemo(() => {
    const c: Record<KycStatus, number> = { pending: 0, in_progress: 0, review: 0, validated: 0, rejected: 0 }
    dataSource.forEach((k) => { c[k.status]++ })
    return c
  }, [dataSource])

  function handleCreated(id: string) {
    setShowCreateModal(false)
    navigate(`/dashboard/kyc/${id}`)
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-theme-primary">Dossiers KYC</h1>
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <Loader2 className="h-8 w-8 text-theme-tertiary mx-auto mb-3 animate-spin" />
          <p className="text-sm text-theme-tertiary">Chargement des dossiers...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-theme-primary">Dossiers KYC</h1>
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <AlertTriangle className="h-8 w-8 text-danger mx-auto mb-3" />
          <p className="text-sm text-theme-tertiary">Erreur lors du chargement</p>
        </div>
      </div>
    )
  }

  // Empty state
  if (dataSource.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-theme-primary">Dossiers KYC</h1>
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <div className="w-40 h-28 mx-auto mb-4"><EmptyKycIllustration /></div>
          <p className="text-theme-secondary font-medium mb-1">Aucun dossier KYC</p>
          <p className="text-sm text-theme-tertiary mb-4">Créez votre premier dossier de vérification</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Créer un dossier KYC
          </button>
        </div>
        {showCreateModal && <CreateKycModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">
            Dossiers KYC
          </h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {dataSource.length} dossiers · {counts.review} en revue · {counts.in_progress} en cours
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center gap-1.5"
        >
          <Plus className="h-4 w-4" />
          Nouveau dossier
        </button>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setStatusFilter(''); setPage(1) }}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
            !statusFilter ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
          )}
        >
          Tous ({dataSource.length})
        </button>
        {KYC_STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(statusFilter === s ? '' : s); setPage(1) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              statusFilter === s ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
            )}
          >
            {KYC_STATUS_LABELS[s]} ({counts[s]})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
          <input
            type="text"
            placeholder="Rechercher par nom..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full h-10 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        <select
          value={riskFilter}
          onChange={(e) => { setRiskFilter(e.target.value); setPage(1) }}
          className="h-10 px-3 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les risques</option>
          {KYC_RISK_LEVELS.map((r) => (
            <option key={r} value={r}>{KYC_RISK_LABELS[r]}</option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          className="h-10 px-3 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les types</option>
          {KYC_TYPES.map((t) => (
            <option key={t} value={t}>{KYC_TYPE_LABELS[t as KycTypeConst]}</option>
          ))}
        </select>

        {(search || statusFilter || riskFilter || typeFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setRiskFilter(''); setTypeFilter(''); setPage(1) }}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-transparent rounded-card shadow-none overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-theme-border bg-theme-section">
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('contact')}
                    className="flex items-center gap-1 text-xs font-semibold text-theme-secondary uppercase tracking-wider hover:text-theme-primary"
                  >
                    Contact
                    <SortIcon field="contact" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Type</span>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">PEP/S</span>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Risque</span>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Statut</span>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('completion')}
                    className="flex items-center gap-1 text-xs font-semibold text-theme-secondary uppercase tracking-wider hover:text-theme-primary"
                  >
                    Progression
                    <SortIcon field="completion" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  <button
                    onClick={() => toggleSort('updated')}
                    className="flex items-center gap-1 text-xs font-semibold text-theme-secondary uppercase tracking-wider hover:text-theme-primary"
                  >
                    Créé
                    <SortIcon field="updated" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-4 py-3">
                  <span className="text-xs font-semibold text-theme-secondary uppercase tracking-wider">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <ShieldCheck className="h-10 w-10 text-theme-tertiary mx-auto mb-3" />
                    <p className="text-sm text-theme-tertiary">Aucun dossier trouvé</p>
                  </td>
                </tr>
              ) : (
                paginated.map((kyc) => {
                  const contactName = getContactName(kyc)
                  const pepStatus = (kyc.pep_status ?? 'not_checked') as PepStatus
                  const sanctionsStatus = kyc.sanctions_status ?? 'not_checked'

                  const riskScore = kyc.risk_score ?? calculateRiskScore({
                    contactNationality: kyc.contact_nationality ?? 'CH',
                    pepStatus: pepStatus === 'match' ? 'match' : 'clear',
                    transactionAmount: kyc.transaction_amount ?? 0,
                    kycType: kyc.type,
                    completionPct: kyc.completion_pct,
                  }).score

                  const riskLevel = riskScore >= 40 ? 'high' : riskScore >= 20 ? 'medium' : 'low'
                  const canValidate = kyc.status !== 'validated' && kyc.status !== 'rejected'

                  return (
                    <ContextMenu key={kyc.id}>
                      <ContextMenuTrigger asChild>
                        <tr className="hover:bg-theme-section/50 transition-colors group cursor-default">
                          <td className="px-4 py-3">
                            <Link to={`/dashboard/kyc/${kyc.id}`} className="flex items-center gap-3">
                              <ContactAvatar name={contactName} />
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">
                                  {contactName}
                                </p>
                              </div>
                            </Link>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-theme-hover text-theme-secondary">
                              {KYC_TYPE_LABELS[kyc.type]}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {pepSanctionsIcon(pepStatus, sanctionsStatus)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn(
                              'text-xs font-bold tabular-nums',
                              riskLevel === 'high' ? 'text-red-500' : riskLevel === 'medium' ? 'text-amber-500' : 'text-emerald-500'
                            )}>
                              {riskScore}
                            </span>
                          </td>
                          <td className="px-4 py-3">{statusBadge(kyc.status)}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-2 bg-theme-active rounded-full overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all', progressColor(kyc.completion_pct))}
                                  style={{ width: `${kyc.completion_pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-medium text-theme-secondary w-8 text-right">
                                {kyc.completion_pct}%
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 hidden lg:table-cell">
                            <span className="text-xs text-theme-tertiary">
                              {formatRelativeDate(kyc.created_at)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end">
                              <Link
                                to={`/dashboard/kyc/${kyc.id}`}
                                className="p-1.5 rounded-md text-theme-tertiary hover:text-accent hover:bg-accent/10 transition-colors"
                                title="Voir le dossier"
                              >
                                <Eye className="h-4 w-4" />
                              </Link>
                            </div>
                          </td>
                        </tr>
                      </ContextMenuTrigger>
                      <ContextMenuContent>
                        <ContextMenuLabel>{contactName}</ContextMenuLabel>
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => navigate(`/dashboard/kyc/${kyc.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                          Voir le dossier
                        </ContextMenuItem>
                        <ContextMenuItem onSelect={() => handleScreen(kyc)}>
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Lancer le screening
                        </ContextMenuItem>
                        <ContextMenuSeparator />
                        <ContextMenuSub>
                          <ContextMenuSubTrigger>
                            Changer le statut
                          </ContextMenuSubTrigger>
                          <ContextMenuSubContent>
                            {KYC_STATUSES.filter(s => s !== 'validated' && s !== 'rejected').map((s) => (
                              <ContextMenuItem
                                key={s}
                                onSelect={() => handleStatusChange(kyc.id, s)}
                                disabled={kyc.status === s}
                              >
                                {KYC_STATUS_LABELS[s]}
                              </ContextMenuItem>
                            ))}
                          </ContextMenuSubContent>
                        </ContextMenuSub>
                        {canValidate && (
                          <ContextMenuItem onSelect={() => handleValidate(kyc.id)}>
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                            Valider le dossier
                          </ContextMenuItem>
                        )}
                        <ContextMenuSeparator />
                        <ContextMenuItem onSelect={() => handleCopyId(kyc.id)}>
                          <Copy className="h-3.5 w-3.5" />
                          Copier l'ID
                        </ContextMenuItem>
                      </ContextMenuContent>
                    </ContextMenu>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border bg-theme-section/50">
            <p className="text-xs text-theme-tertiary">
              {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length} dossiers
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-md text-theme-secondary hover:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 min-w-[32px] px-2 rounded-md text-sm font-medium transition-colors',
                    p === safePage ? 'bg-accent text-white' : 'text-theme-secondary hover:bg-transparent'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-md text-theme-secondary hover:bg-transparent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreateModal && <CreateKycModal onClose={() => setShowCreateModal(false)} onCreated={handleCreated} />}
    </div>
  )
}
