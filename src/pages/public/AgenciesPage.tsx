import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Search, MapPin, Globe, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'

// ─── Swiss cantons ──────────────────────────────────────────

const CANTONS = [
  'AG','AI','AR','BE','BL','BS','FR','GE','GL','GR',
  'JU','LU','NE','NW','OW','SG','SH','SO','SZ','TG',
  'TI','UR','VD','VS','ZG','ZH',
]

const CANTON_LABELS: Record<string, string> = {
  AG: 'Argovie', AI: 'Appenzell RI', AR: 'Appenzell RE', BE: 'Berne', BL: 'Bâle-Campagne',
  BS: 'Bâle-Ville', FR: 'Fribourg', GE: 'Genève', GL: 'Glaris', GR: 'Grisons',
  JU: 'Jura', LU: 'Lucerne', NE: 'Neuchâtel', NW: 'Nidwald', OW: 'Obwald',
  SG: 'Saint-Gall', SH: 'Schaffhouse', SO: 'Soleure', SZ: 'Schwytz', TG: 'Thurgovie',
  TI: 'Tessin', UR: 'Uri', VD: 'Vaud', VS: 'Valais', ZG: 'Zoug', ZH: 'Zurich',
}

// ─── Hook ───────────────────────────────────────────────────

function useAgencies() {
  return useQuery({
    queryKey: ['agencies-directory'],
    queryFn: async () => {
      // Supabase default limit is 1000, paginate to get all
      type Agency = { id: string; name: string; slug: string; canton: string | null; city: string | null; address: string | null; phone: string | null; email: string | null; website_url: string | null; logo_url: string | null; status: string | null; source: string | null }
      const all: Agency[] = []
      let from = 0
      const pageSize = 1000
      while (true) {
        const { data, error } = await supabase
          .from('agency_profiles')
          .select('id, name, slug, canton, city, address, phone, email, website_url, logo_url, status, source')
          .order('name')
          .range(from, from + pageSize - 1)
        if (error) throw error
        if (!data || data.length === 0) break
        all.push(...data)
        if (data.length < pageSize) break
        from += pageSize
      }
      return all
    },
    staleTime: 5 * 60 * 1000,
  })
}

// ─── Agency card ────────────────────────────────────────────

function AgencyCard({ agency }: { agency: { id: string; name: string; slug: string; canton: string | null; city: string | null; logo_url: string | null; website_url: string | null } }) {
  const initials = agency.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <Link
      to={`/agences/${agency.slug}`}
      className="group flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all"
    >
      {/* Logo */}
      <div className="w-14 h-14 rounded-xl border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0 bg-white">
        {agency.logo_url ? (
          <img
            src={agency.logo_url}
            alt={agency.name}
            className="w-10 h-10 object-contain"
            loading="lazy"
            decoding="async"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden') }}
          />
        ) : null}
        <span className={cn('text-sm font-bold text-gray-500', agency.logo_url && 'hidden')}>{initials}</span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-gray-700 transition-colors">
          {agency.name}
        </h3>
        <div className="flex items-center gap-1.5 mt-1">
          {agency.city && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <MapPin className="w-3 h-3" />
              {agency.city}{agency.canton ? ` (${agency.canton})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Website indicator */}
      {agency.website_url && (
        <Globe className="w-4 h-4 text-gray-500 flex-shrink-0" />
      )}
    </Link>
  )
}

// ─── Page ───────────────────────────────────────────────────

export default function AgenciesPage() {
  const { t } = useTranslation('directory')
  const { data: agencies, isLoading } = useAgencies()
  const [search, setSearch] = useState('')
  const [canton, setCanton] = useState('')
  const [cantonOpen, setCantonOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!agencies) return []
    let list = agencies
    if (canton) list = list.filter(a => a.canton === canton)
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.city && a.city.toLowerCase().includes(q))
      )
    }
    return list
  }, [agencies, search, canton])

  const withLogo = filtered.filter(a => a.logo_url).length

  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pt-16 pb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
          {t('agencies.title')}
        </h1>
        <p className="mt-3 text-gray-500 text-lg max-w-2xl">
          {t('agencies.subtitle', { count: agencies?.length?.toLocaleString('fr-CH') ?? '—' })}
        </p>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row gap-3 mt-8">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t('agencies.searchPlaceholder')}
              className="w-full h-11 pl-10 pr-4 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          {/* Canton filter */}
          <div className="relative">
            <button
              onClick={() => setCantonOpen(!cantonOpen)}
              className="h-11 px-4 text-sm font-medium border border-gray-200 rounded-lg flex items-center gap-2 hover:border-gray-300 transition-colors min-w-[160px] justify-between"
            >
              <span className={canton ? 'text-gray-900' : 'text-gray-500'}>
                {canton ? CANTON_LABELS[canton] || canton : t('agencies.allCantons')}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
            </button>
            {cantonOpen && (
              <div className="absolute right-0 sm:left-0 mt-1.5 w-56 bg-white rounded-xl shadow-lg border border-gray-100 py-1 z-50 max-h-72 overflow-y-auto">
                <button
                  onClick={() => { setCanton(''); setCantonOpen(false) }}
                  className={cn('w-full text-left px-4 py-2 text-sm hover:bg-gray-50', !canton && 'font-medium text-gray-900 bg-gray-50')}
                >
                  {t('agencies.allCantons')}
                </button>
                {CANTONS.map(c => (
                  <button
                    key={c}
                    onClick={() => { setCanton(c); setCantonOpen(false) }}
                    className={cn('w-full text-left px-4 py-2 text-sm hover:bg-gray-50', canton === c && 'font-medium text-gray-900 bg-gray-50')}
                  >
                    {CANTON_LABELS[c] || c} <span className="text-gray-500 ml-1">({c})</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-20">
        {/* Counter */}
        <div className="flex items-center justify-between mb-6">
          <p className="text-sm text-gray-500">
            {filtered.length > 1 ? t('agencies.count_plural', { count: filtered.length.toLocaleString('fr-CH') }) : t('agencies.count', { count: filtered.length })}
            {canton && ` ${t('agencies.inCanton', { canton: CANTON_LABELS[canton] || canton })}`}
            {withLogo > 0 && ` · ${t('agencies.withLogo', { count: withLogo })}`}
          </p>
          {search && (
            <button onClick={() => setSearch('')} className="text-xs text-accent hover:underline">
              {t('agencies.clearSearch')}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-gray-50 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-500">{t('agencies.noResult')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map(agency => (
              <AgencyCard key={agency.id} agency={agency} />
            ))}
          </div>
        )}
      </div>

      <Footer />
    </div>
  )
}
