/**
 * Palette de recherche globale super-admin (Cmd-K), rendue en portal z-[100].
 * Interroge agences / utilisateurs / biens / tickets via `useAdminSearch`
 * (min. 2 caractères) et regroupe les résultats par type.
 *
 * Rendu en grammaire Sugar : cadre de rayon 26 séparé par l'ombre (plus de
 * `border border-theme-border`), en-têtes de groupe en pastille + libellé
 * (`AdminGroupTitle`), et lignes de résultat sur la même mécanique de survol que
 * le rail (`adm-nav`).
 */
import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { useAdminSearch, type AdminSearchResult } from '@/hooks/useAdminSearch'
import { AdminDivider, AdminEmpty, AdminGroupTitle } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

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
  const { sp, surf, dark } = useAdminSugar()
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
        className="absolute inset-0"
        onClick={onClose}
        style={{
          background: dark ? 'rgba(0,0,4,.68)' : 'rgba(14,20,16,.42)',
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        }}
      />

      {/* Dialog */}
      <div
        ref={focusTrapRef}
        className="relative w-full max-w-lg mx-4 overflow-hidden"
        style={{
          background: surf.card,
          borderRadius: ADMIN_RADII.frame,
          border: surf.hairline,
          boxShadow: sp.shadow,
        }}
      >
        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, height: 52, padding: '0 18px' }}>
          <MEIcon
            name={loading ? 'spinner' : 'search'}
            size={17}
            color={sp.sub}
            className={loading ? 'animate-spin' : undefined}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('search.placeholder')}
            className="flex-1 placeholder:text-theme-muted"
            style={{
              background: 'transparent', border: 0, outline: 'none', minWidth: 0,
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, color: sp.ink,
            }}
          />
          <kbd style={{
            flexShrink: 0, padding: '3px 9px', borderRadius: ADMIN_RADII.pill,
            background: surf.cardSub, color: sp.sub, fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
          }}>
            Esc
          </kbd>
        </div>
        <AdminDivider />

        {/* Results */}
        <div className="max-h-80 overflow-y-auto scrollbar-hide">
          {query.length >= 2 && results.length === 0 && !loading && (
            <AdminEmpty title={t('search.noResult')} />
          )}

          {query.length < 2 && (
            <AdminEmpty title={t('search.minChars')} />
          )}

          {(['agency', 'user', 'property'] as const).map(type => {
            const items = grouped[type]
            if (!items?.length) return null
            const meta = TYPE_META[type]

            return (
              <div key={type}>
                <AdminGroupTitle label={t(meta.i18nKey)} />
                {items.map(item => {
                  const Icon = meta.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className="adm-nav"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
                        padding: '9px 16px', border: 0, background: 'transparent',
                        textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <MEIcon name={Icon as MEIconName} size={16} color={sp.sub} />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span style={{ display: 'block', fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.title}
                        </span>
                        <span style={{ display: 'block', fontSize: 11.5, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.subtitle}
                        </span>
                      </span>
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
