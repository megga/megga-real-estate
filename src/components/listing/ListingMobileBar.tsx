import { Heart, Phone, User } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface ListingMobileBarProps {
  price: number
  charges_monthly: number
  isFavorite: boolean
  onToggleFavorite: () => void
  onContact: () => void
  agent?: { name: string; photo: string }
}

export default function ListingMobileBar({
  price,
  charges_monthly,
  isFavorite,
  onToggleFavorite,
  onContact,
  agent,
}: ListingMobileBarProps) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-40">
      {/* Agent preview */}
      {agent && (
        <div className="flex items-center gap-2 border-t border-gray-100 pt-2 mb-2">
          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
            {agent.photo && agent.photo !== '/megga-gg.svg' ? (
              <img src={agent.photo} alt={agent.name} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center bg-accent/10">
                <User className="h-3 w-3 text-accent" />
              </div>
            )}
          </div>
          <p className="text-xs font-medium text-gray-900 truncate">{agent.name}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-gray-900">{formatCHF(price)}</p>
          {charges_monthly > 0 && (
            <p className="text-xs text-gray-500">Charges : {formatCHF(charges_monthly)}/mois</p>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onToggleFavorite}
            className={cn(
              'h-10 w-10 rounded-lg border flex items-center justify-center transition-colors',
              isFavorite ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-500'
            )}
          >
            <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
          </button>
          <button
            onClick={onContact}
            className="h-10 px-5 border border-gray-200 text-gray-900 rounded-lg text-sm font-medium flex items-center gap-2 hover:border-accent hover:text-accent transition-colors"
          >
            <Phone className="h-4 w-4" />
            Contacter
          </button>
        </div>
      </div>
    </div>
  )
}
