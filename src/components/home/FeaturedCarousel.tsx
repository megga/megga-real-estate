import { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import { cn, formatCHF } from '@/lib/utils';

interface FeaturedListing {
  id: string;
  title: string;
  price: number;
  address: string;
  rooms: number;
  bedrooms: number;
  surface: number;
  imageUrl: string;
  isHot?: boolean;
  badge?: string;
}

const FEATURED: FeaturedListing[] = [
  {
    id: '1',
    title: 'Appartement lumineux Champel',
    price: 1250000,
    address: 'Rue de Champel 15, 1206 Genève',
    rooms: 4,
    bedrooms: 2,
    surface: 95,
    imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80',
    isHot: true,
  },
  {
    id: '2',
    title: 'Villa contemporaine Cologny',
    price: 3950000,
    address: 'Chemin de Ruth 8, 1223 Cologny',
    rooms: 7,
    bedrooms: 4,
    surface: 280,
    imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80',
    badge: 'Exclusif',
  },
  {
    id: '3',
    title: 'Loft rénové Plainpalais',
    price: 890000,
    address: 'Rue de Carouge 42, 1205 Genève',
    rooms: 3,
    bedrooms: 1,
    surface: 78,
    imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80',
    badge: 'Nouveau',
  },
  {
    id: '4',
    title: 'Penthouse vue lac',
    price: 2750000,
    address: 'Quai du Mont-Blanc 3, 1201 Genève',
    rooms: 5,
    bedrooms: 3,
    surface: 160,
    imageUrl: 'https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?w=800&q=80',
    isHot: true,
  },
  {
    id: '5',
    title: 'Appartement familial Eaux-Vives',
    price: 1580000,
    address: 'Rue du Lac 27, 1207 Genève',
    rooms: 5,
    bedrooms: 3,
    surface: 120,
    imageUrl: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=800&q=80',
  },
  {
    id: '6',
    title: 'Studio design Pâquis',
    price: 485000,
    address: 'Rue de Berne 12, 1201 Genève',
    rooms: 2,
    bedrooms: 1,
    surface: 42,
    imageUrl: 'https://images.unsplash.com/photo-1600573472592-401b489a3cdc?w=800&q=80',
    badge: 'Nouveau',
  },
];

export default function FeaturedCarousel() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState, { passive: true });
    updateScrollState();
    return () => el.removeEventListener('scroll', updateScrollState);
  }, []);

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('div')?.offsetWidth ?? 340;
    el.scrollBy({ left: direction === 'left' ? -cardWidth - 24 : cardWidth + 24, behavior: 'smooth' });
  }

  return (
    <section className="pt-16 pb-16 md:pt-20 md:pb-24">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
              Biens en vedette
            </h2>
            <p className="text-gray-500 mt-2">
              Découvrez notre sélection de biens d&apos;exception en Suisse
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                'w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center transition-all cursor-pointer',
                canScrollLeft ? 'hover:bg-gray-50 hover:border-gray-300 text-gray-700' : 'opacity-30 cursor-default'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                'w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center transition-all cursor-pointer',
                canScrollRight ? 'hover:bg-gray-50 hover:border-gray-300 text-gray-700' : 'opacity-30 cursor-default'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="mt-8 flex gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-2"
          style={{ scrollPaddingLeft: '0px' }}
        >
          {FEATURED.map((listing) => (
            <div
              key={listing.id}
              className="snap-start shrink-0 w-[300px] md:w-[340px] bg-white rounded-[var(--radius-card)] shadow-[var(--shadow-card)] hover:shadow-[var(--shadow-card-hover)] transition-shadow duration-200 overflow-hidden group cursor-pointer"
            >
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
                {listing.badge && !listing.isHot && (
                  <span className="absolute top-3 left-3 bg-accent text-white text-xs font-medium px-2 py-0.5 rounded-[var(--radius-badge)]">
                    {listing.badge}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <span className="text-xl font-bold text-gray-900">{formatCHF(listing.price)}</span>
                <p className="text-sm text-gray-500 mt-1 truncate">{listing.address}</p>
                <div className="flex items-center gap-1.5 mt-2 text-sm text-gray-400">
                  <span>{listing.rooms} pièces</span>
                  <span>·</span>
                  <span>{listing.bedrooms} ch.</span>
                  <span>·</span>
                  <span>{listing.surface} m²</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
