import { useMemo, useState } from 'react'
import {
  Eye, CalendarDays, HandCoins, Clock,
  Mail, Check, HelpCircle, Phone,
  FileText, ArrowRight, ShieldCheck, TrendingUp, TrendingDown,
  MapPin, Maximize2, Home, Sparkles, Camera,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, ReferenceLine,
} from 'recharts'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { MANDATE_STEPS, getStepIndex } from '@/lib/mockSellerData'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'

// ─────────────────────────────────────────────────────────────────────────
// MON DOSSIER — Acreon direction (refined v2)
// ─────────────────────────────────────────────────────────────────────────
// Second pass: warmer agent presence ("Cette semaine" summary), sparklines
// in each KPI tile, period selector + today-marker on audience chart,
// property hero gets a days-on-market ribbon + MEGGA Shield micro-badge,
// pipeline upcoming-step numerals, a prominent "Prochaine action" CTA.
// Still scoped to Manrope; other pages untouched.
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
  primaryDeep: '#1E4FD1',
  primarySoft: '#E8EFFF',
  mint: '#059669',
  mintSoft: '#DCFCE7',
  coral: '#E11D48',
  coralSoft: '#FFE4E6',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  lilac: '#7C3AED',
  lilacSoft: '#EDE9FE',
} as const

const CARD_SHADOW = 'shadow-[0_1px_0_rgba(15,23,42,0.02),0_8px_24px_-12px_rgba(15,23,42,0.06)]'
const CARD_SHADOW_HOVER = 'hover:shadow-[0_1px_0_rgba(15,23,42,0.03),0_16px_40px_-16px_rgba(15,23,42,0.12)]'
const CARD = cn(
  'rounded-2xl bg-white border border-[color:#EEF0F3] transition-all duration-200',
  CARD_SHADOW,
)

// ─── Pipeline step explanations ──────────────────────────────────────────

const STEP_HELP: Record<string, string> = {
  mandate_signed: 'Mandat signé entre vous et votre agent.',
  published: "Votre bien est publié sur les portails et visible par les acheteurs.",
  visits: 'Les visites sont organisées par votre agent. Vous recevez les retours.',
  offers: "Des offres d'achat sont en cours de réception ou d'analyse.",
  negotiation: "Votre agent négocie les conditions avec l'acquéreur retenu.",
  notary: "Le dossier est transmis au notaire pour la préparation de l'acte.",
  sold: "La vente est finalisée. L'acte est signé chez le notaire.",
}

// Typical durations for steps still ahead — editorial hint, not a hard ETA.
const STEP_ETA: Record<string, string> = {
  negotiation: '~ 2 semaines',
  notary: '~ 4 semaines',
  sold: 'Cérémonie',
}

// French labels for mock property types.
const TYPE_LABEL: Record<string, string> = {
  apartment: 'Appartement',
  house: 'Maison',
  villa: 'Villa',
  commercial: 'Commerce',
  office: 'Bureau',
  parking: 'Parking',
  storage: 'Dépôt',
  land: 'Terrain',
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

// ─── Notification list helpers ───────────────────────────────────────────

interface Notification {
  id: string
  label: string
  description: string
  link: string
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
      isNew: true,
      tone: 'mint',
    })
  }
  notifs.push({
    id: 'docs-missing',
    label: '2 documents manquants',
    description: 'Diagnostic amiante et certificat CECB',
    link: '/portail/documents',
    isNew: false,
    tone: 'coral',
  })
  return notifs
}

// ─── Time-series fixtures ────────────────────────────────────────────────

type Period = '7' | '30' | '90'

function buildViewSeries(total: number, period: Period) {
  const days = parseInt(period, 10)
  const out: { date: string; label: string; views: number; isFuture: boolean }[] = []
  const today = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    const base = Math.round((total / days) + Math.sin(i * 0.7) * 5 + (Math.sin(i * 0.23) * 4) + 2)
    out.push({
      date: d.toISOString(),
      label: d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }),
      views: Math.max(1, base),
      isFuture: false,
    })
  }
  // amplify the ending to signal momentum
  const last = out[out.length - 1]
  if (last) last.views = Math.round(last.views * 1.6)
  return out
}

