import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Star, Phone, Mail, Globe, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAgentProfile } from '@/hooks/useAgentProfile'
import { useAgentReviews } from '@/hooks/useAgentReviews'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import BuyerSidebar from '@/components/search/BuyerSidebar'
import VerifiedBadge from '@/components/directory/VerifiedBadge'
import ClaimProfileCTA from '@/components/directory/ClaimProfileCTA'
import AgentStatsPanel from '@/components/directory/AgentStatsPanel'
import ReviewCard from '@/components/directory/ReviewCard'
import ReviewForm from '@/components/directory/ReviewForm'

const SPECIALTY_KEYS: Record<string, string> = {
  residential: 'specialty.residential',
  commercial: 'specialty.commercial',
  luxury: 'specialty.luxury',
  new: 'specialty.new',
  rental: 'specialty.rental',
}

export default function AgentProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation('directory')
  const { data, isLoading, error } = useAgentProfile(slug ?? '')
  const [reviewSort, setReviewSort] = useState<'recent' | 'best'>('recent')
  const { data: reviews } = useAgentReviews(data?.agent?.id ?? '', reviewSort)

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-theme-hover" />
            <div className="space-y-3 flex-1">
              <div className="h-6 w-48 bg-theme-hover rounded" />
              <div className="h-4 w-32 bg-theme-hover rounded" />
              <div className="h-4 w-24 bg-theme-hover rounded" />
            </div>
          </div>
          <div className="h-40 bg-theme-hover rounded-xl" />
          <div className="h-60 bg-theme-hover rounded-xl" />
        </div>
      </div>
    )
  }

  // Error / 404
  if (error || !data?.agent) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-16 text-center">
        <p className="text-base font-medium text-theme-primary mb-2">{t('noResults')}</p>
        <p className="text-sm text-theme-secondary mb-6">{t('noResultsSubtitle')}</p>
        <Link
          to="/agents"
          className="inline-flex h-9 px-4 items-center rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('toggleAgents')}
        </Link>
      </div>
    )
  }

  const { agent, agency } = data
  const fullName = `${agent.first_name} ${agent.last_name}`
  const initials = `${agent.first_name[0] ?? ''}${agent.last_name[0] ?? ''}`.toUpperCase()

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
        {t('toggleAgents')}
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start gap-6 mb-8">
        {/* Photo */}
        {agent.photo_url ? (
          <img
            src={agent.photo_url}
            alt={fullName}
            className="w-24 h-24 rounded-full object-cover flex-shrink-0"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-theme-hover flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-semibold text-theme-secondary">{initials}</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-theme-primary">{fullName}</h1>
            <VerifiedBadge status={agent.status} />
          </div>

          {agency && (
            <Link
              to={`/agences/${agency.slug}`}
              className="text-sm text-accent hover:underline mt-1 block"
            >
              {agency.name}
            </Link>
          )}

          <p className="text-sm text-theme-secondary mt-1">
            {agent.city}{agent.canton ? `, ${agent.canton}` : ''}
          </p>

          {/* Rating */}
          {agent.rating_count > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={cn('h-4 w-4', i < Math.round(agent.rating_avg) ? 'fill-amber-400 text-amber-400' : 'text-theme-border')}
                />
              ))}
              <span className="text-sm text-theme-muted ml-1">({agent.rating_count})</span>
            </div>
          )}

          {/* Contact actions */}
          <div className="flex items-center gap-2 mt-4">
            {agent.phone && (
              <a
                href={`tel:${agent.phone}`}
                className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center gap-1.5"
              >
                <Phone className="h-3.5 w-3.5" />
                {t('contact')}
              </a>
            )}
            {agent.email && (
              <a
                href={`mailto:${agent.email}`}
                className="h-9 px-3.5 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors inline-flex items-center gap-1.5"
              >
                <Mail className="h-3.5 w-3.5" />
                Email
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Claim CTA */}
      {agent.status !== 'verified' && (
        <div className="mb-8">
          <ClaimProfileCTA name={fullName} status={agent.status} />
        </div>
      )}

      {/* 2-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-8">
          {/* About */}
          <section>
            <h2 className="text-lg font-semibold text-theme-primary mb-4">{t('profile.about')}</h2>

            {agent.bio && (
              <p className="text-sm text-theme-secondary leading-relaxed mb-4">{agent.bio}</p>
            )}

            {agent.experience_years != null && agent.experience_years > 0 && (
              <p className="text-sm text-theme-secondary mb-4">
                {t('profile.experience', { years: agent.experience_years })}
              </p>
            )}

            {/* Specialties */}
            {agent.specialties.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-theme-muted mb-2">{t('profile.specialties')}</p>
                <div className="flex flex-wrap gap-2">
                  {agent.specialties.map(s => (
                    <span key={s} className="h-7 px-3 rounded-lg text-xs font-medium bg-theme-hover text-theme-secondary inline-flex items-center">
                      {SPECIALTY_KEYS[s] ? t(SPECIALTY_KEYS[s]) : s}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Languages */}
            {agent.languages.length > 0 && (
              <div className="mb-3">
                <p className="text-xs text-theme-muted mb-2">{t('profile.languages')}</p>
                <div className="flex flex-wrap gap-2">
                  {agent.languages.map(l => (
                    <span key={l} className="h-7 px-3 rounded-lg text-xs font-medium bg-theme-hover text-theme-secondary inline-flex items-center capitalize">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {agent.certifications.length > 0 && (
              <div>
                <p className="text-xs text-theme-muted mb-2">{t('profile.certifications')}</p>
                <div className="flex flex-wrap gap-2">
                  {agent.certifications.map(c => (
                    <span key={c} className="h-7 px-3 rounded-lg text-xs font-medium bg-theme-hover text-theme-secondary inline-flex items-center">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Reviews */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-theme-primary">{t('profile.reviews')}</h2>
              <div className="flex items-center gap-2">
                {(['recent', 'best'] as const).map(sort => (
                  <button
                    key={sort}
                    onClick={() => setReviewSort(sort)}
                    className={cn(
                      'h-8 px-3 rounded-lg text-xs transition-colors',
                      reviewSort === sort
                        ? 'bg-theme-active text-theme-primary font-medium'
                        : 'text-theme-secondary hover:text-theme-primary'
                    )}
                  >
                    {sort === 'recent' ? t('review.sortRecent') : t('review.sortBest')}
                  </button>
                ))}
              </div>
            </div>

            {reviews && reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map(review => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-theme-muted py-6 text-center">{t('review.noReviews')}</p>
            )}

            {/* Review form */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-theme-primary mb-3">{t('review.writeReview')}</h3>
              <ReviewForm agentProfileId={agent.id} />
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <AgentStatsPanel agent={agent} />

          {/* Contact info */}
          {(agent.phone || agent.email || agent.website_url) && (
            <div className="rounded-xl border border-theme-border p-5 space-y-3">
              {agent.phone && (
                <a href={`tel:${agent.phone}`} className="flex items-center gap-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
                  <Phone className="h-4 w-4 text-theme-muted flex-shrink-0" />
                  {agent.phone}
                </a>
              )}
              {agent.email && (
                <a href={`mailto:${agent.email}`} className="flex items-center gap-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
                  <Mail className="h-4 w-4 text-theme-muted flex-shrink-0" />
                  {agent.email}
                </a>
              )}
              {agent.website_url && (
                <a href={agent.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-theme-secondary hover:text-theme-primary transition-colors">
                  <Globe className="h-4 w-4 text-theme-muted flex-shrink-0" />
                  {t('profile.website')}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    <Footer />
    </>
  )
}
