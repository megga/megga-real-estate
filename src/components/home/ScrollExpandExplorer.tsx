import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useMotionValue, useTransform, motionValue } from 'motion/react';
import { Link } from 'react-router-dom';

interface City {
  name: string;
  slug: string;
  image: string;
  count: number;
  label: string;
  badge?: string;
  hot?: boolean;
}

const CITIES: City[] = [
  {
    name: 'Genève',
    slug: 'geneve',
    image: 'https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=800',
    count: 2450,
    label: 'biens',
    badge: 'Populaire',
    hot: true,
  },
  {
    name: 'Lausanne',
    slug: 'lausanne',
    image: 'https://images.unsplash.com/photo-1527668752968-14dc70a27c95?w=600',
    count: 1820,
    label: 'biens',
  },
  {
    name: 'Zurich',
    slug: 'zurich',
    image: 'https://images.unsplash.com/photo-1515488764276-beab7607c1e6?w=600',
    count: 3100,
    label: 'biens',
    badge: 'N°1 en Suisse',
    hot: true,
  },
  {
    name: 'Bâle',
    slug: 'bale',
    image: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=600',
    count: 980,
    label: 'biens',
  },
  {
    name: 'Berne',
    slug: 'berne',
    image: 'https://images.unsplash.com/photo-1587974928442-77dc3e0dba72?w=600',
    count: 1250,
    label: 'biens',
  },
];

// Preload city card images so they're ready for the reveal
if (typeof window !== 'undefined') {
  CITIES.forEach((city) => {
    const img = new Image();
    img.src = city.image;
  });
}

function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2019');
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

function AnimatedCounter({ target, active }: { target: number; active: boolean }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    if (reducedMotion) {
      setValue(target);
      return;
    }

    const duration = 1500;
    const start = performance.now();

    const tick = (now: number) => {
      const elapsed = now - start;
      const t = Math.min(elapsed / duration, 1);
      setValue(Math.round(easeOutExpo(t) * target));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active, target, reducedMotion]);

  return <>{formatCount(value)}</>;
}

