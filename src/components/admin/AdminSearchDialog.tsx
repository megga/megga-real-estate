/**
 * Palette de recherche globale super-admin (Cmd-K), rendue en portal z-[100].
 * Interroge agences / utilisateurs / biens / tickets via `useAdminSearch`
 * (min. 2 caractères) et regroupe les résultats par type.
 */
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { cn } from '@/lib/utils'
import { useAdminSearch, type AdminSearchResult } from '@/hooks/useAdminSearch'

interface AdminSearchDialogProps {
  open: boolean
  onClose: () => void
}

const TYPE_META: Record<AdminSearchResult['type'], { icon: MEIconName; i18nKey: string }> = {
  agency: { icon: 'building', i18nKey: 'search.type.agencies' },
  user: { icon: 'users', i18nKey: 'search.type.users' },
  property: { icon: 'home', i18nKey: 'search.type.properties' },
}

/** Modale de recherche : auto-focus, fermeture Échap/overlay, navigation vers `result.href` au clic. */
export default function AdminSearchDialog({ open, onClose }: AdminSearchDialogProps) {
  'use no memo'
  const { t } = useTranslation('admin')
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { results, loading } = useAdminSearch(query)
  const focusTrapRef = useFocusTrap(open)

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  // Group results by type
  const grouped = results.reduce<Record<string, AdminSearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  const handleSelect = (result: AdminSearchResult) => {
    navigate(result.href)
    onClose()
  }

  return createPortal(
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div ref={focusTrapRef} className="relative bg-theme-card rounded-xl border border-theme-border w-full max-w-lg mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-theme-border">
          {loading ? (
            <MEIcon name="spinner" className="h-4 w-4 text-theme-tertiary animate-spin flex-shrink-0" />
          ) : (
            <MEIcon name="search" className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 bg-transparent text-theme-primary text-sm placeholder:text-theme-muted outline-none"
          />
          <kbd className="text-xs bg-theme-active text-theme-tertiary px-1.5 py-0.5 rounded font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto scrollbar-hide">
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-sm text-theme-muted">
              {t('search.noResult')}
            </div>
          )}

          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-theme-muted">
              {t('search.minChars')}
            </div>
          )}

          {(['agency', 'user', 'property'] as const).map(type => {
            const items = grouped[type]
            if (!items?.length) return null
            const meta = TYPE_META[type]

            return (
              <div key={type}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-xs tracking-wide text-theme-tertiary font-medium">
                    {t(meta.i18nKey)}
                  </span>
                </div>
                {items.map(item => {
                  const Icon = meta.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left',
                        'hover:bg-theme-hover transition-colors'
                      )}
                    >
                      <MEIcon name={Icon as MEIconName} className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-theme-primary truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-theme-muted truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
