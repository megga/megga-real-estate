import type { MarketTemperature } from '@/hooks/useMarketInsights'
import { cn, formatCHF } from '@/lib/utils'
import { Thermometer } from 'lucide-react'

interface MarketTemperatureBadgeProps {
  temperature: MarketTemperature
  compact?: boolean
  className?: string
}

const LABELS = {
  acheteur: { text: 'Marche acheteur', color: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500' },
  equilibre: { text: 'Marche equilibre', color: 'text-amber-600', bg: 'bg-amber-50', bar: 'bg-amber-500' },
  vendeur: { text: 'Marche vendeur', color: 'text-red-500', bg: 'bg-red-50', bar: 'bg-red-500' },
}

export default function MarketTemperatureBadge({ temperature, compact = false, className }: MarketTemperatureBadgeProps) {
  const config = LABELS[temperature.label]

  if (compact) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', config.bg, config.color, className)}>
        <Thermometer className="h-3 w-3" />
        {config.text}
      </span>
    )
  }

  return (
    <div className={cn('rounded-xl border border-gray-100 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Temperature du marche</h4>
        <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full', config.bg, config.color)}>
          <Thermometer className="h-3 w-3" />
          {config.text}
        </span>
      </div>

      {/* Gauge bar */}
      <div className="relative h-2 bg-gray-100 rounded-full mb-3 overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500"
          style={{ width: '100%' }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full border-2 border-gray-900 shadow-sm transition-all"
          style={{ left: `${Math.max(5, Math.min(95, temperature.score))}%`, transform: 'translate(-50%, -50%)' }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500 mb-4">
        <span>Favorable acheteur</span>
        <span>Favorable vendeur</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-lg font-semibold text-gray-900">{temperature.avgDaysOnMarket}j</p>
          <p className="text-xs text-gray-500">Duree moyenne</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{temperature.priceDropPct}%</p>
          <p className="text-xs text-gray-500">Baisses de prix</p>
        </div>
        <div>
          <p className="text-lg font-semibold text-gray-900">{formatCHF(temperature.medianPricePerM2)}</p>
          <p className="text-xs text-gray-500">Mediane /m2</p>
        </div>
      </div>
    </div>
  )
}
