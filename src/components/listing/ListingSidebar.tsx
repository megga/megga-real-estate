import { useTranslation } from 'react-i18next'
import { Heart, Share2, Calculator, CalendarDays, Mail, Phone } from 'lucide-react'
import { cn, formatCHF, formatRent, resolveRegieContact } from '@/lib/utils'
import AgentCard from './AgentCard'
import RegieContactCard from './RegieContactCard'

interface ListingSidebarProps {
  listing: {
    price: number
    charges_monthly: number
    transaction_type?: 'buy' | 'rent'
    is_furnished?: boolean
    deposit_months?: number | null
    external_regie?: { name?: string; phone?: string; email?: string; website?: string } | null
    agent: {
      name: string
      agency: string
      phone: string
      email: string
      photo: string
    }
  }
  isFavorite: boolean
  onToggleFavorite: () => void
  onContact: () => void
  onVisit: () => void
  onCalculator: () => void
}

export default function ListingSidebar({
  listing,
  isFavorite,
  onToggleFavorite,
  onContact,
  onVisit,
  onCalculator,
}: ListingSidebarProps) {
  const { t } = useTranslation('common')
  const isRent = listing.transaction_type === 'rent'
  const regie = isRent
    ? resolveRegieContact(
        { external_regie: listing.external_regie },
        {
          name: listing.agent.agency || listing.agent.name,
          phone: listing.agent.phone,
          email: listing.agent.email,
        },
      )
    : null

  return (
    <div className="hidden lg:block w-[360px] flex-shrink-0">
      <div className="sticky top-28 space-y-4">
        {/* Price + CTA */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <p className="text-3xl font-bold text-gray-900 mb-1">
            {isRent ? formatRent(listing.price) : formatCHF(listing.price)}
          </p>
          {isRent && listing.is_furnished && (
            <p className="text-xs text-gray-500 mt-0.5">{t('rental.badgeFurnished', 'Meublé')}</p>
          )}
          {isRent && listing.deposit_months && (
            <p className="text-xs text-gray-500 mt-0.5">
              {t('rental.deposit', 'Caution : {{count}} mois', { count: listing.deposit_months })}
            </p>
          )}
          {listing.charges_monthly > 0 && (
            <p className="text-sm text-gray-500">
              {t('listing.charges', { amount: formatCHF(listing.charges_monthly) })}
            </p>
          )}

          {/* Primary CTA — rent uses single "Contacter la régie" */}
          {isRent ? (
            <a
              href={regie?.phone ? `tel:${regie.phone}` : '#regie-contact'}
              onClick={regie?.phone ? undefined : (e) => { e.preventDefault(); document.getElementById('regie-contact')?.scrollIntoView({ behavior: 'smooth' }) }}
              className="w-full h-12 mt-5 flex items-center justify-center gap-2 text-sm font-semibold border border-gray-200 text-gray-900 rounded-lg hover:border-accent hover:text-accent transition-colors"
            >
              <Phone className="h-4 w-4" />
              {t('rental.contactRegie', 'Contacter la régie')}
            </a>
          ) : (
            <>
              <button
                onClick={onContact}
                className="w-full h-12 mt-5 flex items-center justify-center gap-2 text-sm font-semibold border border-gray-200 text-gray-900 rounded-lg hover:border-accent hover:text-accent transition-colors"
              >
                <Mail className="h-4 w-4" />
                {t('listing.contactAgent')}
              </button>

              {/* Secondary CTA */}
              <button
                onClick={onVisit}
                className="w-full h-11 mt-2 flex items-center justify-center gap-2 text-sm font-medium border border-gray-200 text-gray-700 rounded-lg hover:border-accent hover:text-accent hover:bg-gray-50 transition-colors"
              >
                <CalendarDays className="h-4 w-4" />
                {t('listing.planVisit')}
              </button>
            </>
          )}

          {/* Action row */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-gray-50">
            <button
              onClick={onToggleFavorite}
              className={cn(
                'flex-1 h-10 rounded-lg border flex items-center justify-center gap-2 text-sm font-medium transition-colors',
                isFavorite
                  ? 'bg-red-50 border-red-200 text-red-500'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              <Heart className={cn('h-4 w-4', isFavorite && 'fill-current')} />
              {isFavorite ? t('listing.saved') : t('listing.save')}
            </button>
            <button className="h-10 w-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 transition-colors">
              <Share2 className="h-4 w-4" />
            </button>
          </div>

          {/* Calculator — hide in rent (not relevant) */}
          {!isRent && (
            <button
              onClick={onCalculator}
              className="w-full h-11 mt-3 flex items-center justify-center gap-2 text-sm font-medium text-gray-500 border border-gray-100 rounded-lg hover:text-accent hover:border-gray-200 transition-colors"
            >
              <Calculator className="h-4 w-4" />
              {t('listing.canIAfford')}
            </button>
          )}
        </div>

        {/* Contact card — regie (rent) or agent (buy) */}
        {isRent && regie ? (
          <div id="regie-contact">
            <RegieContactCard regie={regie} className="bg-white shadow-sm" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <p className="text-xs font-medium text-gray-500 capitalize mb-3">{t('listing.yourContact')}</p>
            <AgentCard variant="default" agent={listing.agent} />
          </div>
        )}
      </div>
    </div>
  )
}
