import { MapPin } from 'lucide-react';

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
  return (
    <section className="py-12 md:py-16">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
          Explorer par ville
        </h2>
        <p className="text-gray-500 mt-2">
          Parcourez les biens disponibles dans les principales villes suisses
        </p>

        <div className="mt-8 grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 auto-rows-[160px] md:auto-rows-[180px]">
          {CITIES.map((city) => (
            <a
              key={city.name}
              href={`/search?city=${city.name}`}
              className={`relative rounded-2xl overflow-hidden group cursor-pointer ${
                city.large ? 'col-span-2 row-span-2 md:col-span-1 md:row-span-2' : ''
              }`}
            >
              <img
                src={city.imageUrl}
                alt={city.name}
                className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 md:p-5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-white/70" />
                  <span className="text-white font-semibold text-lg">{city.name}</span>
                  <span className="text-white/50 text-sm ml-1">{city.canton}</span>
                </div>
                <p className="text-white/60 text-sm mt-0.5">
                  {city.count.toLocaleString('fr-CH')} biens
                </p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
