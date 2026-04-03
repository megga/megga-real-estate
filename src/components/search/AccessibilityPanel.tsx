import { useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface Props {
  onBack: () => void
  onApplyMaxPrice: (maxPrice: string) => void
}

// Swiss mortgage rules
const IMPUTED_RATE = 0.05 // 5% taux imputé
const AMORTIZATION = 0.01 // 1%
const MAINTENANCE = 0.01 // 1%
const TOTAL_RATE = IMPUTED_RATE + AMORTIZATION + MAINTENANCE // 7%
const MAX_RATIO = 0.33 // 33% du revenu brut
const MIN_EQUITY_PCT = 0.20 // 20% fonds propres

type ResultStatus = 'green' | 'orange' | 'red'

interface CalcResult {
  maxPrice: number
  maxChargesAnnual: number
  maxChargesMonthly: number
  requiredEquity: number
  status: ResultStatus
  statusLabel: string
}

function calculate(income: number, equity: number): CalcResult {
  const maxChargesAnnual = income * MAX_RATIO
  const maxChargesMonthly = maxChargesAnnual / 12
  const maxPriceByIncome = maxChargesAnnual / TOTAL_RATE
  const maxPriceByEquity = equity / MIN_EQUITY_PCT

  const maxPrice = Math.min(maxPriceByIncome, maxPriceByEquity)
  const requiredEquity = maxPrice * MIN_EQUITY_PCT

  let status: ResultStatus = 'green'
  let statusLabel = 'Vous pouvez acheter'

  if (equity < requiredEquity * 0.8) {
    status = 'red'
    statusLabel = 'Fonds propres insuffisants'
  } else if (equity < requiredEquity) {
    status = 'orange'
    statusLabel = 'Accessible avec conditions'
  }

  return { maxPrice, maxChargesAnnual, maxChargesMonthly, requiredEquity, status, statusLabel }
}

const STATUS_COLORS: Record<ResultStatus, { bg: string; text: string; dot: string }> = {
  green: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  orange: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  red: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
}

export default function AccessibilityPanel({ onBack, onApplyMaxPrice }: Props) {
  const [income, setIncome] = useState('')
  const [equity, setEquity] = useState('')
  const [result, setResult] = useState<CalcResult | null>(null)

  function handleCalculate() {
    const inc = Number(income.replace(/[^0-9]/g, ''))
    const eq = Number(equity.replace(/[^0-9]/g, ''))
    if (inc > 0 && eq > 0) {
      setResult(calculate(inc, eq))
    }
  }

  const colors = result ? STATUS_COLORS[result.status] : null

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-400 hover:text-gray-700 transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-bold text-gray-900">Calculateur d'accessibilité</h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-5">
        <p className="text-xs text-gray-400 mb-5">
          Basé sur les règles suisses : charges max 33% du revenu brut, fonds propres min 20%, taux de charge 7%.
        </p>

        {/* Form */}
        <div className="space-y-4 mb-5">
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">Revenu brut annuel *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">CHF</span>
              <input
                type="text"
                value={income}
                onChange={e => setIncome(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="150'000"
                className="w-full h-11 pl-11 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-900 mb-1.5">Fonds propres disponibles *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 font-medium">CHF</span>
              <input
                type="text"
                value={equity}
                onChange={e => setEquity(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="200'000"
                className="w-full h-11 pl-11 pr-3 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
          </div>

          <button
            onClick={handleCalculate}
            disabled={!income || !equity}
            className="w-full h-11 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
          >
            Calculer
          </button>
        </div>

        {/* Result */}
        {result && colors && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Status badge */}
            <div className={cn('rounded-xl p-4', colors.bg)}>
              <div className="flex items-center gap-2 mb-2">
                <span className={cn('w-2 h-2 rounded-full', colors.dot)} />
                <span className={cn('text-xs font-bold', colors.text)}>{result.statusLabel}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                {formatCHF(Math.round(result.maxPrice / 1000) * 1000)}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Prix maximum accessible</p>
            </div>

            {/* Details */}
            <div className="rounded-xl border border-gray-100 divide-y divide-gray-100">
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Charges max mensuelles</span>
                <span className="text-xs font-bold text-gray-900">{formatCHF(Math.round(result.maxChargesMonthly))}/mois</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Fonds propres requis (20%)</span>
                <span className="text-xs font-bold text-gray-900">{formatCHF(Math.round(result.requiredEquity))}</span>
              </div>
              <div className="flex justify-between px-4 py-2.5">
                <span className="text-xs text-gray-500">Charges annuelles (7%)</span>
                <span className="text-xs font-bold text-gray-900">{formatCHF(Math.round(result.maxChargesAnnual))}/an</span>
              </div>
            </div>

            {/* CTA */}
            {result.status !== 'red' && (
              <button
                onClick={() => onApplyMaxPrice(String(Math.round(result.maxPrice / 1000) * 1000))}
                className="w-full h-11 flex items-center justify-center gap-2 bg-gray-900 text-white text-sm font-bold rounded-lg hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Voir les biens dans mon budget
                <ArrowRight className="h-4 w-4" />
              </button>
            )}

            <p className="text-[10px] text-gray-300 text-center">
              Estimation indicative basée sur les règles standard suisses. Consultez votre banque pour une offre personnalisée.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
