import { useState } from 'react'
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PROPERTY_TYPE_LABELS, type PropertyType } from '@/lib/constants'

export interface SearchFiltersState {
  type: PropertyType | ''
  minPrice: string
  maxPrice: string
  minRooms: string
  city: string
  sortBy: string
}

interface SearchFiltersProps {
  filters: SearchFiltersState
  onChange: (filters: SearchFiltersState) => void
  resultCount: number
}

const cities = ['Toutes', 'Genève', 'Cologny', 'Carouge', 'Lancy', 'Vernier', 'Meyrin']
const sortOptions = [
  { value: 'newest', label: 'Plus récents' },
  { value: 'price_asc', label: 'Prix croissant' },
  { value: 'price_desc', label: 'Prix décroissant' },
  { value: 'surface_desc', label: 'Surface décroissante' },
]

interface FilterDropdownProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (val: string) => void
}

function FilterDropdown({ label, value, options, onChange }: FilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const selected = options.find((o) => o.value === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-3 py-2 text-sm rounded-full border transition-colors',
          value
            ? 'border-accent bg-accent-light text-accent font-medium'
            : 'border-border bg-white text-primary-700 hover:border-primary-300'
        )}
      >
        {selected?.label || label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-lg shadow-dropdown border border-border z-20 py-1">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  'w-full text-left px-4 py-2 text-sm hover:bg-section transition-colors',
                  value === opt.value ? 'text-accent font-medium bg-accent-light' : 'text-primary-700'
                )}
                onClick={() => {
                  onChange(opt.value)
                  setOpen(false)
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default function SearchFilters({ filters, onChange, resultCount }: SearchFiltersProps) {
  const hasActiveFilters = filters.type || filters.minPrice || filters.minRooms || (filters.city && filters.city !== 'Toutes')

  function update(patch: Partial<SearchFiltersState>) {
    onChange({ ...filters, ...patch })
  }

  function clearAll() {
    onChange({ type: '', minPrice: '', maxPrice: '', minRooms: '', city: '', sortBy: 'newest' })
  }

  const typeOptions = [
    { value: '', label: 'Tous types' },
    ...Object.entries(PROPERTY_TYPE_LABELS).map(([value, label]) => ({ value, label })),
  ]

  const roomOptions = [
    { value: '', label: 'Pièces' },
    { value: '1', label: '1+' },
    { value: '2', label: '2+' },
    { value: '3', label: '3+' },
    { value: '4', label: '4+' },
    { value: '5', label: '5+' },
  ]

  const priceOptions = [
    { value: '', label: 'Budget' },
    { value: '300000', label: "Dès CHF 300'000" },
    { value: '500000', label: "Dès CHF 500'000" },
    { value: '750000', label: "Dès CHF 750'000" },
    { value: '1000000', label: "Dès CHF 1'000'000" },
  ]

  const cityOptions = cities.map((c) => ({ value: c === 'Toutes' ? '' : c, label: c }))

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
        <SlidersHorizontal className="h-4 w-4" />
        <span className="font-medium text-primary-900">{resultCount} biens</span>
      </div>

      <FilterDropdown
        label="Type"
        value={filters.type}
        options={typeOptions}
        onChange={(val) => update({ type: val as PropertyType | '' })}
      />
      <FilterDropdown
        label="Pièces"
        value={filters.minRooms}
        options={roomOptions}
        onChange={(val) => update({ minRooms: val })}
      />
      <FilterDropdown
        label="Budget"
        value={filters.minPrice}
        options={priceOptions}
        onChange={(val) => update({ minPrice: val })}
      />
      <FilterDropdown
        label="Localisation"
        value={filters.city}
        options={cityOptions}
        onChange={(val) => update({ city: val })}
      />
      <FilterDropdown
        label="Trier par"
        value={filters.sortBy}
        options={sortOptions}
        onChange={(val) => update({ sortBy: val })}
      />

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAll}
          className="text-muted-foreground hover:text-danger gap-1"
        >
          <X className="h-3.5 w-3.5" />
          Effacer
        </Button>
      )}
    </div>
  )
}
