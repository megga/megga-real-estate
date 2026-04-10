import { useState } from 'react'
import { CheckCircle2, Home, Check, X, Loader2, MapPin, Phone, Mail } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'motion/react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useActionBoard, type ActionItem } from '@/hooks/useActionBoard'
import { useSellerLeads, useAcceptSellerLead, useRejectSellerLead, type SellerLeadRow } from '@/hooks/useSellerLeads'
import ActionCard from '@/components/action-board/ActionCard'
import PipelineHealth from '@/components/action-board/PipelineHealth'
import MarketRadar from '@/components/action-board/MarketRadar'
import OnboardingChecklist from '@/components/onboarding/OnboardingChecklist'
import PageTransition from '@/components/layout/PageTransition'

// ── Section config ───────────────────────────────────────────────────────────

interface SectionConfig {
  key: string
  titleKey: string
  borderColor: string
  iconColor: string
  emptyKey: string
  hideWhenEmpty?: boolean
}

// WCAG 2.1 AA: les couleurs -400 ne passent pas le ratio 4.5:1 sur fond clair.
// Utilisation de -700 pour garantir la lisibilité en light mode.
// En dark mode les classes -700 restent suffisantes (bg-theme-card = #2A2A2A).
const SECTIONS: SectionConfig[] = [
  {
    key: 'urgencies',
    titleKey: 'actionBoard.sections.urgencies',
    borderColor: 'border-red-500/40',
    iconColor: 'text-red-700 dark:text-red-400',
    emptyKey: 'actionBoard.empty.urgencies',
    hideWhenEmpty: true,
  },
  {
    key: 'followUps',
    titleKey: 'actionBoard.sections.followUps',
    borderColor: 'border-amber-500/40',
    iconColor: 'text-amber-700 dark:text-amber-400',
    emptyKey: 'actionBoard.empty.followUps',
  },
  {
    key: 'matches',
    titleKey: 'actionBoard.sections.matches',
    borderColor: 'border-blue-500/40',
    iconColor: 'text-blue-700 dark:text-blue-400',
    emptyKey: 'actionBoard.empty.matches',
  },
  {
    key: 'visits',
    titleKey: 'actionBoard.sections.visits',
    borderColor: 'border-cyan-500/40',
    iconColor: 'text-cyan-700 dark:text-cyan-400',
    emptyKey: 'actionBoard.empty.visits',
  },
  {
    key: 'suggestions',
    titleKey: 'actionBoard.sections.suggestions',
    borderColor: 'border-emerald-500/40',
    iconColor: 'text-emerald-700 dark:text-emerald-400',
    emptyKey: 'actionBoard.empty.suggestions',
  },
]

// ── Badge colors for counter pills ───────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  urgencies: 'bg-red-500/15 text-red-700 dark:text-red-400',
  followUps: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  matches: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  visits: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  suggestions: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
}

// ── Action Section ───────────────────────────────────────────────────────────

