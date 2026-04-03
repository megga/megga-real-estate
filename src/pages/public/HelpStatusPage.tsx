import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { SERVICES_STATUS } from '@/lib/helpArticles'
import StatusIllustration from '@/components/illustrations/StatusIllustration'

const STATUS_STYLES = {
  operational: { dot: 'bg-emerald-500', label: 'Opérationnel', text: 'text-emerald-600' },
  degraded: { dot: 'bg-amber-500', label: 'Dégradé', text: 'text-amber-600' },
  incident: { dot: 'bg-red-500', label: 'Incident', text: 'text-red-600' },
}

export default function HelpStatusPage() {
  const allOperational = SERVICES_STATUS.every(s => s.status === 'operational')

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">Statut des services</span>
        </div>

        <div className="flex items-center gap-6 mb-2">
          <div className="w-20 h-20 shrink-0"><StatusIllustration /></div>
          <h1 className="text-2xl font-semibold text-gray-900">Statut des services</h1>
        </div>

        {allOperational && (
          <div className="flex items-center gap-2 mb-8 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <p className="text-sm font-medium text-emerald-700">Tous les systèmes sont opérationnels</p>
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
                <span className={cn('text-xs font-medium', style.text)}>{style.label}</span>
              </div>
            )
          })}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Dernière vérification : {new Date().toLocaleDateString('fr-CH')} · Uptime 30 jours : 99.9%
        </p>

        <div className="mt-10 rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">Incidents récents</h2>
          <p className="text-xs text-gray-500">Aucun incident signalé ces 30 derniers jours.</p>
        </div>
      </div>
      <Footer />
    </div>
  )
}
