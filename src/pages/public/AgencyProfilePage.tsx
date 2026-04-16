import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Star, Phone, Mail, Globe, ArrowLeft } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { cn, formatCHF } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAgencyProfile } from '@/hooks/useAgentProfile'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import BuyerSidebar from '@/components/search/BuyerSidebar'
import VerifiedBadge from '@/components/directory/VerifiedBadge'
import ClaimProfileCTA from '@/components/directory/ClaimProfileCTA'
import AgentCard from '@/components/directory/AgentCard'

function useAgencyListings(agencyProfileId: string | null | undefined) {
  return useQuery({
    queryKey: ['agency-listings', agencyProfileId],
    enabled: !!agencyProfileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_listings')
        .select('id, title, price, current_price, city, canton, rooms, surface_m2, photos, transaction_type, type')
        .eq('agency_profile_id', agencyProfileId!)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24)
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })
}

const SPECIALTY_KEYS: Record<string, string> = {
  residential: 'specialty.residential',
  commercial: 'specialty.commercial',
  luxury: 'specialty.luxury',
  new: 'specialty.new',
  rental: 'specialty.rental',
}

export default function AgencyProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation('directory')
  const { data, isLoading, error } = useAgencyProfile(slug ?? '')

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-lg bg-theme-hover" />
            <div className="space-y-3 flex-1">
              <div className="h-6 w-56 bg-theme-hover rounded" />
              <div className="h-4 w-40 bg-theme-hover rounded" />
              <div className="h-4 w-28 bg-theme-hover rounded" />
            </div>
          </div>
          <div className="h-40 bg-theme-hover rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-40 bg-theme-hover rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Error / 404
  if (error || !data?.agency) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 text-center">
        <p className="text-base font-medium text-theme-primary mb-2">{t('noResults')}</p>
        <p className="text-sm text-theme-secondary mb-6">{t('noResultsSubtitle')}</p>
        <Link
          to="/agents"
          className="inline-flex h-9 px-4 items-center rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('toggleAgencies')}
        </Link>
      </div>
    )
  }

  const { agency, agents } = data
  const agencyId = (agency as unknown as { id?: string }).id ?? null
  const { data: agencyListings } = useAgencyListings(agencyId)

  return (
    <>
    <Navbar />
    <BuyerSidebar className="hidden md:flex fixed top-[72px] bottom-0 left-0 z-40" />
    <div className="md:ml-[90px] max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
      {/* Back link */}
      <Link
        to="/agents"
        className="inline-flex items-center gap-1.5 text-sm text-theme-secondary hover:text-theme-primary transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('toggleAgencies')}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        {/* Logo */}
        {agency.logo_url ? (
          <img
            src={agency.logo_url}
            alt={agency.name}
            className="w-20 h-20 rounded-lg object-contain flex-shrink-0 bg-theme-hover p-2"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-20 h-20 rounded-lg bg-theme-hover flex items-center justify-center flex-shrink-0">
            <Building2 className="h-8 w-8 text-theme-tertiary" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-theme-primary">{agency.name}</h1>
            <VerifiedBadge status={agency.status} />
          </div>

          {agency.address && (
            <p className="text-sm text-theme-secondary mt-1">{agency.address}</p>
          )}
          <p className="text-sm text-theme-muted">
            {agency.city}{agency.canton ? `, ${agency.canton}` : ''}
          </p>

          {/* Rating */}
          {agency.rating_count > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('h-4 w-4', i < Math.round(agency.rating_avg) ? 'fill-amber-400 text-amber-400' : 'text-theme-border')}
                />
              ))}
              <span className="text-sm text-theme-muted ml-1">({agency.rating_count})</span>
            </div>
          )}

          {/* Contact actions */}
          <div className="flex items-center gap-2 mt-4">
            {agency.phone && (
              <a
                href={`tel:${agency.phone}`}
                className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center gap-1.5"
              >
                <Phone className="h-3.5 w-3.5" />
                {t('contact')}
              </a>
            )}
            {agency.email && (
              <a
                href={`mailto:${agency.email}`}
                className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
            )}
            {agency.website_url && (
              <a
                href={agency.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center gap-1.5"
              >
                <Globe className="h-3.5 w-3.5" />
                {t('profile.website')}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Claim CTA */}
      {agency.status !== 'verified' && (
        <div className="mb-8">
          <ClaimProfileCTA name={agency.name} status={agency.status} />
        </div>
      )}

      {/* About */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-theme-primary mb-4">{t('agency.aboutTitle')}</h2>

        {agency.description ? (
          <p className="text-sm text-theme-secondary leading-relaxed mb-4">{agency.description}</p>
        ) : (
          <p className="text-sm text-theme-muted mb-4">{t('agency.noDescription')}</p>
        )}

        {agency.founded_year && (
          <p className="text-sm text-theme-secondary mb-4">
            {t('agency.foundedYear', { year: agency.founded_year })}
          </p>
        )}

        {/* Zones covered */}
        {agency.zones_covered.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-theme-muted mb-2">{t('agency.zonesCovered')}</p>
            <div className="flex flex-wrap gap-2">
              {agency.zones_covered.map(z => (
                <span key={z} className="h-7 px-3 rounded-lg text-xs font-medium bg-theme-hover text-theme-secondary inline-flex items-center">
                  {z}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Specialties */}
        {agency.specialties.length > 0 && (
          <div className="mb-3">
            <p className="text-xs text-theme-muted mb-2">{t('profile.specialties')}</p>
            <div className="flex flex-wrap gap-2">
              {agency.specialties.map(s => (
                <span key={s} className="h-7 px-3 rounded-lg text-xs font-medium bg-theme-hover text-theme-secondary inline-flex items-center">
                  {SPECIALTY_KEYS[s] ? t(SPECIALTY_KEYS[s]) : s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Certifications */}
        {agency.certifications.length > 0 && (
          <div>
            <p className="text-xs text-theme-muted mb-2">{t('profile.certifications')}</p>
            <div className="flex flex-wrap gap-2">
              {agency.certifications.map(c => (
                <span key={c} className="h-7 px-3 rounded-lg text-xs font-medium bg-theme-hover text-theme-secondary inline-flex items-center">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Team */}
      {agents.length > 0 && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-theme-primary mb-4">
            {t('profile.team')} ({agents.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map(agent => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
        </section>
      )}

      {/* Active listings from this agency */}
      {agencyListings && agencyListings.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-theme-primary mb-4">
            Annonces de cette agence ({agencyListings.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {agencyListings.map((l) => {
              const listing = l as Record<string, unknown>
              const photos = (listing.photos as string[]) || []
              const photo = photos[0]
              const price = Number(listing.current_price ?? listing.price ?? 0)
              const isRent = listing.transaction_type === 'rent'
              return (
                <Link
                  key={listing.id as string}
                  to={`/listing/market-${listing.id}`}
                  className="block bg-white border border-theme-border rounded-lg overflow-hidden hover:border-accent transition-colors group"
                >
                  <div className="aspect-[16/9] bg-theme-hover overflow-hidden">
                    {photo ? (
                      <img src={photo} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" decoding="async" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Building2 className="h-8 w-8 text-theme-muted" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-bold text-theme-primary">
                      {formatCHF(price)}{isRent ? '/mois' : ''}
                    </p>
                    <p className="text-xs text-theme-tertiary truncate">
                      {listing.city as string}{listing.canton ? `, ${listing.canton}` : ''}
                    </p>
                    <div className="flex gap-2 mt-1 text-xs text-theme-muted">
                      {Number(listing.rooms) > 0 && <span>{listing.rooms as number} p.</span>}
                      {Number(listing.surface_m2) > 0 && <span>· {listing.surface_m2 as number} m²</span>}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
    <Footer />
    </>
  )
}
