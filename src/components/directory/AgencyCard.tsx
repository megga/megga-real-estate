import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Star, Users, Home, ShieldCheck, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AgencyProfileRow } from '@/hooks/useAgentDirectory'

interface AgencyCardProps {
  agency: AgencyProfileRow
}

export default function AgencyCard({ agency }: AgencyCardProps) {
  const { t } = useTranslation('directory')

  return (
    <Link
      to={`/agences/${agency.slug}`}
      className="group bg-white rounded-lg border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all block"
    >
      <div className="flex items-start gap-5 p-5 md:p-6">
        {/* Logo — square with rounded corners like Zillow */}
        <div className="flex-shrink-0">
          {agency.logo_url ? (
            <img
              src={agency.logo_url}
              alt={agency.name}
              className="w-20 h-20 md:w-24 md:h-24 rounded-xl object-contain bg-gray-50 border border-gray-100 p-2"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-gray-100 flex items-center justify-center border border-gray-100">
              <Building2 className="h-8 w-8 text-gray-400" />
            </div>
          )}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          {/* Name + badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
              {agency.name}
            </h3>
            {agency.status === 'verified' && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" />
                {t('badge.verified')}
              </span>
            )}
          </div>

          {/* Location */}
          <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
            <MapPin className="h-3.5 w-3.5" />
            {agency.city}{agency.canton ? `, ${agency.canton}` : ''}
            {agency.address && ` — ${agency.address}`}
          </p>

          {/* Rating */}
          <div className="flex items-center gap-2 mt-2">
            {agency.rating_count > 0 ? (
              <>
                <span className="text-base font-bold text-gray-900">{Number(agency.rating_avg).toFixed(1)}</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-4 w-4',
                        i < Math.round(agency.rating_avg) ? 'fill-blue-600 text-blue-600' : 'fill-gray-200 text-gray-200'
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-500">
                  ({agency.rating_count} avis)
                </span>
              </>
            ) : (
              <span className="text-sm text-gray-400">Pas encore d'avis</span>
            )}
          </div>

          {/* Counters — Zillow style compact stats */}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <Users className="h-3.5 w-3.5 text-gray-400" />
              <span className="font-medium">{agency.agent_count}</span>
              <span>{agency.agent_count === 1 ? 'agent' : 'agents'}</span>
            </div>
            {agency.active_listings_count > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Home className="h-3.5 w-3.5 text-gray-400" />
                <span className="font-medium">{agency.active_listings_count}</span>
                <span>{agency.active_listings_count === 1 ? 'bien actif' : 'biens actifs'}</span>
              </div>
            )}
          </div>

          {/* Zones covered */}
          {agency.zones_covered.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {agency.zones_covered.slice(0, 4).map(z => (
                <span key={z} className="text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded-md">{z}</span>
              ))}
              {agency.zones_covered.length > 4 && (
                <span className="text-xs text-gray-500 px-2 py-0.5">+{agency.zones_covered.length - 4}</span>
              )}
            </div>
          )}
        </div>

        {/* Right side CTA */}
        <div className="hidden md:flex flex-col items-end gap-2 flex-shrink-0">
          <span className="h-10 px-5 bg-blue-600 group-hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors inline-flex items-center">
            {t('viewAgency')}
          </span>
          {agency.phone && (
            <span className="text-xs text-gray-500">{agency.phone}</span>
          )}
        </div>
      </div>
    </Link>
  )
}
