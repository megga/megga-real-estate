import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, CheckCircle2, Clock, XCircle,
  Upload, FileText, MessageSquare, RefreshCw,
  ClipboardCheck, Eye, Download, Trash2,
  Plus, Send, ChevronDown, ChevronRight, Calendar,
  User, Building2, Wallet, Landmark, Scale,
} from 'lucide-react'
import { cn, formatDate, formatRelativeDate } from '@/lib/utils'
import {
  getKycCaseById,
  type MockKycCase,
  type MockKycChecklistItem,
  type MockKycDocument,
  type MockKycAuditEvent,
  type MockKycNote,
} from '@/lib/mockData'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import EmptyState from '@/components/ui/empty-state'

// ─── Status & Risk config ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<MockKycCase['status'], { label: string; cls: string; iconBg: string }> = {
  pending: { label: 'En attente', cls: 'bg-primary-100 text-primary-600', iconBg: 'bg-primary-400' },
  in_progress: { label: 'En cours', cls: 'bg-warning/10 text-warning', iconBg: 'bg-warning' },
  review: { label: 'En revue', cls: 'bg-accent/10 text-accent', iconBg: 'bg-accent' },
  validated: { label: 'Validé', cls: 'bg-success/10 text-success', iconBg: 'bg-success' },
  rejected: { label: 'Rejeté', cls: 'bg-danger/10 text-danger', iconBg: 'bg-danger' },
}

const RISK_CONFIG: Record<MockKycCase['riskLevel'], { label: string; cls: string; dotCls: string }> = {
  low: { label: 'Faible', cls: 'bg-success/10 text-success', dotCls: 'bg-success' },
  medium: { label: 'Moyen', cls: 'bg-warning/10 text-warning', dotCls: 'bg-warning' },
  high: { label: 'Élevé', cls: 'bg-danger/10 text-danger', dotCls: 'bg-danger' },
  unassessed: { label: 'Non évalué', cls: 'bg-primary-100 text-primary-400', dotCls: 'bg-primary-300' },
}

const TYPE_CONFIG: Record<MockKycCase['type'], { label: string; cls: string }> = {
  buyer_pp: { label: 'Acheteur PP', cls: 'bg-accent/10 text-accent' },
  buyer_pm: { label: 'Acheteur PM', cls: 'bg-accent/10 text-accent' },
  seller_pp: { label: 'Vendeur PP', cls: 'bg-success/10 text-success' },
  seller_pm: { label: 'Vendeur PM', cls: 'bg-success/10 text-success' },
}

// Category icon/color mapping for checklist
const CATEGORY_STYLE: Record<string, { icon: typeof User; bg: string; text: string }> = {
  'Identité': { icon: User, bg: 'bg-blue-50', text: 'text-blue-600' },
  'Domicile': { icon: Building2, bg: 'bg-green-50', text: 'text-green-600' },
  'Revenus': { icon: Wallet, bg: 'bg-purple-50', text: 'text-purple-600' },
  'Origine des fonds': { icon: Landmark, bg: 'bg-orange-50', text: 'text-orange-600' },
  'Conformité': { icon: Scale, bg: 'bg-red-50', text: 'text-red-600' },
  'Société': { icon: Building2, bg: 'bg-blue-50', text: 'text-blue-600' },
  'Représentants': { icon: User, bg: 'bg-green-50', text: 'text-green-600' },
  'Actionnariat': { icon: User, bg: 'bg-purple-50', text: 'text-purple-600' },
  'Finances': { icon: Wallet, bg: 'bg-orange-50', text: 'text-orange-600' },
  'Propriété': { icon: Landmark, bg: 'bg-blue-50', text: 'text-blue-600' },
}

const DEFAULT_CATEGORY_STYLE = { icon: FileText, bg: 'bg-gray-50', text: 'text-gray-600' }

type TabId = 'checklist' | 'documents' | 'audit' | 'notes'

const TABS: { id: TabId; label: string; icon: typeof ClipboardCheck }[] = [
  { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'audit', label: 'Journal', icon: Clock },
  { id: 'notes', label: 'Notes', icon: MessageSquare },
]

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ pct, completedCount, totalCount }: { pct: number; completedCount: number; totalCount: number }) {
  const color = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger'
  const textColor = pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-danger'

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary-700">Progression globale</span>
        <span className={cn('text-lg font-bold', textColor)}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-gray-500">
        {completedCount} sur {totalCount} items complétés
      </p>
    </div>
  )
}

// ─── Tab: Checklist ──────────────────────────────────────────────────────────

