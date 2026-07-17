/**
 * Page publique — comparatif des plans et de leurs limites.
 *
 * Route : `/help/limits`. Table Starter / Pro / Agency alimentée par `PLAN_LIMITS`,
 * colonne Pro mise en avant.
 */
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import { PLAN_LIMITS } from '@/lib/helpArticles'
import PlansIllustration from '@/components/illustrations/PlansIllustration'

export default function HelpLimitsPage() {
  const { t } = useTranslation('common')
  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
          <Link to="/help" className="hover:text-gray-600 transition-colors">{t('footer.helpCenter')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">{t('help.limits.breadcrumb')}</span>
        </div>

        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 shrink-0"><PlansIllustration /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">{t('help.limits.title')}</h1>
            <p className="text-sm text-gray-500">{t('help.limits.subtitle')}</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-xl">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-700 border-b border-gray-200">{t('help.limits.feature')}</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 border-b border-gray-200">Starter<br /><span className="text-xs font-normal">{t('help.limits.free')}</span></th>
                <th className={cn('text-center px-4 py-3 font-medium text-gray-900 border-b border-gray-200 bg-gray-100')}>Pro<br /><span className="text-xs font-normal">{t('help.limits.pricePerMonth', { price: 'CHF 89' })}</span></th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 border-b border-gray-200">Agency<br /><span className="text-xs font-normal">{t('help.limits.pricePerMonth', { price: 'CHF 249' })}</span></th>
              </tr>
            </thead>
            <tbody>
              {PLAN_LIMITS.map((row, i) => (
                <tr key={i} className="border-b border-gray-100 last:border-0">
                  <td className="px-4 py-3 text-gray-700 font-medium">{row.feature}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{row.starter}</td>
                  <td className="px-4 py-3 text-center text-gray-900 font-medium bg-gray-50">{row.pro}</td>
                  <td className="px-4 py-3 text-center text-gray-500">{row.agency}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500 mt-4 text-center">
          {t('help.limits.customPlanPrompt')} <Link to="/help/contact" className="underline hover:text-gray-600">{t('help.contactUs')}</Link>
        </p>
      </div>
      <Footer />
    </div>
  )
}
