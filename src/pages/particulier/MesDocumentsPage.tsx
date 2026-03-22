import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Upload, Download, Eye, Shield, Home, FileCheck, HelpCircle, X, MessageSquare, ChevronDown } from 'lucide-react'
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

const STATUS_CONFIG: Record<DocStatus, { label: string; color: string; dotColor: string }> = {
  validated: { label: 'Validé', color: 'text-emerald-500', dotColor: 'bg-emerald-500' },
  pending: { label: 'En attente', color: 'text-amber-500', dotColor: 'bg-amber-500' },
  missing: { label: 'Manquant', color: 'text-red-500', dotColor: 'bg-red-500' },
  expired: { label: 'Expiré', color: 'text-red-500', dotColor: 'bg-red-500' },
}

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

type FilterTab = 'all' | 'validated' | 'pending' | 'missing'

// ── Main page ────────────────────────────────────────────────────────────

export default function MesDocumentsPage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const [dragOverGeneral, setDragOverGeneral] = useState(false)
  const [helpDocId, setHelpDocId] = useState<string | null>(null)
  const [validatedCollapsed, setValidatedCollapsed] = useState(true)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const generalFileRef = useRef<HTMLInputElement | null>(null)

  const docs = MOCK_DOCUMENTS
  const validated = docs.filter(d => d.status === 'validated').length
  const pending = docs.filter(d => d.status === 'pending').length
  const missing = docs.filter(d => d.status === 'missing').length
  const required = docs.filter(d => d.required).length
  const requiredDone = docs.filter(d => d.required && d.status === 'validated').length
  const completionPct = Math.round((requiredDone / required) * 100)

  const expiringDocs = docs.filter(d => d.expires_at && daysUntilExpiry(d.expires_at) <= 60 && daysUntilExpiry(d.expires_at) > 0 && d.status === 'validated')

  // Progress bar color
  const progressColor = completionPct >= 100
    ? 'bg-emerald-500'
    : completionPct >= 60
      ? 'bg-amber-500'
      : 'bg-red-500'

  // Grouped docs for section headers
  const missingDocs = docs.filter(d => d.status === 'missing')
  const pendingDocs = docs.filter(d => d.status === 'pending')
  const validatedDocs = docs.filter(d => d.status === 'validated' || d.status === 'expired')

  // Filtered docs (individual filters)
  const filteredDocs = (() => {
    switch (filter) {
      case 'validated': return validatedDocs
      case 'pending': return pendingDocs
      case 'missing': return missingDocs
      default: return null // null = use grouped view
    }
  })()

  // Drop handlers
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

  // ── Render helpers ──

  function renderDocCard(doc: SellerDocument, compact: boolean = false) {
    const cat = CATEGORY_CONFIG[doc.category]
    const status = STATUS_CONFIG[doc.status]
    const CatIcon = cat.icon
    const docHelp = DOCUMENT_HELP[doc.slug]

    return (
      <div
        key={doc.id}
        onDragOver={doc.status === 'missing' ? (e) => { e.preventDefault(); setDragTarget(doc.id) } : undefined}
        onDragLeave={doc.status === 'missing' ? () => setDragTarget(null) : undefined}
        onDrop={doc.status === 'missing' ? (e) => handleDropOnDocument(e, doc.id) : undefined}
        className={cn(
          'rounded-xl border border-theme-border flex items-start gap-3 hover:border-theme-active transition-colors group',
          compact ? 'p-3' : 'p-4',
          dragTarget === doc.id && 'border-accent bg-accent/5'
        )}
      >
        {/* Icon */}
        <div className={cn(
          'rounded-lg flex items-center justify-center shrink-0',
          compact ? 'h-7 w-7 mt-0' : 'h-9 w-9 mt-0.5',
          doc.status === 'validated' ? 'bg-emerald-500/10' :
          doc.status === 'missing' ? 'bg-red-500/10' : 'bg-amber-500/10'
        )}>
          <CatIcon className={cn(
            compact ? 'w-3.5 h-3.5' : 'w-4 h-4',
            doc.status === 'validated' ? 'text-emerald-500' :
            doc.status === 'missing' ? 'text-red-500' : 'text-amber-500'
          )} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className={cn('font-medium text-theme-primary truncate', compact ? 'text-xs' : 'text-sm')}>{doc.name}</p>
            {doc.required && (
              <span className="text-[9px] text-theme-muted border border-theme-border-subtle rounded px-1 shrink-0">obligatoire</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
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
            {/* Compact: show validation inline */}
            {compact && doc.status === 'validated' && doc.validated_at && (
              <>
                <span className="text-[10px] text-theme-muted">·</span>
                <span className="text-[10px] text-theme-muted">validé le {formatDate(doc.validated_at)}</span>
              </>
            )}
          </div>

          {/* Non-compact: pending status line */}
          {!compact && doc.status === 'pending' && doc.uploaded_at && (
            <p className="text-[11px] text-theme-muted mt-1">
              Déposé le {formatDate(doc.uploaded_at)} — en cours de vérification
            </p>
          )}

          {/* Help text for missing docs */}
          {doc.status === 'missing' && docHelp && (
            <div className="mt-1.5 space-y-0.5">
              <p className="text-xs text-theme-tertiary">{docHelp.help}</p>
              {docHelp.cost && (
                <p className="text-[11px] text-theme-muted">Coût estimé : {docHelp.cost}</p>
              )}
            </div>
          )}

          {/* Pipeline step blocker */}
          {doc.status === 'missing' && doc.required_for && (
            <p className="text-[11px] text-amber-500 mt-1">
              Nécessaire avant : {doc.required_for}
            </p>
          )}
        </div>

        {/* Status dot */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className={cn('w-2 h-2 rounded-full', status.dotColor)} />
          <span className={cn('text-xs font-medium', status.color)}>{status.label}</span>
        </div>

        {/* Actions — hover for validated/pending */}
        {doc.status !== 'missing' && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button className="p-1.5 rounded-md hover:bg-theme-hover transition-colors" title="Voir">
              <Eye className="w-3.5 h-3.5 text-theme-tertiary" />
            </button>
            <button className="p-1.5 rounded-md hover:bg-theme-hover transition-colors" title="Télécharger">
              <Download className="w-3.5 h-3.5 text-theme-tertiary" />
            </button>
          </div>
        )}

        {/* CTA for missing docs — bigger buttons */}
        {doc.status === 'missing' && (
          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={el => { fileInputRefs.current[doc.id] = el }}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png"
            />
            <button
              onClick={() => fileInputRefs.current[doc.id]?.click()}
              className="h-8 px-4 rounded-lg text-xs font-medium border border-accent text-accent hover:bg-accent/10 transition-colors"
            >
              Déposer
            </button>
            <button
              onClick={() => setHelpDocId(doc.id)}
              className="h-8 px-3 rounded-lg text-xs text-theme-muted hover:text-theme-secondary transition-colors"
            >
              Aide
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Mes documents</h1>
        <p className="text-sm text-theme-secondary mt-1">Documents liés à votre mandat de vente</p>
      </div>

      {/* Progression + alertes fusionnés */}
      <div className="rounded-xl border border-theme-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-theme-primary">Complétude du dossier</p>
          <p className="text-sm font-bold text-theme-primary">{completionPct}%</p>
        </div>
        <div className="h-2 rounded-full bg-theme-hover overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', progressColor)}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        {/* Inline alert badges */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-xs text-theme-tertiary">
            {requiredDone} / {required} obligatoires fournis
          </span>
          {missing > 0 && (
            <button
              onClick={() => setFilter('missing')}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-400 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {missing} manquant{missing > 1 ? 's' : ''}
            </button>
          )}
          {expiringDocs.length > 0 && (
            <span className="flex items-center gap-1.5 text-xs text-amber-500">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {expiringDocs.length} expire{expiringDocs.length > 1 ? 'nt' : ''} bientôt
            </span>
          )}
        </div>
      </div>

      {/* Upload zone — compact inline */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverGeneral(true) }}
        onDragLeave={() => setDragOverGeneral(false)}
        onDrop={handleGeneralDrop}
        onClick={() => generalFileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors',
          dragOverGeneral
            ? 'border-accent bg-accent/5'
            : 'border-theme-border hover:border-accent/50'
        )}
      >
        <input ref={generalFileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
        <Upload className="h-4 w-4 text-accent shrink-0" />
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
              filter === tab.key
                ? 'bg-theme-active text-theme-primary font-medium'
                : 'text-theme-secondary hover:text-theme-primary'
            )}
          >
            {tab.label}
            <span className="ml-1 text-theme-tertiary">{tab.count}</span>
          </button>
        ))}
      </div>

      {/* Document list — grouped view (filter "all") */}
      {filter === 'all' ? (
        <div className="space-y-4">
          {/* Section: À fournir */}
          {missingDocs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <p className="text-xs font-medium text-red-500">À fournir ({missingDocs.length})</p>
              </div>
              {missingDocs.map(doc => renderDocCard(doc, false))}
            </div>
          )}

          {/* Section: En cours de vérification */}
          {pendingDocs.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <p className="text-xs font-medium text-amber-500">En cours de vérification ({pendingDocs.length})</p>
              </div>
              {pendingDocs.map(doc => renderDocCard(doc, false))}
            </div>
          )}

          {/* Section: Validés — collapsible */}
          {validatedDocs.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setValidatedCollapsed(!validatedCollapsed)}
                className="flex items-center gap-2 px-1 group/section"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <p className="text-xs font-medium text-emerald-500">Validés ({validatedDocs.length})</p>
                <ChevronDown className={cn(
                  'w-3 h-3 text-theme-muted transition-transform',
                  validatedCollapsed && '-rotate-90'
                )} />
              </button>
              {!validatedCollapsed && validatedDocs.map(doc => renderDocCard(doc, true))}
              {validatedCollapsed && (
                <p className="text-[11px] text-theme-muted px-1">
                  {validatedDocs.length} document{validatedDocs.length > 1 ? 's' : ''} validé{validatedDocs.length > 1 ? 's' : ''} — cliquer pour afficher
                </p>
              )}
            </div>
          )}
        </div>
      ) : (
        /* Filtered view (single status) */
        <div className="space-y-2">
          {filteredDocs && filteredDocs.length === 0 ? (
            <div className="rounded-xl border border-theme-border p-8 text-center">
              <FileText className="h-5 w-5 text-theme-muted mx-auto mb-2" />
              <p className="text-sm text-theme-muted">Aucun document dans cette catégorie</p>
            </div>
          ) : (
            filteredDocs?.map(doc => renderDocCard(doc, filter === 'validated'))
          )}
        </div>
      )}

      {/* Modal "Besoin d'aide" via createPortal */}
      {helpDocId && helpDoc && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => setHelpDocId(null)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative bg-theme-elevated rounded-xl border border-theme-border ring-1 ring-white/5 w-full max-w-md mx-4 p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-theme-secondary" />
                <h3 className="text-sm font-semibold text-theme-primary">{helpDoc.name}</h3>
              </div>
              <button
                onClick={() => setHelpDocId(null)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-theme-muted hover:text-theme-primary hover:bg-theme-hover transition-colors"
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
                <p className="text-xs text-amber-500">
                  Nécessaire avant : {helpDoc.required_for}
                </p>
              )}

              <div className="pt-3 border-t border-theme-border">
                <button
                  onClick={() => setHelpDocId(null)}
                  className="flex items-center gap-2 h-8 px-3.5 text-xs font-medium border border-theme-border rounded-lg text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
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
