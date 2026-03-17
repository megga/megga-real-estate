import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  Kanban,
  ShieldCheck,
  Users,
  Eye,
  Calendar,
  MessageSquare,
  Share2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Feature {
  label: string;
  icon: LucideIcon;
  description: string;
  image: string;
  badges: string[];
}

const FEATURES: Feature[] = [
  {
    label: 'Recherche intelligente',
    icon: Search,
    description:
      'Décrivez en quelques mots ce que vous cherchez. Notre technologie comprend vos critères et trouve les biens qui correspondent.',
    image:
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a8?w=1200',
    badges: ['Mapbox', 'pgvector'],
  },
  {
    label: 'Pipeline transactions',
    icon: Kanban,
    description:
      'Suivez chaque deal du premier contact jusqu\u2019à la signature. Kanban drag & drop, historique complet.',
    image:
      'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200',
    badges: ['vs Pipedrive', 'vs HubSpot'],
  },
  {
    label: 'Conformité KYC & LAB',
    icon: ShieldCheck,
    description:
      'Vérification automatisée conforme à la réglementation suisse. Checklists, documents, audit trail.',
    image:
      'https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200',
    badges: ['FINMA', 'LAB/LBA', 'PEP Check'],
  },
  {
    label: 'CRM immobilier',
    icon: Users,
    description:
      'Contacts, scoring, tags, historique — tout centralisé. Pas besoin d\u2019un CRM séparé.',
    image:
      'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1200',
    badges: ['vs Virtups', 'vs Casasoft', 'vs RealForce'],
  },
  {
    label: 'Portail vendeur',
    icon: Eye,
    description:
      'Vos clients suivent leur mandat en temps réel. Visites, offres, documents — transparence totale.',
    image:
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200',
    badges: ['Temps réel', 'Notifications'],
  },
  {
    label: 'Agenda & visites',
    icon: Calendar,
    description:
      'Planifiez visites et rendez-vous. Synchronisation automatique avec votre agenda.',
    image:
      'https://images.unsplash.com/photo-1506784983877-45594efa4cbe?w=1200',
    badges: ['Google Calendar', 'Outlook'],
  },
  {
    label: 'Messagerie intégrée',
    icon: MessageSquare,
    description:
      'Communiquez directement dans MEGGA. Historique centralisé, notifications instantanées.',
    image:
      'https://images.unsplash.com/photo-1577563908411-5077b6dc7624?w=1200',
    badges: ['Temps réel', 'Push notifications'],
  },
  {
    label: 'Publication multiplateforme',
    icon: Share2,
    description:
      'Publiez votre annonce et synchronisez automatiquement vers les portails suisses.',
    image:
      'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1200',
    badges: ['Homegate', 'ImmoScout24', 'Flatfox'],
  },
];

const AUTOPLAY_MS = 3000;
const VISIBLE_LABELS = 5;

