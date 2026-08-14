// MEGGA CRM Sugar v3 — Journal d'audit nLPD
// Port 1:1 de crm-screen-audit-sugar.jsx (CRMScreenAuditSugar lignes 271-483).
//
// Conformité : nLPD art. 12 + LBA art. 7 — append-only, conservation 10 ans.
// Filtres : date (7j/30j/90j/tout), catégorie (8), sévérité (info/warn/critical),
// search plein texte.
// Export : CSV (fonctionnel) + PDF horodaté hash-chain signé (Edge Function audit-pdf-export).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { crmSugarPalette, sgVoileEncre } from '@/components/crm-sugar/tokens'
import {
  SugarV3,
  SUGAR_V3_KEYFRAMES,
  AUDIT_CATEGORIES,
  AUDIT_CAT_ICONS,
} from '@/components/crm-sugar-v3/tokens'
import {
  KycBlackPill,
  KycGhostPill,
  KycStatCard,
} from '@/components/crm-sugar-v3/primitives'
import { SgIcon } from '@/components/crm-sugar-v3/icons'
import { AudDayGroup } from '@/components/crm-sugar-v3/audit/AudDayGroup'
import { useAuditEvents } from '@/hooks/useAuditLog'
import { downloadAuditCsv } from '@/lib/auditCsvExport'
import { downloadAuditPdf } from '@/lib/auditPdfExport'
import type { AuditCategory, AuditSeverity, AuditEvent } from '@/types/kyc'

