import { Check, ArrowRight } from 'lucide-react';

const BULLET_POINTS = [
  'CRM intégré avec pipeline intelligent',
  'Conformité LAB automatisée',
  'Portail vendeur dédié pour vos clients',
];

const STATS = [
  { value: "12'500+", label: 'biens en ligne' },
  { value: '200+', label: 'agents partenaires' },
  { value: '26', label: 'cantons couverts' },
];

export default function CtaAgent() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="bg-accent/5 border border-accent/15 rounded-2xl p-10 md:p-14">
          <div className="flex flex-col md:flex-row gap-10 md:gap-16 items-center">
            {/* Left — text */}
            <div className="flex-[3]">
              <h2 className="text-2xl font-bold text-gray-900">
                Vous êtes professionnel de l&apos;immobilier ?
              </h2>
              <p className="text-base text-gray-500 mt-2">
                Rejoignez MEGGA et accédez aux outils les plus avancés du marché suisse.
              </p>

              <div className="mt-6 space-y-3">
                {BULLET_POINTS.map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5 text-accent" />
                    </div>
                    <span className="text-sm text-gray-700">{point}</span>
                  </div>
                ))}
              </div>

              <a
                href="/register"
                className="inline-flex items-center gap-2 mt-6 px-6 h-12 bg-accent hover:bg-accent/90 text-white font-medium rounded-xl transition-all text-sm"
              >
                Découvrir MEGGA Pro
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>

            {/* Right — stats */}
            <div className="flex-[2] w-full">
              <div className="grid grid-cols-3 md:grid-cols-1 gap-4">
                {STATS.map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white border border-[var(--color-border)] rounded-xl p-4 md:p-5 text-center md:text-left"
                  >
                    <div className="text-2xl font-bold text-accent">{stat.value}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
