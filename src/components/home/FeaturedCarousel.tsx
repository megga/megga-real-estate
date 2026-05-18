import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Heart } from 'lucide-react';
import Shimmer from '@/components/ui/Shimmer';
import { cn, formatCHF } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

interface FeaturedListing {
  id: string;
  title: string;
  price: number;
  address: string;
  rooms: number;
  bedrooms: number;
  surface: number;
  imageUrl: string | null;
  badge?: string;
  transaction_type: 'buy' | 'rent';
}

function pickBadge(row: Record<string, unknown>): string | undefined {
  if (row.status === 'price_reduced') return 'Baisse de prix';
  const seen = (row.first_seen_at as string) || (row.created_at as string);
  if (seen) {
    const ageH = (Date.now() - new Date(seen).getTime()) / 3_600_000;
    if (ageH < 48) return 'Nouveau';
  }
  return undefined;
}

function useFeaturedListings() {
  return useQuery({
    queryKey: ['home-featured-listings'],
    queryFn: async (): Promise<FeaturedListing[]> => {
      // Prefer recently price-reduced rows (anchored by status, surfaced first),
      // fall back to the most recent additions. Both queries run against the
      // partial indexes that already cover status/quality, so each tops out at
      // <100ms even for the rent dataset.
      const baseSelect =
        'id, title, price, current_price, address, city, postal_code, rooms, bedrooms, surface_m2, photos, status, first_seen_at, created_at, transaction_type';

      const [reducedRes, recentRes] = await Promise.all([
        supabase
          .from('market_listings')
          .select(baseSelect)
          .eq('status', 'price_reduced')
          .gte('quality_score', 50)
          .gt('price', 0)
          .not('photos', 'is', null)
          .order('first_seen_at', { ascending: false })
          .limit(6),
        supabase
          .from('market_listings')
          .select(baseSelect)
          .eq('status', 'active')
          .gte('quality_score', 50)
          .gt('price', 0)
          .not('photos', 'is', null)
          .order('first_seen_at', { ascending: false })
          .limit(6),
      ]);

      const seen = new Set<string>();
      const merged: Array<Record<string, unknown>> = [];
      for (const row of (reducedRes.data ?? [])) {
        if (!seen.has(row.id as string)) {
          seen.add(row.id as string);
          merged.push(row);
        }
      }
      for (const row of (recentRes.data ?? [])) {
        if (merged.length >= 6) break;
        if (!seen.has(row.id as string)) {
          seen.add(row.id as string);
          merged.push(row);
        }
      }

      return merged
        .filter(r => Array.isArray(r.photos) && (r.photos as string[]).length > 0)
        .slice(0, 6)
        .map(r => ({
          id: r.id as string,
          title: (r.title as string) || 'Bien immobilier',
          price: Number(r.current_price ?? r.price ?? 0),
          address:
            [r.address, [r.postal_code, r.city].filter(Boolean).join(' ')]
              .filter(Boolean)
              .join(', ') ||
            (r.city as string) ||
            '',
          rooms: Number(r.rooms) || 0,
          bedrooms: Number(r.bedrooms) || 0,
          surface: Number(r.surface_m2) || 0,
          imageUrl: (r.photos as string[])[0] ?? null,
          badge: pickBadge(r),
          transaction_type: (r.transaction_type as 'buy' | 'rent') || 'buy',
        }));
    },
    staleTime: 5 * 60 * 1000,
  });
}

export default function FeaturedCarousel() {
  const { t } = useTranslation('common');
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const { data: listings, isLoading } = useFeaturedListings();

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
  }, [listings]);

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;
    const cardWidth = el.querySelector('div')?.offsetWidth ?? 340;
    el.scrollBy({ left: direction === 'left' ? -cardWidth - 20 : cardWidth + 20, behavior: 'smooth' });
  }

  const visible = listings ?? [];

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
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="snap-start shrink-0 w-[300px] md:w-[340px] rounded-xl border border-gray-100 overflow-hidden"
                >
                  <Shimmer className="aspect-[4/3]" />
                  <div className="p-4 space-y-2">
                    <Shimmer className="h-5 w-1/3 rounded" />
                    <Shimmer className="h-4 w-2/3 rounded" />
                    <Shimmer className="h-3 w-1/2 rounded" />
                  </div>
                </div>
              ))
            : visible.map((listing) => {
                const route = listing.transaction_type === 'rent' ? 'louer' : 'acheter';
                return (
                  <Link
                    key={listing.id}
                    to={`/${route}?listing=market-${listing.id}`}
                    className="snap-start shrink-0 w-[300px] md:w-[340px] rounded-xl border border-gray-100 overflow-hidden group transition-all duration-300 hover:-translate-y-1 hover:border-gray-200"
                  >
                    {/* Photo */}
                    <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
                      {listing.imageUrl && (
                        <img
                          src={listing.imageUrl}
                          alt={listing.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          loading="lazy"
                          decoding="async"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <button
                        type="button"
                        aria-label="Ajouter aux favoris"
                        onClick={(e) => e.preventDefault()}
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
                        <span className="text-lg font-bold text-gray-900">
                          {formatCHF(listing.price)}
                          {listing.transaction_type === 'rent' && (
                            <span className="text-xs font-medium text-gray-400 ml-1">/mois</span>
                          )}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 truncate">{listing.address}</p>
                      <div className="flex items-center gap-1.5 mt-2.5 text-xs text-gray-500">
                        {listing.rooms > 0 && <span>{listing.rooms} pièces</span>}
                        {listing.rooms > 0 && listing.bedrooms > 0 && <span className="text-gray-300">·</span>}
                        {listing.bedrooms > 0 && <span>{listing.bedrooms} ch</span>}
                        {(listing.rooms > 0 || listing.bedrooms > 0) && listing.surface > 0 && (
                          <span className="text-gray-300">·</span>
                        )}
                        {listing.surface > 0 && <span>{listing.surface} m²</span>}
                      </div>
                    </div>
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
