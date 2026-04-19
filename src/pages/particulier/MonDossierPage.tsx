import { useState } from 'react'
import {
  Eye, CalendarDays, HandCoins, Clock,
  Mail, Check, ChevronDown, HelpCircle,
  FileText, ArrowRight, ShieldCheck, TrendingUp, TrendingDown,
  MapPin, BedDouble, Maximize2, Home,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MANDATE_STEPS, getStepIndex } from '@/lib/mockSellerData'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

// ─────────────────────────────────────────────────────────────────────────
// MON DOSSIER — Acreon direction (experimental)
// ─────────────────────────────────────────────────────────────────────────
// Tonal shift from the monochrome SaaS light baseline to a warmer, more
// confident dashboard vocabulary inspired by Gravix/Acreon: electric-blue
// primary, soft pastel squircles on KPIs, area chart with gradient +
// floating black tooltip, expressive hover shadows.
//
// Scoped to this page via Manrope font loaded in index.html; other pages
// stay on DM Sans until we validate the direction.
// ─────────────────────────────────────────────────────────────────────────

const FONT = 'font-["Manrope"]'
const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2F6BFF]/30'

const tokens = {
  bg: '#F5F6F8',
  card: '#FFFFFF',
  ink: '#0B1220',
  muted: '#6B7280',
  dim: '#9CA3AF',
  line: '#EEF0F3',
  primary: '#2F6BFF',
  primarySoft: '#E8EFFF',
  mint: '#10B981',
  mintSoft: '#E6F7F1',
  coral: '#F97066',
  coralSoft: '#FEE9E7',
  amber: '#F59E0B',
  amberSoft: '#FEF3D7',
  lilac: '#A78BFA',
  lilacSoft: '#EFEAFE',
} as const

// Soft, two-layer elevation — used on all surface cards. Tier-2 on hover.
const CARD_SHADOW = 'shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_24px_-12px_rgba(15,23,42,0.06)]'
const CARD_SHADOW_HOVER = 'hover:shadow-[0_1px_0_rgba(15,23,42,0.03),0_16px_40px_-16px_rgba(15,23,42,0.12)]'

const CARD = cn(
  'rounded-2xl bg-white border border-[color:#EEF0F3] transition-all duration-200',
  CARD_SHADOW,
)

// ─── Pipeline step explanations ──────────────────────────────────────────

const STEP_HELP: Record<string, string> = {
  mandate_signed: 'Le mandat de vente est signé entre vous et votre agent. Il définit les conditions de mise en vente.',
  published: 'Votre bien est publié sur les portails immobiliers et visible par les acheteurs potentiels.',
  visits: 'Les visites sont organisées par votre agent. Vous recevez les retours des acquéreurs.',
  offers: "Des offres d'achat sont en cours de réception ou d'analyse par votre agent.",
  negotiation: "Votre agent négocie les conditions de vente avec l'acquéreur retenu.",
  notary: "Le dossier est transmis au notaire pour la préparation de l'acte de vente.",
  sold: "La vente est finalisée. L'acte est signé chez le notaire.",
}

type ActivityFilter = 'all' | 'visits' | 'offers' | 'documents'

const ACTIVITY_FILTERS: { key: ActivityFilter; label: string }[] = [
  { key: 'all', label: 'Tout' },
  { key: 'visits', label: 'Visites' },
  { key: 'offers', label: 'Offres' },
  { key: 'documents', label: 'Documents' },
]

const FILTER_TYPES: Record<ActivityFilter, string[]> = {
  all: [],
  visits: ['visit_planned', 'visit_done'],
  offers: ['offer_received'],
  documents: ['document_added', 'publication', 'mandate_signed'],
}

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  visit_planned: CalendarDays,
  visit_done: Eye,
  offer_received: HandCoins,
  document_added: Check,
  publication: Check,
  mandate_signed: Check,
  message: Mail,
  price_update: Clock,
}

// ─── Notifications helper ────────────────────────────────────────────────

interface Notification {
  id: string
  label: string
  description: string
  link: string
  linkLabel: string
  isNew: boolean
  tone: 'primary' | 'mint' | 'coral' | 'amber'
}

