import { useRef, useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Testimonial {
  id: string
  name: string
  role: string
  rating: number
  quote: string
}

const TESTIMONIALS: Testimonial[] = [
  {
    id: 't1',
    name: 'Sophie Müller',
    role: 'Acheteuse, Genève',
    rating: 5,
    quote: "La recherche IA m'a fait gagner un temps fou. J'ai décrit ce que je voulais en une phrase et les résultats étaient exactement ce que je cherchais.",
  },
  {
    id: 't2',
    name: 'Marc Dupont',
    role: 'Agent immobilier, Lausanne',
    rating: 5,
    quote: "Le CRM intégré et le pipeline Kanban ont transformé ma façon de travailler. Plus besoin de jongler entre 4 outils différents.",
  },
  {
    id: 't3',
    name: 'Elena Rossi',
    role: 'Vendeuse, Lugano',
    rating: 5,
    quote: "Le portail vendeur est rassurant — je vois en temps réel les visites, les retours et les offres. Mon agent et moi sommes toujours synchronisés.",
  },
  {
    id: 't4',
    name: 'Thomas Weber',
    role: 'Agent immobilier, Zurich',
    rating: 4,
    quote: "La conformité LAB/KYC était mon cauchemar. Avec MEGGA, les dossiers sont structurés, traçables et je ne rate plus aucune pièce.",
  },
  {
    id: 't5',
    name: 'Isabelle Favre',
    role: 'Acheteuse, Nyon',
    rating: 5,
    quote: "L'estimation gratuite était précise et le processus de visite très fluide. Tout est centralisé, c'est vraiment agréable.",
  },
  {
    id: 't6',
    name: 'Pierre Schneider',
    role: "Directeur d'agence, Berne",
    rating: 4,
    quote: "On a migré toute l'agence sur MEGGA en une semaine. La publication multicanal et le copilote IA ont boosté notre productivité.",
  },
]

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

export default function Testimonials() {
  const { t } = useTranslation('common')
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
    el.scrollBy({ left: direction === 'left' ? -380 : 380, behavior: 'smooth' })
  }

  return (
    <section className="py-16 md:py-24 bg-gray-50/60">
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
        {/* Header */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">
              {t('home.whatUsersSay')}
            </h2>
            <p className="text-sm text-gray-400 mt-2">
              {t('home.testimonials')}
            </p>
          </div>

          <div className="hidden md:flex items-center gap-2">
            <button
              onClick={() => scroll('left')}
              disabled={!canScrollLeft}
              aria-label="Précédent"
              className={cn(
                'w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer',
                canScrollLeft
                  ? 'border-gray-200 text-gray-600 hover:border-gray-400'
                  : 'border-gray-100 text-gray-200 cursor-default'
              )}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              disabled={!canScrollRight}
              aria-label="Suivant"
              className={cn(
                'w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer',
                canScrollRight
                  ? 'border-gray-200 text-gray-600 hover:border-gray-400'
                  : 'border-gray-100 text-gray-200 cursor-default'
              )}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Carousel */}
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 md:mx-0 md:px-0"
        >
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.id}
              className="flex-shrink-0 w-[300px] md:w-[360px] snap-start bg-white rounded-xl border border-gray-100 p-6 flex flex-col transition-colors duration-300 hover:border-gray-200"
            >
              {/* Quote */}
              <p className="text-sm text-gray-600 leading-relaxed flex-1">
                &ldquo;{testimonial.quote}&rdquo;
              </p>

              {/* Stars */}
              <div className="flex gap-0.5 mt-5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'w-3.5 h-3.5',
                      i < testimonial.rating
                        ? 'fill-gray-900 text-gray-900'
                        : 'fill-gray-200 text-gray-200'
                    )}
                  />
                ))}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-100">
                <div
                  aria-hidden
                  className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 text-xs font-semibold flex items-center justify-center"
                >
                  {initials(testimonial.name)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{testimonial.name}</p>
                  <p className="text-xs text-gray-400">{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
