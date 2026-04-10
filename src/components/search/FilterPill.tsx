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
          'flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
          dark
            ? active
              ? 'bg-gray-900 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            : active
              ? 'bg-theme-active text-theme-primary'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        )}
      >
        {label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', active ? (dark ? 'text-white/60' : 'text-theme-secondary') : 'text-gray-500', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 min-w-[200px] bg-white rounded-xl shadow-lg border border-gray-100 z-50 py-1.5 max-h-72 overflow-y-auto scrollbar-hide">
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
        'w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-2',
        selected ? 'text-accent font-medium bg-accent/5' : 'text-gray-700'
      )}
      onClick={onClick}
    >
      <span className="flex-1">{children}</span>
      {selected && (
        <svg className="w-3.5 h-3.5 text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      )}
    </button>
  )
}
