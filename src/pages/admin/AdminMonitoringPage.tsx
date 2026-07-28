/**
 * Page super-admin — monitoring plateforme (Supabase Pro).
 *
 * Route : `/dashboard/admin/monitoring`. Agrège santé DB/storage/edge,
 * statut Flatfox sync, santé pg_cron, panneaux ops (syndication IDX, WhatsApp),
 * facturation IA (solde DeepSeek + coûts) et logs d'erreurs dépliables. Données
 * via `useAdminMonitoring` + hooks dédiés.
 *
 * Rendu en grammaire Sugar (kit `adminKit`) : c'était la page la plus colorée de
 * la console (16 fonds `bg-<couleur>-<n>`). Les signaux passent désormais par les
 * tons fonctionnels (`tones.ok/warn/err`) et les pilules pleines ; les bentos
 * sont séparés par l'ombre, pas par une bordure.
 */
import { useState, useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Database, Zap, Mail, CheckCircle, AlertTriangle, Search, HardDrive, Globe, Home, DollarSign, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAdminMonitoring } from '@/hooks/useAdminMonitoring'
import { useDeepSeekBalance, useAIUsageSummary, useAIUsageTimeseries } from '@/hooks/useAIBilling'
import { useCronHealth } from '@/hooks/useCronHealth'
import { cronStale } from '@/lib/cronHealth'
import { SyndicationHealthPanel, WhatsAppOpsPanel } from '@/components/admin/AdminOpsPanels'
import IntegrationsHealthPanel from '@/components/admin/IntegrationsHealthPanel'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminDivider, AdminEmpty, AdminError, AdminGroupTitle, AdminIc,
  AdminPill, AdminSkeleton, AdminTd, AdminTh,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { formatRelativeDate } from '@/lib/utils'

type FunctionFilter = 'all' | 'healthy' | 'error' | 'unknown'

/** Identifiants techniques (nom de fonction, cadence cron) — lisibles en mono. */
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

/** Un sync Flatfox plus vieux que ça est en retard (le cron tourne à 04:00 UTC). */
const FLATFOX_SYNC_MAX_AGE_MS = 25 * 60 * 60 * 1000

