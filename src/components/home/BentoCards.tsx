import { Home, Key, TrendingUp, ArrowRight } from 'lucide-react';

const CARDS = [
  {
    icon: Home,
    color: 'bg-blue-50 text-blue-600',
    title: 'Acheter',
    description: 'Trouvez votre bien idéal parmi des milliers d\'annonces vérifiées à travers toute la Suisse.',
    cta: 'Rechercher un bien',
    href: '/search?context=acheter',
  },
  {
    icon: Key,
    color: 'bg-emerald-50 text-emerald-600',
    title: 'Louer',
    description: 'Appartements, maisons, colocations — parcourez les offres de location disponibles maintenant.',
    cta: 'Voir les locations',
    href: '/search?context=louer',
  },
  {
    icon: TrendingUp,
    color: 'bg-amber-50 text-amber-600',
    title: 'Estimer',
    description: 'Obtenez une estimation de votre bien en quelques secondes grâce à notre analyse de marché.',
    cta: 'Estimer mon bien',
    href: '/estimer',
  },
] as const;

export default function BentoCards() {
  return (
    <section className="py-12 md:py-16 bg-[var(--color-bg-section)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <a
                key={card.title}
                href={card.href}
                className="group bg-white rounded-2xl p-6 md:p-8 border border-gray-100 hover:border-gray-200 hover:shadow-[var(--shadow-card-hover)] transition-all duration-200"
              >
                <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mt-5">
                  {card.title}
                </h3>
                <p className="text-gray-500 text-sm mt-2 leading-relaxed">
                  {card.description}
                </p>
                <div className="flex items-center gap-1.5 mt-5 text-sm font-medium text-[#2563EB] group-hover:gap-2.5 transition-all">
                  {card.cta}
                  <ArrowRight className="w-4 h-4" />
                </div>
              </a>
            );
          })}
        </div>
      </div>
    </section>
  );
}
