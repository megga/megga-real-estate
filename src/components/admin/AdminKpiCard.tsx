import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface AdminKpiCardProps {
  label: string
  value: string | number
  subtitle?: string
  icon: LucideIcon
  trend?: { value: number; label: string }
  variant?: 'default' | 'danger'
}

export default function AdminKpiCard({ label, value, subtitle, icon: Icon, trend, variant = 'default' }: AdminKpiCardProps) {
  return (
    <div className="rounded-xl border border-theme-border p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-theme-secondary uppercase tracking-wide">{label}</span>
        <div className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center',
          variant === 'danger' ? 'bg-red-500/10' : 'bg-admin-accent-light'
        )}>
          <Icon className={cn(
            'h-4 w-4',
            variant === 'danger' ? 'text-red-500' : 'text-admin-accent'
          )} />
        </div>
      </div>
      <p className="text-2xl font-bold text-theme-primary">{value}</p>
      {subtitle && <p className="text-xs text-theme-secondary mt-1">{subtitle}</p>}
      {trend && (
        <p className={cn(
          'text-xs font-medium mt-1',
          trend.value >= 0 ? 'text-emerald-500' : 'text-red-500'
        )}>
          {trend.value >= 0 ? '+' : ''}{trend.value} {trend.label}
        </p>
      )}
    </div>
  )
}
