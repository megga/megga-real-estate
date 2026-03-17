import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Pencil, MessageSquare, Mail, Phone, MapPin,
  Calendar, Tag, Building2, Banknote, Ruler, DoorOpen,
  ChevronRight, FileText, PhoneCall, Eye, Send, UserPlus,
  CheckCircle2, Clock,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate, formatDate } from '@/lib/utils'
import { getContactById, type MockContact } from '@/lib/mockData'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'

const scoreConfig: Record<MockContact['score'], { label: string; dot: string; bg: string }> = {
  hot:  { label: 'Hot',  dot: 'bg-danger',  bg: 'bg-danger/10 text-danger' },
  warm: { label: 'Warm', dot: 'bg-warning', bg: 'bg-warning/10 text-warning' },
  cold: { label: 'Cold', dot: 'bg-accent',  bg: 'bg-accent/10 text-accent' },
}

const typeConfig: Record<MockContact['type'], { label: string; cls: string }> = {
  buyer:  { label: 'Acheteur', cls: 'bg-accent/10 text-accent' },
  seller: { label: 'Vendeur',  cls: 'bg-success/10 text-success' },
  both:   { label: 'Acheteur/Vendeur', cls: 'bg-warning/10 text-warning' },
  lead:   { label: 'Lead',     cls: 'bg-primary-100 text-primary-600' },
}

const activityIcon: Record<string, typeof Mail> = {
  contact_created: UserPlus,
  call: PhoneCall,
  email: Send,
  visit: Eye,
  visit_planned: Calendar,
  offer_sent: FileText,
  offer_received: FileText,
  negotiation: Banknote,
  document: FileText,
  reserved: CheckCircle2,
}

function ContactAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const colors = [
    'bg-accent', 'bg-success', 'bg-warning', 'bg-danger',
    'bg-primary-600', 'bg-primary-400',
  ]
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center flex-shrink-0',
      colors[idx],
      size === 'lg' ? 'h-16 w-16' : 'h-9 w-9'
    )}>
      <span className={cn('font-semibold text-white', size === 'lg' ? 'text-xl' : 'text-xs')}>
        {initials}
      </span>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className="h-4 w-4 text-primary-400 mt-0.5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm text-primary-900">{value}</p>
      </div>
    </div>
  )
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const contact = getContactById(id || '')

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-primary-700 mb-1">Contact introuvable</p>
        <p className="text-sm text-muted-foreground mb-4">Ce contact n'existe pas ou a été supprimé.</p>
        <Link to="/dashboard/contacts" className="text-sm text-accent hover:text-accent/80 font-medium">
          ← Retour aux contacts
        </Link>
      </div>
    )
  }

  const fullName = `${contact.first_name} ${contact.last_name}`
  const sc = scoreConfig[contact.score]
  const tc = typeConfig[contact.type]

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        to="/dashboard/contacts"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Contacts
      </Link>

      {/* Header */}
      <div className="bg-white rounded-card shadow-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <ContactAvatar name={fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-primary-900">{fullName}</h1>
              <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', tc.cls)}>
                {tc.label}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-badge', sc.bg)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                {sc.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Contact créé le {formatDate(contact.created_at)} · {contact.source}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-2 border border-border text-sm font-medium px-3 py-2 rounded-button hover:bg-section transition-colors text-primary-700">
              <Pencil className="h-4 w-4" />
              Éditer
            </button>
            <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-3 py-2 rounded-button transition-colors">
              <MessageSquare className="h-4 w-4" />
              Envoyer un message
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info + criteria */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact info */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-3">Informations</h2>
            <div className="space-y-0.5">
              <InfoRow icon={Mail} label="Email" value={contact.email} />
              <InfoRow icon={Phone} label="Téléphone" value={contact.phone} />
              <InfoRow icon={MapPin} label="Adresse" value={`${contact.address}, ${contact.city} (${contact.canton})`} />
              <InfoRow icon={Calendar} label="Dernière activité" value={formatRelativeDate(contact.last_activity)} />
              {contact.tags.length > 0 && (
                <div className="flex items-start gap-3 py-2">
                  <Tag className="h-4 w-4 text-primary-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Tags</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {contact.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-section text-primary-600 px-2 py-0.5 rounded-full">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search criteria (buyers only) */}
          {contact.search_criteria && (
            <div className="bg-white rounded-card shadow-card p-5">
              <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-3">Critères de recherche</h2>
              <div className="space-y-0.5">
                <InfoRow icon={Building2} label="Type de bien" value={contact.search_criteria.property_type} />
                <InfoRow
                  icon={Banknote}
                  label="Budget"
                  value={`${formatCHF(contact.search_criteria.budget_min)} – ${formatCHF(contact.search_criteria.budget_max)}`}
                />
                <InfoRow icon={MapPin} label="Localisation" value={contact.search_criteria.location} />
                <InfoRow icon={DoorOpen} label="Pièces min." value={`${contact.search_criteria.rooms_min} pièces`} />
                <InfoRow icon={Ruler} label="Surface min." value={`${contact.search_criteria.surface_min} m²`} />
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-3" id="notes-heading">Notes</h2>
            <textarea
              defaultValue={contact.notes}
              rows={4}
              className="w-full text-sm text-primary-700 bg-section border border-border rounded-input p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              placeholder="Ajouter des notes..."
              aria-labelledby="notes-heading"
            />
          </div>
        </div>

        {/* Right column: transactions + activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked transactions */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-3">
              Transactions liées
              {contact.transactions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  ({contact.transactions.length})
                </span>
              )}
            </h2>

            {contact.transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Aucune transaction en cours</p>
            ) : (
              <div className="space-y-3">
                {contact.transactions.map((tx) => {
                  const stageLabel = TRANSACTION_STAGE_LABELS[tx.stage as TransactionStage]
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center gap-4 p-3 rounded-lg bg-section hover:bg-primary-50 transition-colors cursor-pointer"
                    >
                      <div className="h-10 w-10 bg-accent/10 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Building2 className="h-5 w-5 text-accent" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-primary-900 truncate">{tx.property_title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                            {stageLabel || tx.stage}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeDate(tx.updated_at)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-bold text-primary-900">{formatCHF(tx.price)}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-primary-300 flex-shrink-0" />
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="bg-white rounded-card shadow-card p-5">
            <h2 className="text-sm font-semibold text-primary-900 uppercase tracking-wider mb-4">
              Historique d'activité
            </h2>

            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[17px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-4">
                {contact.activities.map((activity, i) => {
                  const Icon = activityIcon[activity.action] || Clock
                  const isFirst = i === 0
                  return (
                    <div key={activity.id} className="relative flex gap-4">
                      <div className={cn(
                        'h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0 z-10',
                        isFirst ? 'bg-accent text-white' : 'bg-white border-2 border-border text-primary-400'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0 pt-1">
                        <p className={cn(
                          'text-sm',
                          isFirst ? 'font-medium text-primary-900' : 'text-primary-700'
                        )}>
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDate(activity.date)} · {formatRelativeDate(activity.date)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
