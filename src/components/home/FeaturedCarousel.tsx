import { useRef, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
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
    badge: 'Hot price',
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
  const { t } = useTranslation('common');
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
    el.scrollBy({ left: direction === 'left' ? -cardWidth - 20 : cardWidth + 20, behavior: 'smooth' });
  }

  return (
    <section className="pt-16 pb-12 md:pt-20 md:pb-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t('home.featuredProperties')}
            </h2>
            <p className="text-gray-400 text-sm mt-2">
              {t('home.featuredSubtitle')}
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Précédent"
              className={cn(
                'w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center transition-all cursor-pointer',
                canScrollLeft ? 'hover:border-gray-400 text-gray-600' : 'opacity-20 cursor-default'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Suivant"
              className={cn(
                'w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center transition-all cursor-pointer',
                canScrollRight ? 'hover:border-gray-400 text-gray-600' : 'opacity-20 cursor-default'
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
        >
          {FEATURED.map((listing) => (
            <div
              key={listing.id}
              className="snap-start shrink-0 w-[300px] md:w-[340px] rounded-xl border border-gray-100 overflow-hidden group cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:border-gray-200"
            >
              {/* Photo */}
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={listing.imageUrl}
                  alt={listing.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                  decoding="async"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <button
                  aria-label="Ajouter aux favoris"
                  className="absolute top-3 right-3 w-8 h-8 bg-white/70 backdrop-blur-sm rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 hover:bg-white cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 text-gray-700" />
                </button>
                {listing.badge && (
                  <span className="absolute top-3 left-3 text-xs font-medium text-white bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    {listing.badge}
                  </span>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-gray-900">{formatCHF(listing.price)}</span>
                </div>
                <p className="text-sm text-gray-400 mt-1 truncate">{listing.address}</p>
                <div className="flex items-center gap-1.5 mt-2.5 text-xs text-gray-500">
                  <span>{listing.rooms} pièces</span>
                  <span className="text-gray-300">·</span>
                  <span>{listing.bedrooms} ch</span>
                  <span className="text-gray-300">·</span>
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
