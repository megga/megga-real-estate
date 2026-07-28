/**
 * Page super-admin — annuaire des agences.
 *
 * Route : `/agencies`. Liste paginée (10/page) avec recherche, filtre de statut,
 * export CSV et score de santé par agence. La santé s'appuie sur un résumé
 * d'activité agrégé server-side (RPC `get_agency_activity_summary`) pour éviter de
 * scanner activity_events.
 *
 * Rendu en grammaire Sugar (kit `components/admin/kit`) : l'en-tête et la largeur
 * viennent d'`AdminPage` (la pastille violette vit désormais dans le rail, une
 * seule fois), les bentos sont séparés par l'ombre et non par une bordure, les
 * statuts sont des pilules pleines, les avatars n'ont plus qu'un fond — l'encre —
 * et tous les compteurs sont en chiffres tabulaires.
 *
 * Le tableau desktop reste une grille de `<Link>` (et non un `<table>`) : chaque
 * ligne EST un lien vers la fiche, ce qui préserve le clic milieu et « ouvrir
 * dans un nouvel onglet ». Sa typographie reprend celle d'`AdminTh`/`AdminTd`.
 */
import { useState, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, Building2, ChevronLeft, ChevronRight, Download, Plus } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { formatDate } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import type { AgencyWithStats } from '@/hooks/useAdminAgencies'
import { calculateAgencyHealth } from '@/lib/agencyHealthScore'
import AgencyHealthBadge from '@/components/admin/AgencyHealthBadge'
import AgencyUsageOverview from '@/components/admin/AgencyUsageOverview'
import CreateAgencyModal from '@/components/admin/CreateAgencyModal'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import AdminPage from '@/components/admin/kit/AdminPage'
import {
  AdminAvatar, AdminCard, AdminEmpty, AdminError, AdminGhostBtn, AdminIc, AdminPill, AdminSkeleton, AdminSolidBtn,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'

const ITEMS_PER_PAGE = 10

const PLAN_LABEL: Record<string, string> = {
  starter: 'Starter',
  pro: 'Pro',
  entreprise: 'Entreprise',
}

// Statuts d'abonnement à signaler. Pilule pleine plutôt que texte coloré : c'est
// un statut, pas une nuance de prose.
const SUB_BADGE: Record<string, { i18nKey: string; tone: AdminToneName }> = {
  trialing: { i18nKey: 'agencies.sub.trialing', tone: 'info' },
  past_due: { i18nKey: 'agencies.sub.pastDue', tone: 'err' },
}

// Largeurs de colonnes partagées par l'en-tête et les lignes — sans elles, les
// deux grilles dérivent l'une de l'autre au moindre changement.
const COL = {
  plan: 84,
  agents: 62,
  properties: 62,
  transactions: 84,
  date: 94,
  status: 98,
  health: 62,
  action: 106,
} as const

function SubscriptionBadge({ status }: { status: string | null }) {
  const { t } = useTranslation('admin')
  if (!status || !SUB_BADGE[status]) return null
  const meta = SUB_BADGE[status]
  return <AdminPill label={t(meta.i18nKey)} tone={meta.tone} style={{ padding: '3px 9px', fontSize: 10.5 }} />
}

/** Initiale d'agence pour l'avatar (la couleur, elle, ne dépend plus du nom). */
function agencyInitial(name: string): string {
  return (name || '?')[0].toUpperCase()
}

/** Placeholder du tableau desktop pendant le chargement. */
function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px' }}>
          <AdminSkeleton height={34} width={34} radius={ADMIN_RADII.pill} />
          <div style={{ flex: 1, display: 'grid', gap: 6 }}>
            <AdminSkeleton height={11} width={150} radius={ADMIN_RADII.pill} />
            <AdminSkeleton height={9} width={94} radius={ADMIN_RADII.pill} />
          </div>
          <AdminSkeleton height={10} width={COL.plan - 24} radius={ADMIN_RADII.pill} />
          <AdminSkeleton height={10} width={COL.agents - 30} radius={ADMIN_RADII.pill} />
          <AdminSkeleton height={10} width={COL.properties - 30} radius={ADMIN_RADII.pill} />
          <AdminSkeleton height={10} width={COL.transactions - 40} radius={ADMIN_RADII.pill} />
          <AdminSkeleton height={10} width={COL.date - 30} radius={ADMIN_RADII.pill} />
          <AdminSkeleton height={20} width={COL.status - 24} radius={ADMIN_RADII.pill} />
          <AdminSkeleton height={20} width={COL.health - 20} radius={ADMIN_RADII.pill} />
          <div style={{ width: COL.action }} />
        </div>
      ))}
    </>
  )
}

