import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'buy', label: 'Acheter' },
  { id: 'rent', label: 'Louer' },
  { id: 'sell', label: 'Vendre' },
  { id: 'estimate', label: 'Estimer' },
] as const

type TabId = typeof tabs[number]['id']

const propertyTypes = ['Appartement', 'Maison', 'Villa', 'Commercial', 'Terrain']
const roomOptions = ['1 pièce', '2 pièces', '3 pièces', '4 pièces', '5+ pièces']
const budgetOptions = [
  "CHF 300'000 – 500'000",
  "CHF 500'000 – 750'000",
  "CHF 750'000 – 1'000'000",
  "CHF 1'000'000 – 2'000'000",
  "CHF 2'000'000+",
]
const locationOptions = ['Genève', 'Lausanne', 'Zurich', 'Berne', 'Bâle', 'Lugano']

interface DropdownProps {
  label: string
  options: string[]
  value: string
  onChange: (val: string) => void
}

function SearchDropdown({ label, options, value, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-sm text-left hover:bg-gray-50 transition-colors"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={value ? `${label} : ${value}` : label}
      >
        <span className={cn('truncate', value ? 'text-primary-900 font-medium' : 'text-primary-400')}>
          {value || label}
        </span>
        <ChevronDown className="h-4 w-4 text-primary-400 flex-shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden="true" />
          <ul
            className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white rounded-lg shadow-dropdown border border-border z-20 py-1"
            role="listbox"
            aria-label={label}
          >
            {options.map((opt) => (
              <li key={opt} role="option" aria-selected={value === opt}>
                <button
                  type="button"
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm hover:bg-section transition-colors',
                    value === opt ? 'text-accent font-medium bg-accent-light' : 'text-primary-700'
                  )}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                >
                  {opt}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

export default function SearchBar() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabId>('buy')
  const [propertyType, setPropertyType] = useState('')
  const [rooms, setRooms] = useState('')
  const [budget, setBudget] = useState('')
  const [location, setLocation] = useState('')

  function handleSearch() {
    const params = new URLSearchParams()
    if (propertyType) params.set('type', propertyType)
    if (rooms) params.set('rooms', rooms)
    if (budget) params.set('budget', budget)
    if (location) params.set('city', location)
    params.set('tab', activeTab)
    navigate(`/search?${params.toString()}`)
  }

  return (
    <div className="w-full max-w-3xl mx-auto" role="search" aria-label="Recherche de biens immobiliers">
      {/* Tabs */}
      <div className="flex gap-1 mb-4" role="tablist" aria-label="Type de recherche">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-5 py-2 rounded-full text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-primary-900 text-white'
                : 'bg-white/20 text-white/80 hover:bg-white/30'
            )}
            role="tab"
            aria-selected={activeTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-xl shadow-lg flex items-center overflow-hidden">
        <div className="flex-1 flex items-center divide-x divide-border">
          <SearchDropdown
            label="Type de bien"
            options={propertyTypes}
            value={propertyType}
            onChange={setPropertyType}
          />
          <SearchDropdown
            label="Pièces"
            options={roomOptions}
            value={rooms}
            onChange={setRooms}
          />
          <SearchDropdown
            label="Budget"
            options={budgetOptions}
            value={budget}
            onChange={setBudget}
          />
          <SearchDropdown
            label="Localisation"
            options={locationOptions}
            value={location}
            onChange={setLocation}
          />
        </div>
        <button
          type="button"
          onClick={handleSearch}
          className="flex-shrink-0 m-2 h-10 w-10 bg-accent hover:bg-accent-hover rounded-full flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Rechercher"
        >
          <Search className="h-5 w-5 text-white" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
