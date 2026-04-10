import { usePriceHistory } from '@/hooks/useMarketInsights'
import { formatCHF } from '@/lib/utils'
import { TrendingDown, TrendingUp, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PriceHistoryChartProps {
  marketListingId: string
  className?: string
}

export default function PriceHistoryChart({ marketListingId, className }: PriceHistoryChartProps) {
  const { data: points, isLoading } = usePriceHistory(marketListingId)

  if (isLoading) return null
  if (!points || points.length <= 1) return null // No history to show

  const first = points[0]
  const last = points[points.length - 1]
  const totalChange = last.price - first.price
  const totalChangePct = first.price > 0 ? ((totalChange / first.price) * 100) : 0
  const isDown = totalChange < 0
  const isUp = totalChange > 0

  // Calculate chart dimensions
  const prices = points.map(p => p.price)
  const minPrice = Math.min(...prices) * 0.98
  const maxPrice = Math.max(...prices) * 1.02
  const range = maxPrice - minPrice || 1

  // SVG path for the line
  const width = 280
  const height = 60
  const pathPoints = points.map((p, i) => {
    const x = points.length > 1 ? (i / (points.length - 1)) * width : width / 2
    const y = height - ((p.price - minPrice) / range) * height
    return `${x},${y}`
  })
  const linePath = `M ${pathPoints.join(' L ')}`

  return (
    <div className={cn('rounded-xl border border-gray-100 p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-gray-900">Historique du prix</h4>
        <div className={cn(
          'flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full',
          isDown ? 'text-emerald-600 bg-emerald-50' :
          isUp ? 'text-red-500 bg-red-50' :
          'text-gray-500 bg-gray-50'
        )}>
          {isDown ? <TrendingDown className="h-3 w-3" /> :
           isUp ? <TrendingUp className="h-3 w-3" /> :
           <Minus className="h-3 w-3" />}
          {isDown ? '' : '+'}{Math.round(totalChangePct)}%
        </div>
      </div>

      {/* Mini chart */}
      <div className="mb-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-16" preserveAspectRatio="none">
          {/* Gradient fill */}
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={isDown ? '#10b981' : '#6b7280'} stopOpacity="0.15" />
              <stop offset="100%" stopColor={isDown ? '#10b981' : '#6b7280'} stopOpacity="0" />
            </linearGradient>
          </defs>
          {/* Fill area */}
          <path
            d={`${linePath} L ${width},${height} L 0,${height} Z`}
            fill="url(#priceGradient)"
          />
          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={isDown ? '#10b981' : isUp ? '#ef4444' : '#9ca3af'}
            strokeWidth="2"
            strokeLinejoin="round"
          />
          {/* Points */}
          {points.map((p, i) => {
            const x = points.length > 1 ? (i / (points.length - 1)) * width : width / 2
            const y = height - ((p.price - minPrice) / range) * height
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="3"
                fill="white"
                stroke={isDown ? '#10b981' : isUp ? '#ef4444' : '#9ca3af'}
                strokeWidth="1.5"
              />
            )
          })}
        </svg>
      </div>

      {/* Timeline */}
      <div className="space-y-1.5">
        {points.map((p, i) => {
          const date = new Date(p.date)
          const dateStr = date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })
          const isFirst = i === 0
          const isLast = i === points.length - 1
          return (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isLast ? 'bg-accent' : isFirst ? 'bg-gray-300' : isDown ? 'bg-emerald-500' : 'bg-red-400'
                )} />
                <span className="text-gray-500">{dateStr}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('font-medium', isLast ? 'text-gray-900' : 'text-gray-500')}>
                  {formatCHF(p.price)}
                </span>
                {p.changePct !== null && (
                  <span className={cn(
                    'text-xs',
                    p.changePct < 0 ? 'text-emerald-600' : 'text-red-500'
                  )}>
                    {p.changePct < 0 ? '' : '+'}{Math.round(p.changePct)}%
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Source : suivi automatique des annonces publiques
      </p>
    </div>
  )
}
