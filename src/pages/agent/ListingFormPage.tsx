import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import {
  ArrowLeft, Check, Save, Send,
  Upload, X, GripVertical, Loader2, ChevronDown, ShieldCheck,
  Minus, Plus, MapPin, PenLine, Copy, Link2, FileText,
  Building2, Home as HomeIcon, Castle, Store, Mountain, CarFront, Briefcase, Warehouse,
} from 'lucide-react'
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn, formatCHF, formatRent } from '@/lib/utils'
import { PROPERTY_TYPE_LABELS, CANTONS } from '@/lib/constants'
import type { PropertyType } from '@/lib/constants'
// ListingGenerator import removed alongside its render block — the
// component generated text via a hardcoded switch (no Claude call).
import SwissAddressAutocomplete from '@/components/listings/SwissAddressAutocomplete'
import type { SwissAddressSuggestion } from '@/hooks/useSwissAddress'
import {
  useProperty,
  useAgencyProperties,
  useCreateProperty,
  useUpdateProperty,
  useUploadPropertyPhotos,
  useUploadFloorPlan,
  PropertyUpdateConflictError,
} from '@/hooks/useProperties'
import { useExtractPropertyPdf, type ExtractedPropertyData } from '@/hooks/useExtractPropertyPdf'
import { useExtractPropertyUrl } from '@/hooks/useExtractPropertyUrl'
import { useCreateListing } from '@/hooks/useListings'
import { useAuth } from '@/hooks/useAuth'
import { useSignPhotos } from '@/hooks/useC2pa'
import { useVirtualStaging, STAGING_STYLES, ROOM_TYPES, type StagingStyle, type RoomType } from '@/hooks/useVirtualStaging'
import FloorPlanEditor from '@/components/listings/FloorPlanEditor'
import UpgradePrompt from '@/components/ui/UpgradePrompt'
import GalleryLayoutPicker from '@/components/listing/GalleryLayoutPicker'
import {
  ContactLayoutPicker,
  NeighborhoodVariantPicker,
  PartnerAgencyPicker,
} from '@/components/listing/ListingDisplayPickers'
import { usePlanLimits } from '@/hooks/usePlanLimits'
import { FLOOR_PLAN_ROOMS } from '@/types/floorPlan'
import type { FloorPlanHotspot, PhotoTag } from '@/types/floorPlan'

// ─── Zod schemas per step ───

// Helper: coerce empty/undefined/null to undefined, otherwise to number
const optionalNumber = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().optional()
)
const optionalNumberRange = (min: number, max: number) => z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().min(min).max(max).optional()
)

// Swiss real-world bounds. `lat` and `lng` outside these mean the property
// isn't in Switzerland — coords from neighbouring countries get rejected here
// instead of producing a Mulhouse listing tagged canton=GE.
const optionalCHLat = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().min(45.8, 'Latitude hors Suisse').max(47.85, 'Latitude hors Suisse').optional(),
)
const optionalCHLng = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number().min(5.95, 'Longitude hors Suisse').max(10.5, 'Longitude hors Suisse').optional(),
)

// Block `javascript:`, `data:`, `file:`, etc. on contact links — `external_regie.website`
// is rendered as `<a href>` on the listing page, so anything other than http(s) is
// either dangerous or useless.
const optionalSafeUrl = z
  .string()
  .optional()
  .refine(
    (v) => {
      if (!v || v.trim() === '') return true
      try {
        const u = new URL(v.trim())
        return u.protocol === 'http:' || u.protocol === 'https:'
      } catch {
        return false
      }
    },
    { message: 'URL invalide (http(s) uniquement)' },
  )

const optionalEmail = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.trim() === '' || z.string().email().safeParse(v.trim()).success,
    { message: 'Email invalide' },
  )

const CURRENT_YEAR = new Date().getFullYear()
const PRICE_MAX_BUY = 200_000_000 // CHF 200M — guards against scientific-notation or fat-finger inputs
const PRICE_MIN_BUY = 50_000
const PRICE_MIN_RENT = 100
const PRICE_MAX_RENT = 50_000

// CECB obligatoire à la vente dans certains cantons (loi cantonale énergie).
// GE/VD/NE imposent la production du certificat énergétique cantonal CECB
// avant toute mise en vente ; le notaire refusera l'acte sans cette pièce.
// Voir src/lib/cantonalTaxRates.ts pour le mapping `energyLabelSystem`.
const CECB_REQUIRED_CANTONS = ['GE', 'VD', 'NE'] as const

const ENERGY_CLASS_OPTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const

// Shared cross-field validator for step 3 — applied on both the per-step
// schema AND the merged fullSchema, so the publish path can't sneak past
// the rent/buy bounds.
function refineStep3(
  d: { transaction_type?: 'buy' | 'rent'; price?: number; availability_date?: string },
  ctx: z.RefinementCtx,
) {
  if (d.transaction_type === 'rent') {
    if (!d.price || d.price < PRICE_MIN_RENT || d.price > PRICE_MAX_RENT) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: `Loyer entre CHF ${PRICE_MIN_RENT} et CHF ${PRICE_MAX_RENT.toLocaleString('fr-CH')}/mois`,
      })
    }
    if (!d.availability_date) {
      ctx.addIssue({ code: 'custom', path: ['availability_date'], message: 'Date requise pour une location' })
    }
  } else {
    if (!d.price || d.price < PRICE_MIN_BUY || d.price > PRICE_MAX_BUY) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: `Prix entre CHF ${PRICE_MIN_BUY.toLocaleString('fr-CH')} et CHF ${PRICE_MAX_BUY.toLocaleString('fr-CH')}`,
      })
    }
  }
}

// Cross-step validator — only meaningful on the merged fullSchema because it
// needs transaction_type (step3) + canton (step2) + energy_class (step1) in
// the same object. Applied on publish, not per-step.
function refineCecb(
  d: { transaction_type?: 'buy' | 'rent'; canton?: string; energy_class?: string },
  ctx: z.RefinementCtx,
) {
  if (
    d.transaction_type !== 'rent' &&
    d.canton &&
    (CECB_REQUIRED_CANTONS as readonly string[]).includes(d.canton) &&
    !d.energy_class
  ) {
    ctx.addIssue({
      code: 'custom',
      path: ['energy_class'],
      message: `CECB obligatoire à la vente dans le canton ${d.canton}. Renseignez la classe énergétique.`,
    })
  }
}

const step1Schema = z.object({
  title: z
    .string()
    .min(5, 'Le titre doit contenir au moins 5 caractères')
    .max(200, 'Maximum 200 caractères'),
  transaction_type: z.enum(['buy', 'rent']).default('buy'),
  type: z.enum(['apartment', 'house', 'villa', 'commercial', 'land'], {
    message: 'Sélectionnez un type de bien',
  }),
  rooms: z.coerce.number().min(0.5, 'Minimum 0.5 pièce').max(30, 'Maximum 30 pièces'),
  bedrooms: z.coerce.number().min(0, 'Minimum 0').max(20, 'Maximum 20 chambres'),
  bathrooms: z.coerce.number().min(0, 'Minimum 0').max(10, 'Maximum 10'),
  surface_m2: z.coerce.number().min(5, 'Minimum 5 m²').max(10000, 'Maximum 10000 m²'),
  floor: optionalNumber,
  total_floors: optionalNumber,
  year_built: optionalNumberRange(1800, CURRENT_YEAR + 5),
  condition: z.enum(['new', 'renovated', 'good', 'to_renovate']).optional(),
  // CECB letter (A–G). Optional at step1; refineCecb (applied on fullSchema)
  // promotes it to "required" when canton ∈ {GE,VD,NE} and transaction is buy.
  energy_class: z.enum(ENERGY_CLASS_OPTIONS).optional(),
})

const step2Schema = z.object({
  address: z.string().min(3, "L'adresse est requise").max(200, 'Maximum 200 caractères'),
  city: z.string().min(2, 'La ville est requise').max(100, 'Maximum 100 caractères'),
  canton: z.enum(CANTONS as unknown as [string, ...string[]], {
    message: 'Sélectionnez un canton suisse valide',
  }),
  postal_code: z
    .string()
    .regex(/^[1-9]\d{3}$/, 'NPA suisse invalide (4 chiffres, ne commence pas par 0)'),
  lat: optionalCHLat,
  lng: optionalCHLng,
  // EGID — Swiss federal building identifier (9 digits). Optional at the form
  // layer but a DB CHECK constraint enforces format. The notaire requires it
  // for the acte authentique; FINMA expects it for LBA dossier reconstruction.
  egid: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : String(v).trim()),
    z.string().regex(/^[0-9]{9}$/, 'EGID = 9 chiffres (identifiant fédéral du bâtiment)').optional(),
  ),
})

const step3SchemaBase = z.object({
  transaction_type: z.enum(['buy', 'rent']).default('buy'),
  price: z.coerce.number().min(0, 'Prix négatif refusé'),
  charges_monthly: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).max(10_000).optional(),
  ),
  mandate_type: z.enum(['exclusive', 'simple', 'search'], {
    message: 'Sélectionnez un type de mandat',
  }),
  features: z.array(z.string().max(60)).max(50, 'Maximum 50 caractéristiques').optional(),
  availability_date: z.string().optional(),
  deposit_months: z.coerce.number().int().min(1).max(3).optional(),
  is_furnished: z.boolean().optional(),
  external_regie: z
    .object({
      name: z.string().max(120).optional(),
      phone: z.string().max(40).optional(),
      email: optionalEmail,
      website: optionalSafeUrl,
    })
    .optional(),
})

const step3Schema = step3SchemaBase.superRefine(refineStep3)

const step4Schema = z.object({
  photos: z.array(z.string().url('URL de photo invalide')).max(50, 'Maximum 50 photos').optional(),
  gallery_layout: z.enum(['hero', 'mosaic', 'carousel']).optional(),
  contact_layout: z.enum(['right', 'banner', 'floating']).optional(),
  neighborhood_variant: z.enum(['scores', 'map']).optional(),
  partner_agency: z.enum(['naef', 'cardis', 'bernard']).nullable().optional(),
})

const step5Schema = z.object({
  description: z
    .string()
    .min(20, 'La description doit contenir au moins 20 caractères')
    .max(10_000, 'Description trop longue (max 10 000 caractères)'),
  tags: z.array(z.string().max(40)).max(20, 'Maximum 20 tags').optional(),
})

// `fullSchema` re-applies `refineStep3` so the publish path can't bypass
// rent/buy bounds (publish calls fullSchema.safeParse, not step3Schema).
// It also applies `refineCecb` which spans 3 steps (energy_class in step1 +
// canton in step2 + transaction_type in step3) and therefore can only be
// evaluated once everything is merged.
const fullSchema = step1Schema
  .merge(step2Schema)
  .merge(step3SchemaBase)
  .merge(step4Schema)
  .merge(step5Schema)
  .superRefine((d, ctx) => {
    refineStep3(d, ctx)
    refineCecb(d, ctx)
  })

type ListingFormData = z.infer<typeof fullSchema>


const FEATURES_CATEGORIZED = [
  {
    category: 'Extérieur',
    items: ['Balcon', 'Terrasse', 'Jardin', 'Piscine'],
  },
  {
    category: 'Parking & stockage',
    items: ['Garage', 'Parking', 'Place de parc', 'Cave'],
  },
  {
    category: 'Intérieur',
    items: ['Ascenseur', 'Cheminée', 'Climatisation', 'Buanderie', 'Meublé'],
  },
  {
    category: 'Qualité & accessibilité',
    items: ['Minergie', 'Vue lac', 'Vue montagne', 'Accès PMR'],
  },
]