/** Écran annuaire : chargement, filtres, pagination et calcul du score de santé. */
export default function AdminAgenciesPage() {
  'use no memo'
  const { t } = useTranslation('admin')
  const { agencies, isLoading, isError, refetch, updateStatus } = useAdminAgencies()
  const { sp, surf, dark, tones } = useAdminSugar()

  // Activity data for health scores.
  // Agrégé SERVER-SIDE via RPC : l'ancien code chargeait toutes les lignes
  // activity_events des 30 derniers jours dans le navigateur (SELECT non borné
  // sur une table d'audit append-only → des dizaines de milliers de lignes pour
  // un super_admin réel). La RPC renvoie ~1 ligne par agence. Voir migration
  // 20260705210000_agency_activity_summary_rpc + CLAUDE.md §7.
  const agencyIds = useMemo(() => agencies.map((a) => a.id), [agencies])
  const activityQuery = useQuery({
    queryKey: ['admin-agency-activity-summary', agencyIds],
    enabled: agencyIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.rpc('get_agency_activity_summary', {
        agency_ids: agencyIds,
        since_days: 30,
      })
      const byAgency: Record<string, { count: number; lastAt: string }> = {}
      for (const row of data ?? []) {
        if (!row.agency_id) continue
        byAgency[row.agency_id] = {
          count: Number(row.event_count),
          lastAt: row.last_activity_at,
        }
      }
      return byAgency
    },
    staleTime: 60_000,
  })

  const healthMap = useMemo(() => {
    const map: Record<string, ReturnType<typeof calculateAgencyHealth>> = {}
    for (const agency of agencies) {
      const ad = activityQuery.data?.[agency.id]
      map[agency.id] = calculateAgencyHealth({
        daysSinceLastActivity: ad ? Math.floor((Date.now() - new Date(ad.lastAt).getTime()) / 86400000) : 999,
        activePropertiesCount: agency.property_count,
        contactsCount: 0,
        transactionsCount: agency.transaction_count,
        eventsLast30Days: ad?.count ?? 0,
      })
    }
    return map
  }, [agencies, activityQuery.data])

  function getHealth(agency: AgencyWithStats) {
    return healthMap[agency.id] ?? calculateAgencyHealth({ daysSinceLastActivity: 999, activePropertiesCount: 0, contactsCount: 0, transactionsCount: 0, eventsLast30Days: 0 })
  }

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)

  const filtered = useMemo(() => {
    let list = [...agencies]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(a => a.name.toLowerCase().includes(q) || (a.email ?? '').toLowerCase().includes(q))
    }
    if (statusFilter) list = list.filter(a => a.status === statusFilter)
    return list
  }, [agencies, search, statusFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function handleToggleStatus(e: React.MouseEvent, agency: AgencyWithStats) {
    e.preventDefault()
    e.stopPropagation()
    const newStatus = agency.status === 'active' ? 'suspended' : 'active'
    updateStatus.mutate({ id: agency.id, status: newStatus })
  }

  const statusFilters = [
    { value: '', label: t('common.all') },
    { value: 'active', label: t('common.status.active') },
    { value: 'suspended', label: t('common.status.suspended') },
  ]

  const hair = surf.hairline
  const num: CSSProperties = { fontVariantNumeric: 'tabular-nums' }
  const cell: CSSProperties = { fontSize: 12, color: sp.soft }
  const headCell: CSSProperties = { fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: sp.sub, whiteSpace: 'nowrap' }
  // Champ Sugar : surface creuse + filet intérieur, aucune bordure décorative.
  const fieldStyle: CSSProperties = {
    width: '100%', height: 36, borderRadius: ADMIN_RADII.row, border: 0,
    background: surf.cardSub, color: sp.ink,
    fontFamily: 'inherit', fontSize: 13, fontWeight: 600, outline: 'none',
    boxShadow: `0 0 0 1.5px ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(15,23,42,0.06)'} inset`,
  }
  const pagerBtn: CSSProperties = {
    width: 30, height: 30, borderRadius: ADMIN_RADII.pill, border: 0, background: 'transparent',
    display: 'grid', placeItems: 'center', cursor: 'pointer', color: sp.sub,
  }

  /** Statut d'une agence : pilule pleine (l'ancien point vert/rouge ne se lisait pas). */
  const statusPill = (agency: AgencyWithStats) => (
    <AdminPill
      label={t(agency.status === 'active' ? 'common.status.active' : 'common.status.suspended')}
      tone={agency.status === 'active' ? 'ok' : 'err'}
      style={{ padding: '4px 10px', fontSize: 11 }}
    />
  )

  return (
    <AdminPage
      title={t('agencies.title')}
      subtitle={isLoading ? t('common.loading') : t(agencies.length !== 1 ? 'agencies.subtitle_plural' : 'agencies.subtitle', { count: agencies.length })}
      width="wide"
      actions={
        <>
          <AdminGhostBtn
            icon={Download}
            onClick={() => exportToCsv('megga-agences', agencies.map(a => ({
              nom: a.name, plan: a.plan ?? '', agents: a.agent_count,
              biens: a.property_count, transactions: a.transaction_count,
              statut: a.status, date: a.created_at,
            })))}
          >
            {t('agencies.export')}
          </AdminGhostBtn>
          <AdminSolidBtn icon={Plus} onClick={() => setShowCreate(true)}>
            {t('agencies.create')}
          </AdminSolidBtn>
        </>
      }
    >
      {/* Survol de ligne et révélation de l'action : impossible en style inline. */}
      <style>{`
        .agx-row { text-decoration: none; transition: background-color .16s ease; }
        .agx-row:hover { background: ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.025)'}; }
        .agx-act { opacity: 0; transition: opacity .16s ease; }
        .agx-row:hover .agx-act, .agx-row:focus-visible .agx-act { opacity: 1; }
      `}</style>

      {showCreate && <CreateAgencyModal onClose={() => setShowCreate(false)} />}

      {/* Filtres */}
      <AdminCard padding="10px 12px">
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 320 }}>
            <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', display: 'grid' }}>
              <AdminIc icon={Search} size={15} color={sp.sub} />
            </span>
            <input
              type="text"
              placeholder={t('agencies.searchPlaceholder')}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              style={{ ...fieldStyle, padding: '0 12px 0 34px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {statusFilters.map((f) => {
              const on = statusFilter === f.value
              return (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1) }}
                  aria-pressed={on}
                  style={{
                    height: 32, padding: '0 14px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                    background: on ? sp.accent : 'transparent',
                    color: on ? sp.accentInk : sp.soft,
                  }}
                >
                  {f.label}
                </button>
              )
            })}
          </div>
        </div>
      </AdminCard>

      {/* Usage consolidé par agence (repliable, chargé à la demande) */}
      <AgencyUsageOverview />

      {/* Mobile : cartes. Le display vient des CLASSES (un `display` inline
          l'emporterait sur `md:hidden` et la liste resterait visible en desktop). */}
      <div className="md:hidden space-y-2">
        {isLoading ? (
          <>
            <AdminSkeleton height={62} radius={ADMIN_RADII.card} />
            <AdminSkeleton height={62} radius={ADMIN_RADII.card} />
            <AdminSkeleton height={62} radius={ADMIN_RADII.card} />
          </>
        ) : isError && paginated.length === 0 ? (
          <AdminCard padding={0}>
            <AdminError
              message={t('common.loadError')}
              onRetry={() => void refetch()}
              retryLabel={t('common.retry')}
            />
          </AdminCard>
        ) : paginated.length === 0 ? (
          <AdminCard padding={0}>
            <EmptyState hasFilters={!!search || !!statusFilter} />
          </AdminCard>
        ) : (
          paginated.map((agency) => (
            <Link key={agency.id} to={`${ADMIN_CONSOLE_PATH}/agencies/${agency.id}`} style={{ textDecoration: 'none', display: 'block' }}>
              <AdminCard padding="12px 14px">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <AdminAvatar initials={agencyInitial(agency.name)} size={34} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agency.name}
                    </p>
                    <p style={{ margin: '2px 0 0', fontSize: 11.5, color: sp.sub, ...num }}>
                      {PLAN_LABEL[agency.plan ?? ''] ?? agency.plan ?? 'Starter'}
                      {' · '}{agency.agent_count} agent{agency.agent_count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {statusPill(agency)}
                </div>
              </AdminCard>
            </Link>
          ))
        )}
      </div>

      {/* Desktop : tableau */}
      <AdminCard className="hidden md:block" padding={0} style={{ overflow: 'hidden' }}>
        {/* Ligne d'en-tête */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '9px 16px', background: sp.tableHeadBg }}>
          <span style={{ ...headCell, flex: 1 }}>{t('agencies.table.name')}</span>
          <span style={{ ...headCell, width: COL.plan }}>{t('agencies.table.plan')}</span>
          <span style={{ ...headCell, width: COL.agents, textAlign: 'center' }}>{t('agencies.table.agents')}</span>
          <span style={{ ...headCell, width: COL.properties, textAlign: 'center' }}>{t('agencies.table.properties')}</span>
          <span style={{ ...headCell, width: COL.transactions, textAlign: 'center' }}>{t('agencies.table.transactions')}</span>
          <span style={{ ...headCell, width: COL.date }}>{t('agencies.table.date')}</span>
          <span style={{ ...headCell, width: COL.status, textAlign: 'center' }}>{t('agencies.table.status')}</span>
          <span style={{ ...headCell, width: COL.health, textAlign: 'center' }}>{t('agencies.table.health')}</span>
          <span style={{ width: COL.action }} />
        </div>

        {/* Lignes */}
        {isLoading ? (
          <SkeletonRows />
        ) : isError && paginated.length === 0 ? (
          <AdminError
            message={t('common.loadError')}
            onRetry={() => void refetch()}
            retryLabel={t('common.retry')}
          />
        ) : paginated.length === 0 ? (
          <EmptyState hasFilters={!!search || !!statusFilter} />
        ) : (
          paginated.map((agency, i) => (
            <Link
              key={agency.id}
              to={`${ADMIN_CONSOLE_PATH}/agencies/${agency.id}`}
              className="agx-row"
              style={{ display: 'flex', alignItems: 'center', padding: '11px 16px', borderTop: i === 0 ? undefined : hair }}
            >
              {/* Nom + avatar */}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                <AdminAvatar initials={agencyInitial(agency.name)} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agency.name}
                    </p>
                    <SubscriptionBadge status={agency.subscription_status} />
                  </div>
                  {agency.email && (
                    <p style={{ margin: '1px 0 0', fontSize: 11.5, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {agency.email}
                    </p>
                  )}
                </div>
              </div>

              {/* Plan */}
              <span style={{ ...cell, width: COL.plan }}>
                {PLAN_LABEL[agency.plan ?? ''] ?? agency.plan ?? 'Starter'}
              </span>

              {/* Agents */}
              <span style={{ ...cell, ...num, width: COL.agents, textAlign: 'center' }}>
                {agency.agent_count}
              </span>

              {/* Biens */}
              <span style={{ ...cell, ...num, width: COL.properties, textAlign: 'center' }}>
                {agency.property_count}
              </span>

              {/* Transactions */}
              <span style={{ ...cell, ...num, width: COL.transactions, textAlign: 'center' }}>
                {agency.transaction_count}
              </span>

              {/* Date */}
              <span style={{ ...cell, ...num, width: COL.date, color: sp.sub }}>
                {formatDate(agency.created_at)}
              </span>

              {/* Statut */}
              <div style={{ width: COL.status, display: 'flex', justifyContent: 'center' }}>
                {statusPill(agency)}
              </div>

              {/* Santé */}
              <div style={{ width: COL.health, display: 'flex', justifyContent: 'center' }}>
                {(() => { const h = getHealth(agency); return <AgencyHealthBadge score={h.score} level={h.level} /> })()}
              </div>

              {/* Action au survol */}
              <div style={{ width: COL.action, display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="agx-act"
                  onClick={(e) => handleToggleStatus(e, agency)}
                  style={{
                    height: 28, padding: '0 12px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap',
                    background: surf.card, boxShadow: sp.shadowSm,
                    color: agency.status === 'active' ? tones.err : tones.ok,
                  }}
                >
                  {agency.status === 'active' ? t('agencies.action.suspend') : t('agencies.action.activate')}
                </button>
              </div>
            </Link>
          ))
        )}

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderTop: hair }}>
            <p style={{ margin: 0, fontSize: 11.5, color: sp.sub, ...num }}>
              {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} {t('common.on')} {filtered.length}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                aria-label={t('common.previousPage')}
                style={{ ...pagerBtn, opacity: safePage <= 1 ? 0.4 : 1, cursor: safePage <= 1 ? 'not-allowed' : 'pointer' }}
              >
                <AdminIc icon={ChevronLeft} size={16} color={sp.sub} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1]
                  const showEllipsis = prev !== undefined && p - prev > 1
                  return (
                    <span key={p} style={{ display: 'flex', alignItems: 'center' }}>
                      {showEllipsis && <span style={{ padding: '0 4px', fontSize: 11.5, color: sp.sub }}>...</span>}
                      <button
                        onClick={() => setPage(p)}
                        style={{
                          height: 28, minWidth: 28, padding: '0 8px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                          fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, ...num,
                          background: p === safePage ? sp.accent : 'transparent',
                          color: p === safePage ? sp.accentInk : sp.soft,
                        }}
                      >
                        {p}
                      </button>
                    </span>
                  )
                })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                aria-label={t('common.nextPage')}
                style={{ ...pagerBtn, opacity: safePage >= totalPages ? 0.4 : 1, cursor: safePage >= totalPages ? 'not-allowed' : 'pointer' }}
              >
                <AdminIc icon={ChevronRight} size={16} color={sp.sub} />
              </button>
            </div>
          </div>
        )}
      </AdminCard>

      {/* Pagination mobile — hauteur 44 pour rester une cible tactile confortable */}
      {!isLoading && filtered.length > ITEMS_PER_PAGE && (
        <div className="md:hidden flex items-center justify-between" style={{ padding: '0 4px' }}>
          <AdminGhostBtn
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={{ height: 44 }}
          >
            {t('common.previous')}
          </AdminGhostBtn>
          <span style={{ fontSize: 12, color: sp.sub, ...num }}>{safePage}/{totalPages}</span>
          <AdminGhostBtn
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            style={{ height: 44 }}
          >
            {t('common.next')}
          </AdminGhostBtn>
        </div>
      )}
    </AdminPage>
  )
}

/** État vide, messages distincts selon qu'un filtre est actif ou non. */
function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  const { t } = useTranslation('admin')
  return (
    <AdminEmpty
      icon={Building2}
      title={hasFilters ? t('agencies.empty.titleFiltered') : t('agencies.empty.title')}
      hint={hasFilters ? t('agencies.empty.subtitleFiltered') : t('agencies.empty.subtitle')}
    />
  )
}
