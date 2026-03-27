import { useState, useRef, useEffect, useCallback } from 'react'
import { MapPin, Loader2, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSwissAddress, type SwissAddressSuggestion } from '@/hooks/useSwissAddress'

interface SwissAddressAutocompleteProps {
  onSelect: (suggestion: SwissAddressSuggestion) => void
  defaultValue?: string
  placeholder?: string
  className?: string
}

export default function SwissAddressAutocomplete({
  onSelect,
  defaultValue = '',
  placeholder = 'Rechercher une adresse en Suisse...',
  className,
}: SwissAddressAutocompleteProps) {
  const { query, setQuery, suggestions, isLoading, error } = useSwissAddress()
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [hasSelected, setHasSelected] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Set initial value
  useEffect(() => {
    if (defaultValue && !query) {
      setQuery(defaultValue)
      setHasSelected(true)
    }
  }, [defaultValue]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show dropdown when suggestions arrive and user hasn't selected
  useEffect(() => {
    if (suggestions.length > 0 && !hasSelected) {
      setIsOpen(true)
      setActiveIndex(-1)
    }
  }, [suggestions, hasSelected])

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement
      item?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const handleSelect = useCallback((suggestion: SwissAddressSuggestion) => {
    setQuery(suggestion.street)
    setIsOpen(false)
    setHasSelected(true)
    setActiveIndex(-1)
    onSelect(suggestion)
  }, [onSelect, setQuery])

  function handleInputChange(value: string) {
    setQuery(value)
    setHasSelected(false)
    if (value.trim().length < 3) {
      setIsOpen(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === 'ArrowDown' && suggestions.length > 0) {
        setIsOpen(true)
        setActiveIndex(0)
        e.preventDefault()
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (activeIndex >= 0 && activeIndex < suggestions.length) {
          handleSelect(suggestions[activeIndex])
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setActiveIndex(-1)
        break
    }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Input */}
      <div className="relative">
        <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-muted" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0 && !hasSelected) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(
            'w-full h-11 pl-10 pr-10 text-sm bg-transparent',
            'border border-theme-border rounded-lg',
            'focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent',
            'transition-colors text-theme-primary placeholder:text-theme-muted'
          )}
        />
        <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-theme-muted animate-spin" />
          ) : (
            <Search className="h-4 w-4 text-theme-muted" />
          )}
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div
          ref={listRef}
          className={cn(
            'absolute z-50 left-0 right-0 mt-1',
            'bg-theme-card border border-theme-border rounded-lg shadow-lg',
            'max-h-[320px] overflow-y-auto scrollbar-hide',
            'animate-in fade-in slide-in-from-top-1 duration-150'
          )}
          role="listbox"
        >
          {suggestions.length > 0 ? (
            suggestions.map((s, i) => (
              <button
                key={s.id}
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setActiveIndex(i)}
                className={cn(
                  'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors',
                  'border-b border-theme-border last:border-b-0',
                  i === activeIndex ? 'bg-theme-hover' : 'hover:bg-theme-hover'
                )}
              >
                <MapPin className="h-4 w-4 text-theme-muted mt-0.5 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">
                    {s.street}
                  </p>
                  <p className="text-xs text-theme-secondary mt-0.5">
                    {s.postalCode} {s.city} ({s.canton})
                  </p>
                </div>
              </button>
            ))
          ) : !isLoading && query.length >= 3 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-theme-muted">Aucune adresse trouvée</p>
              <p className="text-xs text-theme-tertiary mt-1">Vérifiez l'orthographe ou essayez un autre terme</p>
            </div>
          ) : null}

          {error && (
            <div className="px-4 py-3 text-center">
              <p className="text-xs text-red-500">Erreur de connexion. Réessayez.</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
