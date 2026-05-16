// MEGGA Marketplace — Property X "Single Property — Mortgage simulator".
//
// Simulateur d'accessibilité immobilière, règles bancaires suisses (FINMA) :
//   - 20% fonds propres minimum sur le prix d'achat (dont 10% hors LPP)
//   - Charges annuelles ≤ 33% du revenu brut annuel
//   - Charges annuelles = 5% taux imputé + 1% amortissement + 1% entretien
//     = 7% du prix d'achat (règle standard banques CH)
//
// Affiché uniquement pour les listings à vendre (context === 'buy').
// Compliance-First objectif #2 : aider à évaluer le risque LAB/financement.

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PX } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { formatCHF } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  listing?: ListingCardData
}

type AffordabilityStatus = 'ok' | 'tight' | 'hard'

interface AffordabilityResult {
  status: AffordabilityStatus
  minOwnFunds: number
  mortgageAmount: number
  annualCharges: number
  monthlyCharges: number
  maxAllowedCharges: number
  chargeRatioPct: number
  fundsOk: boolean
  chargesOk: boolean
}

function computeAffordability(price: number, income: number, ownFunds: number): AffordabilityResult | null {
  if (price <= 0 || income <= 0 || ownFunds < 0) return null
  const minOwnFunds = price * 0.20
  const mortgageAmount = Math.max(0, price - ownFunds)
  const annualCharges = price * 0.07
  const monthlyCharges = annualCharges / 12
  const maxAllowedCharges = income * 0.33
  const chargeRatioPct = (annualCharges / income) * 100
  const fundsOk = ownFunds >= minOwnFunds
  const chargesOk = annualCharges <= maxAllowedCharges
  const status: AffordabilityStatus = fundsOk && chargesOk ? 'ok' : (fundsOk || chargesOk) ? 'tight' : 'hard'
  return { status, minOwnFunds, mortgageAmount, annualCharges, monthlyCharges, maxAllowedCharges, chargeRatioPct, fundsOk, chargesOk }
}

