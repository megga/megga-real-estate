import { Heart, Share2, Calculator, Phone, Mail, CalendarDays, User } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface ListingSidebarProps {
  listing: {
    price: number
    charges_monthly: number
    agent: {
      name: string
      agency: string
      phone: string
      email: string
      photo: string
    }
  }
  isFavorite: boolean
  onToggleFavorite: () => void
  onContact: () => void
  onVisit: () => void
  onCalculator: () => void
}

export default function ListingSidebar({
  listing,
  isFavorite,
  onToggleFavorite,
  onContact,
  onVisit,
  onCalculator,
}: ListingSidebarProps) {
  return (
    <div className="hidden lg:block w-[360px] flex-shrink-0">
      <div className="sticky top-28 space-y-4">
        {/* Price + CTA */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {formatCHF(listing.price)}
          </p>
          {listing.charges_monthly > 0 && (
            <p className="text-sm text-gray-500">
              Charges : {formatCHF(listing.charges_monthly)}/mois
            </p>
          )}

          {/* Primary CTA */}
          <button
            onClick={onContact}
            className="w-full h-12 mt-5 flex items-center justify-center gap-2 text-sm font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Contacter l'agent
          </button>

          {/* Secondary CTA */}
          <button
            onClick={onVisit}
            className="w-full h-11 mt-2 flex items-center justify-center gap-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:border-accent hover:text-accent transition-colors"
          >
            <CalendarDays className="h-4 w-4" />
            Planifier une visite
          </button>

          {/* Action row */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-50">
            <button
              onClick={onToggleFavorite}
              className={cn(
                'flex-1 h-10 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                isFavorite
                  ? 'bg-red-50 border-red-200 text-red-500'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
              {isFavorite ? 'Sauvegardé' : 'Sauvegarder'}
            </button>
            <button className="h-10 w-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {/* Calculator */}
          <button
            onClick={onCalculator}
            className="w-full h-10 mt-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-500 hover:text-accent transition-colors"
          >
            <Calculator className="h-4 w-4" />
            Puis-je acheter ce bien ?
          </button>
        </div>

        {/* Agent card */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-3">Votre contact</p>
          <div className="flex items-center gap-3 mb-4">
            {/* Avatar — vraie photo ou initiales */}
            <div className="h-11 w-11 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
              {listing.agent.photo && listing.agent.photo !== '/megga-gg.svg' ? (
                <img
                  src={listing.agent.photo}
                  alt={listing.agent.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-accent/10">
                  <User className="h-5 w-5 text-accent" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{listing.agent.name}</p>
              <p className="text-xs text-gray-500 truncate">{listing.agent.agency}</p>
            </div>
          </div>

          <div className="space-y-2">
            {listing.agent.phone && (
              <a
                href={`tel:${listing.agent.phone}`}
                className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-accent transition-colors group"
              >
                <div className="h-7 w-7 rounded-lg bg-gray-50 group-hover:bg-accent/10 flex items-center justify-center transition-colors flex-shrink-0">
                  <Phone className="h-3.5 w-3.5 text-gray-400 group-hover:text-accent" />
                </div>
                {listing.agent.phone}
              </a>
            )}
            {listing.agent.email && (
              <a
                href={`mailto:${listing.agent.email}`}
                className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-accent transition-colors group"
              >
                <div className="h-7 w-7 rounded-lg bg-gray-50 group-hover:bg-accent/10 flex items-center justify-center transition-colors flex-shrink-0">
                  <Mail className="h-3.5 w-3.5 text-gray-400 group-hover:text-accent" />
                </div>
                <span className="truncate">{listing.agent.email}</span>
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
