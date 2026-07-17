/**
 * Page super-admin — satisfaction (NPS).
 *
 * Route : `/dashboard/admin/nps` (SuperAdminGuard, accent violet). Score NPS,
 * note moyenne, répartition 1-5 étoiles et liste des réponses avec commentaires
 * (via `useAdminNps`).
 */
import { useTranslation } from 'react-i18next'
import { Star, MessageSquare, TrendingUp, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminNps } from '@/hooks/useAdminNps'
import type { NpsResponse } from '@/hooks/useAdminNps'
import { formatRelativeDate } from '@/lib/utils'

const RATING_COLORS: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-500',
  3: 'bg-amber-500',
  4: 'bg-emerald-400',
  5: 'bg-emerald-500',
}

/** Couleur du score NPS : vert ≥ 50, ambre ≥ 0, rouge sinon. */
function NpsScoreColor(score: number): string {
  if (score >= 50) return 'text-emerald-500'
  if (score >= 0) return 'text-amber-500'
  return 'text-red-500'
}

/** Ligne d'une réponse NPS : étoiles, identité, rôle, commentaire et date. */
function ResponseCard({ response }: { response: NpsResponse }) {
  const { t } = useTranslation('admin')
  return (
    <div className="flex items-start gap-4 py-4 border-b border-theme-border last:border-b-0">
      {/* Stars */}
      <div className="flex items-center gap-0.5 flex-shrink-0 pt-0.5">
        {[1, 2, 3, 4, 5].map(s => (
          <Star
            key={s}
            className={cn(
              'h-4 w-4',
              s <= response.rating
                ? 'fill-amber-400 text-amber-400'
                : 'text-theme-border'
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-theme-primary">
            {response.user_name ?? t('nps.anonymousUser')}
          </span>
          {response.user_email && (
            <span className="text-xs text-theme-muted">{response.user_email}</span>
          )}
          {response.role && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-theme-hover text-theme-secondary">
              {response.role}
            </span>
          )}
        </div>
        {response.comment && (
          <p className="text-sm text-theme-secondary mt-1">{response.comment}</p>
        )}
      </div>

      {/* Date */}
      <span className="text-xs text-theme-muted flex-shrink-0">
        {formatRelativeDate(response.submitted_at)}
      </span>
    </div>
  )
}

/** Vue principale : 4 cartes stats, barre de distribution empilée et liste des réponses. */
export default function AdminNpsPage() {
  const { t } = useTranslation('admin')
  const { data, isLoading } = useAdminNps()

  const stats = data?.stats
  const responses = data?.responses ?? []

  const ratingLabels: Record<number, string> = {
    1: t('nps.rating.1'),
    2: t('nps.rating.2'),
    3: t('nps.rating.3'),
    4: t('nps.rating.4'),
    5: t('nps.rating.5'),
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="h-8 px-3 rounded-lg bg-admin-accent/10 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-admin-accent" />
          <span className="text-xs font-semibold text-admin-accent">{t('common.adminBadge')}</span>
        </div>
        <Star className="h-5 w-5 text-theme-secondary" />
        <h1 className="text-xl font-semibold text-theme-primary">{t('nps.title')}</h1>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-theme-border p-5 h-24 animate-pulse bg-theme-hover/30" />
          ))}
        </div>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* NPS Score */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-theme-muted" />
              <span className="text-xs text-theme-secondary">{t('nps.score')}</span>
            </div>
            <p className={cn('text-3xl font-bold', NpsScoreColor(stats.npsScore))}>
              {stats.npsScore > 0 ? '+' : ''}{stats.npsScore}
            </p>
            <p className="text-xs text-theme-muted mt-1">{t('nps.scoreRange')}</p>
          </div>

          {/* Average rating */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-theme-muted" />
              <span className="text-xs text-theme-secondary">{t('nps.averageRating')}</span>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-bold text-theme-primary">{stats.averageRating}</p>
              <span className="text-sm text-theme-muted">/ 5</span>
            </div>
          </div>

          {/* Total responses */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="h-4 w-4 text-theme-muted" />
              <span className="text-xs text-theme-secondary">{t('nps.responses')}</span>
            </div>
            <p className="text-3xl font-bold text-theme-primary">{stats.totalResponses}</p>
          </div>

          {/* Promoters / Detractors */}
          <div className="rounded-xl border border-theme-border p-5">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-theme-muted" />
              <span className="text-xs text-theme-secondary">{t('nps.promotersDetractors')}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-emerald-500">
                {stats.totalResponses > 0 ? Math.round((stats.promoters / stats.totalResponses) * 100) : 0}%
              </span>
              <span className="text-theme-muted">/</span>
              <span className="text-lg font-bold text-red-500">
                {stats.totalResponses > 0 ? Math.round((stats.detractors / stats.totalResponses) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Distribution bar */}
      {stats && stats.totalResponses > 0 && (
        <div className="rounded-xl border border-theme-border p-5">
          <p className="text-sm font-medium text-theme-primary mb-4">{t('nps.distribution')}</p>
          {/* Stacked bar */}
          <div className="flex h-8 rounded-lg overflow-hidden">
            {[1, 2, 3, 4, 5].map(rating => {
              const count = stats.distribution[rating] ?? 0
              const pct = stats.totalResponses > 0 ? (count / stats.totalResponses) * 100 : 0
              if (pct === 0) return null
              return (
                <div
                  key={rating}
                  className={cn('flex items-center justify-center transition-all', RATING_COLORS[rating])}
                  style={{ width: `${pct}%` }}
                  title={`${rating} etoile${rating > 1 ? 's' : ''}: ${count} (${Math.round(pct)}%)`}
                >
                  {pct >= 8 && (
                    <span className="text-xs font-medium text-white">{Math.round(pct)}%</span>
                  )}
                </div>
              )
            })}
          </div>
          {/* Labels */}
          <div className="flex mt-2 gap-4">
            {[1, 2, 3, 4, 5].map(rating => (
              <div key={rating} className="flex items-center gap-1.5">
                <div className={cn('w-2.5 h-2.5 rounded-sm', RATING_COLORS[rating])} />
                <span className="text-xs text-theme-muted">{ratingLabels[rating]} ({stats.distribution[rating] ?? 0})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Response list */}
      <div className="rounded-xl border border-theme-border p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-theme-primary">{t('nps.recentResponses')}</p>
          <span className="text-xs text-theme-muted">{responses.length} reponse{responses.length !== 1 ? 's' : ''}</span>
        </div>

        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 rounded-lg bg-theme-hover/30 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && responses.length === 0 && (
          <div className="text-center py-12">
            <Star className="h-8 w-8 text-theme-border mx-auto mb-3" />
            <p className="text-sm text-theme-secondary">{t('nps.empty.title')}</p>
            <p className="text-xs text-theme-muted mt-1">{t('nps.empty.subtitle')}</p>
          </div>
        )}

        {!isLoading && responses.length > 0 && (
          <div>
            {responses.map(response => (
              <ResponseCard key={response.id} response={response} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
