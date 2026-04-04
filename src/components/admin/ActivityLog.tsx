import { useState } from 'react'
import { Users, Home, GitBranch, ShieldCheck, Mail, Calendar, Shuffle, Building2, Activity, AlertTriangle } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useActivityLog, type ActivityLogEntry } from '@/hooks/useActivityLog'

const ACTION_LABELS: Record<string, string> = {
  contact_created: 'Contact cree',
  contact_updated: 'Contact mis a jour',
  property_created: 'Bien cree',
  property_updated: 'Bien mis a jour',
  transaction_created: 'Transaction creee',
  transaction_stage_change: 'Etape pipeline changee',
  kyc_created: 'Dossier KYC cree',
  kyc_screening_match: 'Alerte PEP/Sanctions',
  kyc_validated: 'KYC valide',
  email_sent: 'Email envoye',
  visit_created: 'Visite planifiee',
  match_created: 'Match cree',
  match_sent: 'Match envoye',
  agency_created: 'Agence inscrite',
  subscription_cancelled: 'Abonnement annule',
  edge_function_error: 'Erreur systeme',
}

const ENTITY_ICONS: Record<string, React.ElementType> = {
  contact: Users,
  property: Home,
  transaction: GitBranch,
  kyc: ShieldCheck,
  email: Mail,
  visit: Calendar,
  match: Shuffle,
  agency: Building2,
}

function groupByDate(entries: ActivityLogEntry[]): { label: string; items: ActivityLogEntry[] }[] {
  const groups: Record<string, ActivityLogEntry[]> = {}
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  for (const entry of entries) {
    const d = new Date(entry.created_at).toDateString()
    const label = d === today ? "Aujourd'hui" : d === yesterday ? 'Hier' : new Date(entry.created_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(entry)
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

const ACTION_TYPES = [
  { value: '', label: 'Tous' },
  { value: 'contact_created', label: 'Contacts' },
  { value: 'property_created', label: 'Biens' },
  { value: 'transaction_stage_change', label: 'Pipeline' },
  { value: 'kyc_screening_match', label: 'KYC' },
  { value: 'email_sent', label: 'Emails' },
  { value: 'edge_function_error', label: 'Erreurs' },
]

export default function ActivityLog() {
  const [actionFilter, setActionFilter] = useState('')
  const [limit, setLimit] = useState(50)
  const { data: entries, isLoading } = useActivityLog({ action: actionFilter || undefined, limit })

  const grouped = groupByDate(entries ?? [])

  return (
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-theme-primary">Activite plateforme</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-600 font-medium">Temps reel</span>
          </div>
        </div>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="h-8 px-2 pr-7 text-xs bg-transparent border border-theme-border rounded-lg text-theme-secondary focus:outline-none appearance-none"
        >
          {ACTION_TYPES.map(t => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-theme-hover" />
              <div className="h-4 bg-theme-hover rounded flex-1 max-w-[200px]" />
              <div className="h-3 bg-theme-hover rounded w-16 ml-auto" />
            </div>
          ))}
        </div>
      ) : (entries ?? []).length === 0 ? (
        <p className="text-sm text-theme-secondary py-8 text-center">Aucune activite recente</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.label}>
              <p className="text-[10px] uppercase tracking-wider text-theme-tertiary font-medium mb-2">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((entry, i) => {
                  const Icon = ENTITY_ICONS[entry.entity_type] ?? Activity
                  const label = ACTION_LABELS[entry.action] ?? entry.action
                  const isError = entry.action.includes('error')
                  return (
                    <div key={entry.id} className="flex items-center gap-3 py-1.5 group">
                      <div className="relative flex flex-col items-center">
                        <span className={cn(
                          'w-2 h-2 rounded-full flex-shrink-0',
                          isError ? 'bg-red-500' : 'bg-admin-accent'
                        )} />
                        {i < group.items.length - 1 && (
                          <span className="w-px h-4 bg-theme-border-subtle absolute top-3" />
                        )}
                      </div>
                      <Icon className="h-3.5 w-3.5 text-theme-tertiary flex-shrink-0" />
                      <p className="text-sm text-theme-primary flex-1 truncate">{label}</p>
                      <span className="text-xs text-theme-muted flex-shrink-0">{formatRelativeDate(entry.created_at)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {(entries ?? []).length >= limit && (
            <button
              onClick={() => setLimit(l => l + 50)}
              className="w-full h-9 text-sm font-medium text-theme-secondary border border-theme-border rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors"
            >
              Charger plus
            </button>
          )}
        </div>
      )}
    </div>
  )
}
