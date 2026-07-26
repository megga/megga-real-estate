/**
 * Page super-admin — satisfaction (NPS).
 *
 * Route : `/nps` (console admin.megga.ch). Score NPS, note moyenne, répartition
 * 1-5 étoiles et liste des réponses avec commentaires (via `useAdminNps`).
 *
 * Rendu en grammaire Sugar (kit `@/components/admin/kit`) : indicateurs
 * `AdminStat` (chiffres tabulaires, signal porté par le ton de l'icône), bentos
 * séparés par l'ombre, échelle de notes dérivée des tons fonctionnels — les
 * `bg-red-500` / `bg-emerald-400` d'origine ont disparu. Le repère « Admin
 * MEGGA » a quitté la page : il ne vit plus qu'une fois, dans le rail du shell.
 */
import { useTranslation } from 'react-i18next'
import { Star, MessageSquare, TrendingUp, Users } from 'lucide-react'
import { useAdminNps } from '@/hooks/useAdminNps'
import type { NpsResponse } from '@/hooks/useAdminNps'
import { formatRelativeDate } from '@/lib/utils'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import AdminPage from '@/components/admin/kit/AdminPage'
import { AdminCard, AdminDivider, AdminEmpty, AdminIc, AdminPill, AdminSkeleton, AdminStat } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

/** Ton du score NPS : bon ≥ 50, à surveiller ≥ 0, mauvais sinon. */
function npsScoreTone(score: number): AdminToneName {
  if (score >= 50) return 'ok'
  if (score >= 0) return 'warn'
  return 'err'
}

/**
 * Ligne d'une réponse NPS : étoiles, identité, rôle, commentaire et date.
 *
 * `first` supprime le filet supérieur de la première ligne — Sugar sépare par un
 * filet très discret entre les lignes, pas par une bordure autour du bloc.
 */