function getNotifications(
  visits: { status: string; date: string }[],
  offers: { status: string; amount: number }[],
): Notification[] {
  const notifs: Notification[] = []
  const upcoming = visits.filter((v) => v.status === 'planned' || v.status === 'confirmed')
  if (upcoming.length > 0) {
    const d = new Date(upcoming[0].date)
    notifs.push({
      id: 'visit-upcoming',
      label: 'Visite à venir',
      description: `Le ${d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long' })} à ${d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })}`,
      link: '/portail/visites',
      linkLabel: 'Voir',
      isNew: true,
      tone: 'primary',
    })
  }
  const activeOffers = offers.filter((o) => o.status === 'pending' || o.status === 'counter_offer')
  if (activeOffers.length > 0) {
    notifs.push({
      id: 'offers-active',
      label: `${activeOffers.length} offre${activeOffers.length > 1 ? 's' : ''} en cours`,
      description: `Meilleure : CHF ${Math.max(...activeOffers.map((o) => o.amount)).toLocaleString('fr-CH').replace(/,/g, "'")}`,
      link: '/portail/offres',
      linkLabel: 'Voir',
      isNew: true,
      tone: 'mint',
    })
  }
  notifs.push({
    id: 'docs-missing',
    label: '2 documents manquants',
    description: 'Diagnostic amiante et certificat CECB à fournir',
    link: '/portail/documents',
    linkLabel: 'Voir',
    isNew: false,
    tone: 'coral',
  })
  return notifs
}

// ─── Views 30d mock series ───────────────────────────────────────────────
// Smoothly-growing dataset — feels like a live signal rather than noise.

function buildViewSeries(total: number) {
  const out: { date: string; label: string; views: number; visits: number }[] = []
  const today = new Date()
  let cum = 0
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const base = Math.round(total / 30 + Math.sin(i * 0.7) * 4 + (Math.random() * 6 - 3))
    const views = Math.max(0, base)
    cum += views
    out.push({
      date: d.toISOString(),
      label: d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }),
      views,
      visits: i % 4 === 0 ? 1 : 0,
    })
  }
  // force a nice upward swing at the end
  out[out.length - 1].views = Math.round(out[out.length - 1].views * 1.6)
  return out
}

// ─── Squircle component (category icon tile) ─────────────────────────────

function Squircle({
  tone,
  icon: Icon,
  size = 'md',
}: {
  tone: 'primary' | 'mint' | 'coral' | 'amber' | 'lilac'
  icon: React.ElementType
  size?: 'sm' | 'md'
}) {
  const palette = {
    primary: { bg: tokens.primarySoft, fg: tokens.primary },
    mint: { bg: tokens.mintSoft, fg: tokens.mint },
    coral: { bg: tokens.coralSoft, fg: tokens.coral },
    amber: { bg: tokens.amberSoft, fg: tokens.amber },
    lilac: { bg: tokens.lilacSoft, fg: tokens.lilac },
  }[tone]
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const ic = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]'
  return (
    <div
      className={cn('shrink-0 rounded-[14px] flex items-center justify-center', dim)}
      style={{ background: palette.bg }}
    >
      <Icon className={ic} style={{ color: palette.fg }} strokeWidth={2} />
    </div>
  )
}

