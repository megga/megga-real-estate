/** Carte KPI réutilisable de la section super-admin (accent violet). */
import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface AdminKpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'danger' | 'success' | 'blue'
  compact?: boolean
}

const VARIANT_ICON = {
  default: 'text-theme-tertiary',
  danger: 'text-red-500',
  success: 'text-emerald-500',
  blue: 'text-blue-500',
}

/** Indicateur : icône colorée par `variant`, valeur, sous-titre et tendance +/−. `compact` = version ligne dense. */
export default function AdminKpiCard({ label, value, subtitle, icon: Icon, trend, variant = 'default', compact }: AdminKpiCardProps) {
  const iconColor = VARIANT_ICON[variant]

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-theme-border px-3.5 py-2.5">
        <Icon className={cn('h-4 w-4 flex-shrink-0', iconColor)} />
        <div className="min-w-0">
          <p className="text-lg font-bold text-theme-primary leading-tight">{value}</p>
          <p className="text-xs text-theme-muted leading-tight">{label}</p>
        </div>
        {trend && (
          <span className={cn('text-xs font-medium ml-auto flex-shrink-0', trend.value >= 0 ? 'text-emerald-500' : 'text-red-500')}>
            {trend.value >= 0 ? '+' : ''}{trend.value}
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-theme-secondary tracking-wide">{label}</span>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <p className="text-2xl font-bold text-theme-primary">{value}</p>
      {subtitle && <p className="text-xs text-theme-secondary mt-1">{subtitle}</p>}
      {trend && (
        <p className={cn('text-xs font-medium mt-1', trend.value >= 0 ? 'text-emerald-500' : 'text-red-500')}>
          {trend.value >= 0 ? '+' : ''}{trend.value} {trend.label}
        </p>
      )}
    </div>
  )
}