function formatCHFInput(value: string): string {
  // Format input avec apostrophe suisse pendant la saisie ("123456" → "123'456")
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

function parseCHFInput(value: string): number {
  const digits = value.replace(/\D/g, '')
  return digits ? parseInt(digits, 10) : 0
}

export default function PxSinglePropertyMortgage({ listing }: Props) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  // Ne s'affiche que pour les ventes — la calcul accessibility ne s'applique
  // pas aux locations (FINMA règle 20% / 33% est spécifique achat).
  const isSale = listing?.context !== 'rent'
  const price = listing?.price ?? 0

  // Defaults inspirés des moyennes CH : revenu brut 120K, apport 20% du prix.
  const [grossIncomeStr, setGrossIncomeStr] = useState('120\'000')
  const [ownFundsStr, setOwnFundsStr] = useState(formatCHFInput(String(Math.round(price * 0.20))))

  const result = useMemo(() => {
    const income = parseCHFInput(grossIncomeStr)
    const funds = parseCHFInput(ownFundsStr)
    return computeAffordability(price, income, funds)
  }, [price, grossIncomeStr, ownFundsStr])

  if (!listing || !isSale || price <= 0) return null

  const statusPalette: Record<AffordabilityStatus, { bg: string; fg: string; label: string }> = {
    ok: { bg: '#E6F4EA', fg: '#1F7A3F', label: t('marketplaceProperty.mortgage.statusOk') },
    tight: { bg: '#FCE8DE', fg: '#9B3A0B', label: t('marketplaceProperty.mortgage.statusTight') },
    hard: { bg: '#FCE5E5', fg: '#B3261E', label: t('marketplaceProperty.mortgage.statusHard') },
  }

  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
      paddingTop: isMobile ? 32 : 64,
      paddingBottom: isMobile ? 32 : 64,
    }}>
      <div style={{
        width: isMobile ? 'calc(100% - 32px)' : 'min(1200px, calc(100% - 48px))',
        boxSizing: 'border-box',
      }}>
        <div style={{
          background: PX.neutral100,
          borderRadius: PX.radius.large,
          boxShadow: PX.shadow.small,
          padding: isMobile ? 24 : 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 600,
              fontSize: 11,
              lineHeight: 1.4,
              letterSpacing: '1.4px',
              textTransform: 'uppercase',
              color: PX.neutral500,
            }}>
              {t('marketplaceProperty.mortgage.eyebrow')}
            </span>
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: isMobile ? 24 : 32,
              lineHeight: 1.25,
              letterSpacing: isMobile ? '-0.72px' : '-0.96px',
              color: PX.neutral700,
            }}>
              {t('marketplaceProperty.mortgage.title')}
            </h2>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 14,
              lineHeight: 1.5,
              letterSpacing: '-0.4px',
              color: PX.neutral500,
            }}>
              {t('marketplaceProperty.mortgage.subtitle')}
            </p>
          </div>

          {/* Form + result */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: isMobile ? 16 : 24,
            alignItems: 'start',
          }}>
            {/* Inputs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <CurrencyInput
                label={t('marketplaceProperty.mortgage.priceLabel')}
                value={formatCHFInput(String(price))}
                onChange={() => undefined}
                disabled
              />
              <CurrencyInput
                label={t('marketplaceProperty.mortgage.incomeLabel')}
                value={grossIncomeStr}
                onChange={(v) => setGrossIncomeStr(formatCHFInput(v))}
                hint={t('marketplaceProperty.mortgage.incomeHint')}
              />
              <CurrencyInput
                label={t('marketplaceProperty.mortgage.fundsLabel')}
                value={ownFundsStr}
                onChange={(v) => setOwnFundsStr(formatCHFInput(v))}
                hint={t('marketplaceProperty.mortgage.fundsHint', { value: formatCHF(price * 0.20) })}
              />
            </div>

            {/* Result panel */}
            {result ? (
              <div style={{
                background: PX.neutral200,
                borderRadius: PX.radius.large,
                padding: isMobile ? 20 : 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}>
                <span
                  style={{
                    alignSelf: 'flex-start',
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 6,
                    paddingBottom: 6,
                    background: statusPalette[result.status].bg,
                    color: statusPalette[result.status].fg,
                    borderRadius: PX.radius.pill,
                    fontFamily: PX.font.sans,
                    fontWeight: 600,
                    fontSize: 13,
                    lineHeight: 1.3,
                    letterSpacing: '-0.3px',
                  }}
                >
                  {statusPalette[result.status].label}
                </span>
                <ResultRow
                  label={t('marketplaceProperty.mortgage.monthlyCost')}
                  value={formatCHF(result.monthlyCharges)}
                  primary
                />
                <Divider />
                <ResultRow
                  label={t('marketplaceProperty.mortgage.mortgageAmount')}
                  value={formatCHF(result.mortgageAmount)}
                />
                <ResultRow
                  label={t('marketplaceProperty.mortgage.annualCharges')}
                  value={formatCHF(result.annualCharges)}
                />
                <ResultRow
                  label={t('marketplaceProperty.mortgage.chargeRatio')}
                  value={`${result.chargeRatioPct.toFixed(1)} %`}
                  warn={!result.chargesOk}
                />
                <ResultRow
                  label={t('marketplaceProperty.mortgage.minFunds')}
                  value={formatCHF(result.minOwnFunds)}
                  warn={!result.fundsOk}
                />
              </div>
            ) : null}
          </div>

          {/* Disclaimer */}
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 12,
            lineHeight: 1.5,
            letterSpacing: '-0.3px',
            color: PX.neutral400,
          }}>
            {t('marketplaceProperty.mortgage.disclaimer')}
          </p>
        </div>
      </div>
    </section>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────

interface CurrencyInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  disabled?: boolean
}

function CurrencyInput({ label, value, onChange, hint, disabled }: CurrencyInputProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 14,
        lineHeight: 1.3,
        letterSpacing: '-0.4px',
        color: PX.neutral700,
      }}>
        {label}
      </label>
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        background: disabled ? PX.neutral200 : PX.neutral100,
        border: `1px solid ${PX.neutral300}`,
        borderRadius: PX.radius.small,
        paddingLeft: 14,
        paddingRight: 14,
        height: 48,
      }}>
        <span style={{
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 14,
          color: PX.neutral400,
          paddingRight: 8,
        }}>
          CHF
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.3,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
            opacity: disabled ? 0.7 : 1,
          }}
        />
      </div>
      {hint ? (
        <span style={{
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 12,
          lineHeight: 1.4,
          letterSpacing: '-0.3px',
          color: PX.neutral400,
        }}>
          {hint}
        </span>
      ) : null}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: PX.neutral300, width: '100%' }} />
}

function ResultRow({ label, value, primary, warn }: { label: string; value: string; primary?: boolean; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 400,
        fontSize: 14,
        lineHeight: 1.4,
        letterSpacing: '-0.4px',
        color: PX.neutral500,
      }}>
        {label}
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: primary ? 600 : 500,
        fontSize: primary ? 22 : 14,
        lineHeight: 1.3,
        letterSpacing: primary ? '-0.66px' : '-0.4px',
        color: warn ? '#B3261E' : PX.neutral700,
        whiteSpace: 'nowrap',
      }}>
        {value}
      </span>
    </div>
  )
}