export default function ScrollExpandExplorer() {
  const progress = useMotionValue(0);
  const [isComplete, setIsComplete] = useState(false);
  // State trigger for city cards reveal (avoids re-rendering on every scroll tick)
  const [cardsVisible, setCardsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const isTransitioning = useRef(false);
  const isInView = useRef(false);
  const skipRafRef = useRef<number>(0);
  const isMountedRef = useRef(true);

  const isMobile = useMediaQuery('(max-width: 767px)');
  const reducedMotion = usePrefersReducedMotion();

  // Derived motion values — bypass React reconciler
  const bgOpacity = useTransform(progress, [0, 1], [1, 0]);
  const cardOverlayOpacity = useTransform(progress, [0, 1], [0.5, 0.2]);
  const hintOpacity = useTransform(progress, [0, 0.33], [1, 0]);
  const textOpacity = useTransform(progress, [0, 0.5], [1, 0]);
  const textSpreadLeft = useTransform(progress, (p) => `translate(calc(-100% - ${p * 150}vw - 1rem), -50%)`);
  const textSpreadRight = useTransform(progress, (p) => `translate(calc(${p * 150}vw + 1rem), -50%)`);
  const darkenOverlay = useTransform(progress, [0.6, 1], [0, 0.5]);

  // Card dimensions as motion values
  const cardWidth = useTransform(progress, (p) => {
    const base = 300 + p * (isMobile ? 650 : 1250);
    const maxW = window.innerWidth * 0.95;
    return Math.min(base, maxW);
  });
  const cardHeight = useTransform(progress, (p) => {
    const base = 400 + p * (isMobile ? 200 : 400);
    const maxH = window.innerHeight * 0.85;
    return Math.min(base, maxH);
  });
  const cardBorderRadius = useTransform(progress, [0, 1], [16, 4]);
  const cardShadow = useTransform(progress, (p) =>
    `0 ${20 - p * 15}px ${60 - p * 40}px rgba(0,0,0,${0.3 - p * 0.2})`
  );

  // Track mount state for RAF cleanup
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // If reduced motion, skip directly to end state
  useEffect(() => {
    if (reducedMotion) {
      progress.set(1);
      setCardsVisible(true);
      setIsComplete(true);
    }
  }, [reducedMotion, progress]);

  const updateProgress = useCallback((delta: number) => {
    if (isTransitioning.current) return;

    const prev = progress.get();
    const next = Math.max(0, Math.min(1, prev + delta));
    progress.set(next);

    if (next >= 1 && !isComplete) {
      setIsComplete(true);
    }
    if (next < 1 && isComplete) {
      setIsComplete(false);
    }

    // Toggle cards visibility at threshold
    if (next >= 0.75 && !cardsVisible) {
      setCardsVisible(true);
    }
    if (next < 0.75 && cardsVisible) {
      setCardsVisible(false);
    }
  }, [progress, isComplete, cardsVisible]);

  const skipToEnd = useCallback(() => {
    isTransitioning.current = true;
    const start = progress.get();
    const duration = 500;
    const startTime = performance.now();

    const animate = (now: number) => {
      if (!isMountedRef.current) return;
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const val = start + (1 - start) * eased;
      progress.set(val);

      if (val >= 0.75 && !cardsVisible) {
        setCardsVisible(true);
      }

      if (t < 1) {
        skipRafRef.current = requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
        setCardsVisible(true);
        isTransitioning.current = false;
      }
    };

    skipRafRef.current = requestAnimationFrame(animate);
  }, [progress, cardsVisible]);

  // Cleanup skip RAF on unmount
  useEffect(() => {
    return () => cancelAnimationFrame(skipRafRef.current);
  }, []);

  // Track visibility with IntersectionObserver
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        isInView.current = entry.isIntersecting && entry.intersectionRatio > 0.3;
      },
      { threshold: [0.3, 0.5, 0.8] }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Scroll to keep component pinned while animating
  const scrollToContainer = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (Math.abs(rect.top) > 5) {
      window.scrollTo({ top: window.scrollY + rect.top, behavior: 'auto' });
    }
  }, []);

  useEffect(() => {
    if (reducedMotion) return; // No scroll hijack with reduced motion

    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!isInView.current) return;

      const p = progress.get();

      // If complete and user scrolls down, let page scroll normally
      if (p >= 1 && e.deltaY > 0) return;

      // If complete and at top of component, recapture scroll back
      if (p >= 1 && e.deltaY < 0) {
        const rect = container.getBoundingClientRect();
        if (rect.top >= -5) {
          e.preventDefault();
          updateProgress(e.deltaY * 0.0009);
          return;
        }
        return;
      }

      // If not complete, capture scroll
      if (p < 1) {
        e.preventDefault();
        scrollToContainer();
        updateProgress(e.deltaY * 0.0009);
      }
    };

    const handleTouchStart = (e: TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isInView.current) return;

      const deltaY = touchStartY.current - e.touches[0].clientY;
      touchStartY.current = e.touches[0].clientY;
      const p = progress.get();

      // If complete and scrolling down, let page scroll
      if (p >= 1 && deltaY > 0) return;

      // If complete and at top, recapture
      if (p >= 1 && deltaY < 0) {
        const rect = container.getBoundingClientRect();
        if (rect.top >= -5) {
          e.preventDefault();
          updateProgress(deltaY * 0.008);
          return;
        }
        return;
      }

      if (p < 1) {
        e.preventDefault();
        scrollToContainer();
        const sensitivity = deltaY > 0 ? 0.005 : 0.008;
        updateProgress(deltaY * sensitivity);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [updateProgress, scrollToContainer, reducedMotion, progress]);

  // Compute revealProgress for city cards
  const revealProgress = useTransform(progress, [0.75, 1], [0, 1]);

  return (
    <div
      ref={containerRef}
      className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden bg-gray-900"
      style={{ touchAction: isComplete ? 'auto' : 'none' }}
      role="region"
      aria-label="Explorer les villes de Suisse"
    >
      {/* Background image */}
      <motion.img
        src="https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=1920"
        srcSet="https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=800 800w, https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=1200 1200w, https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=1920 1920w"
        sizes="100vw"
        alt=""
        className="absolute inset-0 w-full h-full object-cover blur-sm will-change-[opacity]"
        style={{ opacity: bgOpacity }}
        loading="lazy"
      />
      <motion.div
        className="absolute inset-0 bg-black/10"
        style={{ opacity: bgOpacity }}
      />

      {/* Split text — "Explorez" left of card, "la Suisse" right */}
      <motion.div
        className="absolute text-3xl md:text-5xl lg:text-6xl font-bold text-white pointer-events-none z-20 will-change-transform"
        style={{
          left: '50%',
          top: '50%',
          transform: textSpreadLeft,
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          opacity: textOpacity,
        }}
      >
        Explorez
      </motion.div>
      <motion.div
        className="absolute text-3xl md:text-5xl lg:text-6xl font-bold text-white pointer-events-none z-20 will-change-transform"
        style={{
          left: '50%',
          top: '50%',
          transform: textSpreadRight,
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          opacity: textOpacity,
        }}
      >
        la Suisse
      </motion.div>

      {/* Expanding media card */}
      <motion.div
        className="relative z-10 overflow-hidden will-change-[width,height]"
        style={{
          width: cardWidth,
          height: cardHeight,
          borderRadius: cardBorderRadius,
          boxShadow: cardShadow,
        }}
      >
        {/* Base image */}
        <img
          src="https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=1200"
          srcSet="https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=600 600w, https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=1200 1200w"
          sizes="(max-width: 768px) 95vw, 80vw"
          alt="Paysage suisse"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Card dark overlay (phase 1-2) */}
        <motion.div
          className="absolute inset-0 bg-black"
          style={{ opacity: cardOverlayOpacity }}
        />

        {/* Phase 3 darken overlay */}
        <motion.div
          className="absolute inset-0 bg-black"
          style={{ opacity: darkenOverlay }}
        />

        {/* City cards grid (phase 3) — single responsive grid */}
        {cardsVisible && (
          <div className="absolute inset-0 p-4 md:p-6 z-10">
            <div
              className="grid h-full gap-3 md:gap-4 grid-cols-2 grid-rows-3 md:grid-rows-2"
              style={{
                gridTemplateColumns: isMobile ? '1fr 1fr' : '1.4fr 1fr 1fr',
              }}
            >
              {CITIES.map((city, i) => (
                <CityCard
                  key={city.slug}
                  city={city}
                  index={i}
                  revealProgress={revealProgress}
                  className={
                    i === 0
                      ? isMobile
                        ? 'col-span-2'
                        : 'row-span-2'
                      : ''
                  }
                />
              ))}
            </div>
          </div>
        )}
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-sm text-white/40"
        style={{ opacity: hintOpacity }}
        aria-hidden="true"
      >
        Scroll pour découvrir &darr;
      </motion.div>

      {/* Skip button — keyboard accessible */}
      {!isComplete && (
        <button
          onClick={skipToEnd}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              skipToEnd();
            }
          }}
          className="absolute bottom-4 md:bottom-6 right-4 md:right-6 z-30 text-white/40 hover:text-white/70 focus-visible:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-xs md:text-sm font-medium transition-colors cursor-pointer rounded-md px-2 py-1"
          aria-label="Passer l'animation et afficher les villes"
        >
          Passer &rarr;
        </button>
      )}
    </div>
  );
}