export default function AuditSugarPage() {
  const navigate = useNavigate()
  const { t: tr } = useTranslation('common')
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('megga.sugar.dark') === '1'
  })
  const sp = useMemo(() => crmSugarPalette(dark), [dark])

  const [filterCat, setFilterCat] = useState<AuditCategory | 'all'>('all')
  const [filterSev, setFilterSev] = useState<AuditSeverity | 'all'>('all')
  const [filterDays, setFilterDays] = useState<number>(30)
  const [query, setQuery] = useState('')
  const [pdfBusy, setPdfBusy] = useState(false)
  const [pdfError, setPdfError] = useState<string | null>(null)

  const { data: events = [], isLoading } = useAuditEvents({
    category: filterCat,
    severity: filterSev,
    days: filterDays,
    search: query.trim() || undefined,
  })

  // Stats sur la sélection filtrée
  const stats = useMemo(() => {
    return {
      total: events.length,
      critical: events.filter((e) => e.severity === 'critical').length,
      warn: events.filter((e) => e.severity === 'warn').length,
      ai: events.filter((e) => !e.actor_id).length,
    }
  }, [events])

  // Groupement par jour
  const groups = useMemo(() => {
    const map: Record<string, AuditEvent[]> = {}
    events.forEach((ev) => {
      const d = new Date(ev.created_at)
      const key = d.toLocaleDateString('fr-CH', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
      if (!map[key]) map[key] = []
      map[key].push(ev)
    })
    return map
  }, [events])
  const groupKeys = useMemo(
    () =>
      Object.keys(groups).sort((a, b) => {
        const da = new Date(groups[a][0].created_at).getTime()
        const db = new Date(groups[b][0].created_at).getTime()
        return db - da
      }),
    [groups],
  )

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'audit': break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }
  const onCmd = () => {}

  return (
    <div
      data-screen-label="CRM Audit nLPD (sugar v3)"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: SugarV3.bgGradient,
        fontFamily: SugarV3.font,
        color: SugarV3.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{SUGAR_V3_KEYFRAMES}</style>

      <SugarTopNav
        active={'audit' as SugarScreenId}
       
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active={'audit' as SugarScreenId}
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main className="sg-main-padded" style={{ flex: 1, minWidth: 0, padding: '100px 40px 120px 40px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            {/* HEADER */}
            <div
              className="sg-row-stack"
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 32,
                alignItems: 'flex-end',
                marginBottom: 36,
                animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 'var(--crm-text-sm)',
                    fontWeight: 600,
                    color: SugarV3.muted,
                                                            marginBottom: 14,
                  }}
                >
                  {tr('audit.eyebrow')}
                </div>
                <h1
                  style={{
                    margin: '0 0 12px',
                    fontSize: 40,
                    fontWeight: 600,
                    color: SugarV3.ink,
                    letterSpacing: -0.8,
                    lineHeight: 1.05,
                  }}
                >
                  {tr('audit.title')}
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 'var(--crm-text-xl)',
                    color: SugarV3.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.55,
                    maxWidth: 620,
                  }}
                >
                  {tr('audit.subtitle')}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <KycGhostPill
                  onClick={() => downloadAuditCsv(events)}
                  icon={<SgIcon name="download" size={14} stroke={SugarV3.inkSoft} />}
                >
                  {tr('audit.export.csv')}
                </KycGhostPill>
                <KycBlackPill
                  size="lg"
                  disabled={pdfBusy}
                  // PDF horodaté hash-chain — Edge Function audit-pdf-export
                  onClick={async () => {
                    setPdfError(null)
                    setPdfBusy(true)
                    try {
                      const cutoff = new Date(
                        Date.now() - filterDays * 24 * 3600 * 1000,
                      ).toISOString()
                      await downloadAuditPdf({
                        from: filterDays < 3650 ? cutoff : undefined,
                        category: filterCat !== 'all' ? filterCat : undefined,
                        severity: filterSev !== 'all' ? filterSev : undefined,
                        search: query.trim() || undefined,
                      })
                    } catch (err) {
                      setPdfError(
                        err instanceof Error
                          ? err.message
                          : tr('audit.export.pdfFailed'),
                      )
                    } finally {
                      setPdfBusy(false)
                    }
                  }}
                  icon={<SgIcon name="download" size={15} stroke="#fff" />}
                >
                  {pdfBusy ? tr('audit.export.generating') : tr('audit.export.pdf')}
                </KycBlackPill>
              </div>
              {pdfError && (
                <div
                  style={{
                    gridColumn: '1 / -1',
                    padding: '10px 14px',
                    borderRadius: 14,
                    background: SugarV3.errSoft,
                    color: SugarV3.errDarker,
                    fontSize: 'var(--crm-text-sm)',
                    fontWeight: 600,
                    marginTop: 12,
                  }}
                >
                  {tr('audit.export.pdfErrorPrefix')} {pdfError}
                </div>
              )}
            </div>

            {/* STATS */}
            <div
              className="sg-grid-4"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: 14,
                marginBottom: 24,
                animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <KycStatCard
                label={tr('audit.stats.events')}
                value={stats.total}
                accent={SugarV3.black}
                sub={filterDays >= 3650 ? tr('audit.stats.eventsRangeAll') : tr('audit.stats.eventsRangeDays', { days: filterDays })}
              />
              <KycStatCard
                label={tr('audit.stats.critical')}
                value={stats.critical}
                accent={SugarV3.err}
                sub={tr('audit.stats.criticalSub')}
              />
              <KycStatCard
                label={tr('audit.stats.warning')}
                value={stats.warn}
                accent={SugarV3.warn}
                sub={tr('audit.stats.warningSub')}
              />
              <KycStatCard
                label={tr('audit.stats.aiActions')}
                value={stats.ai}
                accent="#7A4FD8"
                sub={tr('audit.stats.aiActionsSub')}
              />
            </div>

            {/* BARRE DE FILTRES */}
            <div
              style={{
                background: SugarV3.card,
                borderRadius: 22,
                padding: '18px 22px',
                boxShadow: SugarV3.shadow,
                marginBottom: 18,
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 16,
                alignItems: 'center',
                animation: 'sgFadeUp .6s cubic-bezier(.2,.8,.2,1) both',
              }}
              className="sg-row-stack"
            >
              {/* Recherche */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px',
                  height: 44,
                  background: SugarV3.cardSubtle,
                  borderRadius: 999,
                  maxWidth: 380,
                }}
              >
                <SgIcon name="search" size={16} stroke={SugarV3.muted} />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tr('audit.searchPlaceholder')}
                  style={{
                    flex: 1,
                    border: 0,
                    outline: 'none',
                    background: 'transparent',
                    fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-md)',
                    fontWeight: 500,
                    color: SugarV3.ink,
                  }}
                />
              </div>
              {/* Date range */}
              <div style={{ display: 'flex', gap: 6 }}>
                <KycGhostPill
                  active={filterDays === 7}
                  onClick={() => setFilterDays(7)}
                  size="sm"
                >
                  {tr('audit.period.days7')}
                </KycGhostPill>
                <KycGhostPill
                  active={filterDays === 30}
                  onClick={() => setFilterDays(30)}
                  size="sm"
                >
                  {tr('audit.period.days30')}
                </KycGhostPill>
                <KycGhostPill
                  active={filterDays === 90}
                  onClick={() => setFilterDays(90)}
                  size="sm"
                >
                  {tr('audit.period.days90')}
                </KycGhostPill>
                <KycGhostPill
                  active={filterDays === 3650}
                  onClick={() => setFilterDays(3650)}
                  size="sm"
                >
                  {tr('audit.period.all')}
                </KycGhostPill>
              </div>
            </div>

            {/* FILTRES CATÉGORIES + SÉVÉRITÉ */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 18,
                flexWrap: 'wrap',
                animation: 'sgFadeUp .65s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <KycGhostPill
                active={filterCat === 'all'}
                onClick={() => setFilterCat('all')}
                size="sm"
              >
                {tr('audit.filter.allCategories')}
              </KycGhostPill>
              {Object.entries(AUDIT_CATEGORIES).map(([key, c]) => (
                <KycGhostPill
                  key={key}
                  active={filterCat === key}
                  onClick={() => setFilterCat(key as AuditCategory)}
                  size="sm"
                  icon={
                    <SgIcon
                      name={AUDIT_CAT_ICONS[key] || 'file'}
                      size={13}
                      stroke={filterCat === key ? '#fff' : c.tone}
                    />
                  }
                >
                  {c.label}
                </KycGhostPill>
              ))}
              <div
                style={{
                  width: 1,
                  height: 22,
                  background: `${sgVoileEncre(false, 0.08)}`,
                  margin: '0 6px',
                }}
              />
              <KycGhostPill
                active={filterSev === 'all'}
                onClick={() => setFilterSev('all')}
                size="sm"
              >
                {tr('audit.filter.allSeverities')}
              </KycGhostPill>
              <KycGhostPill
                active={filterSev === 'critical'}
                onClick={() => setFilterSev('critical')}
                size="sm"
                icon={
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: SugarV3.err,
                    }}
                  />
                }
              >
                {tr('audit.severity.critical')}
              </KycGhostPill>
              <KycGhostPill
                active={filterSev === 'warn'}
                onClick={() => setFilterSev('warn')}
                size="sm"
                icon={
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: 999,
                      background: SugarV3.warn,
                    }}
                  />
                }
              >
                {tr('audit.severity.warning')}
              </KycGhostPill>
            </div>

            {/* LISTE GROUPÉE */}
            <div
              style={{
                background: SugarV3.card,
                borderRadius: 22,
                overflow: 'hidden',
                boxShadow: SugarV3.shadow,
                animation: 'sgFadeUp .7s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              {isLoading ? (
                <div
                  style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    color: SugarV3.muted,
                    fontSize: 'var(--crm-text-lg)',
                    fontWeight: 500,
                  }}
                >
                  {tr('audit.loading')}
                </div>
              ) : events.length === 0 ? (
                <div
                  style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    color: SugarV3.muted,
                    fontSize: 'var(--crm-text-lg)',
                    fontWeight: 500,
                  }}
                >
                  {tr('audit.empty')}
                </div>
              ) : (
                groupKeys.map((key) => (
                  <AudDayGroup
                    key={key}
                    dateLabel={key.charAt(0).toUpperCase() + key.slice(1)}
                    events={groups[key]}
                  />
                ))
              )}
            </div>

            {/* Footer note */}
            <div
              style={{
                marginTop: 24,
                padding: '20px 28px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                color: SugarV3.muted,
                fontSize: 'var(--crm-text-sm)',
                fontWeight: 500,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: SugarV3.card,
                  boxShadow: SugarV3.shadowSm,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <SgIcon name="lock" size={14} stroke={SugarV3.inkSoft} />
              </div>
              <div>
                {tr('audit.footer.retention')}
                <br />
                {tr('audit.footer.tamperLogged')}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
