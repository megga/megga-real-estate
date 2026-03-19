import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { formatCHF } from '@/lib/utils'
import { CANTONS } from '@/lib/constants'
import { calculateEstimation, type EstimationResult, type EstimationParams } from '@/lib/estimation'

const PROPERTY_TYPE_MAP: Record<string, EstimationParams['propertyType']> = {
  Appartement: 'apartment',
  Maison: 'house',
  Villa: 'villa',
  Terrain: 'land',
  Commercial: 'commercial',
}

const PROPERTY_TYPES = Object.keys(PROPERTY_TYPE_MAP)

const ROOM_OPTIONS = [
  '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6+',
] as const

const CONDITION_MAP: Record<string, EstimationParams['condition']> = {
  'Neuf': 'neuf',
  'Rénové récemment': 'renove',
  'Bon état': 'bon_etat',
  'À rénover': 'a_renover',
  'À restaurer': 'a_restaurer',
}

const CONDITION_OPTIONS = Object.keys(CONDITION_MAP)

const formSchema = z.object({
  propertyType: z.string().min(1, 'Champ requis'),
  address: z.string().min(1, 'Champ requis'),
  postalCode: z.string().min(4, 'Code postal invalide').max(4, 'Code postal invalide'),
  canton: z.string().min(1, 'Champ requis'),
  surface: z.string().min(1, 'Champ requis').refine(
    (v) => { const n = Number(v); return !isNaN(n) && n >= 10 },
    'Minimum 10 m²'
  ),
  rooms: z.string().optional(),
  yearBuilt: z.string().optional().refine(
    (v) => !v || (Number(v) >= 1800 && Number(v) <= 2026),
    'Année invalide'
  ),
  condition: z.string().min(1, 'Champ requis'),
})

type FormValues = z.infer<typeof formSchema>

