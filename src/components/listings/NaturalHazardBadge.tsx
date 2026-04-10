import { useNaturalHazards, HAZARD_LABELS } from '@/hooks/useNaturalHazards'
import type { NaturalHazardResult } from '@/hooks/useNaturalHazards'
import { cn } from '@/lib/utils'
import { ShieldCheck, AlertTriangle, Droplets, Mountain, Snowflake } from 'lucide-react'

interface NaturalHazardBadgeProps {
  lat?: number
  lng?: number
  compact?: boolean
  className?: string
}

function HazardLine({ label, level, icon: Icon }: {
  label: string
  level: NaturalHazardResult['flood']
  icon: React.ElementType
}) {
  const colors = {
    none: 'text-emerald-600',
    low: 'text-amber-500',
    medium: 'text-orange-500',
    high: 'text-red-500',
  }
  const dots = { none: 'bg-emerald-500', low: 'bg-amber-500', medium: 'bg-orange-500', high: 'bg-red-500' }

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-xs text-gray-600">
        <Icon className="h-3.5 w-3.5 text-gray-500" />
        {label}
      </div>
      <div className="flex items-center gap-1.5">
        <div className={cn('w-1.5 h-1.5 rounded-full', dots[level])} />
        <span className={cn('text-xs font-medium', colors[level])}>
          {HAZARD_LABELS[level]}
        </span>
      </div>
    </div>
  )
}

export default function NaturalHazardBadge({ lat, lng, compact = false, className }: NaturalHazardBadgeProps) {
  const { data: hazards, isLoading } = useNaturalHazards(lat, lng)

  if (isLoading || !hazards) return null

  const isSafe = hazards.safeScore >= 80

  if (compact) {
    return (
      <span className={cn(
        'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
        isSafe ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50',
        className
      )}>
        {isSafe ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
        {isSafe ? 'Zone sure' : 'Risques a verifier'}
      </span>
    )
  }

  return (
    <div className={cn('rounded-xl border border-gray-100 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Risques naturels</h4>
        <span className={cn(
          'inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
          isSafe ? 'text-emerald-600 bg-emerald-50' : 'text-amber-600 bg-amber-50'
        )}>
          {isSafe ? <ShieldCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
          {hazards.safeScore}/100
        </span>
      </div>

      <div className="space-y-2">
        <HazardLine label="Inondation" level={hazards.flood} icon={Droplets} />
        <HazardLine label="Glissement" level={hazards.landslide} icon={Mountain} />
        <HazardLine label="Avalanche" level={hazards.avalanche} icon={Snowflake} />
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Source : Office federal de l'environnement (OFEV)
      </p>
    </div>
  )
}
