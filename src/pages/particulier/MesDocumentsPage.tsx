import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { FileText, Upload, Download, Eye, Shield, Home, FileCheck, AlertTriangle, HelpCircle, X, MessageSquare } from 'lucide-react'
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

// ── Help data (Modification 3) ──────────────────────────────────────────

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
  {
    id: 'd1',
    name: 'Mandat de vente exclusif',
    slug: 'mandat-vente',
    category: 'mandate',
    status: 'validated',
    uploaded_at: '2026-02-10T10:00:00Z',
    validated_at: '2026-02-11T14:00:00Z',
    expires_at: '2026-08-10T10:00:00Z',
    size_kb: 245,
    required: true,
    required_for: null,
  },
  {
    id: 'd2',
    name: 'Pièce d\'identité (passeport)',
    slug: 'piece-identite',
    category: 'kyc',
    status: 'validated',
    uploaded_at: '2026-02-10T10:15:00Z',
    validated_at: '2026-02-10T16:00:00Z',
    expires_at: '2028-05-20T00:00:00Z',
    size_kb: 1200,
    required: true,
    required_for: null,
  },
  {
    id: 'd3',
    name: 'Extrait du Registre foncier',
    slug: 'extrait-registre-foncier',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-12T14:00:00Z',
    validated_at: '2026-02-13T09:00:00Z',
    expires_at: null,
    size_kb: 380,
    required: true,
    required_for: null,
  },
  {
    id: 'd4',
    name: 'Attestation de propriété',
    slug: 'attestation-propriete',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-12T14:30:00Z',
    validated_at: '2026-02-13T09:30:00Z',
    expires_at: null,
    size_kb: 150,
    required: true,
    required_for: null,
  },
  {
    id: 'd5',
    name: 'Plans de l\'appartement',
    slug: 'plans-appartement',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-15T09:00:00Z',
    validated_at: '2026-02-15T14:00:00Z',
    expires_at: null,
    size_kb: 4800,
    required: true,
    required_for: null,
  },
  {
    id: 'd6',
    name: 'Décompte de charges PPE (2025)',
    slug: 'decompte-charges-ppe',
    category: 'property',
    status: 'pending',
    uploaded_at: '2026-03-10T11:00:00Z',
    validated_at: null,
    expires_at: null,
    size_kb: 520,
    required: true,
    required_for: null,
  },
  {
    id: 'd7',
    name: 'Diagnostic amiante',
    slug: 'diagnostic-amiante',
    category: 'property',
    status: 'missing',
    uploaded_at: null,
    validated_at: null,
    expires_at: null,
    size_kb: null,
    required: true,
    required_for: 'Signature chez le notaire',
  },
  {
    id: 'd8',
    name: 'Certificat CECB (performance énergétique)',
    slug: 'certificat-cecb',
    category: 'property',
    status: 'missing',
    uploaded_at: null,
    validated_at: null,
    expires_at: null,
    size_kb: null,
    required: false,
    required_for: 'Publication de l\'annonce',
  },
  {
    id: 'd9',
    name: 'Justificatif de domicile',
    slug: 'justificatif-domicile',
    category: 'kyc',
    status: 'validated',
    uploaded_at: '2026-02-10T10:20:00Z',
    validated_at: '2026-02-10T16:30:00Z',
    expires_at: '2026-05-10T00:00:00Z',
    size_kb: 890,
    required: true,
    required_for: null,
  },
  {
    id: 'd10',
    name: 'Photos professionnelles du bien',
    slug: 'photos-pro',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-13T16:00:00Z',
    validated_at: '2026-02-14T10:00:00Z',
    expires_at: null,
    size_kb: 15000,
    required: false,
    required_for: null,
  },
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
  const [dragTarget, setDragTarget] = useState<string | null>(false as unknown as string | null)
  const [dragOverGeneral, setDragOverGeneral] = useState(false)
  const [helpDocId, setHelpDocId] = useState<string | null>(null)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const generalFileRef = useRef<HTMLInputElement | null>(null)

  const docs = MOCK_DOCUMENTS
  const validated = docs.filter(d => d.status === 'validated').length
  const pending = docs.filter(d => d.status === 'pending').length
  const missing = docs.filter(d => d.status === 'missing').length
  const required = docs.filter(d => d.required).length
  const requiredDone = docs.filter(d => d.required && d.status === 'validated').length
  const completionPct = Math.round((requiredDone / required) * 100)

  const filtered = filter === 'all' ? docs : docs.filter(d => d.status === filter)

  // Modification 2 — Tri intelligent : missing → pending → expired → validated
  const sorted = [...filtered].sort((a, b) => {
    const priority: Record<DocStatus, number> = { missing: 0, pending: 1, expired: 2, validated: 3 }
    return priority[a.status] - priority[b.status]
  })

  const expiringDocs = docs.filter(d => d.expires_at && daysUntilExpiry(d.expires_at) <= 60 && daysUntilExpiry(d.expires_at) > 0 && d.status === 'validated')

  // Modification 1 — Barre de progression intelligente
  const progressColor = completionPct >= 100
    ? 'bg-emerald-500'
    : completionPct >= 60
      ? 'bg-amber-500'
      : 'bg-red-500'

  const progressLabel = completionPct >= 100
    ? 'Dossier complet'
    : `${missing} document${missing > 1 ? 's' : ''} à fournir`

  // Modification 7 — Drop handlers
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Mes documents</h1>
        <p className="text-sm text-theme-secondary mt-1">Documents liés à votre mandat de vente</p>
      </div>

      {/* Modification 1 — Progress bar intelligente */}
      <div className="rounded-xl border border-theme-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-theme-primary">Complétude du dossier</p>
          <p className="text-sm font-bold text-theme-primary">{completionPct}%</p>
        </div>
        <div className="h-2 rounded-full bg-theme-hover overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', progressColor)}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className={cn(
          'text-xs mt-1.5',
          completionPct >= 100 ? 'text-emerald-500' : 'text-theme-tertiary'
        )}>
          {progressLabel}
        </p>
      </div>

      {/* Alerte documents expirants */}
      {expiringDocs.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-theme-primary">Documents bientôt expirés</p>
            {expiringDocs.map(d => (
              <p key={d.id} className="text-xs text-theme-secondary mt-0.5">
                {d.name} — expire dans {daysUntilExpiry(d.expires_at!)} jours
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Alerte documents manquants */}
      {missing > 0 && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-theme-primary">
              {missing} document{missing > 1 ? 's' : ''} manquant{missing > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-theme-secondary mt-0.5">
              Votre dossier ne peut pas avancer sans {missing > 1 ? 'eux' : 'lui'}.
            </p>
          </div>
        </div>
      )}

      {/* Modification 7 — Upload zone avec drag general */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverGeneral(true) }}
        onDragLeave={() => setDragOverGeneral(false)}
        onDrop={handleGeneralDrop}
        onClick={() => generalFileRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors',
          dragOverGeneral
            ? 'border-accent bg-accent/5'
            : 'border-theme-border hover:border-accent/50'
        )}
      >
        <input ref={generalFileRef} type="file" multiple className="hidden" accept=".pdf,.jpg,.jpeg,.png" />
        <Upload className="h-5 w-5 text-accent mx-auto mb-2" />
        <p className="text-sm font-medium text-theme-primary">Déposer un document</p>
        <p className="text-xs text-theme-muted mt-0.5">PDF, JPG ou PNG — max 10 Mo</p>
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

      {/* Document list */}
      <div className="space-y-2">
        {sorted.map(doc => {
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
                'rounded-xl border border-theme-border p-4 flex items-start gap-3 hover:border-theme-active transition-colors group',
                dragTarget === doc.id && 'border-accent bg-accent/5'
              )}
            >
              {/* Icon */}
              <div className={cn(
                'h-9 w-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5',
                doc.status === 'validated' ? 'bg-emerald-500/10' :
                doc.status === 'missing' ? 'bg-red-500/10' : 'bg-amber-500/10'
              )}>
                <CatIcon className={cn(
                  'w-4 h-4',
                  doc.status === 'validated' ? 'text-emerald-500' :
                  doc.status === 'missing' ? 'text-red-500' : 'text-amber-500'
                )} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-theme-primary truncate">{doc.name}</p>
                  {doc.required && (
                    <span className="text-[9px] text-theme-muted border border-theme-border-subtle rounded px-1">obligatoire</span>
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
                </div>

                {/* Modification 5 — Historique de validation */}
                {doc.status === 'validated' && doc.validated_at && (
                  <p className="text-[11px] text-theme-muted mt-1">
                    Validé le {formatDate(doc.validated_at)} par votre agent
                  </p>
                )}
                {doc.status === 'pending' && doc.uploaded_at && (
                  <p className="text-[11px] text-theme-muted mt-1">
                    Déposé le {formatDate(doc.uploaded_at)} — en cours de vérification
                  </p>
                )}

                {/* Modification 3 — Aide contextuelle pour documents manquants */}
                {doc.status === 'missing' && docHelp && (
                  <div className="mt-1.5 space-y-0.5">
                    <p className="text-xs text-theme-tertiary">{docHelp.help}</p>
                    {docHelp.cost && (
                      <p className="text-[11px] text-theme-muted">Coût estimé : {docHelp.cost}</p>
                    )}
                  </div>
                )}

                {/* Modification 4 — Étape pipeline bloquée */}
                {doc.status === 'missing' && doc.required_for && (
                  <p className="text-[11px] text-amber-500 mt-1">
                    Nécessaire avant l'étape : {doc.required_for}
                  </p>
                )}
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn('w-2 h-2 rounded-full', status.dotColor)} />
                <span className={cn('text-xs font-medium', status.color)}>{status.label}</span>
              </div>

              {/* Actions — validated/pending/expired: hover actions */}
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

              {/* Modification 6 — Deux actions pour documents manquants */}
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
                    className="h-7 px-3 rounded-lg text-[10px] font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
                  >
                    Déposer
                  </button>
                  <button
                    onClick={() => setHelpDocId(doc.id)}
                    className="h-7 px-3 rounded-lg text-[10px] text-theme-muted hover:text-theme-secondary transition-colors"
                  >
                    Besoin d'aide
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Modification 6 — Modal "Besoin d'aide" via createPortal */}
      {helpDocId && helpDoc && createPortal(
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={() => setHelpDocId(null)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative bg-theme-card rounded-xl border border-theme-border w-full max-w-md mx-4 p-6"
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
                  Nécessaire avant l'étape : {helpDoc.required_for}
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
