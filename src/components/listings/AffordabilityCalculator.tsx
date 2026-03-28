import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'

interface AffordabilityCalculatorProps {
  price: number
  open: boolean
  onClose: () => void
}

/**
 * Calculateur d'accessibilité suisse
 * Règle bancaire : charges annuelles (taux imputé 5% + amortissement 1% + entretien 1% = 7% du prix)
 * ne doivent pas dépasser 33% du revenu brut annuel.
 * Fonds propres minimum : 20% du prix d'achat.
 */
export default function AffordabilityCalculator({ price, open, onClose }: AffordabilityCalculatorProps) {
  const [grossIncome, setGrossIncome] = useState('')
  const [ownFunds, setOwnFunds] = useState('')

  const result = useMemo(() => {
    const income = Number(grossIncome) || 0
    const funds = Number(ownFunds) || 0
    if (income <= 0 || funds <= 0) return null

    const minOwnFunds = price * 0.2
    const mortgage = price - funds
    const annualCharges = price * 0.07 // 5% taux imputé + 1% amortissement + 1% entretien
    const maxAllowedCharges = income * 0.33
    const chargeRatio = income > 0 ? (annualCharges / income) * 100 : 0

    const fundsOk = funds >= minOwnFunds
    const chargesOk = annualCharges <= maxAllowedCharges

    const status: 'green' | 'orange' | 'red' =
      fundsOk && chargesOk ? 'green' :
      (fundsOk || chargesOk) ? 'orange' : 'red'

    const statusLabel =
      status === 'green' ? 'Accessible' :
      status === 'orange' ? 'Limite' : 'Difficile'

    const maxAffordablePrice = income > 0 ? Math.floor((income * 0.33) / 0.07) : 0

    return {
      minOwnFunds,
      mortgage,
      annualCharges,
      monthlyCharges: annualCharges / 12,
      maxAllowedCharges,
      chargeRatio,
      fundsOk,
      chargesOk,
      status,
      statusLabel,
      maxAffordablePrice,
    }
  }, [grossIncome, ownFunds, price])

  if (!open) return null

  const statusColors = {
    green: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    orange: 'text-amber-600 bg-amber-50 border-amber-200',
    red: 'text-red-600 bg-red-50 border-red-200',
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-xl border border-gray-100 shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Puis-je acheter ce bien ?</h3>
            <p className="text-sm text-gray-500 mt-0.5">Bien a {formatCHF(price)}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4 text-gray-500" />
          </button>
        </div>

        {/* Inputs */}
        <div className="p-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Revenu brut annuel (CHF)</label>
            <input
              type="number"
              value={grossIncome}
              onChange={(e) => setGrossIncome(e.target.value)}
              placeholder="Ex: 150000"
              className="mt-1 w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Fonds propres disponibles (CHF)</label>
            <input
              type="number"
              value={ownFunds}
              onChange={(e) => setOwnFunds(e.target.value)}
              placeholder="Ex: 200000"
              className="mt-1 w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          {/* Result */}
          {result && (
            <div className="space-y-3 pt-2">
              {/* Status badge */}
              <div className={cn('flex items-center justify-between p-3 rounded-lg border', statusColors[result.status])}>
                <span className="text-sm font-semibold">{result.statusLabel}</span>
                <span className="text-sm">{Math.round(result.chargeRatio)}% du revenu</span>
              </div>

              {/* Details */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Fonds propres requis (20%)</span>
                  <span className={cn('font-medium', result.fundsOk ? 'text-emerald-600' : 'text-red-600')}>
                    {formatCHF(result.minOwnFunds)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Vos fonds propres</span>
                  <span className="font-medium text-gray-900">{formatCHF(Number(ownFunds) || 0)}</span>
                </div>

                <div className="border-t border-gray-100 pt-2" />

                <div className="flex justify-between">
                  <span className="text-gray-500">Hypotheque estimee</span>
                  <span className="font-medium text-gray-900">{formatCHF(Math.max(0, result.mortgage))}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Charges mensuelles estimees</span>
                  <span className={cn('font-medium', result.chargesOk ? 'text-emerald-600' : 'text-red-600')}>
                    {formatCHF(Math.round(result.monthlyCharges))}/mois
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Seuil max (33% revenu)</span>
                  <span className="font-medium text-gray-900">{formatCHF(Math.round(result.maxAllowedCharges / 12))}/mois</span>
                </div>

                {result.maxAffordablePrice > 0 && result.status !== 'green' && (
                  <>
                    <div className="border-t border-gray-100 pt-2" />
                    <div className="flex justify-between">
                      <span className="text-gray-500">Prix max accessible</span>
                      <span className="font-medium text-accent">{formatCHF(result.maxAffordablePrice)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Disclaimer */}
              <p className="text-[11px] text-gray-400 pt-1">
                Estimation indicative basee sur le taux impute de 5%, amortissement 1%, entretien 1%. Les conditions effectives dependent de votre banque.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
