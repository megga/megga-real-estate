import { CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence } from 'motion/react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useActionBoard, type ActionItem } from '@/hooks/useActionBoard'
import ActionCard from '@/components/action-board/ActionCard'
import PipelineHealth from '@/components/action-board/PipelineHealth'
import MarketRadar from '@/components/action-board/MarketRadar'
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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ActionBoardPage() {
  const { byCategory, markAsCompleted, isLoading } = useActionBoard()
  const { t } = useTranslation('dashboard')
  const { profile } = useAuth()

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

        {/* ── Market Radar + Pipeline Health ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <MarketRadar />
          <PipelineHealth />
        </div>

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
