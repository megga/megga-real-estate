import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { useTranslation, Trans } from 'react-i18next'
import i18n from '@/i18n'
import { z } from 'zod'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
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
import SwissAddressAutocomplete from '@/components/listings/SwissAddressAutocomplete'
import { PropertyStaticMap } from '@/components/map/PropertyStaticMap'
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
  z.number()
    .min(45.8, { error: () => i18n.t('listings:form.validation.latOutsideSwitzerland') })
    .max(47.85, { error: () => i18n.t('listings:form.validation.latOutsideSwitzerland') })
    .optional(),
)
const optionalCHLng = z.preprocess(
  (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
  z.number()
    .min(5.95, { error: () => i18n.t('listings:form.validation.lngOutsideSwitzerland') })
    .max(10.5, { error: () => i18n.t('listings:form.validation.lngOutsideSwitzerland') })
    .optional(),
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
    { error: () => i18n.t('listings:form.validation.urlInvalid') },
  )

const optionalEmail = z
  .string()
  .optional()
  .refine(
    (v) => !v || v.trim() === '' || z.string().email().safeParse(v.trim()).success,
    { error: () => i18n.t('listings:form.validation.emailInvalid') },
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
        message: i18n.t('listings:form.validation.rentRange', {
          min: PRICE_MIN_RENT,
          max: PRICE_MAX_RENT.toLocaleString('fr-CH'),
        }),
      })
    }
    if (!d.availability_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['availability_date'],
        message: i18n.t('listings:form.validation.availabilityRequiredRent'),
      })
    }
  } else {
    if (!d.price || d.price < PRICE_MIN_BUY || d.price > PRICE_MAX_BUY) {
      ctx.addIssue({
        code: 'custom',
        path: ['price'],
        message: i18n.t('listings:form.validation.priceRange', {
          min: PRICE_MIN_BUY.toLocaleString('fr-CH'),
          max: PRICE_MAX_BUY.toLocaleString('fr-CH'),
        }),
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
      message: i18n.t('listings:form.validation.cecbRequired', { canton: d.canton }),
    })
  }
}

const step1Schema = z.object({
  title: z
    .string()
    .min(5, { error: () => i18n.t('listings:form.validation.titleMin') })
    .max(200, { error: () => i18n.t('listings:form.validation.max200') }),
  transaction_type: z.enum(['buy', 'rent']).default('buy'),
  type: z.enum(['apartment', 'house', 'villa', 'commercial', 'land'], {
    error: () => i18n.t('listings:form.validation.typeRequired'),
  }),
  rooms: z.coerce.number()
    .min(0.5, { error: () => i18n.t('listings:form.validation.roomsMin') })
    .max(30, { error: () => i18n.t('listings:form.validation.roomsMax') }),
  bedrooms: z.coerce.number()
    .min(0, { error: () => i18n.t('listings:form.validation.min0') })
    .max(20, { error: () => i18n.t('listings:form.validation.bedroomsMax') }),
  bathrooms: z.coerce.number()
    .min(0, { error: () => i18n.t('listings:form.validation.min0') })
    .max(10, { error: () => i18n.t('listings:form.validation.bathroomsMax') }),
  surface_m2: z.coerce.number()
    .min(5, { error: () => i18n.t('listings:form.validation.surfaceMin') })
    .max(10000, { error: () => i18n.t('listings:form.validation.surfaceMax') }),
  floor: optionalNumber,
  total_floors: optionalNumber,
  year_built: optionalNumberRange(1800, CURRENT_YEAR + 5),
  condition: z.enum(['new', 'renovated', 'good', 'to_renovate']).optional(),
  // CECB letter (A–G). Optional at step1; refineCecb (applied on fullSchema)
  // promotes it to "required" when canton ∈ {GE,VD,NE} and transaction is buy.
  energy_class: z.enum(ENERGY_CLASS_OPTIONS).optional(),
})

const step2Schema = z.object({
  address: z.string()
    .min(3, { error: () => i18n.t('listings:form.validation.addressRequired') })
    .max(200, { error: () => i18n.t('listings:form.validation.max200') }),
  city: z.string()
    .min(2, { error: () => i18n.t('listings:form.validation.cityRequired') })
    .max(100, { error: () => i18n.t('listings:form.validation.max100') }),
  canton: z.enum(CANTONS as unknown as [string, ...string[]], {
    error: () => i18n.t('listings:form.validation.cantonRequired'),
  }),
  postal_code: z
    .string()
    .regex(/^[1-9]\d{3}$/, { error: () => i18n.t('listings:form.validation.postalCodeInvalid') }),
  lat: optionalCHLat,
  lng: optionalCHLng,
  // EGID — Swiss federal building identifier (9 digits). Optional at the form
  // layer but a DB CHECK constraint enforces format. The notaire requires it
  // for the acte authentique; FINMA expects it for LBA dossier reconstruction.
  egid: z.preprocess(
    (v) => (v === '' || v === undefined || v === null ? undefined : String(v).trim()),
    z.string()
      .regex(/^[0-9]{9}$/, { error: () => i18n.t('listings:form.validation.egidInvalid') })
      .optional(),
  ),
})

