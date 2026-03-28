import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

export interface SectionDef {
  id: string
  label: string
}

interface ListingStickyNavProps {
  sections: SectionDef[]
}

export default function ListingStickyNav({ sections }: ListingStickyNavProps) {
  const [activeId, setActiveId] = useState(sections[0]?.id || '')
  const [isVisible, setIsVisible] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Show/hide based on scroll past hero gallery
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(!entry.isIntersecting),
      { threshold: 0 }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  // Scroll spy: track which section is in view
  useEffect(() => {
    const observers: IntersectionObserver[] = []
    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (!el) continue
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveId(section.id)
        },
        { rootMargin: '-30% 0px -60% 0px' }
      )
      observer.observe(el)
      observers.push(observer)
    }
    return () => observers.forEach(o => o.disconnect())
  }, [sections])

  function scrollToSection(id: string) {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
    }
  }

  return (
    <>
      {/* Sentinel div placed right after the hero gallery */}
      <div ref={sentinelRef} className="h-0" />

      {/* Sticky nav bar */}
      <div
        className={cn(
          'sticky top-16 z-40 transition-all duration-200',
          isVisible
            ? 'bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm'
            : 'bg-transparent border-b border-transparent'
        )}
      >
        <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8">
          <nav className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  'px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  activeId === section.id
                    ? 'text-gray-900 border-accent'
                    : 'text-gray-500 border-transparent hover:text-gray-700'
                )}
              >
                {section.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </>
  )
}
