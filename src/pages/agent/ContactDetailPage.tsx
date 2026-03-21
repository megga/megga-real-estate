import { useParams, Link } from 'react-router-dom'
import {
  Mail, Phone, MapPin,
  Calendar, Building2, Banknote, Ruler, DoorOpen,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate, formatDate } from '@/lib/utils'
import { getContactById, type MockContact } from '@/lib/mockData'
import { TRANSACTION_STAGE_LABELS, type TransactionStage } from '@/lib/constants'
import PageTransition from '@/components/layout/PageTransition'

const scoreConfig: Record<MockContact['score'], { label: string; dot: string; text: string }> = {
  hot:  { label: 'Hot',  dot: 'bg-red-400',    text: 'text-red-400' },
  warm: { label: 'Warm', dot: 'bg-amber-400',  text: 'text-amber-400' },
  cold: { label: 'Cold', dot: 'bg-blue-400',   text: 'text-blue-400' },
}

const typeConfig: Record<MockContact['type'], { label: string; text: string }> = {
  buyer:  { label: 'Acheteur',          text: 'text-theme-secondary' },
  seller: { label: 'Vendeur',           text: 'text-theme-secondary' },
  both:   { label: 'Acheteur/Vendeur',  text: 'text-theme-secondary' },
  lead:   { label: 'Lead',              text: 'text-theme-tertiary' },
}


function ContactAvatar({ name, size = 'lg' }: { name: string; size?: 'sm' | 'lg' }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className={cn(
      'rounded-full flex items-center justify-center flex-shrink-0 bg-theme-active',
      size === 'lg' ? 'h-14 w-14' : 'h-9 w-9'
    )}>
      <span className={cn('font-semibold text-theme-primary', size === 'lg' ? 'text-lg' : 'text-xs')}>
        {initials}
      </span>
    </div>
  )
}

function InfoRow({ label, value }: { icon?: typeof Mail; label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-theme-border-subtle last:border-0">
      <span className="text-xs text-theme-tertiary">{label}</span>
      <span className="text-sm text-theme-primary text-right">{value}</span>
    </div>
  )
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>()
  const contact = getContactById(id || '')

  if (!contact) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center">
        <p className="text-lg font-medium text-theme-secondary mb-1">Contact introuvable</p>
        <p className="text-sm text-theme-muted mb-4">Ce contact n'existe pas ou a été supprimé.</p>
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
    <PageTransition>
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-theme-border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <ContactAvatar name={fullName} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold text-theme-primary">{fullName}</h1>
              <span className={cn('text-xs font-medium', tc.text)}>
                {tc.label}
              </span>
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', sc.text)}>
                <span className={cn('h-1.5 w-1.5 rounded-full', sc.dot)} />
                {sc.label}
              </span>
            </div>
            <p className="text-sm text-theme-muted">
              Contact créé le {formatDate(contact.created_at)} · {contact.source}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
              Éditer
            </button>
            <button className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors">
              Envoyer un message
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info + criteria */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact info */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">Informations</h2>
            <div className="space-y-0.5">
              <InfoRow icon={Mail} label="Email" value={contact.email} />
              <InfoRow icon={Phone} label="Téléphone" value={contact.phone} />
              <InfoRow icon={MapPin} label="Adresse" value={`${contact.address}, ${contact.city} (${contact.canton})`} />
              <InfoRow icon={Calendar} label="Dernière activité" value={formatRelativeDate(contact.last_activity)} />
              {contact.tags.length > 0 && (
                <div className="flex items-baseline justify-between py-2 border-b border-theme-border-subtle last:border-0">
                  <span className="text-xs text-theme-tertiary">Tags</span>
                  <div className="flex flex-wrap gap-1 justify-end">
                    {contact.tags.map((tag) => (
                      <span key={tag} className="text-[10px] text-theme-secondary border border-theme-border px-1.5 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search criteria (buyers only) */}
          {contact.search_criteria && (
            <div className="rounded-xl border border-theme-border p-5">
              <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">Critères de recherche</h2>
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
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">Notes</h2>
            <textarea
              defaultValue={contact.notes}
              rows={4}
              className="w-full text-sm text-theme-primary bg-transparent border border-theme-border rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
              placeholder="Ajouter des notes..."
            />
          </div>
        </div>

        {/* Right column: transactions + activity */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked transactions */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
              Transactions liées
              {contact.transactions.length > 0 && (
                <span className="ml-2 text-xs font-normal text-theme-muted">
                  ({contact.transactions.length})
                </span>
              )}
            </h2>

            {contact.transactions.length === 0 ? (
              <p className="text-sm text-theme-muted py-4 text-center">Aucune transaction en cours</p>
            ) : (
              <div className="space-y-3">
                {contact.transactions.map((tx, i) => {
                  const stageLabel = TRANSACTION_STAGE_LABELS[tx.stage as TransactionStage]
                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        'flex items-center gap-3 py-3 hover:bg-theme-hover transition-colors cursor-pointer group',
                        i < contact.transactions.length - 1 && 'border-b border-theme-border'
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">{tx.property_title}</p>
                        <p className="text-xs text-theme-tertiary mt-0.5">
                          {stageLabel || tx.stage} · {formatRelativeDate(tx.updated_at)}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-theme-primary shrink-0">{formatCHF(tx.price)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="rounded-xl border border-theme-border p-5">
            <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-4">
              Historique d'activité
            </h2>

            <div className="space-y-0">
              {contact.activities.map((activity, i) => (
                <div
                  key={activity.id}
                  className={cn(
                    'flex items-start gap-3 py-3',
                    i < contact.activities.length - 1 && 'border-b border-theme-border'
                  )}
                >
                  <div className="w-2 h-2 rounded-full bg-theme-tertiary shrink-0 mt-1.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-theme-primary">{activity.description}</p>
                    <p className="text-xs text-theme-tertiary mt-0.5">
                      {formatDate(activity.date)} · {formatRelativeDate(activity.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
    </PageTransition>
  )
}