function ChecklistTab({ items }: { items: MockKycChecklistItem[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, MockKycChecklistItem[]>()
    for (const item of items) {
      const list = map.get(item.category) || []
      list.push(item)
      map.set(item.category, list)
    }
    return map
  }, [items])

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggleCategory = (cat: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const statusIcon = (status: MockKycChecklistItem['status']) => {
    switch (status) {
      case 'validated':
        return (
          <div className="h-6 w-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="h-4 w-4 text-success" aria-label="Validé" />
          </div>
        )
      case 'pending':
        return (
          <div className="h-6 w-6 rounded-full bg-warning/10 flex items-center justify-center flex-shrink-0">
            <Clock className="h-4 w-4 text-warning" aria-label="En attente" />
          </div>
        )
      case 'missing':
        return (
          <div className="h-6 w-6 rounded-full bg-danger/10 flex items-center justify-center flex-shrink-0">
            <XCircle className="h-4 w-4 text-danger" aria-label="Manquant" />
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([category, categoryItems]) => {
        const completed = categoryItems.filter((i) => i.isCompleted).length
        const isCollapsed = collapsed.has(category)
        const catStyle = CATEGORY_STYLE[category] || DEFAULT_CATEGORY_STYLE
        const CatIcon = catStyle.icon
        const pctCategory = categoryItems.length > 0 ? (completed / categoryItems.length) * 100 : 0

        return (
          <div key={category} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            {/* Category header */}
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-4 py-3.5 hover:bg-gray-50/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-gray-400" aria-hidden="true" />
                  : <ChevronDown className="h-4 w-4 text-gray-400" aria-hidden="true" />
                }
                <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', catStyle.bg)}>
                  <CatIcon className={cn('h-4 w-4', catStyle.text)} aria-hidden="true" />
                </div>
                <span className="text-base font-semibold text-primary-900">{category}</span>
                <span className="text-sm text-gray-400 ml-1">{completed}/{categoryItems.length}</span>
              </div>
              <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden hidden sm:block">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    completed === categoryItems.length ? 'bg-success' : 'bg-accent'
                  )}
                  style={{ width: `${pctCategory}%` }}
                />
              </div>
            </button>

            {/* Category items */}
            {!isCollapsed && (
              <div className="px-4 pb-3 space-y-2">
                {categoryItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 bg-gray-50/50 rounded-lg p-3">
                    {statusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        item.isCompleted ? 'text-gray-400 line-through' : 'text-primary-900 font-medium'
                      )}>
                        {item.label}
                        {item.isRequired && <span className="text-danger ml-1">*</span>}
                      </p>
                      {item.documentName ? (
                        <p className="text-sm text-accent mt-0.5 flex items-center gap-1 hover:underline cursor-pointer">
                          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                          {item.documentName}
                        </p>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">Aucun document lié</p>
                      )}
                    </div>
                    {!item.isCompleted && (
                      <button className="flex items-center gap-1.5 text-sm font-medium text-accent border-2 border-dashed border-accent/30 rounded-lg px-4 py-2 hover:bg-accent/5 hover:border-accent/50 transition-all">
                        <Upload className="h-4 w-4" aria-hidden="true" />
                        Uploader
                      </button>
                    )}
                    {item.completedAt && (
                      <span className="text-xs text-gray-400 hidden sm:block whitespace-nowrap">
                        {formatDate(item.completedAt)}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Tab: Documents ──────────────────────────────────────────────────────────

const DOC_STATUS_CONFIG: Record<MockKycDocument['status'], { label: string; cls: string }> = {
  validated: { label: 'Validé', cls: 'bg-success/10 text-success' },
  pending: { label: 'En attente', cls: 'bg-warning/10 text-warning' },
  rejected: { label: 'Rejeté', cls: 'bg-danger/10 text-danger' },
}

function DocumentsTab({ documents }: { documents: MockKycDocument[] }) {
  return (
    <div className="space-y-5">
      {/* Upload zone */}
      <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-accent hover:bg-accent/5 transition-all cursor-pointer group">
        <Upload className="h-12 w-12 text-gray-300 group-hover:text-accent transition-colors mb-3" aria-hidden="true" />
        <p className="text-gray-500 font-medium">Glissez-déposez vos fichiers ici</p>
        <p className="text-gray-400 text-sm mt-1">ou cliquez pour sélectionner — PDF, JPG, PNG (max 10 Mo)</p>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Aucun document"
          description="Les documents uploadés apparaîtront ici."
        />
      ) : (
        <div className="rounded-xl overflow-hidden border border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Fichier</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Taille</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden md:table-cell">Uploadé par</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => {
                  const docStatus = DOC_STATUS_CONFIG[doc.status]
                  return (
                    <tr key={doc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                            <FileText className="h-4 w-4 text-gray-500" aria-hidden="true" />
                          </div>
                          <span className="text-primary-900 font-medium truncate max-w-[200px]">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">{doc.type}</td>
                      <td className="px-4 py-3.5 text-gray-500 hidden md:table-cell">{doc.sizeMb.toFixed(1)} Mo</td>
                      <td className="px-4 py-3.5 text-gray-500 hidden md:table-cell">{doc.uploadedBy}</td>
                      <td className="px-4 py-3.5 text-gray-500 hidden lg:table-cell">{formatDate(doc.uploadedAt)}</td>
                      <td className="px-4 py-3.5">
                        <span className={cn('text-xs font-medium px-3 py-1 rounded-full', docStatus.cls)}>
                          {docStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/5 transition-colors" aria-label="Voir">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button className="p-1.5 rounded-lg text-gray-400 hover:text-accent hover:bg-accent/5 transition-colors" aria-label="Télécharger">
                            <Download className="h-4 w-4" />
                          </button>
                          {doc.status === 'pending' && (
                            <button className="p-1.5 rounded-lg text-gray-400 hover:text-danger hover:bg-danger/5 transition-colors" aria-label="Supprimer">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Audit ──────────────────────────────────────────────────────────────

const AUDIT_ICON_MAP: Record<MockKycAuditEvent['type'], { icon: typeof FileText; bg: string; text: string }> = {
  create: { icon: Plus, bg: 'bg-blue-50', text: 'text-blue-600' },
  upload: { icon: Upload, bg: 'bg-green-50', text: 'text-green-600' },
  checklist: { icon: CheckCircle2, bg: 'bg-success/10', text: 'text-success' },
  comment: { icon: MessageSquare, bg: 'bg-purple-50', text: 'text-purple-600' },
  status: { icon: RefreshCw, bg: 'bg-warning/10', text: 'text-warning' },
  validate: { icon: ShieldCheck, bg: 'bg-success/10', text: 'text-success' },
}

function AuditTab({ events }: { events: MockKycAuditEvent[] }) {
  // Reverse chronological order
  const sortedEvents = useMemo(() => [...events].reverse(), [events])

  if (sortedEvents.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Aucun événement"
        description="Le journal d'audit sera alimenté au fur et à mesure des actions."
      />
    )
  }

  return (
    <div className="relative pl-5">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-5 bottom-5 w-0.5 bg-gray-200" aria-hidden="true" />

      <div className="space-y-6">
        {sortedEvents.map((event) => {
          const config = AUDIT_ICON_MAP[event.type]
          const Icon = config.icon

          return (
            <div key={event.id} className="relative flex gap-4">
              {/* Icon on timeline */}
              <div className={cn(
                'relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0 -ml-5',
                config.bg
              )}>
                <Icon className={cn('h-4.5 w-4.5', config.text)} aria-hidden="true" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-primary-900">{event.action}</p>
                  <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
                    {formatRelativeDate(event.timestamp)}
                  </span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">{event.description}</p>
                <p className="text-xs text-gray-400 mt-1">
                  Par {event.actor} — {formatDate(event.timestamp)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Notes ──────────────────────────────────────────────────────────────

function NotesTab({ notes }: { notes: MockKycNote[] }) {
  const [newNote, setNewNote] = useState('')

  return (
    <div className="space-y-5">
      {/* New note input */}
      <div>
        <label htmlFor="new-note" className="text-sm font-medium text-primary-700 block mb-2">
          Ajouter un commentaire
        </label>
        <textarea
          id="new-note"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Écrivez votre commentaire..."
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 min-h-[120px] resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
        />
        <div className="flex justify-end mt-3">
          <button
            disabled={!newNote.trim()}
            className={cn(
              'inline-flex items-center gap-2 px-6 h-10 text-sm font-medium rounded-lg transition-colors',
              newNote.trim()
                ? 'bg-accent text-white hover:bg-accent-hover shadow-sm'
                : 'bg-gray-100 text-gray-300 cursor-not-allowed'
            )}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            Envoyer
          </button>
        </div>
      </div>

      {/* Existing notes */}
      {notes.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Aucune note"
          description="Les notes ajoutées par les agents apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const initials = note.author.split(' ').map((n) => n[0]).join('').toUpperCase()
            return (
              <div key={note.id} className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center">
                      <span className="text-xs font-semibold text-white">{initials}</span>
                    </div>
                    <span className="text-sm font-medium text-primary-900">{note.author}</span>
                  </div>
                  <span className="text-xs text-gray-400">{formatRelativeDate(note.createdAt)}</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mt-2">{note.content}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function KycDetailPage() {
  const { id } = useParams<{ id: string }>()
  const kycCase = id ? getKycCaseById(id) : undefined
  const [activeTab, setActiveTab] = useState<TabId>('checklist')
  const [showValidateDialog, setShowValidateDialog] = useState(false)
  const [isValidated, setIsValidated] = useState(false)

  if (!kycCase) {
    return (
      <div className="space-y-6">
        <Link
          to="/dashboard/kyc"
          className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover font-medium transition-colors"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour aux dossiers KYC
        </Link>
        <div className="bg-white rounded-card shadow-card border border-border p-12">
          <EmptyState
            icon={ShieldCheck}
            title="Dossier introuvable"
            description="Ce dossier KYC n'existe pas ou a été supprimé."
          />
        </div>
      </div>
    )
  }

  const currentStatus = isValidated ? 'validated' : kycCase.status
  const status = STATUS_CONFIG[currentStatus]
  const risk = RISK_CONFIG[kycCase.riskLevel]
  const typeInfo = TYPE_CONFIG[kycCase.type]
  const currentPct = isValidated ? 100 : kycCase.completionPct
  const completedItems = kycCase.checklistItems.filter((i) => i.isCompleted).length
  const totalItems = kycCase.checklistItems.length

  const canValidate = currentStatus !== 'validated' && currentStatus !== 'rejected'

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/dashboard/kyc"
        className="inline-flex items-center gap-1.5 text-sm text-accent hover:text-accent-hover font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux dossiers KYC
      </Link>

      {/* Header card */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Info */}
          <div className="flex items-start gap-4">
            {/* Status icon circle */}
            <div className={cn(
              'h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
              status.iconBg
            )}>
              <ShieldCheck className="h-5 w-5 text-white" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-primary-900">
                {kycCase.contactName}
              </h1>
              <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                <span className={cn('text-xs font-medium px-3 py-1 rounded-full', typeInfo.cls)}>
                  {typeInfo.label}
                </span>
                <span className={cn('text-xs font-medium px-3 py-1 rounded-full inline-flex items-center gap-1.5', risk.cls)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', risk.dotCls)} aria-hidden="true" />
                  Risque {risk.label}
                </span>
                <span className={cn('text-xs font-medium px-3 py-1 rounded-full', status.cls)}>
                  {status.label}
                </span>
              </div>
              <p className="text-sm text-gray-400 mt-2.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
                Créé le {formatDate(kycCase.createdAt)} — Mis à jour {formatRelativeDate(kycCase.updatedAt)}
              </p>
            </div>
          </div>

          {/* Right: Validate button */}
          {canValidate && (
            <button
              onClick={() => setShowValidateDialog(true)}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium h-11 px-6 rounded-lg shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2 whitespace-nowrap"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Valider le dossier
            </button>
          )}
          {currentStatus === 'validated' && (
            <div className="inline-flex items-center gap-2 bg-success/10 text-success text-sm font-medium h-11 px-6 rounded-lg">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Dossier validé
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5 pt-5 border-t border-gray-100">
          <ProgressBar pct={currentPct} completedCount={isValidated ? totalItems : completedItems} totalCount={totalItems} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-card border border-gray-100 overflow-hidden">
        {/* Tab headers — pill style */}
        <div className="flex gap-1 p-3 border-b border-gray-100 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 text-sm font-medium whitespace-nowrap rounded-lg transition-all',
                  isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
                {tab.id === 'checklist' && (
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  )}>
                    {completedItems}/{totalItems}
                  </span>
                )}
                {tab.id === 'documents' && (
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    isActive ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                  )}>
                    {kycCase.documents.length}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Tab content */}
        <div className="p-4 md:p-6">
          {activeTab === 'checklist' && <ChecklistTab items={kycCase.checklistItems} />}
          {activeTab === 'documents' && <DocumentsTab documents={kycCase.documents} />}
          {activeTab === 'audit' && <AuditTab events={kycCase.auditEvents} />}
          {activeTab === 'notes' && <NotesTab notes={kycCase.notes} />}
        </div>
      </div>

      {/* Validation dialog */}
      <ConfirmDialog
        open={showValidateDialog}
        onOpenChange={setShowValidateDialog}
        title="Valider le dossier KYC"
        description={`Êtes-vous sûr de vouloir valider le dossier KYC de ${kycCase.contactName} ? Cette action sera tracée dans le journal d'audit et ne pourra pas être annulée.`}
        confirmLabel="Confirmer la validation"
        cancelLabel="Annuler"
        variant="warning"
        onConfirm={() => setIsValidated(true)}
      />
    </div>
  )
}
