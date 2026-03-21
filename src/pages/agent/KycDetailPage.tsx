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

function riskBadge(risk: MockKycCase['risk_level']) {
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

function docStatusIcon(status: 'validated' | 'pending' | 'missing' | 'rejected' | null) {
  switch (status) {
    case 'validated': return <CheckCircle2 className="h-4 w-4 text-success" />
    case 'pending': return <Clock className="h-4 w-4 text-warning" />
    case 'missing': return <AlertTriangle className="h-4 w-4 text-danger" />
    case 'rejected': return <X className="h-4 w-4 text-danger" />
    default: return <Circle className="h-4 w-4 text-theme-tertiary" />
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
        <Link to="/dashboard/kyc" className="inline-flex items-center gap-1.5 text-sm text-theme-tertiary hover:text-theme-primary transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Retour aux dossiers
        </Link>
        <div className="bg-transparent rounded-card shadow-none p-12 text-center">
          <ShieldCheck className="h-12 w-12 text-theme-tertiary mx-auto mb-4" />
          <p className="text-theme-tertiary">Dossier introuvable</p>
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
      <Link to="/dashboard/kyc" className="inline-flex items-center gap-1.5 text-sm text-theme-tertiary hover:text-theme-primary transition-colors">
        <ArrowLeft className="h-4 w-4" />
        Retour aux dossiers
      </Link>

      {/* Header */}
      <div className="bg-transparent rounded-card shadow-none p-6">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-theme-primary">{kyc.contact_name}</h1>
              {statusBadge(kyc.status)}
              {riskBadge(kyc.risk_level)}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-theme-tertiary">
              <span>Type : <span className="font-medium text-theme-primary">{KYC_TYPE_LABELS[kyc.type]}</span></span>
              <span>Bien : <span className="font-medium text-theme-primary">{kyc.property_title}</span></span>
              <span>Agent : <span className="font-medium text-theme-primary">{kyc.assigned_to}</span></span>
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
              className="border border-success/30 text-success hover:bg-success/10 rounded-lg gap-2 text-sm"
            >
              Valider le dossier
            </Button>
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left column: Checklist + Documents */}
        <div className="xl:col-span-2 space-y-6">
          {/* Checklist */}
          <div className="bg-transparent rounded-card shadow-none overflow-hidden">
            <div className="px-6 py-4 border-b border-theme-border">
              <h2 className="text-base font-semibold text-theme-primary">Checklist de vérification</h2>
            </div>

            {checklist.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-theme-tertiary">Aucun élément de checklist pour ce dossier</p>
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
                        <div className="divide-y divide-border/50">
                          {items.map((item) => (
                            <div key={item.id} className="flex items-start gap-3 px-6 py-3 pl-12">
                              {item.is_completed
                                ? <CheckCircle2 className="h-5 w-5 text-success mt-0.5 flex-shrink-0" />
                                : <Circle className="h-5 w-5 text-theme-tertiary mt-0.5 flex-shrink-0" />
                              }
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
                                  {item.document_status && (
                                    <span className="ml-auto flex-shrink-0">
                                      {docStatusIcon(item.document_status)}
                                    </span>
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
          <div className="bg-transparent rounded-card shadow-none overflow-hidden">
            <div className="px-6 py-4 border-b border-theme-border flex items-center justify-between">
              <h2 className="text-base font-semibold text-theme-primary">Documents ({documents.length})</h2>
              <button className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 transition-colors">
                <Upload className="h-3.5 w-3.5" />
                Téléverser
              </button>
            </div>

            {documents.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <FileText className="h-10 w-10 text-theme-tertiary mx-auto mb-3" />
                <p className="text-sm text-theme-tertiary">Aucun document téléversé</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {documents.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-6 py-3 hover:bg-theme-section/30 transition-colors">
                    <FileText className="h-5 w-5 text-theme-tertiary flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-theme-primary truncate">{doc.name}</p>
                      <p className="text-xs text-theme-tertiary">
                        {doc.size_display} · Téléversé par {doc.uploaded_by} · {formatRelativeDate(doc.uploaded_at)}
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
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Notes + Audit */}
        <div className="space-y-6">
          {/* Notes */}
          <div className="bg-transparent rounded-card shadow-none overflow-hidden">
            <div className="px-6 py-4 border-b border-theme-border">
              <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-theme-tertiary" />
                Notes internes
              </h2>
            </div>
            <div className="p-4">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ajouter une note sur ce dossier..."
                rows={4}
                className="w-full text-sm bg-input border border-theme-border rounded-input px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
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
          <div className="bg-transparent rounded-card shadow-none overflow-hidden">
            <div className="px-6 py-4 border-b border-theme-border">
              <h2 className="text-base font-semibold text-theme-primary flex items-center gap-2">
                <Clock className="h-4 w-4 text-theme-tertiary" />
                Journal d'audit
              </h2>
            </div>

            {audit.length === 0 ? (
              <div className="px-6 py-8 text-center">
                <p className="text-sm text-theme-tertiary">Aucun événement enregistré</p>
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
                          <p className="text-sm font-medium text-theme-primary">{event.action}</p>
                          {event.details && (
                            <p className="text-xs text-theme-tertiary mt-0.5">{event.details}</p>
                          )}
                          <p className="text-[11px] text-theme-tertiary mt-1">
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
          <div className="relative bg-transparent rounded-card shadow-modal p-6 w-full max-w-md mx-4">
            <div className="text-center mb-6">
              <div className="mx-auto w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <ShieldCheck className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-theme-primary">Valider ce dossier KYC ?</h3>
              <p className="text-sm text-theme-tertiary mt-2">
                Êtes-vous sûr de vouloir valider le dossier de <span className="font-medium text-theme-primary">{kyc.contact_name}</span> ?
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
