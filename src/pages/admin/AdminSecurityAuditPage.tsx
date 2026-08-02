/**
 * Page super-admin — journal d'audit de sécurité.
 *
 * Route : `/dashboard/admin/security`. Liste les actions sensibles
 * d'`activity_events` (filtres sévérité/action/acteur, recherche, pagination,
 * métadonnées dépliables) avec un bandeau KPI sur 7 jours. UN seul export : le
 * PDF juridique de la chaîne d'audit PLATEFORME complète (hash-chain nLPD/LBA —
 * volontairement non filtré). L'export CSV de la vue filtrée a été retiré :
 * « aucun export CSV, nulle part dans la console » (décision du 31 juillet 2026).
 *
 * Présentation en grammaire Sugar (kit `adminKit`) : journal dans un bento séparé
 * par l'ombre, sévérités en pilules pleines, accent NOIR sur les contrôles actifs.
 * Le repère violet « Admin MEGGA » vit désormais une seule fois dans le rail du
 * shell — la page n'a plus qu'un titre.
 */
import { useState, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, AlertTriangle, AlertCircle, Info, FileDown, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { downloadAuditPdf } from '@/lib/auditPdfExport'
import { useToast } from '@/components/ui/Toast'
import {
  useSecurityAudit,
  AUDIT_ACTION_LABELS,
  AUDIT_SEVERITY,
  SENSITIVE_ACTIONS,

} from '@/hooks/useSecurityAudit'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useClientPagination } from '@/hooks/useClientPagination'
import SecurityRegistryView from '@/components/admin/SecurityRegistryView'
import AdminPage from '@/components/admin/kit/AdminPage'
import { AdminCard, AdminEmpty, AdminError, AdminGhostBtn, AdminIc, AdminPager, AdminPill, AdminSearchInput, AdminSkeleton, AdminStat } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'

// Labels are resolved at render time via t() — see component body
const SEVERITY_PILL_VALUES: SeverityFilter[] = ['all', 'critical', 'warning', 'info']

/** Largeurs des colonnes du journal — partagées par l'en-tête et les lignes. */
const COL = { time: 132, severity: 108, action: 168, actor: 172, entity: 92 } as const

const TRUNCATE: CSSProperties = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }

// ─── HELPERS ────────────────────────────────────────────────────────────────

/** Ton de pilule Sugar selon la sévérité (fond plein, jamais un texte coloré). */
function severityTone(severity: 'critical' | 'warning' | 'info'): AdminToneName {
  switch (severity) {
    case 'critical': return 'err'
    case 'warning': return 'warn'
    case 'info': return 'info'
  }
}

// severityLabel is now resolved via t() inside the component

/** Formate un timestamp ISO en `dd.MM.yyyy HH:mm` (locale FR) ; renvoie la chaîne brute si invalide. */
function formatTimestamp(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return format(d, 'dd.MM.yyyy HH:mm', { locale: fr })
  } catch {
    return dateStr
  }
}

/** Condense un objet metadata en une ligne `clé: valeur`, tronquée à 80 caractères. */
function summarizeMetadata(metadata: Record<string, unknown>): string {
  if (!metadata || Object.keys(metadata).length === 0) return '-'
  const parts: string[] = []
  for (const [key, val] of Object.entries(metadata)) {
    if (val === null || val === undefined) continue
    const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val)
    parts.push(`${key}: ${strVal}`)
  }
  const summary = parts.join(', ')
  return summary.length > 80 ? summary.slice(0, 77) + '...' : summary
}

/** Sévérité d'une action d'audit via la table `AUDIT_SEVERITY` (défaut `info`). */
function getActionSeverity(action: string): 'critical' | 'warning' | 'info' {
  return AUDIT_SEVERITY[action] ?? 'info'
}

/** Vrai si la date tombe dans les `days` derniers jours (fenêtre des KPI). */
function isWithinDays(dateStr: string, days: number): boolean {
  const d = new Date(dateStr)
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  return d >= cutoff
}

// ─── SKELETON ───────────────────────────────────────────────────────────────

/** Lignes squelette affichées pendant le chargement du journal. */
function SkeletonRows() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px' }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <AdminSkeleton key={i} height={36} />
      ))}
    </div>
  )
}

