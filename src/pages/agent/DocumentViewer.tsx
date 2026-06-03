import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { cn, formatCHF } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useGeneratedDocuments, useGeneratedDocument, type GeneratedDocumentRow } from '@/hooks/useDocuments'

// ─── TYPES ──────────────────────────────────────────────────────────────────

// UI-level shape utilisé par la vue (mappé depuis la table `documents` Supabase)
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

const TYPE_TO_TEMPLATE_LABEL: Record<string, string> = {
  mandate: 'Mandat de vente',
  visit_voucher: 'Bon de visite',
  property_sheet: 'Fiche bien',
  offer: 'Offre d\'achat',
  contract: 'Contrat',
  other: 'Document',
}

function mapRowToDocument(row: GeneratedDocumentRow): GeneratedDocument {
  const rawStatus = (row.status ?? 'draft').toLowerCase()
  const status: GeneratedDocument['status'] =
    rawStatus === 'sent' || rawStatus === 'signed' || rawStatus === 'archived' ? rawStatus : 'draft'
  return {
    id: row.id,
    templateName: TYPE_TO_TEMPLATE_LABEL[row.type] ?? row.name ?? 'Document',
    templateId: row.type,
    createdAt: row.created_at,
    createdBy: row.uploaded_by ?? '—',
    status,
    fields: {},
    pages: 1,
  }
}

