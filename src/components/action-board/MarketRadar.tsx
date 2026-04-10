import { useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCHF } from '@/lib/utils'
import { useMarketRadar } from '@/hooks/useScoreEngine'

const CHANGE_CONFIG = {
  new: { label: 'Nouveau', dot: 'bg-emerald-500', text: 'text-emerald-500' },
  price_drop: { label: 'Baisse', dot: 'bg-blue-500', text: 'text-blue-500' },
  price_increase: { label: 'Hausse', dot: 'bg-amber-500', text: 'text-amber-500' },
  removed: { label: 'Retiré', dot: 'bg-theme-muted', text: 'text-theme-muted' },
  relisted: { label: 'Remis', dot: 'bg-purple-500', text: 'text-purple-500' },
}

export default function MarketRadar() {
  const { changes, newListings, priceDrops, removed, isLoading, totalChanges } = useMarketRadar(30)
  const [expanded, setExpanded] = useState(false)

  if (isLoading || totalChanges === 0) return null

  const shown = expanded ? changes : changes.slice(0, 6)

  return (
    <div className="rounded-xl border border-theme-border p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-theme-primary">Radar marché</h3>
        <div className="flex items-center gap-3 text-xs">
          {newListings.length > 0 && <span className="text-emerald-500 font-medium">{newListings.length} nouveaux</span>}
          {priceDrops.length > 0 && <span className="text-blue-500 font-medium">{priceDrops.length} baisses</span>}
          {removed.length > 0 && <span className="text-theme-muted">{removed.length} retirés</span>}
        </div>
      </div>

      {/* Changes list */}
      <div className="space-y-1">
        {shown.map(change => {
          const config = CHANGE_CONFIG[change.change_type]
          return (
            <div key={change.id} className="flex items-center gap-2.5 py-1.5">
              <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', config.dot)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-theme-primary truncate">
                  {change.listing_title || `${change.listing_type} ${change.listing_rooms ?? ''}p`}
                </p>
                <p className="text-xs text-theme-tertiary truncate">
                  {change.listing_city}{change.listing_canton ? ` (${change.listing_canton})` : ''}
                  {change.new_price ? ` — ${formatCHF(change.new_price)}` : ''}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className={cn('text-xs font-medium', config.text)}>{config.label}</span>
                {change.change_pct != null && change.change_pct !== 0 && (
                  <p className={cn('text-xs', change.change_pct < 0 ? 'text-blue-500' : 'text-amber-500')}>
                    {change.change_pct > 0 ? '+' : ''}{change.change_pct}%
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {totalChanges > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-xs font-medium text-theme-tertiary hover:text-theme-primary mt-2 py-1 transition-colors"
        >
          {expanded ? 'Voir moins' : `Voir les ${totalChanges - 6} autres`}
        </button>
      )}
    </div>
  )
}
