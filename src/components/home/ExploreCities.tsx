import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const CITIES = [
  {
    name: 'Genève',
    canton: 'GE',
    count: 2450,
    imageUrl: 'https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=800&q=80',
    large: true,
  },
  {
    name: 'Lausanne',
    canton: 'VD',
    count: 1820,
    imageUrl: 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=800&q=80',
  },
  {
    name: 'Zurich',
    canton: 'ZH',
    count: 3100,
    imageUrl: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=800&q=80',
  },
  {
    name: 'Bâle',
    canton: 'BS',
    count: 980,
    imageUrl: 'https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?w=800&q=80',
  },
  {
    name: 'Berne',
    canton: 'BE',
    count: 1250,
    imageUrl: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=800&q=80',
  },
  {
    name: 'Lugano',
    canton: 'TI',
    count: 640,
    imageUrl: 'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&q=80',
  },
];

export default function ExploreCities() {
  const { t } = useTranslation('common');

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
          {CITIES.map((city) => (
            <Link
              key={city.name}
              to={`/acheter?canton=${city.canton}`}
              className={`relative rounded-xl overflow-hidden group ${
                city.large ? 'col-span-2 row-span-2 md:col-span-1 md:row-span-2' : ''
              }`}
            >
              <img
                src={city.imageUrl}
                alt={city.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent transition-opacity duration-300 group-hover:from-black/70" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                <div className="flex items-baseline gap-2">
                  <span className="text-white font-bold text-lg">{city.name}</span>
                  <span className="text-white/40 text-xs">{city.canton}</span>
                </div>
                <p className="text-white/50 text-xs mt-1">
                  {city.count.toLocaleString('fr-CH')} biens
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
