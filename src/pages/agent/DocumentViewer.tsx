import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Download, Printer, Share2, Trash2,
  FileText, Clock, User, CheckCircle2, AlertCircle,
  ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Maximize2,
  MoreHorizontal, Send, Copy,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface GeneratedDocument {
  id: string
  templateName: string
  templateId: string
  createdAt: string
  createdBy: string
  status: 'draft' | 'sent' | 'signed' | 'archived'
  fields: Record<string, string>
  pages: number
}

// ─── MOCK DATA ──────────────────────────────────────────────────────────────

const MOCK_DOCUMENTS: GeneratedDocument[] = [
  {
    id: 'doc-001',
    templateName: 'Bon de visite',
    templateId: 'bon-visite',
    createdAt: '2026-03-18T14:30:00',
    createdBy: 'Gregory Lyonnet',
    status: 'signed',
    pages: 1,
    fields: {
      visitor_name: 'Marie Dupont',
      visitor_email: 'marie.dupont@gmail.com',
      visitor_phone: '+41 79 123 45 67',
      property_address: 'Rue du Rhône 42',
      property_city: 'Genève',
      property_type: 'Appartement',
      property_rooms: '4',
      property_surface: '95',
      property_price: '1250000',
      visit_date: '2026-03-18',
      visit_time: '14:00',
      agent_name: 'Gregory Lyonnet',
      notes: 'La cliente est très intéressée par la luminosité et la vue sur le lac.',
    },
  },
  {
    id: 'doc-002',
    templateName: 'Offre d\'achat',
    templateId: 'offre-achat',
    createdAt: '2026-03-17T09:15:00',
    createdBy: 'Gregory Lyonnet',
    status: 'sent',
    pages: 2,
    fields: {
      buyer_name: 'Jean-Pierre Müller',
      buyer_address: 'Avenue de la Gare 15, 1003 Lausanne',
      buyer_email: 'jp.muller@bluewin.ch',
      buyer_phone: '+41 78 456 78 90',
      property_address: 'Chemin des Crêts 8',
      property_city: 'Carouge',
      asking_price: '980000',
      offer_price: '950000',
      validity_days: '10',
      conditions: 'Obtention du financement hypothécaire. Résultat satisfaisant de l\'expertise technique.',
      financing: 'Hypothèque bancaire',
      desired_date: '2026-06-01',
    },
  },
  {
    id: 'doc-003',
    templateName: 'Mandat de vente exclusif',
    templateId: 'mandat-exclusif',
    createdAt: '2026-03-15T16:00:00',
    createdBy: 'Gregory Lyonnet',
    status: 'draft',
    pages: 3,
    fields: {
      seller_name: 'Sophie Bertrand',
      seller_address: 'Route de Florissant 55, 1206 Genève',
      seller_email: 'sophie.b@sunrise.ch',
      seller_phone: '+41 76 890 12 34',
      property_address: 'Rue de la Servette 12',
      property_city: 'Genève',
      property_type: 'Appartement',
      property_rooms: '5',
      property_surface: '120',
      asking_price: '1450000',
      commission_pct: '3',
      duration_months: '6',
      start_date: '2026-03-15',
      special_conditions: 'Le vendeur souhaite rester dans les lieux jusqu\'au 31 août 2026.',
    },
  },
]

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-theme-active text-theme-secondary', icon: FileText },
  sent: { label: 'Envoyé', color: 'bg-accent/10 text-accent', icon: Send },
  signed: { label: 'Signé', color: 'bg-emerald-50 text-emerald-600', icon: CheckCircle2 },
  archived: { label: 'Archivé', color: 'bg-amber-50 text-amber-600', icon: AlertCircle },
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function DocumentViewer() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const docId = searchParams.get('id')

  const [zoom, setZoom] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)
  const [showActions, setShowActions] = useState(false)

  // Find document or show list
  const doc = docId ? MOCK_DOCUMENTS.find(d => d.id === docId) : null

  // ─── DOCUMENT LIST VIEW ─────────────────────────────────────────────────

  if (!doc) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Documents générés</h1>
            <p className="text-sm text-theme-tertiary mt-1">{MOCK_DOCUMENTS.length} documents</p>
          </div>
          <Button onClick={() => navigate('/dashboard/templates/generate')} className="gap-2">
            <FileText className="w-4 h-4" />
            Nouveau document
          </Button>
        </div>

        <div className="space-y-2">
          {MOCK_DOCUMENTS.map(doc => {
            const statusConf = STATUS_CONFIG[doc.status]
            const StatusIcon = statusConf.icon
            return (
              <button
                key={doc.id}
                onClick={() => navigate(`/dashboard/documents/view?id=${doc.id}`)}
                className="w-full bg-theme-card rounded-xl border border-theme-border-subtle p-4 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group text-left flex items-center gap-4"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-theme-hover border border-theme-border-subtle flex items-center justify-center flex-shrink-0">
                  <FileText className="w-6 h-6 text-theme-tertiary group-hover:text-accent transition-colors" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-theme-primary group-hover:text-accent transition-colors truncate">
                      {doc.templateName}
                    </h3>
                    <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1', statusConf.color)}>
                      <StatusIcon className="w-3 h-3" />
                      {statusConf.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-theme-tertiary">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {Object.values(doc.fields)[0]}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(doc.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span>{doc.pages} page{doc.pages > 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Arrow */}
                <ChevronRight className="w-4 h-4 text-theme-tertiary group-hover:text-accent transition-colors flex-shrink-0" />
              </button>
            )
          })}
        </div>

        {MOCK_DOCUMENTS.length === 0 && (
          <div className="text-center py-16">
            <FileText className="w-12 h-12 text-theme-tertiary mx-auto mb-4" />
            <p className="text-sm font-medium text-theme-muted">Aucun document généré</p>
            <p className="text-xs text-theme-tertiary mt-1">Créez votre premier document depuis les templates.</p>
            <Button onClick={() => navigate('/dashboard/templates')} className="mt-4 gap-2" variant="outline">
              <FileText className="w-4 h-4" />
              Voir les templates
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ─── DOCUMENT DETAIL VIEW ───────────────────────────────────────────────

  const statusConf = STATUS_CONFIG[doc.status]
  const StatusIcon = statusConf.icon

  const fieldSections: Record<string, { label: string; value: string }[]> = {}
  for (const [key, value] of Object.entries(doc.fields)) {
    const label = key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace('Property', 'Bien')
      .replace('Visitor', 'Visiteur')
      .replace('Buyer', 'Acquéreur')
      .replace('Seller', 'Vendeur')
      .replace('Agent', 'Agent')
      .replace('Visit', 'Visite')
      .replace('Offer', 'Offre')
      .replace('Asking', 'Demandé')

    const sectionKey = key.split('_')[0]
    const sectionName = sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)
      .replace('property', 'Bien')
      .replace('visitor', 'Visiteur')
      .replace('buyer', 'Acquéreur')
      .replace('seller', 'Vendeur')

    if (!fieldSections[sectionName]) fieldSections[sectionName] = []

    let displayValue = value
    if (key.includes('price') || key.includes('Price')) {
      displayValue = formatCHF(Number(value))
    }

    fieldSections[sectionName].push({ label, value: displayValue })
  }

  function handleDownload() {
    if (!doc) return
    const blob = new Blob([`Document: ${doc.templateName}`], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = window.document.createElement('a')
    a.href = url
    a.download = `${doc.templateName.replace(/\s/g, '_')}_${doc.id}.pdf`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handlePrint() {
    window.print()
  }

  function handleCopyLink() {
    if (!doc) return
    const url = `${window.location.origin}/dashboard/documents/view?id=${doc.id}`
    navigator.clipboard.writeText(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/dashboard/documents/view')}
            className="w-9 h-9 rounded-lg border border-theme-border flex items-center justify-center hover:bg-theme-hover transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 text-theme-muted" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-theme-primary">{doc.templateName}</h1>
              <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1', statusConf.color)}>
                <StatusIcon className="w-3 h-3" />
                {statusConf.label}
              </span>
            </div>
            <p className="text-xs text-theme-tertiary mt-0.5">
              Créé le {new Date(doc.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })} par {doc.createdBy}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5 hidden md:flex">
            <Printer className="w-3.5 h-3.5" />
            Imprimer
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Télécharger</span>
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActions(!showActions)}
              className="w-8 h-8 p-0"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full mt-1 bg-theme-card border border-theme-border-subtle rounded-xl shadow-dropdown p-1 z-50 w-48">
                  <button
                    onClick={() => { handleCopyLink(); setShowActions(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer"
                  >
                    <Copy className="w-4 h-4 text-theme-tertiary" />
                    Copier le lien
                  </button>
                  <button
                    onClick={() => { setShowActions(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer"
                  >
                    <Share2 className="w-4 h-4 text-theme-tertiary" />
                    Envoyer par email
                  </button>
                  <button
                    onClick={() => { navigate(`/dashboard/templates/generate?template=${doc.templateId}`); setShowActions(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-theme-tertiary" />
                    Dupliquer
                  </button>
                  <div className="border-t border-theme-border-subtle my-1" />
                  <button
                    onClick={() => setShowActions(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    Supprimer
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Viewer layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Document preview — 2/3 */}
        <div className="lg:col-span-2 space-y-3">
          {/* Toolbar */}
          <div className="flex items-center justify-between bg-theme-hover rounded-xl px-4 py-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(z => Math.max(50, z - 10))}
                className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer"
              >
                <ZoomOut className="w-4 h-4 text-theme-muted" />
              </button>
              <span className="text-xs font-medium text-theme-muted w-10 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(z => Math.min(200, z + 10))}
                className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer"
              >
                <ZoomIn className="w-4 h-4 text-theme-muted" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 text-theme-muted" />
              </button>
              <span className="text-xs text-theme-muted">
                {currentPage} / {doc.pages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(doc.pages, p + 1))}
                disabled={currentPage >= doc.pages}
                className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-theme-muted" />
              </button>
            </div>

            <button
              onClick={() => setZoom(100)}
              className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer"
            >
              <Maximize2 className="w-4 h-4 text-theme-muted" />
            </button>
          </div>

          {/* Document rendering */}
          <div className="bg-theme-active rounded-xl p-4 md:p-8 min-h-[600px] flex items-start justify-center overflow-auto">
            <div
              className="bg-theme-card shadow-lg rounded-lg w-full max-w-[210mm] origin-top transition-transform duration-200"
              style={{ transform: `scale(${zoom / 100})` }}
            >
              {/* A4 document content */}
              <div className="p-8 md:p-12 space-y-6">
                {/* Document header */}
                <div className="text-center border-b border-theme-border pb-6">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <div className="h-8 w-8 bg-theme-primary rounded-lg flex items-center justify-center">
                      <span className="text-xs font-bold text-white">GG</span>
                    </div>
                    <span className="text-lg font-bold text-theme-primary">MEGGA</span>
                  </div>
                  <h2 className="text-xl font-bold text-theme-primary">{doc.templateName}</h2>
                  <p className="text-sm text-theme-tertiary mt-1">
                    {new Date(doc.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-theme-tertiary mt-0.5">Réf. {doc.id.toUpperCase()}</p>
                </div>

                {/* Document body — grouped fields */}
                {Object.entries(fieldSections).map(([section, fields]) => (
                  <div key={section}>
                    <h3 className="text-sm font-semibold text-theme-primary mb-3 uppercase tracking-wider">
                      {section}
                    </h3>
                    <div className="space-y-2">
                      {fields.map(field => (
                        <div key={field.label} className="flex items-start gap-2">
                          <span className="text-sm text-theme-muted w-40 flex-shrink-0">{field.label} :</span>
                          <span className="text-sm font-medium text-theme-primary">{field.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Signatures */}
                <div className="border-t border-theme-border pt-6 mt-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-xs text-theme-tertiary mb-8">Signature du mandant</p>
                      <div className="border-b border-theme-border w-full" />
                      <p className="text-xs text-theme-tertiary mt-2">Lieu et date : _______________</p>
                    </div>
                    <div>
                      <p className="text-xs text-theme-tertiary mb-8">Signature de l'agent</p>
                      <div className="border-b border-theme-border w-full" />
                      <p className="text-xs text-theme-tertiary mt-2">Lieu et date : _______________</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-theme-tertiary mt-8 text-center">
                    Document généré via MEGGA Real Estate — {new Date(doc.createdAt).toLocaleDateString('fr-CH')} — Réf. {doc.id.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          {/* Document info */}
          <div className="bg-theme-card rounded-xl border border-theme-border-subtle p-5 space-y-4">
            <h3 className="text-sm font-semibold text-theme-primary">Informations</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-theme-tertiary">Template</span>
                <span className="text-xs font-medium text-theme-secondary">{doc.templateName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-theme-tertiary">Statut</span>
                <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1', statusConf.color)}>
                  <StatusIcon className="w-3 h-3" />
                  {statusConf.label}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-theme-tertiary">Créé par</span>
                <span className="text-xs font-medium text-theme-secondary">{doc.createdBy}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-theme-tertiary">Date</span>
                <span className="text-xs font-medium text-theme-secondary">
                  {new Date(doc.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-theme-tertiary">Pages</span>
                <span className="text-xs font-medium text-theme-secondary">{doc.pages}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-theme-tertiary">Format</span>
                <span className="text-[10px] font-medium text-theme-tertiary bg-theme-active px-1.5 py-0.5 rounded">PDF</span>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="bg-theme-card rounded-xl border border-theme-border-subtle p-5 space-y-3">
            <h3 className="text-sm font-semibold text-theme-primary">Actions rapides</h3>
            <div className="space-y-1.5">
              <button
                onClick={handleDownload}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4 text-theme-tertiary" />
                Télécharger PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4 text-theme-tertiary" />
                Imprimer
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer transition-colors"
              >
                <Send className="w-4 h-4 text-theme-tertiary" />
                Envoyer par email
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer transition-colors"
              >
                <Copy className="w-4 h-4 text-theme-tertiary" />
                Copier le lien
              </button>
            </div>
          </div>

          {/* Activity */}
          <div className="bg-theme-card rounded-xl border border-theme-border-subtle p-5 space-y-3">
            <h3 className="text-sm font-semibold text-theme-primary">Historique</h3>
            <div className="space-y-3">
              {doc.status === 'signed' && (
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-theme-secondary">Document signé</p>
                    <p className="text-[11px] text-theme-tertiary">18.03.2026 à 15:45</p>
                  </div>
                </div>
              )}
              {(doc.status === 'sent' || doc.status === 'signed') && (
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Send className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-theme-secondary">Envoyé au client</p>
                    <p className="text-[11px] text-theme-tertiary">
                      {new Date(doc.createdAt).toLocaleDateString('fr-CH')} à {new Date(doc.createdAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-theme-active flex items-center justify-center flex-shrink-0 mt-0.5">
                  <FileText className="w-3.5 h-3.5 text-theme-muted" />
                </div>
                <div>
                  <p className="text-xs font-medium text-theme-secondary">Document créé</p>
                  <p className="text-[11px] text-theme-tertiary">
                    {new Date(doc.createdAt).toLocaleDateString('fr-CH')} à {new Date(doc.createdAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
