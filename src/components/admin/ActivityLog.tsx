/**
 * Flux d'activité (super-admin) : liste chronologique des `activity_events`,
 * groupée par jour et filtrable par type d'action.
 * Alimenté par `useActivityLog` (polling 30 s, pas de canal Realtime, malgré le badge « temps réel »).
 *
 * Rendu en grammaire Sugar : bento `AdminCard` séparé par l'ombre, badge
 * « temps réel » en pilule pleine (le point `bg-emerald-500` et le texte
 * `text-emerald-600` disparaissent), horodatages en chiffres tabulaires. La
 * pastille de ligne ne porte plus le violet plateforme : seul un événement
 * d'erreur se signale, les autres restent en encre douce.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Users, Home, GitBranch, ShieldCheck, Mail, Calendar, Shuffle, Building2, Activity, type LucideIcon } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { useActivityLog, type ActivityLogEntry } from '@/hooks/useActivityLog'
import {
  AdminCard, AdminEmpty, AdminGhostBtn, AdminGroupTitle, AdminIc, AdminPill, AdminSkeleton,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

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

// Typé `LucideIcon` et non `ElementType` : `AdminIc` attend une icône lucide, et
// toutes les valeurs en sont. Le type large laissait passer une chaîne.
const ENTITY_ICONS: Record<string, LucideIcon> = {
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
  const { sp, surf, dark, tones } = useAdminSugar()
  const [actionFilter, setActionFilter] = useState('')
  const [limit, setLimit] = useState(50)
  const { data: entries, isLoading } = useActivityLog({ action: actionFilter || undefined, limit })

  const grouped = groupByDate(entries ?? [], t('common.today'), t('common.yesterday'))
  const hair = dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.05)'

  return (
    <AdminCard padding="8px 12px 14px">
      <AdminGroupTitle
        label={t('activityLog.title')}
        tone="ok"
        right={
          <>
            <AdminPill label={t('activityLog.realtime')} tone="ok" />
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              style={{
                height: 30, padding: '0 12px', borderRadius: ADMIN_RADII.pill, border: 0,
                background: surf.cardSub, color: sp.ink, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                outline: 'none', appearance: 'none',
              }}
            >
              {ACTION_TYPE_KEYS.map(at => (
                <option key={at.value} value={at.value}>{t(at.key)}</option>
              ))}
            </select>
          </>
        }
      />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <AdminSkeleton key={i} height={28} />
          ))}
        </div>
      ) : (entries ?? []).length === 0 ? (
        <AdminEmpty icon={Activity} title={t('activityLog.noActivity')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {grouped.map(group => (
            <div key={group.label}>
              <p style={{ margin: '0 0 6px', padding: '0 10px', fontSize: 11, fontWeight: 700, letterSpacing: 0.2, color: sp.sub }}>
                {group.label}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {group.items.map((entry, i) => {
                  const Icon = ENTITY_ICONS[entry.entity_type] ?? Activity
                  const label = ACTION_LABEL_KEYS[entry.action] ? t(ACTION_LABEL_KEYS[entry.action]) : entry.action
                  const isError = entry.action.includes('error')
                  return (
                    <div key={entry.id} style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, padding: '6px 10px' }}>
                      {/* Filet vertical reliant les pastilles d'un même jour. */}
                      <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                        <span style={{
                          width: 8, height: 8, borderRadius: ADMIN_RADII.pill, flexShrink: 0,
                          background: isError ? tones.err : sp.soft,
                        }} />
                        {i < group.items.length - 1 && (
                          <span style={{ position: 'absolute', top: 12, width: 1, height: 16, background: hair }} />
                        )}
                      </div>
                      <AdminIc icon={Icon} size={15} color={sp.sub} />
                      <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 12.5, fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {label}
                      </p>
                      <span style={{ flexShrink: 0, fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                        {formatRelativeDate(entry.created_at)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}

          {(entries ?? []).length >= limit && (
            <AdminGhostBtn onClick={() => setLimit(l => l + 50)} style={{ width: '100%', justifyContent: 'center' }}>
              {t('activityLog.loadMore')}
            </AdminGhostBtn>
          )}
        </div>
      )}
    </AdminCard>
  )
}
