import { useState } from 'react'
import {
  Building2,
  Home,
  Castle,
  Trees,
  Store,
  MapPin,
  Sparkles,
  Wrench,
  ThumbsUp,
  Paintbrush,
  HardHat,
  ChevronDown,
  Check,
  ArrowLeft,
  Maximize2,
  BarChart3,
  TrendingUp,
  Shield,
  Download,
  Mail,
  X,
  Lock,
  User,
  Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Link } from 'react-router-dom'

const CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO', 'ZH',
  'LU', 'ZG', 'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR', 'AI', 'SG', 'GR', 'TI',
]

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement', icon: Building2 },
  { value: 'house', label: 'Maison', icon: Home },
  { value: 'villa', label: 'Villa', icon: Castle },
  { value: 'land', label: 'Terrain', icon: Trees },
  { value: 'commercial', label: 'Commercial', icon: Store },
] as const

const ROOM_OPTIONS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '8+']
const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5', '6+']
const FLOOR_OPTIONS = ['RDC', '1', '2', '3', '4', '5', '6+', 'Attique']
const PARKING_OPTIONS = ['Aucun', '1 place intérieure', '2+ places', 'Garage']
const VIEW_OPTIONS = ['Standard', 'Vue dégagée', 'Vue lac', 'Vue montagne', 'Vue panoramique']

const CONDITIONS = [
  { value: 'new', label: 'Neuf', icon: Sparkles },
  { value: 'renovated', label: 'Rénové', icon: Wrench },
  { value: 'good', label: 'Bon état', icon: ThumbsUp },
  { value: 'refresh', label: 'À rafraîchir', icon: Paintbrush },
  { value: 'renovate', label: 'À rénover', icon: HardHat },
] as const

const COMPARABLE_PROPERTIES = [
  { address: 'Rue du Rhône 14, Genève', rooms: '4p.', surface: '92m²', price: "CHF 698'000", date: 'Oct. 2025' },
  { address: 'Av. de Champel 8, Genève', rooms: '3p.', surface: '78m²', price: "CHF 625'000", date: 'Nov. 2025' },
  { address: 'Ch. de la Gradelle 22, Genève', rooms: '5p.', surface: '115m²', price: "CHF 812'000", date: 'Sept. 2025' },
]

interface FormData {
  propertyType: string
  address: string
  postalCode: string
  canton: string
  surface: string
  landSurface: string
  rooms: string
  bedrooms: string
  yearBuilt: string
  condition: string
  floor: string
  parking: string
  view: string
  balconySurface: string
  hasBalcony: boolean
  hasElevator: boolean
}

const initialFormData: FormData = {
  propertyType: '',
  address: '',
  postalCode: '',
  canton: '',
  surface: '',
  landSurface: '',
  rooms: '',
  bedrooms: '',
  yearBuilt: '',
  condition: '',
  floor: '',
  parking: '',
  view: '',
  balconySurface: '',
  hasBalcony: false,
  hasElevator: false,
}