const TAG_OPTIONS = [
  'Nouveau', 'Exclusif', 'Hot price', 'Coup de cœur', 'Idéal famille',
  'Investissement', 'Première acquisition', 'Dernière chance',
]

const stepSchemas = [step1Schema, step2Schema, step3Schema, step4Schema, step5Schema] as const
const stepShapes = [
  step1Schema.shape,
  step2Schema.shape,
  step3SchemaBase.shape,
  step4Schema.shape,
  step5Schema.shape,
] as const

const PROPERTY_TYPE_DESCRIPTIONS: Record<string, string> = {
  apartment: 'PPE ou locatif',
  house: 'Individuelle ou mitoyenne',
  villa: 'Haut de gamme',
  commercial: 'Bureau ou commerce',
  land: 'Terrain constructible',
}

const PROPERTY_TYPE_ICONS: Record<string, typeof Building2> = {
  apartment: Building2,
  house: HomeIcon,
  villa: Castle,
  commercial: Store,
  office: Briefcase,
  parking: CarFront,
  storage: Warehouse,
  land: Mountain,
}

const CONDITION_OPTIONS = [
  { value: 'new', label: 'Neuf' },
  { value: 'renovated', label: 'Rénové' },
  { value: 'good', label: 'Bon état' },
  { value: 'to_renovate', label: 'À rénover' },
] as const

const AVAILABILITY_OPTIONS = [
  { value: 'immediate', label: 'Immédiat' },
  { value: '3months', label: 'Dans 3 mois' },
  { value: 'negotiable', label: 'À convenir' },
] as const


// ─── Number Stepper component ───

function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  label,
  error,
}: {
  value: number | undefined
  onChange: (val: number) => void
  min?: number
  max?: number
  step?: number
  label: string
  error?: string
}) {
  const current = value ?? min

  function decrement() {
    const next = Math.max(min, current - step)
    onChange(Number(next.toFixed(1)))
  }

  function increment() {
    const next = Math.min(max, current + step)
    onChange(Number(next.toFixed(1)))
  }

  return (
    <div>
      <p className="text-sm font-medium text-theme-primary mb-2">{label}</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={decrement}
          disabled={current <= min}
          className={cn(
            'h-10 w-10 rounded-lg border flex items-center justify-center transition-colors',
            current <= min
              ? 'border-theme-border text-theme-muted cursor-not-allowed'
              : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
          )}
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-lg font-semibold text-theme-primary w-12 text-center tabular-nums">
          {current % 1 === 0 ? current : current.toFixed(1)}
        </span>
        <button
          type="button"
          onClick={increment}
          disabled={current >= max}
          className={cn(
            'h-10 w-10 rounded-lg border flex items-center justify-center transition-colors',
            current >= max
              ? 'border-theme-border text-theme-muted cursor-not-allowed'
              : 'border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
          )}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// ─── Field helpers ───

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-theme-primary mb-1.5">
      {children}
    </label>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-red-500 mt-1">{message}</p>
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="pt-2">
      <p className="text-xs font-medium text-theme-muted capitalize">{title}</p>
    </div>
  )
}

const inputClass = 'w-full h-11 px-4 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors text-theme-primary placeholder:text-theme-muted'
const selectClass = 'w-full h-11 px-4 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-primary'

// ─── Step 1: Infos générales (refonte) ───

