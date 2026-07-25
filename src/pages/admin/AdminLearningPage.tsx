/**
 * Page super-admin — style appris des agents WhatsApp.
 *
 * Route : `/learning` (console admin.megga.ch) (accent violet). Liste par
 * agent le style distillé (langue, registre, emoji, traits) et permet de
 * l'activer/désactiver ou d'éditer les traits à la main via `useSetLearnedStyle`.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminLearning, useSetLearnedStyle } from '@/hooks/useAdminLearning'

export default function AdminLearningPage() {
  const { t } = useTranslation('admin')
  const { data: rows = [], isLoading, error } = useAdminLearning()
  const setStyle = useSetLearnedStyle()

  // Light inline traits edit: track which agent is being edited + the draft text.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draftTraits, setDraftTraits] = useState('')

  const activeCount = rows.filter((r) => r.learned_style?.status === 'active').length

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-admin-accent" />
            <span className="text-xs font-semibold text-admin-accent">{t('common.adminBadge')}</span>
          </div>
          <Sparkles className="h-5 w-5 text-theme-secondary" />
          <h1 className="text-xl font-semibold text-theme-primary">{t('learning.title')}</h1>
        </div>
        {!isLoading && (
          <p className="text-sm text-theme-tertiary mt-1">
            {t('learning.subtitle', { count: activeCount })}
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {t('learning.error')}
        </div>
      )}

      {/* Observe-only notice */}
      <div className="rounded-xl border border-theme-border bg-admin-accent/5 px-4 py-3 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-admin-accent mt-0.5 shrink-0" />
        <p className="text-sm text-theme-secondary">{t('learning.observeNote')}</p>
      </div>

      {/* List */}
      <div className="rounded-xl border border-theme-border overflow-x-auto">
        {/* List header */}
        <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary">
          <div className="flex-1">{t('learning.col.agent')}</div>
          <div className="w-20">{t('learning.col.language')}</div>
          <div className="w-28">{t('learning.col.register')}</div>
          <div className="w-20 text-center">{t('learning.col.emoji')}</div>
          <div className="w-24">{t('learning.col.status')}</div>
          <div className="w-28 text-right">{t('learning.col.action')}</div>
        </div>

        {isLoading && (
          <div className="px-4 py-12 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Sparkles className="h-8 w-8 text-theme-border mx-auto mb-3" />
            <p className="text-sm text-theme-secondary">{t('learning.empty')}</p>
          </div>
        )}

        {!isLoading && rows.length > 0 && rows.map((r, i) => {
          const style = r.learned_style
          const status = style?.status ?? 'off'
          const isActive = status === 'active'
          const isEditing = editingId === r.agent_id
          return (
            <div
              key={r.agent_id}
              className={cn(
                'px-4 py-3',
                i < rows.length - 1 && 'border-b border-theme-border',
                isActive && 'bg-admin-accent/5'
              )}
            >
              <div className="flex items-center">
                <div className="flex-1 text-sm text-theme-primary capitalize">{r.agent_name ?? '—'}</div>
                <div className="w-20 text-sm text-theme-secondary uppercase">{style?.language ?? '—'}</div>
                <div className="w-28 text-sm text-theme-secondary capitalize">{style?.formality ?? '—'}</div>
                <div className="w-20 text-center text-sm text-theme-secondary">{style?.emoji ? t('learning.yes') : t('learning.no')}</div>
                <div className="w-24">
                  <span className={cn('text-xs font-semibold', isActive ? 'text-admin-accent' : 'text-theme-tertiary')}>
                    {t(`learning.status.${status}`, status)}
                  </span>
                </div>
                <div className="w-28 text-right">
                  <button
                    type="button"
                    disabled={setStyle.isPending}
                    onClick={() => setStyle.mutate({
                      agent_id: r.agent_id,
                      status: isActive ? 'off' : 'active',
                    })}
                    className="rounded-lg border border-theme-border px-3 py-1.5 text-xs text-theme-secondary hover:bg-theme-hover disabled:opacity-50"
                  >
                    {isActive ? t('learning.deactivate') : t('learning.activate')}
                  </button>
                </div>
              </div>

              {/* Traits — read-only by default, light inline edit on demand */}
              <div className="mt-2 flex items-start gap-2">
                <span className="text-xs text-theme-tertiary shrink-0 pt-1.5">{t('learning.traits')}</span>
                {isEditing ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={draftTraits}
                      onChange={(e) => setDraftTraits(e.target.value)}
                      placeholder={t('learning.traitsPlaceholder')}
                      className="flex-1 rounded-lg border border-theme-border bg-transparent px-3 py-1.5 text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-admin-accent"
                    />
                    <button
                      type="button"
                      disabled={setStyle.isPending}
                      onClick={() => {
                        setStyle.mutate(
                          { agent_id: r.agent_id, status, traits: draftTraits },
                          { onSuccess: () => setEditingId(null) }
                        )
                      }}
                      className="rounded-lg border border-theme-border px-3 py-1.5 text-xs text-theme-secondary hover:bg-theme-hover disabled:opacity-50"
                    >
                      {t('learning.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-lg px-3 py-1.5 text-xs text-theme-tertiary hover:text-theme-secondary"
                    >
                      {t('learning.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex items-center gap-2">
                    <span className="flex-1 text-sm text-theme-secondary">{style?.traits || '—'}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(r.agent_id)
                        setDraftTraits(style?.traits ?? '')
                      }}
                      className="rounded-lg border border-theme-border px-3 py-1.5 text-xs text-theme-secondary hover:bg-theme-hover"
                    >
                      {t('learning.edit')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
