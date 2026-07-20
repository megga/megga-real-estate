/**
 * Flux d'activité (super-admin) : liste chronologique des `activity_events`,
 * groupée par jour et filtrable par type d'action.
 * Alimenté par `useActivityLog` (polling 30 s, pas de canal Realtime, malgré le badge « temps réel »).
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Shuffle, Activity } from 'lucide-react'
import { GitBranch3 as GitBranch } from '@/components/icons'
import { Home, ShieldDone as ShieldCheck, Message as Mail, Calendar, Building as Building2 } from '@/components/icons'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useActivityLog, type ActivityLogEntry } from '@/hooks/useActivityLog'

const ACTION_LABEL_KEYS: Record<string, string> = {
  contact_created: 'activityLog.action.contactCreated',
  contact_updated: 'activityLog.action.contactUpdated',
  property_created: 'activityLog.action.propertyCreated',
  property_updated: 'activityLog.action.propertyUpdated',
  transaction_created: 'activityLog.action.transactionCreated',
  transaction_stage_change: 'activityLog.action.pipelineChanged',
  kyc_created: 'activityLog.action.kycCreated',
  kyc_screening_match: 'activityLog.action.kycScreeningMatch',
  kyc_validated: 'activityLog.action.kycValidated',
  email_sent: 'activityLog.action.emailSent',
  visit_created: 'activityLog.action.visitCreated',
  match_created: 'activityLog.action.matchCreated',
  match_sent: 'activityLog.action.matchSent',
  agency_created: 'activityLog.action.agencyCreated',
  subscription_cancelled: 'activityLog.action.subscriptionCancelled',
  edge_function_error: 'activityLog.action.systemError',
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

/** Regroupe les entrées par jour (Aujourd'hui / Hier / date longue fr-CH), en préservant l'ordre reçu. */
function groupByDate(entries: ActivityLogEntry[], todayLabel: string, yesterdayLabel: string): { label: string; items: ActivityLogEntry[] }[] {
  const groups: Record<string, ActivityLogEntry[]> = {}
  const today = new Date().toDateString()
  const yesterday = new Date(Date.now() - 86400000).toDateString()

  for (const entry of entries) {
    const d = new Date(entry.created_at).toDateString()
    const label = d === today ? todayLabel : d === yesterday ? yesterdayLabel : new Date(entry.created_at).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })
    if (!groups[label]) groups[label] = []
    groups[label].push(entry)
  }

  return Object.entries(groups).map(([label, items]) => ({ label, items }))
}

const ACTION_TYPE_KEYS = [
  { value: '', key: 'activityLog.filter.all' },
  { value: 'contact_created', key: 'activityLog.filter.contacts' },
  { value: 'property_created', key: 'activityLog.filter.properties' },
  { value: 'transaction_stage_change', key: 'activityLog.filter.pipeline' },
  { value: 'kyc_screening_match', key: 'activityLog.filter.kyc' },
  { value: 'email_sent', key: 'activityLog.filter.emails' },
  { value: 'edge_function_error', key: 'activityLog.filter.errors' },
]

/** Bento du flux d'activité : filtre par action + pagination « charger plus » (+50). */
export default function ActivityLog() {
  const { t } = useTranslation('admin')
  const [actionFilter, setActionFilter] = useState('')
  const [limit, setLimit] = useState(50)
  const { data: entries, isLoading } = useActivityLog({ action: actionFilter || undefined, limit })

  const grouped = groupByDate(entries ?? [], t('common.today'), t('common.yesterday'))

  return (
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-theme-primary">{t('activityLog.title')}</h2>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-emerald-600 font-medium">{t('activityLog.realtime')}</span>
          </div>
        </div>
        <select
          value={actionFilter}
          onChange={e => setActionFilter(e.target.value)}
          className="h-8 px-2 pr-7 text-xs bg-transparent border border-theme-border rounded-lg text-theme-secondary focus:outline-none appearance-none"
        >
          {ACTION_TYPE_KEYS.map(at => (
            <option key={at.value} value={at.value}>{t(at.key)}</option>
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
        <p className="text-sm text-theme-secondary py-8 text-center">{t('activityLog.noActivity')}</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(group => (
            <div key={group.label}>
              <p className="text-xs tracking-wide text-theme-tertiary font-medium mb-2">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((entry, i) => {
                  const Icon = ENTITY_ICONS[entry.entity_type] ?? Activity
                  const label = ACTION_LABEL_KEYS[entry.action] ? t(ACTION_LABEL_KEYS[entry.action]) : entry.action
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
              {t('activityLog.loadMore')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
