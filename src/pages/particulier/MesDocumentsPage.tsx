import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  FileText, Upload, Download, Eye, Shield, Home, FileCheck, X,
  MessageSquare, ChevronDown, CheckCircle2, AlertCircle, Clock,
  ArrowRight, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Shared tokens (mirror of MonDossier / MesVisites / MesOffres) ──────

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900/20 dark:focus-visible:ring-white/30'
const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500'
const CARD = 'rounded-2xl bg-white border border-gray-100 dark:bg-gray-900 dark:border-gray-800'
const CARD_HOVER = 'transition-all duration-200 hover:border-gray-200 dark:hover:border-gray-700'

// ─── Types & mock data ─────────────────────────────────────────────────

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

interface DocumentHelp { help: string; cost?: string }

const DOCUMENT_HELP: Record<string, DocumentHelp> = {
  'diagnostic-amiante': {
    help: "Obligatoire pour les biens construits avant 1991. Faites appel à un diagnostiqueur agréé.",
    cost: 'CHF 300 – 600',
  },
  'certificat-cecb': {
    help: "Certificat de performance énergétique cantonal. Demandez-le sur cecb.ch ou via votre agent.",
    cost: 'CHF 400 – 800',
  },
}

const MOCK_DOCUMENTS: SellerDocument[] = [
  { id: 'd1', name: 'Mandat de vente exclusif', slug: 'mandat-vente', category: 'mandate', status: 'validated', uploaded_at: '2026-02-10T10:00:00Z', validated_at: '2026-02-11T14:00:00Z', expires_at: '2026-08-10T10:00:00Z', size_kb: 245, required: true, required_for: null },
  { id: 'd2', name: "Pièce d'identité (passeport)", slug: 'piece-identite', category: 'kyc', status: 'validated', uploaded_at: '2026-02-10T10:15:00Z', validated_at: '2026-02-10T16:00:00Z', expires_at: '2028-05-20T00:00:00Z', size_kb: 1200, required: true, required_for: null },
  { id: 'd3', name: 'Extrait du Registre foncier', slug: 'extrait-registre-foncier', category: 'property', status: 'validated', uploaded_at: '2026-02-12T14:00:00Z', validated_at: '2026-02-13T09:00:00Z', expires_at: null, size_kb: 380, required: true, required_for: null },
  { id: 'd4', name: 'Attestation de propriété', slug: 'attestation-propriete', category: 'property', status: 'validated', uploaded_at: '2026-02-12T14:30:00Z', validated_at: '2026-02-13T09:30:00Z', expires_at: null, size_kb: 150, required: true, required_for: null },
  { id: 'd5', name: "Plans de l'appartement", slug: 'plans-appartement', category: 'property', status: 'validated', uploaded_at: '2026-02-15T09:00:00Z', validated_at: '2026-02-15T14:00:00Z', expires_at: null, size_kb: 4800, required: true, required_for: null },
  { id: 'd6', name: 'Décompte de charges PPE (2025)', slug: 'decompte-charges-ppe', category: 'property', status: 'pending', uploaded_at: '2026-03-10T11:00:00Z', validated_at: null, expires_at: null, size_kb: 520, required: true, required_for: null },
  { id: 'd7', name: 'Diagnostic amiante', slug: 'diagnostic-amiante', category: 'property', status: 'missing', uploaded_at: null, validated_at: null, expires_at: null, size_kb: null, required: true, required_for: 'Signature chez le notaire' },
  { id: 'd8', name: 'Certificat CECB (performance énergétique)', slug: 'certificat-cecb', category: 'property', status: 'missing', uploaded_at: null, validated_at: null, expires_at: null, size_kb: null, required: false, required_for: "Publication de l'annonce" },
  { id: 'd9', name: 'Justificatif de domicile', slug: 'justificatif-domicile', category: 'kyc', status: 'validated', uploaded_at: '2026-02-10T10:20:00Z', validated_at: '2026-02-10T16:30:00Z', expires_at: '2026-05-10T00:00:00Z', size_kb: 890, required: true, required_for: null },
  { id: 'd10', name: 'Photos professionnelles du bien', slug: 'photos-pro', category: 'property', status: 'validated', uploaded_at: '2026-02-13T16:00:00Z', validated_at: '2026-02-14T10:00:00Z', expires_at: null, size_kb: 15000, required: false, required_for: null },
]

