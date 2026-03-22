import { useState, useCallback, useMemo, useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

// ─── Mock editable data (Phase A) ───

const MOCK_EDITABLE_LISTINGS: Record<string, ListingFormData> = {
  al1: {
    title: 'Appartement lumineux aux Eaux-Vives',
    type: 'apartment',
    rooms: 4,
    bedrooms: 2,
    bathrooms: 1,
    surface_m2: 95,
    floor: 3,
    total_floors: 5,
    year_built: 2018,
    address: 'Rue du Lac 12',
    city: 'Genève',
    canton: 'GE',
    postal_code: '1207',
    price: 720000,
    charges_monthly: 350,
    mandate_type: 'exclusive',
    features: ['Balcon', 'Vue lac', 'Ascenseur', 'Parking'],
    photos: [
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
    ],
    description: 'Magnifique appartement de 4 pièces entièrement rénové, situé au cœur du quartier des Eaux-Vives à Genève. Luminosité exceptionnelle grâce à ses grandes baies vitrées orientées sud-ouest, offrant une vue dégagée sur le lac Léman.',
    tags: ['Exclusif', 'Coup de cœur'],
  },
  al2: {
    title: 'Villa contemporaine Cologny',
    type: 'villa',
    rooms: 8,
    bedrooms: 5,
    bathrooms: 3,
    surface_m2: 320,
    floor: undefined,
    total_floors: 2,
    year_built: 2021,
    address: 'Chemin des Crêts 28',
    city: 'Cologny',
    canton: 'GE',
    postal_code: '1223',
    price: 4500000,
    charges_monthly: 800,
    mandate_type: 'exclusive',
    features: ['Piscine', 'Jardin', 'Garage', 'Vue lac', 'Climatisation', 'Minergie'],
    photos: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop',
    ],
    description: 'Exceptionnelle villa contemporaine de 8 pièces à Cologny, avec vue panoramique sur le lac Léman et les Alpes. Architecture moderne signée, finitions haut de gamme. Jardin paysager de 1200 m² avec piscine à débordement.',
    tags: ['Exclusif', 'Hot price'],
  },
  al3: {
    title: 'Loft industriel Carouge',
    type: 'apartment',
    rooms: 3,
    bedrooms: 1,
    bathrooms: 1,
    surface_m2: 78,
    floor: 2,
    total_floors: 3,
    year_built: 1920,
    address: 'Rue Ancienne 34',
    city: 'Carouge',
    canton: 'GE',
    postal_code: '1227',
    price: 580000,
    charges_monthly: 280,
    mandate_type: 'simple',
    features: ['Cheminée', 'Cave'],
    photos: [
      'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop',
    ],
    description: 'Superbe loft au cachet industriel dans le quartier historique de Carouge. Poutres apparentes, grandes hauteurs sous plafond, sol en béton ciré. Un espace atypique et plein de caractère.',
    tags: ['Nouveau'],
  },
  al4: {
    title: 'Maison de charme Vandoeuvres',
    type: 'house',
    rooms: 6,
    bedrooms: 4,
    bathrooms: 2,
    surface_m2: 210,
    floor: undefined,
    total_floors: 2,
    year_built: 1965,
    address: 'Route de Vandoeuvres 56',
    city: 'Vandoeuvres',
    canton: 'GE',
    postal_code: '1253',
    price: 2100000,
    charges_monthly: 500,
    mandate_type: 'exclusive',
    features: ['Jardin', 'Garage', 'Cheminée', 'Cave'],
    photos: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop',
    ],
    description: 'Charmante maison de village rénovée avec goût, située dans le paisible village de Vandoeuvres. Grand jardin arboré de 600 m², double garage, cave voûtée. Calme absolu à 10 minutes du centre de Genève.',
    tags: [],
  },
  al5: {
    title: 'Penthouse vue lac Montreux', type: 'apartment', rooms: 5, bedrooms: 3, bathrooms: 2, surface_m2: 145,
    floor: 6, total_floors: 6, year_built: 2015, address: 'Avenue du Casino 15', city: 'Montreux', canton: 'VD',
    postal_code: '1820', price: 1950000, charges_monthly: 600, mandate_type: 'exclusive',
    features: ['Terrasse', 'Vue lac', 'Ascenseur', 'Climatisation', 'Parking'],
    photos: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop'],
    description: 'Penthouse exceptionnel avec terrasse panoramique et vue imprenable sur le lac Léman et les Alpes. Finitions luxueuses, domotique intégrée.', tags: ['Exclusif'],
  },
  al6: {
    title: 'Studio rénové Plainpalais', type: 'apartment', rooms: 1.5, bedrooms: 1, bathrooms: 1, surface_m2: 32,
    floor: 2, total_floors: 4, year_built: 1960, address: 'Rue de Carouge 78', city: 'Genève', canton: 'GE',
    postal_code: '1205', price: 385000, charges_monthly: 180, mandate_type: 'simple',
    features: ['Cave'], photos: ['https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=400&h=300&fit=crop'],
    description: 'Studio entièrement rénové au cœur de Plainpalais. Idéal premier achat ou investissement locatif. Rendement attractif.', tags: ['Investissement', 'Première acquisition'],
  },
  al7: {
    title: 'Terrain constructible Meyrin', type: 'land', rooms: 0 as unknown as number, bedrooms: 0 as unknown as number, bathrooms: 0 as unknown as number, surface_m2: 850,
    floor: undefined, total_floors: undefined, year_built: undefined, address: 'Chemin de la Golette', city: 'Meyrin', canton: 'GE',
    postal_code: '1217', price: 1200000, charges_monthly: undefined, mandate_type: 'exclusive',
    features: [], photos: ['https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=400&h=300&fit=crop'],
    description: 'Terrain constructible de 850 m² en zone villas à Meyrin. Permis de construire en cours. Orientation sud, vue dégagée.', tags: [],
  },
  al8: {
    title: 'Appartement familial Champel', type: 'apartment', rooms: 5, bedrooms: 3, bathrooms: 2, surface_m2: 120,
    floor: 4, total_floors: 6, year_built: 2005, address: 'Avenue de Champel 42', city: 'Genève', canton: 'GE',
    postal_code: '1206', price: 890000, charges_monthly: 420, mandate_type: 'exclusive',
    features: ['Balcon', 'Ascenseur', 'Parking', 'Cave', 'Buanderie'],
    photos: ['https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop'],
    description: 'Bel appartement familial de 5 pièces à Champel, quartier résidentiel prisé. Proximité écoles internationales et parc Bertrand.', tags: ['Idéal famille'],
  },
  al9: {
    title: 'Local commercial Rive', type: 'commercial', rooms: 0 as unknown as number, bedrooms: 0 as unknown as number, bathrooms: 1, surface_m2: 95,
    floor: 0, total_floors: 5, year_built: 1990, address: 'Rue du Rhône 88', city: 'Genève', canton: 'GE',
    postal_code: '1204', price: 750000, charges_monthly: 350, mandate_type: 'simple',
    features: ['Climatisation'], photos: ['https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop'],
    description: 'Local commercial en rez-de-chaussée sur la prestigieuse Rue du Rhône. Idéal boutique, galerie ou bureau de prestige.', tags: [],
  },
  al10: {
    title: 'Duplex avec terrasse Nyon', type: 'apartment', rooms: 5.5, bedrooms: 3, bathrooms: 2, surface_m2: 140,
    floor: 3, total_floors: 4, year_built: 2022, address: 'Route de Saint-Cergue 12', city: 'Nyon', canton: 'VD',
    postal_code: '1260', price: 1100000, charges_monthly: 450, mandate_type: 'exclusive',
    features: ['Terrasse', 'Parking', 'Ascenseur', 'Minergie'],
    photos: ['https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop'],
    description: 'Magnifique duplex neuf avec terrasse de 25 m² dans résidence Minergie à Nyon. Vue sur le lac et le Mont-Blanc.', tags: ['Nouveau'],
  },
  al11: {
    title: 'Chalet alpin Verbier', type: 'house', rooms: 7, bedrooms: 4, bathrooms: 3, surface_m2: 250,
    floor: undefined, total_floors: 3, year_built: 2010, address: 'Route de Médran 45', city: 'Verbier', canton: 'VS',
    postal_code: '1936', price: 3200000, charges_monthly: 700, mandate_type: 'exclusive',
    features: ['Cheminée', 'Garage', 'Jardin', 'Vue montagne', 'Balcon'],
    photos: ['https://images.unsplash.com/photo-1518780664697-55e3ad937233?w=400&h=300&fit=crop'],
    description: 'Superbe chalet alpin à Verbier, au pied des pistes. Construction traditionnelle avec finitions modernes. Wellness avec sauna et jacuzzi.', tags: ['Exclusif'],
  },
  al12: {
    title: 'Attique moderne Lausanne', type: 'apartment', rooms: 4.5, bedrooms: 2, bathrooms: 1, surface_m2: 110,
    floor: 5, total_floors: 5, year_built: 2019, address: 'Avenue de la Gare 20', city: 'Lausanne', canton: 'VD',
    postal_code: '1003', price: 1350000, charges_monthly: 520, mandate_type: 'simple',
    features: ['Terrasse', 'Ascenseur', 'Vue lac', 'Parking'],
    photos: ['https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?w=400&h=300&fit=crop'],
    description: 'Attique moderne au dernier étage avec terrasse de 30 m² et vue lac. Quartier central de Lausanne, proche gare et commerces.', tags: ['Coup de cœur'],
  },
}

