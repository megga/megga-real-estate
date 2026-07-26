// P6a — Bloc repliable « Usage par agence » (super-admin) dans AdminAgenciesPage.
// Tableau comparatif (RPC get_admin_usage_overview, tri coût IA décroissant
// côté serveur), % des caps configurés. Chargé à la demande (au dépli).
// Grammaire Sugar : bento séparé par l'ombre, dépassements en tons (warn/err),
// chiffres tabulaires. Les lignes restent des <Link> (deep-link vers l'agence),
// d'où une grille et non un <tbody>.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronDown, BarChart3 } from 'lucide-react'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { AdminCard, AdminEmpty, AdminError, AdminIc, AdminSkeleton } from '@/components/admin/kit/adminKit'
import { useAdminUsageOverview, type UsageOverviewRow } from '@/hooks/useAdminUsageOverview'

/** Colonnes de la grille — mêmes largeurs que l'en-tête et les lignes. */
const COLS = '1.5fr 90px 90px 90px 90px'

/** Cellule « usage / plafond » : le ton signale le seuil d'alerte puis le dépassement. */
function CapCell({ used, cap, threshold }: { used: number; cap: number | null | undefined; threshold: number }) {
  const { sp, tones } = useAdminSugar()
  if (cap == null) return <span style={{ color: sp.soft, fontVariantNumeric: 'tabular-nums' }}>{used}</span>

  const over = cap > 0 && used >= cap
  const breached = cap > 0 && used >= cap * threshold / 100
  return (
    <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: over ? tones.err : breached ? tones.warn : sp.sub }}>
      {used}<span style={{ fontWeight: 500, color: sp.soft }}>/{cap}</span>
    </span>
  )
}

/** Bloc repliable comparant l'usage de toutes les agences (chargé au premier dépli). */
export default function AgencyUsageOverview() {
  const { t } = useTranslation('admin')
  const { sp, dark } = useAdminSugar()
  const [open, setOpen] = useState(false)
  const { data: rows, isLoading, isError } = useAdminUsageOverview(open)

  const headCell = {
    fontSize: 11, fontWeight: 700, letterSpacing: 0.1, color: sp.sub, whiteSpace: 'nowrap',
  } as const

  return (
    <AdminCard padding={0} style={{ overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="adm-nav"
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          padding: '13px 16px', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
          <AdminIc icon={BarChart3} size={16} color={sp.soft} />
          {t('usage.overview.title')}
        </span>
        <AdminIc
          icon={ChevronDown}
          size={16}
          color={sp.soft}
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform .22s ease' }}
        />
      </button>

      {open && (
        <div style={{ borderTop: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'}` }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
              {Array.from({ length: 4 }).map((_, i) => <AdminSkeleton key={i} height={34} />)}
            </div>
          ) : isError ? (
            <AdminError message={t('usage.error')} />
          ) : (rows ?? []).length === 0 ? (
            <AdminEmpty title={t('usage.overview.empty')} />
          ) : (
            <div className="scrollbar-hide" style={{ overflowX: 'auto' }}>
              <div style={{ minWidth: 720 }}>
                <div style={{ display: 'grid', gridTemplateColumns: COLS, gap: 8, padding: '9px 16px', background: sp.tableHeadBg }}>
                  <span style={headCell}>{t('usage.overview.agency')}</span>
                  <span style={{ ...headCell, textAlign: 'right' }}>{t('usage.overview.aiCost')}</span>
                  <span style={{ ...headCell, textAlign: 'right' }}>{t('usage.overview.properties')}</span>
                  <span style={{ ...headCell, textAlign: 'right' }}>{t('usage.overview.whatsapp')}</span>
                  <span style={{ ...headCell, textAlign: 'right' }}>{t('usage.overview.storage')}</span>
                </div>
                {(rows as UsageOverviewRow[]).map((r, i) => {
                  const threshold = r.caps?.alert_threshold_pct ?? 80
                  return (
                    <Link
                      key={r.agency_id}
                      to={`/agencies/${r.agency_id}`}
                      className="adm-nav"
                      style={{
                        display: 'grid', gridTemplateColumns: COLS, gap: 8, alignItems: 'center',
                        padding: '10px 16px', fontSize: 12, textDecoration: 'none', color: sp.ink,
                        borderTop: i > 0 ? `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.05)'}` : undefined,
                      }}
                    >
                      <span style={{ fontWeight: 700, letterSpacing: -0.1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }}>
                        {r.agency_name}
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <CapCell used={Math.round(r.ai_cost_month_usd * 100) / 100} cap={r.caps?.ai_monthly_cost_cap_usd} threshold={threshold} />
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <CapCell used={r.active_properties} cap={r.caps?.active_properties_cap} threshold={threshold} />
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <CapCell used={r.wa_messages_month} cap={r.caps?.whatsapp_monthly_cap} threshold={threshold} />
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <CapCell used={r.storage_est_mb} cap={r.caps?.storage_cap_mb} threshold={threshold} />
                      </span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </AdminCard>
  )
}