// ─── Config ─────────────────────────────────────────────────────────────

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

const STATUS_CONFIG: Record<DocStatus, {
  label: string
  icon: React.ElementType
  tone: string
  pill: string
}> = {
  validated: {
    label: 'Validé',
    icon: CheckCircle2,
    tone: 'text-emerald-600 dark:text-emerald-500',
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200/70 dark:bg-emerald-950/30 dark:text-emerald-500 dark:border-emerald-900/50',
  },
  pending: {
    label: 'En vérification',
    icon: Clock,
    tone: 'text-amber-600 dark:text-amber-500',
    pill: 'bg-amber-50 text-amber-700 border-amber-200/70 dark:bg-amber-950/30 dark:text-amber-500 dark:border-amber-900/50',
  },
  missing: {
    label: 'À fournir',
    icon: AlertCircle,
    tone: 'text-rose-600 dark:text-rose-500',
    pill: 'bg-rose-50 text-rose-700 border-rose-200/70 dark:bg-rose-950/30 dark:text-rose-500 dark:border-rose-900/50',
  },
  expired: {
    label: 'Expiré',
    icon: Clock,
    tone: 'text-gray-400 dark:text-gray-600',
    pill: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-800/60 dark:text-gray-500 dark:border-gray-700',
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────

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

// ─── Main page ──────────────────────────────────────────────────────────

export default function MesDocumentsPage() {
  const [filter, setFilter] = useState<FilterTab>('all')
  const [dragTarget, setDragTarget] = useState<string | null>(null)
  const [dragOverGeneral, setDragOverGeneral] = useState(false)
  const [helpDocId, setHelpDocId] = useState<string | null>(null)
  const [validatedCollapsed, setValidatedCollapsed] = useState(true)
  const [animatedPct, setAnimatedPct] = useState(0)
  const [uploadedIds, setUploadedIds] = useState<Set<string>>(new Set())
  const [uploadingId, setUploadingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const generalFileRef = useRef<HTMLInputElement | null>(null)

  const docs = MOCK_DOCUMENTS.map((d) =>
    uploadedIds.has(d.id)
      ? { ...d, status: 'pending' as const, uploaded_at: new Date().toISOString(), size_kb: 850 }
      : d,
  )
  const validated = docs.filter((d) => d.status === 'validated').length
  const pending = docs.filter((d) => d.status === 'pending').length
  const missing = docs.filter((d) => d.status === 'missing').length
  const required = docs.filter((d) => d.required).length
  const requiredDone = docs.filter((d) => d.required && d.status === 'validated').length
  const completionPct = Math.round((requiredDone / required) * 100)

  useEffect(() => {
    const t = setTimeout(() => setAnimatedPct(completionPct), 150)
    return () => clearTimeout(t)
  }, [completionPct])

  const expiringDocs = docs.filter(
    (d) => d.expires_at && daysUntilExpiry(d.expires_at) <= 60 && daysUntilExpiry(d.expires_at) > 0 && d.status === 'validated',
  )

  const missingDocs = docs.filter((d) => d.status === 'missing')
  const pendingDocs = docs.filter((d) => d.status === 'pending')
  const validatedDocs = docs.filter((d) => d.status === 'validated' || d.status === 'expired')

  const filteredDocs = (() => {
    switch (filter) {
      case 'validated': return validatedDocs
      case 'pending': return pendingDocs
      case 'missing': return missingDocs
      default: return null
    }
  })()

  const simulateUpload = useCallback((docId: string, docName: string) => {
    setUploadingId(docId)
    setTimeout(() => {
      setUploadingId(null)
      setUploadedIds((prev) => new Set(prev).add(docId))
      setToast(`${docName} déposé — en attente de vérification`)
      setTimeout(() => setToast(null), 3500)
    }, 1500)
  }, [])

  const handleGeneralDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOverGeneral(false)
    setToast('Document déposé — en attente de vérification')
    setTimeout(() => setToast(null), 3500)
  }, [])

  const handleDropOnDocument = useCallback((e: React.DragEvent, docId: string) => {
    e.preventDefault()
    setDragTarget(null)
    const doc = MOCK_DOCUMENTS.find((d) => d.id === docId)
    if (doc) simulateUpload(docId, doc.name)
  }, [simulateUpload])

  const helpDoc = helpDocId ? docs.find((d) => d.id === helpDocId) : null
  const helpInfo = helpDoc ? DOCUMENT_HELP[helpDoc.slug] : null

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'all', label: 'Tous', count: docs.length },
    { key: 'missing', label: 'À fournir', count: missing },
    { key: 'pending', label: 'En vérification', count: pending },
    { key: 'validated', label: 'Validés', count: validated },
  ]

  // ─── Document row ────────────────────────────────────────────────────

  function renderDocRow(doc: SellerDocument, compact: boolean = false) {
    const cat = CATEGORY_CONFIG[doc.category]
    const CatIcon = cat.icon
    const status = STATUS_CONFIG[doc.status]
    const StatusIcon = status.icon
    const docHelp = DOCUMENT_HELP[doc.slug]
    const isExpiring = doc.expires_at && daysUntilExpiry(doc.expires_at) <= 60 && daysUntilExpiry(doc.expires_at) > 0
    const isExpired = doc.expires_at && daysUntilExpiry(doc.expires_at) <= 0
    const isMissing = doc.status === 'missing'
    const isDropTarget = dragTarget === doc.id

    return (
      <div
        key={doc.id}
        onDragOver={isMissing ? (e) => { e.preventDefault(); setDragTarget(doc.id) } : undefined}
        onDragLeave={isMissing ? () => setDragTarget(null) : undefined}
        onDrop={isMissing ? (e) => handleDropOnDocument(e, doc.id) : undefined}
        className={cn(
          'rounded-xl border group flex items-start gap-4 transition-all',
          compact ? 'p-3 md:p-3.5' : 'p-4 md:p-5',
          isMissing && !isDropTarget && 'border-dashed border-gray-200 dark:border-gray-700',
          !isMissing && 'border-gray-100 dark:border-gray-800',
          isDropTarget && 'border-solid border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20',
          CARD_HOVER,
        )}
      >
        {/* Category icon bubble */}
        <div
          className={cn(
            'shrink-0 rounded-xl flex items-center justify-center',
            compact ? 'w-8 h-8' : 'w-10 h-10',
            'bg-gray-50 dark:bg-gray-800/60',
          )}
        >
          <CatIcon
            className={cn(compact ? 'w-3.5 h-3.5' : 'w-4 h-4', 'text-gray-500 dark:text-gray-400')}
            strokeWidth={1.75}
          />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className={cn(
              'font-semibold text-gray-900 dark:text-white tracking-tight truncate',
              compact ? 'text-sm' : 'text-[15px]',
            )}>
              {doc.name}
            </h3>
            {doc.required && (
              <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700 rounded-full px-2 py-0.5">
                Obligatoire
              </span>
            )}
          </div>

          {/* Metadata row */}
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-gray-500 dark:text-gray-400">
            <span>{cat.label}</span>
            {doc.uploaded_at && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span>Déposé le {formatDate(doc.uploaded_at)}</span>
              </>
            )}
            {doc.size_kb && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="tabular-nums">{formatSize(doc.size_kb)}</span>
              </>
            )}
            {compact && doc.validated_at && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span>Validé le {formatDate(doc.validated_at)}</span>
              </>
            )}
            {isExpiring && !isExpired && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-amber-600 dark:text-amber-500">
                  Expire dans {daysUntilExpiry(doc.expires_at!)} j
                </span>
              </>
            )}
            {isExpired && (
              <>
                <span className="text-gray-300 dark:text-gray-700">·</span>
                <span className="text-rose-600 dark:text-rose-500">Expiré</span>
              </>
            )}
          </div>

          {/* Pending note */}
          {doc.status === 'pending' && !compact && (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-500">
              Votre agent vérifie ce document — retour sous 24 h.
            </p>
          )}

          {/* Missing helper */}
          {isMissing && docHelp && (
            <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/40 p-3">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{docHelp.help}</p>
              {docHelp.cost && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                  Coût estimé : <span className="font-medium text-gray-700 dark:text-gray-300">{docHelp.cost}</span>
                </p>
              )}
            </div>
          )}
          {isMissing && doc.required_for && (
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Nécessaire avant : <span className="text-gray-900 dark:text-white font-medium">{doc.required_for}</span>
            </p>
          )}
        </div>

        {/* Right column: status pill + actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 h-6 pl-2 pr-2.5 rounded-full border text-[11px] font-medium',
              status.pill,
            )}
          >
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </span>

          {uploadingId === doc.id ? (
            <div className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span className="w-3 h-3 border border-gray-300 dark:border-gray-600 border-t-emerald-500 rounded-full animate-spin" />
              Envoi…
            </div>
          ) : isMissing ? (
            <div className="flex items-center gap-1">
              <input
                ref={(el) => { fileInputRefs.current[doc.id] = el }}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={() => simulateUpload(doc.id, doc.name)}
              />
              <button
                onClick={() => fileInputRefs.current[doc.id]?.click()}
                className={cn(
                  'inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full bg-gray-900 text-white dark:bg-white dark:text-gray-900 text-xs font-medium transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(15,23,42,0.3)]',
                  FOCUS_RING,
                )}
              >
                <Upload className="w-3 h-3" />
                Déposer
              </button>
              <button
                onClick={() => setHelpDocId(doc.id)}
                className={cn(
                  'h-8 px-2.5 rounded-full text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors',
                  FOCUS_RING,
                )}
              >
                Aide
              </button>
            </div>
          ) : (
            <div className="inline-flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                className={cn(
                  'h-8 w-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                  FOCUS_RING,
                )}
                aria-label="Consulter"
              >
                <Eye className="w-3.5 h-3.5" />
              </button>
              <button
                className={cn(
                  'h-8 w-8 flex items-center justify-center rounded-full text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                  FOCUS_RING,
                )}
                aria-label="Télécharger"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ─── Render page ─────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <p className={SECTION_LABEL}>Documents</p>
        <h1 className="mt-1.5 text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white tracking-tight">
          Votre dossier, étape par étape
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">
          Déposez, suivez et consultez les pièces liées à votre mandat de vente.
        </p>
      </div>

      {/* ── Completion card + KPI tiles ───────────────────────────────── */}
      <section className={cn(CARD, 'p-5 md:p-6')}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className={SECTION_LABEL}>Complétude du dossier</p>
            <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-400">
              <span className="text-gray-900 dark:text-white font-semibold tabular-nums">
                {requiredDone}
              </span>
              <span className="text-gray-400 dark:text-gray-600"> / {required}</span>{' '}
              documents obligatoires fournis
            </p>
          </div>
          <p className="text-3xl font-semibold text-gray-900 dark:text-white tabular-nums tracking-tight">
            {completionPct}
            <span className="text-lg text-gray-400 dark:text-gray-600 ml-0.5">%</span>
          </p>
        </div>
        <div
          className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"
          role="progressbar"
          aria-valuenow={completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className={cn(
              'h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out',
              completionPct >= 100
                ? 'from-emerald-500 to-emerald-400'
                : 'from-gray-900 to-gray-700 dark:from-white dark:to-gray-200',
            )}
            style={{ width: `${animatedPct}%` }}
          />
        </div>

        {(missing > 0 || expiringDocs.length > 0) && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center gap-5 flex-wrap text-xs">
            {missing > 0 && (
              <button
                onClick={() => setFilter('missing')}
                className={cn(
                  'inline-flex items-center gap-1.5 text-rose-600 dark:text-rose-500 hover:text-rose-700 dark:hover:text-rose-400 transition-colors',
                  FOCUS_RING, 'rounded',
                )}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {missing} document{missing > 1 ? 's' : ''} à fournir
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {expiringDocs.length > 0 && (
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                {expiringDocs.length} expire{expiringDocs.length > 1 ? 'nt' : ''} dans moins de 60 j
              </span>
            )}
            {missing === 0 && expiringDocs.length === 0 && (
              <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                <Sparkles className="w-3 h-3" />
                Dossier complet, rien ne manque.
              </span>
            )}
          </div>
        )}
      </section>

      {/* ── Drop zone ─────────────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); generalFileRef.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setDragOverGeneral(true) }}
        onDragLeave={() => setDragOverGeneral(false)}
        onDrop={handleGeneralDrop}
        onClick={() => generalFileRef.current?.click()}
        className={cn(
          'rounded-2xl border-2 border-dashed p-5 md:p-6 flex items-center gap-4 cursor-pointer transition-all',
          FOCUS_RING,
          dragOverGeneral
            ? 'border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20 scale-[1.005]'
            : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700',
        )}
      >
        <input ref={generalFileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
        <div
          className={cn(
            'shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all',
            dragOverGeneral
              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-500'
              : 'bg-gray-50 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400',
          )}
        >
          <Upload
            className={cn('w-4 h-4 transition-transform', dragOverGeneral && 'scale-110 -translate-y-0.5')}
            strokeWidth={1.75}
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">Déposer un document</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
            PDF · JPG · PNG — 10 Mo max
          </p>
        </div>
        <ArrowRight className="hidden md:inline w-4 h-4 text-gray-300 dark:text-gray-600" />
      </div>

      {/* ── Filter tabs ──────────────────────────────────────────────── */}
      <div className="inline-flex items-center gap-0.5 rounded-full bg-gray-50 dark:bg-gray-800/60 p-0.5 w-fit">
        {TABS.map((tab) => {
          const active = filter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={cn(
                'h-8 px-3.5 rounded-full text-xs font-medium transition-all inline-flex items-center gap-1.5',
                FOCUS_RING,
                active
                  ? 'bg-white text-gray-900 dark:bg-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
              )}
            >
              {tab.label}
              <span className={cn(
                'tabular-nums text-[10px]',
                active ? 'text-gray-400 dark:text-gray-500' : 'text-gray-400 dark:text-gray-600',
              )}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Documents list ───────────────────────────────────────────── */}
      {filter === 'all' ? (
        <div className="space-y-6">
          {missingDocs.length > 0 && (
            <section className="space-y-2">
              <p className={SECTION_LABEL}>À fournir · {missingDocs.length}</p>
              <div className="space-y-2">
                {missingDocs.map((doc) => renderDocRow(doc, false))}
              </div>
            </section>
          )}

          {pendingDocs.length > 0 && (
            <section className="space-y-2">
              <p className={SECTION_LABEL}>En vérification · {pendingDocs.length}</p>
              <div className="space-y-2">
                {pendingDocs.map((doc) => renderDocRow(doc, false))}
              </div>
            </section>
          )}

          {validatedDocs.length > 0 && (
            <section className="space-y-2">
              <button
                onClick={() => setValidatedCollapsed(!validatedCollapsed)}
                className={cn(
                  'inline-flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-white transition-colors',
                  FOCUS_RING, 'rounded',
                )}
              >
                <span className={SECTION_LABEL}>Validés · {validatedDocs.length}</span>
                <ChevronDown
                  className={cn(
                    'w-3 h-3 text-gray-400 dark:text-gray-500 transition-transform',
                    validatedCollapsed && '-rotate-90',
                  )}
                />
              </button>
              {!validatedCollapsed && (
                <div className="space-y-1.5">
                  {validatedDocs.map((doc) => renderDocRow(doc, true))}
                </div>
              )}
              {validatedCollapsed && (
                <button
                  onClick={() => setValidatedCollapsed(false)}
                  className={cn(
                    'text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors',
                    FOCUS_RING, 'rounded',
                  )}
                >
                  Afficher les {validatedDocs.length} documents validés
                </button>
              )}
            </section>
          )}
        </div>
      ) : filteredDocs && filteredDocs.length === 0 ? (
        <section className={cn(CARD, 'p-10 flex flex-col items-center text-center')}>
          <img
            src="/illustrations/maggy/EmptyState.svg"
            alt=""
            className="w-36 h-28 mb-3 opacity-70"
            loading="lazy"
            decoding="async"
          />
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {filter === 'missing' && 'Tous les documents obligatoires sont fournis'}
            {filter === 'pending' && 'Aucun document en vérification'}
            {filter === 'validated' && 'Aucun document validé pour l\'instant'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
            {filter === 'missing' && 'Votre dossier est complet.'}
            {filter === 'pending' && 'Les documents déposés seront vérifiés sous 24 h.'}
            {filter === 'validated' && 'Déposez vos premiers documents via la zone ci-dessus.'}
          </p>
        </section>
      ) : (
        <div className="space-y-2">
          {filteredDocs?.map((doc) => renderDocRow(doc, filter === 'validated'))}
        </div>
      )}

      {/* ── Confidentiality note ──────────────────────────────────────── */}
      <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Tous vos documents sont chiffrés et accessibles uniquement à vous et à votre agent.
      </p>

      {/* ── Toast ─────────────────────────────────────────────────────── */}
      {toast && createPortal(
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[110] animate-in fade-in-0 slide-in-from-bottom-4 duration-200">
          <div
            className={cn(
              'inline-flex items-center gap-2.5 rounded-full border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900',
              'px-4 py-2.5 text-sm text-gray-900 dark:text-white shadow-[0_20px_40px_-15px_rgba(15,23,42,0.15)]',
            )}
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
            {toast}
          </div>
        </div>,
        document.body,
      )}

      {/* ── Help modal ────────────────────────────────────────────────── */}
      {helpDocId && helpDoc && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="help-modal-title"
          onClick={() => setHelpDocId(null)}
          onKeyDown={(e) => { if (e.key === 'Escape') setHelpDocId(null) }}
        >
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm animate-in fade-in-0 duration-150" />
          <div
            className={cn(
              'relative w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800',
              'p-6 shadow-[0_20px_60px_-15px_rgba(15,23,42,0.15)] animate-in fade-in-0 zoom-in-95 duration-200',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className={SECTION_LABEL}>Aide</p>
                <h3
                  id="help-modal-title"
                  className="mt-1.5 text-base font-semibold text-gray-900 dark:text-white tracking-tight"
                >
                  {helpDoc.name}
                </h3>
              </div>
              <button
                autoFocus
                onClick={() => setHelpDocId(null)}
                aria-label="Fermer"
                className={cn(
                  'h-8 w-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors',
                  FOCUS_RING,
                )}
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {helpInfo ? (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{helpInfo.help}</p>
                  {helpInfo.cost && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      Coût estimé : <span className="font-medium text-gray-900 dark:text-white">{helpInfo.cost}</span>
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                  Cette pièce est nécessaire à votre dossier. Votre agent peut vous orienter.
                </p>
              )}
              {helpDoc.required_for && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Nécessaire avant : <span className="text-gray-900 dark:text-white font-medium">{helpDoc.required_for}</span>
                </p>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setHelpDocId(null)}
                className={cn(
                  'inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-colors',
                  FOCUS_RING,
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Contacter mon agent
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                Un message pré-rempli sera envoyé à propos de ce document.
              </p>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
