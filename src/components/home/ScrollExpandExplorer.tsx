import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
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

function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u2019');
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function AnimatedCounter({ target, active }: { target: number; active: boolean }) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
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
  }, [active, target]);

  return <>{formatCount(value)}</>;
}

export default function ScrollExpandExplorer() {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);
  const progressRef = useRef(0);
  const isTransitioning = useRef(false);
  const isInView = useRef(false);

  const updateProgress = useCallback((delta: number) => {
    if (isTransitioning.current) return;

    setProgress((prev) => {
      const next = Math.max(0, Math.min(1, prev + delta));
      progressRef.current = next;

      if (next >= 1 && !isComplete) {
        setIsComplete(true);
      }
      if (next < 1 && isComplete) {
        setIsComplete(false);
      }

      return next;
    });
  }, [isComplete]);

  const skipToEnd = useCallback(() => {
    isTransitioning.current = true;
    const start = progressRef.current;
    const duration = 500;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const val = start + (1 - start) * eased;
      progressRef.current = val;
      setProgress(val);

      if (t < 1) {
        requestAnimationFrame(animate);
      } else {
        setIsComplete(true);
        isTransitioning.current = false;
      }
    };

    requestAnimationFrame(animate);
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
      window.scrollTo({ top: window.scrollY + rect.top, behavior: 'instant' });
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (!isInView.current) return;

      // If complete and user scrolls down, let page scroll normally
      if (progressRef.current >= 1 && e.deltaY > 0) return;

      // If complete and at top of component, recapture scroll back
      if (progressRef.current >= 1 && e.deltaY < 0) {
        const rect = container.getBoundingClientRect();
        if (rect.top >= -5) {
          e.preventDefault();
          updateProgress(e.deltaY * 0.0009);
          return;
        }
        return;
      }

      // If not complete, capture scroll
      if (progressRef.current < 1) {
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

      // If complete and scrolling down, let page scroll
      if (progressRef.current >= 1 && deltaY > 0) return;

      // If complete and at top, recapture
      if (progressRef.current >= 1 && deltaY < 0) {
        const rect = container.getBoundingClientRect();
        if (rect.top >= -5) {
          e.preventDefault();
          updateProgress(deltaY * 0.008);
          return;
        }
        return;
      }

      if (progressRef.current < 1) {
        e.preventDefault();
        scrollToContainer();
        const sensitivity = deltaY > 0 ? 0.005 : 0.008;
        updateProgress(deltaY * sensitivity);
      }
    };

    // Use window-level listeners to capture scroll before it happens
    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
    };
  }, [updateProgress, scrollToContainer]);

  // Derived animation values
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  const cardWidth = 300 + progress * (isMobile ? 650 : 1250);
  const cardHeight = 400 + progress * (isMobile ? 200 : 400);
  const maxW = typeof window !== 'undefined' ? window.innerWidth * 0.95 : 1400;
  const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.85 : 800;
  const clampedW = Math.min(cardWidth, maxW);
  const clampedH = Math.min(cardHeight, maxH);

  const borderRadius = 16 - progress * 12;
  const bgOpacity = 1 - progress;
  const cardOverlayOpacity = Math.max(0, 0.5 - progress * 0.3);
  const hintOpacity = Math.max(0, 1 - progress * 3);
  const textSpread = progress * 150;

  // Phase 3: darken + reveal
  const darkenProgress = Math.max(0, (progress - 0.6) / 0.4);
  const darkenOverlay = darkenProgress * 0.5;
  const revealProgress = Math.max(0, (progress - 0.75) / 0.25);
  const cardsVisible = progress >= 0.75;

  return (
    <div
      ref={containerRef}
      className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden"
      style={{ touchAction: isComplete ? 'auto' : 'none' }}
    >
      {/* Background image */}
      <img
        src="https://images.unsplash.com/photo-1573108037329-37aa135a142e?w=1920"
        alt=""
        className="absolute inset-0 w-full h-full object-cover blur-sm"
        style={{ opacity: bgOpacity }}
      />
      <div
        className="absolute inset-0 bg-black/10"
        style={{ opacity: bgOpacity }}
      />

      {/* Split text — "Explorez" left, "la Suisse" right */}
      <div
        className="absolute text-3xl md:text-5xl lg:text-6xl font-bold text-white pointer-events-none z-20"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% - ${textSpread}vw), -50%)`,
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          opacity: Math.max(0, 1 - progress * 2),
        }}
      >
        Explorez
      </div>
      <div
        className="absolute text-3xl md:text-5xl lg:text-6xl font-bold text-white pointer-events-none z-20"
        style={{
          left: '50%',
          top: '50%',
          transform: `translate(calc(-50% + ${textSpread}vw), -50%)`,
          textShadow: '0 2px 12px rgba(0,0,0,0.5)',
          opacity: Math.max(0, 1 - progress * 2),
        }}
      >
        la Suisse
      </div>

      {/* Expanding media card */}
      <div
        className="relative z-10 overflow-hidden"
        style={{
          width: clampedW,
          height: clampedH,
          borderRadius,
          boxShadow: `0 ${20 - progress * 15}px ${60 - progress * 40}px rgba(0,0,0,${0.3 - progress * 0.2})`,
          transition: isTransitioning.current ? 'all 0.05s linear' : 'none',
        }}
      >
        {/* Base image */}
        <img
          src="https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=1200"
          alt="Paysage suisse"
          className="absolute inset-0 w-full h-full object-cover"
        />

        {/* Card dark overlay (phase 1-2) */}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: cardOverlayOpacity }}
        />

        {/* Phase 3 darken overlay */}
        <div
          className="absolute inset-0 bg-black"
          style={{ opacity: darkenOverlay }}
        />

        {/* City cards grid (phase 3) */}
        {cardsVisible && (
          <div className="absolute inset-0 p-4 md:p-6 z-10">
            {/* Desktop grid */}
            <div className="hidden md:grid h-full gap-3 md:gap-4" style={{ gridTemplateColumns: '1.4fr 1fr 1fr', gridTemplateRows: '1fr 1fr' }}>
              {CITIES.map((city, i) => (
                <CityCard
                  key={city.slug}
                  city={city}
                  index={i}
                  revealProgress={revealProgress}
                  className={i === 0 ? 'row-span-2' : ''}
                />
              ))}
            </div>
            {/* Mobile grid */}
            <div className="grid md:hidden h-full gap-3 grid-cols-2 grid-rows-3">
              {CITIES.map((city, i) => (
                <CityCard
                  key={city.slug}
                  city={city}
                  index={i}
                  revealProgress={revealProgress}
                  className={i === 0 ? 'col-span-2' : ''}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Scroll hint */}
      <div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 text-sm text-white/40"
        style={{ opacity: hintOpacity }}
      >
        Scroll pour découvrir &darr;
      </div>

      {/* Skip button */}
      {!isComplete && (
        <button
          onClick={skipToEnd}
          className="absolute bottom-4 md:bottom-6 right-4 md:right-6 z-30 text-white/40 hover:text-white/70 text-xs md:text-sm font-medium transition-colors cursor-pointer"
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
  revealProgress: number;
  className?: string;
}) {
  const delay = index * 0.08;
  const cardProgress = Math.max(0, Math.min(1, (revealProgress - delay) / (1 - delay)));
  const isVisible = cardProgress > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 60, scale: 0.9 }}
      animate={
        isVisible
          ? { opacity: 1, y: 0, scale: 1 }
          : { opacity: 0, y: 60, scale: 0.9 }
      }
      transition={{ type: 'spring', stiffness: 300, damping: 24, delay: delay }}
      className={`relative rounded-xl overflow-hidden group ${className}`}
    >
      <Link to={`/search?city=${city.slug}`} className="absolute inset-0 z-10" />

      {/* Photo */}
      <img
        src={city.image}
        alt={city.name}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
        loading="lazy"
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
          <AnimatedCounter target={city.count} active={isVisible} />
          {' '}{city.label}
          {city.hot && ' \u00b7 Marché actif \uD83D\uDD25'}
        </p>
      </div>
    </motion.div>
  );
}
