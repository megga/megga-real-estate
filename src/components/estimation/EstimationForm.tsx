import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, MapPin } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { CANTONS } from '@/lib/constants'

const PROPERTY_TYPES = [
  'Appartement',
  'Maison',
  'Villa',
  'Terrain',
  'Commercial',
] as const

const ROOM_OPTIONS = [
  '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5', '5.5', '6+',
] as const

const CONDITION_OPTIONS = [
  'Neuf',
  'Renove recemment',
  'Bon etat',
  'A renover',
  'A restaurer',
] as const

const CONDITION_LABELS: Record<string, string> = {
  'Neuf': 'Neuf',
  'Renove recemment': 'Rénové récemment',
  'Bon etat': 'Bon état',
  'A renover': 'À rénover',
  'A restaurer': 'À restaurer',
}

interface FormData {
  propertyType: string
  address: string
  postalCode: string
  canton: string
  surface: string
  rooms: string
  yearBuilt: string
  condition: string
}

export default function EstimationForm() {
  const [form, setForm] = useState<FormData>({
    propertyType: '',
    address: '',
    postalCode: '',
    canton: '',
    surface: '',
    rooms: '',
    yearBuilt: '',
    condition: '',
  })
  const [loading, setLoading] = useState(false)
  const [showResult, setShowResult] = useState(false)

  function handleChange(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      setShowResult(true)
    }, 2000)
  }

  function handleReset() {
    setForm({
      propertyType: '',
      address: '',
      postalCode: '',
      canton: '',
      surface: '',
      rooms: '',
      yearBuilt: '',
      condition: '',
    })
    setShowResult(false)
  }

  if (showResult) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8 animate-in fade-in duration-500">
        <div className="text-center">
          <span className="inline-block bg-accent/10 text-accent text-xs font-medium px-3 py-1 rounded-full">
            Estimation generee par IA
          </span>
          <h3 className="text-xl font-semibold text-primary-900 mt-4">
            Estimation de votre bien
          </h3>
          <p className="text-3xl font-bold text-accent mt-4">
            CHF 680&apos;000 — CHF 750&apos;000
          </p>
          <p className="text-lg text-gray-600 mt-2">
            Prix estime : CHF 715&apos;000
          </p>

          {/* Confidence bar */}
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex items-center gap-0 h-3 rounded-full overflow-hidden">
              <div className="h-full bg-amber-300 flex-1 rounded-l-full" />
              <div className="h-full bg-accent flex-[2]" />
              <div className="h-full bg-amber-300 flex-1 rounded-r-full" />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1.5">
              <span>CHF 680&apos;000</span>
              <span className="font-medium text-accent">CHF 715&apos;000</span>
              <span>CHF 750&apos;000</span>
            </div>
          </div>

          <p className="text-sm text-gray-500 mt-6">
            Base sur l&apos;analyse de 47 transactions similaires dans votre secteur au cours des 12 derniers mois.
          </p>

          <p className="text-xs text-gray-400 mt-4 italic">
            Estimation indicative. Une analyse par un agent certifie est recommandee pour une evaluation precise.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
            <Link to="/login">
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
      onSubmit={handleSubmit}
      className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8"
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Type de bien */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Type de bien
          </label>
          <select
            value={form.propertyType}
            onChange={(e) => handleChange('propertyType', e.target.value)}
            required
            className={cn(
              'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              'appearance-none'
            )}
          >
            <option value="">Selectionnez</option>
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Adresse */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Adresse du bien
          </label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Rue, numero, ville..."
              required
              className={cn(
                'w-full h-11 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-sm',
                'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
                'placeholder:text-gray-400'
              )}
            />
          </div>
        </div>

        {/* Code postal + Canton */}
        <div className="md:col-span-2">
          <div className="flex gap-3">
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Code postal
              </label>
              <input
                type="text"
                value={form.postalCode}
                onChange={(e) => handleChange('postalCode', e.target.value)}
                placeholder="1201"
                required
                className={cn(
                  'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm',
                  'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
                  'placeholder:text-gray-400'
                )}
              />
            </div>
            <div className="w-2/3">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Canton
              </label>
              <select
                value={form.canton}
                onChange={(e) => handleChange('canton', e.target.value)}
                required
                className={cn(
                  'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm',
                  'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
                  'appearance-none'
                )}
              >
                <option value="">Selectionnez un canton</option>
                {CANTONS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Surface */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Surface habitable (m²)
          </label>
          <input
            type="number"
            value={form.surface}
            onChange={(e) => handleChange('surface', e.target.value)}
            placeholder="120"
            required
            min={1}
            className={cn(
              'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              'placeholder:text-gray-400'
            )}
          />
        </div>

        {/* Pieces */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nombre de pieces
          </label>
          <select
            value={form.rooms}
            onChange={(e) => handleChange('rooms', e.target.value)}
            required
            className={cn(
              'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              'appearance-none'
            )}
          >
            <option value="">Selectionnez</option>
            {ROOM_OPTIONS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Annee de construction */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Annee de construction
          </label>
          <input
            type="number"
            value={form.yearBuilt}
            onChange={(e) => handleChange('yearBuilt', e.target.value)}
            placeholder="ex: 1985"
            min={1800}
            max={2026}
            className={cn(
              'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              'placeholder:text-gray-400'
            )}
          />
        </div>

        {/* Etat du bien */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Etat du bien
          </label>
          <select
            value={form.condition}
            onChange={(e) => handleChange('condition', e.target.value)}
            required
            className={cn(
              'w-full h-11 rounded-lg border border-gray-200 bg-white px-3 text-sm',
              'focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
              'appearance-none'
            )}
          >
            <option value="">Selectionnez</option>
            {CONDITION_OPTIONS.map((c) => (
              <option key={c} value={c}>{CONDITION_LABELS[c]}</option>
            ))}
          </select>
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
        Gratuit · Sans engagement · Resultat instantane
      </p>
    </form>
  )
}
