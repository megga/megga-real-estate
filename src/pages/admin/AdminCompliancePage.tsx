/**
 * Page super-admin — supervision compliance (LAB/KYC + nLPD).
 *
 * Route : `/dashboard/admin/compliance`. KPIs, table de dossiers KYC
 * filtrable par onglet (à risque / en attente / validé / tous), recherche,
 * export CSV, et deux cartes nLPD (couverture des consentements, suppressions
 * de comptes art. 32). Chaque ligne ouvre le dossier KYC agent.
 *
 * Rendu en grammaire Sugar (kit `@/components/admin/kit`) : bentos séparés par
 * l'ombre, risque et statut en pilules pleines, chiffres tabulaires. Le repère
 * violet « Admin MEGGA » a quitté la page — il ne vit plus qu'une fois, dans le
 * rail du shell.
 */
import { useState, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Search, ShieldCheck, AlertTriangle, FileCheck, Clock, ChevronLeft, ChevronRight, Download, Trash2, ClipboardCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { exportToCsv } from '@/lib/exportCsv'
import { formatDate } from '@/lib/utils'
import { useAdminCompliance, useConsentStats, useAccountDeletions } from '@/hooks/useAdminCompliance'
import type { ComplianceCase } from '@/hooks/useAdminCompliance'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import AdminPage from '@/components/admin/kit/AdminPage'
import { AdminCard, AdminDivider, AdminEmpty, AdminError, AdminGhostBtn, AdminIc, AdminPill, AdminSkeleton, AdminStat } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

const ITEMS_PER_PAGE = 10

type TabValue = 'risk' | 'pending' | 'validated' | 'all'

/**
 * Largeurs des colonnes de la table.
 *
 * L'en-tête et les lignes lisent la MÊME source : la table reste une pile de
 * `<Link>` (chaque ligne ouvre le dossier, donc doit rester un lien — clic
 * milieu, nouvel onglet, focus clavier), et un vrai `<table>` ne le permettrait
 * pas sans casser ce comportement.
 */
const COL = {
  agency: 112,
  type: 76,
  risk: 104,
  pep: 56,
  completion: 118,
  status: 104,
  date: 92,
} as const

/** Ton de pilule du niveau de risque LBA (élevé = err, moyen = warn, faible = ok). */
function riskTone(level: string): AdminToneName {
  switch (level) {
    case 'high': return 'err'
    case 'medium': return 'warn'
    case 'low': return 'ok'
    default: return 'neutral'
  }
}

/** Ton de pilule du statut de dossier (validé = ok, rejeté = err, sinon sans signal). */
function statusTone(status: string): AdminToneName {
  switch (status) {
    case 'validated': return 'ok'
    case 'rejected': return 'err'
    default: return 'neutral'
  }
}

/** Restreint les dossiers à l'onglet actif. « À risque » = high OU match de screening. */
function filterCases(cases: ComplianceCase[], tab: TabValue): ComplianceCase[] {
  switch (tab) {
    case 'risk':
      return cases.filter(c => c.risk_level === 'high' || c.screening_status === 'match')
    case 'pending':
      return cases.filter(c => c.status === 'pending' || c.status === 'in_progress')
    case 'validated':
      return cases.filter(c => c.status === 'validated')
    case 'all':
    default:
      return cases
  }
}

/** Placeholder de la table de dossiers pendant le chargement. */
function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '13px 16px' }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <AdminSkeleton key={i} height={38} />
      ))}
    </div>
  )
}

/** État vide de la table, message contextualisé selon l'onglet actif. */
function EmptyState({ tab }: { tab: TabValue }) {
  const { t } = useTranslation('admin')

  const messages: Record<TabValue, { title: string; subtitle: string }> = {
    risk: {
      title: t('compliance.empty.risk.title'),
      subtitle: t('compliance.empty.risk.subtitle'),
    },
    pending: {
      title: t('compliance.empty.pending.title'),
      subtitle: t('compliance.empty.pending.subtitle'),
    },
    validated: {
      title: t('compliance.empty.validated.title'),
      subtitle: t('compliance.empty.validated.subtitle'),
    },
    all: {
      title: t('compliance.empty.all.title'),
      subtitle: t('compliance.empty.all.subtitle'),
    },
  }

  const msg = messages[tab]

  return <AdminEmpty icon={ShieldCheck} title={msg.title} hint={msg.subtitle} />
}

