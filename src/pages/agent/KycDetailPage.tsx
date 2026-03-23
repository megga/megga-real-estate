import { useState, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, CheckCircle2, Circle, Clock, FileText,
  Upload, X, ChevronDown, ChevronRight,
  Sparkles, Loader2,
} from 'lucide-react'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import { KYC_STATUS_LABELS, KYC_RISK_LABELS, KYC_TYPE_LABELS, PEP_STATUS_LABELS, SANCTIONS_STATUS_LABELS } from '@/lib/constants'
import type { PepStatus, SanctionsStatus } from '@/lib/constants'
import { calculateRiskScore } from '@/lib/kycUtils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import {
  useKycCase, useKycDocuments, useKycAuditEvents,
  useValidateKycCase, useUpdateKycNotes, useUploadKycDocument,
  useScreenKycCase, useUpdateKycItem,
} from '@/hooks/useKyc'
import type { KycStatus, KycChecklistItem, KycDocument, KycAuditEvent, DocumentCategory } from '@/types/kyc'

function progressColor(pct: number) {
  if (pct < 40) return 'bg-danger'
  if (pct < 70) return 'bg-warning'
  return 'bg-success'
}

function progressTextColor(pct: number) {
  if (pct < 40) return 'text-danger'
  if (pct < 70) return 'text-warning'
  return 'text-success'
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

function riskBadge(risk: 'low' | 'medium' | 'high' | 'unassessed') {
  const map = {
    low:        { dot: 'bg-success',        text: 'text-success' },
    medium:     { dot: 'bg-warning',        text: 'text-warning' },
    high:       { dot: 'bg-danger',         text: 'text-danger' },
    unassessed: { dot: 'bg-theme-tertiary', text: 'text-theme-tertiary' },
  }
  const r = map[risk]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', r.text)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', r.dot)} />
      {KYC_RISK_LABELS[risk]}
    </span>
  )
}