// Tiny per-KPI sparkline seed — visually distinct curves using the index.
function buildSparkSeries(seed: number) {
  const out: { i: number; v: number }[] = []
  let v = 10
  for (let i = 0; i < 14; i++) {
    v = Math.max(2, Math.round(v + Math.sin(i * 0.9 + seed) * 3 + (Math.random() * 2 - 1)))
    out.push({ i, v })
  }
  // end on a high note
  out[out.length - 1].v = Math.round(out[out.length - 1].v * 1.3)
  return out
}

// ─── Squircle ────────────────────────────────────────────────────────────

function Squircle({
  tone, icon: Icon, size = 'md',
}: {
  tone: 'primary' | 'mint' | 'coral' | 'amber' | 'lilac'
  icon: React.ElementType
  size?: 'sm' | 'md'
}) {
  const palette = {
    primary: { bg: tokens.primarySoft, fg: tokens.primary },
    mint:    { bg: tokens.mintSoft,    fg: tokens.mint },
    coral:   { bg: tokens.coralSoft,   fg: tokens.coral },
    amber:   { bg: tokens.amberSoft,   fg: tokens.amber },
    lilac:   { bg: tokens.lilacSoft,   fg: tokens.lilac },
  }[tone]
  const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
  const ic = size === 'sm' ? 'w-4 h-4' : 'w-[18px] h-[18px]'
  return (
    <div
      className={cn('shrink-0 rounded-[12px] flex items-center justify-center', dim)}
      style={{ background: palette.bg }}
    >
      <Icon className={ic} style={{ color: palette.fg }} strokeWidth={2.25} />
    </div>
  )
}

// ─── Sparkline (inline, inside KPI) ──────────────────────────────────────

function Sparkline({ data, tone }: { data: { i: number; v: number }[]; tone: 'primary' | 'mint' | 'coral' | 'amber' | 'lilac' }) {
  const color = tokens[tone] ?? tokens.primary
  return (
    <div className="w-full h-6 mt-2" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 1, right: 1, bottom: 1, left: 1 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={1.75}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── Chart tooltip (audience) ────────────────────────────────────────────

function ChartTooltip({ active, payload }: {
  active?: boolean
  payload?: Array<{ value?: number; payload?: { label?: string; isToday?: boolean } }>
}) {
  if (!active || !payload || payload.length === 0) return null
  const p = payload[0]
  return (
    <div
      className={cn(FONT, 'rounded-xl px-3 py-2 text-xs')}
      style={{
        background: tokens.ink,
        color: '#FFFFFF',
        boxShadow: '0 20px 40px -12px rgba(11,18,32,0.3)',
      }}
    >
      <div className="font-bold tabular-nums text-[13px]">{p.value} vues</div>
      <div className="text-white/60 text-[11px] mt-0.5 tabular-nums">{p.payload?.label}</div>
    </div>
  )
}

// ─── Days-on-market badge ────────────────────────────────────────────────

function DaysRibbon({ days }: { days: number }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] backdrop-blur-md"
      style={{ background: 'rgba(255,255,255,0.9)', color: tokens.ink }}
    >
      <Clock className="h-3 w-3" strokeWidth={2.5} />
      Sur le marché · {days} j
    </span>
  )
}

function ShieldPill() {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] backdrop-blur-md"
      style={{ background: 'rgba(11,18,32,0.72)', color: '#FFFFFF' }}
      title="Photos signées par MEGGA Shield — authentification cryptographique"
    >
      <Camera className="h-3 w-3" strokeWidth={2.5} />
      MEGGA Shield
    </span>
  )
}

// ─── Main page ───────────────────────────────────────────────────────────

