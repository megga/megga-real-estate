import { useState } from 'react'
import { createPortal } from 'react-dom'
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
          <h3 className="text-base font-semibold text-gray-900">Sauvegarder cette recherche</h3>
          <button onClick={onClose} className="h-8 w-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {saved ? (
          <div className="px-5 py-10 text-center">
            <div className="h-12 w-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <Bell className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-sm font-medium text-gray-900">Recherche sauvegardée</p>
            {alertEnabled && (
              <p className="text-xs text-gray-500 mt-1">Vous recevrez des alertes {frequency === 'daily' ? 'quotidiennes' : 'hebdomadaires'}</p>
            )}
          </div>
        ) : (
          <div className="px-5 pb-5 space-y-4">
            {maxReached && (
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">Maximum 10 recherches sauvegardées. Supprimez-en une pour en ajouter.</p>
            )}

            {/* Name */}
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1.5 block">Nom de la recherche</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                placeholder="Ma recherche"
              />
            </div>

            {/* Results count info */}
            <p className="text-xs text-gray-500">{resultsCount.toLocaleString('fr-CH')} biens correspondent actuellement</p>

            {/* Alert toggle */}
            <div className="flex items-center justify-between py-3 border-y border-gray-100">
              <div className="flex items-center gap-2.5">
                {alertEnabled ? <Bell className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-gray-400" />}
                <div>
                  <p className="text-sm font-medium text-gray-900">Alertes email</p>
                  <p className="text-xs text-gray-500">Recevoir un email quand de nouveaux biens correspondent</p>
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
                <label className="text-xs font-medium text-gray-500 mb-2 block">Fréquence</label>
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
                      {f === 'daily' ? 'Quotidien' : 'Hebdomadaire'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Email (visible only if alerts enabled) */}
            {alertEnabled && (
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1.5 block">Adresse email</label>
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
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-accent text-white hover:bg-accent/90'
              )}
            >
              Sauvegarder
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
