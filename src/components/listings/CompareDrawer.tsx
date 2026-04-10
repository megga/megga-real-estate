import { useState } from 'react'
import { X, Building2, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn, formatCHF, formatSurface } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
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

const TYPE_LABELS: Record<string, string> = {
  apartment: 'Appartement', house: 'Maison', villa: 'Villa',
  commercial: 'Commercial', land: 'Terrain', flat: 'Appartement',
}

// Row definitions with highlight mode: 'lower' = lower is better, 'higher' = higher is better, 'none' = no highlight
interface CompareRow {
  label: string
  render: (l: ListingCardData) => string
  getValue?: (l: ListingCardData) => number
  highlight: 'lower' | 'higher' | 'none'
}

const rows: CompareRow[] = [
  { label: 'Prix', render: (l) => formatCHF(l.price), getValue: (l) => l.price, highlight: 'lower' },
  { label: 'Prix/m²', render: formatPriceM2, getValue: (l) => l.price_per_m2 || (l.surface_m2 > 0 ? l.price / l.surface_m2 : Infinity), highlight: 'lower' },
  { label: 'Surface', render: (l) => l.surface_m2 > 0 ? formatSurface(l.surface_m2) : '—', getValue: (l) => l.surface_m2, highlight: 'higher' },
  { label: 'Pièces', render: (l) => l.rooms > 0 ? `${l.rooms}` : '—', getValue: (l) => l.rooms, highlight: 'higher' },
  { label: 'Chambres', render: (l) => l.bedrooms > 0 ? `${l.bedrooms}` : '—', getValue: (l) => l.bedrooms, highlight: 'higher' },
  { label: 'Localisation', render: (l) => [l.city, l.canton].filter(Boolean).join(', ') || '—', highlight: 'none' },
  { label: 'Type', render: (l) => TYPE_LABELS[l.type || ''] || l.type || '—', highlight: 'none' },
  { label: 'Jours en ligne', render: (l) => l.days_on_market !== undefined ? `${l.days_on_market}j` : '—', getValue: (l) => l.days_on_market ?? Infinity, highlight: 'lower' },
  { label: 'Description', render: (l) => l.description ? (l.description.length > 80 ? l.description.slice(0, 80) + '...' : l.description) : '—', highlight: 'none' },
]

// ─── Photo carousel for a single listing ───

function PhotoCarousel({ photos, title }: { photos: string[]; title: string }) {
  const [idx, setIdx] = useState(0)
  const count = photos.length

  if (count === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <Building2 className="h-8 w-8 text-gray-500" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full group">
      <img src={photos[idx]} alt={title} className="w-full h-full object-cover" decoding="async" />
      {count > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => i > 0 ? i - 1 : count - 1) }}
            className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setIdx(i => i < count - 1 ? i + 1 : 0) }}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full bg-black/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
          <span className="absolute bottom-1.5 right-1.5 text-xs font-medium bg-black/50 text-white px-1.5 py-0.5 rounded-full">
            {idx + 1}/{count}
          </span>
        </>
      )}
    </div>
  )
}

// ─── Main drawer ───

export default function CompareDrawer({ listings, open, onClose, onRemove }: CompareDrawerProps) {
  if (listings.length === 0) return null

  // Find best value per row for highlighting
  function getBestIndex(row: CompareRow): number | null {
    if (row.highlight === 'none' || !row.getValue) return null
    const values = listings.map(l => row.getValue!(l))
    if (row.highlight === 'lower') {
      let best = Infinity, bestIdx = -1
      values.forEach((v, i) => { if (v < best && v > 0 && isFinite(v)) { best = v; bestIdx = i } })
      return bestIdx >= 0 ? bestIdx : null
    }
    // higher
    let best = -1, bestIdx = -1
    values.forEach((v, i) => { if (v > best) { best = v; bestIdx = i } })
    return bestIdx >= 0 && best > 0 ? bestIdx : null
  }

  const gridCols = listings.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
  const gridColsWithLabel = listings.length === 2 ? 'grid-cols-[120px_1fr_1fr]' : 'grid-cols-[120px_1fr_1fr_1fr]'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Comparer ${listings.length} bien${listings.length > 1 ? 's' : ''}`}
      size="lg"
      contentClassName="scrollbar-hide"
      ariaLabel={`Comparer ${listings.length} biens`}
    >
      <>
        {/* Photos row with carousel */}
        <div className={cn('grid border-b border-gray-100', gridCols)}>
          {listings.map((l) => (
            <div key={l.id} className="relative p-3 border-r border-gray-100 last:border-r-0">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-gray-100">
                <PhotoCarousel photos={l.photos || []} title={l.title} />
              </div>
              <p className="text-xs font-medium text-gray-900 mt-2 truncate">{l.address}</p>
              <p className="text-xs text-gray-500 truncate">{l.city}{l.canton ? ` (${l.canton})` : ''}</p>
              <button
                onClick={() => onRemove(l.id)}
                className="absolute top-4 right-4 h-6 w-6 bg-white/90 rounded-full flex items-center justify-center shadow-sm hover:bg-white"
                aria-label={`Retirer ${l.address} de la comparaison`}
              >
                <X className="h-3 w-3 text-gray-500" />
              </button>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="divide-y divide-gray-50">
          {rows.map((row) => {
            const bestIdx = getBestIndex(row)
            return (
              <div key={row.label} className={cn('grid items-center', gridColsWithLabel)}>
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
      </>
    </Modal>
  )
}
