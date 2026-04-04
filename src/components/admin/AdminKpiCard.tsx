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

const VARIANT_STYLES = {
  default: { bg: 'bg-admin-accent-light', icon: 'text-admin-accent' },
  danger: { bg: 'bg-red-500/10', icon: 'text-red-500' },
  success: { bg: 'bg-emerald-500/10', icon: 'text-emerald-500' },
  blue: { bg: 'bg-blue-500/10', icon: 'text-blue-500' },
}

export default function AdminKpiCard({ label, value, subtitle, icon: Icon, trend, variant = 'default', compact }: AdminKpiCardProps) {
  const styles = VARIANT_STYLES[variant]

  if (compact) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-theme-border px-3.5 py-2.5">
        <div className={cn('h-7 w-7 rounded-md flex items-center justify-center flex-shrink-0', styles.bg)}>
          <Icon className={cn('h-3.5 w-3.5', styles.icon)} />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-theme-primary leading-tight">{value}</p>
          <p className="text-[10px] text-theme-muted leading-tight">{label}</p>
        </div>
        {trend && (
          <span className={cn('text-[10px] font-medium ml-auto flex-shrink-0', trend.value >= 0 ? 'text-emerald-500' : 'text-red-500')}>
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
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', styles.bg)}>
          <Icon className={cn('h-4 w-4', styles.icon)} />
        </div>
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
