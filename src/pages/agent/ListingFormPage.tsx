import { useState, useCallback, useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import {
  ArrowLeft, ArrowRight, Check, Save, Send,
  Home, MapPin, Banknote, ImagePlus, FileText,
  Upload, X, GripVertical,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PROPERTY_TYPE_LABELS, CANTONS } from '@/lib/constants'
import type { PropertyType } from '@/lib/constants'
import ListingGenerator from '@/components/ai-copilot/ListingGenerator'

// ─── Zod schemas per step ───

const step1Schema = z.object({
  title: z.string().min(5, 'Le titre doit contenir au moins 5 caractères'),
  type: z.enum(['apartment', 'house', 'villa', 'commercial', 'land'], {
    message: 'Sélectionnez un type de bien',
  }),
  rooms: z.coerce.number().min(0.5, 'Minimum 0.5 pièce').max(30, 'Maximum 30 pièces'),
  bedrooms: z.coerce.number().min(0, 'Minimum 0').max(20, 'Maximum 20 chambres'),
  bathrooms: z.coerce.number().min(0, 'Minimum 0').max(10, 'Maximum 10'),
  surface_m2: z.coerce.number().min(5, 'Minimum 5 m²').max(10000, 'Maximum 10000 m²'),
  floor: z.coerce.number().optional(),
  total_floors: z.coerce.number().optional(),
  year_built: z.coerce.number().min(1800).max(2030).optional(),
})

const step2Schema = z.object({
  address: z.string().min(3, "L'adresse est requise"),
  city: z.string().min(2, 'La ville est requise'),
  canton: z.string().min(2, 'Le canton est requis'),
  postal_code: z.string().min(4, 'Code postal requis').max(4, '4 chiffres'),
})

const step3Schema = z.object({
  price: z.coerce.number().min(1000, 'Minimum CHF 1\'000'),
  charges_monthly: z.coerce.number().min(0).optional(),
  mandate_type: z.enum(['exclusive', 'simple', 'search'], {
    message: 'Sélectionnez un type de mandat',
  }),
  features: z.array(z.string()).optional(),
})

const step4Schema = z.object({
  photos: z.array(z.string()).optional(),
})

const step5Schema = z.object({
  description: z.string().min(20, 'La description doit contenir au moins 20 caractères'),
  tags: z.array(z.string()).optional(),
})

const fullSchema = step1Schema.merge(step2Schema).merge(step3Schema).merge(step4Schema).merge(step5Schema)

type ListingFormData = z.infer<typeof fullSchema>

const STEPS = [
  { id: 1, label: 'Infos générales', icon: Home },
  { id: 2, label: 'Localisation', icon: MapPin },
  { id: 3, label: 'Prix & détails', icon: Banknote },
  { id: 4, label: 'Photos', icon: ImagePlus },
  { id: 5, label: 'Description', icon: FileText },
] as const

const FEATURES_OPTIONS = [
  'Balcon', 'Terrasse', 'Jardin', 'Piscine', 'Garage', 'Parking',
  'Cave', 'Ascenseur', 'Vue lac', 'Vue montagne', 'Cheminée',
  'Climatisation', 'Buanderie', 'Minergie', 'Meublé', 'Accès PMR',
]

const TAG_OPTIONS = [
  'Nouveau', 'Exclusif', 'Hot price', 'Coup de cœur', 'Idéal famille',
  'Investissement', 'Première acquisition', 'Dernière chance',
]

const stepSchemas = [step1Schema, step2Schema, step3Schema, step4Schema, step5Schema] as const

// ─── Stepper ───

function Stepper({ current, completed }: { current: number; completed: number[] }) {
  return (
    <div className="flex items-center justify-between mb-8">
      {STEPS.map((step, idx) => {
        const isCompleted = completed.includes(step.id)
        const isCurrent = current === step.id
        return (
          <div key={step.id} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  'h-3 w-3 rounded-full transition-colors',
                  isCompleted ? 'bg-emerald-400' : isCurrent ? 'bg-accent' : 'bg-theme-border'
                )}
              />
              <span
                className={cn(
                  'text-[11px] font-medium text-center whitespace-nowrap hidden sm:block',
                  isCurrent ? 'text-theme-primary' : isCompleted ? 'text-theme-secondary' : 'text-theme-tertiary'
                )}
              >
                {step.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={cn(
                  'flex-1 h-px mx-3',
                  isCompleted ? 'bg-emerald-400' : 'bg-theme-border'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Field helpers ───

function FieldLabel({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-theme-primary mb-1.5">
      {children}
      {required && <span className="text-danger ml-0.5">*</span>}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-danger mt-1">{message}</p>
}

const inputClass = 'w-full h-11 px-4 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors'
const selectClass = 'w-full h-11 px-4 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent'

// ─── Step 1: Infos générales ───

function Step1({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { register, formState: { errors } } = form

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-theme-primary">Informations générales</h2>
      <p className="text-sm text-theme-tertiary">Décrivez votre bien immobilier.</p>

      <div>
        <FieldLabel htmlFor="title" required>Titre de l'annonce</FieldLabel>
        <input
          id="title"
          {...register('title')}
          placeholder="Ex : Appartement lumineux aux Eaux-Vives"
          className={inputClass}
        />
        <FieldError message={errors.title?.message} />
      </div>

      <div>
        <FieldLabel htmlFor="type" required>Type de bien</FieldLabel>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][]).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                'flex items-center justify-center h-11 rounded-input border text-sm font-medium cursor-pointer transition-colors',
                form.watch('type') === value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-section'
              )}
            >
              <input
                type="radio"
                value={value}
                {...register('type')}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
        <FieldError message={errors.type?.message} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div>
          <FieldLabel htmlFor="rooms" required>Pièces</FieldLabel>
          <input id="rooms" type="number" step="0.5" {...register('rooms')} placeholder="3.5" className={inputClass} />
          <FieldError message={errors.rooms?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="bedrooms" required>Chambres</FieldLabel>
          <input id="bedrooms" type="number" {...register('bedrooms')} placeholder="2" className={inputClass} />
          <FieldError message={errors.bedrooms?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="bathrooms" required>Salles de bain</FieldLabel>
          <input id="bathrooms" type="number" {...register('bathrooms')} placeholder="1" className={inputClass} />
          <FieldError message={errors.bathrooms?.message} />
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <FieldLabel htmlFor="surface_m2" required>Surface (m²)</FieldLabel>
          <input id="surface_m2" type="number" {...register('surface_m2')} placeholder="95" className={inputClass} />
          <FieldError message={errors.surface_m2?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="floor">Étage</FieldLabel>
          <input id="floor" type="number" {...register('floor')} placeholder="3" className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="total_floors">Nb. étages</FieldLabel>
          <input id="total_floors" type="number" {...register('total_floors')} placeholder="5" className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="year_built">Année</FieldLabel>
          <input id="year_built" type="number" {...register('year_built')} placeholder="2020" className={inputClass} />
        </div>
      </div>
    </div>
  )
}

// ─── Step 2: Localisation ───

function Step2({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { register, formState: { errors } } = form

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-theme-primary">Localisation</h2>
      <p className="text-sm text-theme-tertiary">Où se situe le bien ?</p>

      <div>
        <FieldLabel htmlFor="address" required>Adresse</FieldLabel>
        <input id="address" {...register('address')} placeholder="Rue du Lac 12" className={inputClass} />
        <FieldError message={errors.address?.message} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <FieldLabel htmlFor="city" required>Ville</FieldLabel>
          <input id="city" {...register('city')} placeholder="Genève" className={inputClass} />
          <FieldError message={errors.city?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="canton" required>Canton</FieldLabel>
          <select id="canton" {...register('canton')} className={selectClass}>
            <option value="">Sélectionner...</option>
            {CANTONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <FieldError message={errors.canton?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="postal_code" required>Code postal</FieldLabel>
          <input id="postal_code" {...register('postal_code')} placeholder="1207" maxLength={4} className={inputClass} />
          <FieldError message={errors.postal_code?.message} />
        </div>
      </div>

      {/* Map placeholder */}
      <div className="rounded-card border border-dashed border-theme-border bg-theme-section h-48 flex items-center justify-center">
        <div className="text-center">
          <MapPin className="h-8 w-8 text-primary-300 mx-auto mb-2" />
          <p className="text-sm text-theme-tertiary">Carte de localisation (Phase 2)</p>
        </div>
      </div>
    </div>
  )
}

// ─── Step 3: Prix & détails ───

function Step3({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { register, watch, setValue, formState: { errors } } = form
  const features = watch('features') || []
  const price = watch('price')

  function toggleFeature(feature: string) {
    const current = features
    if (current.includes(feature)) {
      setValue('features', current.filter((f) => f !== feature))
    } else {
      setValue('features', [...current, feature])
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-theme-primary">Prix & détails</h2>
      <p className="text-sm text-theme-tertiary">Définissez le prix et les caractéristiques du bien.</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <FieldLabel htmlFor="price" required>Prix de vente</FieldLabel>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-theme-tertiary font-medium">CHF</span>
            <input
              id="price"
              type="number"
              {...register('price')}
              placeholder="720000"
              className={cn(inputClass, 'pl-14')}
            />
          </div>
          {price > 0 && (
            <p className="text-xs text-theme-tertiary mt-1">{formatCHF(price)}</p>
          )}
          <FieldError message={errors.price?.message} />
        </div>
        <div>
          <FieldLabel htmlFor="charges_monthly">Charges mensuelles</FieldLabel>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-theme-tertiary font-medium">CHF</span>
            <input
              id="charges_monthly"
              type="number"
              {...register('charges_monthly')}
              placeholder="350"
              className={cn(inputClass, 'pl-14')}
            />
          </div>
        </div>
      </div>

      <div>
        <FieldLabel htmlFor="mandate_type" required>Type de mandat</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'exclusive', label: 'Exclusif', desc: 'Seul mandataire' },
            { value: 'simple', label: 'Simple', desc: 'Multi-agences' },
            { value: 'search', label: 'Recherche', desc: 'Mandat acheteur' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-input border text-center cursor-pointer transition-colors',
                form.watch('mandate_type') === opt.value
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-section'
              )}
            >
              <input type="radio" value={opt.value} {...register('mandate_type')} className="sr-only" />
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-[11px] text-theme-tertiary mt-0.5">{opt.desc}</span>
            </label>
          ))}
        </div>
        <FieldError message={errors.mandate_type?.message} />
      </div>

      <div>
        <FieldLabel htmlFor="features">Caractéristiques</FieldLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {FEATURES_OPTIONS.map((feature) => (
            <label
              key={feature}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-input border text-sm cursor-pointer transition-colors',
                features.includes(feature)
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-section'
              )}
            >
              <div
                className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center flex-shrink-0',
                  features.includes(feature)
                    ? 'bg-accent border-accent'
                    : 'border-primary-300'
                )}
              >
                {features.includes(feature) && <Check className="h-3 w-3 text-white" />}
              </div>
              <button type="button" onClick={() => toggleFeature(feature)} className="text-left flex-1">
                {feature}
              </button>
            </label>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Photos ───

function Step4({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { watch, setValue } = form
  const rawPhotos = watch('photos')
  const photos = useMemo(() => rawPhotos || [], [rawPhotos])
  const [dragOver, setDragOver] = useState(false)

  const addPlaceholderPhotos = useCallback(() => {
    // Simulates photo upload with placeholder URLs
    const placeholders = [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
    ]
    const unused = placeholders.filter((p) => !photos.includes(p))
    if (unused.length > 0) {
      setValue('photos', [...photos, unused[0]])
    }
  }, [photos, setValue])

  function removePhoto(url: string) {
    setValue('photos', photos.filter((p) => p !== url))
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-theme-primary">Photos</h2>
      <p className="text-sm text-theme-tertiary">
        Ajoutez des photos de qualité. La première sera la photo principale.
      </p>

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addPlaceholderPhotos() }}
        onClick={addPlaceholderPhotos}
        className={cn(
          'border-2 border-dashed rounded-card p-8 text-center cursor-pointer transition-colors',
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-theme-border hover:border-primary-300 hover:bg-theme-section/50'
        )}
      >
        <Upload className={cn('h-10 w-10 mx-auto mb-3', dragOver ? 'text-accent' : 'text-primary-300')} />
        <p className="text-sm font-medium text-theme-primary">
          Glissez vos photos ici ou cliquez pour parcourir
        </p>
        <p className="text-xs text-theme-tertiary mt-1">
          JPG, PNG ou WebP · Max 10 Mo par photo · Jusqu'à 20 photos
        </p>
      </div>

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {photos.map((url, idx) => (
            <div key={url} className="relative group aspect-[4/3] rounded-card overflow-hidden border border-theme-border">
              <img src={url} alt={`Photo ${idx + 1}`} className="w-full h-full object-cover" />
              {/* Overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
                  <GripVertical className="h-5 w-5 text-white cursor-grab" />
                  <button
                    type="button"
                    onClick={() => removePhoto(url)}
                    className="h-8 w-8 rounded-full bg-danger text-white flex items-center justify-center hover:bg-danger/90 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              {/* Badge for first photo */}
              {idx === 0 && (
                <span className="absolute top-2 left-2 text-[10px] font-semibold bg-accent text-white px-2 py-0.5 rounded-badge">
                  Photo principale
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-theme-tertiary">
        {photos.length}/20 photos · L'upload sera connecté à Supabase Storage (Phase 2)
      </p>
    </div>
  )
}

// ─── Step 5: Description & publication ───

function Step5({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { register, watch, setValue, formState: { errors } } = form
  const tags = watch('tags') || []
  const title = watch('title')
  const price = watch('price')
  const city = watch('city')
  const canton = watch('canton')
  const rooms = watch('rooms')
  const surface = watch('surface_m2')
  const type = watch('type')

  function toggleTag(tag: string) {
    if (tags.includes(tag)) {
      setValue('tags', tags.filter((t) => t !== tag))
    } else {
      setValue('tags', [...tags, tag])
    }
  }

  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-theme-primary">Description & publication</h2>
      <p className="text-sm text-theme-tertiary">Rédigez une description attrayante et choisissez vos tags.</p>

      <div>
        <FieldLabel htmlFor="description" required>Description du bien</FieldLabel>
        <textarea
          id="description"
          {...register('description')}
          rows={6}
          placeholder="Décrivez les points forts du bien, son environnement, ses atouts..."
          className="w-full px-4 py-3 text-sm bg-transparent border border-theme-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y"
        />
        <FieldError message={errors.description?.message} />
      </div>

      <div>
        <FieldLabel htmlFor="tags">Tags</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-colors',
                tags.includes(tag)
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-section'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* AI Listing Generator */}
      {title && city && price > 0 && rooms > 0 && surface > 0 && (
        <ListingGenerator
          propertyTitle={title}
          propertyType={type || 'apartment'}
          rooms={rooms}
          surface={surface}
          city={city}
          price={price}
          features={form.watch('features') || []}
        />
      )}

      {/* Preview card */}
      <div>
        <p className="text-sm font-medium text-theme-primary mb-3">Aperçu de l'annonce</p>
        <div className="bg-theme-section rounded-card border border-theme-border p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-lg font-bold text-theme-primary">
                {price > 0 ? formatCHF(price) : 'CHF —'}
              </p>
              <h3 className="text-sm font-semibold text-theme-primary mt-0.5">
                {title || 'Titre de l\'annonce'}
              </h3>
              <p className="text-xs text-theme-tertiary mt-0.5">
                {city || 'Ville'}{canton ? ` (${canton})` : ''}
              </p>
            </div>
            {type && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-badge bg-theme-card text-theme-secondary border border-theme-border">
                {PROPERTY_TYPE_LABELS[type]}
              </span>
            )}
          </div>
          {(rooms > 0 || surface > 0) && (
            <p className="text-xs text-theme-secondary mb-3">
              {rooms > 0 && `${rooms} pièces`}
              {rooms > 0 && surface > 0 && ' · '}
              {surface > 0 && `${surface} m²`}
            </p>
          )}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {tags.map((tag) => (
                <span key={tag} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-theme-secondary line-clamp-3">
            {watch('description') || 'La description apparaîtra ici...'}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Main wizard ───

export default function ListingFormPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])

  const form = useForm<ListingFormData>({
    defaultValues: {
      title: '',
      type: undefined,
      rooms: undefined as unknown as number,
      bedrooms: undefined as unknown as number,
      bathrooms: undefined as unknown as number,
      surface_m2: undefined as unknown as number,
      floor: undefined,
      total_floors: undefined,
      year_built: undefined,
      address: '',
      city: '',
      canton: '',
      postal_code: '',
      price: undefined as unknown as number,
      charges_monthly: undefined,
      mandate_type: undefined,
      features: [],
      photos: [],
      description: '',
      tags: [],
    },
    mode: 'onTouched',
  })

  async function validateCurrentStep(): Promise<boolean> {
    const schema = stepSchemas[currentStep - 1]
    const values = form.getValues()
    const result = schema.safeParse(values)

    if (!result.success) {
      // Set errors on form
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof ListingFormData
        form.setError(path, { message: issue.message })
      }
      return false
    }

    // Clear errors for current step fields
    const stepFields = Object.keys(schema.shape) as (keyof ListingFormData)[]
    stepFields.forEach((field) => form.clearErrors(field))

    return true
  }

  async function handleNext() {
    const valid = await validateCurrentStep()
    if (!valid) return

    setCompletedSteps((prev) => [...new Set([...prev, currentStep])])
    setCurrentStep((s) => Math.min(s + 1, 5))
  }

  function handlePrev() {
    setCurrentStep((s) => Math.max(s - 1, 1))
  }

  function handleSaveDraft() {
    // Future: save form.getValues() to Supabase with status 'draft'
    navigate('/dashboard/listings')
  }

  async function handlePublish() {
    const valid = await validateCurrentStep()
    if (!valid) return

    const result = fullSchema.safeParse(form.getValues())
    if (!result.success) {
      // Find which step has errors and go there
      for (const issue of result.error.issues) {
        const path = issue.path[0] as string
        for (let i = 0; i < stepSchemas.length; i++) {
          if (path in stepSchemas[i].shape) {
            setCurrentStep(i + 1)
            form.setError(path as keyof ListingFormData, { message: issue.message })
            return
          }
        }
      }
      return
    }

    // Future: save to Supabase with status 'active'
    setCompletedSteps((prev) => [...new Set([...prev, 5])])
    navigate('/dashboard/listings')
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/listings"
          className="p-2 rounded-md text-theme-secondary hover:text-theme-primary hover:bg-theme-section transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Nouveau bien</h1>
          <p className="text-sm text-theme-tertiary">Étape {currentStep} sur 5</p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper current={currentStep} completed={completedSteps} />

      {/* Form card */}
      <div className="rounded-xl border border-theme-border p-6 md:p-8">
        <form onSubmit={(e) => e.preventDefault()}>
          {currentStep === 1 && <Step1 form={form} />}
          {currentStep === 2 && <Step2 form={form} />}
          {currentStep === 3 && <Step3 form={form} />}
          {currentStep === 4 && <Step4 form={form} />}
          {currentStep === 5 && <Step5 form={form} />}
        </form>
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <div>
          {currentStep > 1 && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              className="gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Précédent
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSaveDraft}
            className="gap-2 text-theme-secondary"
          >
            <Save className="h-4 w-4" />
            Enregistrer en brouillon
          </Button>

          {currentStep < 5 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="gap-2"
            >
              Suivant
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handlePublish}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              Publier l'annonce
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
