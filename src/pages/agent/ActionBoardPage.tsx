import { CheckCircle2, Home, ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'motion/react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useActionBoard, type ActionItem } from '@/hooks/useActionBoard'
import { useSellerLeads, type SellerLeadRow } from '@/hooks/useSellerLeads'
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

const SECTIONS: SectionConfig[] = [
  {
    key: 'urgencies',
    titleKey: 'actionBoard.sections.urgencies',
    borderColor: 'border-red-500/40',
    iconColor: 'text-red-400',
    emptyKey: 'actionBoard.empty.urgencies',
    hideWhenEmpty: true,
  },
  {
    key: 'followUps',
    titleKey: 'actionBoard.sections.followUps',
    borderColor: 'border-amber-500/40',
    iconColor: 'text-amber-400',
    emptyKey: 'actionBoard.empty.followUps',
  },
  {
    key: 'matches',
    titleKey: 'actionBoard.sections.matches',
    borderColor: 'border-blue-500/40',
    iconColor: 'text-blue-400',
    emptyKey: 'actionBoard.empty.matches',
  },
  {
    key: 'visits',
    titleKey: 'actionBoard.sections.visits',
    borderColor: 'border-cyan-500/40',
    iconColor: 'text-cyan-400',
    emptyKey: 'actionBoard.empty.visits',
  },
  {
    key: 'suggestions',
    titleKey: 'actionBoard.sections.suggestions',
    borderColor: 'border-emerald-500/40',
    iconColor: 'text-emerald-400',
    emptyKey: 'actionBoard.empty.suggestions',
  },
]

// ── Badge colors for counter pills ───────────────────────────────────────────

const BADGE_COLORS: Record<string, string> = {
  urgencies: 'bg-red-500/15 text-red-400',
  followUps: 'bg-amber-500/15 text-amber-400',
  matches: 'bg-blue-500/15 text-blue-400',
  visits: 'bg-cyan-500/15 text-cyan-400',
  suggestions: 'bg-emerald-500/15 text-emerald-400',
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
        <h2 className={cn('text-[11px] uppercase tracking-[0.08em] font-semibold', config.iconColor)}>
          {t(config.titleKey)}
        </h2>
        {!isEmpty && (
          <span className={cn(
            'ml-1 text-xs font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center',
            BADGE_COLORS[config.key] || 'bg-gray-500/15 text-gray-400'
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

// ── Seller Leads Section ────────────────────────────────────────────────────

function SellerLeadsSection({ leads }: { leads: SellerLeadRow[] }) {
  const navigate = useNavigate()
  if (leads.length === 0) return null

  return (
    <div className="rounded-xl px-5 py-4 border border-purple-500/40">
      <div className="flex items-center gap-2.5 mb-3">
        <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-purple-400">
          Nouveaux leads vendeurs
        </h2>
        <span className="ml-1 text-xs font-semibold px-2 py-0.5 rounded-full min-w-[22px] text-center bg-purple-500/15 text-purple-400">
          {leads.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {leads.map((lead) => {
          const pd = lead.property_data
          return (
            <div
              key={lead.id}
              className="flex items-center gap-3 rounded-lg border border-theme-border p-3 hover:border-theme-active transition-colors group cursor-pointer"
              onClick={() => {
                if (lead.contact_id) navigate(`/dashboard/contacts/${lead.contact_id}`)
              }}
            >
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                <Home className="h-4 w-4 text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-theme-primary truncate">{lead.contact_name}</p>
                <p className="text-xs text-theme-tertiary truncate">
                  {pd?.city || pd?.canton} — {pd?.type === 'apartment' ? 'Appt' : pd?.type === 'house' ? 'Maison' : pd?.type === 'villa' ? 'Villa' : pd?.type || 'Bien'} {pd?.rooms}p. {pd?.surface} m²
                  {lead.estimation_median ? ` — ${formatCHF(lead.estimation_median)}` : ''}
                </p>
              </div>
              <span className="text-[11px] text-theme-muted flex-shrink-0">
                {formatRelativeDate(lead.created_at)}
              </span>
              <ArrowRight className="h-3.5 w-3.5 text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
            </div>
          )
        })}
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