export default function WhyMegga() {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const next = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % FEATURES.length);
  }, []);

  useEffect(() => {
    if (isPaused) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(next, AUTOPLAY_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isPaused, next]);

  const goTo = (index: number) => {
    setActiveIndex(index);
    // Reset timer
    if (timerRef.current) clearInterval(timerRef.current);
    if (!isPaused) {
      timerRef.current = setInterval(next, AUTOPLAY_MS);
    }
  };

  const prev = (activeIndex - 1 + FEATURES.length) % FEATURES.length;
  const nxt = (activeIndex + 1) % FEATURES.length;

  // Calculate visible label indices centered on activeIndex
  const half = Math.floor(VISIBLE_LABELS / 2);
  const labelIndices: number[] = [];
  for (let i = -half; i <= half; i++) {
    labelIndices.push((activeIndex + i + FEATURES.length) % FEATURES.length);
  }

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Section header */}
        <div className="text-center mb-10">
          <h2 className="text-2xl font-bold text-gray-900">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-sm text-gray-500 mt-2">
            Une plateforme complète pour gérer votre activité immobilière
          </p>
        </div>

        {/* Carousel container */}
        <div
          className="rounded-[2.5rem] lg:rounded-[4rem] border border-[var(--color-border)] overflow-hidden flex flex-col lg:flex-row min-h-[600px] lg:aspect-video"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
        >
          {/* Left panel — labels */}
          <div className="relative w-full lg:w-[40%] bg-accent flex items-center justify-center min-h-[350px] lg:min-h-0 overflow-hidden">
            {/* Top fade */}
            <div className="absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-accent to-transparent z-10 pointer-events-none" />
            {/* Bottom fade */}
            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-accent to-transparent z-10 pointer-events-none" />

            <div className="relative flex flex-col items-center gap-3 py-8 px-6">
              <AnimatePresence mode="popLayout">
                {labelIndices.map((idx) => {
                  const feature = FEATURES[idx];
                  const Icon = feature.icon;
                  const isActive = idx === activeIndex;

                  return (
                    <motion.button
                      key={`${idx}-${feature.label}`}
                      layout
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -30 }}
                      transition={{
                        type: 'spring',
                        stiffness: 300,
                        damping: 30,
                      }}
                      onClick={() => goTo(idx)}
                      className={`flex items-center gap-3 rounded-full px-8 py-4 font-medium text-sm whitespace-nowrap transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-white text-accent'
                          : 'text-white/60 border border-white/20 hover:text-white hover:border-white/40'
                      }`}
                    >
                      <Icon className="w-5 h-5 shrink-0" />
                      {feature.label}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>

          {/* Right panel — stacked cards */}
          <div className="relative w-full lg:w-[60%] bg-[var(--color-bg-section)] flex items-center justify-center min-h-[500px] lg:min-h-0 overflow-hidden">
            <AnimatePresence mode="popLayout">
              {[prev, activeIndex, nxt].map((idx) => {
                const feature = FEATURES[idx];
                const Icon = feature.icon;
                const isActive = idx === activeIndex;
                const isPrev = idx === prev;

                let x = 0;
                let scale = 1;
                let opacity = 1;
                let rotate = 0;
                let zIndex = 1;

                if (isActive) {
                  x = 0;
                  scale = 1;
                  opacity = 1;
                  rotate = 0;
                  zIndex = 10;
                } else if (isPrev) {
                  x = -100;
                  scale = 0.85;
                  opacity = 0.4;
                  rotate = -3;
                  zIndex = 5;
                } else {
                  x = 100;
                  scale = 0.85;
                  opacity = 0.4;
                  rotate = 3;
                  zIndex = 5;
                }

                return (
                  <motion.div
                    key={`card-${idx}-${feature.label}`}
                    className="absolute w-[80%] aspect-[4/3] rounded-[2rem] border-4 border-white overflow-hidden"
                    initial={{ x, scale, opacity, rotate }}
                    animate={{ x, scale, opacity, rotate, zIndex }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{
                      type: 'spring',
                      stiffness: 260,
                      damping: 26,
                    }}
                    style={{ zIndex }}
                  >
                    {/* Image */}
                    <img
                      src={feature.image}
                      alt={feature.label}
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />

                    {/* Gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

                    {/* Content overlay */}
                    {isActive && (
                      <div className="absolute inset-x-0 bottom-0 p-6 md:p-8 flex flex-col gap-3">
                        {/* Badge number + label */}
                        <span className="inline-flex items-center gap-2 self-start bg-white text-gray-900 px-4 py-1.5 rounded-full text-xs font-medium border border-[var(--color-border)]/50">
                          <Icon className="w-3.5 h-3.5" />
                          {activeIndex + 1} &bull; {feature.label}
                        </span>

                        {/* Description */}
                        <p className="text-white text-lg md:text-xl font-medium leading-tight">
                          {feature.description}
                        </p>

                        {/* Integration badges */}
                        <div className="flex flex-wrap gap-2">
                          {feature.badges.map((badge) => (
                            <span
                              key={badge}
                              className="bg-white/20 backdrop-blur-sm text-white/80 text-[10px] font-medium px-2.5 py-1 rounded-full"
                            >
                              {badge}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
