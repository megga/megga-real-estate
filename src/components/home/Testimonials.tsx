import { useRef, useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Star, Quote } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Testimonial {
  id: string
  name: string
  role: string
  avatar: string
  rating: number
  quote: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    name: 'Sophie Müller',
    role: 'Acheteuse, Genève',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&q=80',
    rating: 5,
    quote: "La recherche IA m'a fait gagner un temps fou. J'ai décrit ce que je voulais en une phrase et les résultats étaient exactement ce que je cherchais.",
  },
  {
    id: 't2',
    name: 'Marc Dupont',
    role: 'Agent immobilier, Lausanne',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&q=80',
    rating: 5,
    quote: "Le CRM intégré et le pipeline Kanban ont transformé ma façon de travailler. Plus besoin de jongler entre 4 outils différents.",
  },
  {
    id: 't3',
    name: 'Elena Rossi',
    role: 'Vendeuse, Lugano',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&q=80',
    rating: 5,
    quote: "Le portail vendeur est rassurant — je vois en temps réel les visites, les retours et les offres. Mon agent et moi sommes toujours synchronisés.",
  },
  {
    id: 't4',
    name: 'Thomas Weber',
    role: 'Agent immobilier, Zurich',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&q=80',
    rating: 5,
    quote: "La conformité LAB/KYC était mon cauchemar. Avec MEGGA, les dossiers sont structurés, traçables et je ne rate plus aucune pièce.",
  },
  {
    id: 't5',
    name: 'Isabelle Favre',
    role: 'Acheteuse, Nyon',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&q=80',
    rating: 5,
    quote: "L'estimation gratuite était précise et le processus de visite très fluide. Tout est centralisé, c'est vraiment agréable.",
  },
  {
    id: 't6',
    name: 'Pierre Schneider',
    role: "Directeur d'agence, Berne",
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&q=80',
    rating: 5,
    quote: "On a migré toute l'agence sur MEGGA en une semaine. La publication multicanal et le copilote IA ont boosté notre productivité.",
  },
]

export default function Testimonials() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 10)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10)
  }

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) el.addEventListener('scroll', checkScroll, { passive: true })
    return () => el?.removeEventListener('scroll', checkScroll)
  }, [])

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const amount = direction === 'left' ? -360 : 360
    el.scrollBy({ left: amount, behavior: 'smooth' })
  }

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <p className="text-[10px] font-medium text-gray-300 uppercase tracking-[0.2em]">
              Témoignages
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-primary mt-1">
              Ce qu'en disent nos utilisateurs
            </h2>
          </div>

          {/* Desktop arrows */}
          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              className={cn(
                'w-10 h-10 rounded-full border flex items-center justify-center transition-all',
                canScrollLeft
                  ? 'border-gray-200 text-gray-600 hover:border-accent hover:text-accent cursor-pointer'
                  : 'border-gray-100 text-gray-200 cursor-not-allowed'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              className={cn(
                'w-10 h-10 rounded-full border flex items-center justify-center transition-all',
                canScrollRight
                  ? 'border-gray-200 text-gray-600 hover:border-accent hover:text-accent cursor-pointer'
                  : 'border-gray-100 text-gray-200 cursor-not-allowed'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-5 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0"
        >
          {TESTIMONIALS.map((t) => (
            <div
              key={t.id}
              className="flex-shrink-0 w-[320px] md:w-[360px] snap-start bg-white rounded-2xl border border-gray-100 p-6 hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-accent/15 mb-3" />

              {/* Quote text */}
              <p className="text-sm text-gray-600 leading-relaxed min-h-[80px]">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Stars */}
              <div className="flex gap-0.5 mt-4">
                {Array.from({ length: t.rating }).map((_, i) => (
                  <Star
                    key={i}
                    className="w-3.5 h-3.5 fill-amber-400 text-amber-400"
                  />
                ))}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50">
                <img
                  src={t.avatar}
                  alt={t.name}
                  className="w-10 h-10 rounded-full object-cover"
                  loading="lazy"
                />
                <div>
                  <p className="text-sm font-semibold text-primary">{t.name}</p>
                  <p className="text-xs text-gray-400">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
