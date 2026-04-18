import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterPillProps {
  label: string
  active: boolean
  dark?: boolean
  children: React.ReactNode
}

export function FilterPill({ label, active, dark, children }: FilterPillProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          // Base — unified Dessiner-like pill: white, soft shadow, readable text
          'flex items-center gap-1.5 h-9 px-4 text-sm font-medium rounded-full border transition-colors duration-150 whitespace-nowrap cursor-pointer shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-300',
          dark
            ? active
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
            : active
              ? 'bg-theme-active text-theme-primary border-theme-border'
              : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
        )}
      >
        {label}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', active && dark ? 'text-white/70' : 'text-gray-500', open && 'rotate-180')} />
      </button>
      {open && (
        <div
          className="absolute top-full left-0 mt-2 min-w-[260px] bg-white rounded-2xl border border-gray-100 z-50 py-2 max-h-80 overflow-y-auto scrollbar-hide origin-top animate-in fade-in zoom-in-95 slide-in-from-top-1 duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={{ boxShadow: '0 20px 48px -16px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.08)' }}
        >
          {children}
        </div>
      )}
    </div>
  )
}

export function FilterOption({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className={cn(
        'w-full text-left px-4 py-2.5 text-sm transition-colors cursor-pointer flex items-center gap-3',
        selected
          ? 'text-gray-900 font-semibold bg-gray-900/[0.04]'
          : 'text-gray-700 hover:bg-gray-50'
      )}
      onClick={onClick}
    >
      <span className="flex-1">{children}</span>
      {selected && (
        <svg className="w-4 h-4 text-gray-900 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}
