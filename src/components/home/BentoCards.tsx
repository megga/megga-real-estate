import { useTranslation } from 'react-i18next';
import { ArrowRight, Home, Key, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';

const CARDS = [
  {
    number: '01',
    titleKey: 'home.buyTitle',
    descKey: 'home.buyDesc',
    ctaKey: 'home.buyCta',
    href: '/acheter',
    icon: Home,
    illustration: '/illustrations/acheter.svg',
  },
  {
    number: '02',
    titleKey: 'home.rentTitle',
    descKey: 'home.rentDesc',
    ctaKey: 'home.rentCta',
    href: '/louer',
    icon: Key,
    illustration: '/illustrations/louer.svg',
  },
  {
    number: '03',
    titleKey: 'home.estimateTitle',
    descKey: 'home.estimateDesc',
    ctaKey: 'home.estimateCta',
    href: '/estimations',
    icon: TrendingUp,
    illustration: '/illustrations/estimer.svg',
  },
] as const;

export default function BentoCards() {
  const { t } = useTranslation('common');

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-gray-200 rounded-2xl overflow-hidden">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.titleKey}
                to={card.href}
                className="group relative bg-white p-8 md:p-10 flex flex-col justify-between min-h-[280px] transition-colors duration-300 hover:bg-gray-50"
              >
                {/* Illustration or Number */}
                <div className="flex items-start justify-between">
                  {card.illustration ? (
                    <img
                      src={card.illustration}
                      alt=""
                      className="w-28 h-28 md:w-32 md:h-32 object-contain"
                      loading="lazy"
                    />
                  ) : (
                    <span className="text-6xl md:text-7xl font-black text-gray-100 leading-none select-none transition-colors duration-300 group-hover:text-gray-200">
                      {card.number}
                    </span>
                  )}
                  <Icon className="w-5 h-5 text-gray-300 mt-2 transition-colors duration-300 group-hover:text-gray-900" />
                </div>

                {/* Content */}
                <div className="mt-auto">
                  <h3 className="text-lg font-bold text-gray-900">
                    {t(card.titleKey)}
                  </h3>
                  <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                    {t(card.descKey)}
                  </p>

                  {/* CTA */}
                  <div className="mt-5 flex items-center gap-2 text-sm font-medium text-gray-900">
                    <span>{t(card.ctaKey)}</span>
                    <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1" />
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
