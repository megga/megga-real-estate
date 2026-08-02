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
import { Database, Zap, Mail, CheckCircle, AlertTriangle, HardDrive, Globe, Home, DollarSign, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useAdminMonitoring } from '@/hooks/useAdminMonitoring'
import { useDeepSeekBalance, useAIUsageSummary, useAIUsageTimeseries } from '@/hooks/useAIBilling'
import { useCronHealth } from '@/hooks/useCronHealth'
import { useAdminCronRunNow } from '@/hooks/useAdminCronRunNow'
import { cronStale } from '@/lib/cronHealth'
import { formatNextRun } from '@/lib/cronRunNow'
import CronRunNowConfirm from '@/components/admin/CronRunNowConfirm'
import { useToast } from '@/components/ui/Toast'
import { SyndicationHealthPanel, WhatsAppOpsPanel } from '@/components/admin/AdminOpsPanels'
import IntegrationsHealthPanel from '@/components/admin/IntegrationsHealthPanel'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminCard, AdminDivider, AdminEmpty, AdminError, AdminGhostBtn, AdminGroupTitle, AdminIc,
  AdminPill, AdminSearchInput, AdminSkeleton, AdminTd, AdminTh,
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

  // Santé de la synchro Flatfox.
  //
  // `count: 'exact'` sur `market_listings` (173k lignes) est ici une exception
  // ASSUMÉE à la règle §7, et elle tient à un index. Sans lui, ce comptage
  // prenait 17 s (bitmap heap scan, 19 934 blocs) — au-delà du statement_timeout
  // de 8 s du rôle `authenticated` : la carte échouait tout simplement. Avec
  // `idx_ml_flatfox_sync` (partiel sur flatfox, INCLUDE status), c'est un
  // index-only scan à 166 ms, mesuré.
  //
  // Pourquoi pas `estimated` : l'estimation du planificateur donne 46 023 pour
  // 35 341 lignes réelles. Sur une carte qui sert à repérer une synchro en
  // panne, 10 000 annonces d'écart valent moins que 166 ms.
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

  // ── Geste « Relancer un cron » (étape 28) ─────────────────────────────────
  const runNow = useAdminCronRunNow()
  const toast = useToast()
  /**
   * Crons dont la relance est en vol. Un ENSEMBLE, pas un seul nom : relancer deux crons
   * de suite est légitime, et avec un nom unique le second clic ré-activait le bouton du
   * premier — deux clés, donc deux passages programmés pour un seul geste voulu.
   */
  const [running, setRunning] = useState<ReadonlySet<string>>(() => new Set())
  /** Confirmation demandée par le SERVEUR ; la clé est celle du geste, rejouée telle quelle. */
  const [confirming, setConfirming] = useState<{ jobname: string; key: string; messageFr: string } | null>(null)
  /** Issue affichée à la place du bouton, une fois la relance demandée. */
  const [runDone, setRunDone] = useState<Record<string, string>>({})

  /**
   * Un tour du geste. `key` vient de l'appelant : le premier clic en tire une neuve, la
   * confirmation REJOUE la même — le refus « confirmez » ne consomme pas la clé (tous les
   * contrôles de la RPC précèdent sa réservation), et en tirer une seconde programmerait
   * deux passages sur un double-clic.
   */
  const relancerCron = (jobname: string, key: string, confirm: boolean) => {
    setRunning(v => new Set(v).add(jobname))
    runNow.mutate({ jobname, idempotencyKey: key, confirm }, {
      onSuccess: (issue) => {
        if (issue.kind === 'needs_confirm') { setConfirming({ jobname, key, messageFr: issue.messageFr }); return }
        setConfirming(null)
        if (issue.kind === 'already_done') {
          setRunDone(v => ({ ...v, [jobname]: t('admin:monitoring.cronHealth.runNowAlready') }))
          return
        }
        // « demandée », jamais « relancé » : à cette seconde le job n'a pas tourné, et pour
        // les crons qui délèguent à `net.http_post` même son succès ne prouverait que
        // l'enfilage de la requête. Le libellé de la maquette dit exactement cela.
        const heure = formatNextRun(issue.scheduledForIso)
        const texte = heure
          ? t('admin:monitoring.cronHealth.runNowRequested', { time: heure })
          : t('admin:monitoring.cronHealth.runNowRequestedNoTime')
        setRunDone(v => ({ ...v, [jobname]: texte }))
        toast.success(texte)
      },
      onError: (e: Error) => { setConfirming(null); toast.error(e.message) },
      onSettled: () => setRunning(v => { const n = new Set(v); n.delete(jobname); return n }),
    })
  }

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
                {t('admin:monitoring.errorTitle')}
              </p>
              <p style={{ margin: '3px 0 0', fontSize: 12, color: sp.sub, lineHeight: 1.45 }}>
                {t('admin:monitoring.errorDesc')}
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
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{t('admin:monitoring.flatfox.title')}</span>
            </span>
            <span style={{ fontSize: 12.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {t('admin:monitoring.flatfox.activeListings', { count: flatfoxStats.data.total })}
            </span>
            <span style={{ fontSize: 11.5, color: sp.soft }}>
              {flatfoxLastSeen
                ? t('admin:monitoring.flatfox.lastSync', { when: formatRelativeDate(flatfoxLastSeen) })
                : t('admin:monitoring.flatfox.never')}
            </span>
            <span style={{ marginLeft: 'auto' }}>
              <AdminPill
                label={flatfoxFresh ? t('admin:monitoring.flatfox.ok') : t('admin:monitoring.flatfox.late')}
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
          <AdminError message={t('admin:monitoring.cronHealth.errorDesc')} />
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
                  <AdminTh align="right" width={210}>{t('admin:monitoring.cronHealth.action')}</AdminTh>
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
                      <AdminTd align="right">
                        {runDone[row.jobname] ? (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.soft }}>{runDone[row.jobname]}</span>
                        ) : (
                          // Le bouton reste offert sur un cron désactivé : c'est la RPC qui
                          // refuse, avec sa raison. Le masquer ferait deux juges, et l'écran
                          // se tromperait le jour où la règle bouge en base.
                          <AdminGhostBtn
                            onClick={() => relancerCron(row.jobname, crypto.randomUUID(), false)}
                            disabled={running.has(row.jobname)}
                            // Le nom accessible CONTIENT le texte visible dans les deux
                            // états (WCAG 2.5.3) : il change donc avec lui, sinon le
                            // libellé « Relance… » n'aurait plus de nom qui le reprenne.
                            label={running.has(row.jobname)
                              ? t('admin:monitoring.cronHealth.runNowPendingFor', { job: row.jobname })
                              : t('admin:monitoring.cronHealth.runNowFor', { job: row.jobname })}
                          >
                            {running.has(row.jobname)
                              ? t('admin:monitoring.cronHealth.runNowPending')
                              : t('admin:monitoring.cronHealth.runNow')}
                          </AdminGhostBtn>
                        )}
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

      {/* Consommation IA — DeepSeek seul : Anthropic a été retiré du runtime
          (#829) et les dernières lignes `claude-*` d'`ai_usage_logs` datent
          d'avril. Deux tuiles et une série de graphe affichaient donc un coût
          figé, sous un nom que l'interface n'a pas le droit de porter. */}
      <AdminCard padding="6px 6px 18px">
        <AdminGroupTitle
          label={t('admin:monitoring.ai.title')}
          tone={balanceLow ? 'err' : 'cyan'}
          right={
            <>
              {balanceLow && <AdminPill label={t('admin:monitoring.ai.topUp')} tone="err" icon={AlertTriangle} />}
              {aiUsage.data?.fallbackCount ? (
                <AdminPill
                  label={t('admin:monitoring.ai.fallbacks', { count: aiUsage.data.fallbackCount })}
                  tone="warn"
                />
              ) : null}
            </>
          }
        />

        <div style={{ padding: '0 10px' }}>
          <div className="grid grid-cols-2 gap-4">
            <HealthTile
              icon={DollarSign}
              label={t('admin:monitoring.ai.balance')}
              value={balance !== null ? `$${balance.toFixed(2)}` : '—'}
              valueColor={balanceLow ? tones.err : undefined}
              hint={deepseekBalance.data?.captured_at
                ? formatRelativeDate(deepseekBalance.data.captured_at)
                : t('admin:monitoring.ai.noSnapshot')}
            />

            <HealthTile
              icon={Zap}
              label={t('admin:monitoring.ai.tokensMonth')}
              value={formatTokens(aiUsage.data?.deepseekTokens ?? 0)}
              hint={`≈ $${(aiUsage.data?.deepseekCostUsd ?? 0).toFixed(2)}`}
            />

          </div>

          {aiTimeseries.data && aiTimeseries.data.length > 0 && (
            <>
              <AdminDivider margin="16px 0 12px" />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 9 }}>
                <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub }}>{t('admin:monitoring.ai.tokensPerDay')}</span>
                {/* Une seule série depuis le retrait d'Anthropic : la légende à
                    deux teintes n'avait plus rien à distinguer. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 13, fontSize: 11, color: sp.soft }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: sp.accent }} /> DeepSeek
                  </span>
                </div>
              </div>
              {(() => {
                const max = Math.max(1, ...aiTimeseries.data.map((p) => p.deepseek))
                return (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 128 }}>
                    {aiTimeseries.data.map((p) => {
                      const totalPct = (p.deepseek / max) * 100
                      return (
                        <div
                          key={p.date}
                          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column-reverse' }}
                          title={`${p.date} — DeepSeek ${formatTokens(p.deepseek)}`}
                        >
                          <div style={{ width: '100%', height: `${totalPct}%`, background: sp.accent }} />
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
              <AdminSearchInput
              compact
                value={fnSearch}
                onChange={setFnSearch}
                placeholder={t('admin:monitoring.edgeFunctions.filterPlaceholder')}
                label={t('admin:monitoring.edgeFunctions.filterPlaceholder')}
                maxWidth={200}
              />
            </>
          }
        />

        {edgeFunctionsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, padding: '0 10px' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <AdminSkeleton key={i} height={36} />
            ))}
          </div>
        ) : filteredFunctions.length === 0 ? (
          // Un filtre trop étroit ne rendait RIEN : ni ligne, ni explication —
          // juste un en-tête de colonnes suspendu au-dessus du vide.
          <AdminEmpty
            icon={Zap}
            title={t('admin:common.noResult')}
            hint={t('admin:common.modifyFilters')}
          />
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
            <AdminSearchInput
              compact
              value={errorSearch}
              onChange={setErrorSearch}
              placeholder={t('admin:monitoring.errorLogs.filterPlaceholder')}
              label={t('admin:monitoring.errorLogs.filterPlaceholder')}
              maxWidth={256}
            />
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

      {confirming && (
        <CronRunNowConfirm
          jobname={confirming.jobname}
          messageFr={confirming.messageFr}
          pending={running.has(confirming.jobname)}
          onConfirm={() => relancerCron(confirming.jobname, confirming.key, true)}
          onClose={() => setConfirming(null)}
        />
      )}
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
/**
 * Tuile de santé — locale à cet écran, et volontairement distincte d'`AdminStat`.
 *
 * Même bento, même taille de chiffre, mais l'arrangement diffère (libellé
 * AU-DESSUS de la valeur, pas à côté) et elle porte une jauge de remplissage
 * qu'aucune autre surface n'utilise. Les fondre dans le kit donnerait un atome
 * à sept props dont deux s'excluent — une jauge et une tendance ne cohabitent
 * pas dans la même tuile.
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
