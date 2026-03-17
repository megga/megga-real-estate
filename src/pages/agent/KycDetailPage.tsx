import { useState, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ShieldCheck, CheckCircle2, Clock, XCircle,
  Upload, FileText, AlertTriangle, MessageSquare,
  ClipboardList, FolderOpen, ScrollText, StickyNote,
  Plus, Send, ChevronDown, ChevronRight,
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

const STATUS_CONFIG: Record<MockKycCase['status'], { label: string; cls: string }> = {
  pending: { label: 'En attente', cls: 'bg-primary-100 text-primary-600' },
  in_progress: { label: 'En cours', cls: 'bg-accent/10 text-accent' },
  review: { label: 'En revue', cls: 'bg-warning/10 text-warning' },
  validated: { label: 'Validé', cls: 'bg-success/10 text-success' },
  rejected: { label: 'Rejeté', cls: 'bg-danger/10 text-danger' },
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

type TabId = 'checklist' | 'documents' | 'audit' | 'notes'

const TABS: { id: TabId; label: string; icon: typeof ClipboardList }[] = [
  { id: 'checklist', label: 'Checklist', icon: ClipboardList },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'audit', label: 'Journal d\'audit', icon: ScrollText },
  { id: 'notes', label: 'Notes', icon: StickyNote },
]

// ─── Progress Bar ────────────────────────────────────────────────────────────

function ProgressBar({ pct }: { pct: number }) {
  const color = pct >= 70 ? 'bg-success' : pct >= 40 ? 'bg-warning' : 'bg-danger'

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary-700">Progression globale</span>
        <span className={cn(
          'text-sm font-semibold',
          pct >= 70 ? 'text-success' : pct >= 40 ? 'text-warning' : 'text-danger'
        )}>
          {pct}%
        </span>
      </div>
      <div className="w-full h-2.5 bg-primary-100 rounded-full overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', color)}
          style={{ width: `${pct}%` }}
        />
      </div>
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
        return <CheckCircle2 className="h-4.5 w-4.5 text-success flex-shrink-0" aria-label="Validé" />
      case 'pending':
        return <Clock className="h-4.5 w-4.5 text-warning flex-shrink-0" aria-label="En attente" />
      case 'missing':
        return <XCircle className="h-4.5 w-4.5 text-danger flex-shrink-0" aria-label="Manquant" />
    }
  }

  return (
    <div className="space-y-4">
      {Array.from(grouped.entries()).map(([category, categoryItems]) => {
        const completed = categoryItems.filter((i) => i.isCompleted).length
        const isCollapsed = collapsed.has(category)

        return (
          <div key={category} className="bg-white rounded-card border border-border overflow-hidden">
            <button
              onClick={() => toggleCategory(category)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-section/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isCollapsed
                  ? <ChevronRight className="h-4 w-4 text-primary-400" aria-hidden="true" />
                  : <ChevronDown className="h-4 w-4 text-primary-400" aria-hidden="true" />
                }
                <span className="text-sm font-semibold text-primary-900">{category}</span>
                <span className="text-xs text-muted-foreground">
                  {completed}/{categoryItems.length}
                </span>
              </div>
              <div className="w-16 h-1.5 bg-primary-100 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full',
                    completed === categoryItems.length ? 'bg-success' : 'bg-accent'
                  )}
                  style={{ width: `${categoryItems.length > 0 ? (completed / categoryItems.length) * 100 : 0}%` }}
                />
              </div>
            </button>

            {!isCollapsed && (
              <div className="border-t border-border divide-y divide-border/50">
                {categoryItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    {statusIcon(item.status)}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        'text-sm',
                        item.isCompleted ? 'text-primary-500 line-through' : 'text-primary-900'
                      )}>
                        {item.label}
                        {item.isRequired && <span className="text-danger ml-1">*</span>}
                      </p>
                      {item.documentName ? (
                        <p className="text-xs text-accent mt-0.5 flex items-center gap-1">
                          <FileText className="h-3 w-3" aria-hidden="true" />
                          {item.documentName}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Aucun document lié</p>
                      )}
                    </div>
                    {!item.isCompleted && (
                      <button className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-hover px-2.5 py-1.5 rounded-button border border-accent/20 hover:border-accent/40 transition-colors">
                        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                        Uploader
                      </button>
                    )}
                    {item.completedAt && (
                      <span className="text-[10px] text-muted-foreground hidden sm:block">
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
    <div className="space-y-4">
      {/* Upload zone */}
      <div className="border-2 border-dashed border-border rounded-card p-8 flex flex-col items-center justify-center text-center hover:border-accent/40 hover:bg-accent/5 transition-colors cursor-pointer">
        <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center mb-3">
          <Upload className="h-6 w-6 text-accent" aria-hidden="true" />
        </div>
        <p className="text-sm font-medium text-primary-700">Glissez-déposez vos fichiers ici</p>
        <p className="text-xs text-muted-foreground mt-1">ou cliquez pour sélectionner — PDF, JPG, PNG (max 10 Mo)</p>
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          title="Aucun document"
          description="Les documents uploadés apparaîtront ici."
        />
      ) : (
        <div className="bg-white rounded-card border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-section/50">
                  <th className="text-left px-4 py-3 font-medium text-primary-600 text-xs uppercase tracking-wider">Fichier</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-600 text-xs uppercase tracking-wider hidden sm:table-cell">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-600 text-xs uppercase tracking-wider hidden md:table-cell">Taille</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-600 text-xs uppercase tracking-wider hidden md:table-cell">Uploadé par</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-600 text-xs uppercase tracking-wider hidden lg:table-cell">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-primary-600 text-xs uppercase tracking-wider">Statut</th>
                  <th className="text-right px-4 py-3 font-medium text-primary-600 text-xs uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {documents.map((doc) => {
                  const docStatus = DOC_STATUS_CONFIG[doc.status]
                  return (
                    <tr key={doc.id} className="hover:bg-section/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-primary-400 flex-shrink-0" aria-hidden="true" />
                          <span className="text-primary-900 font-medium truncate max-w-[200px]">{doc.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">{doc.type}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{doc.sizeMb.toFixed(1)} Mo</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{doc.uploadedBy}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(doc.uploadedAt)}</td>
                      <td className="px-4 py-3">
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-badge', docStatus.cls)}>
                          {docStatus.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {doc.status === 'pending' && (
                            <>
                              <button className="text-xs font-medium text-success hover:text-success-dark px-2 py-1 rounded-button hover:bg-success/10 transition-colors">
                                Valider
                              </button>
                              <button className="text-xs font-medium text-danger hover:text-danger-dark px-2 py-1 rounded-button hover:bg-danger/10 transition-colors">
                                Rejeter
                              </button>
                            </>
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

const AUDIT_ICON_MAP: Record<MockKycAuditEvent['type'], { icon: typeof FileText; cls: string }> = {
  create: { icon: Plus, cls: 'bg-accent/10 text-accent' },
  upload: { icon: Upload, cls: 'bg-primary-100 text-primary-600' },
  checklist: { icon: CheckCircle2, cls: 'bg-success/10 text-success' },
  comment: { icon: MessageSquare, cls: 'bg-warning/10 text-warning' },
  status: { icon: AlertTriangle, cls: 'bg-accent/10 text-accent' },
  validate: { icon: ShieldCheck, cls: 'bg-success/10 text-success' },
}

function AuditTab({ events }: { events: MockKycAuditEvent[] }) {
  if (events.length === 0) {
    return (
      <EmptyState
        icon={ScrollText}
        title="Aucun événement"
        description="Le journal d'audit sera alimenté au fur et à mesure des actions."
      />
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" aria-hidden="true" />

      <div className="space-y-0">
        {events.map((event, idx) => {
          const config = AUDIT_ICON_MAP[event.type]
          const Icon = config.icon
          const isLast = idx === events.length - 1

          return (
            <div key={event.id} className={cn('relative flex gap-4 pl-0', !isLast && 'pb-6')}>
              {/* Icon */}
              <div className={cn(
                'relative z-10 h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0',
                config.cls
              )}>
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-primary-900">{event.action}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                    {formatRelativeDate(event.timestamp)}
                  </span>
                </div>
                <p className="text-[10px] text-primary-400 mt-1">
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
    <div className="space-y-4">
      {/* New note input */}
      <div className="bg-white rounded-card border border-border p-4">
        <label htmlFor="new-note" className="text-sm font-medium text-primary-700 block mb-2">
          Ajouter un commentaire
        </label>
        <textarea
          id="new-note"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Écrivez votre commentaire..."
          rows={3}
          className="w-full text-sm bg-section/50 border border-border rounded-input px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
        />
        <div className="flex justify-end mt-2">
          <button
            disabled={!newNote.trim()}
            className={cn(
              'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-button transition-colors',
              newNote.trim()
                ? 'bg-accent text-white hover:bg-accent-hover'
                : 'bg-primary-100 text-primary-300 cursor-not-allowed'
            )}
          >
            <Send className="h-3.5 w-3.5" aria-hidden="true" />
            Envoyer
          </button>
        </div>
      </div>

      {/* Existing notes */}
      {notes.length === 0 ? (
        <EmptyState
          icon={StickyNote}
          title="Aucune note"
          description="Les notes ajoutées par les agents apparaîtront ici."
        />
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div key={note.id} className="bg-white rounded-card border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-full bg-accent/10 flex items-center justify-center">
                    <span className="text-[10px] font-semibold text-accent">
                      {note.author.split(' ').map((n) => n[0]).join('').toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm font-medium text-primary-900">{note.author}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{formatRelativeDate(note.createdAt)}</span>
              </div>
              <p className="text-sm text-primary-700 leading-relaxed">{note.content}</p>
            </div>
          ))}
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

  const status = STATUS_CONFIG[isValidated ? 'validated' : kycCase.status]
  const risk = RISK_CONFIG[kycCase.riskLevel]
  const typeInfo = TYPE_CONFIG[kycCase.type]
  const currentStatus = isValidated ? 'validated' : kycCase.status
  const currentPct = isValidated ? 100 : kycCase.completionPct

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
      <div className="bg-white rounded-card shadow-card border border-border p-5 md:p-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          {/* Left: Info */}
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-semibold text-primary-900">
                {kycCase.contactName}
              </h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', typeInfo.cls)}>
                  {typeInfo.label}
                </span>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge inline-flex items-center gap-1', risk.cls)}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', risk.dotCls)} aria-hidden="true" />
                  Risque {risk.label}
                </span>
                <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', status.cls)}>
                  {status.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Créé le {formatDate(kycCase.createdAt)} — Dernière mise à jour {formatRelativeDate(kycCase.updatedAt)}
              </p>
            </div>
          </div>

          {/* Right: Validate button */}
          {canValidate && (
            <button
              onClick={() => setShowValidateDialog(true)}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium px-5 py-2.5 rounded-button transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2 whitespace-nowrap"
            >
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Valider le dossier
            </button>
          )}
          {currentStatus === 'validated' && (
            <div className="inline-flex items-center gap-2 bg-success/10 text-success text-sm font-medium px-4 py-2.5 rounded-button">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Dossier validé
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-5 pt-5 border-t border-border">
          <ProgressBar pct={currentPct} />
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-card shadow-card border border-border overflow-hidden">
        {/* Tab headers */}
        <div className="flex border-b border-border overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-2 px-4 md:px-5 py-3.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px',
                  isActive
                    ? 'text-accent border-accent'
                    : 'text-primary-400 border-transparent hover:text-primary-700 hover:border-primary-200'
                )}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {tab.label}
                {tab.id === 'checklist' && (
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-badge',
                    isActive ? 'bg-accent/10 text-accent' : 'bg-primary-100 text-primary-400'
                  )}>
                    {kycCase.checklistItems.filter((i) => i.isCompleted).length}/{kycCase.checklistItems.length}
                  </span>
                )}
                {tab.id === 'documents' && (
                  <span className={cn(
                    'text-[10px] font-medium px-1.5 py-0.5 rounded-badge',
                    isActive ? 'bg-accent/10 text-accent' : 'bg-primary-100 text-primary-400'
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