export default function AdminMonitoringPage() {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()
  const { health, healthLoading, healthError, edgeFunctions, edgeFunctionsLoading, errorLogs, errorLogsLoading } = useAdminMonitoring()

  const deepseekBalance = useDeepSeekBalance()
  const aiUsage = useAIUsageSummary('month')
  const aiTimeseries = useAIUsageTimeseries(30)
  const balance = deepseekBalance.data?.total_balance_usd ?? null
  const balanceLow = balance !== null && balance < 20

  // Flatfox sync status — lightweight query to show in monitoring
  const flatfoxStats = useQuery({
    queryKey: ['admin-flatfox-stats'],
    queryFn: async () => {
      const [totalRes, recentRes] = await Promise.all([
        supabase.from('market_listings').select('id', { count: 'exact', head: true }).eq('source_portal', 'flatfox').eq('status', 'active'),
        supabase.from('market_listings').select('last_seen_at').eq('source_portal', 'flatfox').order('last_seen_at', { ascending: false }).limit(1),
      ])
      const lastSeen = recentRes.data?.[0]?.last_seen_at ?? null
      return { total: totalRes.count ?? 0, lastSeen }
    },
    staleTime: 60_000,
  })
  const cronHealth = useCronHealth()

  const [errorSearch, setErrorSearch] = useState('')
  const [fnFilter, setFnFilter] = useState<FunctionFilter>('all')
  const [fnSearch, setFnSearch] = useState('')
  const [expandedError, setExpandedError] = useState<string | null>(null)

  const filteredErrors = useMemo(() => {
    if (!errorSearch.trim()) return errorLogs
    const q = errorSearch.toLowerCase()
    return errorLogs.filter(
      (e) =>
        (e.function_name ?? '').toLowerCase().includes(q) ||
        (e.error_message ?? '').toLowerCase().includes(q) ||
        e.entity_type.toLowerCase().includes(q)
    )
  }, [errorLogs, errorSearch])

  const filteredFunctions = useMemo(() => {
    let list = [...edgeFunctions]
    if (fnFilter !== 'all') list = list.filter(f => f.status === fnFilter)
    if (fnSearch) {
      const q = fnSearch.toLowerCase()
      list = list.filter(f => f.name.toLowerCase().includes(q))
    }
    return list
  }, [edgeFunctions, fnFilter, fnSearch])

  const dbPercent = health ? Math.round((health.dbSizeMb / health.dbLimitMb) * 100) : 0
  const dbTone = dbPercent >= 90 ? tones.err : dbPercent >= 70 ? tones.warn : tones.ok
  const storagePercent = health ? Math.round((health.storageUsedMb / health.storageLimitMb) * 100) : 0

  const healthyCount = edgeFunctions.filter(f => f.status === 'healthy').length
  const errorCount = edgeFunctions.filter(f => f.status === 'error').length

  const flatfoxLastSeen = flatfoxStats.data?.lastSeen ?? null
  const flatfoxFresh = flatfoxLastSeen !== null && Date.now() - new Date(flatfoxLastSeen).getTime() < FLATFOX_SYNC_MAX_AGE_MS

  return (
    <AdminPage
      title={t('admin:monitoring.title')}
      width="wide"
      actions={<AdminPill label={t('admin:monitoring.planPro')} tone="ok" />}
    >
      {/* Error banner — when the health query fails entirely (Supabase down,
          RLS issue, network error). Without this, the page just showed
          empty data with no explanation — same silent failure pattern as
          the pre-fix MapView. */}
      {healthError && !healthLoading && (
        <AdminCard padding="15px 17px">
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
            <AdminIc icon={AlertTriangle} color={tones.err} style={{ marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>
                {t('admin:monitoring.errorTitle', { defaultValue: 'Données de monitoring indisponibles' })}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: sp.sub, lineHeight: 1.45 }}>
                {t('admin:monitoring.errorDesc', { defaultValue: 'La connexion à la base de données a échoué. Vérifiez le statut Supabase et les policies RLS.' })}
              </p>
            </div>
          </div>
        </AdminCard>
      )}

      {/* Health indicators — 6 cards */}
      {healthLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <AdminSkeleton key={i} height={92} radius={ADMIN_RADII.card} />
          ))}
        </div>
      ) : health ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {/* DB */}
          <HealthTile
            icon={Database}
            label={t('admin:monitoring.health.database')}
            value={`${health.dbSizeMb} MB`}
            valueColor={dbTone}
            gauge={{ percent: dbPercent, color: dbTone }}
            hint={`/ ${(health.dbLimitMb / 1000).toFixed(0)} GB (${dbPercent}%)`}
          />

          {/* Edge Functions */}
          <HealthTile
            icon={Zap}
            label={t('admin:monitoring.health.functions')}
            value={health.totalEdgeFunctions}
            hint={
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: tones.ok, fontWeight: 600 }}>{healthyCount} {t('admin:monitoring.health.ok')}</span>
                {errorCount > 0 && (
                  <span style={{ color: tones.err, fontWeight: 600 }}>{errorCount} {t('admin:monitoring.health.err')}</span>
                )}
              </span>
            }
          />

          {/* Errors 24h */}
          <HealthTile
            icon={AlertTriangle}
            label={t('admin:monitoring.health.errors24h')}
            value={health.errorsLast24h}
            valueColor={health.errorsLast24h === 0 ? tones.ok : tones.err}
          />

          {/* API Requests */}
          <HealthTile
            icon={Globe}
            label={t('admin:monitoring.health.requests')}
            value={health.apiRequestsToday}
            hint={t('admin:monitoring.health.todayLabel')}
          />

          {/* Emails */}
          <HealthTile
            icon={Mail}
            label={t('admin:monitoring.health.emails')}
            value={health.emailsSentToday}
            hint={t('admin:monitoring.health.todayLabel')}
          />

          {/* Storage */}
          <HealthTile
            icon={HardDrive}
            label={t('admin:monitoring.health.storage')}
            value={`${health.storageUsedMb} MB`}
            gauge={{ percent: storagePercent, color: sp.accent }}
            hint={`/ ${(health.storageLimitMb / 1000).toFixed(0)} GB`}
          />
        </div>
      ) : null}

      {/* Flatfox sync status — shows listing count and last sync time */}
      {flatfoxStats.data && (
        <AdminCard padding="14px 17px">
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <AdminIc icon={Home} size={16} color={sp.sub} />
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>Flatfox Sync</span>
            </span>
            <span style={{ fontSize: 12.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {flatfoxStats.data.total.toLocaleString('fr-CH')} biens actifs
            </span>
            <span style={{ fontSize: 11.5, color: sp.soft }}>
              {flatfoxLastSeen
                ? `Dernier sync : ${formatRelativeDate(flatfoxLastSeen)}`
                : 'Jamais synchronisé'}
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <AdminPill
                label={flatfoxFresh ? 'Sync OK' : 'Sync en retard'}
                tone={flatfoxFresh ? 'ok' : 'warn'}
              />
            </span>
          </div>
        </AdminCard>
      )}

      {/* Cron health — status of pg_cron jobs */}
      <AdminCard padding="6px 6px 14px">
        <AdminGroupTitle label={t('admin:monitoring.cronHealth.title')} tone="info" />

        {cronHealth.isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 10px' }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <AdminSkeleton key={i} height={36} />
            ))}
          </div>
        ) : cronHealth.isError ? (
          <AdminError message={t('admin:monitoring.cronHealth.errorDesc', { defaultValue: 'Impossible de charger la santé des crons.' })} />
        ) : (cronHealth.data ?? []).length === 0 ? (
          <AdminEmpty icon={Clock} title={t('admin:monitoring.cronHealth.empty')} />
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <AdminTh width={26}>{''}</AdminTh>
                  <AdminTh>{t('admin:monitoring.cronHealth.job')}</AdminTh>
                  <AdminTh>{t('admin:monitoring.cronHealth.schedule')}</AdminTh>
                  <AdminTh align="right" width={140}>{t('admin:monitoring.cronHealth.lastRun')}</AdminTh>
                  <AdminTh align="right" width={104}>{t('admin:monitoring.cronHealth.status')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {(cronHealth.data ?? []).map((row) => {
                  const st = cronStale(row.schedule, row.last_start, row.last_status)
                  const lastRunLabel = row.last_start
                    ? formatRelativeDate(row.last_start)
                    : t('admin:monitoring.cronHealth.never')
                  return (
                    <tr key={row.jobname}>
                      <AdminTd>
                        <span style={{
                          display: 'inline-block', width: 8, height: 8, borderRadius: ADMIN_RADII.pill,
                          background: st.stale ? tones.err : tones.ok,
                        }} />
                      </AdminTd>
                      <AdminTd style={{ fontFamily: MONO, fontWeight: 600 }}>{row.jobname}</AdminTd>
                      <AdminTd style={{ fontFamily: MONO, fontSize: 11.5, color: sp.soft }}>{row.schedule}</AdminTd>
                      <AdminTd align="right" numeric style={{ fontSize: 11.5, color: sp.soft }}>{lastRunLabel}</AdminTd>
                      <AdminTd align="right">
                        <AdminPill
                          label={st.stale ? t('admin:monitoring.cronHealth.stale') : t('admin:monitoring.cronHealth.ok')}
                          tone={st.stale ? 'err' : 'ok'}
                        />
                      </AdminTd>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Santé des intégrations critiques (P7 — Resend/Stripe/Calendriers/Realtime) */}
      <IntegrationsHealthPanel />

      {/* Syndication IDX + WhatsApp ops (P3 admin — RPC 20260705172000) */}
      <SyndicationHealthPanel />
      <WhatsAppOpsPanel />

      {/* AI billing — DeepSeek balance + Claude estimated cost */}
      <AdminCard padding="6px 6px 18px">
        <AdminGroupTitle
          label="IA — consommation et coûts"
          tone={balanceLow ? 'err' : 'cyan'}
          right={
            <>
              {balanceLow && <AdminPill label="Recharger DeepSeek" tone="err" icon={AlertTriangle} />}
              {aiUsage.data?.fallbackCount ? (
                <AdminPill
                  label={`${aiUsage.data.fallbackCount} fallback${aiUsage.data.fallbackCount > 1 ? 's' : ''} ce mois`}
                  tone="warn"
                />
              ) : null}
            </>
          }
        />

        <div style={{ padding: '0 10px' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <HealthTile
              icon={DollarSign}
              label="DeepSeek — solde"
              value={balance !== null ? `$${balance.toFixed(2)}` : '—'}
              valueColor={balanceLow ? tones.err : undefined}
              hint={deepseekBalance.data?.captured_at
                ? formatRelativeDate(deepseekBalance.data.captured_at)
                : 'Pas encore de snapshot'}
            />

            <HealthTile
              icon={Zap}
              label="DeepSeek — tokens (mois)"
              value={formatTokens(aiUsage.data?.deepseekTokens ?? 0)}
              hint={`≈ $${(aiUsage.data?.deepseekCostUsd ?? 0).toFixed(2)}`}
            />

            <HealthTile
              icon={DollarSign}
              label="Claude — coût estimé (mois)"
              value={`$${(aiUsage.data?.claudeCostUsd ?? 0).toFixed(2)}`}
              hint="Anthropic n'expose pas de solde"
            />

            <HealthTile
              icon={Zap}
              label="Claude — tokens (mois)"
              value={formatTokens(aiUsage.data?.claudeTokens ?? 0)}
            />
          </div>

          {aiTimeseries.data && aiTimeseries.data.length > 0 && (
            <>
              <AdminDivider margin="16px 0 12px" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>Tokens / jour (30 derniers jours)</span>
                {/* Deux séries, donc deux teintes : l'encre Sugar et le bleu
                    d'information. Le violet reste le repère « console ». */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, fontSize: 11, color: sp.soft }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: sp.accent }} /> DeepSeek
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: tones.info }} /> Claude
                  </span>
                </div>
              </div>
              {(() => {
                const max = Math.max(1, ...aiTimeseries.data.map((p) => p.deepseek + p.claude))
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 128 }}>
                    {aiTimeseries.data.map((p) => {
                      const total = p.deepseek + p.claude
                      const totalPct = (total / max) * 100
                      const deepseekShare = total > 0 ? (p.deepseek / total) * 100 : 0
                      return (
                        <div
                          key={p.date}
                          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column-reverse' }}
                          title={`${p.date} — DeepSeek ${formatTokens(p.deepseek)} · Claude ${formatTokens(p.claude)}`}
                        >
                          <div style={{ width: '100%', height: `${totalPct}%`, overflow: 'hidden' }}>
                            <div style={{ width: '100%', height: `${deepseekShare}%`, background: sp.accent }} />
                            <div style={{ width: '100%', height: `${100 - deepseekShare}%`, background: tones.info }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </>
          )}
        </div>
      </AdminCard>

      {/* Edge Functions table — per-function status */}
      <AdminCard padding="6px 6px 14px">
        <AdminGroupTitle
          label={`${t('admin:monitoring.edgeFunctions')} (${edgeFunctions.length})`}
          tone={errorCount > 0 ? 'err' : 'ok'}
          right={
            <>
              {/* Status filter pills */}
              {(['all', 'healthy', 'error', 'unknown'] as FunctionFilter[]).map(f => {
                const on = fnFilter === f
                return (
                  <button
                    key={f}
                    onClick={() => setFnFilter(f)}
                    style={{
                      height: 28, padding: '0 12px', borderRadius: ADMIN_RADII.pill, border: 0,
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                      whiteSpace: 'nowrap', transition: 'background .18s ease',
                      background: on ? sp.accent : surf.cardSub,
                      color: on ? sp.accentInk : sp.soft,
                    }}
                  >
                    {f === 'all' ? t('admin:monitoring.edgeFunctions.filter.all') : f === 'healthy' ? t('admin:monitoring.edgeFunctions.filter.ok') : f === 'error' ? t('admin:monitoring.edgeFunctions.filter.error') : t('admin:monitoring.edgeFunctions.filter.unknown')}
                  </button>
                )
              })}
              <div style={{ position: 'relative', marginLeft: 4 }}>
                <AdminIc icon={Search} size={14} color={sp.soft} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder={t('admin:monitoring.edgeFunctions.filterPlaceholder')}
                  value={fnSearch}
                  onChange={e => setFnSearch(e.target.value)}
                  style={{
                    height: 28, width: 152, padding: '0 12px 0 31px', borderRadius: ADMIN_RADII.pill,
                    // Hairline du kit (`surf.hairline`) et non un couple d'alphas local : la page
                    // en introduisait un troisième jeu, divergent des bentos. `box-sizing:
                    // border-box` (preflight Tailwind) garde la hauteur de pilule malgré le filet.
                    border: surf.hairline, outline: 'none', fontFamily: 'inherit', fontSize: 11.5,
                    background: surf.cardSub, color: sp.ink,
                  }}
                />
              </div>
            </>
          }
        />

        {edgeFunctionsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 10px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <AdminSkeleton key={i} height={36} />
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <AdminTh>{t('admin:monitoring.edgeFunctions.table.function')}</AdminTh>
                  <AdminTh align="center" width={72}>{t('admin:monitoring.edgeFunctions.table.status')}</AdminTh>
                  <AdminTh align="right" width={104}>{t('admin:monitoring.edgeFunctions.table.invocations')}</AdminTh>
                  <AdminTh align="right" width={88}>{t('admin:monitoring.edgeFunctions.table.errors')}</AdminTh>
                  <AdminTh align="right" width={132}>{t('admin:monitoring.edgeFunctions.table.lastInvocation')}</AdminTh>
                </tr>
              </thead>
              <tbody>
                {filteredFunctions.map(fn => (
                  <tr key={fn.name}>
                    <AdminTd style={{ fontFamily: MONO, fontWeight: 600 }}>{fn.name}</AdminTd>
                    <AdminTd align="center">
                      <span style={{
                        display: 'inline-block', width: 8, height: 8, borderRadius: ADMIN_RADII.pill,
                        background: fn.status === 'healthy' ? tones.ok : fn.status === 'error' ? tones.err : sp.soft,
                      }} />
                    </AdminTd>
                    <AdminTd align="right" numeric style={{ color: sp.sub }}>{fn.invocationsLast24h}</AdminTd>
                    <AdminTd align="right" numeric style={fn.errorsLast24h > 0 ? { color: tones.err, fontWeight: 700 } : { color: sp.soft }}>
                      {fn.errorsLast24h}
                    </AdminTd>
                    <AdminTd align="right" numeric style={{ fontSize: 11.5, color: sp.soft }}>
                      {fn.lastInvocation ? formatRelativeDate(fn.lastInvocation) : '-'}
                    </AdminTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Error logs — expandable */}
      <AdminCard padding="6px 6px 14px">
        <AdminGroupTitle
          label={`${t('admin:monitoring.errorLogs')} (${errorLogs.length})`}
          tone={errorLogs.length > 0 ? 'err' : 'ok'}
          right={
            <div style={{ position: 'relative' }}>
              <AdminIc icon={Search} size={14} color={sp.soft} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder={t('admin:monitoring.errorLogs.filterPlaceholder')}
                value={errorSearch}
                onChange={(e) => setErrorSearch(e.target.value)}
                style={{
                  height: 30, width: 256, padding: '0 12px 0 31px', borderRadius: ADMIN_RADII.pill,
                  // Même filet que le champ de filtre des fonctions : la valeur vient du kit.
                  border: surf.hairline, outline: 'none', fontFamily: 'inherit', fontSize: 11.5,
                  background: surf.cardSub, color: sp.ink,
                }}
              />
            </div>
          }
        />

        {errorLogsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 10px' }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <AdminSkeleton key={i} height={40} />
            ))}
          </div>
        ) : filteredErrors.length === 0 ? (
          <AdminEmpty
            icon={CheckCircle}
            title={t('admin:monitoring.errorLogs.noErrors')}
            hint={t('admin:monitoring.errorLogs.noErrorsSubtitle')}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 10px' }}>
            {filteredErrors.map((err) => {
              const isExpanded = expandedError === err.id
              return (
                <div key={err.id}>
                  <button
                    onClick={() => setExpandedError(isExpanded ? null : err.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'flex-start', gap: 11,
                      padding: '11px 13px', borderRadius: ADMIN_RADII.row, border: 0,
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      background: surf.cardSub,
                      // Liseré d'alerte en ombre intérieure : le signal reste, sans
                      // bordure décorative sur la ligne.
                      boxShadow: `inset 3px 0 0 ${tones.err}`,
                    }}
                  >
                    <AdminIc icon={AlertTriangle} size={16} color={tones.err} style={{ marginTop: 1 }} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <AdminPill
                          label={err.function_name ?? err.entity_type}
                          tone="neutral"
                          style={{ fontFamily: MONO, fontSize: 11, padding: '3px 9px' }}
                        />
                        {err.duration_ms && (
                          <span style={{ fontSize: 11, color: sp.soft, fontVariantNumeric: 'tabular-nums' }}>{err.duration_ms}ms</span>
                        )}
                      </div>
                      <p style={{
                        margin: '5px 0 0', fontSize: 12, color: sp.sub,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {err.error_message || JSON.stringify(err.metadata).slice(0, 120)}
                      </p>
                    </div>
                    <span style={{ fontSize: 11, color: sp.soft, flexShrink: 0, whiteSpace: 'nowrap' }}>
                      {formatRelativeDate(err.created_at)}
                    </span>
                  </button>
                  {isExpanded && (
                    <div style={{
                      margin: '5px 0 0 28px', padding: '11px 13px', borderRadius: ADMIN_RADII.row,
                      background: surf.cardSub,
                    }}>
                      <pre style={{
                        margin: 0, fontFamily: MONO, fontSize: 11, color: sp.sub,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                      }}>
                        {JSON.stringify(err.metadata, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </AdminCard>
    </AdminPage>
  )
}

/**
 * Tuile de santé — libellé discret, chiffre tabulaire, jauge et note optionnelles.
 *
 * `AdminStat` du kit ne porte pas de jauge, et deux des six tuiles de santé en
 * ont une (DB, storage) : mélanger les deux dépareillerait la grille. La
 * typographie est celle d'`AdminStat` (19/800/-0.6 sur le chiffre).
 */
function HealthTile({ icon, label, value, valueColor, gauge, hint }: {
  icon: LucideIcon
  label: string
  value: string | number
  valueColor?: string
  gauge?: { percent: number; color: string }
  hint?: ReactNode
}) {
  const { sp, surf } = useAdminSugar()
  return (
    <AdminCard padding="14px 16px">
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <AdminIc icon={icon} size={14} color={sp.sub} />
        <span style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: 0.1, color: sp.sub }}>{label}</span>
      </div>
      <div style={{
        fontSize: 19, fontWeight: 800, letterSpacing: -0.6, lineHeight: 1.1,
        color: valueColor ?? sp.ink, fontVariantNumeric: 'tabular-nums',
      }}>
        {value}
      </div>
      {gauge && (
        <div style={{ height: 4, borderRadius: ADMIN_RADII.pill, background: surf.cardSub, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(gauge.percent, 100)}%`, borderRadius: ADMIN_RADII.pill, background: gauge.color }} />
        </div>
      )}
      {hint && (
        <div style={{ fontSize: 11, color: sp.soft, marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{hint}</div>
      )}
    </AdminCard>
  )
}

/** Abrège un nombre de tokens en k/M pour l'affichage compact des cartes IA. */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