// ─── Stepper ───

function Stepper({ current, completed, onStepClick }: { current: number; completed: number[]; onStepClick?: (step: number) => void }) {
  return (
    <div className="flex items-center gap-6 sm:gap-8 mb-8">
      {STEPS.map((step) => {
        const isCompleted = completed.includes(step.id)
        const isCurrent = current === step.id
        return (
          <button
            key={step.id}
            type="button"
            onClick={() => onStepClick?.(step.id)}
            className={cn(
              'flex flex-col items-center gap-1.5 pb-0',
              onStepClick ? 'cursor-pointer' : 'cursor-default'
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'text-sm tabular-nums',
                isCurrent ? 'text-theme-primary font-semibold' :
                isCompleted ? 'text-theme-primary font-medium' :
                'text-theme-muted'
              )}>
                {step.id}.
              </span>
              <span className={cn(
                'text-sm whitespace-nowrap hidden sm:block',
                isCurrent ? 'text-theme-primary font-semibold' :
                isCompleted ? 'text-theme-primary font-medium' :
                'text-theme-muted'
              )}>
                {step.label}
              </span>
            </div>
            <div className={cn(
              'h-0.5 w-full rounded-full transition-colors',
              isCurrent || isCompleted ? 'bg-theme-primary' : 'bg-transparent'
            )} />
          </button>
        )
      })}
    </div>
  )
}