export default function EstimationForm() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<EstimationResult | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      propertyType: '',
      address: '',
      postalCode: '',
      canton: '',
      surface: '',
      rooms: '',
      yearBuilt: '',
      condition: '',
    },
  })

  function onSubmit(data: FormValues) {
    const parsed = formSchema.safeParse(data)
    if (!parsed.success) return

    setLoading(true)
    // Petit délai pour l'UX (sensation d'analyse)
    setTimeout(() => {
      const estimation = calculateEstimation({
        canton: data.canton as EstimationParams['canton'],
        propertyType: PROPERTY_TYPE_MAP[data.propertyType],
        surface: Number(data.surface),
        condition: CONDITION_MAP[data.condition],
        rooms: data.rooms || undefined,
        yearBuilt: data.yearBuilt ? Number(data.yearBuilt) : undefined,
      })
      setResult(estimation)
      setLoading(false)
    }, 1500)
  }

  function handleReset() {
    reset()
    setResult(null)
  }

  if (result) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 animate-in fade-in duration-500">
        <div className="text-center">
          <span className="inline-block bg-accent/10 text-accent text-xs font-medium px-3 py-1 rounded-full">
            Estimation générée par IA
          </span>
          <h3 className="text-xl font-semibold text-primary-900 mt-4">
            Estimation de votre bien
          </h3>
          <p className="text-3xl font-bold text-accent mt-4">
            {formatCHF(result.low)} — {formatCHF(result.high)}
          </p>
          <p className="text-lg text-gray-600 mt-2">
            Prix estimé : {formatCHF(result.mid)}
          </p>

          {/* Confidence bar */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex items-center gap-0 h-3 rounded-full overflow-hidden">
              <div className="h-full bg-amber-300 flex-1 rounded-l-full" />
              <div className="h-full bg-accent flex-[2]" />
              <div className="h-full bg-amber-300 flex-1 rounded-r-full" />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>{formatCHF(result.low)}</span>
              <span className="font-medium text-accent">{formatCHF(result.mid)}</span>
              <span>{formatCHF(result.high)}</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-4">
            Prix au m² estimé : {formatCHF(result.pricePerM2)}/m²
          </p>

          <p className="text-sm text-gray-500 mt-2">
            Basé sur l&apos;analyse de {result.comparablesCount} transactions similaires dans votre secteur au cours des 12 derniers mois.
          </p>

          <p className="text-xs text-gray-400 mt-4 italic">
            Estimation indicative. Une analyse par un agent certifié est recommandée pour une évaluation précise.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <Link to="/onboarding/seller/individual">
              <Button className="rounded-full px-6 h-11 font-medium bg-accent hover:bg-accent/90 text-white">
                Contacter un agent
              </Button>
            </Link>
            <Button
              variant="outline"
              className="rounded-full px-6 h-11 font-medium border-gray-200 text-gray-700 hover:bg-gray-50"
              onClick={handleReset}
            >
              Nouvelle estimation
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Type de bien */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Type de bien <span className="text-red-500">*</span>
          </label>
          <select
            {...register('propertyType')}
            className={cn(
              'w-full h-11 rounded-lg border bg-white px-3 text-sm appearance-none',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              errors.propertyType ? 'border-red-300' : 'border-gray-200'
            )}
          >
            <option value="">Sélectionnez</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          {errors.propertyType && (
            <p className="text-xs text-red-500 mt-1">{errors.propertyType.message}</p>
          )}
        </div>

        {/* Adresse */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Adresse du bien <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              {...register('address')}
              placeholder="Rue, numéro, ville..."
              className={cn(
                'w-full h-11 rounded-lg border bg-white pl-9 pr-3 text-sm',
                'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
                'placeholder:text-gray-400',
                errors.address ? 'border-red-300' : 'border-gray-200'
              )}
            />
          </div>
          {errors.address && (
            <p className="text-xs text-red-500 mt-1">{errors.address.message}</p>
          )}
        </div>

        {/* Code postal + Canton */}
        <div className="md:col-span-2">
          <div className="flex gap-3">
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Code postal <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register('postalCode')}
                placeholder="1201"
                maxLength={4}
                className={cn(
                  'w-full h-11 rounded-lg border bg-white px-3 text-sm',
                  'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
                  'placeholder:text-gray-400',
                  errors.postalCode ? 'border-red-300' : 'border-gray-200'
                )}
              />
              {errors.postalCode && (
                <p className="text-xs text-red-500 mt-1">{errors.postalCode.message}</p>
              )}
            </div>
            <div className="w-2/3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Canton <span className="text-red-500">*</span>
              </label>
              <select
                {...register('canton')}
                className={cn(
                  'w-full h-11 rounded-lg border bg-white px-3 text-sm appearance-none',
                  'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
                  errors.canton ? 'border-red-300' : 'border-gray-200'
                )}
              >
                <option value="">Sélectionnez un canton</option>
                {CANTONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              {errors.canton && (
                <p className="text-xs text-red-500 mt-1">{errors.canton.message}</p>
              )}
            </div>
          </div>
        </div>

        {/* Surface */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Surface habitable (m²) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            {...register('surface')}
            placeholder="120"
            min={10}
            className={cn(
              'w-full h-11 rounded-lg border bg-white px-3 text-sm',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              'placeholder:text-gray-400',
              errors.surface ? 'border-red-300' : 'border-gray-200'
            )}
          />
          {errors.surface && (
            <p className="text-xs text-red-500 mt-1">{errors.surface.message}</p>
          )}
        </div>

        {/* Pièces */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre de pièces
          </label>
          <select
            {...register('rooms')}
            className={cn(
              'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm appearance-none',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none'
            )}
          >
            <option value="">Sélectionnez</option>
            {ROOM_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Année de construction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Année de construction
          </label>
          <input
            type="number"
            {...register('yearBuilt')}
            placeholder="ex: 1985"
            min={1800}
            max={2026}
            className={cn(
              'w-full h-11 rounded-lg border bg-white px-3 text-sm',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              'placeholder:text-gray-400',
              errors.yearBuilt ? 'border-red-300' : 'border-gray-200'
            )}
          />
          {errors.yearBuilt && (
            <p className="text-xs text-red-500 mt-1">{errors.yearBuilt.message}</p>
          )}
        </div>

        {/* État du bien */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            État du bien <span className="text-red-500">*</span>
          </label>
          <select
            {...register('condition')}
            className={cn(
              'w-full h-11 rounded-lg border bg-white px-3 text-sm appearance-none',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              errors.condition ? 'border-red-300' : 'border-gray-200'
            )}
          >
            <option value="">Sélectionnez</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {errors.condition && (
            <p className="text-xs text-red-500 mt-1">{errors.condition.message}</p>
          )}
        </div>
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-full font-medium text-lg mt-6 bg-accent hover:bg-accent/90 text-white"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Analyse en cours...
          </>
        ) : (
          'Obtenir mon estimation \u2192'
        )}
      </Button>

      <p className="text-xs text-gray-400 text-center mt-2">
        Gratuit · Sans engagement · Résultat instantané
      </p>
    </form>
  )
}