function ActionSection({
  config,
  actions,
  onComplete,
}: {
  config: SectionConfig
  actions: ActionItem[]
  onComplete: (id: string) => void
}) {
  const { t } = useTranslation('dashboard')
  const isEmpty = actions.length === 0

  if (isEmpty && config.hideWhenEmpty) return null


  return (
    <div className={cn(
      'rounded-xl px-5 py-4 border',
      config.borderColor,
    )}>
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className={cn('text-xs capitalize font-semibold', config.iconColor)}>
          {t(config.titleKey)}
        </h2>
        {!isEmpty && (
          <span className={cn(
            'ml-1 text-xs font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center',
            BADGE_COLORS[config.key] || 'bg-gray-500/15 text-gray-500'
          )}>
            {actions.length}
          </span>
        )}
      </div>

      {isEmpty ? (
        <div className="flex items-center gap-2 text-xs text-theme-tertiary py-1">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500/50" />
          {t(config.emptyKey)}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <AnimatePresence mode="popLayout">
            {actions.map((action) => (
              <ActionCard
                key={action.id}
                title={action.title}
                description={action.description}
                actionLabel={action.actionLabel}
                actionType={action.actionType}
                timestamp={action.timestamp}
                isOverdue={action.isOverdue}
                onAction={() => {
                  // In production: navigate to entity or open communication
                }}
                onComplete={() => onComplete(action.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ── Seller Lead Card ────────────────────────────────────────────────────────

function SellerLeadCard({ lead }: { lead: SellerLeadRow }) {
  const { t } = useTranslation('dashboard')
  const { profile } = useAuth()
  const acceptLead = useAcceptSellerLead()
  const rejectLead = useRejectSellerLead()
  const [expanded, setExpanded] = useState(false)

  const pd = lead.property_data
  const TYPE_MAP: Record<string, string> = { apartment: 'Appartement', house: 'Maison', villa: 'Villa', land: 'Terrain' }
  const typeLabel = TYPE_MAP[pd?.type ?? ''] || pd?.type || 'Bien'
  const motivLabel = t(`actionBoard.motivations.${lead.motivation ?? 'exploring'}`)
  const isLoading = acceptLead.isPending || rejectLead.isPending

  function handleAccept(e: React.MouseEvent) {
    e.stopPropagation()
    if (!profile) return
    acceptLead.mutate({
      leadId: lead.id,
      agencyId: profile.agency_id || '',
      agentId: profile.id,
      agentName: profile.full_name || 'Agent MEGGA',
    })
  }

  function handleReject(e: React.MouseEvent) {
    e.stopPropagation()
    rejectLead.mutate({ id: lead.id })
  }

  return (
    <div
      className="rounded-lg border border-theme-border p-4 hover:border-theme-active transition-colors cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(!expanded) } }}
    >
      <div className="flex items-start gap-3">
        {/* Photo or icon */}
        {pd?.photos?.[0] ? (
          <img src={pd.photos[0]} alt="" className="h-14 w-14 rounded-lg object-cover flex-shrink-0" />
        ) : (
          <div className="h-14 w-14 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
            <Home className="h-5 w-5 text-purple-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-theme-primary truncate">{lead.contact_name}</p>
            <span className="text-xs text-theme-muted flex-shrink-0">{formatRelativeDate(lead.created_at)}</span>
          </div>
          <p className="text-xs text-theme-secondary mt-0.5">
            {typeLabel} {pd?.rooms}p · {pd?.surface} m² · {pd?.city || pd?.canton}
          </p>
          {lead.estimation_median && (
            <p className="text-sm font-semibold text-theme-primary mt-1">
              {lead.estimation_min && lead.estimation_max
                ? `${formatCHF(lead.estimation_min)} — ${formatCHF(lead.estimation_max)}`
                : formatCHF(lead.estimation_median)
              }
            </p>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="mt-3 pt-3 border-t border-theme-border-subtle space-y-2">
          <div className="flex items-center gap-4 text-xs text-theme-secondary">
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {pd?.address}, {pd?.city}</span>
          </div>
          <div className="flex items-center gap-4 text-xs text-theme-secondary">
            {lead.contact_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {lead.contact_phone}</span>}
            <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {lead.contact_email}</span>
          </div>
          <div className="text-xs text-theme-muted">
            {t('actionBoard.motivation')} : <span className="text-theme-secondary font-medium">{motivLabel}</span>
          </div>

          {/* Photo thumbnails */}
          {pd?.photos && pd.photos.length > 0 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              {pd.photos.slice(0, 4).map((photo: string, i: number) => (
                <img key={i} src={photo} alt="" className="h-16 w-20 rounded object-cover flex-shrink-0" />
              ))}
              {pd.photos.length > 4 && (
                <div className="h-16 w-20 rounded bg-theme-hover flex items-center justify-center flex-shrink-0 text-xs text-theme-muted">
                  +{pd.photos.length - 4}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-theme-border-subtle">
        <button
          onClick={handleAccept}
          disabled={isLoading}
          className="h-8 px-3.5 rounded-lg text-xs font-medium border border-accent/30 text-accent hover:bg-accent/5 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {acceptLead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
          {t('actionBoard.accept')}
        </button>
        <button
          onClick={handleReject}
          disabled={isLoading}
          className="h-8 px-3.5 rounded-lg text-xs font-medium text-theme-muted hover:text-theme-secondary transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {rejectLead.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
          {t('actionBoard.reject')}
        </button>
        {acceptLead.isSuccess && (
          <span className="text-xs text-emerald-500 flex items-center gap-1 ml-auto">
            <CheckCircle2 className="h-3 w-3" /> {t('actionBoard.accepted')}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Seller Leads Section ────────────────────────────────────────────────────

function SellerLeadsSection({ leads }: { leads: SellerLeadRow[] }) {
  const { t } = useTranslation('dashboard')
  if (leads.length === 0) return null

  return (
    <div className="rounded-xl px-5 py-4 border border-purple-500/40">
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className="text-xs capitalize font-semibold text-purple-400">
          {t('actionBoard.sellerLeads')}
        </h2>
        <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center bg-purple-500/15 text-purple-400">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-3">
        {leads.map((lead) => (
          <SellerLeadCard key={lead.id} lead={lead} />
        ))}
      </div>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ActionBoardPage() {
  const { byCategory, markAsCompleted, isLoading } = useActionBoard()
  const { t } = useTranslation('dashboard')
  const { profile } = useAuth()
  const { data: sellerLeads = [] } = useSellerLeads('new')

  const firstName = profile?.full_name?.split(' ')[0] ?? 'Agent'

  // Build contextual subtitle using translated day/month names
  const now = new Date()
  const dayName = t(`actionBoard.days.${now.getDay()}`)
  const monthName = t(`actionBoard.months.${now.getMonth()}`)
  const todayFormatted = `${dayName} ${now.getDate()} ${monthName} ${now.getFullYear()}`

  const urgCount = byCategory.urgencies?.length ?? 0
  const followCount = byCategory.followUps?.length ?? 0
  const visitCount = byCategory.visits?.length ?? 0
  const matchCount = byCategory.matches?.length ?? 0

  const summaryParts: string[] = []
  if (urgCount > 0) summaryParts.push(t(urgCount > 1 ? 'actionBoard.summary.urgency_plural' : 'actionBoard.summary.urgency', { count: urgCount }))
  if (followCount > 0) summaryParts.push(t(followCount > 1 ? 'actionBoard.summary.followUp_plural' : 'actionBoard.summary.followUp', { count: followCount }))
  if (visitCount > 0) summaryParts.push(t(visitCount > 1 ? 'actionBoard.summary.visit_plural' : 'actionBoard.summary.visit', { count: visitCount }))
  if (matchCount > 0) summaryParts.push(t(matchCount > 1 ? 'actionBoard.summary.match_plural' : 'actionBoard.summary.match', { count: matchCount }))

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="px-2 py-2 max-w-3xl mx-auto">
        {/* ── Header — minimal ── */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-theme-primary">
            {t('greeting', { name: firstName })}
          </h1>
          <p className="text-sm text-theme-tertiary mt-1">
            {todayFormatted}
            {summaryParts.length > 0 && (
              <> · <span className="text-theme-secondary">{summaryParts.join(', ')}</span></>
            )}
          </p>
        </div>

        {/* ── Onboarding Checklist ── */}
        <OnboardingChecklist />

        {/* ── Market Radar + Pipeline Health ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MarketRadar />
          <PipelineHealth />
        </div>

        {/* ── Seller Leads ── */}
        <SellerLeadsSection leads={sellerLeads} />

        {/* ── Sections ── */}
        <div className="space-y-4">
          {SECTIONS.map((config) => {
            const key = config.key as keyof typeof byCategory
            const actions = byCategory[key]
            return (
              <ActionSection
                key={config.key}
                config={config}
                actions={actions}
                onComplete={markAsCompleted}
              />
            )
          })}
        </div>
      </div>
    </PageTransition>
  )
}
