import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Upload, HelpCircle, X, MessageSquare, AlertTriangle, Clock, CheckCircle2, FileQuestion } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'

// --- Types ---

type DocumentStatus = 'validated' | 'pending' | 'missing' | 'expiring'

interface MockDocument {
  id: string
  name: string
  slug: string
  status: DocumentStatus
  uploaded_at?: string
  validated_at?: string
  expires_at?: string
  required_for?: string
  file_name?: string
}

interface DocumentHelp {
  help: string
  cost?: string
}

// --- Mock data ---

const DOCUMENT_HELP: Record<string, DocumentHelp> = {
  'diagnostic-amiante': {
    help: 'Obligatoire pour les biens construits avant 1991. Faites appel à un diagnostiqueur agréé.',
    cost: 'CHF 300 – 600',
  },
  'certificat-cecb': {
    help: 'Certificat de performance énergétique cantonal. Demandez-le sur cecb.ch ou via votre agent.',
    cost: 'CHF 400 – 800',
  },
  'extrait-registre-foncier': {
    help: 'Disponible auprès du registre foncier de votre canton. Délai habituel : 5 à 10 jours ouvrables.',
    cost: 'CHF 30 – 80',
  },
  'plans-cadastraux': {
    help: 'Obtenables auprès du service cantonal du cadastre ou de la géomatique.',
    cost: 'CHF 50 – 150',
  },
}

const MOCK_DOCUMENTS: MockDocument[] = [
  {
    id: 'doc-1',
    name: 'Acte de propriété',
    slug: 'acte-propriete',
    status: 'validated',
    uploaded_at: '2026-02-10',
    validated_at: '2026-02-12',
    file_name: 'acte_propriete_2024.pdf',
  },
  {
    id: 'doc-2',
    name: 'Attestation de charges PPE',
    slug: 'attestation-charges-ppe',
    status: 'validated',
    uploaded_at: '2026-02-15',
    validated_at: '2026-02-17',
    file_name: 'charges_ppe_2025.pdf',
  },
  {
    id: 'doc-3',
    name: 'Plan de l\'appartement',
    slug: 'plan-appartement',
    status: 'pending',
    uploaded_at: '2026-03-18',
    file_name: 'plan_appart_3p.pdf',
  },
  {
    id: 'doc-4',
    name: 'Photos intérieures HD',
    slug: 'photos-interieures',
    status: 'pending',
    uploaded_at: '2026-03-20',
    file_name: 'photos_hd_lot.zip',
  },
  {
    id: 'doc-5',
    name: 'Diagnostic amiante',
    slug: 'diagnostic-amiante',
    status: 'missing',
    required_for: 'Signature chez le notaire',
  },
  {
    id: 'doc-6',
    name: 'Certificat CECB',
    slug: 'certificat-cecb',
    status: 'missing',
    required_for: 'Publication de l\'annonce',
  },
  {
    id: 'doc-7',
    name: 'Règlement PPE',
    slug: 'reglement-ppe',
    status: 'expiring',
    uploaded_at: '2025-06-10',
    validated_at: '2025-06-12',
    expires_at: '2026-04-10',
    file_name: 'reglement_ppe_2020.pdf',
  },
  {
    id: 'doc-8',
    name: 'Extrait du registre foncier',
    slug: 'extrait-registre-foncier',
    status: 'validated',
    uploaded_at: '2026-01-20',
    validated_at: '2026-01-22',
    file_name: 'extrait_rf_geneve.pdf',
  },
]

type FilterType = 'all' | 'validated' | 'pending' | 'missing'

// --- Sorting ---

function getStatusPriority(status: DocumentStatus): number {
  switch (status) {
    case 'missing': return 0
    case 'pending': return 1
    case 'expiring': return 2
    case 'validated': return 3
  }
}

function sortDocuments(docs: MockDocument[]): MockDocument[] {
  return [...docs].sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status))
}

// --- Helpers ---

function getStatusIcon(status: DocumentStatus) {
  switch (status) {
    case 'validated':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
    case 'pending':
      return <Clock className="h-4 w-4 text-amber-500" />
    case 'missing':
      return <FileQuestion className="h-4 w-4 text-red-500" />
    case 'expiring':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
  }
}

function getStatusLabel(status: DocumentStatus): string {
  switch (status) {
    case 'validated': return 'Validé'
    case 'pending': return 'En attente'
    case 'missing': return 'Manquant'
    case 'expiring': return 'Expire bientôt'
  }
}

function getStatusTextColor(status: DocumentStatus): string {
  switch (status) {
    case 'validated': return 'text-emerald-500'
    case 'pending': return 'text-amber-500'
    case 'missing': return 'text-red-500'
    case 'expiring': return 'text-amber-500'
  }
}