/** En-tête d'une carte nLPD : icône + titre, puis filet de séparation. */
function CardHead({ icon, title }: { icon: LucideIcon; title: string }) {
  const { sp } = useAdminSugar()
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <AdminIc icon={icon} size={16} color={sp.sub} />
        <h2 style={{ margin: 0, fontSize: 13.5, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>{title}</h2>
      </div>
      <AdminDivider margin="12px 0" />
    </>
  )
}

/** Carte nLPD : couverture des consentements par type × version (P2 admin). */
function ConsentStatsCard() {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data, isLoading } = useConsentStats()

  return (
    <AdminCard padding="16px 18px">
      <CardHead icon={ClipboardCheck} title={t('compliance.consents.title')} />
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <AdminSkeleton key={i} height={16} />
          ))}
        </div>
      ) : !data || data.coverage.length === 0 ? (
        <AdminEmpty title={t('compliance.consents.empty')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, fontSize: 12.5, fontWeight: 500, color: sp.sub, lineHeight: 1.5, fontVariantNumeric: 'tabular-nums' }}>
            {t('compliance.consents.summary', {
              terms: data.users_with_terms,
              privacy: data.users_with_privacy,
              total: data.users_total,
            })}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {data.coverage.map((row) => (
              <div key={`${row.consent_type}-${row.version}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
                <span style={{ color: sp.sub, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t(`compliance.consents.type.${row.consent_type}`)} · {row.version}
                </span>
                <span style={{ fontWeight: 700, color: sp.ink, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{row.accepted}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </AdminCard>
  )
}

/** Carte nLPD : journal des suppressions de comptes (delete-account, art. 32). */
function AccountDeletionsCard() {
  const { t } = useTranslation('admin')
  const { sp } = useAdminSugar()
  const { data, isLoading } = useAccountDeletions()

  return (
    <AdminCard padding="16px 18px">
      <CardHead icon={Trash2} title={t('compliance.deletions.title')} />
      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <AdminSkeleton key={i} height={16} />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <AdminEmpty title={t('compliance.deletions.empty')} />
      ) : (
        <div className="scrollbar-hide" style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 256, overflowY: 'auto' }}>
          {data.map((event) => (
            <div key={event.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, fontSize: 12 }}>
              <span style={{ color: sp.sub, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {event.object_label ?? event.entity_id ?? '—'}
              </span>
              <span style={{ color: sp.soft, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{formatDate(event.created_at)}</span>
            </div>
          ))}
        </div>
      )}
    </AdminCard>
  )
}

/** Barre de progression compacte de complétude d'un dossier (valeur bornée 0–100). */
function CompletionBar({ value }: { value: number }) {
  const { sp, surf } = useAdminSugar()
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 62, height: 6, borderRadius: ADMIN_RADII.pill, background: surf.cardSub, overflow: 'hidden', flexShrink: 0 }}>
        <span
          style={{
            display: 'block', height: '100%', borderRadius: ADMIN_RADII.pill, background: sp.ink,
            width: `${Math.min(100, Math.max(0, value))}%`, transition: 'width .25s ease',
          }}
        />
      </span>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{value}%</span>
    </span>
  )
}

/** Écran compliance : KPIs, table de dossiers filtrable/paginée et cartes nLPD. */
export default function AdminCompliancePage() {
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSugar()
  const { cases, isLoading, isError, refetch, stats, statsLoading } = useAdminCompliance()
  const [tab, setTab] = useState<TabValue>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const TABS: { value: TabValue; label: string }[] = [
    { value: 'risk', label: t('compliance.tab.atRisk') },
    { value: 'pending', label: t('compliance.tab.pending') },
    { value: 'validated', label: t('compliance.tab.validated') },
    { value: 'all', label: t('compliance.tab.all') },
  ]

  const TYPE_LABEL: Record<string, string> = {
    buyer_pp: 'PP',
    buyer_pm: 'PM',
    seller_pp: 'PP',
    seller_pm: 'PM',
  }

  const RISK_LABEL: Record<string, string> = {
    low: t('common.risk.low'),
    medium: t('common.risk.medium'),
    high: t('common.risk.high'),
    unassessed: t('common.risk.unassessed'),
  }

  const STATUS_LABEL: Record<string, string> = {
    pending: t('common.status.pending'),
    in_progress: t('common.status.inProgress'),
    review: t('common.status.review'),
    validated: t('common.status.validated'),
    rejected: t('common.status.rejected'),
  }

  const filtered = useMemo(() => {
    const typeFull: Record<string, string> = {
      buyer_pp: t('compliance.type.buyerPP'),
      buyer_pm: t('compliance.type.buyerPM'),
      seller_pp: t('compliance.type.sellerPP'),
      seller_pm: t('compliance.type.sellerPM'),
    }
    let list = filterCases(cases, tab)
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        c =>
          c.contact_name.toLowerCase().includes(q) ||
          (c.agency_name ?? '').toLowerCase().includes(q) ||
          (typeFull[c.type] ?? '').toLowerCase().includes(q)
      )
    }
    return list
  }, [cases, tab, search, t])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  // Survol : Sugar n'a pas de bordure à éclaircir, la ligne se teinte et la carte
  // mobile monte d'un cran d'ombre. Les valeurs suivent le thème, d'où le <style>.
  const hoverCss = `
    .cmpl-row { transition: background-color .16s ease; }
    .cmpl-row:hover { background: ${dark ? 'rgba(255,255,255,0.05)' : 'rgba(15,23,42,0.035)'}; }
    .cmpl-card { transition: box-shadow .18s ease; }
    .cmpl-card:hover { box-shadow: ${surf.shadowHov}; }
  `

  /** Bouton chevron de la pagination (même grammaire que les icônes du kit). */
  const pagerBtn = (off: boolean): CSSProperties => ({
    width: 28, height: 28, borderRadius: ADMIN_RADII.pill, border: 0, padding: 0,
    background: 'transparent', display: 'grid', placeItems: 'center',
    cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.4 : 1,
  })

  return (
    <AdminPage
      title={t('compliance.title')}
      subtitle={isLoading ? t('common.loading') : t('compliance.subtitle', { count: cases.length })}
      width="wide"
      actions={
        <AdminGhostBtn
          icon={Download}
          onClick={() => exportToCsv('megga-compliance', cases.map(c => ({
            contact: c.contact_name, agence: c.agency_name ?? '', type: c.type,
            risque: c.risk_level, completion: c.completion_pct, statut: c.status, date: c.created_at,
          })))}
        >
          {t('common.export')}
        </AdminGhostBtn>
      }
    >
      <style>{hoverCss}</style>

      {/* Indicateurs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        <AdminStat
          label={t('compliance.kpi.total')}
          value={statsLoading ? '...' : (stats?.total ?? 0)}
          icon={FileCheck}
        />
        <AdminStat
          label={t('compliance.kpi.pending')}
          value={statsLoading ? '...' : (stats?.pending ?? 0)}
          icon={Clock}
        />
        <AdminStat
          label={t('compliance.kpi.pepAlerts')}
          value={statsLoading ? '...' : (stats?.pepMatches ?? 0)}
          icon={AlertTriangle}
          tone={stats && stats.pepMatches > 0 ? 'err' : undefined}
        />
        <AdminStat
          label={t('compliance.kpi.completionRate')}
          value={statsLoading ? '...' : `${stats?.avgCompletion ?? 0}%`}
          icon={ShieldCheck}
        />
      </div>

      {/* Onglets + recherche */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
        {TABS.map((tb) => {
          const on = tab === tb.value
          return (
            <button
              key={tb.value}
              onClick={() => { setTab(tb.value); setPage(1) }}
              style={{
                height: 34, padding: '0 15px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, whiteSpace: 'nowrap',
                background: on ? sp.accent : surf.card, color: on ? sp.accentInk : sp.soft,
                boxShadow: on ? 'none' : sp.shadowSm,
              }}
            >
              {tb.label}
            </button>
          )
        })}

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flex: '1 1 190px', minWidth: 170, maxWidth: 290, marginLeft: 'auto' }}>
          <span style={{ position: 'absolute', left: 13, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <AdminIc icon={Search} size={15} color={sp.sub} />
          </span>
          <input
            type="text"
            placeholder={t('compliance.searchPlaceholder')}
            aria-label={t('compliance.searchPlaceholder')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            style={{
              width: '100%', height: 34, borderRadius: ADMIN_RADII.pill, border: 0, outline: 'none',
              padding: '0 14px 0 35px', background: surf.card, color: sp.ink, boxShadow: sp.shadowSm,
              fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600,
            }}
          />
        </div>
      </div>

      {/* Mobile : cartes */}
      <div className="md:hidden flex flex-col gap-2">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => <AdminSkeleton key={i} height={70} radius={ADMIN_RADII.card} />)
        ) : isError && paginated.length === 0 ? (
          // Avant l'état vide : une requête en échec laisse `paginated` vide, et
          // l'`EmptyState` accuserait alors l'onglet de n'avoir aucun dossier.
          // La liste est rendue deux fois (cartes mobiles / table desktop), la
          // branche vit donc dans les deux.
          <AdminCard>
            <AdminError
              message={t('common.loadError')}
              onRetry={() => void refetch()}
              retryLabel={t('common.retry')}
            />
          </AdminCard>
        ) : paginated.length === 0 ? (
          <AdminCard><EmptyState tab={tab} /></AdminCard>
        ) : (
          paginated.map((c) => (
            <Link key={c.id} to={`/dashboard/kyc/${c.id}`} style={{ textDecoration: 'none', display: 'block' }}>
              <AdminCard className="cmpl-card" padding="13px 15px">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.contact_name}
                      </span>
                      <AdminPill label={TYPE_LABEL[c.type] ?? c.type} style={{ padding: '3px 9px', fontSize: 11 }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 7 }}>
                      <AdminPill label={RISK_LABEL[c.risk_level] ?? c.risk_level} tone={riskTone(c.risk_level)} style={{ padding: '3px 10px', fontSize: 11 }} />
                      {c.screening_status === 'match' && <AdminIc icon={AlertTriangle} size={14} color={tones.err} />}
                      {c.screening_status === 'clear' && <AdminIc icon={ShieldCheck} size={14} color={tones.ok} />}
                    </div>
                  </div>
                  <CompletionBar value={c.completion_pct} />
                </div>
              </AdminCard>
            </Link>
          ))
        )}
      </div>

      {/* Desktop : table */}
      <AdminCard className="hidden md:block" padding={0} style={{ overflow: 'hidden' }}>
        {/* En-tête de colonnes */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '9px 16px',
            background: sp.tableHeadBg, borderBottom: surf.hairline,
            fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: sp.sub,
          }}
        >
          <span style={{ flex: 1, minWidth: 0 }}>{t('compliance.table.contact')}</span>
          <span style={{ width: COL.agency }}>{t('compliance.table.agency')}</span>
          <span style={{ width: COL.type }}>{t('compliance.table.type')}</span>
          <span style={{ width: COL.risk }}>{t('compliance.table.risk')}</span>
          <span style={{ width: COL.pep, textAlign: 'center' }}>{t('compliance.table.pep')}</span>
          <span style={{ width: COL.completion }}>{t('compliance.table.completion')}</span>
          <span style={{ width: COL.status, textAlign: 'center' }}>{t('compliance.table.status')}</span>
          <span style={{ width: COL.date }}>{t('compliance.table.date')}</span>
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
          <EmptyState tab={tab} />
        ) : (
          paginated.map((c, i) => (
            <Link
              key={c.id}
              to={`/dashboard/kyc/${c.id}`}
              className="cmpl-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px',
                textDecoration: 'none', borderTop: i === 0 ? undefined : surf.hairline,
              }}
            >
              {/* Contact */}
              <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, letterSpacing: -0.2, color: sp.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.contact_name}
              </span>

              {/* Agence */}
              <span style={{ width: COL.agency, fontSize: 12, color: sp.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.agency_name ?? <span style={{ color: sp.soft }}>&mdash;</span>}
              </span>

              {/* Type */}
              <span style={{ width: COL.type }}>
                <AdminPill label={TYPE_LABEL[c.type] ?? c.type} style={{ padding: '3px 9px', fontSize: 11 }} />
              </span>

              {/* Risque */}
              <span style={{ width: COL.risk }}>
                <AdminPill label={RISK_LABEL[c.risk_level] ?? c.risk_level} tone={riskTone(c.risk_level)} style={{ padding: '3px 10px', fontSize: 11 }} />
              </span>

              {/* Screening PEP */}
              <span style={{ width: COL.pep, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.screening_status === 'match' ? (
                  <AdminIc icon={AlertTriangle} size={15} color={tones.err} />
                ) : c.screening_status === 'clear' ? (
                  <AdminIc icon={ShieldCheck} size={15} color={tones.ok} />
                ) : (
                  <span style={{ fontSize: 12, color: sp.soft }}>&mdash;</span>
                )}
              </span>

              {/* Complétude */}
              <span style={{ width: COL.completion }}>
                <CompletionBar value={c.completion_pct} />
              </span>

              {/* Statut */}
              <span style={{ width: COL.status, display: 'flex', justifyContent: 'center' }}>
                <AdminPill label={STATUS_LABEL[c.status] ?? c.status} tone={statusTone(c.status)} style={{ padding: '3px 10px', fontSize: 11 }} />
              </span>

              {/* Date */}
              <span style={{ width: COL.date, fontSize: 12, color: sp.soft, fontVariantNumeric: 'tabular-nums' }}>
                {formatDate(c.created_at)}
              </span>
            </Link>
          ))
        )}

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 16px', borderTop: surf.hairline }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {(safePage - 1) * ITEMS_PER_PAGE + 1}&ndash;{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} {t('common.on')} {filtered.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button
                onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)) }}
                disabled={safePage <= 1}
                aria-label={t('common.previousPage')}
                style={pagerBtn(safePage <= 1)}
              >
                <AdminIc icon={ChevronLeft} size={15} color={sp.sub} />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => Math.abs(p - safePage) <= 2 || p === 1 || p === totalPages)
                .map((p, idx, arr) => {
                  const prev = arr[idx - 1]
                  const showEllipsis = prev !== undefined && p - prev > 1
                  return (
                    <span key={p} style={{ display: 'inline-flex', alignItems: 'center' }}>
                      {showEllipsis && <span style={{ padding: '0 4px', fontSize: 11.5, color: sp.soft }}>...</span>}
                      <button
                        onClick={(e) => { e.preventDefault(); setPage(p) }}
                        style={{
                          height: 28, minWidth: 28, padding: '0 8px', borderRadius: ADMIN_RADII.pill, border: 0,
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                          fontVariantNumeric: 'tabular-nums',
                          background: p === safePage ? sp.accent : 'transparent',
                          color: p === safePage ? sp.accentInk : sp.sub,
                        }}
                      >
                        {p}
                      </button>
                    </span>
                  )
                })}
              <button
                onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)) }}
                disabled={safePage >= totalPages}
                aria-label={t('common.nextPage')}
                style={pagerBtn(safePage >= totalPages)}
              >
                <AdminIc icon={ChevronRight} size={15} color={sp.sub} />
              </button>
            </div>
          </div>
        )}
      </AdminCard>

      {/* Pagination mobile */}
      {!isLoading && filtered.length > ITEMS_PER_PAGE && (
        <div className="md:hidden flex items-center justify-between" style={{ padding: '0 2px' }}>
          <AdminGhostBtn
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            style={{ height: 44 }}
          >
            {t('common.previous')}
          </AdminGhostBtn>
          <span style={{ fontSize: 12, fontWeight: 600, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
            {safePage}/{totalPages}
          </span>
          <AdminGhostBtn
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            style={{ height: 44 }}
          >
            {t('common.next')}
          </AdminGhostBtn>
        </div>
      )}

      {/* Consentements nLPD + suppressions de comptes (P2 admin) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12 }}>
        <ConsentStatsCard />
        <AccountDeletionsCard />
      </div>
    </AdminPage>
  )
}
