// Panneaux ops admin (P3) — syndication IDX + WhatsApp ops (AdminMonitoringPage)
// et coûts IA par agence (AdminToolUsagePage). Données : useAdminOpsHealth
// (3 RPC serveur, migration 20260705172000).
//
// Rendu en grammaire Sugar (kit `adminKit`) : bentos séparés par l'ombre,
// sous-groupes annoncés par une pastille de ton, compteurs en chiffres
// tabulaires, et les textes `text-red-500` / `text-amber-500` remplacés par les
// tons fonctionnels de `useAdminSugar()`.

import { useTranslation } from 'react-i18next'
import { Coins, Radio } from 'lucide-react'
import { format } from 'date-fns'
import { useSyndicationHealth, useWhatsAppHealth, useAiCosts } from '@/hooks/useAdminOpsHealth'
import {
  AdminCard, AdminEmpty, AdminError, AdminGroupTitle, AdminSkeleton, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { useAdminSugar, type AdminTones } from '@/hooks/useAdminSugar'
import type { SugarPalette } from '@/components/crm-sugar/tokens'

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  try {
    return format(new Date(iso), 'dd.MM.yyyy HH:mm')
  } catch {
    return iso
  }
}

/**
 * Couleur du compteur d'un statut de syndication.
 *
 * Le compteur reste un CHIFFRE coloré (pas une pilule) : il est lu comme une
 * valeur, et une pilule pleine par statut ferait quatre pavés de couleur sur une
 * seule ligne.
 */
function statusCountColor(status: string, tones: AdminTones, sp: SugarPalette): string {
  switch (status) {
    case 'published': return tones.ok
    case 'queued': return tones.warn
    case 'error': return tones.err
    case 'withdrawn': return sp.soft
    default: return sp.sub
  }
}

/** Libellé discret + chiffre tabulaire — la grille de compteurs des panneaux ops. */
/**
 * Chiffre d'un panneau ops — local à ce fichier, et ce n'est PAS une tuile.
 *
 * Pas de bento, pas d'icône, valeur plus petite : il s'aligne DANS un panneau
 * déjà encadré, là où `AdminStat` porte sa propre carte. Le remplacer
 * encadrerait chaque chiffre dans un panneau qui l'est déjà.
 */