// ─── Field helpers ───

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-theme-primary mb-1.5">
      {children}
      {/* required indicator removed for cleaner Lovable style */}
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
  const { id } = useParams<{ id: string }>()
  const isEditMode = Boolean(id)
  const existingData = id ? MOCK_EDITABLE_LISTINGS[id] : undefined

  const [currentStep, setCurrentStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>(
    isEditMode ? [1, 2, 3, 4, 5] : []
  )

  const form = useForm<ListingFormData>({
    defaultValues: existingData ?? {
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

  // Redirect if edit mode but listing not found
  useEffect(() => {
    if (isEditMode && !existingData) {
      navigate('/dashboard/listings')
    }
  }, [isEditMode, existingData, navigate])

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
          <h1 className="text-2xl font-semibold text-theme-primary">
            {isEditMode ? 'Modifier le bien' : 'Nouveau bien'}
          </h1>
          <p className="text-sm text-theme-tertiary">
            {isEditMode ? existingData?.title ?? '' : `Étape ${currentStep} sur 5`}
          </p>
        </div>
      </div>

      {/* Stepper */}
      <Stepper
        current={currentStep}
        completed={completedSteps}
        onStepClick={isEditMode ? (step) => setCurrentStep(step) : undefined}
      />

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
              {isEditMode ? 'Enregistrer les modifications' : 'Publier l\'annonce'}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
