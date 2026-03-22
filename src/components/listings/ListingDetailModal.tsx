import { X, MapPin, Ruler, DoorOpen, Calendar, Eye } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import ObjectionAnalysis, { MOCK_OBJECTION_DATA } from '@/components/ai-copilot/ObjectionAnalysis'

interface ListingDetailModalProps {
  listing: {
    id: string
    title: string
    price: number
    address: string
    city: string
    canton: string
    rooms: number
    surface: number
    type: string
    status: string
    created_at: string
    views?: number
    favorites?: number
  }
  onClose: () => void
}

const statusLabels: Record<string, { label: string; color: string }> = {
  active: { label: 'Actif', color: 'text-success' },
  draft: { label: 'Brouillon', color: 'text-theme-tertiary' },
  reserved: { label: 'Réservé', color: 'text-warning' },
  sold: { label: 'Vendu', color: 'text-accent' },
  archived: { label: 'Archivé', color: 'text-theme-muted' },
}

export default function ListingDetailModal({ listing, onClose }: ListingDetailModalProps) {
  const status = statusLabels[listing.status] || { label: listing.status, color: 'text-theme-secondary' }
  // Mock: show objection analysis for active listings
  const showObjections = listing.status === 'active'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-theme-card rounded-xl border border-theme-border w-full max-w-lg max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-theme-border">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-theme-primary truncate">{listing.title}</h3>
              <span className={cn('text-xs font-medium', status.color)}>{status.label}</span>
            </div>
            <p className="text-lg font-bold text-theme-primary mt-1">{formatCHF(listing.price)}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-theme-hover transition-colors ml-3"
          >
            <X className="w-4 h-4 text-theme-tertiary" />
          </button>
        </div>

        {/* Details */}
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-primary">{listing.address}, {listing.city} ({listing.canton})</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Ruler className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-secondary">Surface</span>
            <span className="ml-auto text-theme-primary">{listing.surface} m²</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <DoorOpen className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-secondary">Pièces</span>
            <span className="ml-auto text-theme-primary">{listing.rooms}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="w-4 h-4 text-theme-tertiary shrink-0" />
            <span className="text-theme-secondary">Publié le</span>
            <span className="ml-auto text-theme-tertiary">{listing.created_at}</span>
          </div>
          {(listing.views !== undefined || listing.favorites !== undefined) && (
            <div className="flex items-center gap-3 text-sm">
              <Eye className="w-4 h-4 text-theme-tertiary shrink-0" />
              <span className="text-theme-secondary">Stats</span>
              <span className="ml-auto text-theme-tertiary">
                {listing.views ?? 0} vues · {listing.favorites ?? 0} favoris
              </span>
            </div>
          )}
        </div>

        {/* Objection Analysis */}
        {showObjections && (
          <div className="px-5 pb-5">
            <ObjectionAnalysis
              totalVisits={MOCK_OBJECTION_DATA.totalVisits}
              objections={MOCK_OBJECTION_DATA.objections}
              weaknesses={MOCK_OBJECTION_DATA.weaknesses}
              suggestions={MOCK_OBJECTION_DATA.suggestions}
            />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center gap-3 p-5 border-t border-theme-border">
          <a
            href={`/dashboard/listings/${listing.id}/edit`}
            className={cn(
              'flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border',
              'text-theme-secondary hover:text-theme-primary hover:border-theme-active',
              'transition-colors flex items-center justify-center'
            )}
          >
            Éditer
          </a>
          <button
            onClick={onClose}
            className={cn(
              'flex-1 h-9 rounded-lg text-sm font-medium border border-theme-border',
              'text-theme-secondary hover:text-theme-primary hover:border-theme-active',
              'transition-colors'
            )}
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  )
}