const step3SchemaBase = z.object({
  transaction_type: z.enum(['buy', 'rent']).default('buy'),
  price: z.coerce.number().min(0, { error: () => i18n.t('listings:form.validation.priceNegative') }),
  charges_monthly: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().min(0).max(10_000).optional(),
  ),
  mandate_type: z.enum(['exclusive', 'simple', 'search'], {
    error: () => i18n.t('listings:form.validation.mandateRequired'),
  }),
  features: z.array(z.string().max(60))
    .max(50, { error: () => i18n.t('listings:form.validation.featuresMax') })
    .optional(),
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
  photos: z.array(z.string().url({ error: () => i18n.t('listings:form.validation.photoUrlInvalid') }))
    .max(50, { error: () => i18n.t('listings:form.validation.photosMax') })
    .optional(),
  gallery_layout: z.enum(['hero', 'mosaic', 'carousel']).optional(),
  contact_layout: z.enum(['right', 'banner', 'floating']).optional(),
  neighborhood_variant: z.enum(['scores', 'map']).optional(),
  partner_agency: z.enum(['naef', 'cardis', 'bernard']).nullable().optional(),
})

const step5Schema = z.object({
  description: z
    .string()
    .min(20, { error: () => i18n.t('listings:form.validation.descriptionMin') })
    .max(10_000, { error: () => i18n.t('listings:form.validation.descriptionMax') }),
  tags: z.array(z.string().max(40))
    .max(20, { error: () => i18n.t('listings:form.validation.tagsMax') })
    .optional(),
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


// `categoryKey` drives the i18n group header (listings:form.featureGroup.*).
// `items` stay in French on purpose: they are persisted verbatim into
// `properties.features` (matched as data), so they must NOT be translated.
const FEATURES_CATEGORIZED = [
  {
    categoryKey: 'exterior',
    items: ['Balcon', 'Terrasse', 'Jardin', 'Piscine'],
  },
  {
    categoryKey: 'parkingStorage',
    items: ['Garage', 'Parking', 'Place de parc', 'Cave'],
  },
  {
    categoryKey: 'interior',
    items: ['Ascenseur', 'Cheminée', 'Climatisation', 'Buanderie', 'Meublé'],
  },
  {
    categoryKey: 'qualityAccess',
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

// Display-only sub-labels for each property type, resolved at render via i18n
// (keyed by the persisted `type` code). See listings:form.typeDesc.*.
const PROPERTY_TYPE_DESC_KEYS: Record<string, string> = {
  apartment: 'apartment',
  house: 'house',
  villa: 'villa',
  commercial: 'commercial',
  land: 'land',
}

const PROPERTY_TYPE_ICONS: Record<string, MEIconName> = {
  apartment: 'building',
  house: 'home',
  villa: 'villa',
  commercial: 'store',
  office: 'briefcase',
  parking: 'parking',
  storage: 'warehouse',
  land: 'land',
}

// Value lists — labels resolved at render via i18n (listings:form.condition.*
// and listings:form.availability.*). The `value` is the persisted/logical code.
const CONDITION_OPTIONS = [
  { value: 'new' },
  { value: 'renovated' },
  { value: 'good' },
  { value: 'to_renovate' },
] as const

const AVAILABILITY_OPTIONS = [
  { value: 'immediate' },
  { value: '3months' },
  { value: 'negotiable' },
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
          <MEIcon name="minus" className="h-4 w-4" />
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
          <MEIcon name="plus" className="h-4 w-4" />
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
  const { t } = useTranslation('listings')
  const { register, watch, setValue, formState: { errors } } = form

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-theme-primary">{t('form.step1.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-1">{t('form.step1.subtitle')}</p>
      </div>

      {/* Title */}
      <div>
        <FieldLabel htmlFor="title">{t('form.fields.title')}</FieldLabel>
        <input
          id="title"
          {...register('title')}
          placeholder={t('form.placeholders.title')}
          className={inputClass}
        />
        <FieldError message={errors.title?.message} />
      </div>

      {/* Property type — icons + labels */}
      <div>
        <FieldLabel htmlFor="type">{t('form.fields.type')}</FieldLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {(Object.entries(PROPERTY_TYPE_LABELS) as [PropertyType, string][]).map(([value, label]) => {
            const iconName = PROPERTY_TYPE_ICONS[value]
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
                <MEIcon name={iconName} className={cn('h-7 w-7 mb-2', isSelected ? 'text-theme-primary' : 'text-theme-muted')} />
                <span className="text-sm font-medium">{label}</span>
                <span className={cn('text-xs mt-0.5', isSelected ? 'text-theme-secondary' : 'text-theme-muted')}>{t(`form.typeDesc.${PROPERTY_TYPE_DESC_KEYS[value]}`)}</span>
              </label>
            )
          })}
        </div>
        <FieldError message={errors.type?.message} />
      </div>

      <SectionDivider title={t('form.step1.characteristics')} />

      {/* Number steppers for rooms, bedrooms, bathrooms */}
      <div className="grid grid-cols-3 gap-6">
        <NumberStepper
          label={t('form.fields.rooms')}
          value={watch('rooms')}
          onChange={(v) => setValue('rooms', v, { shouldValidate: true })}
          min={0.5}
          max={30}
          step={0.5}
          error={errors.rooms?.message}
        />
        <NumberStepper
          label={t('form.fields.bedrooms')}
          value={watch('bedrooms')}
          onChange={(v) => setValue('bedrooms', v, { shouldValidate: true })}
          min={0}
          max={20}
          step={1}
          error={errors.bedrooms?.message}
        />
        <NumberStepper
          label={t('form.fields.bathrooms')}
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
          <FieldLabel htmlFor="surface_m2">{t('form.fields.surface')}</FieldLabel>
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
          <FieldLabel htmlFor="floor">{t('form.fields.floor')}</FieldLabel>
          <input id="floor" type="number" {...register('floor')} placeholder="3" className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="total_floors">{t('form.fields.totalFloors')}</FieldLabel>
          <input id="total_floors" type="number" {...register('total_floors')} placeholder="5" className={inputClass} />
        </div>
        <div>
          <FieldLabel htmlFor="year_built">{t('form.fields.yearBuilt')}</FieldLabel>
          <input id="year_built" type="number" {...register('year_built')} placeholder="2020" className={inputClass} />
        </div>
      </div>

      {/* Condition */}
      <div>
        <FieldLabel htmlFor="condition">{t('form.fields.condition')}</FieldLabel>
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
              {t(`form.condition.${opt.value}`)}
            </button>
          ))}
        </div>
      </div>

      {/* CECB — classe énergétique (obligatoire à la vente pour GE/VD/NE,
          validée côté fullSchema via refineCecb) */}
      <div>
        <FieldLabel htmlFor="energy_class">{t('form.fields.energyClass')}</FieldLabel>
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
          {t('form.fields.energyClassHelp')}
        </p>
        <FieldError message={errors.energy_class?.message} />
      </div>
    </div>
  )
}

