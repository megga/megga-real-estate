import { Heart } from 'lucide-react';
import { cn, formatCHF } from '@/lib/utils';

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    price: number;
    address: string;
    rooms: number;
    bedrooms: number;
    surface: number;
    imageUrl: string;
    isHot?: boolean;
  };
  className?: string;
}

export default function ListingCard({ listing, className }: ListingCardProps) {
  return (
    <div className={cn('bg-white rounded-[var(--radius-card)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-200 overflow-hidden group', className)}>
      {/* Photo */}
      <div className="relative aspect-[4/3] overflow-hidden">
        <img
          src={listing.imageUrl}
          alt={listing.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <button className="absolute top-3 right-3 w-9 h-9 bg-white/80 backdrop-blur rounded-full flex items-center justify-center hover:bg-white transition cursor-pointer">
          <Heart className="w-4 h-4 text-gray-600" />
        </button>
        {listing.isHot && (
          <span className="absolute top-3 left-3 bg-danger text-white text-xs font-medium px-2 py-0.5 rounded-[var(--radius-badge)]">
            Hot price
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold text-gray-900">{formatCHF(listing.price)}</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{listing.address}</p>
        <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-400">
          <span>{listing.rooms} pièces</span>
          <span>·</span>
          <span>{listing.bedrooms} ch.</span>
          <span>·</span>
          <span>{listing.surface} m²</span>
        </div>
      </div>
    </div>
  );
}
