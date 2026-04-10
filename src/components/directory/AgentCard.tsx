import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Star, Phone, ShieldCheck, TrendingUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgentProfileRow } from '@/hooks/useAgentDirectory'

interface AgentCardProps {
  agent: AgentProfileRow
}

const SPECIALTY_KEYS: Record<string, string> = {
  residential: 'specialty.residential',
  commercial: 'specialty.commercial',
  luxury: 'specialty.luxury',
  new: 'specialty.new',
  rental: 'specialty.rental',
}

export default function AgentCard({ agent }: AgentCardProps) {
  const { t } = useTranslation('directory')
  const initials = `${agent.first_name[0] ?? ''}${agent.last_name[0] ?? ''}`.toUpperCase()

  return (
    <Link
      to={`/agents/${agent.slug}`}
      className="group bg-white rounded-lg border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all block"
    >
      <div className="flex items-start gap-5 p-5 md:p-6">
        {/* Avatar — large circle like Zillow */}
        <div className="flex-shrink-0">
          {agent.photo_url ? (
            <img
              src={agent.photo_url}
              alt={`${agent.first_name} ${agent.last_name}`}
              className="w-20 h-20 md:w-24 md:h-24 rounded-full object-cover border-2 border-gray-100"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-blue-50 flex items-center justify-center border-2 border-blue-100">
              <span className="text-xl md:text-2xl font-bold text-blue-600">{initials}</span>
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Name + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
              {agent.first_name} {agent.last_name}
            </h3>
            {agent.status === 'verified' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                {t('badge.verified')}
              </span>
            )}
          </div>

          {/* Agency + location */}
          {agent.agency_name && (
            <p className="text-sm text-gray-600 mt-0.5">{agent.agency_name}</p>
          )}
          <p className="text-sm text-gray-500">
            {agent.city}{agent.canton ? `, ${agent.canton}` : ''}
          </p>

          {/* Rating — Zillow style: bold number + stars + review count */}
          <div className="flex items-center gap-2 mt-2">
            {agent.rating_count > 0 ? (
              <>
                <span className="text-base font-bold text-gray-900">{Number(agent.rating_avg).toFixed(1)}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < Math.round(agent.rating_avg) ? 'fill-blue-600 text-blue-600' : 'fill-gray-200 text-gray-200'
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500">
                  ({agent.rating_count})
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-500">{t('review.noReviews')}</span>
            )}
          </div>

          {/* Stats row — Zillow style */}
          {agent.status === 'verified' && agent.stats_properties_sold > 0 && (
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <TrendingUp className="h-3.5 w-3.5 text-gray-500" />
                <span className="font-medium">{agent.stats_properties_sold}</span>
                <span>{t('recentSales')}</span>
              </div>
              {agent.stats_avg_days_to_sell > 0 && (
                <div className="text-sm text-gray-500">
                  <span className="font-medium">{agent.stats_avg_days_to_sell}{t('avgDaysSuffix')}</span>
                </div>
              )}
            </div>
          )}

          {/* Specialties + languages — compact pills */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {agent.specialties.slice(0, 3).map(s => (
              <span key={s} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">
                {SPECIALTY_KEYS[s] ? t(SPECIALTY_KEYS[s]) : s}
              </span>
            ))}
            {agent.languages.length > 0 && (
              <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded-md capitalize">
                {agent.languages.join(' · ')}
              </span>
            )}
          </div>
        </div>

        {/* Right side CTA — Zillow style */}
        <div className="hidden md:flex flex-col items-end gap-2 flex-shrink-0">
          <span className="h-10 px-5 bg-blue-600 group-hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center">
            {t('viewProfile')}
          </span>
          {agent.phone && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {agent.phone}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
