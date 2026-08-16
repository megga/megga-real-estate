/**
 * Page super-admin — journal d'audit de sécurité.
 *
 * Route : `/dashboard/admin/security`. Liste les actions sensibles
 * d'`activity_events` (filtres sévérité/action/acteur, recherche, pagination,
 * métadonnées dépliables) avec un bandeau KPI sur 7 jours.
 *
 * ⚠ AUCUN EXPORT DEPUIS CETTE PAGE. Le CSV de la vue filtrée était parti le
 * 31 juillet 2026 (« aucun export CSV, nulle part dans la console ») ; le PDF de
 * la chaîne d'audit PLATEFORME est parti le 14 août 2026, sur décision de
 * Julien. `downloadAuditPdf` et l'edge `audit-pdf-export` restent VIVANTS —
 * l'export par agence de la fiche d'audit agent (`AuditPage`) les appelle
 * toujours. Ce qui a disparu est la piste PLATEFORME complète, pas le mécanisme.
 *
 * Présentation en grammaire MEGGA X (kit `adminKit`) : journal dans un bento
 * séparé par la bordure, sévérités en pilules pleines dont l'encre est dérivée
 * de l'aplat. Le repère violet « Admin MEGGA » vit une seule fois, dans le rail
 * du shell — la page n'a qu'un titre.
 */
import { useState, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { Shield, AlertTriangle, AlertCircle, Info, ChevronDown } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
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
import { AdminCard, AdminEmpty, AdminError, AdminIc, AdminPager, AdminPill, AdminSearchInput, AdminSkeleton, AdminStat } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII, type AdminToneName } from '@/components/admin/kit/adminKitCore'

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 20

type SeverityFilter = 'all' | 'critical' | 'warning' | 'info'

// Labels are resolved at render time via t() — see component body
const SEVERITY_PILL_VALUES: SeverityFilter[] = ['all', 'critical', 'warning', 'info']

/** Largeurs des colonnes du journal — partagées par l'en-tête et les lignes. */
const COL = { time: 132, severity: 108, action: 168, actor: 172, entity: 92 } as const

/**
 * Largeur sous laquelle le journal défile plutôt que de s'écraser.
 *
 * Somme des cinq colonnes FIXES (672) + les cinq gouttières de 12 (60) + les
 * marges latérales de 14 (28) = 760, plus 180 px de plancher pour « Détails ».
 * En dessous, cette colonne — la seule élastique — tombait à zéro sans rien
 * signaler ; c'est ce qui la rend de nouveau atteignable.
 */
const JOURNAL_MIN_WIDTH = 940

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
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [actionFilter, setActionFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
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

  // Filet de séparation des lignes — même valeur que `AdminTd`, pour que le
  // journal et les tableaux de la console se lisent d'un seul rythme.
  const rowHair = dark ? 'rgba(255,255,255,0.06)' : 'rgba(3, 3, 3, 0.05)'

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <AdminPage
      title={t('admin:securityAudit.title')}
      subtitle={t('admin:securityAudit.subtitle')}
      width="wide"
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
                fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
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
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
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
              appearance: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600,
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
        {/* ⛔ LE JOURNAL DÉFILE À L'HORIZONTALE SOUS SA LARGEUR UTILE, et ce
            n'est pas un confort : cinq de ses six colonnes ont une largeur FIXE
            (`COL`, 672 px) et ne cèdent rien (`flexShrink: 0`). Seule
            « Détails » est élastique, avec `minWidth: 0` — elle absorbait donc
            100 % du déficit et tombait à ZÉRO. Mesuré : sous ~1310 px de
            fenêtre, une colonne sur six devenait invisible, sans le moindre
            indice qu'il manquait quelque chose.

            Le défilement plutôt qu'un reserrage des largeurs : la colonne reste
            ATTEIGNABLE et aucune des cinq autres ne change de gabarit, donc le
            journal se lit au même rythme que les tableaux du kit.

            ⚠ L'enveloppe porte le `minWidth` UNE fois, et non chaque ligne :
            les lignes sont des blocs, elles prennent la largeur de leur parent.
            Le poser sur chaque ligne aurait demandé de le répéter à trois
            endroits — l'en-tête, la ligne, et le bloc de métadonnées déplié —
            avec trois occasions de le laisser diverger. */}
        <div className="adm-scroll" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: JOURNAL_MIN_WIDTH }}>
        {/* En-tête de colonnes — casse normale, fond de tête de table Sugar */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '9px 14px',
          background: sp.tableHeadBg, fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.1, color: sp.sub,
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
                  <div style={{ width: COL.time, flexShrink: 0, fontSize: 'var(--crm-text-xs)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
                    {formatTimestamp(entry.created_at)}
                  </div>

                  {/* Severity */}
                  <div style={{ width: COL.severity, flexShrink: 0 }}>
                    <AdminPill label={t(`admin:common.severity.${severity}`)} tone={severityTone(severity)} />
                  </div>

                  {/* Action */}
                  <div style={{ width: COL.action, flexShrink: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink, ...TRUNCATE }}>
                    {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                  </div>

                  {/* Actor */}
                  <div style={{ width: COL.actor, flexShrink: 0, minWidth: 0 }}>
                    {entry.actor_name ? (
                      <div style={{ minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.ink, lineHeight: 1.3, ...TRUNCATE }}>{entry.actor_name}</p>
                        <p style={{ margin: 0, fontSize: 'var(--crm-text-xs)', color: sp.sub, lineHeight: 1.3, ...TRUNCATE }}>{entry.actor_email}</p>
                      </div>
                    ) : entry.actor_id === 'ai' ? (
                      <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>{t('admin:securityAudit.megaAi')}</span>
                    ) : (
                      <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>-</span>
                    )}
                  </div>

                  {/* Details */}
                  <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-xs)', color: sp.sub, ...TRUNCATE }}>
                    {summarizeMetadata(entry.metadata)}
                  </div>

                  {/* Entity */}
                  <div style={{ width: COL.entity, flexShrink: 0, textAlign: 'right', fontSize: 'var(--crm-text-xs)', color: sp.sub }}>
                    {entry.entity_type}
                  </div>
                </button>

                {/* Expanded metadata */}
                {isExpanded && (
                  <div style={{ padding: '12px 14px', background: surf.cardSub }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: sp.ink }}>{t('admin:securityAudit.metadataFull')}</span>
                      <span style={{ fontSize: 'var(--crm-text-xs)', color: sp.sub }}>ID: {entry.entity_id}</span>
                    </div>
                    <pre
                      className="scrollbar-hide"
                      style={{
                        margin: 0, padding: 12, borderRadius: ADMIN_RADII.row, background: sp.pageBg,
                        color: sp.sub, fontSize: 'var(--crm-text-xs)', lineHeight: 1.5,
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

        </div>
        </div>

        {/* Pagination — rejoint le bento du journal : le filet supérieur du kit
            la sépare de la dernière ligne au lieu de flotter sous la carte.
            ⚠ HORS de l'enveloppe défilante : elle n'a pas de colonnes, et la
            faire glisser avec le journal l'aurait rendue introuvable dès qu'on
            fait défiler vers la droite. */}
        <AdminPager page={page} totalPages={totalPages} total={total} perPage={perPage} onPage={setPage} />
      </AdminCard>
      </>
      )}
    </AdminPage>
  )
}