function OpsStat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  const { sp } = useAdminSugar()
  return (
    <div>
      <p style={{ margin: 0, fontSize: 11, color: sp.soft }}>{label}</p>
      <p style={{
        margin: '2px 0 0', fontSize: 15, fontWeight: 800, letterSpacing: -0.4,
        color: color ?? sp.ink, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </p>
    </div>
  )
}

// ── Syndication IDX ──────────────────────────────────────────────────────────
export function SyndicationHealthPanel() {
  const { t } = useTranslation('admin')
  const { sp, tones } = useAdminSugar()
  const { data, isLoading, isError } = useSyndicationHealth()

  return (
    <AdminCard padding="6px 6px 16px">
      <AdminGroupTitle
        label={t('monitoring.syndication.title')}
        tone="info"
        right={
          <span style={{ fontSize: 11, color: sp.soft, fontVariantNumeric: 'tabular-nums' }}>
            {t('monitoring.syndication.lastPush')} {formatDateTime(data?.last_push_at ?? null)}
          </span>
        }
      />

      {isLoading ? (
        <div style={{ padding: '0 10px' }}><AdminSkeleton height={64} /></div>
      ) : isError ? (
        <AdminError message={t('monitoring.syndication.error')} />
      ) : !data || data.by_status.length === 0 ? (
        <AdminEmpty icon={Radio} title={t('monitoring.syndication.empty')} />
      ) : (
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Statuts par portail */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
            {data.by_status.map((row) => (
              <div key={`${row.portal}-${row.status}`} style={{ display: 'flex', alignItems: 'baseline', gap: 6, fontSize: 12.5 }}>
                <span style={{
                  fontSize: 15, fontWeight: 800, letterSpacing: -0.4,
                  color: statusCountColor(row.status, tones, sp), fontVariantNumeric: 'tabular-nums',
                }}>
                  {row.count}
                </span>
                <span style={{ color: sp.sub }}>
                  {t(`monitoring.syndication.status.${row.status}`, { defaultValue: row.status })}
                </span>
                <span style={{ fontSize: 11, color: sp.soft }}>· {row.portal}</span>
              </div>
            ))}
          </div>

          {/* Dernières erreurs */}
          {data.recent_errors.length > 0 && (
            <div>
              <AdminGroupTitle label={t('monitoring.syndication.recentErrors')} tone="err" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.recent_errors.map((err, i) => (
                  <div key={`${err.property_id}-${i}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11.5 }}>
                    <span style={{ color: tones.err, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {err.error ?? '—'}
                    </span>
                    <span style={{ flexShrink: 0, color: sp.soft }}>
                      {err.agency_name ?? '—'} · {formatDateTime(err.updated_at)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Config par agence */}
          {data.agencies.length > 0 && (
            <div>
              <AdminGroupTitle label={t('monitoring.syndication.agencies')} tone="neutral" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.agencies.map((a) => (
                  <div key={a.agency_name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11.5 }}>
                    <span style={{ color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.agency_name}</span>
                    <span style={{ flexShrink: 0, color: sp.soft }}>
                      {a.idx_enabled
                        ? t('monitoring.syndication.enabled')
                        : t('monitoring.syndication.disabled')}
                      {' · '}{a.transport}
                      {a.transport === 'ftp' && !a.ftp_configured && (
                        <span style={{ color: tones.warn }}> · {t('monitoring.syndication.ftpMissing')}</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  )
}

// ── WhatsApp ops ─────────────────────────────────────────────────────────────
export function WhatsAppOpsPanel() {
  const { t } = useTranslation('admin')
  const { sp, tones } = useAdminSugar()
  const { data, isLoading, isError } = useWhatsAppHealth()

  const failureRate7d =
    data && data.sent_7d > 0 ? Math.round((data.failed_7d / data.sent_7d) * 100) : 0
  const webhookStale = data?.webhook_stale ?? false

  return (
    <AdminCard padding="6px 6px 16px">
      <AdminGroupTitle label={t('monitoring.whatsapp.title')} tone="cyan" />

      {isLoading ? (
        <div style={{ padding: '0 10px' }}><AdminSkeleton height={64} /></div>
      ) : isError ? (
        <AdminError message={t('monitoring.whatsapp.error')} />
      ) : !data ? null : (
        <div style={{ padding: '0 10px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <OpsStat label={t('monitoring.whatsapp.sent24h')} value={data.sent_24h} />
            <OpsStat
              label={t('monitoring.whatsapp.failed24h')}
              value={data.failed_24h}
              color={data.failed_24h > 0 ? tones.err : undefined}
            />
            <OpsStat
              label={t('monitoring.whatsapp.failureRate7d')}
              value={`${failureRate7d}%`}
              color={failureRate7d > 5 ? tones.err : undefined}
            />
            <OpsStat label={t('monitoring.whatsapp.unmappedInbound')} value={data.unmapped_inbound_7d} />
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 16, rowGap: 4, fontSize: 11, color: sp.soft }}>
            <span>
              {t('monitoring.whatsapp.lastStatusUpdate')}{' '}
              <span style={{ color: webhookStale ? tones.warn : 'inherit', fontVariantNumeric: 'tabular-nums' }}>
                {formatDateTime(data.last_status_update_at)}
                {webhookStale && ` · ${t('monitoring.whatsapp.stale')}`}
              </span>
            </span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {t('monitoring.whatsapp.lastInbound')} {formatDateTime(data.last_inbound_at)}
            </span>
            {data.cron_locks.map((lock) => (
              <span key={lock.job} style={{ fontVariantNumeric: 'tabular-nums' }}>
                {lock.job} → {formatDateTime(lock.locked_until)}
              </span>
            ))}
          </div>

          {/* Dead-letters : files d'échec surveillées (migration 20260710163000).
              « Échecs livraison 24h » est déjà rendu ci-dessus (failed_24h). */}
          <div>
            <AdminGroupTitle label={t('monitoring.whatsapp.deadletters')} tone="warn" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <OpsStat
                label={t('monitoring.whatsapp.processingFailed')}
                value={data.processing_failed}
                color={data.processing_failed > 0 ? tones.warn : undefined}
              />
              <OpsStat
                label={t('monitoring.whatsapp.processingDeadletter')}
                value={data.processing_deadletter}
                color={data.processing_deadletter > 0 ? tones.err : undefined}
              />
              <OpsStat
                label={t('monitoring.whatsapp.agentErrors24h')}
                value={data.agent_errors_24h}
                color={data.agent_errors_24h > 0 ? tones.warn : undefined}
              />
              <OpsStat
                label={t('monitoring.whatsapp.asyncJobsFailed24h')}
                value={data.async_jobs_failed_24h}
                color={data.async_jobs_failed_24h > 0 ? tones.err : undefined}
              />
            </div>
          </div>

          {data.top_errors.length > 0 && (
            <div>
              <AdminGroupTitle label={t('monitoring.whatsapp.topErrors')} tone="err" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {data.top_errors.map((e) => (
                  <div key={e.error} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 11.5 }}>
                    <span style={{ color: sp.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.error}</span>
                    <span style={{ flexShrink: 0, fontWeight: 700, color: tones.err, fontVariantNumeric: 'tabular-nums' }}>{e.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  )
}

// ── Coûts IA par agence (AdminToolUsagePage) ─────────────────────────────────
export function AiCostsSection() {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data, isLoading, isError } = useAiCosts(6)

  // Totaux par mois pour la ligne de tendance (les coûts sont en USD — on
  // affiche USD explicitement, pas de faux CHF).
  const byMonth = new Map<string, number>()
  for (const row of data ?? []) {
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + Number(row.cost_usd))
  }

  return (
    <AdminCard padding="6px 6px 16px">
      <AdminGroupTitle
        label={t('toolUsage.aiCosts.title')}
        tone="cyan"
        right={<span style={{ fontSize: 11, color: sp.soft }}>{t('toolUsage.aiCosts.subtitle')}</span>}
      />

      {isLoading ? (
        <div style={{ padding: '0 10px' }}><AdminSkeleton height={64} /></div>
      ) : isError ? (
        <AdminError message={t('toolUsage.aiCosts.error')} />
      ) : !data || data.length === 0 ? (
        <AdminEmpty icon={Coins} title={t('toolUsage.aiCosts.empty')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Tendance mensuelle */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, padding: '0 10px' }}>
            {[...byMonth.entries()].map(([month, total]) => (
              <OpsStat key={month} label={format(new Date(month), 'MM.yyyy')} value={`${total.toFixed(2)} USD`} />
            ))}
          </div>

          {/* Détail agence × provider × module */}
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <AdminTh>{t('toolUsage.aiCosts.table.month')}</AdminTh>
                  <AdminTh>{t('toolUsage.aiCosts.table.agency')}</AdminTh>
                  <AdminTh>{t('toolUsage.aiCosts.table.provider')}</AdminTh>
                  <AdminTh>{t('toolUsage.aiCosts.table.module')}</AdminTh>
                  <AdminTh align="right">{t('toolUsage.aiCosts.table.calls')}</AdminTh>
                  <AdminTh align="right">{t('toolUsage.aiCosts.table.cost')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    <AdminTd numeric style={{ color: sp.soft }}>{format(new Date(row.month), 'MM.yyyy')}</AdminTd>
                    <AdminTd>{row.agency_name}</AdminTd>
                    <AdminTd style={{ color: sp.sub }}>{row.provider}</AdminTd>
                    <AdminTd style={{ color: sp.sub }}>{row.module}</AdminTd>
                    <AdminTd align="right" numeric style={{ color: sp.sub }}>{row.calls}</AdminTd>
                    <AdminTd align="right" numeric style={{ fontWeight: 700 }}>
                      {Number(row.cost_usd).toFixed(4)} USD
                    </AdminTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminCard>
  )
}
