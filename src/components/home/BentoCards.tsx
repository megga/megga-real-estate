import { useTranslation } from 'react-i18next';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function BentoCards() {
  const { t } = useTranslation('common');

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">

          {/* Card 01 — Acheter (grande, 2/3 largeur) */}
          <Link
            to="/buy"
            className="group md:col-span-2 md:row-span-2 relative bg-amber-50/60 rounded-2xl p-8 md:p-12 flex flex-col justify-between min-h-[320px] md:min-h-[480px] overflow-hidden transition-colors duration-300 hover:bg-amber-50"
          >
            <img
              src="/illustrations/acheter.svg"
              alt=""
              className="absolute right-4 md:right-10 top-6 md:top-10 w-48 md:w-72 lg:w-80 h-auto opacity-90 transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="relative z-10 mt-auto max-w-sm">
              <h3 className="text-2xl md:text-3xl font-bold text-gray-900">
                {t('home.buyTitle')}
              </h3>
              <p className="text-sm md:text-base text-gray-500 mt-3 leading-relaxed">
                {t('home.buyDesc')}
              </p>
              <div className="mt-6 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span>{t('home.buyCta')}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </div>
            </div>
          </Link>

          {/* Card 02 — Louer (petite, 1/3) */}
          <Link
            to="/rent"
            className="group relative bg-blue-50/50 rounded-2xl p-7 md:p-8 flex flex-col justify-between min-h-[240px] overflow-hidden transition-colors duration-300 hover:bg-blue-50/80"
          >
            <img
              src="/illustrations/louer.svg"
              alt=""
              className="absolute right-3 top-4 w-28 md:w-32 h-auto opacity-85 transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="relative z-10 mt-auto">
              <h3 className="text-xl font-bold text-gray-900">
                {t('home.rentTitle')}
              </h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {t('home.rentDesc')}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span>{t('home.rentCta')}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </div>
            </div>
          </Link>

          {/* Card 03 — Estimer (petite, 1/3) */}
          <Link
            to="/estimates"
            className="group relative bg-emerald-50/50 rounded-2xl p-7 md:p-8 flex flex-col justify-between min-h-[240px] overflow-hidden transition-colors duration-300 hover:bg-emerald-50/80"
          >
            <img
              src="/illustrations/estimer.svg"
              alt=""
              className="absolute right-3 top-4 w-28 md:w-32 h-auto opacity-85 transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="relative z-10 mt-auto">
              <h3 className="text-xl font-bold text-gray-900">
                {t('home.estimateTitle')}
              </h3>
              <p className="text-sm text-gray-500 mt-2 leading-relaxed">
                {t('home.estimateDesc')}
              </p>
              <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-gray-900">
                <span>{t('home.estimateCta')}</span>
                <ArrowRight className="w-4 h-4 transition-transform duration-300 group-hover:translate-x-1.5" />
              </div>
            </div>
          </Link>

        </div>
      </div>
    </section>
  );
}
