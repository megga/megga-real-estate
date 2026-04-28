import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface CityCard {
  name: string;
  canton: string;
  large?: boolean;
  // Subtle theme — we no longer ship third-party stock imagery for these
  // tiles. Each city gets a deterministic muted-gradient background so the
  // grid still has visual rhythm without leaning on Unsplash placeholders.
  gradient: string;
}

const CITIES: CityCard[] = [
  { name: 'Genève', canton: 'GE', large: true, gradient: 'from-slate-700 via-slate-800 to-slate-900' },
  { name: 'Lausanne', canton: 'VD', gradient: 'from-stone-600 via-stone-700 to-stone-900' },
  { name: 'Zurich', canton: 'ZH', gradient: 'from-zinc-700 via-zinc-800 to-zinc-950' },
  { name: 'Bâle', canton: 'BS', gradient: 'from-neutral-600 via-neutral-700 to-neutral-900' },
  { name: 'Berne', canton: 'BE', gradient: 'from-gray-700 via-gray-800 to-gray-950' },
  { name: 'Lugano', canton: 'TI', gradient: 'from-stone-700 via-stone-800 to-neutral-900' },
];

function useCantonCounts() {
  return useQuery({
    queryKey: ['home-canton-counts', 'buy'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('count_market_by_canton', { p_context: 'buy' });
      if (error) throw error;
      const map = new Map<string, number>();
      for (const row of (data ?? []) as Array<{ canton: string; count: number }>) {
        map.set(row.canton, Number(row.count) || 0);
      }
      return map;
    },
    staleTime: 30 * 60 * 1000,
  });
}

export default function ExploreCities() {
  const { t } = useTranslation('common');
  const { data: counts } = useCantonCounts();

  return (
    <section className="py-14 md:py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
          {t('home.exploreCities', 'Explorer par ville')}
        </h2>
        <p className="text-sm text-gray-400 mt-2">
          {t('home.exploreCitiesSubtitle', 'Parcourez les biens disponibles dans les principales villes suisses')}
        </p>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 auto-rows-[140px] md:auto-rows-[180px]">
          {CITIES.map((city) => {
            const count = counts?.get(city.canton);
            return (
              <Link
                key={city.name}
                to={`/acheter?canton=${city.canton}`}
                className={`relative rounded-xl overflow-hidden group bg-gradient-to-br ${city.gradient} ${
                  city.large ? 'col-span-2 row-span-2 md:col-span-1 md:row-span-2' : ''
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/0 to-transparent transition-opacity duration-300 group-hover:from-black/55" />
                <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-white font-bold text-lg">{city.name}</span>
                    <span className="text-white/40 text-xs">{city.canton}</span>
                  </div>
                  <p className="text-white/60 text-xs mt-1">
                    {count !== undefined
                      ? `${count.toLocaleString('fr-CH')} biens`
                      : '—'}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