function ResponseCard({ response, first }: { response: NpsResponse; first: boolean }) {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()

  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14, padding: '13px 0',
        borderTop: first ? undefined : surf.hairline,
      }}
    >
      {/* Étoiles */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, paddingTop: 1 }}>
        {[1, 2, 3, 4, 5].map(s => {
          const filled = s <= response.rating
          return (
            <AdminIc
              key={s}
              icon={Star}
              size={14}
              color={filled ? tones.warn : sp.soft}
              style={{ fill: filled ? tones.warn : 'none', opacity: filled ? 1 : 0.35 }}
            />
          )
        })}
      </div>

      {/* Contenu */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>
            {response.user_name ?? t('nps.anonymousUser')}
          </span>
          {response.user_email && (
            <span style={{ fontSize: 11.5, color: sp.soft }}>{response.user_email}</span>
          )}
          {response.role && (
            <AdminPill label={response.role} style={{ padding: '3px 9px', fontSize: 11 }} />
          )}
        </div>
        {response.comment && (
          <p style={{ margin: '5px 0 0', fontSize: 12.5, fontWeight: 500, color: sp.sub, lineHeight: 1.5 }}>
            {response.comment}
          </p>
        )}
      </div>

      {/* Date */}
      <span style={{ fontSize: 11.5, color: sp.soft, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {formatRelativeDate(response.submitted_at)}
      </span>
    </div>
  )
}

/** Vue principale : 4 indicateurs, barre de répartition empilée et liste des réponses. */
export default function AdminNpsPage() {
  const { t } = useTranslation('admin')
  const { data, isLoading } = useAdminNps()
  const { sp, tones, onTone } = useAdminSugar()

  const stats = data?.stats
  const responses = data?.responses ?? []

  const ratingLabels: Record<number, string> = {
    1: t('nps.rating.1'),
    2: t('nps.rating.2'),
    3: t('nps.rating.3'),
    4: t('nps.rating.4'),
    5: t('nps.rating.5'),
  }

  // Échelle des cinq crans de note. Les tons fonctionnels ne fournissent que
  // trois signaux (err/warn/ok) : le cran neutre prend l'accent Sugar et le
  // cran 4 le cyan, sinon 1↔2 et 4↔5 rendraient deux fois la même couleur et
  // la barre empilée deviendrait illisible. `ink` garde le pourcentage lisible
  // sur chaque fond, en clair comme en sombre.
  const ratingFill: Record<number, { bg: string; ink: string }> = {
    1: { bg: tones.err, ink: onTone },
    2: { bg: tones.warn, ink: onTone },
    3: { bg: sp.accent, ink: sp.accentInk },
    4: { bg: tones.cyan, ink: onTone },
    5: { bg: tones.ok, ink: onTone },
  }

  return (
    <AdminPage title={t('nps.title')} width="wide">
      {/* Chargement des indicateurs */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <AdminSkeleton key={i} height={64} radius={ADMIN_RADII.card} />
          ))}
        </div>
      )}

      {/* Indicateurs */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <AdminStat
            label={t('nps.score')}
            value={`${stats.npsScore > 0 ? '+' : ''}${stats.npsScore}`}
            icon={TrendingUp}
            tone={npsScoreTone(stats.npsScore)}
            hint={t('nps.scoreRange')}
          />
          <AdminStat
            label={t('nps.averageRating')}
            value={`${stats.averageRating} / 5`}
            icon={Star}
          />
          <AdminStat
            label={t('nps.responses')}
            value={stats.totalResponses}
            icon={MessageSquare}
          />
          <AdminStat
            label={t('nps.promotersDetractors')}
            value={`${stats.totalResponses > 0 ? Math.round((stats.promoters / stats.totalResponses) * 100) : 0}% / ${stats.totalResponses > 0 ? Math.round((stats.detractors / stats.totalResponses) * 100) : 0}%`}
            icon={Users}
          />
        </div>
      )}

      {/* Répartition des notes */}
      {stats && stats.totalResponses > 0 && (
        <AdminCard padding="16px 18px">
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
            {t('nps.distribution')}
          </p>
          <AdminDivider margin="12px 0 14px" />

          {/* Barre empilée */}
          <div style={{ display: 'flex', height: 30, borderRadius: ADMIN_RADII.row, overflow: 'hidden' }}>
            {[1, 2, 3, 4, 5].map(rating => {
              const count = stats.distribution[rating] ?? 0
              const pct = stats.totalResponses > 0 ? (count / stats.totalResponses) * 100 : 0
              if (pct === 0) return null
              const fill = ratingFill[rating]
              return (
                <div
                  key={rating}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    width: `${pct}%`, background: fill.bg, transition: 'width .25s ease',
                  }}
                  title={`${rating} etoile${rating > 1 ? 's' : ''}: ${count} (${Math.round(pct)}%)`}
                >
                  {pct >= 8 && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: fill.ink, fontVariantNumeric: 'tabular-nums' }}>
                      {Math.round(pct)}%
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {/* Légende */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 11 }}>
            {[1, 2, 3, 4, 5].map(rating => (
              <div key={rating} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: ADMIN_RADII.pill, background: ratingFill[rating].bg, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                  {ratingLabels[rating]} ({stats.distribution[rating] ?? 0})
                </span>
              </div>
            ))}
          </div>
        </AdminCard>
      )}

      {/* Réponses */}
      <AdminCard padding="16px 18px">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
            {t('nps.recentResponses')}
          </p>
          <span style={{ fontSize: 11.5, color: sp.soft, fontVariantNumeric: 'tabular-nums' }}>
            {responses.length} reponse{responses.length !== 1 ? 's' : ''}
          </span>
        </div>
        <AdminDivider margin="12px 0 2px" />

        {isLoading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 10 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <AdminSkeleton key={i} height={54} />
            ))}
          </div>
        )}

        {!isLoading && responses.length === 0 && (
          <AdminEmpty icon={Star} title={t('nps.empty.title')} hint={t('nps.empty.subtitle')} />
        )}

        {!isLoading && responses.length > 0 && (
          <div>
            {responses.map((response, i) => (
              <ResponseCard key={response.id} response={response} first={i === 0} />
            ))}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  )
}