export default function EstimationForm() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [showDetails, setShowDetails] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingText, setLoadingText] = useState('')
  const [loadingProgress, setLoadingProgress] = useState(0)
  const [showResult, setShowResult] = useState(false)

  // Lead capture modal
  const [showLeadModal, setShowLeadModal] = useState(false)
  const [leadEmail, setLeadEmail] = useState('')
  const [leadName, setLeadName] = useState('')
  const [leadPhone, setLeadPhone] = useState('')
  const [leadEmailError, setLeadEmailError] = useState('')

  const showLandSurface = ['house', 'villa', 'land'].includes(formData.propertyType)
  const isApartment = formData.propertyType === 'apartment'

  function updateField<K extends keyof FormData>(field: K, value: FormData[K]) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  function handleStep1Submit() {
    if (!formData.propertyType || !formData.address || !formData.postalCode || !formData.canton) return
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handleStep2Submit() {
    if (!formData.surface || !formData.rooms || !formData.bedrooms || !formData.condition) return
    setShowLeadModal(true)
  }

  function validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  function handleLeadSubmit() {
    setLeadEmailError('')
    if (!leadEmail.trim()) {
      setLeadEmailError('Veuillez entrer votre adresse email')
      return
    }
    if (!validateEmail(leadEmail)) {
      setLeadEmailError('Veuillez entrer une adresse email valide')
      return
    }

    setShowLeadModal(false)
    setStep(3)
    setLoading(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })

    const texts = [
      'Analyse de votre bien en cours...',
      "Comparaison avec 47'000 transactions...",
      'Calcul de la fourchette de prix...',
    ]

    setLoadingText(texts[0])
    setLoadingProgress(0)

    const interval = setInterval(() => {
      setLoadingProgress((prev) => Math.min(prev + 2, 100))
    }, 30)

    setTimeout(() => setLoadingText(texts[1]), 500)
    setTimeout(() => setLoadingText(texts[2]), 1000)
    setTimeout(() => {
      clearInterval(interval)
      setLoadingProgress(100)
      setLoading(false)
      setShowResult(true)
    }, 1500)
  }

  function handleReset() {
    setStep(1)
    setFormData(initialFormData)
    setShowDetails(false)
    setLoading(false)
    setShowResult(false)
    setLoadingProgress(0)
    setLeadEmail('')
    setLeadName('')
    setLeadPhone('')
    setLeadEmailError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePdfDownload() {
    // Placeholder toast
    const toast = document.createElement('div')
    toast.textContent = 'Bientôt disponible'
    toast.className =
      'fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-sm px-4 py-2 rounded-full shadow-lg z-50'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2500)
  }

  // Stepper
  const stepLabels = ['Votre bien', 'Caractéristiques', 'Résultat']

  return (
    <div className="max-w-3xl mx-auto -mt-4 px-4">
      {/* Stepper */}
      <div className="flex items-center justify-center mb-8">
        {stepLabels.map((label, i) => {
          const stepNum = i + 1
          const isActive = step === stepNum
          const isCompleted = step > stepNum
          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                    isCompleted && 'bg-success text-white',
                    isActive && 'bg-accent text-white',
                    !isActive && !isCompleted && 'bg-gray-200 text-gray-400'
                  )}
                >
                  {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                </div>
                <span
                  className={cn(
                    'text-xs mt-1.5 whitespace-nowrap',
                    isActive ? 'font-medium text-primary' : 'text-gray-400'
                  )}
                >
                  {label}
                </span>
              </div>
              {i < stepLabels.length - 1 && (
                <div
                  className={cn(
                    'w-16 md:w-24 h-0.5 mx-3 mt-[-18px]',
                    step > stepNum ? 'bg-accent' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step 1 */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
          <h3 className="text-lg font-semibold text-primary mb-6">Type de bien</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {PROPERTY_TYPES.map((type) => {
              const Icon = type.icon
              const selected = formData.propertyType === type.value
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => updateField('propertyType', type.value)}
                  className={cn(
                    'rounded-xl p-4 text-center transition-all cursor-pointer',
                    selected
                      ? 'border-2 border-accent bg-accent/5'
                      : 'border border-gray-200 hover:border-accent/50 hover:bg-accent/5'
                  )}
                >
                  <Icon className={cn('w-8 h-8 mx-auto', selected ? 'text-accent' : 'text-gray-400')} />
                  <span className="text-sm font-medium mt-2 block">{type.label}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">Adresse du bien</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={formData.address}
                onChange={(e) => updateField('address', e.target.value)}
                placeholder="Entrez l'adresse complète (rue, numéro, ville)"
                className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all"
              />
            </div>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="w-1/3">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Code postal</label>
              <input
                type="text"
                inputMode="numeric"
                value={formData.postalCode}
                onChange={(e) => updateField('postalCode', e.target.value)}
                placeholder="1201"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all"
              />
            </div>
            <div className="w-2/3">
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Canton</label>
              <select
                value={formData.canton}
                onChange={(e) => updateField('canton', e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all bg-white appearance-none cursor-pointer"
              >
                <option value="">Sélectionner...</option>
                {CANTONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <Button
            onClick={handleStep1Submit}
            disabled={!formData.propertyType || !formData.address || !formData.postalCode || !formData.canton}
            className="w-full h-12 rounded-full text-lg font-medium mt-6"
          >
            Continuer &rarr;
          </Button>
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8">
          <button
            onClick={() => setStep(1)}
            className="flex items-center gap-1.5 text-sm text-accent hover:underline mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Surface habitable */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Surface habitable</label>
              <div className="relative">
                <input
                  type="number"
                  value={formData.surface}
                  onChange={(e) => updateField('surface', e.target.value)}
                  placeholder="ex: 95"
                  className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">m²</span>
              </div>
            </div>

            {/* Surface terrain */}
            {showLandSurface && (
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Surface du terrain <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={formData.landSurface}
                    onChange={(e) => updateField('landSurface', e.target.value)}
                    placeholder="ex: 500"
                    className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">m²</span>
                </div>
              </div>
            )}

            {/* Nombre de pièces */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nombre de pièces</label>
              <select
                value={formData.rooms}
                onChange={(e) => updateField('rooms', e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all bg-white appearance-none cursor-pointer"
              >
                <option value="">Sélectionner...</option>
                {ROOM_OPTIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            {/* Nombre de chambres */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Nombre de chambres</label>
              <select
                value={formData.bedrooms}
                onChange={(e) => updateField('bedrooms', e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all bg-white appearance-none cursor-pointer"
              >
                <option value="">Sélectionner...</option>
                {BEDROOM_OPTIONS.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>

            {/* Année de construction */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5 block">Année de construction</label>
              <input
                type="number"
                value={formData.yearBuilt}
                onChange={(e) => updateField('yearBuilt', e.target.value)}
                placeholder="ex: 1985"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all"
              />
            </div>
          </div>

          {/* État général */}
          <div className="mt-6">
            <label className="text-sm font-medium text-gray-700 mb-3 block">État général du bien</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {CONDITIONS.map((cond) => {
                const Icon = cond.icon
                const selected = formData.condition === cond.value
                return (
                  <button
                    key={cond.value}
                    type="button"
                    onClick={() => updateField('condition', cond.value)}
                    className={cn(
                      'rounded-xl p-3 text-center transition-all cursor-pointer',
                      selected
                        ? 'border-2 border-accent bg-accent/5'
                        : 'border border-gray-200 hover:border-accent/50 hover:bg-accent/5'
                    )}
                  >
                    <Icon className={cn('w-5 h-5 mx-auto', selected ? 'text-accent' : 'text-gray-400')} />
                    <span className="text-xs font-medium mt-1 block">{cond.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* More details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mt-6 transition-colors"
          >
            <ChevronDown className={cn('w-4 h-4 transition-transform', showDetails && 'rotate-180')} />
            Plus de détails
          </button>

          {showDetails && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-100">
              {isApartment && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Étage</label>
                  <select
                    value={formData.floor}
                    onChange={(e) => updateField('floor', e.target.value)}
                    className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all bg-white appearance-none cursor-pointer"
                  >
                    <option value="">Sélectionner...</option>
                    {FLOOR_OPTIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Parking</label>
                <select
                  value={formData.parking}
                  onChange={(e) => updateField('parking', e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all bg-white appearance-none cursor-pointer"
                >
                  <option value="">Sélectionner...</option>
                  {PARKING_OPTIONS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">Vue</label>
                <select
                  value={formData.view}
                  onChange={(e) => updateField('view', e.target.value)}
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all bg-white appearance-none cursor-pointer"
                >
                  <option value="">Sélectionner...</option>
                  {VIEW_OPTIONS.map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="toggle-balcony" className="text-sm font-medium text-gray-700 mb-1.5 block">Balcon / Terrasse</label>
                <div className="flex items-center gap-3">
                  <label
                    htmlFor="toggle-balcony"
                    role="switch"
                    aria-checked={formData.hasBalcony}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors cursor-pointer',
                      formData.hasBalcony ? 'bg-accent' : 'bg-gray-200'
                    )}
                  >
                    <input
                      id="toggle-balcony"
                      type="checkbox"
                      checked={formData.hasBalcony}
                      onChange={() => updateField('hasBalcony', !formData.hasBalcony)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        formData.hasBalcony && 'translate-x-5'
                      )}
                    />
                  </label>
                  {formData.hasBalcony && (
                    <div className="relative flex-1">
                      <input
                        type="number"
                        value={formData.balconySurface}
                        onChange={(e) => updateField('balconySurface', e.target.value)}
                        placeholder="Surface"
                        aria-label="Surface du balcon en m²"
                        className="w-full h-10 px-3 pr-10 rounded-lg border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-sm outline-none transition-all"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">m²</span>
                    </div>
                  )}
                </div>
              </div>

              {isApartment && (
                <div>
                  <label htmlFor="toggle-elevator" className="text-sm font-medium text-gray-700 mb-1.5 block">Ascenseur</label>
                  <label
                    htmlFor="toggle-elevator"
                    role="switch"
                    aria-checked={formData.hasElevator}
                    className={cn(
                      'relative w-11 h-6 rounded-full transition-colors cursor-pointer inline-block',
                      formData.hasElevator ? 'bg-accent' : 'bg-gray-200'
                    )}
                  >
                    <input
                      id="toggle-elevator"
                      type="checkbox"
                      checked={formData.hasElevator}
                      onChange={() => updateField('hasElevator', !formData.hasElevator)}
                      className="sr-only"
                    />
                    <div
                      className={cn(
                        'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                        formData.hasElevator && 'translate-x-5'
                      )}
                    />
                  </label>
                </div>
              )}
            </div>
          )}

          <Button
            onClick={handleStep2Submit}
            disabled={!formData.surface || !formData.rooms || !formData.bedrooms || !formData.condition}
            className="w-full h-12 rounded-full text-lg font-medium mt-6"
          >
            Obtenir mon estimation &rarr;
          </Button>
        </div>
      )}

      {/* Step 3 — Loading */}
      {step === 3 && loading && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 md:p-10 text-center">
          <div className="w-12 h-12 border-3 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-base font-medium text-primary mt-6">{loadingText}</p>
          <div className="mt-6 max-w-xs mx-auto">
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all duration-100"
                style={{ width: `${loadingProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3 — Result */}
      {step === 3 && showResult && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 md:p-10 animate-in fade-in duration-500">
          <div className="text-center">
            <span className="bg-accent/10 text-accent text-sm font-medium px-4 py-1.5 rounded-full inline-block">
              Estimation IA MEGGA
            </span>
            <p className="text-gray-500 text-sm mt-2">{formData.address}</p>
            <p className="text-gray-400 text-xs mt-0.5">
              {PROPERTY_TYPES.find((t) => t.value === formData.propertyType)?.label} · {formData.rooms} pièces · {formData.surface} m²
            </p>
          </div>

          {/* Price range bar */}
          <div className="mt-8">
            <div className="flex items-end justify-center gap-1 mb-2">
              <span className="text-4xl font-bold text-accent">CHF 715'000</span>
            </div>
            <p className="text-center text-gray-500 text-sm">entre CHF 650'000 et CHF 780'000</p>

            <div className="mt-4 flex items-center gap-0.5 max-w-md mx-auto">
              <div className="flex-1 h-2 bg-gray-200 rounded-l-full" />
              <div className="flex-[2] h-3 bg-accent rounded-sm relative">
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-5 bg-accent rounded-sm" />
              </div>
              <div className="flex-1 h-2 bg-gray-200 rounded-r-full" />
            </div>
            <div className="flex justify-between max-w-md mx-auto mt-1.5 text-xs text-gray-400">
              <span>CHF 650'000</span>
              <span>CHF 780'000</span>
            </div>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 gap-4 mt-8">
            <div className="bg-gray-50 rounded-xl p-4">
              <Maximize2 className="w-5 h-5 text-accent mb-2" />
              <p className="text-xs text-gray-500">Prix au m²</p>
              <p className="text-sm font-semibold text-primary">CHF 7'520/m²</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <BarChart3 className="w-5 h-5 text-accent mb-2" />
              <p className="text-xs text-gray-500">Transactions similaires</p>
              <p className="text-sm font-semibold text-primary">47 dans votre secteur</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <TrendingUp className="w-5 h-5 text-success mb-2" />
              <p className="text-xs text-gray-500">Tendance 12 mois</p>
              <p className="text-sm font-semibold text-success">+3.1%</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <Shield className="w-5 h-5 text-success mb-2" />
              <p className="text-xs text-gray-500">Indice de confiance</p>
              <p className="text-sm font-semibold text-success">Élevé</p>
            </div>
          </div>

          {/* Comparable properties */}
          <div className="mt-8">
            <h4 className="text-sm font-semibold text-primary mb-3">
              Biens similaires récemment vendus dans votre secteur
            </h4>
            <div className="space-y-2">
              {COMPARABLE_PROPERTIES.map((prop, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-lg p-3">
                  <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                    <img
                      src={`https://images.unsplash.com/photo-${
                        ['1560448204-e02f11c3d0e2', '1522708323590-d24dbb6b0267', '1600596542815-ffad4c1539a8'][i]
                      }?w=128&h=128&fit=crop`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-primary truncate">{prop.address}</p>
                    <p className="text-xs text-gray-500">
                      {prop.rooms} · {prop.surface} · Vendu {prop.price} · {prop.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-xs text-gray-400 italic mt-6 border-t border-gray-100 pt-4">
            Cette estimation est fournie à titre indicatif. Elle est basée sur l'analyse statistique de transactions
            similaires dans votre secteur. Pour une évaluation précise prenant en compte les spécificités de votre
            bien, nous recommandons une expertise sur place par un agent certifié.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <Link to="/register" className="flex-1">
              <Button className="w-full h-11 rounded-full font-medium">
                Contacter un agent pour affiner
              </Button>
            </Link>
            <Button
              variant="outline"
              onClick={handleReset}
              className="flex-1 h-11 rounded-full font-medium"
            >
              Nouvelle estimation
            </Button>
          </div>

          <button
            onClick={handlePdfDownload}
            className="flex items-center justify-center gap-1.5 text-sm text-accent hover:underline mt-4 mx-auto"
          >
            <Download className="w-3.5 h-3.5" />
            Télécharger le rapport PDF
          </button>
        </div>
      )}

      {/* Lead capture modal */}
      {showLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLeadModal(false)}
          />

          {/* Modal */}
          <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-md p-6 md:p-8 animate-in fade-in zoom-in-95 duration-200">
            <button
              onClick={() => setShowLeadModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="text-center mb-6">
              <div className="bg-accent/10 rounded-full p-3 w-fit mx-auto mb-4">
                <Mail className="w-6 h-6 text-accent" />
              </div>
              <h3 className="text-xl font-semibold text-primary">
                Votre estimation est prête !
              </h3>
              <p className="text-sm text-gray-500 mt-1.5">
                Entrez votre email pour recevoir votre estimation détaillée et accéder à votre résultat.
              </p>
            </div>

            {/* Form */}
            <div className="space-y-3">
              {/* Email — required */}
              <div>
                <label htmlFor="lead-email" className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Email <span className="text-danger">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="lead-email"
                    type="email"
                    value={leadEmail}
                    onChange={(e) => { setLeadEmail(e.target.value); setLeadEmailError('') }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLeadSubmit() }}
                    placeholder="votre@email.ch"
                    autoFocus
                    className={cn(
                      'w-full h-12 pl-10 pr-4 rounded-xl border text-base outline-none transition-all',
                      leadEmailError
                        ? 'border-danger focus:border-danger focus:ring-2 focus:ring-danger/20'
                        : 'border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20'
                    )}
                  />
                </div>
                {leadEmailError && (
                  <p className="text-xs text-danger mt-1">{leadEmailError}</p>
                )}
              </div>

              {/* Name — optional */}
              <div>
                <label htmlFor="lead-name" className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Prénom <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="lead-name"
                    type="text"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLeadSubmit() }}
                    placeholder="Jean"
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all"
                  />
                </div>
              </div>

              {/* Phone — optional */}
              <div>
                <label htmlFor="lead-phone" className="text-sm font-medium text-gray-700 mb-1.5 block">
                  Téléphone <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    id="lead-phone"
                    type="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleLeadSubmit() }}
                    placeholder="+41 79 000 00 00"
                    className="w-full h-12 pl-10 pr-4 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 text-base outline-none transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <Button
              onClick={handleLeadSubmit}
              className="w-full h-12 rounded-full text-base font-medium mt-5"
            >
              Voir mon estimation &rarr;
            </Button>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-1.5 mt-4">
              <Lock className="w-3 h-3 text-gray-400" />
              <p className="text-xs text-gray-400">
                Vos données sont protégées et ne seront jamais partagées.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
