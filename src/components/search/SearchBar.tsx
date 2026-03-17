import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown, MapPin, Home, DoorOpen, Wallet } from 'lucide-react'
import { cn } from '@/lib/utils'

const tabs = [
  { id: 'buy', label: 'Acheter' },
  { id: 'rent', label: 'Louer' },
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
  icon: React.ReactNode
  options: string[]
  value: string
  onChange: (val: string) => void
}

function SearchDropdown({ label, icon, options, value, onChange }: DropdownProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 text-sm text-left hover:bg-gray-50 rounded-xl transition-colors duration-200"
      >
        <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        <span className={cn('truncate', value ? 'text-primary-900 font-medium' : 'text-primary-400')}>
          {value || label}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-primary-300 flex-shrink-0 ml-auto" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-full min-w-[200px] bg-white rounded-xl shadow-dropdown border border-border z-20 py-1">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                className={cn(
                  'w-full text-left px-4 py-2.5 text-sm hover:bg-section transition-colors duration-200',
                  value === opt ? 'text-accent font-medium bg-accent-light' : 'text-primary-700'
                )}
                onClick={() => {
                  onChange(opt)
                  setOpen(false)
                }}
              >
                {opt}
              </button>
            ))}
          </div>
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
    <div className="w-full max-w-3xl mx-auto">
      {/* Tabs */}
      <div className="flex gap-2 mb-5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-200',
              activeTab === tab.id
                ? 'bg-primary-900 text-white shadow-md'
                : 'bg-gray-100 text-primary-700 hover:bg-gray-200'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="bg-white rounded-2xl shadow-xl p-2">
        <div className="flex items-center">
          <div className="flex-1 flex items-center divide-x divide-gray-100">
            <SearchDropdown
              label="Type de bien"
              icon={<Home className="h-4 w-4" />}
              options={propertyTypes}
              value={propertyType}
              onChange={setPropertyType}
            />
            <SearchDropdown
              label="Pièces"
              icon={<DoorOpen className="h-4 w-4" />}
              options={roomOptions}
              value={rooms}
              onChange={setRooms}
            />
            <div className="hidden md:block">
              <SearchDropdown
                label="Budget"
                icon={<Wallet className="h-4 w-4" />}
                options={budgetOptions}
                value={budget}
                onChange={setBudget}
              />
            </div>
            <SearchDropdown
              label="Localisation"
              icon={<MapPin className="h-4 w-4" />}
              options={locationOptions}
              value={location}
              onChange={setLocation}
            />
          </div>
          <button
            type="button"
            onClick={handleSearch}
            className="flex-shrink-0 h-11 w-11 bg-accent hover:bg-accent-hover rounded-full flex items-center justify-center transition-colors duration-200 shadow-md"
          >
            <Search className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
