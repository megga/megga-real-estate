import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, ChevronLeft, ChevronRight, ShieldCheck, MapPin, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentDirectory, DEFAULT_FILTERS } from '@/hooks/useAgentDirectory'
import type { DirectoryFilters, AgentProfileRow, AgencyProfileRow } from '@/hooks/useAgentDirectory'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import BuyerSidebar from '@/components/search/BuyerSidebar'
import AgentCard from '@/components/directory/AgentCard'
import AgencyCard from '@/components/directory/AgencyCard'

const CANTONS = ['AG','AI','AR','BE','BL','BS','FR','GE','GL','GR','JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG','TI','UR','VD','VS','ZG','ZH']
const CANTON_LABELS: Record<string, string> = {
  AG: 'Argovie', AI: 'Appenzell Rh.-Int.', AR: 'Appenzell Rh.-Ext.', BE: 'Berne', BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville', FR: 'Fribourg', GE: 'Genève', GL: 'Glaris', GR: 'Grisons', JU: 'Jura',
  LU: 'Lucerne', NE: 'Neuchâtel', NW: 'Nidwald', OW: 'Obwald', SG: 'Saint-Gall', SH: 'Schaffhouse',
  SO: 'Soleure', SZ: 'Schwyz', TG: 'Thurgovie', TI: 'Tessin', UR: 'Uri', VD: 'Vaud', VS: 'Valais',
  ZG: 'Zoug', ZH: 'Zurich',
}
const SPECIALTIES = ['residential', 'commercial', 'luxury', 'new', 'rental'] as const
const LANGUAGES = ['fr', 'de', 'en', 'it'] as const
const POPULAR_CANTONS = ['GE', 'VD', 'ZH', 'BE', 'BS', 'TI', 'VS', 'LU']

const PAGE_SIZE = 20

