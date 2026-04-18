import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bell, BellOff, ArrowRight, Bookmark, Zap } from 'lucide-react'
import { useSavedSearches } from '@/hooks/useSavedSearches'

interface Props {
  onBack: () => void
  onApplyFilters: (filters: Record<string, string>) => void
  onGoToSaved?: () => void
}

export default function AlertsPanel({ onBack, onApplyFilters, onGoToSaved }: Props) {
  const { t } = useTranslation('common')
  const { searches, toggleAlert } = useSavedSearches()
  const alertSearches = searches.filter(s => s.alertEnabled)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-bold text-gray-900">{t('search.myAlerts')}</h2>
        <span className="text-xs text-gray-500 font-medium">{alertSearches.length}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {alertSearches.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-6 pb-8 px-2">
            <img src="/illustrations/maggy/Alarm.svg" alt="" className="w-64 h-52 mx-auto mb-5" loading="lazy" decoding="async" />
            <p className="text-base font-semibold text-gray-900 mb-1.5">{t('search.noActiveAlerts')}</p>
            <p className="text-[13px] text-gray-500 max-w-[260px] leading-relaxed mb-6">
              {t('search.noActiveAlertsDesc')}
            </p>

            {/* How it works — 3 mini-steps */}
            <div className="w-full max-w-[280px] space-y-2.5 mb-6">
              {[
                { n: '1', label: 'Sauvegarde une recherche' },
                { n: '2', label: 'Active la cloche 🔔' },
                { n: '3', label: 'Reçois les nouveaux biens par email' },
              ].map(step => (
                <div key={step.n} className="flex items-center gap-3 text-left">
                  <span className="shrink-0 h-6 w-6 rounded-full bg-gray-900 text-white text-[11px] font-semibold flex items-center justify-center tabular-nums">
                    {step.n}
                  </span>
                  <span className="text-[13px] text-gray-700">{step.label}</span>
                </div>
              ))}
            </div>

            {/* Frequency preview chips */}
            <div className="flex items-center gap-1.5 mb-5">
              {['Instantané', 'Quotidien', 'Hebdo'].map(f => (
                <span
                  key={f}
                  className="inline-flex items-center gap-1 h-7 px-3 rounded-full bg-gray-50 border border-gray-100 text-[11px] font-medium text-gray-600 tabular-nums"
                >
                  <Zap className="h-3 w-3 text-gray-400" strokeWidth={2} />
                  {f}
                </span>
              ))}
            </div>

            {/* Primary CTA */}
            {onGoToSaved && (
              <button
                onClick={onGoToSaved}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer shadow-[0_4px_12px_-4px_rgba(15,23,42,0.25)]"
              >
                <Bookmark className="h-4 w-4" strokeWidth={2} />
                Créer une alerte
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {alertSearches.map(search => (
              <div key={search.id} className="rounded-xl border border-gray-100 p-3.5">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="h-3.5 w-3.5 text-blue-500" />
                  <p className="text-sm font-bold text-gray-900 truncate flex-1">{search.name}</p>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {t('search.frequency')} : {search.alertFrequency === 'daily' ? t('search.frequencyDaily') : search.alertFrequency === 'weekly' ? t('search.frequencyWeekly') : t('search.frequencyInstant')}
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const f: Record<string, string> = {}
                      if (search.filters.minPrice) f.minPrice = search.filters.minPrice
                      if (search.filters.maxPrice) f.maxPrice = search.filters.maxPrice
                      if (search.filters.rooms) f.rooms = search.filters.rooms
                      if (search.filters.canton) f.canton = search.filters.canton
                      onApplyFilters(f)
                    }}
                    className="flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer"
                  >
                    {t('search.viewResults')} <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => toggleAlert(search.id)}
                    className="flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs font-medium text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer ml-auto"
                  >
                    <BellOff className="h-3 w-3" />
                    {t('search.disable')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