const STATUS_CONFIG = {
  draft: { label: 'Brouillon', color: 'bg-theme-active text-theme-secondary', icon: 'file' },
  sent: { label: 'Envoyé', color: 'bg-accent/10 text-accent', icon: 'send' },
  signed: { label: 'Signé', color: 'bg-emerald-50 text-emerald-600', icon: 'check-circle' },
  archived: { label: 'Archivé', color: 'bg-amber-50 text-amber-600', icon: 'alert' },
}

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function DocumentViewer() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const docId = searchParams.get('id')

  const [zoom, setZoom] = useState(100)
  const [currentPage, setCurrentPage] = useState(1)
  const [showActions, setShowActions] = useState(false)

  // Supabase hooks — remplace les anciens MOCK_DOCUMENTS
  const { data: documentsRows = [], isLoading: isLoadingList } = useGeneratedDocuments()
  const { data: singleRow, isLoading: isLoadingSingle } = useGeneratedDocument(docId)

  const documents = useMemo(() => documentsRows.map(mapRowToDocument), [documentsRows])
  const doc = singleRow ? mapRowToDocument(singleRow) : null

  // ─── DOCUMENT LIST VIEW ─────────────────────────────────────────────────

  if (!doc) {
    // Si un docId est fourni mais rien trouvé (et loading fini) : document inexistant
    const notFound = docId && !isLoadingSingle && !singleRow
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Documents générés</h1>
            <p className="text-sm text-theme-tertiary mt-1">
              {isLoadingList ? 'Chargement...' : `${documents.length} document${documents.length > 1 ? 's' : ''}`}
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard/templates/generate')} className="gap-2">
            <MEIcon name="file" className="w-4 h-4" />
            Nouveau document
          </Button>
        </div>

        {notFound && (
          <div className="rounded-xl border border-theme-border p-4 text-sm text-theme-secondary">
            Document introuvable. Il a peut-être été supprimé.
          </div>
        )}

        <div className="space-y-2">
          {documents.map(item => {
            const statusConf = STATUS_CONFIG[item.status]
            const StatusIcon = statusConf.icon as MEIconName
            return (
              <button
                key={item.id}
                onClick={() => navigate(`/dashboard/documents/view?id=${item.id}`)}
                className="w-full bg-theme-card rounded-xl border border-theme-border-subtle p-4 hover:-translate-y-0.5 transition-all cursor-pointer group text-left flex items-center gap-4"
              >
                {/* Icon */}
                <div className="w-12 h-12 rounded-xl bg-theme-hover border border-theme-border-subtle flex items-center justify-center flex-shrink-0">
                  <MEIcon name="file" className="w-6 h-6 text-theme-tertiary group-hover:text-accent transition-colors" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-theme-primary group-hover:text-accent transition-colors truncate">
                      {item.templateName}
                    </h3>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1', statusConf.color)}>
                      <MEIcon name={StatusIcon} className="w-3 h-3" />
                      {statusConf.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-theme-tertiary">
                    <span className="flex items-center gap-1">
                      <MEIcon name="clock" className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                    <span>{item.pages} page{item.pages > 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* Arrow */}
                <MEIcon name="chevron-right" className="w-4 h-4 text-theme-tertiary group-hover:text-accent transition-colors flex-shrink-0" />
              </button>
            )
          })}
        </div>

        {!isLoadingList && documents.length === 0 && (
          <div className="text-center py-16">
            <MEIcon name="file" className="w-12 h-12 text-theme-tertiary mx-auto mb-4" />
            <p className="text-sm font-medium text-theme-muted">Aucun document généré</p>
            <p className="text-xs text-theme-tertiary mt-1">Créez votre premier document depuis les templates.</p>
            <Button onClick={() => navigate('/dashboard/templates')} className="mt-4 gap-2" variant="outline">
              <MEIcon name="file" className="w-4 h-4" />
              Voir les templates
            </Button>
          </div>
        )}
      </div>
    )
  }

  // ─── DOCUMENT DETAIL VIEW ───────────────────────────────────────────────

  const statusConf = STATUS_CONFIG[doc.status]
  const StatusIcon = statusConf.icon as MEIconName

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
            <MEIcon name="arrow-left" className="w-4 h-4 text-theme-muted" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-theme-primary">{doc.templateName}</h1>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1', statusConf.color)}>
                <MEIcon name={StatusIcon} className="w-3 h-3" />
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
            <MEIcon name="print" className="w-3.5 h-3.5" />
            Imprimer
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload} className="gap-1.5">
            <MEIcon name="download" className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Télécharger</span>
          </Button>
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowActions(!showActions)}
              className="w-8 h-8 p-0"
            >
              <MEIcon name="more-horizontal" className="w-4 h-4" />
            </Button>
            {showActions && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowActions(false)} />
                <div className="absolute right-0 top-full mt-1 bg-theme-card border border-theme-border-subtle rounded-xl shadow-dropdown p-1 z-50 w-48">
                  <button
                    onClick={() => { handleCopyLink(); setShowActions(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer"
                  >
                    <MEIcon name="copy" className="w-4 h-4 text-theme-tertiary" />
                    Copier le lien
                  </button>
                  <button
                    onClick={() => { setShowActions(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer"
                  >
                    <MEIcon name="share" className="w-4 h-4 text-theme-tertiary" />
                    Envoyer par email
                  </button>
                  <button
                    onClick={() => { navigate(`/dashboard/templates/generate?template=${doc.templateId}`); setShowActions(false) }}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer"
                  >
                    <MEIcon name="file" className="w-4 h-4 text-theme-tertiary" />
                    Dupliquer
                  </button>
                  <div className="border-t border-theme-border-subtle my-1" />
                  <button
                    onClick={() => setShowActions(false)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-500/10 rounded-lg cursor-pointer"
                  >
                    <MEIcon name="trash" className="w-4 h-4" />
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
                <MEIcon name="zoom-out" className="w-4 h-4 text-theme-muted" />
              </button>
              <span className="text-xs font-medium text-theme-muted w-10 text-center">{zoom}%</span>
              <button
                onClick={() => setZoom(z => Math.min(200, z + 10))}
                className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer"
              >
                <MEIcon name="zoom-in" className="w-4 h-4 text-theme-muted" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
              >
                <MEIcon name="chevron-left" className="w-4 h-4 text-theme-muted" />
              </button>
              <span className="text-xs text-theme-muted">
                {currentPage} / {doc.pages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(doc.pages, p + 1))}
                disabled={currentPage >= doc.pages}
                className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer disabled:opacity-30"
              >
                <MEIcon name="chevron-right" className="w-4 h-4 text-theme-muted" />
              </button>
            </div>

            <button
              onClick={() => setZoom(100)}
              className="w-7 h-7 rounded-lg hover:bg-theme-card flex items-center justify-center transition-colors cursor-pointer"
            >
              <MEIcon name="expand" className="w-4 h-4 text-theme-muted" />
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
                    <h3 className="text-sm font-semibold text-theme-primary mb-3 capitalize">
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
                  <p className="text-xs text-theme-tertiary mt-8 text-center">
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
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1', statusConf.color)}>
                  <MEIcon name={StatusIcon} className="w-3 h-3" />
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
                <span className="text-xs font-medium text-theme-tertiary bg-theme-active px-1.5 py-0.5 rounded">PDF</span>
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
                <MEIcon name="download" className="w-4 h-4 text-theme-tertiary" />
                Télécharger PDF
              </button>
              <button
                onClick={handlePrint}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer transition-colors"
              >
                <MEIcon name="print" className="w-4 h-4 text-theme-tertiary" />
                Imprimer
              </button>
              <button
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer transition-colors"
              >
                <MEIcon name="send" className="w-4 h-4 text-theme-tertiary" />
                Envoyer par email
              </button>
              <button
                onClick={handleCopyLink}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-theme-secondary hover:bg-theme-hover rounded-lg cursor-pointer transition-colors"
              >
                <MEIcon name="copy" className="w-4 h-4 text-theme-tertiary" />
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
                    <MEIcon name="check-circle" className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-theme-secondary">Document signé</p>
                    <p className="text-xs text-theme-tertiary">18.03.2026 à 15:45</p>
                  </div>
                </div>
              )}
              {(doc.status === 'sent' || doc.status === 'signed') && (
                <div className="flex items-start gap-2.5">
                  <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MEIcon name="send" className="w-3.5 h-3.5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-theme-secondary">Envoyé au client</p>
                    <p className="text-xs text-theme-tertiary">
                      {new Date(doc.createdAt).toLocaleDateString('fr-CH')} à {new Date(doc.createdAt).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <div className="w-6 h-6 rounded-full bg-theme-active flex items-center justify-center flex-shrink-0 mt-0.5">
                  <MEIcon name="file" className="w-3.5 h-3.5 text-theme-muted" />
                </div>
                <div>
                  <p className="text-xs font-medium text-theme-secondary">Document créé</p>
                  <p className="text-xs text-theme-tertiary">
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
