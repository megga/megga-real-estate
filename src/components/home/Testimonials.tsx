import { Quote } from 'lucide-react';

const TESTIMONIALS = [
  {
    text: "MEGGA a transformé ma façon de travailler. Le pipeline et la conformité intégrée me font gagner un temps précieux au quotidien.",
    name: 'Gregory L.',
    role: 'Agent immobilier, Genève',
    initials: 'GL',
  },
  {
    text: "J'ai trouvé mon appartement en décrivant simplement ce que je cherchais. En trois jours, j'avais les clés. Incroyable.",
    name: 'Sophie M.',
    role: 'Acheteuse, Lausanne',
    initials: 'SM',
  },
  {
    text: "Le portail vendeur me permet de suivre chaque étape de la vente de mon bien. Transparent et rassurant.",
    name: 'Marc D.',
    role: 'Vendeur, Zurich',
    initials: 'MD',
  },
];

export default function Testimonials() {
  return (
    <section className="py-20 bg-[var(--color-bg-section)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Ils nous font confiance</h2>
          <p className="text-sm text-gray-500 mt-2">
            Découvrez ce que nos utilisateurs pensent de MEGGA
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.name}
              className="bg-white border border-[var(--color-border)] rounded-2xl p-6"
            >
              <Quote className="w-8 h-8 text-accent/20" />
              <p className="text-sm text-gray-900 leading-relaxed italic mt-3">
                &ldquo;{t.text}&rdquo;
              </p>
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-[var(--color-border)]">
                <div className="w-10 h-10 rounded-full bg-accent/10 text-accent font-semibold text-sm flex items-center justify-center shrink-0">
                  {t.initials}
                </div>
                <div>
                  <div className="font-medium text-sm text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
