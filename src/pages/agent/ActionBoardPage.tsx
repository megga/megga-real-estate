import {
  AlertTriangle, Clock, Sparkles, MapPin, Zap,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDate } from '@/lib/utils'
import { useActionBoard, type ActionItem } from '@/hooks/useActionBoard'
import ActionCard from '@/components/action-board/ActionCard'

// ── Section config ───────────────────────────────────────────────────────────

interface SectionConfig {
  key: string
  title: string
  icon: typeof AlertTriangle
  bgColor: string
  borderColor: string
  iconColor: string
  emptyMessage: string
}

const SECTIONS: SectionConfig[] = [
  {
    key: 'urgencies',
    title: 'Urgences',
    icon: AlertTriangle,
    bgColor: 'bg-red-50',
    borderColor: 'border-red-500',
    iconColor: 'text-red-500',
    emptyMessage: 'Aucune urgence aujourd\'hui',
  },
  {
    key: 'followUps',
    title: 'Relances du jour',
    icon: Clock,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-500',
    iconColor: 'text-amber-500',
    emptyMessage: 'Aucune relance prévue',
  },
  {
    key: 'matches',
    title: 'Matchs trouvés',
    icon: Sparkles,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-500',
    iconColor: 'text-blue-500',
    emptyMessage: 'Aucun nouveau match',
  },
  {
    key: 'visits',
    title: 'Visites à confirmer',
    icon: MapPin,
    bgColor: 'bg-white',
    borderColor: 'border-border',
    iconColor: 'text-primary-500',
    emptyMessage: 'Aucune visite aujourd\'hui',
  },
  {
    key: 'suggestions',
    title: 'Suggestions IA',
    icon: Zap,
    bgColor: 'bg-green-50',
    borderColor: 'border-green-500',
    iconColor: 'text-green-500',
    emptyMessage: 'Aucune suggestion pour le moment',
  },
]

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
  const Icon = config.icon
  const isEmpty = actions.length === 0

  return (
    <div className={cn(
      'rounded-card border-l-4 border shadow-card',
      config.bgColor,
      config.borderColor
    )}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-4 w-4', config.iconColor)} />
          <h2 className="text-sm font-semibold text-primary-900">{config.title}</h2>
          {!isEmpty && (
            <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/80', config.iconColor)}>
              {actions.length}
            </span>
          )}
        </div>
      </div>

      {isEmpty ? (
        <div className="px-4 pb-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            {config.emptyMessage}
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-1">
          {actions.map((action) => (
            <ActionCard
              key={action.id}
              title={action.title}
              description={action.description}
              actionLabel={action.actionLabel}
              actionType={action.actionType}
              onAction={() => {
                // In production: navigate to entity or open communication
              }}
              onComplete={() => onComplete(action.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ActionBoardPage() {
  const { byCategory, totalPending, markAsCompleted, isLoading } = useActionBoard()

  const today = formatDate(new Date())
  const firstName = 'Gregory' // In production: from auth profile

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-accent border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">
            Bonjour {firstName}, voici votre journée
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{today}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full',
            totalPending > 0
              ? 'bg-accent/10 text-accent'
              : 'bg-success/10 text-success'
          )}>
            {totalPending > 0 ? (
              <>{totalPending} action{totalPending > 1 ? 's' : ''} recommandée{totalPending > 1 ? 's' : ''}</>
            ) : (
              <>Tout est à jour</>
            )}
          </span>
        </div>
      </div>

      {/* Sections */}
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
  )
}
