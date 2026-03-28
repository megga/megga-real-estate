import { Heart, Phone } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface ListingMobileBarProps {
  price: number
  charges_monthly: number
  isFavorite: boolean
  onToggleFavorite: () => void
  onContact: () => void
}

export default function ListingMobileBar({
  price,
  charges_monthly,
  isFavorite,
  onToggleFavorite,
  onContact,
}: ListingMobileBarProps) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] z-40">
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
              'h-10 w-10 rounded-full border flex items-center justify-center transition-colors',
              isFavorite ? 'bg-red-50 border-red-200 text-red-500' : 'border-gray-200 text-gray-500'
            )}
          >
            <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
          </button>
          <button
            onClick={onContact}
            className="h-10 px-5 bg-accent text-white rounded-full text-sm font-medium flex items-center gap-2 hover:bg-accent/90 transition-colors"
          >
            <Phone className="h-4 w-4" />
            Contacter
          </button>
        </div>
      </div>
    </div>
  )
}
