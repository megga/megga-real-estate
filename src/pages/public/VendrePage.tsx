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
import BuyerSidebar from '@/components/search/BuyerSidebar'
import Footer from '@/components/layout/Footer'
import { usePropertyEstimation, type EstimationParams, type EstimationResult } from '@/hooks/usePropertyEstimation'
import { useSellerLead } from '@/hooks/useSellerLead'
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

// ─── Type-specific constants ────────────────────────────
const FLOOR_OPTIONS = ['RDC', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+', 'Attique']
const PARKING_OPTIONS = ['0', '1', '2', '3+']
const VIEW_TYPES = [
  { value: 'lake', label: 'Lac' },
  { value: 'mountain', label: 'Montagne' },
  { value: 'open', label: 'Vue dégagée' },
  { value: 'none', label: 'Aucune' },
] as const
const LAND_ZONES = [
  { value: 'constructible', label: 'Constructible' },
  { value: 'agricole', label: 'Agricole' },
  { value: 'mixte', label: 'Mixte' },
] as const
const COMMERCIAL_TYPES = [
  { value: 'bureau', label: 'Bureau' },
  { value: 'commerce', label: 'Commerce' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'entrepot', label: 'Entrepôt' },
] as const

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
  // Step 2 — Details (common)
  propertyType: string
  rooms: string
  bedrooms: string
  surface: string
  condition: string
  yearBuilt: string
  // Step 2 — Appartement
  floor: string
  ppeCharges: string
  hasBalcony: boolean
  balconySurface: string
  // Step 2 — Maison + Villa
  landSurface: string
  parkingSpaces: string
  hasGarden: boolean
  // Step 2 — Villa
  hasPool: boolean
  viewType: string
  // Step 2 — Terrain
  landZone: string
  cosIus: string
  // Step 2 — Commercial
  commercialType: string
  annualRent: string
  isOccupied: string
  // Step 3 — Photos
  photos: File[]
  photoUrls: string[]
  // Step 4 — Contact
  contactName: string
  contactEmail: string
  contactPhone: string
  motivation: string
}

const STEP_LABELS = ['Adresse', 'Détails', 'Photos', 'Contact', 'Estimation']

// ─── Component ───────────────────────────────────────────

// ─── Substep definitions per property type ──────────────
type SubStepDef = { id: string; question: string; type: 'pills' | 'input' | 'toggle'; required?: boolean }

function getSubSteps(propertyType: string): SubStepDef[] {
  const common: SubStepDef[] = []

  if (['apartment', 'house', 'villa'].includes(propertyType)) {
    common.push(
      { id: 'rooms', question: 'Combien de pièces ?', type: 'pills' },
      { id: 'bedrooms', question: 'Combien de chambres ?', type: 'pills' },
    )
  }

  common.push({
    id: 'surface',
    question: propertyType === 'land' ? 'Quelle est la surface de la parcelle ?' : 'Quelle est la surface habitable ?',
    type: 'input',
  })

  // Type-specific
  if (propertyType === 'apartment') {
    common.push(
      { id: 'floor', question: 'À quel étage ?', type: 'pills' },
    )
  }
  if (['house', 'villa'].includes(propertyType)) {
    common.push(
      { id: 'landSurface', question: 'Quelle est la surface du terrain ?', type: 'input' },
      { id: 'parkingSpaces', question: 'Combien de places de parking ?', type: 'pills' },
    )
  }
  if (propertyType === 'villa') {
    common.push(
      { id: 'viewType', question: 'Quelle vue avez-vous ?', type: 'pills' },
    )
  }
  if (propertyType === 'land') {
    common.push(
      { id: 'landZone', question: 'Quelle est la zone ?', type: 'pills' },
    )
  }
  if (propertyType === 'commercial') {
    common.push(
      { id: 'commercialType', question: 'Quel type de bien commercial ?', type: 'pills' },
    )
  }

  // Condition for all except land
  if (propertyType !== 'land') {
    common.push(
      { id: 'condition', question: 'Quel est l\'état général ?', type: 'pills' },
    )
  }

  // Summary (always last)
  common.push({ id: 'summary', question: 'Vérifiez vos informations', type: 'pills' })

  return common
}

