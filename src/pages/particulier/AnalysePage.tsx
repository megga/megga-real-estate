import { cn } from '@/lib/utils'
import { MOCK_SELLER_DATA } from '@/lib/mockSellerData'
import { TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────

interface Comparable {
  id: string
  address: string
  city: string
  price: number
  surface_m2: number
  rooms: number
  sold_at: string
  days_on_market: number
}

interface WeekActivity {
  week: string
  visits: number
  views: number
}

// ── Mock data ────────────────────────────────────────────────────────────

const COMPARABLES: Comparable[] = [
  {
    id: 'c1',
    address: 'Rue du Rhône 42',
    city: 'Genève',
    price: 1920000,
    surface_m2: 155,
    rooms: 5,
    sold_at: '2026-02-28T00:00:00Z',
    days_on_market: 38,
  },
  {
    id: 'c2',
    address: 'Quai des Bergues 8',
    city: 'Genève',
    price: 1750000,
    surface_m2: 130,
    rooms: 4.5,
    sold_at: '2026-01-15T00:00:00Z',
    days_on_market: 52,
  },
  {
    id: 'c3',
    address: 'Bd des Philosophes 22',
    city: 'Genève',
    price: 1680000,
    surface_m2: 140,
    rooms: 5,
    sold_at: '2026-03-05T00:00:00Z',
    days_on_market: 29,
  },
  {
    id: 'c4',
    address: 'Rue de la Terrassière 15',
    city: 'Genève',
    price: 2100000,
    surface_m2: 165,
    rooms: 5.5,
    sold_at: '2025-12-20T00:00:00Z',
    days_on_market: 67,
  },
]

const WEEKLY_ACTIVITY: WeekActivity[] = [
  { week: 'S1', visits: 2, views: 45 },
  { week: 'S2', visits: 3, views: 68 },
  { week: 'S3', visits: 1, views: 52 },
  { week: 'S4', visits: 2, views: 71 },
  { week: 'S5', visits: 0, views: 38 },
  { week: 'S6', visits: 3, views: 89 },
]

const MARKET_STATS = {
  avg_price_m2_quartier: 12400,
  avg_days_on_market: 45,
  median_price_5p: 1820000,
  transaction_volume_trend: 'stable' as const,
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCHF(amount: number): string {
  return `CHF ${amount.toLocaleString('fr-CH').replace(/,/g, "'")}`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Components ───────────────────────────────────────────────────────────

function StatCard({ label, value, subtitle, trend }: {
  label: string
  value: string
  subtitle?: string
  trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <div className="rounded-xl border border-theme-border p-4">
      <p className="text-[10px] text-theme-muted uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className="text-xl font-bold text-theme-primary">{value}</p>
        {trend && (
          trend === 'up' ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
          trend === 'down' ? <TrendingDown className="w-4 h-4 text-red-500" /> :
          <Minus className="w-4 h-4 text-theme-muted" />
        )}
      </div>
      {subtitle && <p className="text-xs text-theme-tertiary mt-0.5">{subtitle}</p>}
    </div>
  )
}

function ActivityBar({ data, maxVisits }: { data: WeekActivity; maxVisits: number }) {
  const height = maxVisits > 0 ? (data.visits / maxVisits) * 100 : 0
  return (
    <div className="flex flex-col items-center gap-1 flex-1">
      <div className="w-full h-20 flex items-end justify-center">
        <div
          className={cn(
            'w-6 rounded-t transition-all duration-500',
            data.visits > 0 ? 'bg-accent/60' : 'bg-theme-hover'
          )}
          style={{ height: `${Math.max(height, 8)}%` }}
        />
      </div>
      <span className="text-[10px] text-theme-muted">{data.week}</span>
      <span className="text-[10px] font-medium text-theme-tertiary">{data.visits}</span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────

export default function AnalysePage() {
  const { property, kpis } = MOCK_SELLER_DATA

  const pricePerM2 = Math.round(property.price / property.surface_m2)
  const diffVsMarket = ((pricePerM2 - MARKET_STATS.avg_price_m2_quartier) / MARKET_STATS.avg_price_m2_quartier * 100).toFixed(1)
  const isAboveMarket = pricePerM2 > MARKET_STATS.avg_price_m2_quartier
  const diffVsMedian = ((property.price - MARKET_STATS.median_price_5p) / MARKET_STATS.median_price_5p * 100).toFixed(1)

  const avgComparablePriceM2 = Math.round(
    COMPARABLES.reduce((sum, c) => sum + c.price / c.surface_m2, 0) / COMPARABLES.length
  )
  const avgComparableDays = Math.round(
    COMPARABLES.reduce((sum, c) => sum + c.days_on_market, 0) / COMPARABLES.length
  )

  const maxWeeklyVisits = Math.max(...WEEKLY_ACTIVITY.map(w => w.visits))
  const totalViews = WEEKLY_ACTIVITY.reduce((sum, w) => sum + w.views, 0)

  // Stagnation risk
  const stagnationRisk = kpis.days_on_market > 60 ? 'high' : kpis.days_on_market > 40 ? 'moderate' : 'low'

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-theme-primary">Analyse du marché</h1>
        <p className="text-sm text-theme-secondary mt-1">
          Positionnement de votre bien sur le marché genevois
        </p>
      </div>

      {/* KPIs row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Prix / m²"
          value={`CHF ${pricePerM2.toLocaleString('fr-CH')}`}
          subtitle={`${isAboveMarket ? '+' : ''}${diffVsMarket}% vs quartier`}
          trend={isAboveMarket ? 'up' : 'down'}
        />
        <StatCard
          label="Moyenne quartier"
          value={`CHF ${MARKET_STATS.avg_price_m2_quartier.toLocaleString('fr-CH')}`}
          subtitle="par m² · Genève centre"
        />
        <StatCard
          label="Jours en vente"
          value={String(kpis.days_on_market)}
          subtitle={`Moyenne : ${MARKET_STATS.avg_days_on_market} jours`}
          trend={kpis.days_on_market > MARKET_STATS.avg_days_on_market ? 'down' : 'up'}
        />
        <StatCard
          label="Vues en ligne"
          value={String(totalViews)}
          subtitle={`${kpis.visits_total} visites physiques`}
          trend="up"
        />
      </div>

      {/* Price positioning */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-4">Positionnement prix</h2>

        {/* Visual scale */}
        <div className="relative h-12 mb-6">
          {/* Scale bar */}
          <div className="absolute top-4 left-0 right-0 h-2 rounded-full bg-theme-hover" />

          {/* Market average marker */}
          <div className="absolute top-4" style={{ left: '50%', transform: 'translateX(-50%)' }}>
            <div className="h-2 w-0.5 bg-theme-tertiary" />
            <p className="text-[9px] text-theme-muted mt-1 whitespace-nowrap -translate-x-1/2 absolute left-1/2">
              Moyenne marché
            </p>
          </div>

          {/* Your price marker */}
          <div
            className="absolute top-1.5"
            style={{ left: `${Math.min(80, Math.max(20, 50 + parseFloat(diffVsMarket) * 2))}%`, transform: 'translateX(-50%)' }}
          >
            <div className="h-5 w-5 rounded-full bg-accent flex items-center justify-center">
              <div className="h-2 w-2 rounded-full bg-white" />
            </div>
            <p className="text-[9px] font-medium text-accent mt-1 whitespace-nowrap -translate-x-1/2 absolute left-1/2">
              Votre bien
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 pt-2 border-t border-theme-border-subtle">
          <div>
            <p className="text-xs text-theme-muted mb-0.5">Votre prix / m²</p>
            <p className="text-sm font-semibold text-theme-primary">CHF {pricePerM2.toLocaleString('fr-CH')}</p>
          </div>
          <div>
            <p className="text-xs text-theme-muted mb-0.5">vs médiane 5 pièces</p>
            <p className={cn('text-sm font-semibold', parseFloat(diffVsMedian) > 0 ? 'text-amber-500' : 'text-emerald-500')}>
              {parseFloat(diffVsMedian) > 0 ? '+' : ''}{diffVsMedian}% ({formatCHF(MARKET_STATS.median_price_5p)})
            </p>
          </div>
        </div>
      </div>

      {/* Stagnation indicator */}
      <div className={cn(
        'rounded-xl border p-4 flex items-center gap-3',
        stagnationRisk === 'low' ? 'border-emerald-500/20 bg-emerald-500/5' :
        stagnationRisk === 'moderate' ? 'border-amber-500/20 bg-amber-500/5' :
        'border-red-500/20 bg-red-500/5'
      )}>
        <span className={cn(
          'w-3 h-3 rounded-full shrink-0',
          stagnationRisk === 'low' ? 'bg-emerald-500' :
          stagnationRisk === 'moderate' ? 'bg-amber-500' : 'bg-red-500'
        )} />
        <div>
          <p className="text-sm font-medium text-theme-primary">
            {stagnationRisk === 'low' ? 'Dynamique positive' :
             stagnationRisk === 'moderate' ? 'Attention — dynamique ralentie' :
             'Risque de stagnation détecté'}
          </p>
          <p className="text-xs text-theme-secondary mt-0.5">
            {stagnationRisk === 'low'
              ? `${kpis.days_on_market} jours en vente — en dessous de la moyenne du quartier (${MARKET_STATS.avg_days_on_market}j). L'intérêt pour votre bien est soutenu.`
              : stagnationRisk === 'moderate'
              ? `${kpis.days_on_market} jours en vente — proche de la moyenne du quartier. Continuons à surveiller l'évolution.`
              : `${kpis.days_on_market} jours en vente — au-dessus de la moyenne du quartier (${MARKET_STATS.avg_days_on_market}j). Une révision du prix pourrait être envisagée.`
            }
          </p>
        </div>
      </div>

      {/* Weekly activity chart */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-sm font-semibold text-theme-primary mb-1">Activité par semaine</h2>
        <p className="text-xs text-theme-tertiary mb-4">Nombre de visites physiques</p>

        <div className="flex items-end gap-1">
          {WEEKLY_ACTIVITY.map((week) => (
            <ActivityBar key={week.week} data={week} maxVisits={maxWeeklyVisits} />
          ))}
        </div>
      </div>

      {/* Comparables */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-theme-primary">Biens comparables vendus</h2>
            <p className="text-xs text-theme-tertiary mt-0.5">
              Appartements 4-6 pièces vendus récemment à Genève
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-theme-muted">Prix moyen / m²</p>
            <p className="text-sm font-bold text-theme-primary">CHF {avgComparablePriceM2.toLocaleString('fr-CH')}</p>
          </div>
        </div>

        <div className="space-y-2">
          {COMPARABLES.map(comp => {
            const compPriceM2 = Math.round(comp.price / comp.surface_m2)
            const vsYours = ((compPriceM2 - pricePerM2) / pricePerM2 * 100).toFixed(1)

            return (
              <div key={comp.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-theme-hover transition-colors">
                {/* Address */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">{comp.address}</p>
                  <p className="text-[10px] text-theme-muted">
                    {comp.rooms} pièces · {comp.surface_m2} m² · Vendu le {formatDate(comp.sold_at)}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-theme-primary">{formatCHF(comp.price)}</p>
                  <p className="text-[10px] text-theme-muted">
                    CHF {compPriceM2.toLocaleString('fr-CH')}/m²
                  </p>
                </div>

                {/* Comparison */}
                <div className="w-16 text-right shrink-0">
                  <p className={cn(
                    'text-xs font-medium',
                    parseFloat(vsYours) > 0 ? 'text-emerald-500' : 'text-red-500'
                  )}>
                    {parseFloat(vsYours) > 0 ? '+' : ''}{vsYours}%
                  </p>
                  <p className="text-[9px] text-theme-muted">{comp.days_on_market}j</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-4 pt-3 border-t border-theme-border-subtle flex items-center gap-2">
          <ArrowRight className="w-3.5 h-3.5 text-theme-tertiary shrink-0" />
          <p className="text-xs text-theme-secondary">
            Délai moyen de vente des comparables : <span className="font-medium text-theme-primary">{avgComparableDays} jours</span>
            {' '}— vous êtes à {kpis.days_on_market} jours.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-[10px] text-theme-muted text-center pt-2">
        Données indicatives basées sur les transactions récentes du secteur. Ne constitue pas une estimation certifiée.
      </p>
    </div>
  )
}