function Step1({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { register, watch, setValue, formState: { errors } } = form

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">Informations générales</h2>
        <p className="text-sm text-theme-tertiary mt-1">Décrivez votre bien immobilier.</p>
      </div>

      {/* Title */}
      <div>
        <FieldLabel htmlFor="title">Titre de l'annonce</FieldLabel>
        <input
          id="title"
          {...register('title')}
          placeholder="Ex : Appartement lumineux aux Eaux-Vives"
          className={inputClass}
        />
        <FieldError message={errors.title?.message} />
      </div>

      {/* Property type — icons + labels */}
      <div>
        <FieldLabel htmlFor="type">Type de bien</FieldLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {(Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][]).map(([value, label]) => {
            const Icon = PROPERTY_TYPE_ICONS[value]
            const isSelected = watch('type') === value
            return (
              <label
                key={value}
                className={cn(
                  'flex flex-col items-center justify-center py-5 px-3 rounded-xl border text-center cursor-pointer transition-all duration-200',
                  isSelected
                    ? 'border-theme-primary bg-theme-active text-theme-primary scale-[1.02]'
                    : 'border-theme-border text-theme-secondary hover:bg-theme-hover hover:border-theme-active'
                )}
              >
                <input type="radio" value={value} {...register('type')} className="sr-only" />
                <Icon className={cn('h-7 w-7 mb-2', isSelected ? 'text-theme-primary' : 'text-theme-muted')} />
                <span className="text-sm font-medium">{label}</span>
                <span className={cn('text-xs mt-0.5', isSelected ? 'text-theme-secondary' : 'text-theme-muted')}>{PROPERTY_TYPE_DESCRIPTIONS[value]}</span>
              </label>
            )
          })}
        </div>
        <FieldError message={errors.type?.message} />
      </div>

      <SectionDivider title="Caractéristiques" />

      {/* Number steppers for rooms, bedrooms, bathrooms */}
      <div className="grid grid-cols-3 gap-6">
        <NumberStepper
          label="Pièces"
          value={watch('rooms')}
          onChange={(v) => setValue('rooms', v, { shouldValidate: true })}
          min={0.5}
          max={30}
          step={0.5}
          error={errors.rooms?.message}
        />
        <NumberStepper
          label="Chambres"
          value={watch('bedrooms')}
          onChange={(v) => setValue('bedrooms', v, { shouldValidate: true })}
          min={0}
          max={20}
          step={1}
          error={errors.bedrooms?.message}
        />
        <NumberStepper
          label="Salles de bain"
          value={watch('bathrooms')}
          onChange={(v) => setValue('bathrooms', v, { shouldValidate: true })}
          min={0}
          max={10}
          step={1}
          error={errors.bathrooms?.message}
        />
      </div>

      {/* Surface + floor details */}
      <div className="grid grid-cols-2 gap-5">
        <div>
          <FieldLabel htmlFor="surface_m2">Surface</FieldLabel>
          <div className="relative">
            <input
              id="surface_m2"
              type="number"
              {...register('surface_m2')}
              placeholder="95"
              className={cn(inputClass, 'pr-12')}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-theme-muted">m²</span>
          </div>
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

      {/* Condition */}
      <div>
        <FieldLabel htmlFor="condition">État du bien</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {CONDITION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('condition', watch('condition') === opt.value ? undefined : opt.value as ListingFormData['condition'], { shouldValidate: true })}
              className={cn(
                'h-10 px-5 rounded-lg text-sm font-medium border transition-all',
                watch('condition') === opt.value
                  ? 'border-theme-primary bg-theme-active text-theme-primary'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* CECB — classe énergétique (obligatoire à la vente pour GE/VD/NE,
          validée côté fullSchema via refineCecb) */}
      <div>
        <FieldLabel htmlFor="energy_class">Classe énergétique (CECB)</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {ENERGY_CLASS_OPTIONS.map((letter) => {
            const active = watch('energy_class') === letter
            return (
              <button
                key={letter}
                type="button"
                onClick={() =>
                  setValue(
                    'energy_class',
                    active ? undefined : letter,
                    { shouldValidate: true, shouldDirty: true },
                  )
                }
                className={cn(
                  'h-10 w-10 rounded-lg text-sm font-semibold border transition-all',
                  active
                    ? 'border-theme-primary bg-theme-active text-theme-primary'
                    : 'border-theme-border text-theme-secondary hover:bg-theme-hover hover:text-theme-primary',
                )}
                aria-pressed={active}
              >
                {letter}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-theme-muted mt-1.5">
          Requis à la vente dans les cantons GE, VD, NE (loi cantonale énergie).
        </p>
        <FieldError message={errors.energy_class?.message} />
      </div>
    </div>
  )
}

// ─── Step 2: Localisation (refonte avec autocomplete) ───

function Step2({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { register, watch, setValue, formState: { errors } } = form
  const [isManualMode, setIsManualMode] = useState(false)
  const address = watch('address')
  const city = watch('city')
  const canton = watch('canton')
  const postalCode = watch('postal_code')
  const lat = watch('lat')
  const lng = watch('lng')
  const hasAddress = Boolean(address && city && canton && postalCode)

  function handleAddressSelect(suggestion: SwissAddressSuggestion) {
    setValue('address', suggestion.street, { shouldValidate: true })
    setValue('city', suggestion.city, { shouldValidate: true })
    setValue('canton', suggestion.canton, { shouldValidate: true })
    setValue('postal_code', suggestion.postalCode, { shouldValidate: true })
    setValue('lat', suggestion.lat)
    setValue('lng', suggestion.lng)
    setIsManualMode(false)
  }

  function handleClearAddress() {
    setValue('address', '')
    setValue('city', '')
    setValue('canton', '')
    setValue('postal_code', '')
    setValue('lat', undefined)
    setValue('lng', undefined)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">Localisation</h2>
        <p className="text-sm text-theme-tertiary mt-1">Où se situe le bien ?</p>
      </div>

      {!isManualMode ? (
        <>
          {/* Swiss address autocomplete */}
          <div>
            <FieldLabel htmlFor="address-search">Adresse du bien</FieldLabel>
            <SwissAddressAutocomplete
              onSelect={handleAddressSelect}
              defaultValue={address}
              placeholder="Tapez une adresse suisse..."
            />
            <p className="text-xs text-theme-muted mt-1.5">
              Recherche dans toutes les adresses officielles suisses
            </p>
          </div>

          {/* Selected address summary */}
          {hasAddress && (
            <div className="rounded-lg border border-theme-border p-4 bg-theme-section">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-theme-active flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MapPin className="h-4 w-4 text-theme-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-theme-primary">{address}</p>
                    <p className="text-xs text-theme-secondary mt-0.5">
                      {postalCode} {city} ({canton})
                    </p>
                    {lat && lng && (
                      <p className="text-xs text-theme-muted mt-1">
                        {lat.toFixed(6)}, {lng.toFixed(6)}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearAddress}
                  className="text-theme-muted hover:text-theme-primary p-1 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Readonly fields showing selected data */}
          {hasAddress && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-theme-muted mb-1">Rue</p>
                <p className="text-sm text-theme-primary font-medium truncate">{address}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted mb-1">Ville</p>
                <p className="text-sm text-theme-primary font-medium">{city}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted mb-1">NPA</p>
                <p className="text-sm text-theme-primary font-medium">{postalCode}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted mb-1">Canton</p>
                <p className="text-sm text-theme-primary font-medium">{canton}</p>
              </div>
            </div>
          )}

          {/* Toggle manual mode */}
          <button
            type="button"
            onClick={() => setIsManualMode(true)}
            className="text-xs text-theme-muted hover:text-theme-secondary transition-colors underline underline-offset-2"
          >
            Saisir manuellement
          </button>
        </>
      ) : (
        <>
          {/* Manual mode — classic fields */}
          <div>
            <FieldLabel htmlFor="address">Adresse</FieldLabel>
            <input id="address" {...register('address')} placeholder="Rue du Lac 12" className={inputClass} />
            <FieldError message={errors.address?.message} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel htmlFor="city">Ville</FieldLabel>
              <input id="city" {...register('city')} placeholder="Genève" className={inputClass} />
              <FieldError message={errors.city?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="canton">Canton</FieldLabel>
              <select id="canton" {...register('canton')} className={selectClass}>
                <option value="">Sélectionner...</option>
                {CANTONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <FieldError message={errors.canton?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="postal_code">Code postal</FieldLabel>
              <input id="postal_code" {...register('postal_code')} placeholder="1207" maxLength={4} className={inputClass} />
              <FieldError message={errors.postal_code?.message} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsManualMode(false)}
            className="text-xs text-theme-muted hover:text-theme-secondary transition-colors underline underline-offset-2"
          >
            Rechercher par adresse
          </button>
        </>
      )}

      {/* EGID — identifiant fédéral du bâtiment (9 chiffres, OFS).
          Optionnel au formulaire mais requis par le notaire pour l'acte
          authentique. Toujours visible (mode autocomplete + mode manuel). */}
      <div>
        <FieldLabel htmlFor="egid">EGID (identifiant fédéral du bâtiment)</FieldLabel>
        <input
          id="egid"
          {...register('egid')}
          placeholder="987654321"
          inputMode="numeric"
          maxLength={9}
          className={inputClass}
        />
        <p className="text-xs text-theme-muted mt-1.5">
          9 chiffres — recherchable sur <span className="font-mono">map.geo.admin.ch</span>.
          Optionnel ici, indispensable chez le notaire.
        </p>
        <FieldError message={errors.egid?.message} />
      </div>

      {/* Mini map placeholder — will show actual map when lat/lng available */}
      <div className={cn(
        'rounded-lg border overflow-hidden h-48',
        lat && lng ? 'border-theme-border' : 'border-dashed border-theme-border bg-theme-section'
      )}>
        {lat && lng ? (
          <div className="w-full h-full bg-theme-section flex items-center justify-center relative">
            <div className="text-center">
              <MapPin className="h-6 w-6 text-theme-primary mx-auto mb-1" />
              <p className="text-xs text-theme-secondary">{lat.toFixed(4)}, {lng.toFixed(4)}</p>
              <p className="text-xs text-theme-muted mt-0.5">Carte Mapbox (prochaine mise à jour)</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <MapPin className="h-8 w-8 text-theme-muted mx-auto mb-2" />
              <p className="text-xs text-theme-muted">Sélectionnez une adresse pour voir la localisation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 3: Prix & détails (refonte features catégorisées) ───

function Step3({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { register, watch, setValue, formState: { errors } } = form
  const features = watch('features') || []
  const price = watch('price')
  const surface = watch('surface_m2')
  const availabilityDate = watch('availability_date')
  const txType = watch('transaction_type') ?? 'buy'
  const isRent = txType === 'rent'
  const depositMonths = watch('deposit_months')
  const isFurnished = watch('is_furnished') ?? false

  // Price per m² calculation (buy only)
  const pricePerM2 = !isRent && price > 0 && surface > 0 ? Math.round(price / surface) : null

  function toggleFeature(feature: string) {
    const current = features
    if (current.includes(feature)) {
      setValue('features', current.filter((f) => f !== feature))
    } else {
      setValue('features', [...current, feature])
    }
  }

  function setAvailabilityQuick(option: string) {
    if (option === 'immediate') {
      setValue('availability_date', new Date().toISOString().split('T')[0])
    } else if (option === '3months') {
      const d = new Date()
      d.setMonth(d.getMonth() + 3)
      setValue('availability_date', d.toISOString().split('T')[0])
    } else {
      setValue('availability_date', '')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">Prix & détails</h2>
        <p className="text-sm text-theme-tertiary mt-1">Définissez le prix et les caractéristiques du bien.</p>
      </div>

      {/* Price — prominent section */}
      <div className="rounded-xl border border-theme-border p-5 bg-theme-section/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="price">{isRent ? 'Loyer mensuel' : 'Prix de vente'}</FieldLabel>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-theme-muted font-medium">CHF</span>
              <input
                id="price"
                type="number"
                {...register('price')}
                placeholder={isRent ? '2500' : '720000'}
                className={cn(inputClass, 'pl-14 text-lg font-semibold h-12')}
              />
              {isRent && (
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-theme-muted">/mois</span>
              )}
            </div>
            <FieldError message={errors.price?.message} />
          </div>
        <div>
          <FieldLabel htmlFor="charges_monthly">Charges mensuelles</FieldLabel>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-theme-muted font-medium">CHF</span>
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

        {/* Price summary badges */}
        {price > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-theme-border/50 mt-3">
            <span className="text-sm font-semibold text-theme-primary">
              {isRent ? formatRent(price) : formatCHF(price)}
            </span>
            {pricePerM2 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-theme-active text-theme-primary">
                {formatCHF(pricePerM2)}/m²
              </span>
            )}
          </div>
        )}

        {/* Rental-only: deposit (caution) */}
        {isRent && (
          <div className="pt-4 border-t border-theme-border/50 mt-3">
            <FieldLabel>Caution (mois de loyer)</FieldLabel>
            <div className="flex gap-2">
              {[1, 2, 3].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setValue('deposit_months', n, { shouldValidate: true, shouldDirty: true })}
                  className={cn(
                    'h-9 px-4 rounded-lg text-sm transition-colors',
                    depositMonths === n
                      ? 'bg-theme-active text-theme-primary font-medium'
                      : 'text-theme-secondary hover:text-theme-primary border border-theme-border'
                  )}
                  aria-pressed={depositMonths === n}
                >
                  {n} mois
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rental-only: furnished toggle */}
        {isRent && (
          <div className="pt-4 border-t border-theme-border/50 mt-3">
            <FieldLabel>Meublé</FieldLabel>
            <div className="flex gap-2">
              {[
                { value: false, label: 'Non meublé' },
                { value: true, label: 'Meublé' },
              ].map((opt) => (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => setValue('is_furnished', opt.value, { shouldValidate: true, shouldDirty: true })}
                  className={cn(
                    'h-9 px-4 rounded-lg text-sm transition-colors',
                    isFurnished === opt.value
                      ? 'bg-theme-active text-theme-primary font-medium'
                      : 'text-theme-secondary hover:text-theme-primary border border-theme-border'
                  )}
                  aria-pressed={isFurnished === opt.value}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mandate type */}
      <div>
        <FieldLabel htmlFor="mandate_type">Type de mandat</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: 'exclusive', label: 'Exclusif', desc: 'Seul mandataire' },
            { value: 'simple', label: 'Simple', desc: 'Multi-agences' },
            { value: 'search', label: 'Recherche', desc: 'Mandat acheteur' },
          ].map((opt) => (
            <label
              key={opt.value}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all',
                watch('mandate_type') === opt.value
                  ? 'border-theme-primary bg-theme-active text-theme-primary'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-hover'
              )}
            >
              <input type="radio" value={opt.value} {...register('mandate_type')} className="sr-only" />
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-theme-muted mt-0.5">{opt.desc}</span>
            </label>
          ))}
        </div>
        <FieldError message={errors.mandate_type?.message} />
      </div>

      {/* Rental-only: external regie (optional) */}
      {isRent && (
        <details className="rounded-xl border border-theme-border p-4 group">
          <summary className="text-sm font-medium text-theme-primary cursor-pointer select-none flex items-center justify-between">
            <span>Régie externe (optionnel — sinon l'agence publie sous son nom)</span>
            <ChevronDown className="w-4 h-4 text-theme-secondary transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {[
              { field: 'name', label: 'Nom régie', placeholder: 'Régie Bernard SA', type: 'text' },
              { field: 'phone', label: 'Téléphone', placeholder: '+41 22 555 00 00', type: 'tel' },
              { field: 'email', label: 'Email', placeholder: 'contact@regie.ch', type: 'email' },
              { field: 'website', label: 'Site web', placeholder: 'https://regie.ch', type: 'url' },
            ].map((f) => (
              <div key={f.field}>
                <FieldLabel htmlFor={`regie_${f.field}`}>{f.label}</FieldLabel>
                <input
                  id={`regie_${f.field}`}
                  type={f.type}
                  placeholder={f.placeholder}
                  value={(watch('external_regie') as Record<string, string> | undefined)?.[f.field] ?? ''}
                  onChange={(e) => {
                    const current = watch('external_regie') ?? {}
                    setValue('external_regie', { ...current, [f.field]: e.target.value }, { shouldDirty: true })
                  }}
                  className={inputClass}
                />
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Features — categorized */}
      <div>
        <FieldLabel htmlFor="features">Caractéristiques</FieldLabel>
        <div className="space-y-4">
          {FEATURES_CATEGORIZED.map((group) => (
            <div key={group.category}>
              <p className="text-xs text-theme-muted mb-2">{group.category}</p>
              <div className="flex flex-wrap gap-2">
                {group.items.map((feature) => (
                  <button
                    key={feature}
                    type="button"
                    onClick={() => toggleFeature(feature)}
                    className={cn(
                      'h-9 px-3.5 rounded-lg text-sm font-medium border transition-all',
                      features.includes(feature)
                        ? 'border-theme-primary bg-theme-active text-theme-primary'
                        : 'border-theme-border text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
                    )}
                  >
                    {features.includes(feature) && <Check className="h-3 w-3 inline mr-1.5" />}
                    {feature}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {features.length > 0 && (
          <p className="text-xs text-theme-muted mt-2">{features.length} caractéristique{features.length > 1 ? 's' : ''} sélectionnée{features.length > 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Availability date */}
      <div>
        <FieldLabel htmlFor="availability_date">
          Disponibilité
          {isRent && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
          {isRent && <span className="sr-only">(requis)</span>}
        </FieldLabel>
        <div className="flex flex-wrap gap-2 mb-3">
          {AVAILABILITY_OPTIONS.map((opt) => {
            // Check if current date matches quick option
            const isSelected = opt.value === 'negotiable'
              ? availabilityDate === ''
              : false
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setAvailabilityQuick(opt.value)}
                className={cn(
                  'h-9 px-4 rounded-lg text-sm font-medium border transition-all',
                  isSelected
                    ? 'border-theme-primary bg-theme-active text-theme-primary'
                    : 'border-theme-border text-theme-secondary hover:bg-theme-hover hover:text-theme-primary'
                )}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
        <input
          id="availability_date"
          type="date"
          {...register('availability_date')}
          className={inputClass}
        />
        <FieldError message={errors.availability_date?.message} />
        {availabilityDate && (
          <p className="text-xs text-theme-muted mt-1">
            {new Date(availabilityDate).toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Sortable Photo item for dnd-kit ───

function SortablePhoto({ id, url, index, onRemove, roomTag, onRoomTagChange }: {
  id: string
  url: string
  index: number
  onRemove: () => void
  roomTag?: string
  onRoomTagChange?: (room: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 0,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative group rounded-lg overflow-hidden border border-theme-border',
        isDragging && 'ring-2 ring-accent'
      )}
    >
      <div className="aspect-[4/3]">
        <img src={url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <GripVertical className="h-5 w-5 text-white drop-shadow-md" />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Badge for first photo */}
        {index === 0 && (
          <span className="absolute top-2 left-2 text-xs font-semibold bg-theme-primary text-theme-inverse px-2 py-0.5 rounded-full">
            Couverture
          </span>
        )}
        {/* Index badge */}
        {index > 0 && (
          <span className="absolute top-2 left-2 text-xs font-medium bg-black/40 text-white px-1.5 py-0.5 rounded-full">
            {index + 1}
          </span>
        )}
      </div>
      {/* Room tag selector */}
      {onRoomTagChange && (
        <select
          value={roomTag || ''}
          onChange={e => onRoomTagChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          className="w-full h-7 px-2 text-xs bg-theme-card border-t border-theme-border text-theme-secondary focus:outline-none focus:text-theme-primary"
        >
          <option value="">— Pièce —</option>
          {FLOOR_PLAN_ROOMS.map(r => (
            <option key={r.key} value={r.key}>{r.label}</option>
          ))}
        </select>
      )}
    </div>
  )
}

// ─── Step 4: Photos (refonte drag-and-drop) ───

function Step4({ form, pendingFiles, setPendingFiles, floorPlanProps, propertyId }: {
  propertyId?: string
  form: UseFormReturn<ListingFormData>
  pendingFiles: File[]
  setPendingFiles: React.Dispatch<React.SetStateAction<File[]>>
  floorPlanProps?: {
    floorPlanUrl: string | null
    hotspots: FloorPlanHotspot[]
    photoTags: PhotoTag[]
    onFloorPlanChange: (url: string | null) => void
    onHotspotsChange: (hotspots: FloorPlanHotspot[]) => void
    onPhotoTagsChange: (tags: PhotoTag[]) => void
    onUploadFloorPlan: (file: File) => Promise<string>
    isUploading: boolean
    canAccess: boolean
  }
}) {
  const { watch, setValue } = form
  const rawPhotos = watch('photos')
  const photos = useMemo(() => rawPhotos || [], [rawPhotos])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const localPreviews = useMemo(() => pendingFiles.map(f => URL.createObjectURL(f)), [pendingFiles])
  const allPhotos = useMemo(() => [...photos, ...localPreviews], [photos, localPreviews])

  // DnD sensors
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Photo IDs for dnd-kit
  const photoIds = useMemo(() => allPhotos.map((_, i) => `photo-${i}`), [allPhotos])

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    const maxSize = 10 * 1024 * 1024
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    const remaining = 20 - allPhotos.length
    const newFiles: File[] = []
    for (let i = 0; i < Math.min(fileList.length, remaining); i++) {
      const f = fileList[i]
      if (!allowed.includes(f.type) || f.size > maxSize) continue
      newFiles.push(f)
    }
    if (newFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...newFiles])
    }
  }

  function removePhoto(index: number) {
    if (index < photos.length) {
      setValue('photos', photos.filter((_, i) => i !== index))
    } else {
      const fileIdx = index - photos.length
      setPendingFiles(prev => prev.filter((_, i) => i !== fileIdx))
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = photoIds.indexOf(active.id as string)
    const newIndex = photoIds.indexOf(over.id as string)

    // Reorder: we need to handle the split between existing URLs and pending files
    const reordered = arrayMove(allPhotos, oldIndex, newIndex)

    // Separate back into existing URLs and pending files
    const newExisting: string[] = []
    const newPending: File[] = []

    reordered.forEach((url) => {
      const existingIdx = photos.indexOf(url)
      if (existingIdx !== -1) {
        newExisting.push(url)
      } else {
        const localIdx = localPreviews.indexOf(url)
        if (localIdx !== -1) {
          newPending.push(pendingFiles[localIdx])
        }
      }
    })

    setValue('photos', newExisting)
    setPendingFiles(newPending)
  }

  const progressPct = Math.round((allPhotos.length / 20) * 100)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">Photos</h2>
        <p className="text-sm text-theme-tertiary mt-1">
          Ajoutez des photos de qualité. Glissez pour réordonner. La première sera la couverture.
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="sr-only"
        onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }}
      />

      {/* Upload zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => fileInputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
          dragOver
            ? 'border-accent bg-accent/5'
            : 'border-theme-border hover:border-theme-active hover:bg-theme-hover/50'
        )}
      >
        <Upload className={cn('h-8 w-8 mx-auto mb-2', dragOver ? 'text-accent' : 'text-theme-muted')} />
        <p className="text-sm font-medium text-theme-primary">
          Glissez vos photos ici ou cliquez pour parcourir
        </p>
        <p className="text-xs text-theme-muted mt-1">
          JPG, PNG ou WebP · Max 10 Mo · Jusqu'à 20 photos
        </p>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-theme-section rounded-full overflow-hidden">
          <div
            className="h-full bg-theme-primary rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <span className="text-xs text-theme-muted tabular-nums">{allPhotos.length}/20</span>
      </div>

      {/* Sortable photo grid */}
      {allPhotos.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={photoIds} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {allPhotos.map((url, idx) => (
                <SortablePhoto
                  key={photoIds[idx]}
                  id={photoIds[idx]}
                  url={url}
                  index={idx}
                  onRemove={() => removePhoto(idx)}
                  roomTag={floorPlanProps?.photoTags.find(t => t.url === url)?.room}
                  onRoomTagChange={floorPlanProps?.canAccess ? (room) => {
                    const tags = [...(floorPlanProps.photoTags || [])]
                    const existing = tags.findIndex(t => t.url === url)
                    if (room) {
                      if (existing >= 0) {
                        tags[existing] = { ...tags[existing], room }
                      } else {
                        tags.push({ url, room, isPrimary: false })
                      }
                    } else if (existing >= 0) {
                      tags.splice(existing, 1)
                    }
                    floorPlanProps.onPhotoTagsChange(tags)
                  } : undefined}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* === Disposition de la fiche publique (port proto MEGGA Bien.html) === */}
      {allPhotos.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0E1410', margin: 0 }}>
              Disposition de la fiche publique
            </h3>
            <p style={{ fontSize: 12, color: '#7A8079', marginTop: 4 }}>
              Choisissez comment votre annonce sera mise en page sur la fiche publique du bien.
            </p>
          </div>

          <GalleryLayoutPicker
            value={(watch('gallery_layout') as 'hero' | 'mosaic' | 'carousel' | undefined) || 'hero'}
            onChange={(layout) => setValue('gallery_layout', layout)}
          />

          <ContactLayoutPicker
            value={(watch('contact_layout') as 'right' | 'banner' | 'floating' | undefined) || 'right'}
            onChange={(v) => setValue('contact_layout', v)}
          />

          <NeighborhoodVariantPicker
            value={(watch('neighborhood_variant') as 'scores' | 'map' | undefined) || 'map'}
            onChange={(v) => setValue('neighborhood_variant', v)}
          />

          <PartnerAgencyPicker
            value={(watch('partner_agency') as 'naef' | 'cardis' | 'bernard' | null | undefined) ?? null}
            onChange={(v) => setValue('partner_agency', v)}
          />
        </div>
      )}

      {/* MEGGA Staging — Virtual Staging IA
          Only shown once the property has a real id (edit mode or
          auto-saved draft). Without an id the Edge Function would log
          usage under the literal string "draft" and break per-property
          attribution / quota tracking. */}
      {allPhotos.length > 0 && propertyId && (
        <StagingSection
          photos={allPhotos}
          propertyId={propertyId}
          onStagedPhoto={(url) => {
            const currentPhotos = form.getValues('photos') || []
            form.setValue('photos', [...currentPhotos, url])
          }}
        />
      )}

      {/* C2PA — Certification des photos */}
      {allPhotos.length > 0 && (
        <C2paCertifySection propertyId={propertyId} photoUrls={allPhotos.filter(u => u.startsWith('http'))} />
      )}

      {/* Floor Plan Interactif */}
      {floorPlanProps && !floorPlanProps.canAccess && (
        <UpgradePrompt
          title="Plan interactif"
          description="Ajoutez un plan d'étage cliquable pour permettre aux acheteurs de naviguer les photos pièce par pièce."
          className="mt-6"
        />
      )}
      {floorPlanProps?.canAccess && (
        <FloorPlanEditor
          floorPlanUrl={floorPlanProps.floorPlanUrl}
          hotspots={floorPlanProps.hotspots}
          photos={allPhotos}
          photoTags={floorPlanProps.photoTags}
          onFloorPlanChange={floorPlanProps.onFloorPlanChange}
          onHotspotsChange={floorPlanProps.onHotspotsChange}
          onPhotoTagsChange={floorPlanProps.onPhotoTagsChange}
          onUploadFloorPlan={floorPlanProps.onUploadFloorPlan}
          isUploading={floorPlanProps.isUploading}
        />
      )}
    </div>
  )
}

// ─── MEGGA Staging Section ───

// ── C2PA Certification Section ────────────────────────────────────────────

function C2paCertifySection({ propertyId, photoUrls }: { propertyId?: string; photoUrls: string[] }) {
  const signPhotos = useSignPhotos()
  const [signed, setSigned] = useState(false)

  if (photoUrls.length === 0) return null

  // Si pas encore de propertyId (brouillon), on ne peut pas signer
  if (!propertyId) {
    return (
      <div className="rounded-xl border border-theme-border p-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">Certification C2PA</p>
            <p className="text-xs text-theme-tertiary">Sauvegardez le bien pour certifier les photos</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-theme-border p-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
            signed || signPhotos.isSuccess ? 'bg-emerald-50' : 'bg-theme-hover'
          )}>
            <ShieldCheck className={cn(
              'w-4 h-4',
              signed || signPhotos.isSuccess ? 'text-emerald-600' : 'text-theme-muted'
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">
              {signed || signPhotos.isSuccess ? 'Photos certifiées C2PA' : 'Certification C2PA'}
            </p>
            <p className="text-xs text-theme-tertiary">
              {signed || signPhotos.isSuccess
                ? `${photoUrls.length} photo${photoUrls.length > 1 ? 's' : ''} signée${photoUrls.length > 1 ? 's' : ''} cryptographiquement`
                : 'Signez vos photos pour prouver leur authenticité'
              }
            </p>
          </div>
        </div>
        {!(signed || signPhotos.isSuccess) && (
          <button
            onClick={() => {
              signPhotos.mutate(
                { propertyId, photoUrls },
                { onSuccess: () => setSigned(true) }
              )
            }}
            disabled={signPhotos.isPending}
            className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {signPhotos.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Certification...
              </>
            ) : (
              <>
                <ShieldCheck className="w-3.5 h-3.5" />
                Certifier
              </>
            )}
          </button>
        )}
      </div>
      {signPhotos.isError && (
        <p className="text-xs text-red-600 mt-2">
          Erreur lors de la certification. Réessayez ultérieurement.
        </p>
      )}
    </div>
  )
}

function StagingSection({ photos, propertyId, onStagedPhoto }: {
  photos: string[]
  propertyId: string
  onStagedPhoto: (url: string) => void
}) {
  const { generateStaging, isGenerating, error, result, reset } = useVirtualStaging()
  const [selectedPhoto, setSelectedPhoto] = useState<number | null>(null)
  const [style, setStyle] = useState<StagingStyle>('modern')
  const [roomType, setRoomType] = useState<RoomType>('salon')
  const [isOpen, setIsOpen] = useState(false)

  async function handleGenerate() {
    if (selectedPhoto === null) return
    const photoUrl = photos[selectedPhoto]
    if (!photoUrl) return

    const res = await generateStaging(photoUrl, propertyId, style, roomType)
    if (res?.staged_url) {
      onStagedPhoto(res.staged_url)
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-theme-border overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-theme-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <span className="text-sm">✨</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-theme-primary">MEGGA Staging</p>
            <p className="text-xs text-theme-tertiary">Meublez vos pièces vides avec l'IA</p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-theme-muted transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-theme-border pt-4">
          {/* Photo selection */}
          <div>
            <p className="text-xs font-medium text-theme-secondary mb-2">Sélectionnez une photo à meubler</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
              {photos.map((url, i) => (
                <button
                  key={i}
                  onClick={() => { setSelectedPhoto(i); reset() }}
                  className={cn(
                    'w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all',
                    selectedPhoto === i ? 'border-accent' : 'border-transparent opacity-60 hover:opacity-90'
                  )}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {selectedPhoto !== null && (
            <>
              {/* Style selection */}
              <div>
                <p className="text-xs font-medium text-theme-secondary mb-2">Style</p>
                <div className="flex flex-wrap gap-2">
                  {STAGING_STYLES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={cn(
                        'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                        style === s.value
                          ? 'bg-theme-active text-theme-primary'
                          : 'text-theme-secondary hover:text-theme-primary'
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room type */}
              <div>
                <p className="text-xs font-medium text-theme-secondary mb-2">Type de pièce</p>
                <div className="flex flex-wrap gap-2">
                  {ROOM_TYPES.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => setRoomType(r.value)}
                      className={cn(
                        'h-8 px-3 rounded-lg text-xs font-medium transition-colors',
                        roomType === r.value
                          ? 'bg-theme-active text-theme-primary'
                          : 'text-theme-secondary hover:text-theme-primary'
                      )}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="w-full h-10 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  'Générer la version meublée'
                )}
              </button>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-500">
                  {error.error}
                  {error.upgrade_required && ' — Passez au plan Pro pour débloquer.'}
                </p>
              )}

              {/* Result preview */}
              {result && (
                <div className="rounded-lg border border-theme-border overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-theme-border">
                    <div className="relative bg-theme-card">
                      <img src={photos[selectedPhoto]} alt="Original" className="w-full aspect-[4/3] object-cover" />
                      <span className="absolute bottom-2 left-2 text-xs font-medium bg-black/50 text-white px-2 py-0.5 rounded">Original</span>
                    </div>
                    <div className="relative bg-theme-card">
                      <img src={result.staged_url} alt="Meublé" className="w-full aspect-[4/3] object-cover" />
                      <span className="absolute bottom-2 left-2 text-xs font-medium bg-accent/80 text-white px-2 py-0.5 rounded">MEGGA Staging</span>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs text-theme-muted">
                      {result.usage.remaining} images restantes ce mois
                    </span>
                    <button
                      onClick={() => { reset(); setSelectedPhoto(null) }}
                      className="text-xs text-accent hover:underline"
                    >
                      Meubler une autre photo
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
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
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">Description & publication</h2>
        <p className="text-sm text-theme-tertiary mt-1">Rédigez une description attrayante et choisissez vos tags.</p>
      </div>

      {/* Description */}
      <div>
        <FieldLabel htmlFor="description">Description du bien</FieldLabel>
        <textarea
          id="description"
          {...register('description')}
          rows={6}
          placeholder="Décrivez les points forts du bien, son environnement, ses atouts..."
          className="w-full px-4 py-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y text-theme-primary placeholder:text-theme-muted"
        />
        <FieldError message={errors.description?.message} />
      </div>

      {/* Tags */}
      <div>
        <FieldLabel htmlFor="tags">Tags</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {TAG_OPTIONS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-full border transition-all',
                tags.includes(tag)
                  ? 'border-theme-primary bg-theme-active text-theme-primary'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-hover'
              )}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* "AI Listing Generator" block removed — the component generated
          text via a hardcoded switch statement (no Claude / Edge
          Function call) and labeled itself "Généré par IA". Real
          ai-copilot-based description generation is tracked as a
          separate chip. */}

      {/* Preview card */}
      <div>
        <p className="text-sm font-medium text-theme-primary mb-3">Aperçu de l'annonce</p>
        <div className="rounded-lg border border-theme-border p-5 bg-theme-section">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-lg font-bold text-theme-primary">
                {price > 0 ? formatCHF(price) : 'CHF —'}
              </p>
              <h3 className="text-sm font-semibold text-theme-primary mt-0.5">
                {title || 'Titre de l\'annonce'}
              </h3>
              <p className="text-xs text-theme-secondary mt-0.5">
                {city || 'Ville'}{canton ? ` (${canton})` : ''}
              </p>
            </div>
            {type && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-theme-card text-theme-secondary border border-theme-border">
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
                <span key={tag} className="text-xs font-medium px-2 py-0.5 rounded-full bg-theme-active text-theme-primary">
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

// ─── Method Selection Screen ───

function MethodSelectionScreen({ hasProperties, onSelect }: {
  hasProperties: boolean
  onSelect: (method: 'manual' | 'duplicate' | 'url' | 'pdf') => void
}) {
  const methods = [
    {
      id: 'manual' as const,
      icon: PenLine,
      title: 'Saisie manuelle',
      desc: 'Remplir le formulaire étape par étape',
      available: true,
    },
    {
      id: 'duplicate' as const,
      icon: Copy,
      title: 'Dupliquer un bien existant',
      desc: hasProperties ? 'Copier les infos d\'un de vos biens' : 'Vous n\'avez aucun bien à dupliquer',
      available: hasProperties,
    },
    {
      id: 'url' as const,
      icon: Link2,
      title: 'Depuis une URL',
      desc: 'Importer depuis Homegate, ImmoScout24...',
      available: true,
    },
    {
      id: 'pdf' as const,
      icon: FileText,
      title: 'Depuis un PDF',
      desc: 'Extraire les infos d\'une fiche descriptive',
      available: true,
    },
  ]

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold text-theme-primary mb-1">Ajouter un bien</h1>
      <p className="text-sm text-theme-muted mb-8">Comment souhaitez-vous saisir ce bien ?</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
        {methods.map((m) => (
          <button
            key={m.id}
            onClick={() => m.available && onSelect(m.id)}
            disabled={!m.available}
            className={cn(
              'text-left px-5 py-4 rounded-xl border transition-colors group relative',
              m.available
                ? 'border-theme-border hover:border-accent/40 cursor-pointer'
                : 'border-theme-border-subtle opacity-50 cursor-not-allowed'
            )}
          >
            <div className="flex items-start gap-3.5">
              <m.icon className={cn(
                'w-5 h-5 mt-0.5 flex-shrink-0',
                m.available ? 'text-theme-secondary group-hover:text-accent transition-colors' : 'text-theme-muted'
              )} />
              <div>
                <p className="text-sm font-medium text-theme-primary">{m.title}</p>
                <p className="text-xs text-theme-muted mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
            {!m.available && m.id !== 'duplicate' && (
              <span className="absolute top-3 right-3 text-xs text-theme-muted">Bientôt</span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Duplicate Property Selector ───

function DuplicateSelector({ onSelect, onBack }: {
  onSelect: (propertyId: string) => void
  onBack: () => void
}) {
  const { data: properties, isLoading } = useAgencyProperties()
  const [search, setSearch] = useState('')

  const filtered = (properties || []).filter(p => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.title?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q) || p.city?.toLowerCase().includes(q)
  })

  return (
    <div className="min-h-[60vh] flex flex-col items-center px-4 pt-8">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">Dupliquer un bien</h1>
      <p className="text-sm text-theme-muted mb-6">Sélectionnez le bien à copier</p>

      <div className="w-full max-w-lg">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par titre, adresse, ville..."
          className="w-full h-10 px-4 text-sm bg-transparent border border-theme-border rounded-xl focus:outline-none focus:border-accent/40 text-theme-primary placeholder:text-theme-muted mb-4"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 animate-spin text-theme-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-theme-muted text-center py-8">Aucun bien trouvé</p>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto scrollbar-hide">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelect(p.id)}
                className="w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl border border-theme-border hover:border-accent/40 transition-colors group"
              >
                {p.photos?.[0] ? (
                  <img src={p.photos[0]} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-theme-hover flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-5 h-5 text-theme-muted" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">
                    {p.title || p.address}
                  </p>
                  <p className="text-xs text-theme-muted truncate">
                    {p.city}{p.canton ? ` (${p.canton})` : ''} · {p.rooms} pièces · {p.surface_m2} m²
                  </p>
                  <p className="text-xs font-medium text-theme-secondary mt-0.5">
                    {formatCHF(p.price)}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── URL Import Screen ───

const SUPPORTED_PORTALS = [
  'homegate.ch', 'immoscout24.ch', 'realadvisor.ch', 'comparis.ch',
  'immomig.ch', 'acheter-louer.ch', 'flatfox.ch', 'newhome.ch',
]

function UrlImportScreen({ onExtracted, onBack }: {
  onExtracted: (data: ExtractedPropertyData & { photos?: string[] }) => void
  onBack: () => void
}) {
  const { extractFromUrl, isExtracting, error } = useExtractPropertyUrl()
  const [url, setUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!url.trim()) return
    const data = await extractFromUrl(url.trim())
    if (data) onExtracted(data)
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center px-4 pt-8">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">Importer depuis une URL</h1>
      <p className="text-sm text-theme-muted mb-6">Collez le lien d'une annonce immobilière suisse</p>

      <div className="w-full max-w-lg">
        {!isExtracting ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.homegate.ch/acheter/12345..."
                className="w-full h-11 px-4 text-sm bg-transparent border border-theme-border rounded-xl focus:outline-none focus:border-accent/40 text-theme-primary placeholder:text-theme-muted"
                type="url"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={!url.trim()}
              className={cn(
                'w-full h-10 rounded-xl text-sm font-medium transition-colors',
                url.trim()
                  ? 'border border-theme-border text-theme-primary hover:border-theme-active'
                  : 'border border-theme-border-subtle text-theme-muted cursor-not-allowed'
              )}
            >
              Analyser l'annonce
            </button>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm text-red-500 font-medium">Erreur d'importation</p>
                <p className="text-xs text-theme-muted mt-1">{error}</p>
              </div>
            )}

            {/* Supported portals */}
            <div className="pt-4">
              <p className="text-xs text-theme-muted mb-2">Portails supportés :</p>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_PORTALS.map(p => (
                  <span key={p} className="text-xs text-theme-secondary px-2 py-0.5 rounded-md bg-theme-hover">{p}</span>
                ))}
              </div>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-theme-border p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">Analyse de l'annonce en cours...</p>
            <p className="text-xs text-theme-muted mt-1 truncate max-w-xs mx-auto">{url}</p>
            <p className="text-xs text-theme-muted mt-3">MEGGA AI lit la page et extrait les informations du bien</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PDF Upload Screen ───

function PdfUploadScreen({ onExtracted, onBack }: {
  onExtracted: (data: ExtractedPropertyData) => void
  onBack: () => void
}) {
  const { extractFromPdf, isExtracting, error } = useExtractPropertyPdf()
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file.type.includes('pdf')) return
    if (file.size > 20 * 1024 * 1024) return // 20MB max
    setSelectedFile(file)
    const data = await extractFromPdf(file)
    if (data) onExtracted(data)
  }

  return (
    <div className="min-h-[60vh] flex flex-col items-center px-4 pt-8">
      <button onClick={onBack} className="self-start flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Retour
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">Importer depuis un PDF</h1>
      <p className="text-sm text-theme-muted mb-6">Uploadez une fiche descriptive, un mandat ou tout document décrivant le bien</p>

      <div className="w-full max-w-lg">
        {/* Drop zone */}
        {!isExtracting && !selectedFile && (
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
            onClick={() => fileRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors',
              dragOver ? 'border-accent/60 bg-accent/5' : 'border-theme-border hover:border-accent/30'
            )}
          >
            <Upload className="w-8 h-8 text-theme-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">Glissez votre PDF ici</p>
            <p className="text-xs text-theme-muted mt-1">ou cliquez pour sélectionner (max 20 Mo)</p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = '' }}
            />
          </div>
        )}

        {/* Extracting state */}
        {isExtracting && (
          <div className="rounded-xl border border-theme-border p-8 text-center">
            <Loader2 className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">Analyse du document en cours...</p>
            <p className="text-xs text-theme-muted mt-1">{selectedFile?.name}</p>
            <p className="text-xs text-theme-muted mt-3">MEGGA AI lit le PDF et extrait les informations du bien</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-500 font-medium">Erreur d'extraction</p>
            <p className="text-xs text-theme-muted mt-1">{error}</p>
            <button
              onClick={() => { setSelectedFile(null) }}
              className="mt-3 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
            >
              Réessayer avec un autre fichier
            </button>
          </div>
        )}

        {/* Supported formats */}
        <div className="mt-6 text-center">
          <p className="text-xs text-theme-muted">Formats supportés : fiches descriptives, mandats de vente, rapports d'estimation</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main wizard ───

export default function ListingFormPage() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const isEditMode = Boolean(id)
  const { profile } = useAuth()

  // Method selection state
  const [method, setMethod] = useState<'choosing' | 'duplicate' | 'pdf' | 'url' | 'form'>(
    isEditMode || searchParams.has('duplicate') ? 'form' : 'choosing'
  )
  const [pdfData, setPdfData] = useState<ExtractedPropertyData | null>(null)

  // Duplicate source
  const duplicateId = searchParams.get('duplicate') ?? undefined

  // Supabase hooks
  const { data: agencyProperties } = useAgencyProperties()
  const { data: existingProperty, isLoading: propertyLoading } = useProperty(isEditMode ? id : duplicateId || undefined)
  const createProperty = useCreateProperty()
  const updateProperty = useUpdateProperty()
  const uploadPhotos = useUploadPropertyPhotos()
  const uploadFloorPlan = useUploadFloorPlan()
  const createListing = useCreateListing()
  const signPhotosMutation = useSignPhotos()
  const { canAccess } = usePlanLimits()

  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>(
    isEditMode ? [1, 2, 3, 4, 5] : []
  )
  const [openSections, setOpenSections] = useState<Set<number>>(new Set([1]))
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({})

  function toggleSection(num: number) {
    setOpenSections(prev => {
      const next = new Set(prev)
      if (next.has(num)) next.delete(num)
      else next.add(num)
      return next
    })
  }

  function scrollToSection(num: number) {
    if (!openSections.has(num)) {
      setOpenSections(prev => new Set(prev).add(num))
    }
    setTimeout(() => {
      sectionRefs.current[num]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [floorPlanUrl, setFloorPlanUrl] = useState<string | null>(null)
  const [floorPlanHotspots, setFloorPlanHotspots] = useState<FloorPlanHotspot[]>([])
  const [photoTags, setPhotoTags] = useState<PhotoTag[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const autoSavePropertyId = useRef<string | null>(id || null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Synchronous mutex against the double-click race: `setIsSaving(true)` only
  // takes effect after the next React render, so a second click landing in
  // the same micro-task can call handlePublish twice and create duplicate
  // properties + listings. The ref flips synchronously.
  const publishingRef = useRef(false)
  // Optimistic-locking token: tracks the `updated_at` we last observed on the
  // property row. Passed as `expected_updated_at` to useUpdateProperty so that
  // a concurrent write from another tab raises PropertyUpdateConflictError
  // instead of silently last-write-wins.
  const lastKnownUpdatedAt = useRef<string | null>(null)

  // Map existing property or PDF data to form data
  const existingData = useMemo<ListingFormData | undefined>(() => {
    // From PDF extraction
    if (pdfData) {
      return {
        title: pdfData.title ?? '',
        transaction_type: 'buy',
        type: (pdfData.type ?? undefined) as ListingFormData['type'],
        rooms: pdfData.rooms ?? 0.5,
        bedrooms: pdfData.bedrooms ?? 0,
        bathrooms: pdfData.bathrooms ?? 0,
        surface_m2: pdfData.surface_m2 ?? (undefined as unknown as number),
        floor: pdfData.floor ?? undefined,
        total_floors: pdfData.total_floors ?? undefined,
        year_built: pdfData.year_built ?? undefined,
        energy_class: undefined,
        address: pdfData.address ?? '',
        city: pdfData.city ?? '',
        canton: pdfData.canton ?? '',
        postal_code: pdfData.postal_code ?? '',
        egid: undefined,
        lat: undefined,
        lng: undefined,
        price: pdfData.price ?? 0,
        charges_monthly: pdfData.charges_monthly ?? undefined,
        mandate_type: (pdfData.mandate_type ?? 'simple') as ListingFormData['mandate_type'],
        condition: (pdfData.condition as ListingFormData['condition']) ?? undefined,
        availability_date: '',
        features: pdfData.features ?? [],
        deposit_months: undefined,
        is_furnished: false,
        external_regie: undefined,
        photos: ('photos' in pdfData && Array.isArray(pdfData.photos)) ? pdfData.photos : [],
        description: pdfData.description ?? '',
        tags: [],
      }
    }
    // From existing property (edit or duplicate)
    if (!existingProperty) return undefined
    return {
      title: duplicateId ? `${existingProperty.title ?? ''} (copie)` : existingProperty.title ?? '',
      transaction_type: (existingProperty.transaction_type ?? 'buy') as 'buy' | 'rent',
      type: existingProperty.type as ListingFormData['type'],
      rooms: existingProperty.rooms ?? 0,
      bedrooms: existingProperty.bedrooms ?? 0,
      bathrooms: existingProperty.bathrooms ?? 0,
      surface_m2: existingProperty.surface_m2 ?? 0,
      floor: existingProperty.floor,
      total_floors: existingProperty.total_floors,
      year_built: existingProperty.year_built,
      energy_class: (existingProperty.energy_class as ListingFormData['energy_class']) ?? undefined,
      address: existingProperty.address ?? '',
      city: existingProperty.city ?? '',
      canton: existingProperty.canton ?? '',
      postal_code: existingProperty.postal_code ?? '',
      egid: (existingProperty as { egid?: string | null }).egid ?? undefined,
      lat: existingProperty.lat,
      lng: existingProperty.lng,
      price: existingProperty.price ?? 0,
      charges_monthly: existingProperty.charges_monthly,
      mandate_type: (existingProperty.mandate_type ?? 'simple') as ListingFormData['mandate_type'],
      condition: (existingProperty.condition as ListingFormData['condition']) ?? undefined,
      availability_date: existingProperty.availability_date ?? '',
      features: Array.isArray(existingProperty.features) ? existingProperty.features : [],
      deposit_months: existingProperty.deposit_months ?? undefined,
      is_furnished: existingProperty.is_furnished ?? false,
      external_regie: existingProperty.external_regie ?? undefined,
      photos: existingProperty.photos ?? [],
      description: existingProperty.description ?? '',
      tags: [],
    }
  }, [existingProperty, pdfData, duplicateId])

  const form = useForm<ListingFormData>({
    defaultValues: {
      title: '',
      transaction_type: 'buy',
      type: undefined,
      rooms: 0.5,
      bedrooms: 0,
      bathrooms: 0,
      surface_m2: undefined as unknown as number,
      floor: undefined,
      total_floors: undefined,
      year_built: undefined,
      energy_class: undefined,
      address: '',
      city: '',
      canton: '',
      postal_code: '',
      egid: undefined,
      lat: undefined,
      lng: undefined,
      price: undefined as unknown as number,
      charges_monthly: undefined,
      mandate_type: undefined,
      condition: undefined,
      availability_date: '',
      features: [],
      deposit_months: undefined,
      is_furnished: false,
      external_regie: undefined,
      photos: [],
      gallery_layout: 'hero',
      contact_layout: 'right',
      neighborhood_variant: 'map',
      partner_agency: null,
      description: '',
      tags: [],
    },
    mode: 'onTouched',
  })

  // Reset form when existing data loads
  useEffect(() => {
    if (existingData) {
      form.reset(existingData)
    }
  }, [existingData, form])

  // Populate floor plan state from existing property
  useEffect(() => {
    if (existingProperty) {
      setFloorPlanUrl(existingProperty.floor_plan_url ?? null)
      setFloorPlanHotspots(existingProperty.floor_plan_hotspots ?? [])
      setPhotoTags(existingProperty.photo_tags ?? [])
      // Seed the optimistic-locking token in edit mode (skip duplicate mode —
      // the duplicate becomes a fresh property with no shared updated_at).
      if (isEditMode && existingProperty.updated_at) {
        lastKnownUpdatedAt.current = existingProperty.updated_at
      }
    }
  }, [existingProperty, isEditMode])

  // Redirect if edit mode but property not found (after loading)
  useEffect(() => {
    if (isEditMode && !propertyLoading && !existingProperty) {
      navigate('/dashboard/listings')
    }
  }, [isEditMode, propertyLoading, existingProperty, navigate])

  // ─── Auto-save (every 30s) ───
  // Sanity-check what we're about to persist as a draft: previously this only
  // gated on `title.length >= 3`, so a price of -1 or a canton of "XX" would
  // happily land in `properties` and stay there until cleanup. The values that
  // are dangerous to persist (negative price, foreign canton, oversized text)
  // skip the save entirely; the agent keeps typing and the next 30s tick
  // re-evaluates.
  const isDraftSane = useCallback((values: Partial<ListingFormData>): boolean => {
    if (!values.title || values.title.length < 3) return false
    if (values.title.length > 200) return false
    if (values.description && values.description.length > 10_000) return false
    if (typeof values.price === 'number') {
      if (!Number.isFinite(values.price)) return false
      if (values.price < 0 || values.price > PRICE_MAX_BUY) return false
    }
    if (values.canton && !(CANTONS as readonly string[]).includes(values.canton)) return false
    if (values.postal_code && !/^[1-9]\d{3}$/.test(values.postal_code)) return false
    if (typeof values.lat === 'number' && (values.lat < 45.8 || values.lat > 47.85)) return false
    if (typeof values.lng === 'number' && (values.lng < 5.95 || values.lng > 10.5)) return false
    // If an EGID is present, it must match the 9-digit format. Empty is fine
    // (the column is optional at the DB layer too).
    if (values.egid && !/^[0-9]{9}$/.test(values.egid)) return false
    return true
  }, [])

  const doAutoSave = useCallback(async () => {
    const values = form.getValues()
    if (!isDraftSane(values)) return

    setAutoSaveStatus('saving')
    try {
      const data = buildPropertyData(values, 'draft')

      if (autoSavePropertyId.current) {
        const updated = await updateProperty.mutateAsync({
          id: autoSavePropertyId.current,
          expected_updated_at: lastKnownUpdatedAt.current ?? undefined,
          ...data,
        })
        lastKnownUpdatedAt.current = updated.updated_at
      } else {
        const property = await createProperty.mutateAsync(data)
        autoSavePropertyId.current = property.id
        lastKnownUpdatedAt.current = property.updated_at
      }
      setAutoSaveStatus('saved')
      setTimeout(() => setAutoSaveStatus('idle'), 3000)
    } catch (err) {
      // Surface conflicts so the agent knows another tab won. Generic failures
      // stay silent (auto-save is best-effort) — they'll be retried on the
      // next watch tick.
      if (err instanceof PropertyUpdateConflictError) {
        setSaveError(err.message)
      }
      setAutoSaveStatus('idle')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, updateProperty, createProperty, isDraftSane])

  // Watch form changes for auto-save
  useEffect(() => {
    if (isEditMode) return // Don't auto-save in edit mode (user controls saves)

    const subscription = form.watch(() => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(doAutoSave, 30000)
    })

    return () => {
      subscription.unsubscribe()
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    }
  }, [form, isEditMode, doAutoSave])

  async function validateCurrentStep(): Promise<boolean> {
    const schema = stepSchemas[currentStep - 1]
    const values = form.getValues()
    const result = schema.safeParse(values)

    if (!result.success) {
      for (const issue of result.error.issues) {
        const path = issue.path[0] as keyof ListingFormData
        form.setError(path, { message: issue.message })
      }
      return false
    }

    const stepFields = Object.keys(stepShapes[currentStep - 1]) as (keyof ListingFormData)[]
    stepFields.forEach((field) => form.clearErrors(field))
    return true
  }



  async function uploadPendingPhotos(propertyId: string): Promise<string[]> {
    const existingUrls = form.getValues('photos') || []
    if (pendingFiles.length === 0) return existingUrls
    const newUrls = await uploadPhotos.mutateAsync({ propertyId, files: pendingFiles })
    return [...existingUrls, ...newUrls]
  }

  function buildPropertyData(values: ListingFormData, status: 'draft' | 'active') {
    return {
      title: values.title,
      description: values.description,
      transaction_type: values.transaction_type ?? 'buy',
      type: values.type,
      status,
      price: values.price,
      rooms: values.rooms,
      bedrooms: values.bedrooms,
      bathrooms: values.bathrooms,
      surface_m2: values.surface_m2,
      floor: values.floor,
      total_floors: values.total_floors,
      year_built: values.year_built,
      energy_class: values.energy_class ?? null,
      charges_monthly: values.charges_monthly,
      mandate_type: values.mandate_type,
      condition: values.condition,
      deposit_months: values.deposit_months ?? null,
      is_furnished: values.is_furnished ?? false,
      external_regie: values.external_regie ?? null,
      availability_date: values.availability_date || null,
      address: values.address,
      city: values.city,
      canton: values.canton,
      postal_code: values.postal_code,
      egid: values.egid ?? null,
      lat: values.lat,
      lng: values.lng,
      features: values.features,
      floor_plan_url: floorPlanUrl,
      floor_plan_hotspots: floorPlanHotspots,
      photo_tags: photoTags,
      gallery_layout: values.gallery_layout ?? 'hero',
      contact_layout: values.contact_layout ?? 'right',
      neighborhood_variant: values.neighborhood_variant ?? 'map',
      partner_agency: values.partner_agency ?? null,
      published_at: status === 'active' ? new Date().toISOString() : undefined,
    }
  }

  async function handleSaveDraft() {
    const values = form.getValues()
    if (!isDraftSane(values)) {
      setSaveError('Corrigez les champs invalides avant de sauvegarder (prix, canton, NPA, coordonnées Suisse).')
      return
    }
    setIsSaving(true)
    setSaveError(null)
    try {
      const targetId = isEditMode ? id : autoSavePropertyId.current

      if (targetId) {
        const allPhotos = await uploadPendingPhotos(targetId)
        const updated = await updateProperty.mutateAsync({
          id: targetId,
          expected_updated_at: lastKnownUpdatedAt.current ?? undefined,
          ...buildPropertyData(values, existingProperty?.status === 'active' ? 'active' : 'draft'),
          photos: allPhotos,
        })
        lastKnownUpdatedAt.current = updated.updated_at
      } else {
        const property = await createProperty.mutateAsync(buildPropertyData(values, 'draft'))
        autoSavePropertyId.current = property.id
        lastKnownUpdatedAt.current = property.updated_at
        if (pendingFiles.length > 0) {
          const photoUrls = await uploadPendingPhotos(property.id)
          const updated = await updateProperty.mutateAsync({
            id: property.id,
            expected_updated_at: lastKnownUpdatedAt.current,
            photos: photoUrls,
          })
          lastKnownUpdatedAt.current = updated.updated_at
        }
      }
      navigate('/dashboard/listings')
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    // Synchronous mutex: flipping a ref is instant, unlike setIsSaving which
    // only takes effect after the next render. Closes the double-click race.
    if (publishingRef.current) return
    publishingRef.current = true

    try {
      const valid = await validateCurrentStep()
      if (!valid) return

      const result = fullSchema.safeParse(form.getValues())
      if (!result.success) {
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

      const values = form.getValues()

      // ── LBA verrou (Loi sur le Blanchiment d'Argent) ─────────────────
      // Art. 6 LBA : pour toute relation d'affaires immobilière, l'agent doit
      // identifier le cocontractant AVANT la mise en marché. Le mandat signé
      // est la trace contractuelle qui ancre la chaîne KYC.
      //
      //   - Vente (transaction_type='buy') ≥ CHF 100'000 → mandat requis.
      //     Le seuil bas reste un compromis pragmatique (objets <100K = niches,
      //     friction inutile sur les box/places de parc).
      //   - Location (transaction_type='rent') → mandat requis quel que soit
      //     le loyer. Une régie qui publie sans gérance signée enfreint LBA
      //     art. 6 + art. 7 al. 1 lit. b (documentation).
      //
      // Pas de bypass automatique — l'agent doit signer le mandat puis
      // revenir publier. (Brouillon possible sans mandat → handleSaveDraft.)
      const LBA_BUY_THRESHOLD = 100_000
      const txType = values.transaction_type ?? 'buy'
      const isHighValueBuy = txType === 'buy' && (values.price ?? 0) >= LBA_BUY_THRESHOLD
      const isRentMandate = txType === 'rent'
      if ((isHighValueBuy || isRentMandate) && !existingProperty?.mandate_signed_at) {
        const reason = isRentMandate
          ? `LBA art. 6 : un mandat de gérance signé est requis avant publication d'une location.`
          : `LBA art. 6 : ce bien à CHF ${(values.price ?? 0).toLocaleString('fr-CH')} ne peut être publié sans mandat signé.`
        setSaveError(
          `${reason} Enregistrez le mandat depuis la fiche du bien (brouillon) avant de publier.`,
        )
        return
      }

      setIsSaving(true)
      setSaveError(null)

      const targetId = isEditMode ? id : autoSavePropertyId.current

      // Track the final (property_id, photo_urls) pair so we can sign C2PA
      // after the property is fully committed to DB.
      let publishedPropertyId: string | null = null
      let publishedPhotos: string[] = []

      if (targetId) {
        const allPhotos = await uploadPendingPhotos(targetId)
        const updated = await updateProperty.mutateAsync({
          id: targetId,
          expected_updated_at: lastKnownUpdatedAt.current ?? undefined,
          ...buildPropertyData(values, 'active'),
          photos: allPhotos,
        })
        lastKnownUpdatedAt.current = updated.updated_at
        publishedPropertyId = targetId
        publishedPhotos = allPhotos
      } else {
        const property = await createProperty.mutateAsync(buildPropertyData(values, 'active'))
        autoSavePropertyId.current = property.id
        lastKnownUpdatedAt.current = property.updated_at
        publishedPropertyId = property.id
        if (pendingFiles.length > 0) {
          const photoUrls = await uploadPendingPhotos(property.id)
          const updated = await updateProperty.mutateAsync({
            id: property.id,
            expected_updated_at: lastKnownUpdatedAt.current,
            photos: photoUrls,
          })
          lastKnownUpdatedAt.current = updated.updated_at
          publishedPhotos = photoUrls
        } else {
          publishedPhotos = (values.photos ?? []) as string[]
        }

        await createListing.mutateAsync({
          property_id: property.id,
          agency_id: profile?.agency_id ?? '',
          title: values.title,
          description_ai: values.description,
          price_display: formatCHF(values.price),
        })
      }

      // ── C2PA auto-sign ────────────────────────────────────────────────
      // Fire-and-forget C2PA signing on the published photos. Agent doesn't
      // wait for this — by the time they see the dashboard, photos have
      // their Content Credentials and the badge flips on.
      // If signing fails (network / provider down), the publish still
      // succeeded: agent can retry from the property detail page.
      if (publishedPropertyId && publishedPhotos.length > 0) {
        void signPhotosMutation.mutateAsync({
          propertyId: publishedPropertyId,
          photoUrls: publishedPhotos,
        }).catch((err) => {
          // Silent — do NOT block navigation or show an error. Signing is
          // a nice-to-have on the publish path; manual retry is available.
           
          console.warn('[c2pa-sign] background signing failed:', (err as Error).message)
        })
      }

      setCompletedSteps((prev) => [...new Set([...prev, 5])])
      navigate('/dashboard/listings')
    } catch (err) {
      setSaveError((err as Error).message)
    } finally {
      setIsSaving(false)
      publishingRef.current = false
    }
  }

  // Loading state for edit/duplicate mode
  if ((isEditMode || duplicateId) && propertyLoading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-theme-muted" />
      </div>
    )
  }

  // Method selection screen (only for new listings, not edit)
  if (!isEditMode && method === 'choosing') {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-4">
          <Link
            to="/dashboard/listings"
            className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>
        <MethodSelectionScreen
          hasProperties={(agencyProperties || []).length > 0}
          onSelect={(m) => {
            if (m === 'manual') setMethod('form')
            else if (m === 'duplicate') setMethod('duplicate')
            else if (m === 'pdf') setMethod('pdf')
            else if (m === 'url') setMethod('url')
          }}
        />
      </div>
    )
  }

  if (!isEditMode && method === 'duplicate') {
    return (
      <div className="max-w-3xl mx-auto">
        <DuplicateSelector
          onSelect={(propertyId) => {
            setSearchParams({ duplicate: propertyId })
            setMethod('form')
          }}
          onBack={() => setMethod('choosing')}
        />
      </div>
    )
  }

  if (!isEditMode && method === 'pdf') {
    return (
      <div className="max-w-3xl mx-auto">
        <PdfUploadScreen
          onExtracted={(data) => {
            setPdfData(data)
            setMethod('form')
          }}
          onBack={() => setMethod('choosing')}
        />
      </div>
    )
  }

  if (!isEditMode && method === 'url') {
    return (
      <div className="max-w-3xl mx-auto">
        <UrlImportScreen
          onExtracted={(data) => {
            setPdfData(data)
            setMethod('form')
          }}
          onBack={() => setMethod('choosing')}
        />
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard/listings"
          className="p-2 rounded-lg text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-theme-primary">
            {isEditMode ? 'Modifier le bien' : duplicateId ? 'Dupliquer le bien' : 'Nouveau bien'}
          </h1>
          <p className="text-sm text-theme-tertiary">
            {isEditMode ? existingProperty?.title ?? '' : `Étape ${currentStep} sur 5`}
          </p>
        </div>
        {/* Auto-save indicator */}
        {autoSaveStatus === 'saving' && (
          <span className="text-xs text-theme-muted flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" />
            Sauvegarde...
          </span>
        )}
        {autoSaveStatus === 'saved' && (
          <span className="text-xs text-theme-secondary flex items-center gap-1.5">
            <Check className="h-3 w-3" />
            Brouillon sauvegardé
          </span>
        )}
      </div>

      {/* Error banner */}
      {saveError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-500">
          {saveError}
        </div>
      )}

      {/* ═══ Accordion layout + Sidebar ═══ */}
      <div className="flex gap-6">
        {/* ── Main: Accordion sections ── */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Toggle Vente / Location */}
          <div className="flex items-center gap-2 mb-6">
            {(['buy', 'rent'] as const).map((v) => {
              const txType = form.watch('transaction_type') ?? 'buy'
              const isActive = txType === v
              return (
                <button
                  key={v}
                  type="button"
                  disabled={isEditMode}
                  onClick={() => {
                    form.setValue('transaction_type', v, { shouldValidate: true, shouldDirty: true })
                    // When switching to rent, default deposit to 3 months if not set
                    if (v === 'rent' && !form.getValues('deposit_months')) {
                      form.setValue('deposit_months', 3, { shouldDirty: true })
                    }
                  }}
                  className={cn(
                    'h-9 px-4 rounded-lg text-sm transition-colors',
                    isActive
                      ? 'bg-theme-active text-theme-primary font-medium'
                      : 'text-theme-secondary hover:text-theme-primary',
                    isEditMode && 'opacity-50 cursor-not-allowed'
                  )}
                  aria-pressed={isActive}
                >
                  {v === 'buy' ? 'Vente' : 'Location'}
                </button>
              )
            })}
            {isEditMode && (
              <span className="text-xs text-theme-muted ml-2">
                Le type de transaction est verrouillé en mode édition
              </span>
            )}
          </div>
          <form onSubmit={(e) => e.preventDefault()}>
            {/* Section 1 — Infos générales */}
            <div ref={el => { sectionRefs.current[1] = el }} className="mb-3">
              <button
                type="button"
                onClick={() => toggleSection(1)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-xl border transition-colors',
                  openSections.has(1) ? 'border-theme-active bg-theme-card' : 'border-theme-border hover:border-theme-active'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center', completedSteps.includes(1) ? 'bg-emerald-500 text-white' : 'bg-theme-active text-theme-primary')}>
                    {completedSteps.includes(1) ? <Check className="w-3.5 h-3.5" /> : '1'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">Infos générales</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(1) && 'rotate-180')} />
              </button>
              {openSections.has(1) && (
                <div className="rounded-xl border border-theme-border border-t-0 rounded-t-none p-6 animate-[fadeIn_0.2s_ease-out]">
                  <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
                  <Step1 form={form} />
                </div>
              )}
            </div>

            {/* Section 2 — Localisation */}
            <div ref={el => { sectionRefs.current[2] = el }} className="mb-3">
              <button
                type="button"
                onClick={() => toggleSection(2)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-xl border transition-colors',
                  openSections.has(2) ? 'border-theme-active bg-theme-card' : 'border-theme-border hover:border-theme-active'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center', completedSteps.includes(2) ? 'bg-emerald-500 text-white' : 'bg-theme-active text-theme-primary')}>
                    {completedSteps.includes(2) ? <Check className="w-3.5 h-3.5" /> : '2'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">Localisation</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(2) && 'rotate-180')} />
              </button>
              {openSections.has(2) && (
                <div className="rounded-xl border border-theme-border border-t-0 rounded-t-none p-6 animate-[fadeIn_0.2s_ease-out]">
                  <Step2 form={form} />
                </div>
              )}
            </div>

            {/* Section 3 — Prix & détails */}
            <div ref={el => { sectionRefs.current[3] = el }} className="mb-3">
              <button
                type="button"
                onClick={() => toggleSection(3)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-xl border transition-colors',
                  openSections.has(3) ? 'border-theme-active bg-theme-card' : 'border-theme-border hover:border-theme-active'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center', completedSteps.includes(3) ? 'bg-emerald-500 text-white' : 'bg-theme-active text-theme-primary')}>
                    {completedSteps.includes(3) ? <Check className="w-3.5 h-3.5" /> : '3'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">Prix & détails</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(3) && 'rotate-180')} />
              </button>
              {openSections.has(3) && (
                <div className="rounded-xl border border-theme-border border-t-0 rounded-t-none p-6 animate-[fadeIn_0.2s_ease-out]">
                  <Step3 form={form} />
                </div>
              )}
            </div>

            {/* Section 4 — Photos */}
            <div ref={el => { sectionRefs.current[4] = el }} className="mb-3">
              <button
                type="button"
                onClick={() => toggleSection(4)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-xl border transition-colors',
                  openSections.has(4) ? 'border-theme-active bg-theme-card' : 'border-theme-border hover:border-theme-active'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center', completedSteps.includes(4) ? 'bg-emerald-500 text-white' : 'bg-theme-active text-theme-primary')}>
                    {completedSteps.includes(4) ? <Check className="w-3.5 h-3.5" /> : '4'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">Photos</span>
                  {(form.watch('photos')?.length || 0) + pendingFiles.length > 0 && (
                    <span className="text-xs text-theme-muted">{(form.watch('photos')?.length || 0) + pendingFiles.length} photos</span>
                  )}
                </div>
                <ChevronDown className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(4) && 'rotate-180')} />
              </button>
              {openSections.has(4) && (
                <div className="rounded-xl border border-theme-border border-t-0 rounded-t-none p-6 animate-[fadeIn_0.2s_ease-out]">
                  <Step4
                    form={form}
                    propertyId={id}
                    pendingFiles={pendingFiles}
                    setPendingFiles={setPendingFiles}
                    floorPlanProps={{
                      floorPlanUrl,
                      hotspots: floorPlanHotspots,
                      photoTags,
                      onFloorPlanChange: setFloorPlanUrl,
                      onHotspotsChange: setFloorPlanHotspots,
                      onPhotoTagsChange: setPhotoTags,
                      onUploadFloorPlan: async (file) => {
                        const propId = isEditMode ? id! : autoSavePropertyId.current ?? 'draft'
                        return uploadFloorPlan.mutateAsync({ propertyId: propId, file })
                      },
                      isUploading: uploadFloorPlan.isPending,
                      canAccess: canAccess('floorPlan'),
                    }}
                  />
                </div>
              )}
            </div>

            {/* Section 5 — Description */}
            <div ref={el => { sectionRefs.current[5] = el }} className="mb-3">
              <button
                type="button"
                onClick={() => toggleSection(5)}
                className={cn(
                  'w-full flex items-center justify-between p-4 rounded-xl border transition-colors',
                  openSections.has(5) ? 'border-theme-active bg-theme-card' : 'border-theme-border hover:border-theme-active'
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cn('w-7 h-7 rounded-full text-xs font-medium flex items-center justify-center', completedSteps.includes(5) ? 'bg-emerald-500 text-white' : 'bg-theme-active text-theme-primary')}>
                    {completedSteps.includes(5) ? <Check className="w-3.5 h-3.5" /> : '5'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">Description & publication</span>
                </div>
                <ChevronDown className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(5) && 'rotate-180')} />
              </button>
              {openSections.has(5) && (
                <div className="rounded-xl border border-theme-border border-t-0 rounded-t-none p-6 animate-[fadeIn_0.2s_ease-out]">
                  <Step5 form={form} />
                </div>
              )}
            </div>
          </form>

          {/* Spacer for mobile bottom bar */}
          <div className="h-20 lg:h-0" />
        </div>

        {/* ── Sidebar: Live preview (desktop only) ── */}
        <div className="hidden lg:block w-72 flex-shrink-0">
          <div className="sticky top-24 space-y-4">
            {/* Preview card */}
            <div className="rounded-xl border border-theme-border p-4">
              {(form.watch('photos')?.[0] || pendingFiles[0]) ? (
                <img
                  src={form.watch('photos')?.[0] || (pendingFiles[0] ? URL.createObjectURL(pendingFiles[0]) : '')}
                  alt=""
                  className="w-full aspect-[4/3] rounded-lg object-cover mb-3"
                />
              ) : (
                <div className="w-full aspect-[4/3] rounded-lg bg-theme-hover flex items-center justify-center mb-3">
                  <Building2 className="w-8 h-8 text-theme-tertiary" />
                </div>
              )}
              <p className="text-base font-bold text-theme-primary truncate">
                {form.watch('title') || 'Nouveau bien'}
              </p>
              <p className="text-xs text-theme-secondary truncate mt-0.5">
                {form.watch('address') || 'Adresse non renseignée'}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-theme-muted">
                {form.watch('rooms') && <span>{form.watch('rooms')}p.</span>}
                {form.watch('surface_m2') && <span>{form.watch('surface_m2')} m²</span>}
                {form.watch('price') && (
                  <span className="font-medium text-theme-primary">
                    {form.watch('transaction_type') === 'rent'
                      ? formatRent(Number(form.watch('price')))
                      : formatCHF(Number(form.watch('price')))}
                  </span>
                )}
              </div>
              {form.watch('transaction_type') === 'rent' && form.watch('is_furnished') && (
                <p className="text-xs text-theme-muted mt-1">· Meublé</p>
              )}
            </div>

            {/* Completion */}
            <div className="rounded-xl border border-theme-border p-4">
              <div className="flex items-center justify-between text-xs text-theme-secondary mb-2">
                <span>Complétion</span>
                <span>{Math.round((completedSteps.length / 5) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-theme-hover rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${(completedSteps.length / 5) * 100}%` }} />
              </div>
              <div className="mt-3 space-y-1">
                {[
                  { num: 1, label: 'Infos générales' },
                  { num: 2, label: 'Localisation' },
                  { num: 3, label: 'Prix & détails' },
                  { num: 4, label: 'Photos' },
                  { num: 5, label: 'Description' },
                ].map(s => (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => scrollToSection(s.num)}
                    className="flex items-center gap-2 w-full text-left text-xs text-theme-secondary hover:text-theme-primary transition-colors py-0.5"
                  >
                    <span className={cn('w-3 h-3 rounded-full border flex items-center justify-center', completedSteps.includes(s.num) ? 'bg-emerald-500 border-emerald-500' : 'border-theme-border')}>
                      {completedSteps.includes(s.num) && <Check className="w-2 h-2 text-white" />}
                    </span>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={isSaving}
              className="w-full h-10 rounded-lg border border-theme-border text-sm text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Sauver brouillon
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="w-full h-10 rounded-lg border border-theme-border text-sm font-medium text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {isEditMode ? 'Enregistrer' : 'Publier'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-theme-card/80 backdrop-blur-lg border-t border-theme-border">
        <div className="px-4 py-3 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="h-10 px-4 rounded-lg border border-theme-border text-sm text-theme-secondary flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Brouillon
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isSaving}
            className="h-10 px-6 rounded-lg border border-theme-border text-sm font-medium text-theme-primary flex items-center gap-2"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isEditMode ? 'Enregistrer' : 'Publier'}
          </button>
        </div>
      </div>
    </div>
  )
}