// ─── Step 2: Localisation (refonte avec autocomplete) ───

function Step2({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { t } = useTranslation('listings')
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
        <h2 className="text-xl font-semibold text-theme-primary">{t('form.step2.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-1">{t('form.step2.subtitle')}</p>
      </div>

      {!isManualMode ? (
        <>
          {/* Swiss address autocomplete */}
          <div>
            <FieldLabel htmlFor="address-search">{t('form.fields.propertyAddress')}</FieldLabel>
            <SwissAddressAutocomplete
              onSelect={handleAddressSelect}
              defaultValue={address}
              placeholder={t('form.placeholders.addressSearch')}
            />
            <p className="text-xs text-theme-muted mt-1.5">
              {t('form.step2.addressSearchHelp')}
            </p>
          </div>

          {/* Selected address summary */}
          {hasAddress && (
            <div className="rounded-lg border border-theme-border p-4 bg-theme-section">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-theme-active flex items-center justify-center flex-shrink-0 mt-0.5">
                    <MEIcon name="location" className="h-4 w-4 text-theme-primary" />
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
                  <MEIcon name="close" className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Readonly fields showing selected data */}
          {hasAddress && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-theme-muted mb-1">{t('form.fields.street')}</p>
                <p className="text-sm text-theme-primary font-medium truncate">{address}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted mb-1">{t('form.fields.city')}</p>
                <p className="text-sm text-theme-primary font-medium">{city}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted mb-1">{t('form.fields.postalCode')}</p>
                <p className="text-sm text-theme-primary font-medium">{postalCode}</p>
              </div>
              <div>
                <p className="text-xs text-theme-muted mb-1">{t('form.fields.canton')}</p>
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
            {t('form.step2.manualEntry')}
          </button>
        </>
      ) : (
        <>
          {/* Manual mode — classic fields */}
          <div>
            <FieldLabel htmlFor="address">{t('form.fields.address')}</FieldLabel>
            <input id="address" {...register('address')} placeholder="Rue du Lac 12" className={inputClass} />
            <FieldError message={errors.address?.message} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <FieldLabel htmlFor="city">{t('form.fields.city')}</FieldLabel>
              <input id="city" {...register('city')} placeholder="Genève" className={inputClass} />
              <FieldError message={errors.city?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="canton">{t('form.fields.canton')}</FieldLabel>
              <select id="canton" {...register('canton')} className={selectClass}>
                <option value="">{t('form.placeholders.select')}</option>
                {CANTONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <FieldError message={errors.canton?.message} />
            </div>
            <div>
              <FieldLabel htmlFor="postal_code">{t('form.fields.postalCodeFull')}</FieldLabel>
              <input id="postal_code" {...register('postal_code')} placeholder="1207" maxLength={4} className={inputClass} />
              <FieldError message={errors.postal_code?.message} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsManualMode(false)}
            className="text-xs text-theme-muted hover:text-theme-secondary transition-colors underline underline-offset-2"
          >
            {t('form.step2.searchByAddress')}
          </button>
        </>
      )}

      {/* EGID — identifiant fédéral du bâtiment (9 chiffres, OFS).
          Optionnel au formulaire mais requis par le notaire pour l'acte
          authentique. Toujours visible (mode autocomplete + mode manuel). */}
      <div>
        <FieldLabel htmlFor="egid">{t('form.fields.egid')}</FieldLabel>
        <input
          id="egid"
          {...register('egid')}
          placeholder="987654321"
          inputMode="numeric"
          maxLength={9}
          className={inputClass}
        />
        <p className="text-xs text-theme-muted mt-1.5">
          <Trans
            i18nKey="listings:form.fields.egidHelp"
            components={{ mono: <span className="font-mono" /> }}
          />
        </p>
        <FieldError message={errors.egid?.message} />
      </div>

      {/* Mini map placeholder — will show actual map when lat/lng available */}
      <div className={cn(
        'rounded-lg border overflow-hidden h-48',
        lat && lng ? 'border-theme-border' : 'border-dashed border-theme-border bg-theme-section'
      )}>
        {lat && lng ? (
          <PropertyStaticMap
            lat={lat}
            lng={lng}
            address={[address, postalCode, city].filter(Boolean).join(' ')}
            className="w-full h-full"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <MEIcon name="location" className="h-8 w-8 text-theme-muted mx-auto mb-2" />
              <p className="text-xs text-theme-muted">{t('form.step2.mapPlaceholder')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step 3: Prix & détails (refonte features catégorisées) ───

function Step3({ form }: { form: UseFormReturn<ListingFormData> }) {
  const { t } = useTranslation('listings')
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
        <h2 className="text-xl font-semibold text-theme-primary">{t('form.step3.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-1">{t('form.step3.subtitle')}</p>
      </div>

      {/* Price — prominent section */}
      <div className="rounded-xl border border-theme-border p-5 bg-theme-section/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel htmlFor="price">{isRent ? t('form.fields.monthlyRent') : t('form.fields.salePrice')}</FieldLabel>
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
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-theme-muted">{t('form.perMonth')}</span>
              )}
            </div>
            <FieldError message={errors.price?.message} />
          </div>
        <div>
          <FieldLabel htmlFor="charges_monthly">{t('form.fields.chargesMonthly')}</FieldLabel>
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
            <FieldLabel>{t('form.fields.deposit')}</FieldLabel>
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
                  {t('form.monthsCount', { count: n })}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Rental-only: furnished toggle */}
        {isRent && (
          <div className="pt-4 border-t border-theme-border/50 mt-3">
            <FieldLabel>{t('form.fields.furnished')}</FieldLabel>
            <div className="flex gap-2">
              {[
                { value: false, labelKey: 'notFurnished' },
                { value: true, labelKey: 'furnished' },
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
                  {t(`form.furnishedOption.${opt.labelKey}`)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mandate type */}
      <div>
        <FieldLabel htmlFor="mandate_type">{t('form.fields.mandateType')}</FieldLabel>
        <div className="grid grid-cols-3 gap-2">
          {(['exclusive', 'simple', 'search'] as const).map((value) => (
            <label
              key={value}
              className={cn(
                'flex flex-col items-center justify-center p-3 rounded-lg border text-center cursor-pointer transition-all',
                watch('mandate_type') === value
                  ? 'border-theme-primary bg-theme-active text-theme-primary'
                  : 'border-theme-border text-theme-secondary hover:bg-theme-hover'
              )}
            >
              <input type="radio" value={value} {...register('mandate_type')} className="sr-only" />
              <span className="text-sm font-medium">{t(`form.mandate.${value}.label`)}</span>
              <span className="text-xs text-theme-muted mt-0.5">{t(`form.mandate.${value}.desc`)}</span>
            </label>
          ))}
        </div>
        <FieldError message={errors.mandate_type?.message} />
      </div>

      {/* Rental-only: external regie (optional) */}
      {isRent && (
        <details className="rounded-xl border border-theme-border p-4 group">
          <summary className="text-sm font-medium text-theme-primary cursor-pointer select-none flex items-center justify-between">
            <span>{t('form.regie.summary')}</span>
            <MEIcon name="chevron-down" className="w-4 h-4 text-theme-secondary transition-transform group-open:rotate-180" />
          </summary>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
            {[
              { field: 'name', labelKey: 'name', placeholder: 'Régie Bernard SA', type: 'text' },
              { field: 'phone', labelKey: 'phone', placeholder: '+41 22 555 00 00', type: 'tel' },
              { field: 'email', labelKey: 'email', placeholder: 'contact@regie.ch', type: 'email' },
              { field: 'website', labelKey: 'website', placeholder: 'https://regie.ch', type: 'url' },
            ].map((f) => (
              <div key={f.field}>
                <FieldLabel htmlFor={`regie_${f.field}`}>{t(`form.regie.${f.labelKey}`)}</FieldLabel>
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
        <FieldLabel htmlFor="features">{t('form.fields.features')}</FieldLabel>
        <div className="space-y-4">
          {FEATURES_CATEGORIZED.map((group) => (
            <div key={group.categoryKey}>
              <p className="text-xs text-theme-muted mb-2">{t(`form.featureGroup.${group.categoryKey}`)}</p>
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
                    {features.includes(feature) && <MEIcon name="check" className="h-3 w-3 inline mr-1.5" />}
                    {feature}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        {features.length > 0 && (
          <p className="text-xs text-theme-muted mt-2">{t('form.featuresSelected', { count: features.length })}</p>
        )}
      </div>

      {/* Availability date */}
      <div>
        <FieldLabel htmlFor="availability_date">
          {t('form.fields.availability')}
          {isRent && <span className="ml-1 text-red-500" aria-hidden="true">*</span>}
          {isRent && <span className="sr-only">{t('form.required')}</span>}
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
                {t(`form.availability.${opt.value}`)}
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
  const { t } = useTranslation('listings')
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
        <img src={url} alt={t('form.photoAlt', { index: index + 1 })} className="w-full h-full object-cover" loading="lazy" decoding="async" />
        {/* Overlay on hover */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 transition-opacity">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
              <MEIcon name="grip" className="h-5 w-5 text-white drop-shadow-md" />
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRemove() }}
              className="h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <MEIcon name="close" className="h-4 w-4" />
            </button>
          </div>
        </div>
        {/* Badge for first photo */}
        {index === 0 && (
          <span className="absolute top-2 left-2 text-xs font-semibold bg-theme-primary text-theme-inverse px-2 py-0.5 rounded-full">
            {t('form.coverPhoto')}
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
          <option value="">{t('form.roomTagPlaceholder')}</option>
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
  const { t } = useTranslation('listings')
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
        <h2 className="text-xl font-semibold text-theme-primary">{t('form.step4.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-1">
          {t('form.step4.subtitle')}
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
        <MEIcon name="upload" className={cn('h-8 w-8 mx-auto mb-2', dragOver ? 'text-accent' : 'text-theme-muted')} />
        <p className="text-sm font-medium text-theme-primary">
          {t('form.step4.dropzoneTitle')}
        </p>
        <p className="text-xs text-theme-muted mt-1">
          {t('form.step4.dropzoneHint')}
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
              {t('form.step4.layoutTitle')}
            </h3>
            <p style={{ fontSize: 12, color: '#7A8079', marginTop: 4 }}>
              {t('form.step4.layoutSubtitle')}
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
          title={t('form.floorPlan.upgradeTitle')}
          description={t('form.floorPlan.upgradeDescription')}
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
  const { t } = useTranslation('listings')
  const signPhotos = useSignPhotos()
  const [signed, setSigned] = useState(false)

  if (photoUrls.length === 0) return null

  // Si pas encore de propertyId (brouillon), on ne peut pas signer
  if (!propertyId) {
    return (
      <div className="rounded-xl border border-theme-border p-4 mt-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <MEIcon name="shield" className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">{t('form.c2pa.title')}</p>
            <p className="text-xs text-theme-tertiary">{t('form.c2pa.saveFirst')}</p>
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
            <MEIcon name="shield" className={cn(
              'w-4 h-4',
              signed || signPhotos.isSuccess ? 'text-emerald-600' : 'text-theme-muted'
            )} />
          </div>
          <div>
            <p className="text-sm font-medium text-theme-primary">
              {signed || signPhotos.isSuccess ? t('form.c2pa.titleSigned') : t('form.c2pa.title')}
            </p>
            <p className="text-xs text-theme-tertiary">
              {signed || signPhotos.isSuccess
                ? t('form.c2pa.signedCount', { count: photoUrls.length })
                : t('form.c2pa.proveAuthenticity')
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
                <MEIcon name="spinner" className="w-3.5 h-3.5 animate-spin" />
                {t('form.c2pa.certifying')}
              </>
            ) : (
              <>
                <MEIcon name="shield" className="w-3.5 h-3.5" />
                {t('form.c2pa.certify')}
              </>
            )}
          </button>
        )}
      </div>
      {signPhotos.isError && (
        <p className="text-xs text-red-600 mt-2">
          {t('form.c2pa.error')}
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
  const { t } = useTranslation('listings')
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
            <p className="text-xs text-theme-tertiary">{t('form.staging.subtitle')}</p>
          </div>
        </div>
        <MEIcon name="chevron-down" className={cn('w-4 h-4 text-theme-muted transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-theme-border pt-4">
          {/* Photo selection */}
          <div>
            <p className="text-xs font-medium text-theme-secondary mb-2">{t('form.staging.selectPhoto')}</p>
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
                <p className="text-xs font-medium text-theme-secondary mb-2">{t('form.staging.style')}</p>
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
                <p className="text-xs font-medium text-theme-secondary mb-2">{t('form.staging.roomType')}</p>
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
                    <MEIcon name="spinner" className="w-4 h-4 animate-spin" />
                    {t('form.staging.generating')}
                  </>
                ) : (
                  t('form.staging.generate')
                )}
              </button>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-500">
                  {error.error}
                  {error.upgrade_required && ` ${t('form.staging.upgradeSuffix')}`}
                </p>
              )}

              {/* Result preview */}
              {result && (
                <div className="rounded-lg border border-theme-border overflow-hidden">
                  <div className="grid grid-cols-2 gap-px bg-theme-border">
                    <div className="relative bg-theme-card">
                      <img src={photos[selectedPhoto]} alt={t('form.staging.original')} className="w-full aspect-[4/3] object-cover" />
                      <span className="absolute bottom-2 left-2 text-xs font-medium bg-black/50 text-white px-2 py-0.5 rounded">{t('form.staging.original')}</span>
                    </div>
                    <div className="relative bg-theme-card">
                      <img src={result.staged_url} alt={t('form.staging.furnished')} className="w-full aspect-[4/3] object-cover" />
                      <span className="absolute bottom-2 left-2 text-xs font-medium bg-accent/80 text-white px-2 py-0.5 rounded">MEGGA Staging</span>
                    </div>
                  </div>
                  <div className="p-3 flex items-center justify-between">
                    <span className="text-xs text-theme-muted">
                      {t('form.staging.imagesRemaining', { count: result.usage.remaining })}
                    </span>
                    <button
                      onClick={() => { reset(); setSelectedPhoto(null) }}
                      className="text-xs text-accent hover:underline"
                    >
                      {t('form.staging.stageAnother')}
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
  const { t } = useTranslation('listings')
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
        <h2 className="text-xl font-semibold text-theme-primary">{t('form.step5.title')}</h2>
        <p className="text-sm text-theme-tertiary mt-1">{t('form.step5.subtitle')}</p>
      </div>

      {/* Description */}
      <div>
        <FieldLabel htmlFor="description">{t('form.fields.description')}</FieldLabel>
        <textarea
          id="description"
          {...register('description')}
          rows={6}
          placeholder={t('form.placeholders.description')}
          className="w-full px-4 py-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors resize-y text-theme-primary placeholder:text-theme-muted"
        />
        <FieldError message={errors.description?.message} />
      </div>

      {/* Tags */}
      <div>
        <FieldLabel htmlFor="tags">{t('form.fields.tags')}</FieldLabel>
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
        <p className="text-sm font-medium text-theme-primary mb-3">{t('form.preview.heading')}</p>
        <div className="rounded-lg border border-theme-border p-5 bg-theme-section">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div>
              <p className="text-lg font-bold text-theme-primary">
                {price > 0 ? formatCHF(price) : 'CHF —'}
              </p>
              <h3 className="text-sm font-semibold text-theme-primary mt-0.5">
                {title || t('form.preview.titlePlaceholder')}
              </h3>
              <p className="text-xs text-theme-secondary mt-0.5">
                {city || t('form.preview.cityPlaceholder')}{canton ? ` (${canton})` : ''}
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
              {rooms > 0 && t('form.preview.roomsCount', { count: rooms })}
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
            {watch('description') || t('form.preview.descriptionPlaceholder')}
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
  const { t } = useTranslation('listings')
  const methods = [
    {
      id: 'manual' as const,
      icon: 'edit',
      title: t('form.method.manual.title'),
      desc: t('form.method.manual.desc'),
      available: true,
    },
    {
      id: 'duplicate' as const,
      icon: 'copy',
      title: t('form.method.duplicate.title'),
      desc: hasProperties ? t('form.method.duplicate.desc') : t('form.method.duplicate.descEmpty'),
      available: hasProperties,
    },
    {
      id: 'url' as const,
      icon: 'link',
      title: t('form.method.url.title'),
      desc: t('form.method.url.desc'),
      available: true,
    },
    {
      id: 'pdf' as const,
      icon: 'file',
      title: t('form.method.pdf.title'),
      desc: t('form.method.pdf.desc'),
      available: true,
    },
  ]

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <h1 className="text-xl font-semibold text-theme-primary mb-1">{t('form.method.heading')}</h1>
      <p className="text-sm text-theme-muted mb-8">{t('form.method.subheading')}</p>

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
              <MEIcon name={m.icon as MEIconName} className={cn(
                'w-5 h-5 mt-0.5 flex-shrink-0',
                m.available ? 'text-theme-secondary group-hover:text-accent transition-colors' : 'text-theme-muted'
              )} />
              <div>
                <p className="text-sm font-medium text-theme-primary">{m.title}</p>
                <p className="text-xs text-theme-muted mt-0.5 leading-relaxed">{m.desc}</p>
              </div>
            </div>
            {!m.available && m.id !== 'duplicate' && (
              <span className="absolute top-3 right-3 text-xs text-theme-muted">{t('form.method.soon')}</span>
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
  const { t } = useTranslation('listings')
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
        <MEIcon name="arrow-left" className="w-4 h-4" />
        {t('common:actions.back')}
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">{t('form.duplicate.heading')}</h1>
      <p className="text-sm text-theme-muted mb-6">{t('form.duplicate.subheading')}</p>

      <div className="w-full max-w-lg">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('form.duplicate.searchPlaceholder')}
          className="w-full h-10 px-4 text-sm bg-transparent border border-theme-border rounded-xl focus:outline-none focus:border-accent/40 text-theme-primary placeholder:text-theme-muted mb-4"
        />

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <MEIcon name="spinner" className="w-5 h-5 animate-spin text-theme-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-theme-muted text-center py-8">{t('empty_no_results')}</p>
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
                    <MEIcon name="building" className="w-5 h-5 text-theme-muted" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">
                    {p.title || p.address}
                  </p>
                  <p className="text-xs text-theme-muted truncate">
                    {p.city}{p.canton ? ` (${p.canton})` : ''} · {t('form.preview.roomsCount', { count: p.rooms })} · {p.surface_m2} m²
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
  const { t } = useTranslation('listings')
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
        <MEIcon name="arrow-left" className="w-4 h-4" />
        {t('common:actions.back')}
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">{t('form.url.heading')}</h1>
      <p className="text-sm text-theme-muted mb-6">{t('form.url.subheading')}</p>

      <div className="w-full max-w-lg">
        {!isExtracting ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.homegate.ch/buy/12345..."
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
              {t('form.url.analyze')}
            </button>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                <p className="text-sm text-red-500 font-medium">{t('form.url.errorTitle')}</p>
                <p className="text-xs text-theme-muted mt-1">{error}</p>
              </div>
            )}

            {/* Supported portals */}
            <div className="pt-4">
              <p className="text-xs text-theme-muted mb-2">{t('form.url.supportedPortals')}</p>
              <div className="flex flex-wrap gap-1.5">
                {SUPPORTED_PORTALS.map(p => (
                  <span key={p} className="text-xs text-theme-secondary px-2 py-0.5 rounded-md bg-theme-hover">{p}</span>
                ))}
              </div>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-theme-border p-8 text-center">
            <MEIcon name="spinner" className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">{t('form.url.analyzing')}</p>
            <p className="text-xs text-theme-muted mt-1 truncate max-w-xs mx-auto">{url}</p>
            <p className="text-xs text-theme-muted mt-3">{t('form.url.analyzingHint')}</p>
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
  const { t } = useTranslation('listings')
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
        <MEIcon name="arrow-left" className="w-4 h-4" />
        {t('common:actions.back')}
      </button>

      <h1 className="text-xl font-semibold text-theme-primary mb-1">{t('form.pdf.heading')}</h1>
      <p className="text-sm text-theme-muted mb-6">{t('form.pdf.subheading')}</p>

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
            <MEIcon name="upload" className="w-8 h-8 text-theme-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">{t('form.pdf.dropzoneTitle')}</p>
            <p className="text-xs text-theme-muted mt-1">{t('form.pdf.dropzoneHint')}</p>
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
            <MEIcon name="spinner" className="w-6 h-6 animate-spin text-accent mx-auto mb-3" />
            <p className="text-sm font-medium text-theme-primary">{t('form.pdf.analyzing')}</p>
            <p className="text-xs text-theme-muted mt-1">{selectedFile?.name}</p>
            <p className="text-xs text-theme-muted mt-3">{t('form.pdf.analyzingHint')}</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-500 font-medium">{t('form.pdf.errorTitle')}</p>
            <p className="text-xs text-theme-muted mt-1">{error}</p>
            <button
              onClick={() => { setSelectedFile(null) }}
              className="mt-3 text-xs text-theme-secondary hover:text-theme-primary transition-colors"
            >
              {t('form.pdf.retry')}
            </button>
          </div>
        )}

        {/* Supported formats */}
        <div className="mt-6 text-center">
          <p className="text-xs text-theme-muted">{t('form.pdf.supportedFormats')}</p>
        </div>
      </div>
    </div>
  )
}

// ─── Main wizard ───

export default function ListingFormPage() {
  const { t } = useTranslation('listings')
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
      // published_at est posé par le trigger DB set_property_published_at au
      // 1er passage en 'active' (source unique, immuable ensuite) — ne pas le poser ici.
    }
  }

  async function handleSaveDraft() {
    const values = form.getValues()
    if (!isDraftSane(values)) {
      setSaveError(t('form.errors.fixInvalidFields'))
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
        setSaveError(
          isRentMandate
            ? t('form.errors.lbaRent')
            : t('form.errors.lbaBuy', { price: (values.price ?? 0).toLocaleString('fr-CH') }),
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
        <MEIcon name="spinner" className="h-6 w-6 animate-spin text-theme-muted" />
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
            <MEIcon name="arrow-left" className="h-5 w-5" />
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
          <MEIcon name="arrow-left" className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-theme-primary">
            {isEditMode ? t('form.header.edit') : duplicateId ? t('form.header.duplicate') : t('form.header.new')}
          </h1>
          <p className="text-sm text-theme-tertiary">
            {isEditMode ? existingProperty?.title ?? '' : t('form.header.stepIndicator', { current: currentStep, total: 5 })}
          </p>
        </div>
        {/* Auto-save indicator */}
        {autoSaveStatus === 'saving' && (
          <span className="text-xs text-theme-muted flex items-center gap-1.5">
            <MEIcon name="spinner" className="h-3 w-3 animate-spin" />
            {t('form.autosave.saving')}
          </span>
        )}
        {autoSaveStatus === 'saved' && (
          <span className="text-xs text-theme-secondary flex items-center gap-1.5">
            <MEIcon name="check" className="h-3 w-3" />
            {t('form.autosave.saved')}
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
                  {v === 'buy' ? t('form.transaction.buy') : t('form.transaction.rent')}
                </button>
              )
            })}
            {isEditMode && (
              <span className="text-xs text-theme-muted ml-2">
                {t('form.transaction.locked')}
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
                    {completedSteps.includes(1) ? <MEIcon name="check" className="w-3.5 h-3.5" /> : '1'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">{t('form.sections.general')}</span>
                </div>
                <MEIcon name="chevron-down" className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(1) && 'rotate-180')} />
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
                    {completedSteps.includes(2) ? <MEIcon name="check" className="w-3.5 h-3.5" /> : '2'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">{t('form.sections.location')}</span>
                </div>
                <MEIcon name="chevron-down" className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(2) && 'rotate-180')} />
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
                    {completedSteps.includes(3) ? <MEIcon name="check" className="w-3.5 h-3.5" /> : '3'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">{t('form.sections.priceDetails')}</span>
                </div>
                <MEIcon name="chevron-down" className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(3) && 'rotate-180')} />
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
                    {completedSteps.includes(4) ? <MEIcon name="check" className="w-3.5 h-3.5" /> : '4'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">{t('form.sections.photos')}</span>
                  {(form.watch('photos')?.length || 0) + pendingFiles.length > 0 && (
                    <span className="text-xs text-theme-muted">{t('form.sections.photosCount', { count: (form.watch('photos')?.length || 0) + pendingFiles.length })}</span>
                  )}
                </div>
                <MEIcon name="chevron-down" className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(4) && 'rotate-180')} />
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
                    {completedSteps.includes(5) ? <MEIcon name="check" className="w-3.5 h-3.5" /> : '5'}
                  </span>
                  <span className="text-sm font-semibold text-theme-primary">{t('form.sections.descriptionPublish')}</span>
                </div>
                <MEIcon name="chevron-down" className={cn('w-4 h-4 text-theme-secondary transition-transform', openSections.has(5) && 'rotate-180')} />
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
                  <MEIcon name="building" className="w-8 h-8 text-theme-tertiary" />
                </div>
              )}
              <p className="text-base font-bold text-theme-primary truncate">
                {form.watch('title') || t('form.preview.newPropertyTitle')}
              </p>
              <p className="text-xs text-theme-secondary truncate mt-0.5">
                {form.watch('address') || t('form.preview.noAddress')}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-theme-muted">
                {form.watch('rooms') && <span>{t('form.preview.roomsShort', { count: form.watch('rooms') })}</span>}
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
                <p className="text-xs text-theme-muted mt-1">· {t('form.fields.furnished')}</p>
              )}
            </div>

            {/* Completion */}
            <div className="rounded-xl border border-theme-border p-4">
              <div className="flex items-center justify-between text-xs text-theme-secondary mb-2">
                <span>{t('form.completion')}</span>
                <span>{Math.round((completedSteps.length / 5) * 100)}%</span>
              </div>
              <div className="h-1.5 bg-theme-hover rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${(completedSteps.length / 5) * 100}%` }} />
              </div>
              <div className="mt-3 space-y-1">
                {[
                  { num: 1, label: t('form.sections.general') },
                  { num: 2, label: t('form.sections.location') },
                  { num: 3, label: t('form.sections.priceDetails') },
                  { num: 4, label: t('form.sections.photos') },
                  { num: 5, label: t('form.sections.description') },
                ].map(s => (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => scrollToSection(s.num)}
                    className="flex items-center gap-2 w-full text-left text-xs text-theme-secondary hover:text-theme-primary transition-colors py-0.5"
                  >
                    <span className={cn('w-3 h-3 rounded-full border flex items-center justify-center', completedSteps.includes(s.num) ? 'bg-emerald-500 border-emerald-500' : 'border-theme-border')}>
                      {completedSteps.includes(s.num) && <MEIcon name="check" className="w-2 h-2 text-white" />}
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
              {isSaving ? <MEIcon name="spinner" className="h-4 w-4 animate-spin" /> : <MEIcon name="save" className="h-4 w-4" />}
              {t('form.actions.saveDraft')}
            </button>
            <button
              type="button"
              onClick={handlePublish}
              disabled={isSaving}
              className="w-full h-10 rounded-lg border border-theme-border text-sm font-medium text-theme-primary hover:border-theme-active transition-colors flex items-center justify-center gap-2"
            >
              {isSaving ? <MEIcon name="spinner" className="h-4 w-4 animate-spin" /> : <MEIcon name="send" className="h-4 w-4" />}
              {isEditMode ? t('form.actions.save') : t('form.actions.publish')}
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
            {isSaving ? <MEIcon name="spinner" className="h-4 w-4 animate-spin" /> : <MEIcon name="save" className="h-4 w-4" />}
            {t('form.actions.draft')}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isSaving}
            className="h-10 px-6 rounded-lg border border-theme-border text-sm font-medium text-theme-primary flex items-center gap-2"
          >
            {isSaving ? <MEIcon name="spinner" className="h-4 w-4 animate-spin" /> : <MEIcon name="send" className="h-4 w-4" />}
            {isEditMode ? t('form.actions.save') : t('form.actions.publish')}
          </button>
        </div>
      </div>
    </div>
  )
}
