import ListingCard from './ListingCard'
import type { ListingCardData } from './ListingCard'
import { cn } from '@/lib/utils'

interface ListingGridProps {
  listings: ListingCardData[]
  className?: string
}

export default function ListingGrid({ listings, className }: ListingGridProps) {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6', className)}>
      {listings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  )
}
