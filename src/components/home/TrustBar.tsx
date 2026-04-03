import { cn } from '@/lib/utils'

const PARTNERS = [
  { name: 'Homegate', weight: 'font-bold' },
  { name: 'ImmoScout24', weight: 'font-bold' },
  { name: 'immobilier.ch', weight: 'font-semibold' },
  { name: 'FINMA', weight: 'font-bold tracking-wider' },
  { name: 'Stripe', weight: 'font-bold italic' },
  { name: 'Mapbox', weight: 'font-bold' },
]

export default function TrustBar() {
  // Duplicate list for seamless infinite scroll
  const items = [...PARTNERS, ...PARTNERS]

  return (
    <section className="py-8 bg-white border-b border-gray-100 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-[0.2em] text-center mb-6">
          Intégrations & partenaires
        </p>
      </div>

      <div className="relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />

        {/* Scrolling track */}
        <div className="flex animate-scroll-x">
          {items.map((partner, i) => (
            <div
              key={`${partner.name}-${i}`}
              className="flex-shrink-0 px-8 md:px-12 flex items-center"
            >
              <span
                className={cn(
                  'text-lg md:text-xl text-gray-400 hover:text-gray-500 transition-colors duration-300 whitespace-nowrap select-none',
                  partner.weight
                )}
              >
                {partner.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