// ─── MAIN COMPONENT ─────────────────────────────────────────────────────────

/** Page : KPI 7 jours + filtres + table paginée du journal d'audit de sécurité. */
export default function AdminSecurityAuditPage() {
  const { t } = useTranslation('admin')
  const { data: entries, isLoading, isError, refetch } = useSecurityAudit({ limit: 500 })
  const { sp, surf, dark } = useAdminSugar()
  const toast = useToast()
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [pdfExporting, setPdfExporting] = useState(false)
  // Deux journaux, deux questions. `registry` = admin_log (ce que MEGGA fait SUR une
  // agence, avec chaîne d'empreintes) ; `agencies` = activity_events (ce qui se passe CHEZ
  // les agences). Le registre est la vue par défaut : c'est celle que la console doit
  // rendre démontrable (critère 2 du gate G2), et la seule dont les lignes sont scellées.
  const [view, setView] = useState<'registry' | 'agencies'>('registry')

  // ── Derived data ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!entries) return []
    return entries.filter(e => {
      // Severity filter
      if (severityFilter !== 'all' && getActionSeverity(e.action) !== severityFilter) return false
      // Action filter
      if (actionFilter !== 'all' && e.action !== actionFilter) return false
      // Search by actor name/email
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        const nameMatch = e.actor_name?.toLowerCase().includes(q)
        const emailMatch = e.actor_email?.toLowerCase().includes(q)
        if (!nameMatch && !emailMatch) return false
      }
      return true
    })
  }, [entries, severityFilter, actionFilter, searchQuery])

  // ── Stats (last 7 days) ───────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!entries) return { critical: 0, warning: 0, total: 0 }
    const recent = entries.filter(e => isWithinDays(e.created_at, 7))
    return {
      critical: recent.filter(e => getActionSeverity(e.action) === 'critical').length,
      warning: recent.filter(e => getActionSeverity(e.action) === 'warning').length,
      total: recent.length,
    }
  }, [entries])

  // ── Pagination ────────────────────────────────────────────────────────
  const { page, setPage, totalPages, paginated, perPage, total } = useClientPagination(filtered, ITEMS_PER_PAGE)

  // Reset page when filters change
  const handleSeverityChange = (val: SeverityFilter) => {
    setSeverityFilter(val)
    setPage(1)
  }
  const handleActionChange = (val: string) => {
    setActionFilter(val)
    setPage(1)
  }
  const handleSearchChange = (val: string) => {
    setSearchQuery(val)
    setPage(1)
  }

  // ── Export PDF plateforme (hash-chain, nLPD/LBA) ──────────────────────
  // Piste d'audit PLATEFORME complète (branche super-admin d'audit-pdf-export),
  // volontairement sans les filtres d'affichage : la preuve juridique porte sur
  // la chaîne entière, pas sur une vue filtrée par action côté client.
  async function handlePdfExport() {
    setPdfExporting(true)
    try {
      await downloadAuditPdf({})
    } catch {
      toast.error(t('admin:securityAudit.pdfExportError'))
    } finally {
      setPdfExporting(false)
    }
  }

  // Filet de séparation des lignes — même valeur que `AdminTd`, pour que le
  // journal et les tableaux de la console se lisent d'un seul rythme.
  const rowHair = dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <AdminPage
      title={t('admin:securityAudit.title')}
      subtitle={t('admin:securityAudit.subtitle')}
      width="wide"
      actions={
        <>
          <AdminGhostBtn onClick={() => void handlePdfExport()} disabled={pdfExporting} icon={FileDown}>
            {pdfExporting ? t('admin:securityAudit.pdfExporting') : t('admin:securityAudit.exportPdf')}
          </AdminGhostBtn>
        </>
      }
    >
      {/* Pas de règle de survol de ligne ici : les lignes du journal portent
          `.adm-row` (admin-console.css), dont le `:hover` est en `!important`.
          Une règle d'auteur normale ne pouvait pas gagner contre le
          `background` INLINE de repos de la ligne — elle ne s'appliquait jamais. */}
      <style>{`
        .sec-kpi { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 760px) { .sec-kpi { grid-template-columns: 1fr; } }
      `}</style>

      {/* Bascule des deux journaux — même grammaire de segment que les filtres. */}
      <div style={{
        display: 'inline-flex', gap: 3, padding: 3, borderRadius: ADMIN_RADII.pill,
        background: surf.cardSub, border: surf.hairline, alignSelf: 'flex-start',
      }}>
        {(['registry', 'agencies'] as const).map(v => {
          const on = view === v
          return (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                height: 30, padding: '0 14px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap',
                background: on ? sp.accent : 'transparent', color: on ? sp.accentInk : sp.sub,
                transition: 'background .15s ease, color .15s ease',
              }}
            >
              {t(`admin:securityAudit.view.${v}`)}
            </button>
          )
        })}
      </div>

      {view === 'registry' ? <SecurityRegistryView /> : (
      <>
      {/* Bandeau KPI (7 jours) */}
      <div className="sec-kpi">
        <AdminStat
          label={t('admin:securityAudit.kpi.criticalEvents')}
          value={isLoading ? '...' : stats.critical}
          hint={t('admin:common.last7Days')}
          icon={AlertTriangle}
          tone={stats.critical > 0 ? 'err' : undefined}
        />
        <AdminStat
          label={t('admin:securityAudit.kpi.warnings')}
          value={isLoading ? '...' : stats.warning}
          hint={t('admin:common.last7Days')}
          icon={AlertCircle}
        />
        <AdminStat
          label={t('admin:securityAudit.kpi.totalEvents')}
          value={isLoading ? '...' : stats.total}
          hint={t('admin:common.last7Days')}
          icon={Info}
        />
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {/* Sévérité — segment Sugar, accent noir sur l'option active */}
        <div style={{
          display: 'inline-flex', gap: 3, padding: 3, borderRadius: ADMIN_RADII.pill,
          background: surf.cardSub, border: surf.hairline,
        }}>
          {SEVERITY_PILL_VALUES.map(val => {
            const on = severityFilter === val
            return (
              <button
                key={val}
                onClick={() => handleSeverityChange(val)}
                style={{
                  height: 30, padding: '0 14px', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 12.5, fontWeight: on ? 700 : 600, whiteSpace: 'nowrap',
                  background: on ? sp.accent : 'transparent', color: on ? sp.accentInk : sp.sub,
                  transition: 'background .15s ease, color .15s ease',
                }}
              >
                {val === 'all' ? t('admin:common.all') : t(`admin:common.severity.${val}`)}
              </button>
            )
          })}
        </div>

        {/* Action dropdown */}
        <div style={{ position: 'relative' }}>
          <select
            value={actionFilter}
            onChange={e => handleActionChange(e.target.value)}
            style={{
              height: 34, padding: '0 34px 0 15px', borderRadius: ADMIN_RADII.pill, border: 0, outline: 'none',
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
              color: sp.ink, background: surf.card, boxShadow: sp.shadowSm,
            }}
          >
            <option value="all">{t('admin:securityAudit.allActions')}</option>
            {SENSITIVE_ACTIONS.map(action => (
              <option key={action} value={action}>
                {AUDIT_ACTION_LABELS[action] ?? action}
              </option>
            ))}
          </select>
          <span style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', display: 'grid', pointerEvents: 'none' }}>
            <AdminIc icon={ChevronDown} size={14} color={sp.sub} />
          </span>
        </div>

        {/* Recherche */}
        <AdminSearchInput
          value={searchQuery}
          onChange={handleSearchChange}
          placeholder={t('admin:securityAudit.searchPlaceholder')}
          label={t('admin:securityAudit.searchPlaceholder')}
        />
      </div>

      {/* Journal d'audit */}
      <AdminCard padding={0} style={{ overflow: 'hidden' }}>
        {/* En-tête de colonnes — casse normale, fond de tête de table Sugar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
          background: sp.tableHeadBg, fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: sp.sub,
        }}>
          <div style={{ width: COL.time, flexShrink: 0 }}>{t('admin:securityAudit.table.timestamp')}</div>
          <div style={{ width: COL.severity, flexShrink: 0 }}>{t('admin:securityAudit.table.severity')}</div>
          <div style={{ width: COL.action, flexShrink: 0 }}>{t('admin:securityAudit.table.action')}</div>
          <div style={{ width: COL.actor, flexShrink: 0 }}>{t('admin:securityAudit.table.actor')}</div>
          <div style={{ flex: 1, minWidth: 0 }}>{t('admin:securityAudit.table.details')}</div>
          <div style={{ width: COL.entity, flexShrink: 0, textAlign: 'right' }}>{t('admin:securityAudit.table.entity')}</div>
        </div>

        {/* Corps */}
        {isLoading ? (
          <SkeletonRows />
        ) : isError && paginated.length === 0 ? (
          <AdminError
            message={t('admin:common.loadError')}
            onRetry={() => void refetch()}
            retryLabel={t('admin:common.retry')}
          />
        ) : paginated.length === 0 ? (
          <AdminEmpty
            icon={Shield}
            title={t('admin:securityAudit.empty.title')}
            hint={t('admin:securityAudit.empty.subtitle')}
          />
        ) : (
          paginated.map(entry => {
            const severity = getActionSeverity(entry.action)
            const isExpanded = expandedRow === entry.id
            return (
              <div key={entry.id} style={{ borderTop: `1px solid ${rowHair}` }}>
                <button
                  className="adm-row"
                  onClick={() => setExpandedRow(isExpanded ? null : entry.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
                    border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  }}
                >
                  {/* Timestamp */}
                  <div style={{ width: COL.time, flexShrink: 0, fontSize: 11.5, color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                    {formatTimestamp(entry.created_at)}
                  </div>

                  {/* Severity */}
                  <div style={{ width: COL.severity, flexShrink: 0 }}>
                    <AdminPill label={t(`admin:common.severity.${severity}`)} tone={severityTone(severity)} />
                  </div>

                  {/* Action */}
                  <div style={{ width: COL.action, flexShrink: 0, fontSize: 12.5, fontWeight: 600, color: sp.ink, ...TRUNCATE }}>
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </div>

                  {/* Actor */}
                  <div style={{ width: COL.actor, flexShrink: 0, minWidth: 0 }}>
                    {entry.actor_name ? (
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: sp.ink, lineHeight: 1.3, ...TRUNCATE }}>{entry.actor_name}</p>
                        <p style={{ margin: 0, fontSize: 11, color: sp.sub, lineHeight: 1.3, ...TRUNCATE }}>{entry.actor_email}</p>
                      </div>
                    ) : entry.actor_id === 'ai' ? (
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: sp.sub }}>{t('admin:securityAudit.megaAi')}</span>
                    ) : (
                      <span style={{ fontSize: 12, color: sp.sub }}>-</span>
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: sp.sub, ...TRUNCATE }}>
                    {summarizeMetadata(entry.metadata)}
                  </div>

                  {/* Entity */}
                  <div style={{ width: COL.entity, flexShrink: 0, textAlign: 'right', fontSize: 11.5, color: sp.sub }}>
                    {entry.entity_type}
                  </div>
                </button>

                {/* Expanded metadata */}
                {isExpanded && (
                  <div style={{ padding: '12px 14px', background: surf.cardSub }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: sp.ink }}>{t('admin:securityAudit.metadataFull')}</span>
                      <span style={{ fontSize: 11, color: sp.sub }}>ID: {entry.entity_id}</span>
                    </div>
                    <pre
                      className="scrollbar-hide"
                      style={{
                        margin: 0, padding: 12, borderRadius: ADMIN_RADII.row, background: sp.pageBg,
                        color: sp.sub, fontSize: 11.5, lineHeight: 1.5,
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        overflowX: 'auto', maxHeight: 192,
                      }}
                    >
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )
          })
        )}

        {/* Pagination — rejoint le bento du journal : le filet supérieur du kit
            la sépare de la dernière ligne au lieu de flotter sous la carte. */}
        <AdminPager page={page} totalPages={totalPages} total={total} perPage={perPage} onPage={setPage} />
      </AdminCard>
      </>
      )}
    </AdminPage>
  )
}
