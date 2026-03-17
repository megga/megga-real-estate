import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft, ArrowRight, Save, Upload, Plus, Trash2,
  Home, MapPin, Image, FileText, CheckCircle2,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { toast } from '@/hooks/useToast'

type Step = 'type' | 'details' | 'photos' | 'description' | 'review'

const STEPS: { id: Step; label: string; icon: typeof Home }[] = [
  { id: 'type', label: 'Type de bien', icon: Home },
  { id: 'details', label: 'Détails', icon: MapPin },
  { id: 'photos', label: 'Photos', icon: Image },
  { id: 'description', label: 'Description', icon: FileText },
  { id: 'review', label: 'Vérification', icon: CheckCircle2 },
]

const PROPERTY_TYPES = [
  { value: 'apartment', label: 'Appartement', icon: '🏢' },
  { value: 'house', label: 'Maison', icon: '🏠' },
  { value: 'villa', label: 'Villa', icon: '🏡' },
  { value: 'commercial', label: 'Commercial', icon: '🏪' },
  { value: 'land', label: 'Terrain', icon: '🌿' },
]

const TRANSACTION_TYPES = [
  { value: 'sale', label: 'Vente' },
  { value: 'rent', label: 'Location' },
]

interface FormData {
  propertyType: string
  transactionType: string
  title: string
  price: string
  rooms: string
  bedrooms: string
  bathrooms: string
  surface: string
  address: string
  city: string
  canton: string
  postalCode: string
  description: string
  features: string[]
}

const INITIAL_FORM: FormData = {
  propertyType: '',
  transactionType: 'sale',
  title: '',
  price: '',
  rooms: '',
  bedrooms: '',
  bathrooms: '',
  surface: '',
  address: '',
  city: '',
  canton: 'GE',
  postalCode: '',
  description: '',
  features: [],
}

const CANTONS = [
  'AG', 'AI', 'AR', 'BE', 'BL', 'BS', 'FR', 'GE', 'GL', 'GR',
  'JU', 'LU', 'NE', 'NW', 'OW', 'SG', 'SH', 'SO', 'SZ', 'TG',
  'TI', 'UR', 'VD', 'VS', 'ZG', 'ZH',
]

const FEATURES = [
  'Balcon', 'Terrasse', 'Jardin', 'Parking', 'Garage', 'Cave',
  'Ascenseur', 'Piscine', 'Vue lac', 'Vue montagne', 'Cheminée',
  'Climatisation', 'Buanderie', 'Parquet', 'Cuisine ouverte', 'Duplex',
]

