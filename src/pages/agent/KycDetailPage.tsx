import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, CheckCircle2, Circle, Clock, FileText,
  Upload, AlertTriangle, X, StickyNote, ChevronDown, ChevronRight,
} from 'lucide-react'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import { KYC_STATUS_LABELS, KYC_RISK_LABELS, KYC_TYPE_LABELS } from '@/lib/constants'
import { Button } from '@/components/ui/button'
import {
  MOCK_KYC_CASES, MOCK_KYC_CHECKLIST, MOCK_KYC_DOCUMENTS,
  MOCK_KYC_AUDIT, type MockKycCase, type MockKycChecklistItem,
} from '@/lib/mockData'

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

function statusBadge(status: MockKycCase['status']) {
  const map = {
    pending:     { cls: 'bg-primary-100 text-primary-600' },
    in_progress: { cls: 'bg-accent/10 text-accent' },
    review:      { cls: 'bg-warning/10 text-warning' },
    validated:   { cls: 'bg-success/10 text-success' },
    rejected:    { cls: 'bg-danger/10 text-danger' },
  }
  const s = map[status]
  return (
    <span className={cn('text-xs font-medium px-2.5 py-1 rounded-badge', s.cls)}>
      {KYC_STATUS_LABELS[status]}
    </span>
  )
}

function riskBadge(risk: MockKycCase['risk_level']) {
  const map = {
    low:        { dot: 'bg-success',     cls: 'bg-success/10 text-success' },
    medium:     { dot: 'bg-warning',     cls: 'bg-warning/10 text-warning' },
    high:       { dot: 'bg-danger',      cls: 'bg-danger/10 text-danger' },
    unassessed: { dot: 'bg-primary-300', cls: 'bg-primary-100 text-primary-500' },
  }
  const r = map[risk]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-badge', r.cls)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', r.dot)} />
      {KYC_RISK_LABELS[risk]}
    </span>
  )
}

function docStatusIcon(status: 'validated' | 'pending' | 'missing' | 'rejected' | null) {
  switch (status) {
    case 'validated': return <CheckCircle2 className="h-4 w-4 text-success" />
    case 'pending': return <Clock className="h-4 w-4 text-warning" />
    case 'missing': return <AlertTriangle className="h-4 w-4 text-danger" />
    case 'rejected': return <X className="h-4 w-4 text-danger" />
    default: return <Circle className="h-4 w-4 text-primary-300" />
  }
}

const CATEGORIES = ['Identité', 'Domicile', 'Revenus', 'Origine des fonds', 'Compliance'] as const

