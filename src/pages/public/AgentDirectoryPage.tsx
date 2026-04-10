import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, MapPin, ChevronRight, Star, Shield, Phone, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentDirectory, DEFAULT_FILTERS } from '@/hooks/useAgentDirectory'
import type { DirectoryFilters, AgentProfileRow } from '@/hooks/useAgentDirectory'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import BuyerSidebar from '@/components/search/BuyerSidebar'

// ─── Constants ──────────────────────────────────────────────

const CANTON_LABELS: Record<string, string> = {
  AG: 'Argovie', AI: 'Appenzell RI', AR: 'Appenzell RE', BE: 'Berne', BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville', FR: 'Fribourg', GE: 'Genève', GL: 'Glaris', GR: 'Grisons', JU: 'Jura',
  LU: 'Lucerne', NE: 'Neuchâtel', NW: 'Nidwald', OW: 'Obwald', SG: 'Saint-Gall', SH: 'Schaffhouse',
  SO: 'Soleure', SZ: 'Schwyz', TG: 'Thurgovie', TI: 'Tessin', UR: 'Uri', VD: 'Vaud', VS: 'Valais',
  ZG: 'Zoug', ZH: 'Zurich',
}
const POPULAR_CANTONS = ['GE', 'VD', 'ZH', 'BE', 'BS', 'TI', 'VS', 'LU']
const PAGE_SIZE = 20

// ─── Agent Card — Liste verticale ───────────────────────────