export default function ListingFormPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState<Step>('type')
  const [form, setForm] = useState<FormData>(INITIAL_FORM)
  const [photos, setPhotos] = useState<string[]>([])

  const currentIndex = STEPS.findIndex((s) => s.id === currentStep)

  function update<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function toggleFeature(f: string) {
    setForm((prev) => ({
      ...prev,
      features: prev.features.includes(f)
        ? prev.features.filter((x) => x !== f)
        : [...prev.features, f],
    }))
  }

  function goNext() {
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id)
    }
  }

  function goBack() {
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id)
    }
  }

  function handlePublish() {
    toast.success('Bien publié !', 'Votre annonce a été créée avec succès.')
    navigate('/dashboard/listings')
  }

  function handleSaveDraft() {
    toast.info('Brouillon enregistré', 'Vous pourrez modifier votre annonce plus tard.')
    navigate('/dashboard/listings')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/dashboard/listings')}
          className="p-2 rounded-button hover:bg-section transition-colors"
          aria-label="Retour aux biens"
        >
          <ArrowLeft className="h-5 w-5 text-primary-600" aria-hidden="true" />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Nouveau bien</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Étape {currentIndex + 1} sur {STEPS.length} — {STEPS[currentIndex].label}
          </p>
        </div>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-1">
        {STEPS.map((step, i) => {
          const StepIcon = step.icon
          const isActive = i === currentIndex
          const isDone = i < currentIndex
          return (
            <div key={step.id} className="flex items-center flex-1 gap-1">
              <button
                onClick={() => i <= currentIndex && setCurrentStep(step.id)}
                disabled={i > currentIndex}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-button text-xs font-medium transition-colors flex-shrink-0',
                  isActive ? 'bg-accent text-white' :
                  isDone ? 'bg-success/10 text-success' :
                  'bg-section text-primary-400'
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5 rounded-full', i < currentIndex ? 'bg-success' : 'bg-primary-100')} />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div className="bg-card rounded-card shadow-card p-6">
        {/* Step 1: Property type */}
        {currentStep === 'type' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 mb-1">Type de bien</h2>
              <p className="text-sm text-muted-foreground">Sélectionnez le type de bien que vous souhaitez publier.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-900 mb-3">Type de transaction</label>
              <div className="flex gap-3">
                {TRANSACTION_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => update('transactionType', t.value)}
                    className={cn(
                      'flex-1 py-3 rounded-button text-sm font-medium border transition-colors',
                      form.transactionType === t.value
                        ? 'bg-accent text-white border-accent'
                        : 'bg-card text-primary-700 border-border hover:border-accent/30'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-primary-900 mb-3">Type de propriété</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => update('propertyType', t.value)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-card border transition-all',
                      form.propertyType === t.value
                        ? 'bg-accent/5 border-accent shadow-card'
                        : 'bg-card border-border hover:border-accent/30 hover:shadow-card'
                    )}
                  >
                    <span className="text-2xl">{t.icon}</span>
                    <span className="text-sm font-medium text-primary-900">{t.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Details */}
        {currentStep === 'details' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 mb-1">Détails du bien</h2>
              <p className="text-sm text-muted-foreground">Renseignez les caractéristiques et la localisation.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="title" className="block text-sm font-medium text-primary-900 mb-1.5">Titre de l&apos;annonce</label>
                <input
                  id="title"
                  type="text"
                  value={form.title}
                  onChange={(e) => update('title', e.target.value)}
                  placeholder="ex: Bel appartement lumineux Eaux-Vives"
                  className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="price" className="block text-sm font-medium text-primary-900 mb-1.5">Prix (CHF)</label>
                <input
                  id="price"
                  type="number"
                  value={form.price}
                  onChange={(e) => update('price', e.target.value)}
                  placeholder="720000"
                  className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="surface" className="block text-sm font-medium text-primary-900 mb-1.5">Surface (m²)</label>
                <input
                  id="surface"
                  type="number"
                  value={form.surface}
                  onChange={(e) => update('surface', e.target.value)}
                  placeholder="75"
                  className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="rooms" className="block text-sm font-medium text-primary-900 mb-1.5">Pièces</label>
                <input
                  id="rooms"
                  type="number"
                  value={form.rooms}
                  onChange={(e) => update('rooms', e.target.value)}
                  placeholder="3"
                  className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="bedrooms" className="block text-sm font-medium text-primary-900 mb-1.5">Chambres</label>
                <input
                  id="bedrooms"
                  type="number"
                  value={form.bedrooms}
                  onChange={(e) => update('bedrooms', e.target.value)}
                  placeholder="2"
                  className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>
              <div>
                <label htmlFor="bathrooms" className="block text-sm font-medium text-primary-900 mb-1.5">Salles de bain</label>
                <input
                  id="bathrooms"
                  type="number"
                  value={form.bathrooms}
                  onChange={(e) => update('bathrooms', e.target.value)}
                  placeholder="1"
                  className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-primary-900 mb-3">Adresse</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-primary-900 mb-1.5">Rue et numéro</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
                    <input
                      id="address"
                      type="text"
                      value={form.address}
                      onChange={(e) => update('address', e.target.value)}
                      placeholder="Rue du Lac 12"
                      className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-primary-900 mb-1.5">Ville</label>
                  <input
                    id="city"
                    type="text"
                    value={form.city}
                    onChange={(e) => update('city', e.target.value)}
                    placeholder="Genève"
                    className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label htmlFor="canton" className="block text-sm font-medium text-primary-900 mb-1.5">Canton</label>
                    <select
                      id="canton"
                      value={form.canton}
                      onChange={(e) => update('canton', e.target.value)}
                      className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    >
                      {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="postalCode" className="block text-sm font-medium text-primary-900 mb-1.5">NPA</label>
                    <input
                      id="postalCode"
                      type="text"
                      value={form.postalCode}
                      onChange={(e) => update('postalCode', e.target.value)}
                      placeholder="1200"
                      className="w-full h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-primary-900 mb-3">Caractéristiques</h3>
              <div className="flex flex-wrap gap-2">
                {FEATURES.map((f) => (
                  <button
                    key={f}
                    onClick={() => toggleFeature(f)}
                    className={cn(
                      'text-xs font-medium px-3 py-1.5 rounded-badge border transition-colors',
                      form.features.includes(f)
                        ? 'bg-accent/10 text-accent border-accent/20'
                        : 'bg-card text-primary-600 border-border hover:border-accent/20'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Photos */}
        {currentStep === 'photos' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 mb-1">Photos</h2>
              <p className="text-sm text-muted-foreground">Ajoutez des photos de qualité pour attirer les acheteurs. Maximum 20 photos.</p>
            </div>

            {/* Upload zone */}
            <div className="border-2 border-dashed border-border rounded-card p-8 text-center hover:border-accent/30 transition-colors">
              <Upload className="h-10 w-10 text-primary-300 mx-auto mb-3" aria-hidden="true" />
              <p className="text-sm font-medium text-primary-900 mb-1">Glissez vos photos ici</p>
              <p className="text-xs text-muted-foreground mb-4">ou cliquez pour sélectionner des fichiers (JPG, PNG — max 10 Mo)</p>
              <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-button transition-colors">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Sélectionner des photos
              </button>
            </div>

            {/* Photos grid placeholder */}
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((photo, i) => (
                  <div key={i} className="relative aspect-[4/3] rounded-card overflow-hidden bg-section group">
                    <img src={photo} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    <button
                      onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                      className="absolute top-2 right-2 p-1.5 bg-card/80 backdrop-blur rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-label={`Supprimer la photo ${i + 1}`}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-danger" aria-hidden="true" />
                    </button>
                    {i === 0 && (
                      <span className="absolute bottom-2 left-2 text-[10px] font-medium bg-accent text-white px-2 py-0.5 rounded-badge">
                        Photo principale
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {photos.length === 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Aucune photo ajoutée. La première photo sera utilisée comme image principale.
              </p>
            )}
          </div>
        )}

        {/* Step 4: Description */}
        {currentStep === 'description' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 mb-1">Description</h2>
              <p className="text-sm text-muted-foreground">Rédigez une description détaillée et attractive de votre bien.</p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-primary-900 mb-1.5">
                Description du bien
              </label>
              <textarea
                id="description"
                rows={8}
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Décrivez les atouts du bien : luminosité, vue, rénovations, proximité transports et commerces..."
                className="w-full px-3 py-2.5 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                {form.description.length} caractères — Recommandé : 200 à 500 caractères
              </p>
            </div>
          </div>
        )}

        {/* Step 5: Review */}
        {currentStep === 'review' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-primary-900 mb-1">Vérification</h2>
              <p className="text-sm text-muted-foreground">Vérifiez les informations avant de publier votre annonce.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-section rounded-button p-4">
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Bien</p>
                <p className="text-sm font-medium text-primary-900">{form.title || '—'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {PROPERTY_TYPES.find((t) => t.value === form.propertyType)?.label || '—'} · {form.transactionType === 'sale' ? 'Vente' : 'Location'}
                </p>
              </div>
              <div className="bg-section rounded-button p-4">
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Prix</p>
                <p className="text-sm font-bold text-primary-900">
                  {form.price ? formatCHF(Number(form.price)) : '—'}
                  {form.transactionType === 'rent' && form.price ? ' /mois' : ''}
                </p>
              </div>
              <div className="bg-section rounded-button p-4">
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Caractéristiques</p>
                <p className="text-xs text-primary-900">
                  {form.rooms || '—'} pièces · {form.bedrooms || '—'} ch. · {form.bathrooms || '—'} SdB · {form.surface || '—'} m²
                </p>
              </div>
              <div className="bg-section rounded-button p-4">
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Adresse</p>
                <p className="text-xs text-primary-900">
                  {form.address || '—'}, {form.postalCode} {form.city} ({form.canton})
                </p>
              </div>
              <div className="sm:col-span-2 bg-section rounded-button p-4">
                <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Photos</p>
                <p className="text-xs text-primary-900">{photos.length} photo(s) ajoutée(s)</p>
              </div>
              {form.features.length > 0 && (
                <div className="sm:col-span-2 bg-section rounded-button p-4">
                  <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-2">Équipements</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.features.map((f) => (
                      <span key={f} className="text-[11px] font-medium px-2 py-0.5 rounded-badge bg-accent/10 text-accent">{f}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      <div className="flex items-center justify-between">
        <button
          onClick={currentIndex === 0 ? () => navigate('/dashboard/listings') : goBack}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-900 transition-colors px-4 py-2.5"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {currentIndex === 0 ? 'Annuler' : 'Précédent'}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveDraft}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 border border-border px-4 py-2.5 rounded-button hover:bg-section transition-colors"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Brouillon
          </button>

          {currentStep === 'review' ? (
            <button
              onClick={handlePublish}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-5 py-2.5 rounded-button transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Publier l&apos;annonce
            </button>
          ) : (
            <button
              onClick={goNext}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-5 py-2.5 rounded-button transition-colors"
            >
              Suivant
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