export default function KycDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [showValidateModal, setShowValidateModal] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES)
  )
  const [notes, setNotes] = useState('')

  const kyc = MOCK_KYC_CASES.find((c) => c.id === id)
  const checklist = MOCK_KYC_CHECKLIST.filter((c) => c.kyc_case_id === id)
  const documents = MOCK_KYC_DOCUMENTS.filter((d) => d.kyc_case_id === id)
  const audit = MOCK_KYC_AUDIT.filter((e) => e.kyc_case_id === id)

  const checklistByCategory = useMemo(() => {
    const map = new Map<string, MockKycChecklistItem[]>()
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

  if (!kyc) {
    return (
      <div className="space-y-6">
        <Link to="/dashboard/kyc" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary-900 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Retour aux dossiers
        </Link>
        <div className="bg-white rounded-card shadow-card p-12 text-center">
          <ShieldCheck className="h-12 w-12 text-primary-200 mx-auto mb-4" />
          <p className="text-muted-foreground">Dossier introuvable</p>
        </div>
      </div>
    )
  }

  const completedItems = checklist.filter((c) => c.is_completed).length
  const totalItems = checklist.length
  const canValidate = kyc.status !== 'validated' && kyc.status !== 'rejected'

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/dashboard/kyc" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary-900 transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Retour aux dossiers
      </Link>

      {/* Header */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-primary-900">{kyc.contact_name}</h1>
              {statusBadge(kyc.status)}
              {riskBadge(kyc.risk_level)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>Type : <span className="font-medium text-primary-700">{KYC_TYPE_LABELS[kyc.type]}</span></span>
              <span>Bien : <span className="font-medium text-primary-700">{kyc.property_title}</span></span>
              <span>Agent : <span className="font-medium text-primary-700">{kyc.assigned_to}</span></span>
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
            <Button
              onClick={() => setShowValidateModal(true)}
              className="bg-success hover:bg-success/90 text-white rounded-button gap-2"
            >
              <ShieldCheck className="h-4 w-4" />
              Valider le dossier
            </Button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-primary-700">Progression</span>
            <span className={cn('text-sm font-bold', progressTextColor(kyc.completion_pct))}>
              {kyc.completion_pct}%
            </span>
          </div>
          <div className="h-3 bg-primary-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500', progressColor(kyc.completion_pct))}
              style={{ width: `${kyc.completion_pct}%` }}
            />
          </div>
          {totalItems > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {completedItems} sur {totalItems} éléments complétés
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Checklist + Documents */}
        <div className="xl:col-span-2 space-y-6">
          {/* Checklist */}
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-primary-900">Checklist de vérification</h2>
            </div>

            {checklist.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun élément de checklist pour ce dossier</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
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
                        className="w-full flex items-center justify-between px-6 py-3 bg-section/50 hover:bg-section transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {expanded
                            ? <ChevronDown className="h-4 w-4 text-primary-400" />
                            : <ChevronRight className="h-4 w-4 text-primary-400" />
                          }
                          <span className="text-sm font-semibold text-primary-800">{cat}</span>
                        </div>
                        <span className={cn(
                          'text-xs font-medium',
                          catCompleted === catTotal ? 'text-success' : 'text-muted-foreground'
                        )}>
                          {catCompleted}/{catTotal}
                        </span>
                      </button>

                      {expanded && (
                        <div className="divide-y divide-border/50">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 px-6 py-3 pl-12">
                              {item.is_completed
                                ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                                : <Circle className="h-5 w-5 text-primary-300 mt-0.5 flex-shrink-0" />
                              }
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={cn(
                                    'text-sm',
                                    item.is_completed ? 'text-primary-600 line-through' : 'text-primary-900 font-medium'
                                  )}>
                                    {item.label}
                                  </span>
                                  {item.is_required && (
                                    <span className="text-[10px] font-medium text-danger uppercase">Requis</span>
                                  )}
                                  {item.document_status && (
                                    <span className="ml-auto flex-shrink-0">
                                      {docStatusIcon(item.document_status)}
                                    </span>
                                  )}
                                </div>
                                {item.notes && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>
                                )}
                                {item.completed_at && (
                                  <p className="text-[11px] text-primary-400 mt-0.5">
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
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-primary-900">Documents ({documents.length})</h2>
              <button className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                Téléverser
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <FileText className="h-10 w-10 text-primary-200 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucun document téléversé</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-6 py-3 hover:bg-section/30 transition-colors">
                    <FileText className="h-5 w-5 text-primary-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-primary-900 truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {doc.size_display} · Téléversé par {doc.uploaded_by} · {formatRelativeDate(doc.uploaded_at)}
                      </p>
                    </div>
                    <span className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded-badge flex-shrink-0',
                      doc.status === 'validated' && 'bg-success/10 text-success',
                      doc.status === 'pending' && 'bg-warning/10 text-warning',
                      doc.status === 'rejected' && 'bg-danger/10 text-danger',
                    )}>
                      {doc.status === 'validated' ? 'Validé' : doc.status === 'pending' ? 'En attente' : 'Rejeté'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Notes + Audit */}
        <div className="space-y-6">
          {/* Notes */}
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-primary-400" />
                Notes internes
              </h2>
            </div>
            <div className="p-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter une note sur ce dossier..."
                rows={4}
                className="w-full text-sm bg-input border border-border rounded-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-2 rounded-button text-xs"
                disabled={!notes.trim()}
              >
                Enregistrer la note
              </Button>
            </div>
          </div>

          {/* Audit timeline */}
          <div className="bg-white rounded-card shadow-card overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-primary-900 flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary-400" />
                Journal d'audit
              </h2>
            </div>

            {audit.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground">Aucun événement enregistré</p>
              </div>
            ) : (
              <div className="p-4">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-4">
                    {audit.map((event) => (
                      <div key={event.id} className="relative flex gap-3 pl-6">
                        <div className="absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full bg-accent/20 border-2 border-accent" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary-900">{event.action}</p>
                          {event.details && (
                            <p className="text-xs text-muted-foreground mt-0.5">{event.details}</p>
                          )}
                          <p className="text-[11px] text-primary-400 mt-1">
                            {event.actor} · {formatDate(event.timestamp)} à {new Date(event.timestamp).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Validation modal */}
      {showValidateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowValidateModal(false)} />
          <div className="relative bg-white rounded-card shadow-modal p-6 w-full max-w-md mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-primary-900">Valider ce dossier KYC ?</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Êtes-vous sûr de vouloir valider le dossier de <span className="font-medium text-primary-700">{kyc.contact_name}</span> ?
              </p>
              <p className="text-xs text-warning mt-2 font-medium">
                Cette action sera tracée dans le journal d'audit.
              </p>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1 rounded-button"
                onClick={() => setShowValidateModal(false)}
              >
                Annuler
              </Button>
              <Button
                className="flex-1 bg-success hover:bg-success/90 text-white rounded-button"
                onClick={() => setShowValidateModal(false)}
              >
                Confirmer la validation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
