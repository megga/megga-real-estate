import { useState } from 'react'
import { FileText, Upload, Download, Eye, Shield, Home, FileCheck, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────────

interface SellerDocument {
  id: string
  name: string
  category: 'mandate' | 'kyc' | 'property' | 'offer' | 'contract' | 'other'
  status: 'validated' | 'pending' | 'missing' | 'expired'
  uploaded_at: string | null
  expires_at: string | null
  size_kb: number | null
  required: boolean
}

// ── Mock data ────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: SellerDocument[] = [
  {
    id: 'd1',
    name: 'Mandat de vente exclusif',
    category: 'mandate',
    status: 'validated',
    uploaded_at: '2026-02-10T10:00:00Z',
    expires_at: '2026-08-10T10:00:00Z',
    size_kb: 245,
    required: true,
  },
  {
    id: 'd2',
    name: 'Pièce d\'identité (passeport)',
    category: 'kyc',
    status: 'validated',
    uploaded_at: '2026-02-10T10:15:00Z',
    expires_at: '2028-05-20T00:00:00Z',
    size_kb: 1200,
    required: true,
  },
  {
    id: 'd3',
    name: 'Extrait du Registre foncier',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-12T14:00:00Z',
    expires_at: null,
    size_kb: 380,
    required: true,
  },
  {
    id: 'd4',
    name: 'Attestation de propriété',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-12T14:30:00Z',
    expires_at: null,
    size_kb: 150,
    required: true,
  },
  {
    id: 'd5',
    name: 'Plans de l\'appartement',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-15T09:00:00Z',
    expires_at: null,
    size_kb: 4800,
    required: true,
  },
  {
    id: 'd6',
    name: 'Décompte de charges PPE (2025)',
    category: 'property',
    status: 'pending',
    uploaded_at: '2026-03-10T11:00:00Z',
    expires_at: null,
    size_kb: 520,
    required: true,
  },
  {
    id: 'd7',
    name: 'Diagnostic amiante',
    category: 'property',
    status: 'missing',
    uploaded_at: null,
    expires_at: null,
    size_kb: null,
    required: true,
  },
  {
    id: 'd8',
    name: 'Certificat CECB (performance énergétique)',
    category: 'property',
    status: 'missing',
    uploaded_at: null,
    expires_at: null,
    size_kb: null,
    required: false,
  },
  {
    id: 'd9',
    name: 'Justificatif de domicile',
    category: 'kyc',
    status: 'validated',
    uploaded_at: '2026-02-10T10:20:00Z',
    expires_at: '2026-05-10T00:00:00Z',
    size_kb: 890,
    required: true,
  },
  {
    id: 'd10',
    name: 'Photos professionnelles du bien',
    category: 'property',
    status: 'validated',
    uploaded_at: '2026-02-13T16:00:00Z',
    expires_at: null,
    size_kb: 15000,
    required: false,
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

  const docs = MOCK_DOCUMENTS
  const validated = docs.filter(d => d.status === 'validated').length
  const pending = docs.filter(d => d.status === 'pending').length
  const missing = docs.filter(d => d.status === 'missing').length
  const required = docs.filter(d => d.required).length
  const requiredDone = docs.filter(d => d.required && d.status === 'validated').length
  const completionPct = Math.round((requiredDone / required) * 100)

  const filtered = filter === 'all' ? docs : docs.filter(d => d.status === filter)

  // Tri : missing d'abord, puis pending, puis validated
  const sorted = [...filtered].sort((a, b) => {
    const priority: Record<DocStatus, number> = { missing: 0, pending: 1, expired: 2, validated: 3 }
    return priority[a.status] - priority[b.status]
  })

  const expiringDocs = docs.filter(d => d.expires_at && daysUntilExpiry(d.expires_at) <= 60 && daysUntilExpiry(d.expires_at) > 0 && d.status === 'validated')

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

      {/* Progress bar */}
      <div className="rounded-xl border border-theme-border p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-theme-primary">Complétude du dossier</p>
          <p className="text-sm font-bold text-theme-primary">{completionPct}%</p>
        </div>
        <div className="h-2 rounded-full bg-theme-hover overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              completionPct >= 80 ? 'bg-emerald-500' : completionPct >= 50 ? 'bg-amber-500' : 'bg-red-500'
            )}
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <p className="text-xs text-theme-tertiary mt-1.5">
          {requiredDone} / {required} documents obligatoires fournis
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
              Votre agent vous contactera pour les documents à fournir.
            </p>
          </div>
        </div>
      )}

      {/* Upload zone */}
      <div className="border-2 border-dashed border-theme-border rounded-xl p-6 text-center hover:border-accent/50 transition-colors cursor-pointer">
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

          return (
            <div
              key={doc.id}
              className="rounded-xl border border-theme-border p-4 flex items-center gap-3 hover:border-theme-active transition-colors group"
            >
              {/* Icon */}
              <div className={cn(
                'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
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
              </div>

              {/* Status */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={cn('w-2 h-2 rounded-full', status.dotColor)} />
                <span className={cn('text-xs font-medium', status.color)}>{status.label}</span>
              </div>

              {/* Actions */}
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

              {/* Upload CTA for missing */}
              {doc.status === 'missing' && (
                <button className="h-7 px-3 rounded-lg text-[10px] font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors shrink-0">
                  Fournir
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
