import { cn } from '@/lib/utils'

type BadgeVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger'

interface PageHeaderProps {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  badge?: { label: string; variant: BadgeVariant }
}

const badgeStyles: Record<BadgeVariant, string> = {
  default: 'bg-theme-active text-theme-secondary',
  accent: 'bg-accent/10 text-accent',
  success: 'bg-success-light text-success-dark',
  warning: 'bg-warning-light text-warning-dark',
  danger: 'bg-danger-light text-danger-dark',
}

export default function PageHeader({ title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold text-theme-primary leading-tight">{title}</h1>
          {badge && (
            <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', badgeStyles[badge.variant])}>
              {badge.label}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-sm text-theme-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
