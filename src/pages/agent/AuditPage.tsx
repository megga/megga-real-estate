// MEGGA CRM — Journal d'audit nLPD
// Port 1:1 de crm-screen-audit-sugar.jsx (CRMScreenAuditSugar lignes 271-483).
//
// Conformité : nLPD art. 12 + LBA art. 7 — append-only, conservation 10 ans.
// Filtres : date (7j/30j/90j/tout), catégorie (8), sévérité (info/warn/critical),
// search plein texte.
// Export : CSV (fonctionnel) + PDF horodaté hash-chain signé (Edge Function audit-pdf-export).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useIsMobile } from '@/hooks/useMediaQuery'
import {
  CrmTopNav,
  CrmIconRail,
  CRM_KEYFRAMES,
  type CrmScreenId,
} from '@/components/crm/CrmShell'
import { crmPalette, crmVoileEncre } from '@/components/crm/tokens'
import {
  dossierPalette,
  DOSSIER_KEYFRAMES,
  AUDIT_CATEGORIES,
  AUDIT_CAT_ICONS,
} from '@/components/crm-dossiers/tokens'
import { readCrmDark } from '@/lib/crmDark'
import {
  KycBlackPill,
  KycGhostPill,
  KycStatCard,
} from '@/components/crm-dossiers/primitives'
import { CrmIcon } from '@/components/crm-dossiers/icons'
import { AudDayGroup } from '@/components/crm-dossiers/audit/AudDayGroup'
import { useAuditEvents } from '@/hooks/useAuditLog'
import { downloadAuditCsv } from '@/lib/auditCsvExport'
import { downloadAuditPdf } from '@/lib/auditPdfExport'
import type { AuditCategory, AuditSeverity, AuditEvent } from '@/types/kyc'

export default function AuditPage() {
  /**
   * ⛔ CETTE PAGE N'A PAS DE VARIANTE MOBILE, contrairement au KYC et au wizard :
   * sa route est `<Route path="audit" element={<AuditPage />} />`, sans
   * `ResponsiveRoute`. Elle rend donc TELLE QUELLE à 375 px, et ses trois
   * collapses étaient portés par `responsive.css` — une feuille chargée sur
   * TOUTES les pages de l'app pour trois règles utiles ici.
   *
   * Le seuil est celui de `useIsMobile` (768 px), le même que `ResponsiveRoute` :
   * deux seuils divergents auraient créé une bande de largeurs où l'un bascule
   * et pas l'autre.
   */
  const etroit = useIsMobile()
  const navigate = useNavigate()
  const { t: tr } = useTranslation('common')
  /**
   * ⚠ `readCrmDark()` et non `useCrmDark()` : le rail de cette page BASCULE
   * le thème (`setDark` lui est passé), et le hook est en lecture seule. Deux
   * sources — l'état local pour `sp`, le hook pour `S` — divergeraient au clic,
   * ce qui recréerait la demi-bascule qu'on corrige. C'est la MÊME lecture
   * partagée, avec le repli `prefers-color-scheme` que la forme `=== '1'`
   * recopiée ici n'avait pas : une clé absente y rendait FAUX, donc un profil
   * neuf sous macOS sombre recevait une page claire.
   */
  const [dark, setDark] = useState<boolean>(readCrmDark)
  const sp = useMemo(() => crmPalette(dark), [dark])
  const S = useMemo(() => dossierPalette(dark), [dark])

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

  const onNavigate = (id: CrmScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': navigate('/dashboard/listings'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'audit': break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'messagerie': navigate('/dashboard/messagerie'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
    }
  }
  const onCmd = () => {}

  return (
    <div
      data-screen-label="CRM Audit nLPD"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: S.bgGradient,
        fontFamily: S.font,
        color: S.ink,
      }}
    >
      <style>{CRM_KEYFRAMES}</style>
      <style>{DOSSIER_KEYFRAMES}</style>

      <CrmTopNav
        active={'audit' as CrmScreenId}
       
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <CrmIconRail
          active={'audit' as CrmScreenId}
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main style={{ flex: 1, minWidth: 0, padding: etroit ? '100px 16px 120px 16px' : '100px 40px 120px 40px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            {/* HEADER */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: etroit ? '1fr' : '1fr auto',
                gap: 32,
                alignItems: etroit ? 'stretch' : 'flex-end',
                marginBottom: 36,
                animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 'var(--crm-text-sm)',
                    fontWeight: 600,
                    color: S.muted,
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
                    color: S.ink,
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
                    color: S.inkSoft,
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
                  icon={<CrmIcon name="download" size={14} stroke={S.inkSoft} />}
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
                  icon={<CrmIcon name="download" size={15} stroke="#fff" />}
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
                    background: S.errSoft,
                    color: S.errDarker,
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
              style={{
                display: 'grid',
                gridTemplateColumns: etroit ? '1fr' : 'repeat(4, 1fr)',
                gap: 14,
                marginBottom: 24,
                animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <KycStatCard
                label={tr('audit.stats.events')}
                value={stats.total}
                accent={S.accent}
                sub={filterDays >= 3650 ? tr('audit.stats.eventsRangeAll') : tr('audit.stats.eventsRangeDays', { days: filterDays })}
              />
              <KycStatCard
                label={tr('audit.stats.critical')}
                value={stats.critical}
                accent={S.err}
                sub={tr('audit.stats.criticalSub')}
              />
              <KycStatCard
                label={tr('audit.stats.warning')}
                value={stats.warn}
                accent={S.warn}
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
                background: S.card,
                borderRadius: 22,
                padding: '18px 22px',
                boxShadow: S.shadow,
                marginBottom: 18,
                display: 'grid',
                gridTemplateColumns: etroit ? '1fr' : '1fr auto',
                gap: 16,
                alignItems: etroit ? 'stretch' : 'center',
                animation: 'sgFadeUp .6s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              {/* Recherche */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '0 14px',
                  height: 44,
                  background: S.cardSubtle,
                  borderRadius: 999,
                  maxWidth: 380,
                }}
              >
                <CrmIcon name="search" size={16} stroke={S.muted} />
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
                    color: S.ink,
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
                    <CrmIcon
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
                  background: `${crmVoileEncre(false, 0.08)}`,
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
                      background: S.err,
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
                      background: S.warn,
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
                background: S.card,
                borderRadius: 22,
                overflow: 'hidden',
                boxShadow: S.shadow,
                animation: 'sgFadeUp .7s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              {isLoading ? (
                <div
                  style={{
                    padding: '80px 40px',
                    textAlign: 'center',
                    color: S.muted,
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
                    color: S.muted,
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
                color: S.muted,
                fontSize: 'var(--crm-text-sm)',
                fontWeight: 500,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  background: S.card,
                  boxShadow: S.shadowSm,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <CrmIcon name="lock" size={14} stroke={S.inkSoft} />
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
