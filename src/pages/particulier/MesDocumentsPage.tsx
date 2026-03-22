import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Upload, Download, Eye, Shield, Home, FileCheck, X, MessageSquare, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────

interface SellerDocument {
  id: string
  name: string
  slug: string
  category: 'mandate' | 'kyc' | 'property' | 'offer' | 'contract' | 'other'
  status: 'validated' | 'pending' | 'missing' | 'expired'
  uploaded_at: string | null
  validated_at: string | null
  expires_at: string | null
  size_kb: number | null
  required: boolean
  required_for: string | null
}

interface DocumentHelp {
  help: string
  cost?: string
}

// ── Help data ────────────────────────────────────────────────────────────

const DOCUMENT_HELP: Record<string, DocumentHelp> = {
  'diagnostic-amiante': {
    help: 'Obligatoire pour les biens construits avant 1991. Faites appel à un diagnostiqueur agréé.',
    cost: 'CHF 300 – 600',
  },
  'certificat-cecb': {
    help: 'Certificat de performance énergétique cantonal. Demandez-le sur cecb.ch ou via votre agent.',
    cost: 'CHF 400 – 800',
  },
}

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: SellerDocument[] = [
  { id: 'd1', name: 'Mandat de vente exclusif', slug: 'mandat-vente', category: 'mandate', status: 'validated', uploaded_at: '2026-02-10T10:00:00Z', validated_at: '2026-02-11T14:00:00Z', expires_at: '2026-08-10T10:00:00Z', size_kb: 245, required: true, required_for: null },
  { id: 'd2', name: 'Pièce d\'identité (passeport)', slug: 'piece-identite', category: 'kyc', status: 'validated', uploaded_at: '2026-02-10T10:15:00Z', validated_at: '2026-02-10T16:00:00Z', expires_at: '2028-05-20T00:00:00Z', size_kb: 1200, required: true, required_for: null },
  { id: 'd3', name: 'Extrait du Registre foncier', slug: 'extrait-registre-foncier', category: 'property', status: 'validated', uploaded_at: '2026-02-12T14:00:00Z', validated_at: '2026-02-13T09:00:00Z', expires_at: null, size_kb: 380, required: true, required_for: null },
  { id: 'd4', name: 'Attestation de propriété', slug: 'attestation-propriete', category: 'property', status: 'validated', uploaded_at: '2026-02-12T14:30:00Z', validated_at: '2026-02-13T09:30:00Z', expires_at: null, size_kb: 150, required: true, required_for: null },
  { id: 'd5', name: 'Plans de l\'appartement', slug: 'plans-appartement', category: 'property', status: 'validated', uploaded_at: '2026-02-15T09:00:00Z', validated_at: '2026-02-15T14:00:00Z', expires_at: null, size_kb: 4800, required: true, required_for: null },
  { id: 'd6', name: 'Décompte de charges PPE (2025)', slug: 'decompte-charges-ppe', category: 'property', status: 'pending', uploaded_at: '2026-03-10T11:00:00Z', validated_at: null, expires_at: null, size_kb: 520, required: true, required_for: null },
  { id: 'd7', name: 'Diagnostic amiante', slug: 'diagnostic-amiante', category: 'property', status: 'missing', uploaded_at: null, validated_at: null, expires_at: null, size_kb: null, required: true, required_for: 'Signature chez le notaire' },
  { id: 'd8', name: 'Certificat CECB (performance énergétique)', slug: 'certificat-cecb', category: 'property', status: 'missing', uploaded_at: null, validated_at: null, expires_at: null, size_kb: null, required: false, required_for: 'Publication de l\'annonce' },
  { id: 'd9', name: 'Justificatif de domicile', slug: 'justificatif-domicile', category: 'kyc', status: 'validated', uploaded_at: '2026-02-10T10:20:00Z', validated_at: '2026-02-10T16:30:00Z', expires_at: '2026-05-10T00:00:00Z', size_kb: 890, required: true, required_for: null },
  { id: 'd10', name: 'Photos professionnelles du bien', slug: 'photos-pro', category: 'property', status: 'validated', uploaded_at: '2026-02-13T16:00:00Z', validated_at: '2026-02-14T10:00:00Z', expires_at: null, size_kb: 15000, required: false, required_for: null },
]

