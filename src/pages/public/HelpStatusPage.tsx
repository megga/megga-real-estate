/**
 * Page publique — statut des services (Help Center).
 *
 * Route : `/help/status`. Liste l'état de chaque service depuis `SERVICES_STATUS`
 * (statique) avec bandeau récapitulatif si tout est opérationnel. Aucun sondage
 * temps réel : uptime et incidents sont figés.
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import { SERVICES_STATUS } from '@/lib/helpArticles'
import StatusIllustration from '@/components/illustrations/StatusIllustration'

const STATUS_STYLES = {
  operational: { dot: 'bg-emerald-500', labelKey: 'help.status.operational', text: 'text-emerald-600' },
  degraded: { dot: 'bg-amber-500', labelKey: 'help.status.degraded', text: 'text-amber-600' },
  incident: { dot: 'bg-red-500', labelKey: 'help.status.incident', text: 'text-red-600' },
}

export default function HelpStatusPage() {
  const { t } = useTranslation('common')
  const allOperational = SERVICES_STATUS.every(s => s.status === 'operational')

  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
          <Link to="/help" className="hover:text-gray-600 transition-colors">{t('footer.helpCenter')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">{t('help.status.breadcrumb')}</span>
        </div>

        <div className="flex items-center gap-6 mb-2">
          <div className="w-20 h-20 shrink-0"><StatusIllustration /></div>
          <h1 className="text-2xl font-semibold text-gray-900">{t('help.status.title')}</h1>
        </div>

        {allOperational && (
          <div className="flex items-center gap-2 mb-8 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">{t('help.status.allOperational')}</p>
          </div>
        )}

        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {SERVICES_STATUS.map(service => {
            const style = STATUS_STYLES[service.status]
            return (
              <div key={service.name} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className={cn('w-2.5 h-2.5 rounded-full', style.dot)} />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{service.name}</p>
                    <p className="text-xs text-gray-500">{service.description}</p>
                  </div>
                </div>
                <span className={cn('text-xs font-medium', style.text)}>{t(style.labelKey)}</span>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          {t('help.status.lastChecked', { date: new Date().toLocaleDateString('fr-CH'), uptime: '99.9%' })}
        </p>

        <div className="mt-10 rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">{t('help.status.recentIncidents')}</h2>
          <p className="text-xs text-gray-500">{t('help.status.noIncidents')}</p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
