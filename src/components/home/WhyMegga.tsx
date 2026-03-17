import { MessageSquare, ShieldCheck, Users } from 'lucide-react';

const VALUE_PROPS = [
  {
    icon: MessageSquare,
    circleClass: 'bg-accent/10 text-accent',
    title: 'Recherche intelligente',
    description: 'Décrivez ce que vous cherchez en quelques mots. Notre technologie comprend vos critères et trouve les biens qui correspondent.',
  },
  {
    icon: ShieldCheck,
    circleClass: 'bg-success/10 text-success',
    title: 'Conformité intégrée',
    description: 'Processus KYC et LAB automatisé pour des transactions sécurisées et conformes à la réglementation suisse.',
  },
  {
    icon: Users,
    circleClass: 'bg-warning/10 text-warning',
    title: 'Accompagnement humain',
    description: 'Des agents certifiés vous guident à chaque étape, de la recherche à la signature chez le notaire.',
  },
] as const;

export default function WhyMegga() {
  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900">Pourquoi choisir MEGGA</h2>
          <p className="text-sm text-gray-500 mt-2">
            Une nouvelle façon de chercher, acheter et gérer l&apos;immobilier en Suisse
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {VALUE_PROPS.map((prop) => {
            const Icon = prop.icon;
            return (
              <div
                key={prop.title}
                className="bg-white border border-[var(--color-border)] rounded-2xl p-8 text-center hover:border-accent/30 hover:shadow-lg transition-all"
              >
                <div className={`w-14 h-14 rounded-xl ${prop.circleClass} flex items-center justify-center mx-auto`}>
                  <Icon className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mt-4">{prop.title}</h3>
                <p className="text-sm text-gray-500 mt-2 leading-relaxed">{prop.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