// ── Helpers ──────────────────────────────────────────────────────────────

type DocCategory = SellerDocument['category']
type DocStatus = SellerDocument['status']

const CATEGORY_CONFIG: Record<DocCategory, { label: string; icon: React.ElementType }> = {
  mandate: { label: 'Mandat', icon: FileCheck },
  kyc: { label: 'Identité', icon: Shield },
  property: { label: 'Bien', icon: Home },
  offer: { label: 'Offre', icon: FileText },
  contract: { label: 'Contrat', icon: FileText },
  other: { label: 'Autre', icon: FileText },
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatSize(kb: number): string {
  if (kb >= 1000) return `${(kb / 1000).toFixed(1)} Mo`
  return `${kb} Ko`
}

function daysUntilExpiry(dateStr: string): number {
  return Math.floor((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function statusLabel(status: DocStatus): string {
  switch (status) {
    case 'validated': return 'Validé'
    case 'pending': return 'En attente'
    case 'missing': return 'Manquant'
    case 'expired': return 'Expiré'
  }
}

type FilterTab = 'all' | 'validated' | 'pending' | 'missing'

// ── Main page ────────────────────────────────────────────────────────────

export default function MesDocumentsPage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const [dragOverGeneral, setDragOverGeneral] = useState(false)
  const [helpDocId, setHelpDocId] = useState<string | null>(null)
  const [validatedCollapsed, setValidatedCollapsed] = useState(true)
  const [animatedPct, setAnimatedPct] = useState(0)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const generalFileRef = useRef<HTMLInputElement | null>(null)

  const docs = MOCK_DOCUMENTS
  const validated = docs.filter(d => d.status === 'validated').length
  const pending = docs.filter(d => d.status === 'pending').length
  const missing = docs.filter(d => d.status === 'missing').length
  const required = docs.filter(d => d.required).length
  const requiredDone = docs.filter(d => d.required && d.status === 'validated').length
  const completionPct = Math.round((requiredDone / required) * 100)

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPct(completionPct), 50)
    return () => clearTimeout(timer)
  }, [completionPct])

  const expiringDocs = docs.filter(d => d.expires_at && daysUntilExpiry(d.expires_at) <= 60 && daysUntilExpiry(d.expires_at) > 0 && d.status === 'validated')

  // Monochrome progress bar — only red when incomplete
  const progressColor = completionPct >= 100 ? 'bg-theme-primary' : 'bg-theme-primary'

  const missingDocs = docs.filter(d => d.status === 'missing')
  const pendingDocs = docs.filter(d => d.status === 'pending')
  const validatedDocs = docs.filter(d => d.status === 'validated' || d.status === 'expired')

  const filteredDocs = (() => {
    switch (filter) {
      case 'validated': return validatedDocs
      case 'pending': return pendingDocs
      case 'missing': return missingDocs
      default: return null
    }
  })()

  const handleGeneralDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverGeneral(false)
  }, [])

  const handleDropOnDocument = useCallback((e: React.DragEvent, _docId: string) => {
    e.preventDefault()
    setDragTarget(null)
    void _docId
  }, [])

  const helpDoc = helpDocId ? docs.find(d => d.id === helpDocId) : null
  const helpInfo = helpDoc ? DOCUMENT_HELP[helpDoc.slug] : null

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: docs.length },
    { key: 'validated', label: 'Validés', count: validated },
    { key: 'pending', label: 'En attente', count: pending },
    { key: 'missing', label: 'Manquants', count: missing },
  ]

  // ── Render doc card — monochrome, only red dot for missing ──

  function renderDocCard(doc: SellerDocument, compact: boolean = false) {
    const cat = CATEGORY_CONFIG[doc.category]
    const CatIcon = cat.icon
    const docHelp = DOCUMENT_HELP[doc.slug]
    const isExpiring = doc.expires_at && daysUntilExpiry(doc.expires_at) <= 60 && daysUntilExpiry(doc.expires_at) > 0
    const isExpired = doc.expires_at && daysUntilExpiry(doc.expires_at) <= 0

    return (
      <div
        key={doc.id}
        onDragOver={doc.status === 'missing' ? (e) => { e.preventDefault(); setDragTarget(doc.id) } : undefined}
        onDragLeave={doc.status === 'missing' ? () => setDragTarget(null) : undefined}
        onDrop={doc.status === 'missing' ? (e) => handleDropOnDocument(e, doc.id) : undefined}
        className={cn(
          'rounded-xl border flex items-start gap-3 hover:border-theme-active transition-all group',
          compact ? 'p-3' : 'p-4',
          doc.status === 'missing' && dragTarget !== doc.id && 'border-dashed border-theme-border',
          doc.status !== 'missing' && 'border-theme-border',
          dragTarget === doc.id && 'border-accent bg-accent/5 border-solid ring-2 ring-accent/20'
        )}
      >
        {/* Icon — monochrome, only missing gets red */}
        <div className={cn(
          'rounded-lg flex items-center justify-center shrink-0 bg-theme-hover',
          compact ? 'h-7 w-7 mt-0' : 'h-9 w-9 mt-0.5',
        )}>
          <CatIcon className={cn(
            compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
            'text-theme-secondary'
          )} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn('font-medium text-theme-primary truncate', compact ? 'text-xs' : 'text-sm')}>{doc.name}</p>
            {doc.required && (
              <span className="text-[10px] text-theme-tertiary border border-theme-border rounded px-1 py-px shrink-0">obligatoire</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-theme-muted">{cat.label}</span>
            {doc.uploaded_at && (
              <>
                <span className="text-[10px] text-theme-muted">·</span>
                <span className="text-[10px] text-theme-muted">{formatDate(doc.uploaded_at)}</span>
              </>
            )}
            {doc.size_kb && (
              <>
                <span className="text-[10px] text-theme-muted">·</span>
                <span className="text-[10px] text-theme-muted">{formatSize(doc.size_kb)}</span>
              </>
            )}
            {compact && doc.status === 'validated' && doc.validated_at && (
              <>
                <span className="text-[10px] text-theme-muted">·</span>
                <span className="text-[10px] text-theme-muted">validé le {formatDate(doc.validated_at)}</span>
              </>
            )}
          </div>

          {/* Expiry — only signal that uses color (amber) */}
          {isExpiring && (
            <p className="text-[10px] text-amber-500 mt-0.5">
              Expire dans {daysUntilExpiry(doc.expires_at!)} jour{daysUntilExpiry(doc.expires_at!) > 1 ? 's' : ''}
            </p>
          )}
          {isExpired && (
            <p className="text-[10px] text-red-500 mt-0.5">Expiré</p>
          )}

          {!compact && doc.status === 'pending' && doc.uploaded_at && (
            <p className="text-[11px] text-theme-muted mt-1">
              Déposé le {formatDate(doc.uploaded_at)} — en cours de vérification
            </p>
          )}

          {doc.status === 'missing' && docHelp && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-theme-tertiary">{docHelp.help}</p>
              {docHelp.cost && (
                <p className="text-[11px] text-theme-muted">Coût estimé : {docHelp.cost}</p>
              )}
            </div>
          )}

          {doc.status === 'missing' && doc.required_for && (
            <p className="text-[11px] text-theme-tertiary mt-1">
              Nécessaire avant : {doc.required_for}
            </p>
          )}
        </div>

        {/* Status — monochrome text, only red dot for missing */}
        <div className="flex items-center gap-1.5 shrink-0">
          {doc.status === 'missing' && <span className="w-2 h-2 rounded-full bg-red-500" />}
          <span className={cn(
            'text-xs',
            doc.status === 'missing' ? 'font-medium text-red-500' : 'text-theme-muted'
          )}>
            {statusLabel(doc.status)}
          </span>
        </div>

        {/* Actions — hover on desktop, always on mobile */}
        {doc.status !== 'missing' && (
          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
            <button className={cn('p-2.5 md:p-1.5 rounded-md hover:bg-theme-hover transition-colors', FOCUS_RING)} aria-label="Voir le document">
              <Eye className="w-4 h-4 md:w-3.5 md:h-3.5 text-theme-tertiary" />
            </button>
            <button className={cn('p-2.5 md:p-1.5 rounded-md hover:bg-theme-hover transition-colors', FOCUS_RING)} aria-label="Télécharger le document">
              <Download className="w-4 h-4 md:w-3.5 md:h-3.5 text-theme-tertiary" />
            </button>
          </div>
        )}

        {/* CTA for missing */}
        {doc.status === 'missing' && (
          <div className="flex items-center gap-2 shrink-0">
            <input ref={el => { fileInputRefs.current[doc.id] = el }} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
            <button
              onClick={() => fileInputRefs.current[doc.id]?.click()}
              className={cn('h-8 px-4 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', FOCUS_RING)}
            >
              Déposer
            </button>
            <button
              onClick={() => setHelpDocId(doc.id)}
              className={cn('h-8 px-3 rounded-lg text-xs text-theme-muted hover:text-theme-secondary transition-colors', FOCUS_RING)}
            >
              Aide
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-theme-primary">Mes documents</h1>
        <p className="text-sm text-theme-tertiary mt-1">Documents liés à votre mandat de vente</p>
      </div>

      {/* Progress — monochrome bar */}
      <div className="rounded-xl border border-theme-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-theme-primary">Complétude du dossier</p>
          <p className="text-sm font-bold text-theme-primary">{completionPct}%</p>
        </div>
        <div
          className="h-2 rounded-full bg-theme-hover overflow-hidden"
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Complétude du dossier : ${completionPct}%`}
        >
          <div
            className={cn('h-full rounded-full transition-all duration-700 ease-out', progressColor)}
            style={{ width: `${animatedPct}%` }}
          />
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-theme-tertiary">
            {requiredDone} / {required} obligatoires fournis
          </span>
          {missing > 0 && (
            <button
              onClick={() => setFilter('missing')}
              className={cn('flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors', FOCUS_RING, 'rounded')}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {missing} manquant{missing > 1 ? 's' : ''}
            </button>
          )}
          {expiringDocs.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-theme-muted">
              {expiringDocs.length} expire{expiringDocs.length > 1 ? 'nt' : ''} bientôt
            </span>
          )}
        </div>
      </div>

      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); generalFileRef.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setDragOverGeneral(true) }}
        onDragLeave={() => setDragOverGeneral(false)}
        onDrop={handleGeneralDrop}
        onClick={() => generalFileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-all',
          FOCUS_RING,
          dragOverGeneral
            ? 'border-theme-active bg-theme-hover border-solid scale-[1.01]'
            : 'border-theme-border hover:border-theme-active'
        )}
      >
        <input ref={generalFileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
        <Upload className={cn('h-4 w-4 text-theme-secondary shrink-0 transition-transform', dragOverGeneral && 'scale-110 -translate-y-0.5')} />
        <p className="text-sm text-theme-primary">Déposer un document</p>
        <p className="text-xs text-theme-muted">PDF, JPG, PNG — max 10 Mo</p>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={cn(
              'h-8 px-3 rounded-lg text-xs transition-colors',
              FOCUS_RING,
              filter === tab.key
                ? 'bg-theme-active text-theme-primary font-medium border border-theme-border'
                : 'text-theme-secondary hover:text-theme-primary hover:bg-theme-hover'
            )}
          >
            {tab.label}
            <span className="ml-1 text-theme-tertiary">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Document list */}
      {filter === 'all' ? (
        <div className="space-y-6">
          {missingDocs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-theme-secondary px-1">À fournir ({missingDocs.length})</p>
              {missingDocs.map(doc => renderDocCard(doc, false))}
            </div>
          )}

          {pendingDocs.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-theme-secondary px-1">En cours de vérification ({pendingDocs.length})</p>
              {pendingDocs.map(doc => renderDocCard(doc, false))}
            </div>
          )}

          {validatedDocs.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setValidatedCollapsed(!validatedCollapsed)}
                className={cn('flex items-center gap-2 px-1', FOCUS_RING, 'rounded')}
              >
                <p className="text-xs font-medium text-theme-secondary">Validés ({validatedDocs.length})</p>
                <ChevronDown className={cn(
                  'w-3 h-3 text-theme-muted transition-transform duration-200',
                  validatedCollapsed && '-rotate-90'
                )} />
              </button>
              {!validatedCollapsed && (
                <div className="space-y-1.5">
                  {validatedDocs.map(doc => renderDocCard(doc, true))}
                </div>
              )}
              {validatedCollapsed && (
                <button
                  onClick={() => setValidatedCollapsed(false)}
                  className={cn('text-[11px] text-theme-muted px-1 hover:text-theme-secondary transition-colors', FOCUS_RING, 'rounded')}
                >
                  {validatedDocs.length} document{validatedDocs.length > 1 ? 's' : ''} validé{validatedDocs.length > 1 ? 's' : ''} — cliquer pour afficher
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredDocs && filteredDocs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-theme-border p-10 text-center">
              <FileText className="h-6 w-6 text-theme-muted mx-auto mb-3 opacity-50" />
              <p className="text-sm text-theme-secondary">
                {filter === 'missing' && 'Tous les documents obligatoires sont fournis'}
                {filter === 'pending' && 'Aucun document en attente de vérification'}
                {filter === 'validated' && 'Aucun document validé pour le moment'}
              </p>
              <p className="text-xs text-theme-muted mt-1">
                {filter === 'missing' && 'Votre dossier est complet.'}
                {filter === 'pending' && 'Les documents déposés seront vérifiés sous 24h.'}
                {filter === 'validated' && 'Déposez vos premiers documents via la zone ci-dessus.'}
              </p>
            </div>
          ) : (
            filteredDocs?.map(doc => renderDocCard(doc, filter === 'validated'))
          )}
        </div>
      )}

      {/* Modal */}
      {helpDocId && helpDoc && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onClick={() => setHelpDocId(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setHelpDocId(null) }}
        >
          <div className="absolute inset-0 bg-black/50 animate-in fade-in-0 duration-150" />
          <div
            className="relative bg-theme-elevated rounded-xl border border-theme-border ring-1 ring-white/5 w-full max-w-md mx-4 p-6 animate-in fade-in-0 zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <h3 id="help-modal-title" className="text-sm font-semibold text-theme-primary">{helpDoc.name}</h3>
              <button
                autoFocus
                onClick={() => setHelpDocId(null)}
                className={cn('h-7 w-7 flex items-center justify-center rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors', FOCUS_RING)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {helpInfo ? (
                <>
                  <p className="text-sm text-theme-secondary">{helpInfo.help}</p>
                  {helpInfo.cost && (
                    <p className="text-xs text-theme-muted">Coût estimé : {helpInfo.cost}</p>
                  )}
                </>
              ) : (
                <p className="text-sm text-theme-secondary">
                  Ce document est nécessaire pour votre dossier. Contactez votre agent pour plus d'informations.
                </p>
              )}

              {helpDoc.required_for && (
                <p className="text-xs text-theme-tertiary">
                  Nécessaire avant : {helpDoc.required_for}
                </p>
              )}

              <div className="pt-3 border-t border-theme-border">
                <button
                  onClick={() => setHelpDocId(null)}
                  className={cn('flex items-center gap-2 h-8 px-3.5 text-xs font-medium border border-theme-border rounded-lg text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors', FOCUS_RING)}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Contacter mon agent
                </button>
                <p className="text-[11px] text-theme-muted mt-1.5">
                  Un message pré-rempli sera envoyé concernant ce document.
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