export default function MonDossierPage() {
  const portalData = useSellerPortalData()
  const { property, kpis, activities, visits, offers } = portalData
  const currentStepIdx = getStepIndex(kpis.current_step)
  const notifications = getNotifications(visits, offers)
  const [showAllActivity, setShowAllActivity] = useState(false)
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')
  const [hoveredStep, setHoveredStep] = useState<string | null>(null)
  const [period, setPeriod] = useState<Period>('30')

  const filteredActivities = activityFilter === 'all'
    ? activities
    : activities.filter((a) => FILTER_TYPES[activityFilter].includes(a.type))
  const displayedActivities = showAllActivity ? filteredActivities : filteredActivities.slice(0, 5)

  const viewSeries = useMemo(() => buildViewSeries(kpis.online_views, period), [kpis.online_views, period])
  const lastViews = viewSeries[viewSeries.length - 1]?.views ?? 0
  const prevViews = viewSeries[viewSeries.length - 2]?.views ?? 0
  const viewsTrend = prevViews > 0 ? Math.round(((lastViews - prevViews) / prevViews) * 100) : 0

  // Spark series per KPI — stable during session thanks to useMemo.
  const sparkVisits = useMemo(() => buildSparkSeries(1), [])
  const sparkOffers = useMemo(() => buildSparkSeries(2), [])
  const sparkViews  = useMemo(() => buildSparkSeries(3), [])
  const sparkDays   = useMemo(() => buildSparkSeries(4), [])

  const todayLabel = viewSeries[viewSeries.length - 1]?.label

  const propertyTypeLabel = TYPE_LABEL[property.type] ?? property.type
  const daysOnMarket = kpis.days_on_market ?? 12
  const bestActiveOffer = offers
    .filter((o) => o.status === 'pending' || o.status === 'counter_offer')
    .reduce<{ amount: number } | null>((m, o) => (!m || o.amount > m.amount ? o : m), null)

  // The seller's single next action — curated signal from the mocked state.
  const nextAction = (() => {
    if (bestActiveOffer) {
      return {
        eyebrow: 'Prochaine action pour vous',
        title: "Décider de la suite pour l'offre la plus élevée",
        body: `La meilleure offre est à ${formatCHF(bestActiveOffer.amount)}. Répondez à votre agent avant vendredi.`,
        cta: 'Répondre',
        href: '/portail/offres',
      }
    }
    return {
      eyebrow: 'Prochaine action pour vous',
      title: 'Fournir le diagnostic amiante',
      body: "Nécessaire avant la signature chez le notaire. Dépôt en 2 clics.",
      cta: 'Déposer le document',
      href: '/portail/documents',
    }
  })()

  // Agent weekly summary — single sentence with concrete numbers.
  const weeklyHighlight = `${kpis.visits_this_month} visite${kpis.visits_this_month > 1 ? 's' : ''} ce mois, ${offers.length} offre${offers.length > 1 ? 's' : ''} reçue${offers.length > 1 ? 's' : ''}, +38 % de vues après la mise à jour des photos pro.`

  return (
    <div
      className={cn(FONT, '-mx-4 md:-mx-6 -mt-6 px-4 md:px-10 pt-6 md:pt-8 pb-16 min-h-[calc(100vh-4rem)]')}
      style={{ background: tokens.bg, color: tokens.ink }}
    >
      <div className="max-w-6xl mx-auto space-y-6">
        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: tokens.dim }}>
              Mon bien
            </p>
            <h1 className="mt-1 text-[28px] md:text-[34px] font-extrabold tracking-[-0.025em] leading-[1.05]">
              Tout avance, sereinement.
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/portail/messages"
              className={cn(
                'inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-sm font-semibold transition-all',
                'border border-[#EEF0F3] bg-white hover:bg-[#F5F6F8]',
                FOCUS_RING,
              )}
              style={{ color: tokens.ink }}
            >
              <Mail className="w-4 h-4" strokeWidth={2} />
              Message à l'agent
            </Link>
            <Link
              to={nextAction.href}
              className={cn(
                'inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-white text-sm font-semibold transition-all hover:-translate-y-0.5',
                FOCUS_RING,
              )}
              style={{
                background: tokens.primary,
                boxShadow: '0 8px 20px -8px rgba(47,107,255,0.45)',
              }}
            >
              <FileText className="w-4 h-4" strokeWidth={2} />
              {nextAction.cta}
            </Link>
          </div>
        </div>

        {/* ── Agent weekly summary (editorial, prominent) ──────────────── */}
        <section
          className={cn(CARD, 'p-5 md:p-6 flex items-start gap-4 relative overflow-hidden')}
          style={{
            background: `linear-gradient(135deg, ${tokens.primarySoft} 0%, #FFFFFF 55%)`,
            borderColor: '#DCE5FF',
          }}
        >
          {/* decorative blurred blob */}
          <div
            className="absolute -top-10 -right-6 w-40 h-40 rounded-full blur-3xl opacity-60 pointer-events-none"
            style={{ background: tokens.primary, mixBlendMode: 'multiply' }}
            aria-hidden
          />
          <div className="relative shrink-0 w-11 h-11 rounded-full flex items-center justify-center font-bold text-white text-sm tracking-tight"
            style={{ background: `linear-gradient(135deg, ${tokens.primary}, ${tokens.primaryDeep})` }}
          >
            GL
          </div>
          <div className="relative flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: tokens.primary }}>
              Cette semaine · par Gregory Lyonnet
            </p>
            <p className="mt-1.5 text-[15px] md:text-[16px] leading-[1.55] font-semibold" style={{ color: tokens.ink }}>
              {weeklyHighlight}
            </p>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold bg-white transition-all hover:-translate-y-0.5',
                  FOCUS_RING,
                )}
                style={{ color: tokens.ink, border: '1px solid #EEF0F3' }}
              >
                <Phone className="w-3 h-3" strokeWidth={2.5} /> Appeler
              </button>
              <button
                className={cn(
                  'inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-xs font-semibold bg-white transition-all hover:-translate-y-0.5',
                  FOCUS_RING,
                )}
                style={{ color: tokens.ink, border: '1px solid #EEF0F3' }}
              >
                <Mail className="w-3 h-3" strokeWidth={2.5} /> Écrire
              </button>
            </div>
          </div>
          <div className="relative hidden md:flex flex-col items-end text-right shrink-0">
            <span className="text-[11px] font-semibold" style={{ color: tokens.muted }}>Votre agent</span>
            <span className="text-sm font-bold" style={{ color: tokens.ink }}>Gregory Lyonnet</span>
            <span className="text-[11px]" style={{ color: tokens.muted }}>MEGGA Immobilier · Genève</span>
          </div>
        </section>

        {/* ── Hero property + Notifications ────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <section className={cn(CARD, CARD_SHADOW_HOVER, 'lg:col-span-2 overflow-hidden')}>
            <div className="relative aspect-[16/7]">
              <img
                src={property.photo}
                alt={property.title}
                className="w-full h-full object-cover"
                loading="eager"
                decoding="async"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
              {/* top row badges */}
              <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.05em] text-white"
                  style={{ background: tokens.primary, boxShadow: '0 6px 16px -6px rgba(47,107,255,0.55)' }}
                >
                  <ShieldCheck className="h-3 w-3" strokeWidth={2.5} />
                  Mandat exclusif
                </span>
                <DaysRibbon days={daysOnMarket} />
              </div>
              <div className="absolute top-4 right-4">
                <ShieldPill />
              </div>
              {/* bottom address */}
              <div className="absolute bottom-0 left-0 right-0 p-5 md:p-7">
                <h2 className="text-xl md:text-[26px] font-extrabold text-white tracking-[-0.015em]">
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
                <p className="text-[22px] md:text-[28px] font-extrabold tabular-nums tracking-[-0.02em]">
                  {formatCHF(property.price)}
                </p>
                <span className="text-xs font-bold uppercase tracking-[0.1em]" style={{ color: tokens.dim }}>
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
                <span
                  className="inline-flex items-center h-6 px-2 rounded-full text-[11px] font-bold uppercase tracking-[0.06em]"
                  style={{ background: '#F5F6F8', color: tokens.ink }}
                >
                  {propertyTypeLabel}
                </span>
              </div>
            </div>
          </section>

          {/* Notifications */}
          <section className={cn(CARD, 'p-5 flex flex-col')}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-extrabold">Nouveautés</h2>
              <Link to="/portail/messages" className="text-xs font-bold hover:opacity-80 transition-opacity" style={{ color: tokens.primary }}>
                Tout voir
              </Link>
            </div>
            <ul className="space-y-0.5">
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
                      className="group flex items-start gap-3 rounded-xl px-2.5 py-2.5 -mx-2.5 transition-colors hover:bg-[#F5F6F8]"
                    >
                      <span
                        className="mt-1.5 shrink-0 w-2 h-2 rounded-full"
                        style={{
                          background: dotColor,
                          boxShadow: notif.isNew ? `0 0 0 4px ${dotColor}1f` : undefined,
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

            {/* Next-action CTA — pinned at the bottom of the column so it
                aligns with the hero bottom row. */}
            <div className="mt-auto pt-4 border-t" style={{ borderColor: tokens.line }}>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: tokens.primary }}>
                {nextAction.eyebrow}
              </p>
              <p className="mt-1 text-sm font-bold" style={{ color: tokens.ink }}>
                {nextAction.title}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed" style={{ color: tokens.muted }}>
                {nextAction.body}
              </p>
              <Link
                to={nextAction.href}
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 h-8 px-3.5 rounded-full text-xs font-bold text-white transition-all hover:-translate-y-0.5',
                  FOCUS_RING,
                )}
                style={{ background: tokens.ink }}
              >
                {nextAction.cta}
                <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
              </Link>
            </div>
          </section>
        </div>

        {/* ── KPI row with sparklines ──────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Visites', value: kpis.visits_total, sub: `${kpis.visits_this_month} ce mois`, icon: Eye, tone: 'primary' as const, trend: 12, spark: sparkVisits },
            { label: 'Offres', value: kpis.offers_total, sub: kpis.offers_total > 0 ? 'reçues' : 'en attente', icon: HandCoins, tone: 'mint' as const, trend: 0, spark: sparkOffers },
            { label: 'Vues en ligne', value: kpis.online_views, sub: 'sur les portails', icon: TrendingUp, tone: 'lilac' as const, trend: viewsTrend, spark: sparkViews },
            { label: 'Jours en vente', value: kpis.days_on_market, sub: 'depuis publication', icon: Clock, tone: 'amber' as const, trend: null, spark: sparkDays },
          ].map((kpi) => (
            <div key={kpi.label} className={cn(CARD, CARD_SHADOW_HOVER, 'p-5 group')}>
              <div className="flex items-start justify-between">
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
              <p className="mt-3 text-[30px] font-extrabold tabular-nums tracking-[-0.025em] leading-none">
                {kpi.value}
              </p>
              <p className="text-[11px] font-bold uppercase tracking-[0.1em] mt-2.5" style={{ color: tokens.dim }}>
                {kpi.label}
              </p>
              <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>{kpi.sub}</p>
              <Sparkline data={kpi.spark} tone={kpi.tone} />
            </div>
          ))}
        </div>

        {/* ── Audience chart + Pipeline ────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Chart */}
          <section className={cn(CARD, 'lg:col-span-2 p-5 md:p-6')}>
            <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.01em]">Audience de l'annonce</h2>
                <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>
                  Vues cumulées sur les portails
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center gap-0.5 rounded-full p-0.5" style={{ background: '#F5F6F8' }}>
                  {(['7', '30', '90'] as Period[]).map((p) => {
                    const active = period === p
                    return (
                      <button
                        key={p}
                        onClick={() => setPeriod(p)}
                        className={cn('h-7 px-3 rounded-full text-[11px] font-bold transition-all tabular-nums', FOCUS_RING)}
                        style={{
                          background: active ? '#FFFFFF' : 'transparent',
                          color: active ? tokens.ink : tokens.muted,
                          boxShadow: active ? '0 1px 3px rgba(15,23,42,0.06)' : undefined,
                        }}
                      >
                        {p} j
                      </button>
                    )
                  })}
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-[26px] font-extrabold tabular-nums tracking-[-0.02em] leading-none">
                    {lastViews}
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
            </div>

            <div className="h-[220px] -mx-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={viewSeries} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                  <defs>
                    <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={tokens.primary} stopOpacity={0.32} />
                      <stop offset="100%" stopColor={tokens.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={tokens.line} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: tokens.dim, fontSize: 10, fontFamily: 'Manrope', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval={period === '7' ? 0 : period === '30' ? 4 : 12}
                  />
                  <YAxis
                    tick={{ fill: tokens.dim, fontSize: 10, fontFamily: 'Manrope', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={28}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: tokens.primary, strokeOpacity: 0.35, strokeWidth: 1 }} />
                  {todayLabel && (
                    <ReferenceLine
                      x={todayLabel}
                      stroke={tokens.primary}
                      strokeDasharray="3 4"
                      strokeOpacity={0.6}
                      label={{
                        value: "Aujourd'hui",
                        position: 'top',
                        fill: tokens.primary,
                        fontSize: 10,
                        fontFamily: 'Manrope',
                        fontWeight: 700,
                      }}
                    />
                  )}
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
          <section className={cn(CARD, 'p-5 md:p-6')}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-extrabold tracking-[-0.01em]">Avancement</h2>
                <p className="text-xs mt-0.5" style={{ color: tokens.muted }}>
                  Étape{' '}
                  <span className="font-extrabold tabular-nums" style={{ color: tokens.ink }}>
                    {currentStepIdx + 1}
                  </span>
                  <span style={{ color: tokens.dim }}> / {MANDATE_STEPS.length}</span>
                </p>
              </div>
              <HelpCircle className="w-4 h-4" style={{ color: tokens.dim }} strokeWidth={2} />
            </div>

            {/* Compact horizontal dots at the top — at-a-glance glimpse */}
            <div className="flex items-center justify-between gap-1 mb-4 py-2 px-1 rounded-xl" style={{ background: '#F5F6F8' }}>
              {MANDATE_STEPS.map((_, i) => {
                const isCompleted = i < currentStepIdx
                const isCurrent = i === currentStepIdx
                return (
                  <span
                    key={i}
                    className="flex-1 h-1.5 rounded-full transition-all"
                    style={{
                      background: isCompleted || isCurrent ? tokens.primary : '#E5E7EB',
                      opacity: isCurrent ? 1 : isCompleted ? 0.85 : 1,
                      transform: isCurrent ? 'scaleY(1.2)' : undefined,
                    }}
                  />
                )
              })}
            </div>

            <ul className="space-y-0">
              {MANDATE_STEPS.map((step, i) => {
                const isCompleted = i < currentStepIdx
                const isCurrent = i === currentStepIdx
                const isLast = i === MANDATE_STEPS.length - 1
                const eta = STEP_ETA[step.key]
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
                        border: isCompleted || isCurrent ? 'none' : `1.5px solid ${tokens.line}`,
                        boxShadow: isCurrent ? `0 0 0 4px ${tokens.primarySoft}` : undefined,
                      }}
                    >
                      {isCompleted && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      {!isCompleted && !isCurrent && (
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: tokens.dim }}>
                          {i + 1}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-[2px]">
                      <div className="flex items-center justify-between gap-2">
                        <p
                          className={cn('text-sm transition-colors', isCurrent && 'font-extrabold', isCompleted && 'font-semibold')}
                          style={{ color: isCurrent || isCompleted ? tokens.ink : tokens.dim }}
                        >
                          {step.label}
                        </p>
                        {!isCompleted && !isCurrent && eta && (
                          <span className="text-[10px] font-semibold tabular-nums" style={{ color: tokens.dim }}>
                            {eta}
                          </span>
                        )}
                      </div>
                      {isCurrent && (
                        <p className="text-[11px] font-bold mt-0.5" style={{ color: tokens.primary }}>
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
          </section>
        </div>

        {/* ── Activity feed ────────────────────────────────────────────── */}
        <section className={cn(CARD, 'p-5 md:p-6')}>
          <div className="flex items-center justify-between mb-5 gap-2 flex-wrap">
            <div>
              <h2 className="text-base font-extrabold tracking-[-0.01em]">Activité récente</h2>
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
                    className={cn('h-8 px-3.5 rounded-full text-xs font-semibold transition-all', FOCUS_RING)}
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
            <ul>
              {displayedActivities.map((activity, i) => {
                const Icon = ACTIVITY_ICONS[activity.type] || Check
                const tone: 'primary' | 'mint' | 'coral' | 'amber' | 'lilac' =
                  activity.type.startsWith('visit') ? 'primary'
                    : activity.type === 'offer_received' ? 'mint'
                    : activity.type === 'price_update' ? 'amber'
                    : 'lilac'
                return (
                  <li
                    key={activity.id}
                    className={cn('flex items-start gap-3 py-3', i > 0 && 'border-t')}
                    style={{ borderColor: tokens.line }}
                  >
                    <Squircle tone={tone} icon={Icon} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm" style={{ color: tokens.ink }}>{activity.description}</p>
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
                'mt-4 w-full h-10 rounded-full border text-xs font-bold transition-all flex items-center justify-center gap-1.5',
                'hover:bg-[#F5F6F8]',
                FOCUS_RING,
              )}
              style={{ borderColor: tokens.line, color: tokens.ink }}
            >
              {showAllActivity ? 'Réduire' : `Voir les ${filteredActivities.length} activités`}
              <Sparkles className={cn('w-3 h-3')} strokeWidth={2.5} />
            </button>
          )}
        </section>
      </div>
    </div>
  )
}