export default function AgentDirectoryPage() {
  const { t } = useTranslation('directory')
  const [filters, setFilters] = useState<DirectoryFilters>({ ...DEFAULT_FILTERS })
  const { data, isLoading } = useAgentDirectory(filters)

  function updateFilters(partial: Partial<DirectoryFilters>) {
    setFilters(prev => ({ ...prev, ...partial }))
  }

  function toggleInArray<T extends string>(arr: T[], value: T): T[] {
    return arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 0
  const hasActiveFilters = filters.query || filters.canton || filters.specialties.length > 0 || filters.languages.length > 0 || filters.verifiedOnly

  return (
    <>
    <Navbar />
    <BuyerSidebar className="hidden md:flex fixed top-[72px] bottom-0 left-0 z-40" />
    <div className="min-h-screen bg-[#f7f7f7] md:ml-[90px]">
      {/* ═══════════════════════════════════════════════════════════
          HERO — Full-width photo background with centered search
          Zillow style: large photo, dark overlay, centered content
         ═══════════════════════════════════════════════════════════ */}
      <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80')`,
            filter: 'brightness(0.45)',
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center px-4 py-20 md:py-28">
          <h1
            className="text-4xl md:text-5xl lg:text-[56px] font-bold text-white text-center mb-4 leading-tight"
            style={{ textShadow: '0 4px 24px rgba(0,0,0,0.4)' }}
          >
            {t('title')}
          </h1>
          <p className="text-lg md:text-xl text-white/80 text-center mb-10 max-w-2xl">
            {t('subtitle')}
          </p>

          {/* Search bar — Zillow style: white pill with shadow */}
          <div className="w-full max-w-2xl">
            <div className="relative flex items-center bg-white rounded-lg shadow-xl">
              <Search className="absolute left-4 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={filters.query}
                onChange={e => updateFilters({ query: e.target.value, page: 0 })}
                placeholder={t('searchPlaceholder')}
                className="w-full h-14 pl-12 pr-36 text-base text-gray-900 placeholder:text-gray-400 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                className="absolute right-2 h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-md transition-colors"
              >
                Rechercher
              </button>
            </div>
          </div>

          {/* Trust bar */}
          <div className="flex items-center gap-6 md:gap-10 mt-8">
            <div className="flex items-center gap-2 text-white/70">
              <ShieldCheck className="h-4 w-4" />
              <span className="text-sm">Profils vérifiés</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <Star className="h-4 w-4" />
              <span className="text-sm">Avis clients réels</span>
            </div>
            <div className="flex items-center gap-2 text-white/70">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">26 cantons</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          POPULAR LOCATIONS — Quick-access canton pills
         ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 -mt-6 relative z-20">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Populaire</span>
            <div className="w-px h-5 bg-gray-200" />
            {POPULAR_CANTONS.map(c => (
              <button
                key={c}
                onClick={() => updateFilters({ canton: filters.canton === c ? null : c, page: 0 })}
                className={cn(
                  'h-8 px-4 rounded-full text-sm font-medium whitespace-nowrap transition-all',
                  filters.canton === c
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                )}
              >
                {CANTON_LABELS[c] ?? c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          MAIN CONTENT — Sidebar filters + results grid
         ═══════════════════════════════════════════════════════════ */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* ── LEFT SIDEBAR — Filters (desktop only) ── */}
          <aside className="hidden lg:block w-64 flex-shrink-0">
            <div className="sticky top-24 space-y-6">
              {/* Type toggle */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Type</h3>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['agents', 'agencies'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => updateFilters({ type, page: 0 })}
                      className={cn(
                        'flex-1 h-10 text-sm font-medium transition-colors',
                        filters.type === type
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      )}
                    >
                      {type === 'agents' ? t('toggleAgents') : t('toggleAgencies')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canton */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('filterCanton')}</h3>
                <select
                  value={filters.canton ?? ''}
                  onChange={e => updateFilters({ canton: e.target.value || null, page: 0 })}
                  className="w-full h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                >
                  <option value="">{t('filterAllSwitzerland')}</option>
                  {CANTONS.map(c => (
                    <option key={c} value={c}>{CANTON_LABELS[c] ?? c} ({c})</option>
                  ))}
                </select>
              </div>

              {/* Specialties */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('filterSpecialty')}</h3>
                <div className="space-y-1.5">
                  {SPECIALTIES.map(s => (
                    <button
                      key={s}
                      onClick={() => updateFilters({ specialties: toggleInArray(filters.specialties, s), page: 0 })}
                      className={cn(
                        'flex items-center w-full h-9 px-3 rounded-lg text-sm transition-colors',
                        filters.specialties.includes(s)
                          ? 'bg-blue-50 text-blue-700 font-medium'
                          : 'text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      <span className={cn(
                        'w-4 h-4 rounded border mr-3 flex items-center justify-center flex-shrink-0 transition-colors',
                        filters.specialties.includes(s)
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                      )}>
                        {filters.specialties.includes(s) && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M3 6l2.5 2.5L9.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </span>
                      {t(`specialty.${s}`)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{t('filterLanguage')}</h3>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(l => (
                    <button
                      key={l}
                      onClick={() => updateFilters({ languages: toggleInArray(filters.languages, l), page: 0 })}
                      className={cn(
                        'h-8 px-3 rounded-md text-xs font-medium uppercase transition-colors',
                        filters.languages.includes(l)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      )}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {/* Verified */}
              <div>
                <button
                  onClick={() => updateFilters({ verifiedOnly: !filters.verifiedOnly, page: 0 })}
                  className={cn(
                    'flex items-center w-full h-10 px-3 rounded-lg text-sm font-medium transition-colors',
                    filters.verifiedOnly
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  <ShieldCheck className={cn('h-4 w-4 mr-2', filters.verifiedOnly ? 'text-blue-600' : 'text-gray-400')} />
                  {t('filterVerified')}
                </button>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                  className="w-full h-9 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
                >
                  Effacer les filtres
                </button>
              )}
            </div>
          </aside>

          {/* ── MAIN — Results ── */}
          <main className="flex-1 min-w-0">
            {/* Results header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {filters.type === 'agents' ? 'Agents immobiliers' : 'Agences immobilières'}
                  {filters.canton && ` — ${CANTON_LABELS[filters.canton] ?? filters.canton}`}
                </h2>
                {data && (
                  <p className="text-sm text-gray-500 mt-0.5">
                    {data.total} {filters.type === 'agents' ? 'agents' : 'agences'} {filters.canton ? `dans le canton de ${CANTON_LABELS[filters.canton] ?? filters.canton}` : 'en Suisse'}
                  </p>
                )}
              </div>

              <select
                value={filters.sortBy}
                onChange={e => updateFilters({ sortBy: e.target.value as DirectoryFilters['sortBy'] })}
                className="h-9 px-3 pr-8 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 focus:outline-none appearance-none"
              >
                <option value="relevance">{t('sortRelevance')}</option>
                <option value="name">{t('sortName')}</option>
                <option value="rating">{t('sortRating')}</option>
                <option value="listings">{t('sortListings')}</option>
              </select>
            </div>

            {/* Mobile filters */}
            <div className="lg:hidden mb-6">
              <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
                <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                  {(['agents', 'agencies'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => updateFilters({ type, page: 0 })}
                      className={cn(
                        'h-9 px-4 text-sm font-medium transition-colors',
                        filters.type === type
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600'
                      )}
                    >
                      {type === 'agents' ? t('toggleAgents') : t('toggleAgencies')}
                    </button>
                  ))}
                </div>
                <select
                  value={filters.canton ?? ''}
                  onChange={e => updateFilters({ canton: e.target.value || null, page: 0 })}
                  className="h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg text-gray-600 flex-shrink-0"
                >
                  <option value="">{t('filterCanton')}</option>
                  {CANTONS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  onClick={() => updateFilters({ verifiedOnly: !filters.verifiedOnly, page: 0 })}
                  className={cn(
                    'h-9 px-3 rounded-lg text-sm font-medium whitespace-nowrap flex-shrink-0 transition-colors',
                    filters.verifiedOnly
                      ? 'bg-blue-600 text-white'
                      : 'bg-white text-gray-600 border border-gray-200'
                  )}
                >
                  {t('filterVerified')}
                </button>
              </div>
            </div>

            {/* Loading skeletons — Zillow style horizontal cards */}
            {isLoading && (
              <div className="space-y-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-200 p-6 animate-pulse">
                    <div className="flex gap-5">
                      <div className="w-20 h-20 rounded-full bg-gray-200 flex-shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="h-5 w-48 bg-gray-200 rounded" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                        <div className="flex gap-2">
                          <div className="h-4 w-20 bg-gray-200 rounded" />
                          <div className="h-4 w-16 bg-gray-200 rounded" />
                        </div>
                      </div>
                      <div className="hidden md:block w-28">
                        <div className="h-10 w-full bg-gray-200 rounded-lg" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && data && data.total === 0 && (
              <div className="bg-white rounded-lg border border-gray-200 text-center py-20 px-6">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-5">
                  <Search className="h-7 w-7 text-gray-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900 mb-2">{t('noResults')}</p>
                <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">{t('noResultsSubtitle')}</p>
                <button
                  onClick={() => setFilters({ ...DEFAULT_FILTERS })}
                  className="h-10 px-6 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
                >
                  Effacer les filtres
                </button>
              </div>
            )}

            {/* Results — Zillow uses a LIST layout, not grid */}
            {!isLoading && data && data.total > 0 && (
              <>
                <div className="space-y-3">
                  {filters.type === 'agents'
                    ? (data.items as AgentProfileRow[]).map(agent => (
                        <AgentCard key={agent.id} agent={agent} />
                      ))
                    : (data.items as AgencyProfileRow[]).map(agency => (
                        <AgencyCard key={agency.id} agency={agency} />
                      ))
                  }
                </div>

                {/* Pagination — Zillow style */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <button
                      onClick={() => updateFilters({ page: filters.page - 1 })}
                      disabled={filters.page === 0}
                      className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center transition-colors',
                        filters.page === 0
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>

                    {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                      let pageNum: number
                      if (totalPages <= 7) {
                        pageNum = i
                      } else if (filters.page < 4) {
                        pageNum = i
                      } else if (filters.page > totalPages - 5) {
                        pageNum = totalPages - 7 + i
                      } else {
                        pageNum = filters.page - 3 + i
                      }
                      return (
                        <button
                          key={pageNum}
                          onClick={() => updateFilters({ page: pageNum })}
                          className={cn(
                            'h-10 w-10 rounded-lg text-sm font-medium transition-colors',
                            pageNum === filters.page
                              ? 'bg-blue-600 text-white'
                              : 'text-gray-700 hover:bg-gray-200'
                          )}
                        >
                          {pageNum + 1}
                        </button>
                      )
                    })}

                    <button
                      onClick={() => updateFilters({ page: filters.page + 1 })}
                      disabled={filters.page + 1 >= totalPages}
                      className={cn(
                        'h-10 w-10 rounded-lg flex items-center justify-center transition-colors',
                        filters.page + 1 >= totalPages
                          ? 'text-gray-300 cursor-not-allowed'
                          : 'text-gray-700 hover:bg-gray-200'
                      )}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════
          BOTTOM CTA — "Vous êtes agent ?" conversion section
         ═══════════════════════════════════════════════════════════ */}
      <div className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Vous êtes agent immobilier ?</h2>
              <p className="text-base text-gray-500 max-w-lg">
                Réclamez votre profil gratuitement et débloquez les statistiques vérifiées, les avis clients, et la visibilité premium.
              </p>
            </div>
            <div className="flex gap-3">
              <Link
                to="/register"
                className="h-12 px-8 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center"
              >
                Réclamer mon profil
              </Link>
              <Link
                to="/aide"
                className="h-12 px-6 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors inline-flex items-center"
              >
                En savoir plus
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
    <Footer />
    </>
  )
}