// ─── Floating chart tooltip ──────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ value?: number; payload?: { label?: string } }>
  label?: string
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]
  return (
    <div
      className={cn(FONT, 'rounded-xl px-3 py-2.5 text-xs')}
      style={{
        background: tokens.ink,
        color: '#FFFFFF',
        boxShadow: '0 20px 40px -12px rgba(11, 18, 32, 0.3)',
      }}
    >
      <div className="font-semibold tabular-nums text-[13px]">{point.value} vues</div>
      <div className="text-white/60 text-[11px] mt-0.5 tabular-nums">
        {point.payload?.label ?? label}
      </div>
    </div>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function MonDossierPage() {
  const portalData = useSellerPortalData()
  const { property, kpis, activities, visits, offers } = portalData
  const currentStepIdx = getStepIndex(kpis.current_step)
  const nextStepLabel = currentStepIdx < MANDATE_STEPS.length - 1 ? MANDATE_STEPS[currentStepIdx + 1].label : null
  const notifications = getNotifications(visits, offers)
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)

  const filteredActivities = activityFilter === 'all'
    ? activities
    : activities.filter((a) => FILTER_TYPES[activityFilter].includes(a.type))
  const displayedActivities = showAllActivity ? filteredActivities : filteredActivities.slice(0, 5)

  const viewSeries = buildViewSeries(kpis.online_views)
  const lastViews = viewSeries[viewSeries.length - 1]?.views ?? 0
  const prevViews = viewSeries[viewSeries.length - 2]?.views ?? 0
  const viewsTrend = prevViews > 0 ? Math.round(((lastViews - prevViews) / prevViews) * 100) : 0

  return (
    <div
      className={cn(FONT, '-mx-4 md:-mx-6 -mt-6 px-4 md:px-10 pt-6 md:pt-8 pb-16 min-h-[calc(100vh-4rem)]')}
      style={{ background: tokens.bg, color: tokens.ink }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color: tokens.dim }}>
              Mon bien
            </p>
            <h1 className="mt-1 text-[28px] md:text-[32px] font-extrabold tracking-[-0.02em] leading-[1.08]">
              Tout avance, sereinement.
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/portail/messages"
              className={cn(
                'inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold transition-all',
                'text-[#0B1220] border border-[#EEF0F3] bg-white hover:bg-[#F5F6F8]',
                FOCUS_RING,
              )}
            >
              <Mail className="w-4 h-4" strokeWidth={2} />
              Message à l'agent
            </Link>
            <Link
              to="/portail/documents"
              className={cn(
                'inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-white text-sm font-semibold transition-all hover:-translate-y-0.5',
                FOCUS_RING,
              )}
              style={{
                background: tokens.primary,
                boxShadow: '0 8px 20px -8px rgba(47, 107, 255, 0.45)',
              }}
            >
              <FileText className="w-4 h-4" strokeWidth={2} />
              Déposer un document
            </Link>
          </div>
        </div>

        {/* ── Hero property card + side notifications ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Property hero (spans 2 cols on lg) */}
          <section className={cn(CARD, CARD_SHADOW_HOVER, 'lg:col-span-2 overflow-hidden')}>
            <div className="relative aspect-[16/7]">
              <img
                src={property.photo}
                alt={property.title}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-white"
                  style={{ background: tokens.primary }}
                >
                  <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
                  Mandat exclusif
                </span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
                <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-[-0.01em]">
                  {property.title}
                </h2>
                <p className="text-white/85 text-sm mt-1 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" strokeWidth={2} />
                  {property.address}, {property.postal_code} {property.city}
                </p>
              </div>
            </div>
            <div className="px-5 md:px-7 py-4 border-t border-[#EEF0F3] flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-baseline gap-3">
                <p className="text-[22px] md:text-[26px] font-extrabold tabular-nums tracking-[-0.02em]">
                  {formatCHF(property.price)}
                </p>
                <span className="text-xs font-semibold uppercase tracking-[0.06em]" style={{ color: tokens.dim }}>
                  Prix de vente
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm" style={{ color: tokens.muted }}>
                <span className="inline-flex items-center gap-1.5">
                  <Home className="w-4 h-4" strokeWidth={2} />
                  {property.rooms} pièces
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums">
                  <Maximize2 className="w-4 h-4" strokeWidth={2} />
                  {property.surface_m2} m²
                </span>
                <span className="inline-flex items-center gap-1.5 uppercase text-[11px] font-semibold tracking-[0.06em]">
                  <BedDouble className="w-4 h-4" strokeWidth={2} />
                  {property.type}
                </span>
              </div>
            </div>
          </section>

          {/* Notifications list (1 col) */}
          <section className={cn(CARD, 'p-5')}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold">Nouveautés</h2>
              <Link
                to="/portail/messages"
                className="text-xs font-semibold hover:opacity-80 transition-opacity"
                style={{ color: tokens.primary }}
              >
                Tout voir
              </Link>
            </div>
            <ul className="space-y-1">
              {notifications.map((notif) => {
                const dotColor = {
                  primary: tokens.primary,
                  mint: tokens.mint,
                  coral: tokens.coral,
                  amber: tokens.amber,
                }[notif.tone]
                return (
                  <li key={notif.id}>
                    <Link
                      to={notif.link}
                      className={cn(
                        'group flex items-start gap-3 rounded-xl px-2.5 py-2.5 -mx-2.5 transition-colors',
                        'hover:bg-[#F5F6F8]',
                      )}
                    >
                      <span
                        className="mt-1.5 shrink-0 w-2 h-2 rounded-full"
                        style={{
                          background: dotColor,
                          boxShadow: notif.isNew ? `0 0 0 4px ${dotColor}22` : undefined,
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{notif.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>{notif.description}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 shrink-0 self-center transition-transform group-hover:translate-x-0.5" style={{ color: tokens.dim }} strokeWidth={2} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        {/* ── KPI strip — colored squircles ───────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Visites', value: kpis.visits_total, sub: `${kpis.visits_this_month} ce mois`, icon: Eye, tone: 'primary' as const, trend: 12 },
            { label: 'Offres', value: kpis.offers_total, sub: kpis.offers_total > 0 ? 'reçues' : 'en attente', icon: HandCoins, tone: 'mint' as const, trend: 0 },
            { label: 'Vues en ligne', value: kpis.online_views, sub: 'sur les portails', icon: TrendingUp, tone: 'lilac' as const, trend: viewsTrend },
            { label: 'Jours en vente', value: kpis.days_on_market, sub: 'depuis publication', icon: Clock, tone: 'amber' as const, trend: null },
          ].map((kpi) => (
            <div key={kpi.label} className={cn(CARD, CARD_SHADOW_HOVER, 'p-5 group')}>
              <div className="flex items-start justify-between mb-3">
                <Squircle tone={kpi.tone} icon={kpi.icon} />
                {kpi.trend !== null && (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 h-5 px-1.5 rounded-full text-[11px] font-bold tabular-nums',
                    )}
                    style={{
                      background: kpi.trend >= 0 ? tokens.mintSoft : tokens.coralSoft,
                      color: kpi.trend >= 0 ? tokens.mint : tokens.coral,
                    }}
                  >
                    {kpi.trend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                    {Math.abs(kpi.trend)}%
                  </span>
                )}
              </div>
              <p className="text-[28px] font-extrabold tabular-nums tracking-[-0.02em] leading-none">
                {kpi.value}
              </p>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mt-2.5" style={{ color: tokens.dim }}>
                {kpi.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* ── Area chart + pipeline (2 cols) ───────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart */}
          <section className={cn(CARD, 'lg:col-span-2 p-5 md:p-6')}>
            <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-bold tracking-[-0.01em]">Audience de l'annonce</h2>
                <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>
                  Vues cumulées sur les 30 derniers jours
                </p>
              </div>
              <div className="flex items-baseline gap-3">
                <p className="text-[28px] font-extrabold tabular-nums tracking-[-0.02em] leading-none">
                  {kpis.online_views}
                </p>
                <span
                  className="inline-flex items-center gap-0.5 h-6 px-2 rounded-full text-xs font-bold tabular-nums"
                  style={{
                    background: viewsTrend >= 0 ? tokens.mintSoft : tokens.coralSoft,
                    color: viewsTrend >= 0 ? tokens.mint : tokens.coral,
                  }}
                >
                  {viewsTrend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(viewsTrend)}%
                </span>
              </div>
            </div>
            <div className="h-[220px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewSeries} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={tokens.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={tokens.line} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tokens.dim, fontSize: 10, fontFamily: 'Manrope', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval={4}
                  />
                  <YAxis
                    tick={{ fill: tokens.dim, fontSize: 10, fontFamily: 'Manrope', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: tokens.primary, strokeOpacity: 0.3, strokeWidth: 1 }} />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke={tokens.primary}
                    strokeWidth={2.5}
                    fill="url(#viewsGradient)"
                    activeDot={{ r: 5, fill: tokens.primary, stroke: '#FFFFFF', strokeWidth: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </section>

          {/* Pipeline */}
          <section className={cn(CARD, 'p-5 md:p-6 relative overflow-hidden')}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-base font-bold tracking-[-0.01em]">Avancement</h2>
                <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>
                  Étape{' '}
                  <span className="font-bold tabular-nums" style={{ color: tokens.ink }}>
                    {currentStepIdx + 1}
                  </span>
                  <span style={{ color: tokens.dim }}> / {MANDATE_STEPS.length}</span>
                </p>
              </div>
              <HelpCircle className="w-4 h-4" style={{ color: tokens.dim }} strokeWidth={2} />
            </div>

            <ul className="space-y-0">
              {MANDATE_STEPS.map((step, i) => {
                const isCompleted = i < currentStepIdx
                const isCurrent = i === currentStepIdx
                const isLast = i === MANDATE_STEPS.length - 1
                return (
                  <li
                    key={step.key}
                    className="relative flex items-start gap-3 pb-4"
                    onMouseEnter={() => setHoveredStep(step.key)}
                    onMouseLeave={() => setHoveredStep(null)}
                  >
                    {!isLast && (
                      <span
                        className="absolute left-[11px] top-6 bottom-0 w-px"
                        style={{ background: isCompleted ? tokens.primary : tokens.line }}
                      />
                    )}
                    <div
                      className="relative z-10 shrink-0 w-[22px] h-[22px] rounded-full flex items-center justify-center transition-all"
                      style={{
                        background: isCompleted ? tokens.primary : isCurrent ? tokens.primary : '#FFFFFF',
                        border: isCompleted || isCurrent ? 'none' : `2px solid ${tokens.line}`,
                        boxShadow: isCurrent ? `0 0 0 4px ${tokens.primarySoft}` : undefined,
                      }}
                    >
                      {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                    <div className="flex-1 min-w-0 pt-px">
                      <p
                        className={cn('text-sm transition-colors', isCurrent && 'font-bold', isCompleted && 'font-semibold')}
                        style={{
                          color: isCurrent || isCompleted ? tokens.ink : tokens.dim,
                        }}
                      >
                        {step.label}
                      </p>
                      {isCurrent && (
                        <p className="text-[11px] font-semibold mt-0.5" style={{ color: tokens.primary }}>
                          En cours
                        </p>
                      )}
                      {hoveredStep === step.key && STEP_HELP[step.key] && (
                        <div
                          className="mt-2 text-[11px] leading-relaxed rounded-lg px-2.5 py-2"
                          style={{ background: '#F5F6F8', color: tokens.muted }}
                        >
                          {STEP_HELP[step.key]}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            {nextStepLabel && (
              <div
                className="mt-2 pt-4 border-t flex items-center gap-2 text-xs"
                style={{ borderColor: tokens.line }}
              >
                <ArrowRight className="w-3.5 h-3.5 shrink-0" style={{ color: tokens.primary }} strokeWidth={2} />
                <span style={{ color: tokens.muted }}>Prochaine :</span>
                <span className="font-bold">{nextStepLabel}</span>
              </div>
            )}
          </section>
        </div>

        {/* ── Activité récente ─────────────────────────────────────────── */}
        <section className={cn(CARD, 'p-5 md:p-6')}>
          <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-bold tracking-[-0.01em]">Activité récente</h2>
              <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>
                Les derniers mouvements sur votre dossier
              </p>
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-full p-0.5" style={{ background: '#F5F6F8' }}>
              {ACTIVITY_FILTERS.map((f) => {
                const active = activityFilter === f.key
                return (
                  <button
                    key={f.key}
                    onClick={() => { setActivityFilter(f.key); setShowAllActivity(false) }}
                    className={cn(
                      'h-8 px-3.5 rounded-full text-xs font-semibold transition-all',
                      FOCUS_RING,
                    )}
                    style={{
                      background: active ? '#FFFFFF' : 'transparent',
                      color: active ? tokens.ink : tokens.muted,
                      boxShadow: active ? '0 1px 3px rgba(15,23,42,0.06)' : undefined,
                    }}
                  >
                    {f.label}
                  </button>
                )
              })}
            </div>
          </div>

          {displayedActivities.length > 0 ? (
            <ul className="divide-y" style={{ ['--tw-divide-opacity' as string]: 1, borderColor: tokens.line }}>
              {displayedActivities.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.type] || Check
                const tone: 'primary' | 'mint' | 'coral' | 'amber' | 'lilac' =
                  activity.type.startsWith('visit') ? 'primary'
                    : activity.type === 'offer_received' ? 'mint'
                    : activity.type === 'price_update' ? 'amber'
                    : 'lilac'
                return (
                  <li key={activity.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" style={{ borderColor: tokens.line }}>
                    <Squircle tone={tone} icon={Icon} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-[11px] mt-0.5 tabular-nums" style={{ color: tokens.dim }}>
                        {formatRelativeDate(activity.date)}
                      </p>
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center text-center py-10">
              <img
                src="/illustrations/maggy/EmptyState.svg"
                alt=""
                className="w-36 h-28 mb-3 opacity-60"
                loading="lazy"
                decoding="async"
              />
              <p className="text-sm" style={{ color: tokens.muted }}>Aucune activité dans cette catégorie</p>
            </div>
          )}

          {filteredActivities.length > 5 && (
            <button
              onClick={() => setShowAllActivity(!showAllActivity)}
              className={cn(
                'mt-4 w-full h-10 rounded-full border text-xs font-semibold transition-all flex items-center justify-center gap-1.5',
                'hover:bg-[#F5F6F8]',
                FOCUS_RING,
              )}
              style={{ borderColor: tokens.line, color: tokens.ink }}
            >
              {showAllActivity ? 'Réduire' : `Voir les ${filteredActivities.length} activités`}
              <ChevronDown
                className={cn('w-3 h-3 transition-transform', showAllActivity && 'rotate-180')}
                strokeWidth={2.5}
              />
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