export default function VendrePage() {
  const [step, setStep] = useState(0) // 0 = hero, 1-4 = wizard steps
  const [subStep, setSubStep] = useState(0) // substep within step 2
  const [form, setForm] = useState<FormData>({
    address: '', city: '', canton: '', postalCode: '', lat: undefined, lng: undefined,
    propertyType: '', rooms: '', bedrooms: '', surface: '', condition: '', yearBuilt: '',
    floor: '', ppeCharges: '', hasBalcony: false, balconySurface: '',
    landSurface: '', parkingSpaces: '', hasGarden: false,
    hasPool: false, viewType: '',
    landZone: '', cosIus: '',
    commercialType: '', annualRent: '', isOccupied: '',
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
    // Skip step 1 (address) if address is already filled from hero search bar
    setStep(form.address && form.canton ? 2 : 1)
    setSubStep(0)
    setTimeout(() => {
      wizardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function goNext() {
    if (step < 4) {
      setStep(step + 1)
      setSubStep(0)
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
          // Type-specific fields
          floor: form.floor || undefined,
          ppeCharges: form.ppeCharges ? parseInt(form.ppeCharges) : undefined,
          hasBalcony: form.hasBalcony || undefined,
          balconySurface: form.balconySurface ? parseInt(form.balconySurface) : undefined,
          landSurface: form.landSurface ? parseInt(form.landSurface) : undefined,
          parkingSpaces: form.parkingSpaces || undefined,
          hasGarden: form.hasGarden || undefined,
          hasPool: form.hasPool || undefined,
          viewType: form.viewType || undefined,
          landZone: form.landZone || undefined,
          cosIus: form.cosIus || undefined,
          commercialType: form.commercialType || undefined,
          annualRent: form.annualRent ? parseInt(form.annualRent) : undefined,
          isOccupied: form.isOccupied === 'oui' ? true : form.isOccupied === 'non' ? false : undefined,
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
  const step3Valid = true // photos are optional
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
            floor: '', ppeCharges: '', hasBalcony: false, balconySurface: '',
            landSurface: '', parkingSpaces: '', hasGarden: false,
            hasPool: false, viewType: '',
            landZone: '', cosIus: '',
            commercialType: '', annualRent: '', isOccupied: '',
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
        <BuyerSidebar className="hidden md:flex fixed top-[72px] bottom-0 left-0 z-40" />
        <div className="max-w-2xl mx-auto px-4 py-10 flex flex-col justify-center" style={{ minHeight: 'calc(100vh - 72px)' }}>
          <button
            onClick={goBack}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Modifier les informations
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
              <p className="text-gray-500">Données insuffisantes pour estimer ce bien.</p>
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
      <BuyerSidebar className="hidden md:flex fixed top-[72px] bottom-0 left-0 z-40" />

      {/* ─── Hero Section — Zillow/Redfin style ─── */}
      {step === 0 && (
        <section className="relative flex items-center justify-center px-4" style={{ minHeight: 'calc(100vh - 72px)' }}>
          {/* Background — subtle gradient */}
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-white to-white pointer-events-none" />

          <div className="relative max-w-3xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
              38'000+ biens analysés en temps réel
            </div>

            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 tracking-tight leading-[1.05]">
              Combien vaut
              <br />
              <span className="text-blue-600">votre bien</span> ?
            </h1>
            <p className="text-lg md:text-xl text-gray-500 mt-6 max-w-xl mx-auto leading-relaxed">
              Obtenez une estimation gratuite et instantanée basée sur les données du marché suisse
            </p>

            {/* Search bar — Zillow style address input */}
            <div className="mt-10 max-w-xl mx-auto">
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={geoQuery}
                  onChange={e => searchGeo(e.target.value)}
                  onFocus={() => { if (geoResults.length > 0) setGeoOpen(true) }}
                  placeholder="Entrez l'adresse de votre bien..."
                  className="w-full h-14 md:h-16 pl-12 pr-40 text-base md:text-lg text-gray-900 placeholder:text-gray-400 bg-white border-2 border-gray-200 rounded-2xl focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-lg shadow-gray-200/50 transition-all"
                />
                <button
                  onClick={() => { if (form.address) startWizard() }}
                  disabled={!form.address}
                  className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2 h-10 md:h-12 px-6 md:px-8 rounded-xl text-sm md:text-base font-semibold transition-all',
                    form.address
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Estimer
                </button>

                {/* Geocoding dropdown */}
                {geoOpen && geoResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {geoResults.map((r, i) => (
                      <button
                        key={i}
                        onClick={() => selectGeoResult(r)}
                        className="flex items-center gap-3 w-full px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                      >
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{r.place_name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Or select property type */}
            <div className="mt-8">
              <p className="text-sm text-gray-400 mb-4">ou sélectionnez un type de bien</p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                {PROPERTY_TYPES.map(type => {
                  const Icon = type.icon
                  return (
                    <button
                      key={type.value}
                      onClick={() => startWizard(type.value)}
                      className="flex items-center gap-2 h-10 px-5 rounded-full border border-gray-200 text-sm font-medium text-gray-600 hover:border-gray-900 hover:text-gray-900 transition-all hover:shadow-sm"
                    >
                      <Icon className="w-4 h-4" />
                      {type.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Trust indicators — Zillow style */}
            <div className="mt-14 flex flex-col sm:flex-row items-center justify-center gap-8">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">38'000+</p>
                <p className="text-xs text-gray-500 mt-1">Biens analysés</p>
              </div>
              <div className="hidden sm:block w-px h-10 bg-gray-200" />
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">26</p>
                <p className="text-xs text-gray-500 mt-1">Cantons couverts</p>
              </div>
              <div className="hidden sm:block w-px h-10 bg-gray-200" />
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">±5%</p>
                <p className="text-xs text-gray-500 mt-1">Précision moyenne</p>
              </div>
            </div>

            {/* Reassurance */}
            <div className="mt-8 flex items-center justify-center gap-6">
              {[
                { icon: Lock, text: 'Confidentiel' },
                { icon: Sparkles, text: 'Résultat instantané' },
                { icon: User, text: '100% gratuit' },
              ].map(item => (
                <span key={item.text} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <item.icon className="w-3.5 h-3.5" />
                  {item.text}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Wizard ─── */}
      {step >= 1 && (
        <div ref={wizardRef} className="max-w-2xl mx-auto px-4 py-10 flex flex-col justify-center" style={{ minHeight: 'calc(100vh - 72px)' }}>

          {/* Progress bar — smooth across steps + substeps */}
          {(() => {
            const subSteps = step === 2 ? getSubSteps(form.propertyType) : []
            const totalSubSteps = subSteps.length || 1
            // Step 1 = 25%, Step 2 = 25-50% (split across substeps), Step 3 = 75%, Step 4 = 100%
            let progress = 0
            if (step === 1) progress = 25
            else if (step === 2) progress = 25 + (subStep / totalSubSteps) * 25
            else if (step === 3) progress = 60
            else if (step === 4) progress = 80
            const currentLabel = step === 2 && subStep < subSteps.length
              ? subSteps[subStep]?.question?.split('?')[0]?.replace('Combien de ', '').replace('Quelle est la ', '').replace('Quel est l\'', '').replace('Quelle ', '').replace('Quel ', '').replace('À quel ', '') || STEP_LABELS[step - 1]
              : STEP_LABELS[step - 1]
            return (
              <div className="mb-10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">
                    {step === 2 ? `Question ${subStep + 1}/${totalSubSteps}` : `Étape ${step} sur 5`}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">{currentLabel}</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )
          })()}

          {/* Step 1 — Address */}
          {step === 1 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Où se trouve votre bien ?
                </h2>
                <p className="text-base text-gray-500">
                  Commencez à taper l'adresse pour obtenir des suggestions
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
                    className="w-full h-14 pl-12 pr-4 rounded-xl border border-gray-200 focus:border-gray-900 focus:ring-2 focus:ring-gray-900/10 text-base text-gray-900 placeholder:text-gray-400 outline-none transition-all"
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
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  )}
                >
                  Continuer
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2 — Conversational substeps (one question per screen) */}
          {step === 2 && (() => {
            const subSteps = getSubSteps(form.propertyType)
            const current = subSteps[subStep]
            if (!current) return null

            function selectAndAdvance(field: string, value: string | boolean) {
              setForm(prev => ({ ...prev, [field]: value }))
              // Auto-advance after short delay for visual feedback
              setTimeout(() => {
                if (subStep < subSteps.length - 1) {
                  setSubStep(s => s + 1)
                }
              }, 200)
            }

            function goSubBack() {
              if (subStep > 0) setSubStep(s => s - 1)
              else goBack()
            }

            // ── Summary screen ──
            if (current.id === 'summary') {
              const fields = subSteps.filter(s => s.id !== 'summary')
              const getValue = (id: string): string => {
                const v = form[id as keyof FormData]
                if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
                if (typeof v === 'string') {
                  // Translate known values
                  const labels: Record<string, string> = {
                    lake: 'Lac', mountain: 'Montagne', open: 'Vue dégagée', none: 'Aucune',
                    constructible: 'Constructible', agricole: 'Agricole', mixte: 'Mixte',
                    bureau: 'Bureau', commerce: 'Commerce', restaurant: 'Restaurant', entrepot: 'Entrepôt',
                    new: 'Neuf', renovated: 'Rénové', good: 'Bon état', refresh: 'À rafraîchir', renovate: 'À rénover',
                  }
                  return labels[v] || v || '—'
                }
                return String(v || '—')
              }
              const suffix = (id: string): string => {
                if (id === 'surface' || id === 'landSurface' || id === 'balconySurface') return ' m²'
                if (id === 'annualRent') return ' CHF/an'
                if (id === 'ppeCharges') return ' CHF/mois'
                return ''
              }

              return (
                <div className="text-center space-y-6 animate-[fadeSlideIn_0.3s_ease-out]">
                  <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                    Vérifiez vos informations
                  </h2>
                  <p className="text-base text-gray-500">Modifiez si nécessaire avant de continuer</p>
                  <div className="max-w-md mx-auto space-y-2 text-left">
                    {fields.map((f, i) => (
                      <button
                        key={f.id}
                        onClick={() => setSubStep(i)}
                        className="w-full flex items-center justify-between h-12 px-4 rounded-xl border border-gray-200 hover:border-gray-400 transition-colors group"
                      >
                        <span className="text-sm text-gray-500">{f.question.replace(' ?', '')}</span>
                        <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600 transition-colors">
                          {getValue(f.id)}{suffix(f.id)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-4 max-w-md mx-auto">
                    <button onClick={goSubBack} className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5">
                      <ArrowLeft className="w-4 h-4" /> Retour
                    </button>
                    <button
                      onClick={() => { setSubStep(0); goNext() }}
                      className="h-11 px-8 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors flex items-center gap-2"
                    >
                      Continuer <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            }

            // ── Pills helper ──
            function PillGrid({ options, value, field, columns = 'auto' }: { options: { value: string; label: string }[]; value: string; field: string; columns?: string }) {
              return (
                <div className={cn(
                  'flex flex-wrap justify-center gap-3',
                  columns === '3' && 'grid grid-cols-3 gap-3',
                  columns === '4' && 'grid grid-cols-4 gap-3',
                  columns === '5' && 'grid grid-cols-5 gap-3'
                )}>
                  {options.map(o => (
                    <button
                      key={o.value}
                      onClick={() => selectAndAdvance(field, o.value)}
                      className={cn(
                        'h-12 md:h-12 px-5 md:px-6 rounded-xl text-sm font-medium transition-all min-w-[60px]',
                        value === o.value
                          ? 'bg-gray-900 text-white scale-105 shadow-md'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-[1.02]'
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )
            }

            // ── Render current question ──
            return (
              <div key={current.id} className="flex flex-col items-center justify-center text-center space-y-8 animate-[fadeSlideIn_0.3s_ease-out]">
                <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}</style>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                  {current.question}
                </h2>

                {/* ── Rooms ── */}
                {current.id === 'rooms' && (
                  <PillGrid
                    options={ROOM_OPTIONS.slice(0, 10).map(r => ({ value: r, label: r }))}
                    value={form.rooms}
                    field="rooms"
                  />
                )}

                {/* ── Bedrooms ── */}
                {current.id === 'bedrooms' && (
                  <PillGrid
                    options={BEDROOM_OPTIONS.map(b => ({ value: b, label: b }))}
                    value={form.bedrooms}
                    field="bedrooms"
                  />
                )}

                {/* ── Surface (input) ── */}
                {current.id === 'surface' && (
                  <div className="w-full max-w-sm mx-auto">
                    <div className="relative">
                      <input
                        type="number"
                        value={form.surface}
                        onChange={e => setForm(prev => ({ ...prev, surface: e.target.value }))}
                        placeholder={form.propertyType === 'land' ? 'ex: 800' : 'ex: 95'}
                        autoFocus
                        className="w-full h-14 px-5 pr-14 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-lg text-gray-900 text-center placeholder:text-gray-300 outline-none transition-all"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-gray-400">m²</span>
                    </div>
                    <button
                      onClick={() => { if (form.surface) setSubStep(s => s + 1) }}
                      disabled={!form.surface}
                      className={cn(
                        'mt-6 h-11 px-8 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto',
                        form.surface
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      )}
                    >
                      Continuer <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* ── Floor (apartment) ── */}
                {current.id === 'floor' && (
                  <PillGrid
                    options={FLOOR_OPTIONS.map(f => ({ value: f, label: f }))}
                    value={form.floor}
                    field="floor"
                  />
                )}

                {/* ── Land surface (house/villa) ── */}
                {current.id === 'landSurface' && (
                  <div className="w-full max-w-sm mx-auto">
                    <div className="relative">
                      <input
                        type="number"
                        value={form.landSurface}
                        onChange={e => setForm(prev => ({ ...prev, landSurface: e.target.value }))}
                        placeholder="ex: 500"
                        autoFocus
                        className="w-full h-14 px-5 pr-14 rounded-xl border-2 border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 text-lg text-gray-900 text-center placeholder:text-gray-300 outline-none transition-all"
                      />
                      <span className="absolute right-5 top-1/2 -translate-y-1/2 text-sm text-gray-400">m²</span>
                    </div>
                    <button
                      onClick={() => { if (form.landSurface) setSubStep(s => s + 1) }}
                      disabled={!form.landSurface}
                      className={cn(
                        'mt-6 h-11 px-8 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 mx-auto',
                        form.landSurface
                          ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                          : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      )}
                    >
                      Continuer <ArrowRight className="w-4 h-4" />
                    </button>
                    <button onClick={() => setSubStep(s => s + 1)} className="block mx-auto mt-3 text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                      Passer
                    </button>
                  </div>
                )}

                {/* ── Parking ── */}
                {current.id === 'parkingSpaces' && (
                  <PillGrid
                    options={PARKING_OPTIONS.map(p => ({ value: p, label: p === '0' ? 'Aucun' : p }))}
                    value={form.parkingSpaces}
                    field="parkingSpaces"
                  />
                )}

                {/* ── View (villa) ── */}
                {current.id === 'viewType' && (
                  <PillGrid
                    options={VIEW_TYPES.map(v => ({ value: v.value, label: v.label }))}
                    value={form.viewType}
                    field="viewType"
                  />
                )}

                {/* ── Land zone ── */}
                {current.id === 'landZone' && (
                  <PillGrid
                    options={LAND_ZONES.map(z => ({ value: z.value, label: z.label }))}
                    value={form.landZone}
                    field="landZone"
                  />
                )}

                {/* ── Commercial type ── */}
                {current.id === 'commercialType' && (
                  <PillGrid
                    options={COMMERCIAL_TYPES.map(c => ({ value: c.value, label: c.label }))}
                    value={form.commercialType}
                    field="commercialType"
                    columns="4"
                  />
                )}

                {/* ── Condition ── */}
                {current.id === 'condition' && (
                  <PillGrid
                    options={CONDITIONS.map(c => ({ value: c.value, label: c.label }))}
                    value={form.condition}
                    field="condition"
                    columns="5"
                  />
                )}

                {/* ── Back button (always visible, not for pills which auto-advance) ── */}
                {current.type !== 'input' && (
                  <button
                    onClick={goSubBack}
                    className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5 mx-auto pt-4"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                )}
                {current.type === 'input' && (
                  <button
                    onClick={goSubBack}
                    className="text-sm text-gray-400 hover:text-gray-900 transition-colors flex items-center gap-1.5 mx-auto"
                  >
                    <ArrowLeft className="w-4 h-4" /> Retour
                  </button>
                )}

                {/* Social proof */}
                <p className="text-xs text-gray-300 mt-8">
                  12'500+ propriétaires ont déjà estimé leur bien sur MEGGA
                </p>
              </div>
            )
          })()}

          

          {/* Step 3 — Photos */}
          {step === 3 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Ajoutez des photos
                </h2>
                <p className="text-base text-gray-500">
                  Optionnel — les photos améliorent la précision de <span className="font-medium text-gray-700">40%</span>
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
                  ou cliquez pour sélectionner (max 10)
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
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
                  Passer cette étape
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Contact */}
          {step === 4 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                  Dernière étape
                </h2>
                <p className="text-base text-gray-500">
                  Un expert de votre région vous contactera sous <span className="font-medium text-gray-700">24h</span>
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
                      ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
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
      <BuyerSidebar className="hidden md:flex fixed top-[72px] bottom-0 left-0 z-40" />
      <div className="max-w-lg mx-auto px-4 text-center flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 72px)' }}>
        <style>{`@keyframes draw { to { stroke-dashoffset: 0; } } @keyframes scaleIn { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: scale(1); } }`}</style>

        {/* Animated success icon */}
        <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-6 animate-[scaleIn_0.4s_ease-out]">
          <svg className="w-10 h-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L20 7" style={{ strokeDasharray: 30, strokeDashoffset: 30, animation: 'draw 0.5s ease-out 0.4s forwards' }} />
          </svg>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Merci {firstName} !</h1>
        <p className="text-base text-gray-500 mt-3 max-w-sm">
          Votre demande a été envoyée. Un expert immobilier de votre région vous contactera très bientôt.
        </p>

        {/* Recap card */}
        <div className="w-full mt-8 rounded-2xl border border-gray-200 overflow-hidden text-left">
          {/* Property header */}
          <div className="flex items-center gap-4 p-5 bg-gray-50">
            {form.photos[0] ? (
              <img src={URL.createObjectURL(form.photos[0])} alt="" className="h-16 w-16 rounded-xl object-cover" />
            ) : (
              <div className="h-16 w-16 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
                {(() => { const Icon = PROPERTY_TYPES.find(t => t.value === form.propertyType)?.icon || Building2; return <Icon className="w-6 h-6 text-gray-400" /> })()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{typeLabel}{form.rooms && ` · ${form.rooms} pièces`}</p>
              <p className="text-xs text-gray-500 truncate">{form.address}</p>
              {form.surface && <p className="text-xs text-gray-400 mt-0.5">{form.surface} m²</p>}
            </div>
          </div>

          {/* Estimation */}
          {estimation?.estimation && (
            <div className="p-5 border-t border-gray-100">
              <p className="text-xs text-gray-400 mb-1">Estimation</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCHF(estimation.estimation)}
              </p>
              {estimation.estimation_min && estimation.estimation_max && (
                <p className="text-xs text-gray-400 mt-1">
                  Fourchette : {formatCHF(estimation.estimation_min)} — {formatCHF(estimation.estimation_max)}
                </p>
              )}
            </div>
          )}

          {/* Next steps */}
          <div className="p-5 border-t border-gray-100 space-y-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Prochaines étapes</p>
            {[
              { step: '1', text: 'Un expert vous appelle sous 24h', done: false },
              { step: '2', text: 'Visite gratuite de votre bien', done: false },
              { step: '3', text: 'Proposition de mandat personnalisée', done: false },
            ].map(s => (
              <div key={s.step} className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center flex-shrink-0">{s.step}</span>
                <span className="text-sm text-gray-700">{s.text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          Confirmation envoyée à <span className="font-medium text-gray-600">{form.contactEmail}</span>
        </p>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <a
            href="/"
            className="h-11 px-6 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-400 transition-colors inline-flex items-center"
          >
            Retour à l'accueil
          </a>
          <button
            onClick={onReset}
            className="h-11 px-6 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
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
  const [text, setText] = useState('Analyse de votre bien...')
  const [progress, setProgress] = useState(0)
  const [step, setLoadStep] = useState(0)

  useEffect(() => {
    const steps = [
      { text: 'Analyse de votre bien...', delay: 0 },
      { text: "Comparaison avec 38'000+ biens...", delay: 800 },
      { text: 'Analyse du marché local...', delay: 1600 },
      { text: 'Calcul de la fourchette de prix...', delay: 2400 },
    ]
    const timers = steps.map((s, i) =>
      setTimeout(() => { setText(s.text); setLoadStep(i) }, s.delay)
    )
    const interval = setInterval(() => {
      setProgress(p => Math.min(p + 2, 95))
    }, 60)
    return () => { timers.forEach(clearTimeout); clearInterval(interval) }
  }, [])

  return (
    <div className="text-center py-20 animate-[fadeSlideIn_0.3s_ease-out]">
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}</style>
      {/* Animated circles */}
      <div className="relative w-20 h-20 mx-auto mb-8">
        <div className="absolute inset-0 rounded-full border-[3px] border-blue-100" />
        <div className="absolute inset-0 rounded-full border-[3px] border-blue-600 border-t-transparent animate-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-lg font-bold text-blue-600">
          {Math.round(progress)}%
        </span>
      </div>

      <p className="text-lg font-semibold text-gray-900">{text}</p>
      <div className="mt-6 max-w-sm mx-auto">
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={cn('w-2 h-2 rounded-full transition-colors', i <= step ? 'bg-blue-600' : 'bg-gray-200')} />
        ))}
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

  const confidencePercent = { low: 33, medium: 65, high: 92 }[estimation.confidence] || 65
  const confidenceLabel = { low: 'Faible', medium: 'Moyen', high: 'Élevé' }[estimation.confidence] || 'Moyen'
  const confidenceColor = { low: 'text-amber-600', medium: 'text-blue-600', high: 'text-emerald-600' }[estimation.confidence] || 'text-blue-600'

  return (
    <div className="animate-[fadeSlideIn_0.4s_ease-out]">
      <style>{`@keyframes fadeSlideIn { from { opacity: 0; transform: translateX(24px); } to { opacity: 1; transform: translateX(0); } }`}</style>

      {/* ── Price reveal — the hero moment ── */}
      {estimation.estimation ? (
        <div className="text-center">
          <p className="text-sm font-medium text-blue-600 mb-2">Votre estimation</p>
          <p className="text-sm text-gray-500 mb-6">{form.address}</p>

          {/* Big price */}
          <p className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 tabular-nums tracking-tight animate-[priceReveal_0.6s_ease-out_0.2s_both]">
            {formatCHF(estimation.estimation)}
          </p>
          <style>{`@keyframes priceReveal { from { opacity: 0; transform: scale(0.8) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>

          {/* Range */}
          {estimation.estimation_min && estimation.estimation_max && (
            <div className="mt-6 max-w-md mx-auto">
              <div className="flex items-end gap-1 justify-center h-12">
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-1">Min</span>
                  <div className="w-full h-6 bg-blue-100 rounded-l-lg" />
                  <span className="text-sm font-medium text-gray-600 mt-1">{formatCHF(estimation.estimation_min)}</span>
                </div>
                <div className="flex-[1.5] flex flex-col items-center">
                  <span className="text-xs text-blue-600 font-medium mb-1">Estimation</span>
                  <div className="w-full h-10 bg-blue-600 rounded-sm" />
                  <span className="text-sm font-bold text-gray-900 mt-1">{formatCHF(estimation.estimation)}</span>
                </div>
                <div className="flex-1 flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-1">Max</span>
                  <div className="w-full h-6 bg-blue-100 rounded-r-lg" />
                  <span className="text-sm font-medium text-gray-600 mt-1">{formatCHF(estimation.estimation_max)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10">
          <p className="text-gray-500">Données insuffisantes pour calculer une estimation précise.</p>
        </div>
      )}

      {/* ── Key metrics ── */}
      <div className="grid grid-cols-3 gap-4 mt-10">
        {estimation.median_price_m2 && (
          <div className="text-center p-4 rounded-xl bg-gray-50">
            <p className="text-2xl font-bold text-gray-900">{formatCHF(estimation.median_price_m2)}</p>
            <p className="text-xs text-gray-500 mt-1">Prix au m²</p>
          </div>
        )}
        <div className="text-center p-4 rounded-xl bg-gray-50">
          <p className="text-2xl font-bold text-gray-900">{estimation.comparable_count}</p>
          <p className="text-xs text-gray-500 mt-1">Biens comparés</p>
        </div>
        <div className="text-center p-4 rounded-xl bg-gray-50">
          <p className={cn('text-2xl font-bold', confidenceColor)}>{confidencePercent}%</p>
          <p className="text-xs text-gray-500 mt-1">Confiance {confidenceLabel.toLowerCase()}</p>
        </div>
      </div>

      {/* ── Property summary ── */}
      <div className="flex items-center gap-3 mt-8 p-4 rounded-xl border border-gray-200">
        <div className="w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
          {(() => { const Icon = PROPERTY_TYPES.find(t => t.value === form.propertyType)?.icon || Building2; return <Icon className="w-5 h-5 text-blue-600" /> })()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900">{typeLabel}</p>
          <p className="text-xs text-gray-500 truncate">
            {form.rooms && `${form.rooms} pièces · `}{form.surface} m²{form.canton && ` · ${CANTON_LABELS[form.canton] || form.canton}`}
          </p>
        </div>
      </div>

      {/* ── Comparables ── */}
      {estimation.comparables?.length > 0 && (
        <div className="mt-10">
          <h4 className="text-base font-semibold text-gray-900 mb-4">
            Biens similaires vendus récemment
          </h4>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
            {estimation.comparables.map((comp, i) => (
              <div key={comp.id || i} className="flex-shrink-0 w-64 rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                <div className="h-36 bg-gray-100">
                  {comp.photo_url ? (
                    <img src={comp.photo_url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-6 h-6 text-gray-300" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-base font-bold text-gray-900">{formatCHF(comp.price)}</p>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{comp.address || comp.city}</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {comp.rooms ? `${comp.rooms}p. · ` : ''}{comp.surface_m2} m²
                    {comp.price_per_m2 && ` · ${formatCHF(comp.price_per_m2)}/m²`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Disclaimer ── */}
      <p className="text-xs text-gray-400 mt-8 pt-4 border-t border-gray-100">
        Estimation indicative basée sur l'analyse de biens similaires dans votre secteur. Pour une évaluation précise, un agent certifié peut visiter votre bien gratuitement.
      </p>

      {/* ── CTA ── */}
      <button
        onClick={onContinue}
        className="w-full h-14 rounded-xl text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 transition-all mt-8 flex items-center justify-center gap-2"
      >
        Être contacté par un expert
        <ArrowRight className="w-5 h-5" />
      </button>

      <p className="text-center text-xs text-gray-400 mt-3 flex items-center justify-center gap-4">
        <span>Sans engagement</span>
        <span>·</span>
        <span>100% gratuit</span>
        <span>·</span>
        <span>Réponse sous 24h</span>
      </p>
    </div>
  )
}