function docStatusIcon(status: 'validated' | 'pending' | 'rejected' | null) {
  switch (status) {
    case 'validated': return <CheckCircle2 className="h-4 w-4 text-success" />
    case 'pending': return <Clock className="h-4 w-4 text-warning" />
    case 'rejected': return <X className="h-4 w-4 text-danger" />
    default: return <Circle className="h-4 w-4 text-theme-tertiary" />
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

const CATEGORIES = ['Identité', 'Domicile', 'Revenus', 'Origine des fonds', 'Compliance'] as const

export default function KycDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { profile } = useAuth()
  const [showValidateModal, setShowValidateModal] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES)
  )
  const [notes, setNotes] = useState('')
  const [notesInitialized, setNotesInitialized] = useState(false)
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('other')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Supabase queries ──────────────────────────────────────────────────────
  const { data: kyc, isLoading: kycLoading, error: kycError } = useKycCase(id)
  const { data: documents = [] } = useKycDocuments(id)
  const { data: auditEvents = [] } = useKycAuditEvents(id)

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const validateMutation = useValidateKycCase()
  const notesMutation = useUpdateKycNotes()
  const uploadMutation = useUploadKycDocument()
  const screenMutation = useScreenKycCase()
  const toggleItemMutation = useUpdateKycItem()

  // Initialize notes from DB
  if (kyc && !notesInitialized) {
    setNotes(kyc.notes ?? '')
    setNotesInitialized(true)
  }

  const checklist = useMemo(() => kyc?.checklist ?? [], [kyc?.checklist])

  const checklistByCategory = useMemo(() => {
    const map = new Map<string, KycChecklistItem[]>()
    CATEGORIES.forEach((cat) => map.set(cat, []))
    checklist.forEach((item) => {
      const items = map.get(item.category)
      if (items) items.push(item)
    })
    return map
  }, [checklist])

  function toggleCategory(cat: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  function handleValidate() {
    if (!id || !profile) return
    validateMutation.mutate(
      { id, validated_by: profile.full_name || profile.email },
      { onSuccess: () => setShowValidateModal(false) }
    )
  }

  function handleSaveNotes() {
    if (!id || !notes.trim()) return
    notesMutation.mutate({ id, notes: notes.trim() })
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !id || !kyc || !profile) return
    uploadMutation.mutate({
      kycCaseId: id,
      agencyId: kyc.agency_id,
      file,
      documentCategory: uploadCategory,
      uploadedBy: profile.id,
    })
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleScreening() {
    if (!id || !kyc) return
    const contactName = kyc.contact
      ? `${kyc.contact.first_name} ${kyc.contact.last_name}`
      : 'Unknown'
    const entityType = kyc.type.includes('_pm') ? 'entity' as const : 'individual' as const
    screenMutation.mutate({
      kycCaseId: id,
      contactName,
      contactNationality: kyc.contact_nationality ?? kyc.contact?.nationality ?? 'CH',
      entityType,
    })
  }

  function handleToggleItem(itemId: string, currentCompleted: boolean) {
    toggleItemMutation.mutate({ id: itemId, is_completed: !currentCompleted })
  }

  // ─── Loading / Error / Not found ──────────────────────────────────────────

  if (kycLoading) {
    return (
      <div className="space-y-6">
        <Link to="/dashboard/kyc" className="inline-flex items-center gap-1.5 text-sm text-theme-tertiary hover:text-theme-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Retour aux dossiers
        </Link>
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <Loader2 className="h-8 w-8 text-theme-tertiary mx-auto mb-3 animate-spin" />
          <p className="text-sm text-theme-tertiary">Chargement du dossier...</p>
        </div>
      </div>
    )
  }

  if (kycError || !kyc) {
    return (
      <div className="space-y-6">
        <Link to="/dashboard/kyc" className="inline-flex items-center gap-1.5 text-sm text-theme-tertiary hover:text-theme-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Retour aux dossiers
        </Link>
        <div className="rounded-xl border border-theme-border p-12 text-center">
          <ShieldCheck className="h-12 w-12 text-theme-tertiary mx-auto mb-4" />
          <p className="text-theme-tertiary">
            {kycError ? 'Erreur lors du chargement du dossier' : 'Dossier introuvable'}
          </p>
        </div>
      </div>
    )
  }

  // ─── Computed ──────────────────────────────────────────────────────────────

  const contactName = kyc.contact
    ? `${kyc.contact.first_name} ${kyc.contact.last_name}`
    : 'Contact'

  const completedItems = checklist.filter((c) => c.is_completed).length
  const totalItems = checklist.length
  const canValidate = kyc.status !== 'validated' && kyc.status !== 'rejected'

  const pepStatus = (kyc.pep_status ?? 'not_checked') as PepStatus
  const sanctionsStatus = (kyc.sanctions_status ?? 'not_checked') as SanctionsStatus

  const riskResult = calculateRiskScore({
    contactNationality: kyc.contact_nationality ?? kyc.contact?.nationality ?? 'CH',
    pepStatus: pepStatus === 'match' ? 'match' : 'clear',
    transactionAmount: kyc.transaction_amount ?? 0,
    kycType: kyc.type,
    completionPct: kyc.completion_pct,
  })

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/dashboard/kyc" className="inline-flex items-center gap-1.5 text-sm text-theme-tertiary hover:text-theme-primary transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Retour aux dossiers
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-theme-border p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-theme-primary">{contactName}</h1>
              {statusBadge(kyc.status)}
              {riskBadge(kyc.risk_level)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-theme-tertiary">
              <span>Type : <span className="font-medium text-theme-primary">{KYC_TYPE_LABELS[kyc.type]}</span></span>
              <span>Créé le {formatDate(kyc.created_at)}</span>
            </div>
            {kyc.validated_by && kyc.validated_at && (
              <p className="text-xs text-success font-medium">
                Validé par {kyc.validated_by} le {formatDate(kyc.validated_at)}
              </p>
            )}
          </div>

          {/* Validate button */}
          {canValidate && (
            <button
              onClick={() => setShowValidateModal(true)}
              className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-success hover:border-success/30 transition-colors"
            >
              Valider le dossier
            </button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-theme-primary">Progression</span>
            <span className={cn('text-sm font-bold', progressTextColor(kyc.completion_pct))}>
              {kyc.completion_pct}%
            </span>
          </div>
          <div className="h-3 bg-theme-active rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressColor(kyc.completion_pct))}
              style={{ width: `${kyc.completion_pct}%` }}
            />
          </div>
          {totalItems > 0 && (
            <p className="text-xs text-theme-tertiary mt-1.5">
              {completedItems} sur {totalItems} éléments complétés
            </p>
          )}
        </div>
      </div>

      {/* Compliance Screening */}
      <div className="rounded-xl border border-theme-border p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-theme-primary">Vérification Compliance</h2>
          <button
            onClick={handleScreening}
            disabled={screenMutation.isPending}
            className="h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50"
          >
            {screenMutation.isPending ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                Vérification...
              </span>
            ) : (
              'Relancer la vérification'
            )}
          </button>
        </div>

        {screenMutation.isError && (
          <p className="text-xs text-red-500 mb-3">
            Erreur lors de la vérification : {screenMutation.error instanceof Error ? screenMutation.error.message : 'Erreur inconnue'}
          </p>
        )}

        <div className="space-y-0">
          {/* PEP row */}
          <div className={cn(
            'flex items-center gap-3 py-3 border-b border-theme-border-subtle',
            pepStatus === 'match' && 'bg-red-500/5 -mx-3 px-3 rounded-lg border-none'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full shrink-0',
              pepStatus === 'clear' ? 'bg-emerald-500' :
              pepStatus === 'match' ? 'bg-red-500' :
              pepStatus === 'pending' ? 'bg-amber-500' : 'bg-theme-tertiary'
            )} />
            <span className="text-sm text-theme-primary flex-1">PEP (Personnes Exposées Politiquement)</span>
            <span className={cn(
              'text-sm',
              pepStatus === 'clear' ? 'text-theme-secondary' :
              pepStatus === 'match' ? 'text-red-500 font-medium' :
              pepStatus === 'pending' ? 'text-amber-500' : 'text-theme-tertiary'
            )}>
              {PEP_STATUS_LABELS[pepStatus]}
            </span>
            {kyc.last_screening_at && (
              <span className="text-xs text-theme-muted hidden sm:block">{formatDate(kyc.last_screening_at)}</span>
            )}
          </div>
          {kyc.pep_details && pepStatus === 'match' && (
            <p className="text-xs text-red-400 pl-5 py-1.5">
              {(kyc.pep_details as { total?: number }).total ?? 0} correspondance(s) trouvée(s)
            </p>
          )}

          {/* Sanctions row */}
          <div className={cn(
            'flex items-center gap-3 py-3',
            sanctionsStatus === 'match' && 'bg-red-500/5 -mx-3 px-3 rounded-lg'
          )}>
            <span className={cn(
              'w-2 h-2 rounded-full shrink-0',
              sanctionsStatus === 'clear' ? 'bg-emerald-500' :
              sanctionsStatus === 'match' ? 'bg-red-500' :
              sanctionsStatus === 'pending' ? 'bg-amber-500' : 'bg-theme-tertiary'
            )} />
            <span className="text-sm text-theme-primary flex-1">Sanctions (SECO, UN, EU)</span>
            <span className={cn(
              'text-sm',
              sanctionsStatus === 'clear' ? 'text-theme-secondary' :
              sanctionsStatus === 'match' ? 'text-red-500 font-medium' :
              sanctionsStatus === 'pending' ? 'text-amber-500' : 'text-theme-tertiary'
            )}>
              {SANCTIONS_STATUS_LABELS[sanctionsStatus]}
            </span>
            {kyc.last_screening_at && (
              <span className="text-xs text-theme-muted hidden sm:block">{formatDate(kyc.last_screening_at)}</span>
            )}
          </div>
          {kyc.sanctions_details && sanctionsStatus === 'match' && (
            <p className="text-xs text-red-400 pl-5 py-1.5">
              {(kyc.sanctions_details as { total?: number }).total ?? 0} correspondance(s) trouvée(s)
            </p>
          )}
        </div>

        {kyc.last_screening_at && (
          <p className="text-[10px] text-theme-muted mt-4 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            estimation IA — dernière vérification {formatRelativeDate(kyc.last_screening_at)}
          </p>
        )}
      </div>

      {/* Risk Score Breakdown */}
      <div className="rounded-xl border border-theme-border p-6">
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-base font-semibold text-theme-primary">Score de risque</h2>
          <span className={cn(
            'text-xs font-medium',
            riskResult.level === 'high' ? 'text-red-500' : riskResult.level === 'medium' ? 'text-amber-500' : 'text-emerald-500'
          )}>
            {riskResult.score}/100
          </span>
          <span className="text-[10px] text-theme-tertiary flex items-center gap-1 ml-auto">
            <Sparkles className="w-3 h-3" /> estimation IA
          </span>
        </div>

        {/* Score bar */}
        <div className="h-2 bg-theme-active rounded-full overflow-hidden mb-4">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              riskResult.level === 'high' ? 'bg-red-500' : riskResult.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
            )}
            style={{ width: `${riskResult.score}%` }}
          />
        </div>

        {/* Factors */}
        <div className="space-y-2">
          {riskResult.factors.map((factor) => (
            <div key={factor.id} className="flex items-center gap-2.5">
              <div className={cn(
                'w-2 h-2 rounded-full shrink-0',
                factor.level === 'high' ? 'bg-red-500' : factor.level === 'medium' ? 'bg-amber-500' : 'bg-emerald-500'
              )} />
              <span className="text-sm text-theme-primary w-36 shrink-0">{factor.label}</span>
              <span className="text-xs text-theme-tertiary">{factor.detail}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Checklist + Documents */}
        <div className="xl:col-span-2 space-y-6">
          {/* Checklist */}
          <div className="rounded-xl border border-theme-border overflow-hidden">
            <div className="px-6 py-4 border-b border-theme-border">
              <h2 className="text-base font-semibold text-theme-primary">Checklist de vérification</h2>
            </div>

            {checklist.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-theme-tertiary">Aucun élément de checklist pour ce dossier</p>
              </div>
            ) : (
              <div className="divide-y divide-theme-border">
                {CATEGORIES.map((cat) => {
                  const items = checklistByCategory.get(cat) || []
                  if (items.length === 0) return null
                  const expanded = expandedCategories.has(cat)
                  const catCompleted = items.filter((i) => i.is_completed).length
                  const catTotal = items.length

                  return (
                    <div key={cat}>
                      <button
                        onClick={() => toggleCategory(cat)}
                        className="w-full flex items-center justify-between px-6 py-3 bg-theme-section/50 hover:bg-theme-section transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expanded
                            ? <ChevronDown className="h-4 w-4 text-theme-tertiary" />
                            : <ChevronRight className="h-4 w-4 text-theme-tertiary" />
                          }
                          <span className="text-sm font-semibold text-theme-primary">{cat}</span>
                        </div>
                        <span className={cn(
                          'text-xs font-medium',
                          catCompleted === catTotal ? 'text-success' : 'text-theme-tertiary'
                        )}>
                          {catCompleted}/{catTotal}
                        </span>
                      </button>

                      {expanded && (
                        <div className="divide-y divide-theme-border/50">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 px-6 py-3 pl-12">
                              <button
                                onClick={() => handleToggleItem(item.id, item.is_completed)}
                                disabled={toggleItemMutation.isPending}
                                className="mt-0.5 flex-shrink-0"
                              >
                                {item.is_completed
                                  ? <CheckCircle2 className="h-5 w-5 text-success" />
                                  : <Circle className="h-5 w-5 text-theme-tertiary hover:text-accent transition-colors" />
                                }
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn(
                                    'text-sm',
                                    item.is_completed ? 'text-theme-secondary line-through' : 'text-theme-primary font-medium'
                                  )}>
                                    {item.label}
                                  </span>
                                  {item.is_required && (
                                    <span className="text-[10px] font-medium text-theme-tertiary uppercase">Requis</span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="text-xs text-theme-tertiary mt-0.5">{item.notes}</p>
                                )}
                                {item.completed_at && (
                                  <p className="text-[11px] text-theme-tertiary mt-0.5">
                                    Complété {formatRelativeDate(item.completed_at)}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Documents */}
          <div className="rounded-xl border border-theme-border overflow-hidden">
            <div className="px-6 py-4 border-b border-theme-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-theme-primary">Documents ({documents.length})</h2>
              <div className="flex items-center gap-2">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)}
                  className="h-8 px-2 text-xs bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                >
                  <option value="identity">Identité</option>
                  <option value="domicile">Domicile</option>
                  <option value="financial">Financier</option>
                  <option value="compliance">Compliance</option>
                  <option value="other">Autre</option>
                </select>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadMutation.isPending}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors disabled:opacity-50"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  Téléverser
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileUpload}
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                />
              </div>
            </div>

            {uploadMutation.isError && (
              <div className="px-6 py-2">
                <p className="text-xs text-red-500">Erreur lors du téléversement</p>
              </div>
            )}

            {documents.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <FileText className="h-10 w-10 text-theme-tertiary mx-auto mb-3" />
                <p className="text-sm text-theme-tertiary">Aucun document téléversé</p>
              </div>
            ) : (
              <div className="divide-y divide-theme-border">
                {documents.map((doc: KycDocument) => (
                  <div key={doc.id} className="flex items-center gap-3 px-6 py-3 hover:bg-theme-section/30 transition-colors">
                    <FileText className="h-5 w-5 text-theme-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">{doc.name}</p>
                      <p className="text-xs text-theme-tertiary">
                        {formatFileSize(doc.size_bytes)} · {formatRelativeDate(doc.created_at)}
                      </p>
                    </div>
                    <span className={cn(
                      'text-xs font-medium flex-shrink-0',
                      doc.status === 'validated' && 'text-success',
                      doc.status === 'pending' && 'text-warning',
                      doc.status === 'rejected' && 'text-danger',
                    )}>
                      {doc.status === 'validated' ? 'Validé' : doc.status === 'pending' ? 'En attente' : 'Rejeté'}
                    </span>
                    {docStatusIcon(doc.status)}
                    {doc.expires_at && (() => {
                      const now = new Date()
                      const exp = new Date(doc.expires_at)
                      const isExpired = exp < now
                      const daysUntil = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                      const isExpiringSoon = !isExpired && daysUntil <= 30

                      if (isExpired) return <span className="text-[10px] font-medium text-red-500 ml-2">Expiré</span>
                      if (isExpiringSoon) return <span className="text-[10px] font-medium text-amber-500 ml-2">Expire dans {daysUntil}j</span>
                      return null
                    })()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Notes + Audit */}
        <div className="space-y-6">
          {/* Notes */}
          <div className="rounded-xl border border-theme-border overflow-hidden">
            <div className="px-6 py-4 border-b border-theme-border">
              <h2 className="text-base font-semibold text-theme-primary">
                Notes internes
              </h2>
            </div>
            <div className="p-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter une note sur ce dossier..."
                rows={4}
                className="w-full text-sm bg-transparent border border-theme-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2 rounded-lg text-xs"
                disabled={!notes.trim() || notesMutation.isPending}
                onClick={handleSaveNotes}
              >
                {notesMutation.isPending ? 'Enregistrement...' : 'Enregistrer la note'}
              </Button>
              {notesMutation.isSuccess && (
                <span className="text-xs text-success ml-2">Enregistré</span>
              )}
            </div>
          </div>

          {/* Audit timeline */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-base font-semibold text-theme-primary mb-4">
              Journal d'audit
            </h2>

            {auditEvents.length === 0 ? (
              <p className="text-sm text-theme-tertiary text-center py-4">Aucun événement enregistré</p>
            ) : (
              <div className="space-y-0">
                {auditEvents.map((event: KycAuditEvent, i: number) => (
                  <div key={event.id} className={cn(
                    'flex items-start gap-3 py-3',
                    i < auditEvents.length - 1 && 'border-b border-theme-border'
                  )}>
                    <div className="h-2 w-2 rounded-full bg-theme-border shrink-0 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-theme-primary">{event.action}</p>
                      {event.metadata && (
                        <p className="text-xs text-theme-tertiary mt-0.5">
                          {event.metadata.provider === 'dilisense' && `Screening dilisense — ${(event.metadata as Record<string, unknown>).total_hits ?? 0} résultat(s)`}
                        </p>
                      )}
                      <p className="text-[11px] text-theme-tertiary mt-1">
                        {event.actor_id === 'ai' ? 'Système IA' : event.actor_id} · {formatDate(event.created_at)} à {new Date(event.created_at).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation modal */}
      {showValidateModal && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowValidateModal(false)}>
          <div className="bg-theme-card border border-theme-border rounded-xl p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-semibold text-theme-primary">Valider ce dossier KYC ?</h3>
            <p className="text-sm text-theme-secondary mt-2">
              Êtes-vous sûr de vouloir valider le dossier de <span className="font-medium text-theme-primary">{contactName}</span> ?
            </p>
            <p className="text-xs text-theme-muted mt-2">
              Cette action sera tracée dans le journal d'audit.
            </p>

            <div className="flex items-center justify-end gap-3 mt-6">
              <button
                className="text-sm text-theme-secondary hover:text-theme-primary transition-colors"
                onClick={() => setShowValidateModal(false)}
              >
                Annuler
              </button>
              <button
                className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-primary hover:border-theme-active transition-colors disabled:opacity-50"
                onClick={handleValidate}
                disabled={validateMutation.isPending}
              >
                {validateMutation.isPending ? 'Validation...' : 'Confirmer la validation'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
