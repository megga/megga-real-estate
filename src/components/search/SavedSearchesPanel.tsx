import { useTranslation } from 'react-i18next'
import { ArrowLeft, Bell, BellOff, Trash2, ArrowRight, Bookmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSavedSearches } from '@/hooks/useSavedSearches'
import AiSparkle from '@/components/icons/AiSparkle'

interface Props {
  onBack: () => void
  onApplyFilters: (filters: Record<string, string>) => void
  onCreateSearch?: () => void
}

export default function SavedSearchesPanel({ onBack, onApplyFilters, onCreateSearch }: Props) {
  const { t } = useTranslation('common')
  const { searches, deleteSearch, toggleAlert, count } = useSavedSearches()

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
        <button onClick={onBack} className="text-gray-500 hover:text-gray-700 transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h2 className="text-sm font-bold text-gray-900">{t('search.mySearches')}</h2>
        <span className="text-xs text-gray-500 font-medium">{count}</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
        {searches.length === 0 ? (
          <div className="flex flex-col items-center text-center pt-6 pb-8 px-2">
            <img src="/illustrations/maggy/Folder.svg" alt="" className="w-64 h-52 mx-auto mb-5" loading="lazy" decoding="async" />
            <p className="text-base font-semibold text-gray-900 mb-1.5">{t('search.noSavedSearches')}</p>
            <p className="text-[13px] text-gray-500 max-w-[260px] leading-relaxed mb-6">
              {t('search.saveSearchToReceiveAlerts')}
            </p>

            {/* Visual teaser — pseudo saved-search card */}
            <div className="relative w-full max-w-[260px] mb-6 rounded-2xl border border-gray-100 bg-white p-3.5 shadow-[0_10px_24px_-12px_rgba(15,23,42,0.12)] text-left">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 h-8 w-8 rounded-xl bg-gray-900 text-white flex items-center justify-center">
                  <Bookmark className="h-4 w-4" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">Appartement à Genève</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    {['4 pièces', '< CHF 1.2M', 'GE'].map(chip => (
                      <span key={chip} className="inline-flex h-5 items-center px-2 rounded-full bg-gray-50 border border-gray-100 text-[10px] font-medium text-gray-600 tabular-nums">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-white shadow-[0_4px_10px_-3px_rgba(37,99,235,0.35)] border border-blue-100 flex items-center justify-center">
                <Bell className="h-3.5 w-3.5 fill-blue-500 text-blue-500 animate-pulse" strokeWidth={2} />
              </div>
            </div>

            {/* Value-prop bullets */}
            <div className="w-full max-w-[280px] space-y-2 mb-6 text-left">
              <div className="flex items-start gap-2.5">
                <AiSparkle className="h-3.5 w-3.5 text-gray-900 mt-0.5 shrink-0" />
                <span className="text-[12px] text-gray-600">Retrouve tes filtres d'un clic, sans tout re-saisir</span>
              </div>
              <div className="flex items-start gap-2.5">
                <Bell className="h-3.5 w-3.5 text-gray-900 mt-0.5 shrink-0" strokeWidth={2} />
                <span className="text-[12px] text-gray-600">Active une alerte pour être prévenu des nouveaux biens</span>
              </div>
            </div>

            {/* Primary CTA */}
            <button
              onClick={onCreateSearch || onBack}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-full bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors cursor-pointer shadow-[0_4px_12px_-4px_rgba(15,23,42,0.25)]"
            >
              <Bookmark className="h-4 w-4" strokeWidth={2} />
              Sauvegarder ma recherche
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {searches.map(search => {
              const chips: string[] = []
              if (search.filters.types?.length) chips.push(search.filters.types.join(', '))
              else chips.push('Tous types')
              if (search.filters.minPrice || search.filters.maxPrice) {
                const min = search.filters.minPrice ? `dès ${Number(search.filters.minPrice).toLocaleString('fr-CH')}` : ''
                const max = search.filters.maxPrice ? `max ${Number(search.filters.maxPrice).toLocaleString('fr-CH')}` : ''
                chips.push([min, max].filter(Boolean).join(' – '))
              }
              if (search.filters.rooms) chips.push(`${search.filters.rooms}p`)
              if (search.filters.canton) chips.push(String(search.filters.canton))
              return (
                <div
                  key={search.id}
                  className="rounded-2xl border border-gray-100 p-4 hover:border-gray-200 hover:shadow-[0_10px_24px_-14px_rgba(15,23,42,0.12)] transition-all"
                >
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <p className="text-sm font-semibold text-gray-900 truncate flex-1">{search.name}</p>
                    <button
                      onClick={() => deleteSearch(search.id)}
                      aria-label={t('actions.delete')}
                      className="shrink-0 h-7 w-7 flex items-center justify-center rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>

                  {/* Filter chips */}
                  <div className="flex flex-wrap gap-1 mb-3">
                    {chips.map((chip, i) => (
                      <span
                        key={`${search.id}-${i}`}
                        className="inline-flex h-6 items-center px-2.5 rounded-full bg-gray-50 border border-gray-100 text-[11px] font-medium text-gray-600 tabular-nums"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleAlert(search.id)}
                      className={cn(
                        'flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-semibold transition-colors cursor-pointer',
                        search.alertEnabled
                          ? 'bg-gray-900 text-white border border-gray-900'
                          : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
                      )}
                    >
                      {search.alertEnabled ? <Bell className="h-3 w-3" strokeWidth={2.25} /> : <BellOff className="h-3 w-3" strokeWidth={2} />}
                      {search.alertEnabled ? t('search.alertsOn') : t('search.alertsOff')}
                    </button>

                    <button
                      onClick={() => {
                        const f: Record<string, string> = {}
                        if (search.filters.minPrice) f.minPrice = search.filters.minPrice
                        if (search.filters.maxPrice) f.maxPrice = search.filters.maxPrice
                        if (search.filters.rooms) f.rooms = search.filters.rooms
                        if (search.filters.canton) f.canton = search.filters.canton
                        if (search.filters.types?.length) f.types = search.filters.types.join(',')
                        onApplyFilters(f)
                      }}
                      className="ml-auto flex items-center gap-1.5 h-8 px-3.5 rounded-full text-[12px] font-semibold bg-gray-900 text-white hover:bg-gray-800 transition-colors cursor-pointer"
                    >
                      {t('actions.view')} <ArrowRight className="h-3 w-3" strokeWidth={2.25} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
