import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { X, Bell, BellOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSavedSearches, generateSearchName, type SavedSearchFilters } from '@/hooks/useSavedSearches'

interface SaveSearchDialogProps {
  open: boolean
  onClose: () => void
  filters: SavedSearchFilters
  resultsCount: number
}

export default function SaveSearchDialog({ open, onClose, filters, resultsCount }: SaveSearchDialogProps) {
  const { t } = useTranslation('common')
  const { saveSearch, maxReached } = useSavedSearches()
  const [name, setName] = useState(() => generateSearchName(filters))
  const [email, setEmail] = useState('')
  const [alertEnabled, setAlertEnabled] = useState(true)
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('daily')
  const [saved, setSaved] = useState(false)

  if (!open) return null

  function handleSave() {
    if (!name.trim()) return
    saveSearch(name.trim(), filters, alertEnabled, frequency, email || undefined, resultsCount)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1500)
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-semibold text-gray-900">{t('search.saveThisSearch')}</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-gray-500 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {saved ? (
          <div className="px-5 py-10 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Bell className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">{t('search.searchSaved')}</p>
            {alertEnabled && (
              <p className="text-xs text-gray-500 mt-1">{t('search.willReceiveAlerts', { frequency: frequency === 'daily' ? t('search.frequencyDaily') : t('search.frequencyWeekly') })}</p>
            )}
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            {maxReached && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{t('search.maxSearchesReached')}</p>
            )}

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('search.searchName')}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                placeholder={t('search.mySearch')}
              />
            </div>

            {/* Results count info */}
            <p className="text-xs text-gray-500">{t('search.matchingProperties', { count: resultsCount.toLocaleString('fr-CH') })}</p>

            {/* Alert toggle */}
            <div className="flex items-center justify-between py-3 border-y border-gray-100">
              <div className="flex items-center gap-2.5">
                {alertEnabled ? <Bell className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-gray-500" />}
                <div>
                  <p className="text-sm font-medium text-gray-900">{t('search.emailAlerts')}</p>
                  <p className="text-xs text-gray-500">{t('search.emailAlertsDesc')}</p>
                </div>
              </div>
              <button
                onClick={() => setAlertEnabled(!alertEnabled)}
                className={cn(
                  'relative w-10 h-6 rounded-full transition-colors',
                  alertEnabled ? 'bg-accent' : 'bg-gray-200'
                )}
              >
                <div className={cn(
                  'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform',
                  alertEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                )} />
              </button>
            </div>

            {/* Frequency (visible only if alerts enabled) */}
            {alertEnabled && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-2 block">{t('search.frequency')}</label>
                <div className="flex gap-2">
                  {(['daily', 'weekly'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFrequency(f)}
                      className={cn(
                        'flex-1 h-9 rounded-lg text-sm font-medium transition-colors',
                        frequency === f
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                      )}
                    >
                      {f === 'daily' ? t('search.daily') : t('search.weekly')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Email (visible only if alerts enabled) */}
            {alertEnabled && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">{t('search.emailAddress')}</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                  placeholder="votre@email.ch"
                />
              </div>
            )}

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={!name.trim() || maxReached || (alertEnabled && !email.trim())}
              className={cn(
                'w-full h-11 rounded-lg text-sm font-semibold transition-colors',
                (!name.trim() || maxReached || (alertEnabled && !email.trim()))
                  ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                  : 'border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active'
              )}
            >
              {t('actions.save')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
