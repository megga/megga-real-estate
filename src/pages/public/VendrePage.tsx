import { useState, useCallback, useRef, useEffect } from 'react'
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
  ArrowLeft,
  ArrowRight,
  Upload,
  X,
  Image as ImageIcon,
  Phone,
  Mail,
  User,
  Lock,
  Loader2,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { usePropertyEstimation, type EstimationParams, type EstimationResult } from '@/hooks/usePropertyEstimation'
import { useSellerLead } from '@/hooks/useSellerLead'
import EstimationIllustration from '@/components/illustrations/EstimationIllustration'
import { supabase } from '@/lib/supabase'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string

// ─── Constants ───────────────────────────────────────────

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement', icon: Building2 },
  { value: 'house', label: 'Maison', icon: Home },
  { value: 'villa', label: 'Villa', icon: Castle },
  { value: 'land', label: 'Terrain', icon: Trees },
  { value: 'commercial', label: 'Commercial', icon: Store },
] as const

const CONDITIONS = [
  { value: 'new', label: 'Neuf', icon: Sparkles },
  { value: 'renovated', label: 'Rénové', icon: Wrench },
  { value: 'good', label: 'Bon état', icon: ThumbsUp },
  { value: 'refresh', label: 'À rafraîchir', icon: Paintbrush },
  { value: 'renovate', label: 'À rénover', icon: HardHat },
] as const

const ROOM_OPTIONS = ['1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6', '6.5', '7', '8+']
const BEDROOM_OPTIONS = ['1', '2', '3', '4', '5', '6+']

const MOTIVATIONS = [
  { value: 'immediate', label: 'Dès que possible' },
  { value: '3months', label: 'Dans les 3 mois' },
  { value: '6months', label: 'Dans les 6 mois' },
  { value: 'exploring', label: "J'explore les options" },
] as const

const CANTON_LABELS: Record<string, string> = {
  GE: 'Genève', VD: 'Vaud', VS: 'Valais', NE: 'Neuchâtel', FR: 'Fribourg',
  BE: 'Berne', JU: 'Jura', BS: 'Bâle-Ville', BL: 'Bâle-Campagne', AG: 'Argovie',
  SO: 'Soleure', ZH: 'Zurich', LU: 'Lucerne', ZG: 'Zoug', SZ: 'Schwyz',
  NW: 'Nidwald', OW: 'Obwald', UR: 'Uri', GL: 'Glaris', SH: 'Schaffhouse',
  TG: 'Thurgovie', AR: 'Appenzell RE', AI: 'Appenzell RI', SG: 'Saint-Gall',
  GR: 'Grisons', TI: 'Tessin',
}

// ─── Types ───────────────────────────────────────────────

interface GeocodingResult {
  place_name: string
  text: string
  center: [number, number]
  context: { id: string; text: string; short_code?: string }[]
}

interface FormData {
  // Step 1 — Address
  address: string
  city: string
  canton: string
  postalCode: string
  lat: number | undefined
  lng: number | undefined
  // Step 2 — Details
  propertyType: string
  rooms: string
  bedrooms: string
  surface: string
  condition: string
  yearBuilt: string
  // Step 3 — Photos
  photos: File[]
  photoUrls: string[]
  // Step 4 — Contact
  contactName: string
  contactEmail: string
  contactPhone: string
  motivation: string
}

const STEP_LABELS = ['Adresse', 'Détails', 'Photos', 'Contact']

// ─── Component ───────────────────────────────────────────