function getDaysUntilExpiry(expiresAt: string): number {
  const now = new Date()
  const exp = new Date(expiresAt)
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// --- Component ---

export default function MesDocumentsPage() {
  const [filter, setFilter] = useState<FilterType>('all')
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const [dragOverGeneral, setDragOverGeneral] = useState(false)
  const [helpDocId, setHelpDocId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const generalFileRef = useRef<HTMLInputElement | null>(null)

  // Stats
  const totalDocs = MOCK_DOCUMENTS.length
  const validatedCount = MOCK_DOCUMENTS.filter(d => d.status === 'validated').length
  const pendingCount = MOCK_DOCUMENTS.filter(d => d.status === 'pending').length
  const missingCount = MOCK_DOCUMENTS.filter(d => d.status === 'missing').length
  const expiringCount = MOCK_DOCUMENTS.filter(d => d.status === 'expiring').length
  const completionPct = Math.round(((validatedCount + pendingCount) / totalDocs) * 100)

  // Progress bar logic (Modification 1)
  const progressColor = completionPct >= 100
    ? 'bg-emerald-500'
    : completionPct >= 60
      ? 'bg-amber-500'
      : 'bg-red-500'

  const progressLabel = completionPct >= 100
    ? 'Dossier complet'
    : `${missingCount} document${missingCount > 1 ? 's' : ''} à fournir`

  // Filtered & sorted documents (Modification 2)
  const filteredDocs = (() => {
    let docs = MOCK_DOCUMENTS
    switch (filter) {
      case 'validated':
        docs = docs.filter(d => d.status === 'validated')
        break
      case 'pending':
        docs = docs.filter(d => d.status === 'pending' || d.status === 'expiring')
        break
      case 'missing':
        docs = docs.filter(d => d.status === 'missing')
        break
      case 'all':
      default:
        break
    }
    return sortDocuments(docs)
  })()

  // Handlers
  const handleGeneralDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverGeneral(false)
    // In real app: handle file upload
  }, [])

  const handleDropOnDocument = useCallback((e: React.DragEvent, _docId: string) => {
    e.preventDefault()
    setDragTarget(null)
    // In real app: associate dropped file with this specific document
    void _docId
  }, [])

  const handleFileSelect = useCallback((_docId: string): void => {
    // In real app: handle file selection for specific document
    void _docId
  }, [])

  const helpDoc = helpDocId ? MOCK_DOCUMENTS.find(d => d.id === helpDocId) : null
  const helpInfo = helpDoc ? DOCUMENT_HELP[helpDoc.slug] : null

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'Tous', count: totalDocs },
    { key: 'validated', label: 'Validés', count: validatedCount },
    { key: 'pending', label: 'En attente', count: pendingCount + expiringCount },
    { key: 'missing', label: 'Manquants', count: missingCount },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Mes documents
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez l'avancement de votre dossier et déposez vos pièces justificatives
        </p>
      </div>

      {/* Progress bar (Modification 1) */}
      <div className="rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-primary-900">Complétion du dossier</span>
          <span className="text-sm font-medium text-primary-900">{completionPct}%</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', progressColor)}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className={cn(
          'text-xs mt-2',
          completionPct >= 100 ? 'text-emerald-500' : 'text-muted-foreground'
        )}>
          {progressLabel}
        </p>
      </div>

      {/* Alerts */}
      {(missingCount > 0 || expiringCount > 0) && (
        <div className="space-y-2">
          {missingCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">
                {missingCount} document{missingCount > 1 ? 's' : ''} manquant{missingCount > 1 ? 's' : ''} — votre dossier ne peut pas avancer sans {missingCount > 1 ? 'eux' : 'lui'}.
              </p>
            </div>
          )}
          {expiringCount > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <Clock className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700">
                {expiringCount} document{expiringCount > 1 ? 's' : ''} expire{expiringCount > 1 ? 'nt' : ''} bientôt — pensez à les renouveler.
              </p>
            </div>
          )}
        </div>
      )}

      {/* General upload zone (Modification 7 — general drop) */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverGeneral(true) }}
        onDragLeave={() => setDragOverGeneral(false)}
        onDrop={handleGeneralDrop}
        onClick={() => generalFileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          dragOverGeneral
            ? 'border-accent bg-accent/5'
            : 'border-gray-200 hover:border-accent/50'
        )}
      >
        <input
          ref={generalFileRef}
          type="file"
          multiple
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
        />
        <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium text-primary-900">
          Déposer vos documents ici
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          PDF, JPG ou PNG — max 10 Mo par fichier
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              'h-8 px-3 text-xs font-medium rounded-lg transition-colors',
              filter === f.key
                ? 'bg-primary-900 text-white'
                : 'text-muted-foreground hover:text-primary-900 hover:bg-gray-100'
            )}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={cn(
                'ml-1.5',
                filter === f.key ? 'text-white/70' : 'text-muted-foreground'
              )}>
                {f.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Documents list */}
      <div className="rounded-xl border border-border divide-y divide-border">
        {filteredDocs.length === 0 ? (
          <div className="p-8 text-center">
            <FileText className="h-6 w-6 text-gray-400 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Aucun document dans cette catégorie</p>
          </div>
        ) : (
          filteredDocs.map(doc => {
            const docHelp = DOCUMENT_HELP[doc.slug]
            return (
              <div
                key={doc.id}
                onDragOver={doc.status === 'missing' ? (e) => { e.preventDefault(); setDragTarget(doc.id) } : undefined}
                onDragLeave={doc.status === 'missing' ? () => setDragTarget(null) : undefined}
                onDrop={doc.status === 'missing' ? (e) => handleDropOnDocument(e, doc.id) : undefined}
                className={cn(
                  'flex items-start gap-3 px-4 py-3.5 transition-colors group',
                  dragTarget === doc.id && 'bg-accent/5 border-accent'
                )}
              >
                {/* Status icon */}
                <div className="mt-0.5 shrink-0">
                  {getStatusIcon(doc.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-primary-900">{doc.name}</span>
                    <span className={cn('text-[11px] font-medium', getStatusTextColor(doc.status))}>
                      {getStatusLabel(doc.status)}
                    </span>
                    {doc.status === 'expiring' && doc.expires_at && (
                      <span className="text-[11px] text-amber-500">
                        (expire dans {getDaysUntilExpiry(doc.expires_at)}j)
                      </span>
                    )}
                  </div>

                  {/* File name */}
                  {doc.file_name && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{doc.file_name}</p>
                  )}

                  {/* Modification 5 — Validation/upload history */}
                  {doc.status === 'validated' && doc.validated_at && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Validé le {formatDate(doc.validated_at)} par votre agent
                    </p>
                  )}

                  {doc.status === 'pending' && doc.uploaded_at && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Déposé le {formatDate(doc.uploaded_at)} — en cours de vérification
                    </p>
                  )}

                  {doc.status === 'expiring' && doc.validated_at && doc.expires_at && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Validé le {formatDate(doc.validated_at)} — expire le {formatDate(doc.expires_at)}
                    </p>
                  )}

                  {/* Modification 3 — Help text for missing docs */}
                  {doc.status === 'missing' && docHelp && (
                    <div className="mt-1.5 space-y-0.5">
                      <p className="text-xs text-muted-foreground">{docHelp.help}</p>
                      {docHelp.cost && (
                        <p className="text-[11px] text-gray-400">Coût estimé : {docHelp.cost}</p>
                      )}
                    </div>
                  )}

                  {/* Modification 4 — Required for pipeline step */}
                  {doc.status === 'missing' && doc.required_for && (
                    <p className="text-[11px] text-amber-500 mt-1">
                      Nécessaire avant l'étape : {doc.required_for}
                    </p>
                  )}
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-2">
                  {/* Modification 6 — Two buttons for missing docs */}
                  {doc.status === 'missing' && (
                    <>
                      <input
                        ref={el => { fileInputRefs.current[doc.id] = el }}
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={() => handleFileSelect(doc.id)}
                      />
                      <button
                        onClick={() => fileInputRefs.current[doc.id]?.click()}
                        className="h-8 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-primary-900 hover:border-gray-400 transition-colors"
                      >
                        Déposer
                      </button>
                      <button
                        onClick={() => setHelpDocId(doc.id)}
                        className="h-8 px-3 text-xs text-gray-400 hover:text-muted-foreground transition-colors"
                      >
                        Besoin d'aide
                      </button>
                    </>
                  )}

                  {/* Download for validated/pending/expiring */}
                  {doc.status !== 'missing' && doc.file_name && (
                    <button className="h-8 px-3 text-xs font-medium border border-border rounded-lg text-muted-foreground hover:text-primary-900 hover:border-gray-400 transition-colors opacity-0 group-hover:opacity-100 transition-opacity">
                      Voir
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modification 6 — Help dialog via createPortal */}
      {helpDocId && helpDoc && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => setHelpDocId(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-white rounded-xl border border-border w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-primary-900">{helpDoc.name}</h3>
              </div>
              <button
                onClick={() => setHelpDocId(null)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary-900 hover:bg-gray-100 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {helpInfo ? (
                <>
                  <p className="text-sm text-muted-foreground">{helpInfo.help}</p>
                  {helpInfo.cost && (
                    <p className="text-xs text-gray-400">Coût estimé : {helpInfo.cost}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Ce document est nécessaire pour votre dossier. Contactez votre agent pour plus d'informations.
                </p>
              )}

              {helpDoc.required_for && (
                <p className="text-xs text-amber-500">
                  Nécessaire avant l'étape : {helpDoc.required_for}
                </p>
              )}

              <div className="pt-2 border-t border-border">
                <button
                  onClick={() => setHelpDocId(null)}
                  className="flex items-center gap-2 h-9 px-4 text-sm font-medium border border-border rounded-lg text-muted-foreground hover:text-primary-900 hover:border-gray-400 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Contacter mon agent
                </button>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  Un message pré-rempli sera envoyé à votre agent concernant ce document.
                </p>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