function CityCard({
  city,
  index,
  revealProgress,
  className = '',
}: {
  city: City;
  index: number;
  revealProgress: ReturnType<typeof motionValue<number>> | ReturnType<typeof useMotionValue<number>>;
  className?: string;
}) {
  const delay = index * 0.08;
  const opacity = useTransform(revealProgress, [delay, Math.min(delay + 0.3, 1)], [0, 1]);
  const y = useTransform(revealProgress, [delay, Math.min(delay + 0.3, 1)], [60, 0]);
  const scale = useTransform(revealProgress, [delay, Math.min(delay + 0.3, 1)], [0.9, 1]);
  const isVisible = useTransform(revealProgress, (p) => p > delay);
  const [active, setActive] = useState(false);

  useEffect(() => {
    return isVisible.on('change', (v) => setActive(v));
  }, [isVisible]);

  return (
    <motion.div
      style={{ opacity, y, scale }}
      className={`relative rounded-xl overflow-hidden group ${className}`}
    >
      <Link
        to={`/search?city=${city.slug}`}
        className="absolute inset-0 z-10"
        aria-label={`Rechercher des biens à ${city.name}`}
      />

      {/* Photo */}
      <img
        src={city.image}
        alt={city.name}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />

      {/* Badge */}
      {city.badge && (
        <div className="absolute top-3 right-3 bg-white/20 backdrop-blur-md text-white text-[10px] font-semibold px-3 py-1 rounded-full z-10">
          {city.badge}
        </div>
      )}

      {/* Info */}
      <div className="absolute bottom-0 left-0 p-4 z-10">
        <h3 className="text-xl font-bold text-white">{city.name}</h3>
        <p className="text-xs text-white/70 mt-0.5">
          <AnimatedCounter target={city.count} active={active} />
          {' '}{city.label}
          {city.hot && ' \u00b7 Marché actif \uD83D\uDD25'}
        </p>
      </div>
    </motion.div>
  );
}
