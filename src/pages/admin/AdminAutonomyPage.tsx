/**
 * Page super-admin — autonomie des agents IA.
 *
 * Route : `/dashboard/admin/autonomy` (section admin, accent violet). Vue en
 * lecture seule (observe-only) : par agent × outil, compteurs yes/no des décisions
 * HITL et suggestion de reprise d'autonomie. N'exécute aucune action — la reprise
 * reste un geste humain.
 */
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminAutonomy } from '@/hooks/useAdminAutonomy'

/** Tableau des décisions d'autonomie ; met en évidence les lignes suggérant une reprise. */
export default function AdminAutonomyPage() {
  const { t } = useTranslation('admin')
  const { data: rows = [], isLoading, error } = useAdminAutonomy()
  const suggestions = rows.filter((r) => r.suggest_resume)

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
          <h1 className="text-xl font-semibold text-theme-primary">{t('autonomy.title')}</h1>
        </div>
        {!isLoading && (
          <p className="text-sm text-theme-tertiary mt-1">
            {t('autonomy.subtitle', { count: suggestions.length })}
          </p>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-400">
          {t('autonomy.error')}
        </div>
      )}

      {/* Observe-only notice */}
      <div className="rounded-xl border border-theme-border bg-admin-accent/5 px-4 py-3 flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-admin-accent mt-0.5 shrink-0" />
        <p className="text-sm text-theme-secondary">{t('autonomy.observeNote')}</p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-theme-border overflow-x-auto">
        {/* Table header */}
        <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-xs font-medium text-theme-tertiary">
          <div className="flex-1">{t('autonomy.col.agent')}</div>
          <div className="w-28">{t('autonomy.col.autonomy')}</div>
          <div className="flex-1">{t('autonomy.col.tool')}</div>
          <div className="w-28 text-right">{t('autonomy.col.yesno')}</div>
          <div className="w-40 text-right">{t('autonomy.col.suggestion')}</div>
        </div>

        {isLoading && (
          <div className="px-4 py-12 text-center text-sm text-theme-tertiary">{t('common.loading')}</div>
        )}

        {!isLoading && rows.length === 0 && (
          <div className="px-4 py-12 text-center">
            <Sparkles className="h-8 w-8 text-theme-border mx-auto mb-3" />
            <p className="text-sm text-theme-secondary">{t('autonomy.empty')}</p>
          </div>
        )}

        {!isLoading && rows.length > 0 && rows.map((r, i) => (
          <div
            key={`${r.profile_id}-${r.tool}`}
            className={cn(
              'flex items-center px-4 py-3',
              i < rows.length - 1 && 'border-b border-theme-border',
              r.suggest_resume && 'bg-admin-accent/5'
            )}
          >
            <div className="flex-1 text-sm text-theme-primary capitalize">{r.agent_name ?? '—'}</div>
            <div className="w-28 text-sm text-theme-secondary">{r.autonomy ?? '—'}</div>
            <div className="flex-1 text-sm text-theme-secondary font-mono">{r.tool}</div>
            <div className="w-28 text-right text-sm text-theme-secondary">{r.yes_count} / {r.no_count}</div>
            <div className="w-40 text-right">
              {r.suggest_resume
                ? <span className="text-xs font-semibold text-admin-accent">{t('autonomy.suggestResume')}</span>
                : <span className="text-xs text-theme-tertiary">—</span>
              }
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
