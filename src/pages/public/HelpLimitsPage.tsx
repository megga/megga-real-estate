import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import { PLAN_LIMITS } from '@/lib/helpArticles'
import PlansIllustration from '@/components/illustrations/PlansIllustration'

export default function HelpLimitsPage() {
  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">Limites et quotas</span>
        </div>

        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 shrink-0"><PlansIllustration /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Limites et quotas par plan</h1>
            <p className="text-sm text-gray-500">Comparez les fonctionnalités disponibles selon votre abonnement.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm border border-gray-200 rounded-xl">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-700 border-b border-gray-200">Fonctionnalité</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 border-b border-gray-200">Starter<br /><span className="text-xs font-normal">Gratuit</span></th>
                <th className={cn('text-center px-4 py-3 font-medium text-gray-900 border-b border-gray-200 bg-gray-100')}>Pro<br /><span className="text-xs font-normal">CHF 89/mois</span></th>
                <th className="text-center px-4 py-3 font-medium text-gray-500 border-b border-gray-200">Agency<br /><span className="text-xs font-normal">CHF 249/mois</span></th>
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
          Besoin d'un plan sur mesure ? <Link to="/aide/contact" className="underline hover:text-gray-600">Contactez-nous</Link>
        </p>
      </div>
      <Footer />
    </div>
  )
}
