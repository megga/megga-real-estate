import { createPortal } from 'react-dom'
import { X, Building2 } from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface CompareDrawerProps {
  listings: ListingCardData[]
  open: boolean
  onClose: () => void
  onRemove: (id: string) => void
}

function formatPriceM2(listing: ListingCardData): string {
  if (listing.price_per_m2 && listing.price_per_m2 > 0) {
    return `CHF ${Math.round(listing.price_per_m2).toLocaleString('fr-CH')}/m²`
  }
  if (listing.surface_m2 > 0) {
    return `CHF ${Math.round(listing.price / listing.surface_m2).toLocaleString('fr-CH')}/m²`
  }
  return '—'
}

const rows: { label: string; render: (l: ListingCardData) => string }[] = [
  { label: 'Prix', render: (l) => formatCHF(l.price) },
  { label: 'Prix/m²', render: formatPriceM2 },
  { label: 'Surface', render: (l) => l.surface_m2 > 0 ? formatSurface(l.surface_m2) : '—' },
  { label: 'Pièces', render: (l) => l.rooms > 0 ? `${l.rooms}` : '—' },
  { label: 'Chambres', render: (l) => l.bedrooms > 0 ? `${l.bedrooms}` : '—' },
  { label: 'Localisation', render: (l) => l.city || '—' },
  { label: 'Type', render: (l) => l.type || '—' },
  { label: 'Jours en ligne', render: (l) => l.days_on_market !== undefined ? `${l.days_on_market}j` : '—' },
]

export default function CompareDrawer({ listings, open, onClose, onRemove }: CompareDrawerProps) {
  if (!open || listings.length === 0) return null

  // Find best value per row for highlighting
  function getBestIndex(rowIdx: number): number | null {
    const row = rows[rowIdx]
    if (!row) return null
    // For price and prix/m2 — lower is better
    if (rowIdx <= 1) {
      let best = Infinity
      let bestIdx = -1
      listings.forEach((l, i) => {
        const val = rowIdx === 0 ? l.price : (l.price_per_m2 || (l.surface_m2 > 0 ? l.price / l.surface_m2 : Infinity))
        if (val < best && val > 0) { best = val; bestIdx = i }
      })
      return bestIdx >= 0 ? bestIdx : null
    }
    // For surface, rooms, bedrooms — higher is better
    if (rowIdx >= 2 && rowIdx <= 4) {
      let best = -1
      let bestIdx = -1
      listings.forEach((l, i) => {
        const val = rowIdx === 2 ? l.surface_m2 : rowIdx === 3 ? l.rooms : l.bedrooms
        if (val > best) { best = val; bestIdx = i }
      })
      return bestIdx >= 0 && best > 0 ? bestIdx : null
    }
    return null
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-xl sm:rounded-xl border border-gray-100 shadow-xl w-full sm:max-w-3xl mx-0 sm:mx-4 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10 rounded-t-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            Comparer {listings.length} bien{listings.length > 1 ? 's' : ''}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Photos row */}
        <div className={cn('grid border-b border-gray-100', listings.length === 2 ? 'grid-cols-2' : 'grid-cols-3')}>
          <div className="p-3 border-r border-gray-100 hidden" /> {/* spacer for labels */}
          {listings.map((l) => {
            const photo = l.photos?.[0]
            return (
              <div key={l.id} className="relative p-3 border-r border-gray-100 last:border-r-0">
                <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                  {photo ? (
                    <img src={photo} alt={l.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Building2 className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-900 mt-2 truncate">{l.address}</p>
                <p className="text-xs text-gray-500 truncate">{l.city}</p>
                <button
                  onClick={() => onRemove(l.id)}
                  className="absolute top-4 right-4 h-6 w-6 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white"
                >
                  <X className="h-3 w-3 text-gray-500" />
                </button>
              </div>
            )
          })}
        </div>

        {/* Comparison table */}
        <div className="divide-y divide-gray-50">
          {rows.map((row, rowIdx) => {
            const bestIdx = getBestIndex(rowIdx)
            return (
              <div
                key={row.label}
                className={cn('grid items-center', listings.length === 2 ? 'grid-cols-[120px_1fr_1fr]' : 'grid-cols-[120px_1fr_1fr_1fr]')}
              >
                <div className="px-4 py-3 text-xs font-medium text-gray-500">{row.label}</div>
                {listings.map((l, i) => (
                  <div
                    key={l.id}
                    className={cn(
                      'px-4 py-3 text-sm',
                      bestIdx === i ? 'text-emerald-600 font-semibold' : 'text-gray-900'
                    )}
                  >
                    {row.render(l)}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
