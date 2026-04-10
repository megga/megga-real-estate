import { cn } from '@/lib/utils'
import { ArrowRight, Printer } from 'lucide-react'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40'

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
  label: string
  visits: number
  views: number
}

// ── Mock data ────────────────────────────────────────────────────────────

const COMPARABLES: Comparable[] = [
  { id: 'c1', address: 'Rue du Rhône 42', city: 'Genève', price: 1920000, surface_m2: 155, rooms: 5, sold_at: '2026-02-28T00:00:00Z', days_on_market: 38 },
  { id: 'c2', address: 'Quai des Bergues 8', city: 'Genève', price: 1750000, surface_m2: 130, rooms: 4.5, sold_at: '2026-01-15T00:00:00Z', days_on_market: 52 },
  { id: 'c3', address: 'Bd des Philosophes 22', city: 'Genève', price: 1680000, surface_m2: 140, rooms: 5, sold_at: '2026-03-05T00:00:00Z', days_on_market: 29 },
  { id: 'c4', address: 'Rue de la Terrassière 15', city: 'Genève', price: 2100000, surface_m2: 165, rooms: 5.5, sold_at: '2025-12-20T00:00:00Z', days_on_market: 67 },
]

const WEEKLY_ACTIVITY: WeekActivity[] = [
  { week: 'S1', label: '10–16 fév.', visits: 2, views: 45 },
  { week: 'S2', label: '17–23 fév.', visits: 3, views: 68 },
  { week: 'S3', label: '24 fév.–2 mars', visits: 1, views: 52 },
  { week: 'S4', label: '3–9 mars', visits: 2, views: 71 },
  { week: 'S5', label: '10–16 mars', visits: 0, views: 38 },
  { week: 'S6', label: '17–22 mars', visits: 3, views: 89 },
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

function StatCard({ label, value, subtitle }: {
  label: string
  value: string
  subtitle?: string
}) {
  return (
    <div className="rounded-xl border border-theme-border p-4">
      <p className="text-xs text-theme-muted capitalize mb-1">{label}</p>
      <p className="text-xl font-bold text-theme-primary">{value}</p>
      {subtitle && <p className="text-xs text-theme-tertiary mt-0.5">{subtitle}</p>}
    </div>
  )
}

function ActivityBar({ data, maxVisits }: { data: WeekActivity; maxVisits: number }) {
  const height = maxVisits > 0 ? (data.visits / maxVisits) * 100 : 0
  return (
    <div className="flex flex-col items-center gap-1 flex-1 group">
      <div className="w-full h-20 flex items-end justify-center">
        <div
          className={cn(
            'w-6 rounded-t transition-all duration-500',
            data.visits > 0 ? 'bg-theme-primary/60' : 'bg-theme-hover'
          )}
          style={{ height: `${Math.max(height, 8)}%` }}
        />
      </div>
      <span className="text-xs text-theme-muted">{data.week}</span>
      <span className="text-xs font-medium text-theme-tertiary">{data.visits}</span>
      {/* Tooltip with date range */}
      <span className="absolute -bottom-5 text-xs text-theme-muted opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
        {data.label}
      </span>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────

export default function AnalysePage() {
  const { property, kpis } = useSellerPortalData()

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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Analyse du marché</h1>
          <p className="text-sm text-theme-secondary mt-1">
            Positionnement de votre bien sur le marché genevois
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className={cn('h-8 px-3 rounded-lg text-xs font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-1.5 shrink-0 print:hidden', FOCUS_RING)}
        >
          <Printer className="w-3 h-3" />
          Imprimer / PDF
        </button>
      </div>

      {/* KPIs row — monochrome, no trend icons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Prix / m²"
          value={`CHF ${pricePerM2.toLocaleString('fr-CH')}`}
          subtitle={`${isAboveMarket ? '+' : ''}${diffVsMarket}% vs quartier`}
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
        />
        <StatCard
          label="Vues en ligne"
          value={String(totalViews)}
          subtitle={`${kpis.visits_total} visites physiques`}
        />
      </div>

      {/* Price positioning — simplified, no scale widget */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-xs text-theme-muted capitalize mb-4">Positionnement prix</h2>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs text-theme-muted mb-1">Votre prix / m²</p>
            <p className="text-lg font-semibold text-theme-primary">CHF {pricePerM2.toLocaleString('fr-CH')}</p>
            <p className="text-xs text-theme-tertiary mt-0.5">
              {isAboveMarket ? '+' : ''}{diffVsMarket}% vs moyenne quartier
            </p>
          </div>
          <div>
            <p className="text-xs text-theme-muted mb-1">Médiane 5 pièces à Genève</p>
            <p className="text-lg font-semibold text-theme-primary">{formatCHF(MARKET_STATS.median_price_5p)}</p>
            <p className="text-xs text-theme-tertiary mt-0.5">
              Votre bien : {parseFloat(diffVsMedian) > 0 ? '+' : ''}{diffVsMedian}% vs médiane
            </p>
          </div>
        </div>

        {/* Simple bar comparison */}
        <div className="mt-5 pt-4 border-t border-theme-border-subtle space-y-2.5">
          <div className="flex items-center gap-3">
            <span className="text-xs text-theme-muted w-20 shrink-0">Votre bien</span>
            <div className="flex-1 h-2 rounded-full bg-theme-hover overflow-hidden">
              <div
                className="h-full rounded-full bg-theme-primary transition-all duration-500"
                style={{ width: `${Math.min(100, (pricePerM2 / (MARKET_STATS.avg_price_m2_quartier * 1.3)) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-theme-primary w-20 text-right">CHF {pricePerM2.toLocaleString('fr-CH')}</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-theme-muted w-20 shrink-0">Moy. quartier</span>
            <div className="flex-1 h-2 rounded-full bg-theme-hover overflow-hidden">
              <div
                className="h-full rounded-full bg-theme-primary/40 transition-all duration-500"
                style={{ width: `${Math.min(100, (MARKET_STATS.avg_price_m2_quartier / (MARKET_STATS.avg_price_m2_quartier * 1.3)) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-theme-muted w-20 text-right">CHF {MARKET_STATS.avg_price_m2_quartier.toLocaleString('fr-CH')}</span>
          </div>
        </div>
      </div>

      {/* Stagnation indicator — monochrome border, only dot has color */}
      <div className="rounded-xl border border-theme-border p-4 flex items-center gap-3">
        <span className={cn(
          'w-2.5 h-2.5 rounded-full shrink-0',
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

      {/* Weekly activity chart — monochrome bars, date labels */}
      <div className="rounded-xl border border-theme-border p-5">
        <h2 className="text-xs text-theme-muted capitalize mb-1">Activité par semaine</h2>
        <p className="text-xs text-theme-tertiary mb-4">Visites physiques · 6 dernières semaines</p>

        <div className="flex items-end gap-1 relative pb-2">
          {WEEKLY_ACTIVITY.map((week) => (
            <ActivityBar key={week.week} data={week} maxVisits={maxWeeklyVisits} />
          ))}
        </div>
      </div>

      {/* Comparables — monochrome percentages, separators */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs text-theme-muted capitalize">Biens comparables vendus</h2>
            <p className="text-xs text-theme-tertiary mt-0.5">
              Appartements 4-6 pièces vendus récemment à Genève
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-theme-muted">Prix moyen / m²</p>
            <p className="text-sm font-bold text-theme-primary">CHF {avgComparablePriceM2.toLocaleString('fr-CH')}</p>
          </div>
        </div>

        <div className="space-y-0">
          {COMPARABLES.map((comp, i) => {
            const compPriceM2 = Math.round(comp.price / comp.surface_m2)
            const vsYours = ((compPriceM2 - pricePerM2) / pricePerM2 * 100).toFixed(1)

            return (
              <div key={comp.id} className={cn(
                'flex items-center gap-3 py-3',
                i < COMPARABLES.length - 1 && 'border-b border-theme-border-subtle'
              )}>
                {/* Address */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">{comp.address}</p>
                  <p className="text-xs text-theme-muted">
                    {comp.rooms} pièces · {comp.surface_m2} m² · Vendu le {formatDate(comp.sold_at)}
                  </p>
                </div>

                {/* Price */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-theme-primary">{formatCHF(comp.price)}</p>
                  <p className="text-xs text-theme-muted">
                    CHF {compPriceM2.toLocaleString('fr-CH')}/m²
                  </p>
                </div>

                {/* Comparison — monochrome */}
                <div className="w-16 text-right shrink-0">
                  <p className="text-xs font-medium text-theme-secondary">
                    {parseFloat(vsYours) > 0 ? '+' : ''}{vsYours}%
                  </p>
                  <p className="text-xs text-theme-muted">{comp.days_on_market}j</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Summary */}
        <div className="mt-3 pt-3 border-t border-theme-border-subtle flex items-center gap-2">
          <ArrowRight className="w-3.5 h-3.5 text-theme-tertiary shrink-0" />
          <p className="text-xs text-theme-secondary">
            Délai moyen de vente des comparables : <span className="font-medium text-theme-primary">{avgComparableDays} jours</span>
            {' '}— vous êtes à {kpis.days_on_market} jours.
          </p>
        </div>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-theme-muted text-center pt-2">
        Données indicatives basées sur les transactions récentes du secteur. Ne constitue pas une estimation certifiée.
      </p>
    </div>
  )
}