export default function VendrePage() {
  const [step, setStep] = useState(0) // 0 = hero, 1-4 = wizard steps
  const [form, setForm] = useState<FormData>({
    address: '', city: '', canton: '', postalCode: '', lat: undefined, lng: undefined,
    propertyType: '', rooms: '', bedrooms: '', surface: '', condition: '', yearBuilt: '',
    photos: [], photoUrls: [],
    contactName: '', contactEmail: '', contactPhone: '', motivation: '',
  })

  // Geocoding state
  const [geoQuery, setGeoQuery] = useState('')
  const [geoResults, setGeoResults] = useState<GeocodingResult[]>([])
  const [geoOpen, setGeoOpen] = useState(false)
  const geoTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const wizardRef = useRef<HTMLDivElement>(null)

  // Estimation
  const [estimationParams, setEstimationParams] = useState<EstimationParams | null>(null)
  const [showEstimation, setShowEstimation] = useState(false)
  const { data: estimation, isLoading: estimationLoading } = usePropertyEstimation(estimationParams)

  // Lead submission
  const sellerLead = useSellerLead()
  const [submitted, setSubmitted] = useState(false)

  // Photo upload state
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ─── Geocoding ─────────────────────────────────────────

  const searchGeo = useCallback((query: string) => {
    setGeoQuery(query)
    if (geoTimer.current) clearTimeout(geoTimer.current)
    if (!query || query.length < 3 || !MAPBOX_TOKEN) {
      setGeoResults([])
      setGeoOpen(false)
      return
    }
    geoTimer.current = setTimeout(async () => {
      try {
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?country=ch&language=fr&types=address,place&limit=5&access_token=${MAPBOX_TOKEN}`
        const res = await fetch(url)
        const json = await res.json()
        if (json.features?.length) {
          setGeoResults(json.features)
          setGeoOpen(true)
        } else {
          setGeoResults([])
          setGeoOpen(false)
        }
      } catch {
        setGeoResults([])
      }
    }, 350)
  }, [])

  function selectGeoResult(result: GeocodingResult) {
    const ctx = result.context || []
    let canton = ''
    let city = ''
    let postalCode = ''

    for (const c of ctx) {
      if (c.id.startsWith('region') && c.short_code) {
        // short_code = "CH-GE" → "GE"
        canton = c.short_code.replace('CH-', '')
      }
      if (c.id.startsWith('place')) city = c.text
      if (c.id.startsWith('postcode')) postalCode = c.text
    }

    setForm(prev => ({
      ...prev,
      address: result.place_name,
      city,
      canton,
      postalCode,
      lat: result.center[1],
      lng: result.center[0],
    }))
    setGeoQuery(result.place_name)
    setGeoOpen(false)
  }

  // ─── Photos ────────────────────────────────────────────

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const newPhotos = [...form.photos, ...files].slice(0, 10)
    const newUrls = newPhotos.map(f => URL.createObjectURL(f))
    setForm(prev => ({ ...prev, photos: newPhotos, photoUrls: newUrls }))
  }

  function removePhoto(index: number) {
    const newPhotos = form.photos.filter((_, i) => i !== index)
    const newUrls = newPhotos.map(f => URL.createObjectURL(f))
    setForm(prev => ({ ...prev, photos: newPhotos, photoUrls: newUrls }))
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (!files.length) return
    const newPhotos = [...form.photos, ...files].slice(0, 10)
    const newUrls = newPhotos.map(f => URL.createObjectURL(f))
    setForm(prev => ({ ...prev, photos: newPhotos, photoUrls: newUrls }))
  }

  // ─── Upload photos to Supabase Storage ─────────────────

  async function uploadPhotos(): Promise<string[]> {
    const urls: string[] = []
    for (const file of form.photos) {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `seller-leads/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('property-photos').upload(path, file)
      if (!error) {
        const { data: urlData } = supabase.storage.from('property-photos').getPublicUrl(path)
        urls.push(urlData.publicUrl)
      }
    }
    return urls
  }

  // ─── Navigation ────────────────────────────────────────

  function startWizard(type?: string) {
    if (type) {
      setForm(prev => ({ ...prev, propertyType: type }))
    }
    setStep(1)
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function goNext() {
    if (step < 4) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  function goBack() {
    if (showEstimation) {
      setShowEstimation(false)
      return
    }
    if (step > 1) {
      setStep(step - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // ─── Trigger estimation ────────────────────────────────

  function triggerEstimation() {
    if (!form.canton || !form.surface) return
    setEstimationParams({
      canton: form.canton,
      city: form.city || undefined,
      type: form.propertyType || undefined,
      surface: parseInt(form.surface) || undefined,
    })
    setShowEstimation(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ─── Submit lead ───────────────────────────────────────

  async function handleSubmit() {
    if (!estimation) return
    setUploading(true)
    try {
      const photoUrls = form.photos.length > 0 ? await uploadPhotos() : []

      await sellerLead.mutateAsync({
        propertyData: {
          address: form.address,
          city: form.city,
          canton: form.canton,
          postalCode: form.postalCode,
          lat: form.lat,
          lng: form.lng,
          type: form.propertyType,
          rooms: form.rooms,
          bedrooms: form.bedrooms,
          surface: parseInt(form.surface),
          condition: form.condition,
          yearBuilt: form.yearBuilt,
          photos: photoUrls,
        },
        estimation,
        contactName: form.contactName,
        contactEmail: form.contactEmail,
        contactPhone: form.contactPhone,
        motivation: form.motivation as 'immediate' | '3months' | '6months' | 'exploring',
      })
      setSubmitted(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Error handled by mutation state
    } finally {
      setUploading(false)
    }
  }

  // ─── Validation ────────────────────────────────────────

  const step1Valid = form.address.length > 3 && form.canton.length > 0
  const step2Valid = form.propertyType && form.rooms && form.surface && form.condition
  const step3Valid = form.photos.length >= 3
  const step4Valid = form.contactName.length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail) && form.motivation

  // ─── Render ────────────────────────────────────────────

  // Success screen
  if (submitted) {
    return (
      <SuccessScreen
        form={form}
        estimation={estimation}
        onReset={() => {
          setSubmitted(false)
          setStep(0)
          setForm({
            address: '', city: '', canton: '', postalCode: '', lat: undefined, lng: undefined,
            propertyType: '', rooms: '', bedrooms: '', surface: '', condition: '', yearBuilt: '',
            photos: [], photoUrls: [],
            contactName: '', contactEmail: '', contactPhone: '', motivation: '',
          })
          setShowEstimation(false)
          setEstimationParams(null)
        }}
      />
    )
  }

  // Estimation result screen (between step 3 and step 4)
  if (showEstimation) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 pt-10 pb-20">
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-900 mb-10 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </button>

          {estimationLoading ? (
            <EstimationLoading />
          ) : estimation ? (
            <EstimationResultView
              estimation={estimation}
              form={form}
              onContinue={() => { setShowEstimation(false); setStep(4); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
            />
          ) : (
            <div className="text-center py-20">
              <p className="text-gray-500">Donnees insuffisantes pour estimer ce bien.</p>
              <button onClick={goBack} className="mt-4 text-sm text-gray-900 underline">
                Modifier les informations
              </button>
            </div>
          )}
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ─── Hero Section ─── */}
      {step === 0 && (
        <section className="pt-20 pb-16 md:pt-28 md:pb-24 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight leading-[1.1]">
              Combien vaut votre bien ?
            </h1>
            <p className="text-lg text-gray-500 mt-5 max-w-lg mx-auto leading-relaxed">
              Estimation gratuite et instantanee basee sur {formatCHF(38000).replace('CHF ', '')}+ biens analyses en Suisse
            </p>

            {/* Trust indicators */}
            <div className="flex items-center justify-center gap-6 mt-6">
              {['Gratuit', 'Instantane', 'Confidentiel'].map(label => (
                <span key={label} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-900" />
                  {label}
                </span>
              ))}
            </div>

            {/* Property type selector — hero */}
            <div className="mt-12 max-w-lg mx-auto">
              <p className="text-sm text-gray-400 mb-4">
                Quel type de bien souhaitez-vous estimer ?
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {PROPERTY_TYPES.map(type => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      onClick={() => startWizard(type.value)}
                      className="rounded-xl border border-gray-200 p-4 text-center hover:border-gray-900 transition-colors group cursor-pointer"
                    >
                      <Icon className="w-7 h-7 mx-auto text-gray-400 group-hover:text-gray-900 transition-colors" />
                      <span className="text-sm font-medium mt-2 block text-gray-700 group-hover:text-gray-900 transition-colors">
                        {type.label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Social proof */}
            <p className="text-xs text-gray-400 mt-10">
              12'500+ estimations realisees
            </p>
          </div>
        </section>
      )}

      {/* ─── Wizard ─── */}
      {step >= 1 && (
        <div ref={wizardRef} className="max-w-xl mx-auto px-4 pt-10 pb-20">

          {/* Stepper */}
          <div className="flex items-center justify-center mb-12">
            {STEP_LABELS.map((label, i) => {
              const num = i + 1
              const isCurrent = step === num
              const isDone = step > num
              return (
                <div key={label} className="flex items-center">
                  {i > 0 && (
                    <div className={cn(
                      'w-10 sm:w-14 h-px mx-1',
                      isDone || isCurrent ? 'bg-gray-900' : 'bg-gray-200'
                    )} />
                  )}
                  <button
                    onClick={() => { if (isDone) setStep(num) }}
                    disabled={!isDone}
                    className="flex items-center gap-2"
                  >
                    <span className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                      isCurrent ? 'bg-gray-900 text-white' :
                      isDone ? 'bg-gray-900 text-white' :
                      'border border-gray-200 text-gray-400'
                    )}>
                      {isDone ? (
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12l5 5L20 7" />
                        </svg>
                      ) : num}
                    </span>
                    <span className={cn(
                      'text-sm hidden sm:block',
                      isCurrent ? 'text-gray-900 font-medium' :
                      isDone ? 'text-gray-600' :
                      'text-gray-400'
                    )}>
                      {label}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Step 1 — Address */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Ou se trouve votre bien ?
                </h2>
                <p className="text-sm text-gray-500">
                  Commencez a taper l'adresse pour obtenir des suggestions
                </p>
              </div>

              <div className="relative">
                <div className="relative">
                  <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={geoQuery}
                    onChange={e => searchGeo(e.target.value)}
                    onFocus={() => { if (geoResults.length) setGeoOpen(true) }}
                    placeholder="Rue, numero, ville..."
                    autoFocus
                    className="w-full h-14 pl-12 pr-4 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-base outline-none transition-all"
                  />
                </div>

                {/* Autocomplete dropdown */}
                {geoOpen && geoResults.length > 0 && (
                  <div className="absolute z-30 left-0 right-0 mt-1 bg-white rounded-xl border border-gray-200 overflow-hidden">
                    {geoResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => selectGeoResult(r)}
                        className="w-full text-left px-4 py-3.5 text-sm hover:bg-gray-50 transition-colors flex items-start gap-3 border-b border-gray-50 last:border-0"
                      >
                        <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <span className="text-gray-700">{r.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Address chips */}
              {form.canton && (
                <div className="flex flex-wrap gap-2">
                  {form.city && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">
                      {form.city}
                    </span>
                  )}
                  <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">
                    {CANTON_LABELS[form.canton] || form.canton}
                  </span>
                  {form.postalCode && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-3 py-1.5 rounded-full">
                      {form.postalCode}
                    </span>
                  )}
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep(0)}
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors"
                >
                  Retour
                </button>
                <button
                  onClick={goNext}
                  disabled={!step1Valid}
                  className={cn(
                    'h-11 px-8 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                    step1Valid
                      ? 'border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                      : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Details */}
          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Decrivez votre bien
                </h2>
                <p className="text-sm text-gray-500">
                  Ces informations permettent d'affiner l'estimation
                </p>
              </div>

              {/* Property type */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">Type de bien</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  {PROPERTY_TYPES.map(type => {
                    const Icon = type.icon
                    const selected = form.propertyType === type.value
                    return (
                      <button
                        key={type.value}
                        onClick={() => setForm(prev => ({ ...prev, propertyType: type.value }))}
                        className={cn(
                          'rounded-xl p-4 text-center transition-all cursor-pointer',
                          selected
                            ? 'border-2 border-gray-900 bg-gray-50'
                            : 'border border-gray-200 hover:border-gray-400'
                        )}
                      >
                        <Icon className={cn('w-7 h-7 mx-auto', selected ? 'text-gray-900' : 'text-gray-400')} />
                        <span className="text-sm font-medium mt-2 block">{type.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Rooms + Bedrooms */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Pieces</label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROOM_OPTIONS.slice(0, 10).map(r => (
                      <button
                        key={r}
                        onClick={() => setForm(prev => ({ ...prev, rooms: r }))}
                        className={cn(
                          'h-9 px-3 rounded-lg text-sm transition-colors',
                          form.rooms === r
                            ? 'bg-gray-900 text-white font-medium'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">Chambres</label>
                  <div className="flex flex-wrap gap-1.5">
                    {BEDROOM_OPTIONS.map(b => (
                      <button
                        key={b}
                        onClick={() => setForm(prev => ({ ...prev, bedrooms: b }))}
                        className={cn(
                          'h-9 px-3 rounded-lg text-sm transition-colors',
                          form.bedrooms === b
                            ? 'bg-gray-900 text-white font-medium'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        )}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Surface */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Surface habitable</label>
                <div className="relative">
                  <input
                    type="number"
                    value={form.surface}
                    onChange={e => setForm(prev => ({ ...prev, surface: e.target.value }))}
                    placeholder="ex: 95"
                    className="w-full h-12 px-4 pr-12 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-base outline-none transition-all"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">m2</span>
                </div>
              </div>

              {/* Condition */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">Etat general</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {CONDITIONS.map(cond => {
                    const Icon = cond.icon
                    const selected = form.condition === cond.value
                    return (
                      <button
                        key={cond.value}
                        onClick={() => setForm(prev => ({ ...prev, condition: cond.value }))}
                        className={cn(
                          'rounded-xl p-3 text-center transition-all cursor-pointer',
                          selected
                            ? 'border-2 border-gray-900 bg-gray-50'
                            : 'border border-gray-200 hover:border-gray-400'
                        )}
                      >
                        <Icon className={cn('w-5 h-5 mx-auto', selected ? 'text-gray-900' : 'text-gray-400')} />
                        <span className="text-xs font-medium mt-1 block">{cond.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Year built (optional) */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Annee de construction <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <input
                  type="number"
                  value={form.yearBuilt}
                  onChange={e => setForm(prev => ({ ...prev, yearBuilt: e.target.value }))}
                  placeholder="ex: 1985"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-base outline-none transition-all"
                />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={goBack}
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
                <button
                  onClick={goNext}
                  disabled={!step2Valid}
                  className={cn(
                    'h-11 px-8 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                    step2Valid
                      ? 'border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                      : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — Photos */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Ajoutez des photos
                </h2>
                <p className="text-sm text-gray-500">
                  Minimum 3 photos. Les photos aident a affiner l'estimation.
                </p>
              </div>

              {/* Drop zone */}
              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-600 font-medium">
                  Glissez vos photos ici
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  ou cliquez pour selectionner (max 10)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>

              {/* Photo previews */}
              {form.photoUrls.length > 0 && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {form.photoUrls.map((url, i) => (
                    <div key={i} className="relative aspect-[4/3] rounded-lg overflow-hidden group">
                      <img src={url} alt="" className="w-full h-full object-cover" />
                      <button
                        onClick={e => { e.stopPropagation(); removePhoto(i) }}
                        className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-gray-400">
                {form.photos.length}/10 photos
                {form.photos.length < 3 && (
                  <span className="text-amber-600 ml-1">
                    — encore {3 - form.photos.length} photo{3 - form.photos.length > 1 ? 's' : ''} requise{3 - form.photos.length > 1 ? 's' : ''}
                  </span>
                )}
              </p>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={goBack}
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
                <button
                  onClick={triggerEstimation}
                  disabled={!step3Valid}
                  className={cn(
                    'h-11 px-8 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                    step3Valid
                      ? 'border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                      : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Voir mon estimation
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {/* Skip photos option */}
              <div className="text-center">
                <button
                  onClick={triggerEstimation}
                  className="text-sm text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2"
                >
                  Passer cette etape
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Contact */}
          {step === 4 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  Vos coordonnees
                </h2>
                <p className="text-sm text-gray-500">
                  Un agent de votre region vous contactera sous 24h
                </p>
              </div>

              {/* Estimation summary mini */}
              {estimation?.estimation && (
                <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      Estimation : {formatCHF(estimation.estimation)}
                    </p>
                    <p className="text-xs text-gray-500 truncate max-w-xs">
                      {form.address}
                    </p>
                  </div>
                  <button
                    onClick={() => { setShowEstimation(true) }}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-700 transition-colors flex-shrink-0"
                  >
                    Revoir
                  </button>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Nom complet
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={form.contactName}
                    onChange={e => setForm(prev => ({ ...prev, contactName: e.target.value }))}
                    placeholder="Jean Dupont"
                    autoFocus
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-base outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={e => setForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                    placeholder="jean@example.ch"
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-base outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Telephone <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={form.contactPhone}
                    onChange={e => setForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                    placeholder="+41 79 000 00 00"
                    className="w-full h-12 pl-11 pr-4 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-base outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-3 block">
                  Quand souhaitez-vous vendre ?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {MOTIVATIONS.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setForm(prev => ({ ...prev, motivation: m.value }))}
                      className={cn(
                        'h-10 px-4 rounded-lg text-sm transition-colors',
                        form.motivation === m.value
                          ? 'bg-gray-900 text-white font-medium'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => { setShowEstimation(true) }}
                  className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!step4Valid || uploading || sellerLead.isPending}
                  className={cn(
                    'h-11 px-8 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                    step4Valid && !uploading && !sellerLead.isPending
                      ? 'border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white'
                      : 'border border-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                >
                  {(uploading || sellerLead.isPending) && <Loader2 className="w-4 h-4 animate-spin" />}
                  {uploading ? 'Upload des photos...' : sellerLead.isPending ? 'Envoi...' : 'Envoyer ma demande'}
                </button>
              </div>

              {sellerLead.isError && (
                <p className="text-sm text-red-600 text-center">
                  Une erreur est survenue. Veuillez reessayer.
                </p>
              )}

              <div className="flex items-center justify-center gap-1.5 pt-2">
                <Lock className="w-3 h-3 text-gray-400" />
                <p className="text-xs text-gray-400">
                  Vos donnees sont protegees et ne seront jamais partagees.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <Footer />
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────

function SuccessScreen({
  form,
  estimation,
  onReset,
}: {
  form: FormData
  estimation: EstimationResult | undefined
  onReset: () => void
}) {
  const typeLabel = PROPERTY_TYPES.find(t => t.value === form.propertyType)?.label || form.propertyType
  const firstName = form.contactName.split(' ')[0] || form.contactName

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        {/* Animated check */}
        <div className="w-20 h-20 rounded-full border-2 border-gray-900 flex items-center justify-center mx-auto mb-8">
          <svg className="w-10 h-10 text-gray-900" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" className="animate-[draw_0.5s_ease-out_0.3s_both]" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'draw 0.5s ease-out 0.3s forwards' }} />
          </svg>
        </div>
        <style>{`@keyframes draw { to { stroke-dashoffset: 0; } }`}</style>

        <h1 className="text-2xl font-bold text-gray-900">Merci {firstName} !</h1>
        <p className="text-gray-500 mt-2">Votre demande a ete envoyee avec succes.</p>

        {/* Recap box */}
        <div className="mt-8 rounded-xl border border-gray-200 p-6 text-left">
          <div className="flex items-center gap-4 mb-4">
            {form.photos[0] ? (
              <img src={URL.createObjectURL(form.photos[0])} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-gray-100 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-gray-400" />
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-gray-900">{typeLabel} {form.rooms}p</p>
              <p className="text-xs text-gray-500">{form.address}</p>
            </div>
          </div>
          {estimation && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-xs text-gray-400 mb-1">Estimation</p>
              <p className="text-lg font-bold text-gray-900">
                {estimation.estimation_min && estimation.estimation_max
                  ? `${formatCHF(estimation.estimation_min)} — ${formatCHF(estimation.estimation_max)}`
                  : estimation.estimation ? formatCHF(estimation.estimation) : '—'
                }
              </p>
            </div>
          )}
          <p className="text-sm text-gray-600">Un agent de votre region vous contactera sous 24h.</p>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Un email de confirmation a ete envoye a <strong>{form.contactEmail}</strong>
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Des que votre agent prendra en charge votre dossier, vous recevrez un acces
          a votre espace vendeur pour suivre la vente en temps reel.
        </p>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <a
            href="/"
            className="h-10 px-5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors inline-flex items-center"
          >
            Retour a l'accueil
          </a>
          <button
            onClick={onReset}
            className="h-10 px-5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors"
          >
            Estimer un autre bien
          </button>
        </div>
      </div>
      <Footer />
    </div>
  )
}

function EstimationLoading() {
  const [text, setText] = useState('Analyse de votre bien en cours...')
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const texts = [
      'Analyse de votre bien en cours...',
      "Comparaison avec 38'000+ biens suisses...",
      'Calcul de la fourchette de prix...',
    ]
    const t1 = setTimeout(() => setText(texts[1]), 600)
    const t2 = setTimeout(() => setText(texts[2]), 1200)
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 3, 95))
    }, 50)
    return () => { clearTimeout(t1); clearTimeout(t2); clearInterval(interval) }
  }, [])

  return (
    <div className="text-center py-20">
      <div className="w-12 h-12 border-[3px] border-gray-900 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-base font-medium text-gray-900 mt-6">{text}</p>
      <div className="mt-6 max-w-xs mx-auto">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gray-900 rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  )
}

function EstimationResultView({
  estimation,
  form,
  onContinue,
}: {
  estimation: EstimationResult
  form: FormData
  onContinue: () => void
}) {
  const typeLabel = PROPERTY_TYPES.find(t => t.value === form.propertyType)?.label || form.propertyType

  const confidenceLabel = {
    low: 'Faible',
    medium: 'Moyen',
    high: 'Eleve',
  }[estimation.confidence] || 'Moyen'

  const confidenceColor = {
    low: 'text-amber-600',
    medium: 'text-gray-600',
    high: 'text-emerald-600',
  }[estimation.confidence] || 'text-gray-600'

  const confidenceBarWidth = {
    low: '33%',
    medium: '60%',
    high: '90%',
  }[estimation.confidence] || '60%'

  const confidenceBarColor = {
    low: 'bg-amber-500',
    medium: 'bg-gray-400',
    high: 'bg-emerald-500',
  }[estimation.confidence] || 'bg-gray-400'

  return (
    <div className="animate-in fade-in duration-500">
      {/* Header */}
      <div className="text-center">
        <div className="w-40 h-32 mx-auto mb-6"><EstimationIllustration /></div>
        <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">
          estimation IA
        </p>
        <p className="text-sm text-gray-500 mt-2">{form.address}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {typeLabel} · {form.rooms} pieces · {form.surface} m2
        </p>
      </div>

      {/* Main price */}
      {estimation.estimation ? (
        <div className="mt-10 text-center">
          <p className="text-4xl md:text-5xl font-bold text-gray-900 tabular-nums tracking-tight">
            {formatCHF(estimation.estimation)}
          </p>
          {estimation.estimation_min && estimation.estimation_max && (
            <p className="text-sm text-gray-500 mt-3">
              entre {formatCHF(estimation.estimation_min)} et {formatCHF(estimation.estimation_max)}
            </p>
          )}

          {/* Range bar */}
          <div className="mt-6 flex items-center gap-0.5 max-w-sm mx-auto">
            <div className="flex-1 h-2 bg-gray-200 rounded-l-full" />
            <div className="flex-[2] h-3 bg-gray-900 rounded-sm relative">
              <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-5 bg-gray-900 rounded-sm" />
            </div>
            <div className="flex-1 h-2 bg-gray-200 rounded-r-full" />
          </div>
          {estimation.estimation_min && estimation.estimation_max && (
            <div className="flex justify-between max-w-sm mx-auto mt-1.5 text-xs text-gray-400">
              <span>{formatCHF(estimation.estimation_min)}</span>
              <span>{formatCHF(estimation.estimation_max)}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-10 text-center">
          <p className="text-gray-500">
            Donnees insuffisantes pour calculer une estimation precise.
          </p>
        </div>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mt-10">
        {estimation.median_price_m2 && (
          <div className="rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-xs text-gray-400">Prix au m2</p>
            <p className="text-sm font-bold text-gray-900 mt-1">
              {formatCHF(estimation.median_price_m2)}
            </p>
          </div>
        )}
        <div className="rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-400">Biens compares</p>
          <p className="text-sm font-bold text-gray-900 mt-1">
            {estimation.comparable_count}
          </p>
        </div>
        <div className="rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-xs text-gray-400">Confiance</p>
          <p className={cn('text-sm font-bold mt-1', confidenceColor)}>
            {confidenceLabel}
          </p>
          <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
            <div className={cn('h-full rounded-full', confidenceBarColor)} style={{ width: confidenceBarWidth }} />
          </div>
        </div>
      </div>

      {/* Comparables — horizontal scroll */}
      {estimation.comparables?.length > 0 && (
        <div className="mt-10">
          <h4 className="text-sm font-semibold text-gray-900 mb-4">
            Biens similaires sur le marche
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {estimation.comparables.map((comp, i) => (
              <div key={comp.id || i} className="flex-shrink-0 w-56 rounded-xl border border-gray-200 overflow-hidden">
                <div className="h-32 bg-gray-100">
                  {comp.photo_url ? (
                    <img src={comp.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatCHF(comp.price)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {comp.address || comp.city}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {comp.rooms ? `${comp.rooms}p. · ` : ''}{comp.surface_m2} m2
                    {comp.price_per_m2 && ` · ${formatCHF(comp.price_per_m2)}/m2`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-400 italic mt-8 border-t border-gray-100 pt-4">
        Cette estimation est fournie a titre indicatif, basee sur l'analyse statistique
        de biens similaires dans votre secteur. Pour une evaluation precise, un agent
        certifie peut visiter votre bien gratuitement.
      </p>

      {/* CTA */}
      <button
        onClick={onContinue}
        className="w-full h-12 rounded-lg text-base font-medium border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors mt-8 flex items-center justify-center gap-2"
      >
        Etre contacte par un agent
        <ArrowRight className="w-4 h-4" />
      </button>

      <p className="text-center text-xs text-gray-400 mt-3">
        Sans engagement · Gratuit · Un agent vous rappelle sous 24h
      </p>
    </div>
  )
}