function AgentListCard({ agent }: { agent: AgentProfileRow }) {
  const { t } = useTranslation('directory')
  const fullName = `${agent.first_name} ${agent.last_name}`
  const initials = `${agent.first_name?.[0] || ''}${agent.last_name?.[0] || ''}`.toUpperCase()
  const location = [agent.city, agent.canton ? `(${agent.canton})` : null].filter(Boolean).join(' ')

  return (
    <Link
      to={`/agents/${agent.slug}`}
      className="group flex items-start gap-5 p-5 md:p-6 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
    >
      {/* Avatar */}
      <div className="flex-shrink-0">
        {agent.photo_url ? (
          <img
            src={agent.photo_url}
            alt={fullName}
            className="w-20 h-20 md:w-[88px] md:h-[88px] rounded-full object-cover border border-gray-100"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-20 h-20 md:w-[88px] md:h-[88px] rounded-full bg-gray-100 flex items-center justify-center">
            <span className="text-xl md:text-2xl font-bold text-gray-500">{initials}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {/* Name + verified */}
        <div className="flex items-center gap-2">
          <h3 className="text-base md:text-lg font-semibold text-gray-900 group-hover:text-gray-700 transition-colors truncate">
            {fullName}
          </h3>
          {agent.status === 'verified' && (
            <ShieldCheck className="w-4 h-4 text-accent flex-shrink-0" />
          )}
        </div>

        {/* Agency */}
        {agent.agency_name && (
          <p className="text-sm text-gray-500 mt-0.5 truncate">{agent.agency_name}</p>
        )}

        {/* Location */}
        {location && (
          <p className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            {location}
          </p>
        )}

        {/* Rating */}
        <div className="flex items-center gap-2 mt-2.5">
          {agent.rating_count > 0 ? (
            <>
              <span className="text-sm font-bold text-gray-900">{Number(agent.rating_avg).toFixed(1)}</span>
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-3.5 w-3.5',
                      i < Math.round(agent.rating_avg) ? 'fill-amber-400 text-amber-400' : 'fill-gray-200 text-gray-200'
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-gray-500">({agent.rating_count})</span>
            </>
          ) : (
            <span className="text-xs text-gray-500">{t('review.noReviews')}</span>
          )}
        </div>

        {/* Stats */}
        {agent.stats_properties_sold > 0 && (
          <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
            <span><strong className="text-gray-600">{agent.stats_properties_sold}</strong> {t('sales')}</span>
            {agent.stats_avg_days_to_sell > 0 && (
              <span><strong className="text-gray-600">{agent.stats_avg_days_to_sell}{t('avgDaysSuffix')}</strong></span>
            )}
          </div>
        )}
      </div>

      {/* Right — CTA */}
      <div className="hidden md:flex flex-col items-end gap-2 flex-shrink-0 pt-2">
        <span className="h-9 px-4 text-sm font-medium border border-gray-200 text-gray-700 group-hover:border-gray-400 group-hover:text-gray-900 rounded-lg transition-colors inline-flex items-center">
          {t('viewProfile')}
        </span>
        {agent.phone && (
          <span className="text-xs text-gray-500 flex items-center gap-1 mt-1">
            <Phone className="h-3 w-3" />
            {agent.phone}
          </span>
        )}
      </div>
    </Link>
  )
}

// ─── FAQ Accordion ──────────────────────────────────────────

const FAQ_ITEMS = [
  {
    q: 'Comment trouver un bon agent immobilier en Suisse ?',
    a: 'Recherchez un agent certifié (SVIT, USPI ou SMK) avec une expérience dans votre zone géographique. Consultez les avis clients, vérifiez ses transactions récentes et assurez-vous qu\'il parle votre langue. Sur MEGGA, tous les profils sont vérifiés et les avis sont liés à des transactions réelles.',
  },
  {
    q: 'Comment choisir entre plusieurs agents ?',
    a: 'Comparez leur spécialité (résidentiel, luxe, commercial), leur zone d\'expertise, leur nombre de transactions et leur délai moyen de vente. Un agent spécialisé dans votre type de bien et votre quartier sera plus efficace qu\'un généraliste.',
  },
  {
    q: 'Combien coûte un agent immobilier en Suisse ?',
    a: 'La commission standard en Suisse est de 2% à 5% du prix de vente, selon le canton et le type de bien. Pour un bien à CHF 1\'000\'000, la commission sera entre CHF 20\'000 et CHF 50\'000. Certains agents proposent des forfaits fixes.',
  },
  {
    q: 'Quelle est la différence entre un agent et un courtier ?',
    a: 'En Suisse, les deux termes sont souvent utilisés de manière interchangeable. Un courtier (Makler) est un intermédiaire indépendant, tandis qu\'un agent travaille généralement pour une agence. Les deux doivent respecter les mêmes obligations légales (LAB/KYC).',
  },
  {
    q: 'Comment contacter un agent sur MEGGA ?',
    a: 'Cliquez sur le profil de l\'agent qui vous intéresse, puis utilisez le bouton "Contacter" pour envoyer un message ou "Planifier un RDV" pour réserver un créneau. Vous pouvez aussi appeler directement si le numéro est affiché.',
  },
]

function FaqSection() {
  const { t } = useTranslation('directory')
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="bg-gray-800 py-16 md:py-20">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <h2 className="text-2xl md:text-3xl font-bold text-white text-center mb-10">
          {t('faq.title')}
        </h2>
        <div>
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="border-b border-gray-700">
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                className="w-full flex items-center justify-between py-5 text-left group"
              >
                <span className="text-sm md:text-base font-medium text-white group-hover:text-white/80 transition-colors pr-4">
                  {item.q}
                </span>
                <ChevronRight className={cn(
                  'w-5 h-5 text-gray-500 flex-shrink-0 transition-transform duration-200',
                  openIndex === i && 'rotate-90'
                )} />
              </button>
              {openIndex === i && (
                <p className="text-sm text-gray-500 leading-relaxed pb-5 pr-10">
                  {item.a}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────

export default function AgentDirectoryPage() {
  const { t } = useTranslation('directory')
  const [filters, setFilters] = useState<DirectoryFilters>({ ...DEFAULT_FILTERS, type: 'agents' })
  const { data, isLoading } = useAgentDirectory(filters)

  function updateFilters(partial: Partial<DirectoryFilters>) {
    setFilters(prev => ({ ...prev, ...partial }))
  }

  const agents = (data?.items || []) as AgentProfileRow[]
  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <BuyerSidebar className="hidden md:flex fixed top-[72px] bottom-0 left-0 z-40" />

      <div className="md:ml-[90px]">
      {/* ═══════════════════════════════════════════════════════════
          HERO — Full-width photo, dark overlay, search bar
         ═══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
        {/* Background photo — placeholder until Nano Banana 2 */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80')`,
            filter: 'brightness(0.4)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 flex flex-col justify-center" style={{ minHeight: 420 }}>
          <h1
            className="text-3xl md:text-4xl lg:text-5xl font-bold text-white leading-tight"
            style={{ textShadow: '0 2px 16px rgba(0,0,0,0.3)' }}
          >
            {t('hero.title')}
          </h1>
          <p className="mt-3 text-white/70 text-base md:text-lg max-w-lg">
            {t('hero.subtitle')}
          </p>

          {/* Search bar — white pill in hero */}
          <div className="mt-8 w-full max-w-xl">
            <div className="relative flex items-center bg-white rounded-lg shadow-lg">
              <Search className="absolute left-4 h-5 w-5 text-gray-500" />
              <input
                type="text"
                value={filters.query}
                onChange={e => updateFilters({ query: e.target.value, page: 0 })}
                placeholder={t('searchPlaceholder')}
                className="w-full h-13 md:h-14 pl-12 pr-4 text-base text-gray-900 placeholder:text-gray-400 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-accent/30"
              />
            </div>
          </div>

          {/* Trust bar */}
          <div className="flex items-center gap-6 md:gap-8 mt-6">
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <Shield className="h-4 w-4" />
              <span>{t('trust.verifiedProfiles')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <Star className="h-4 w-4" />
              <span>{t('trust.realReviews')}</span>
            </div>
            <div className="flex items-center gap-1.5 text-white/60 text-sm">
              <MapPin className="h-4 w-4" />
              <span>{t('trust.allCantons')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CANTON PILLS — Popular locations
         ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 -mt-5 relative z-20">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-5 py-3.5">
          <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-hide">
            <span className="text-xs font-semibold text-gray-500 capitalize whitespace-nowrap">{t('popular')}</span>
            <div className="w-px h-4 bg-gray-200 flex-shrink-0" />
            {POPULAR_CANTONS.map(c => (
              <button
                key={c}
                onClick={() => updateFilters({ canton: filters.canton === c ? null : c, page: 0 })}
                className={cn(
                  'h-8 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0',
                  filters.canton === c
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                )}
              >
                {CANTON_LABELS[c]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          RESULTS — Agent list
         ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {filters.canton
                ? t('results.agentsIn', { location: CANTON_LABELS[filters.canton] || filters.canton })
                : t('results.agentsInSwitzerland')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {t('results.agentsFound', { count: data?.total || 0 })}
            </p>
          </div>

          {/* Clear filters */}
          {(filters.query || filters.canton) && (
            <button
              onClick={() => setFilters({ ...DEFAULT_FILTERS, type: 'agents' })}
              className="text-xs text-gray-500 hover:text-gray-600 transition-colors"
            >
              {t('results.reset')}
            </button>
          )}
        </div>

        {/* Loading */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : agents.length === 0 ? (
          /* Empty state */
          <div className="text-center py-20">
            <p className="text-gray-500">{t('results.noAgentFound')}</p>
            {(filters.query || filters.canton) && (
              <button
                onClick={() => setFilters({ ...DEFAULT_FILTERS, type: 'agents' })}
                className="mt-3 text-sm text-accent hover:underline"
              >
                {t('results.viewAllAgents')}
              </button>
            )}
          </div>
        ) : (
          /* Agent list */
          <div className="space-y-3">
            {agents.map(agent => (
              <AgentListCard key={agent.id} agent={agent} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            {filters.page > 0 && (
              <button
                onClick={() => updateFilters({ page: filters.page - 1 })}
                className="h-9 px-4 text-sm font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {t('results.previous')}
              </button>
            )}
            <span className="text-sm text-gray-500">
              Page {filters.page + 1} / {totalPages}
            </span>
            {filters.page + 1 < totalPages && (
              <button
                onClick={() => updateFilters({ page: filters.page + 1 })}
                className="h-9 px-4 text-sm font-medium border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
              >
                {t('results.next')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════
          CTA — "Need help finding an agent?"
         ═══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ minHeight: 280 }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=1920&q=80')`,
            filter: 'brightness(0.35)',
          }}
        />
        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 flex flex-col justify-center items-start" style={{ minHeight: 280 }}>
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            {t('cta.needHelp')}
          </h2>
          <p className="mt-2 text-white/70 text-base max-w-lg">
            {t('cta.needHelpDesc')}
          </p>
          <Link
            to="/devenir-agent"
            className="mt-6 h-11 px-6 bg-white text-gray-900 text-sm font-semibold rounded-lg flex items-center gap-2 hover:bg-gray-100 transition-colors"
          >
            {t('cta.contactLocal')}
          </Link>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          FAQ — Dark background accordion
         ═══════════════════════════════════════════════════════════ */}
      <FaqSection />

      <Footer />
      </div>{/* end md:ml-[90px] */}
    </div>
  )
}
