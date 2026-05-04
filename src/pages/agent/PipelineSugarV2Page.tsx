// MEGGA CRM Sugar v2 — Pipeline page (Tier 3.c).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx — `CRMScreenPipelineSugar`).

import { useState, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, CRM_STAGES, CRM_STAGE_ORDER, crmSugarPalette,
  type DarkTone, type StageId,
} from '@/components/crm-sugar/tokens'
import { CRM_DEALS, crmBienById, crmContactById, type CrmDeal } from '@/components/crm-sugar/mockData'
import CRMIcon from '@/components/crm-sugar/CRMIcon'
import { KycSoftBanner } from '@/components/crm-sugar/kyc/KycNonBlocking'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_STAGE_PROBS } from '@/components/crm-sugar/pipeline/stageConstants'
import { SugarStageColumn } from '@/components/crm-sugar/pipeline/SugarStageColumn'
import { PipelineList } from '@/components/crm-sugar/pipeline/PipelineList'
import { PipelineTimeline } from '@/components/crm-sugar/pipeline/PipelineTimeline'
import {
  SugarKpiTile, SugarSegmentedView, SugarFilterPill,
  SugarStageFilter, SugarRiskFilter, SugarPeriodFilter,
  type PipelineView, type RiskFilterValue,
} from '@/components/crm-sugar/pipeline/PipelineFilters'
import { DealDetailDrawer } from '@/components/crm-sugar/pipeline/DealDetailDrawer'
import { NewDealDrawer } from '@/components/crm-sugar/pipeline/NewDealDrawer'

const DARK_TONE: DarkTone = 'meggaAi'

export default function PipelineSugarV2Page() {
  const navigate = useNavigate()

  // ── Theme: dark/light, persisted (shared with the Today page) ───────
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  const [view, setView] = useState<PipelineView>('kanban')
  const [newDealOpen, setNewDealOpen] = useState(false)
  const [openDealId, setOpenDealId] = useState<string | null>(null)
  const [kycSoftDismissed, setKycSoftDismissed] = useState(false)

  // ── Drag & drop ──────────────────────────────────────────────────────
  const [localDeals, setLocalDeals] = useState<CrmDeal[]>(CRM_DEALS)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null)
  const [kycBlockStage, setKycBlockStage] = useState<StageId | null>(null)

  const handleDragStart = (dealId: string) => setDraggingId(dealId)
  const handleDragEnd = () => { setDraggingId(null); setDragOverStage(null) }
  const handleDragOver = (stage: StageId) => setDragOverStage(stage)
  const handleDrop = (targetStage: StageId) => {
    if (!draggingId) return
    const deal = localDeals.find(d => d.id === draggingId)
    if (!deal || deal.stage === targetStage) { handleDragEnd(); return }
    const kycRequired = ['interest-confirmed', 'offer', 'signed'].includes(targetStage)
    const contact = crmContactById(deal.contactId)
    if (kycRequired && contact?.kyc?.status !== 'verified') {
      setKycBlockStage(targetStage)
      window.setTimeout(() => setKycBlockStage(null), 3000)
      handleDragEnd(); return
    }
    setLocalDeals(prev => prev.map(d =>
      d.id === draggingId
        ? { ...d, stage: targetStage, probability: CRM_STAGE_PROBS[targetStage] || d.probability }
        : d
    ))
    handleDragEnd()
  }

  // ── Filter state ─────────────────────────────────────────────────────
  const [search, setSearch] = useState('')
  const [filterStages, setFilterStages] = useState<StageId[]>([])
  const [filterRisk, setFilterRisk] = useState<RiskFilterValue>('all')
  const [filterPeriod, setFilterPeriod] = useState(30)

  const filteredDeals = useMemo(() => {
    return localDeals.filter(d => {
      const c = crmContactById(d.contactId)
      if (!c) return false
      const b = d.bienId ? crmBienById(d.bienId) : null
      if (search) {
        const q = search.toLowerCase()
        const inContact = `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
        const inBien = b ? b.title.toLowerCase().includes(q) || b.addr.toLowerCase().includes(q) : false
        const inNote = d.nextAction?.note?.toLowerCase().includes(q)
        if (!inContact && !inBien && !inNote) return false
      }
      if (filterStages.length > 0 && !filterStages.includes(d.stage)) return false
      if (filterRisk !== 'all' && d.risk !== filterRisk) return false
      if (filterPeriod !== 0) {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - filterPeriod)
        if (new Date(d.updatedAt) < cutoff) return false
      }
      return true
    })
  }, [search, filterStages, filterRisk, filterPeriod, localDeals])

  const filteredByStage = (stage: StageId) => filteredDeals.filter(d => d.stage === stage)
  const activeFilters = (filterStages.length > 0 ? 1 : 0) + (filterRisk !== 'all' ? 1 : 0) + (filterPeriod !== 30 ? 1 : 0)
  const resetFilters = () => {
    setFilterStages([]); setFilterRisk('all'); setFilterPeriod(30); setSearch('')
  }

  const totalValue = localDeals.reduce((s, d) => s + (d.value || 0), 0)
  const atRisk = localDeals.filter(d => d.risk !== 'healthy').length

  // ── KYC soft-banner (non-bloquant) ──────────────────────────────────
  const kycIncompleteCount = useMemo(() => {
    const seen = new Set<string>()
    return localDeals.filter(d => {
      const c = crmContactById(d.contactId)
      if (!c) return false
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return c.kyc?.status !== 'verified'
    }).length
  }, [localDeals])
  const showKycSoft = !kycSoftDismissed && kycIncompleteCount > 0

  // ── Cmd palette + nav (shared with Today) ────────────────────────────
  const onCmd = () => window.alert('Recherche — ⌘K (à venir)')
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':     navigate('/dashboard'); break
      case 'pipeline':  navigate('/dashboard/pipeline'); break
      case 'matching':  navigate('/dashboard/matching'); break
      case 'contacts':  navigate('/dashboard/contacts'); break
      case 'biens':     navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar':  navigate('/dashboard/calendar'); break
      case 'docs':      navigate('/dashboard/documents'); break
      case 'kyc':       navigate('/dashboard/kyc'); break
      case 'reseau':    navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien':    navigate('/dashboard/julien'); break
      case 'auto':      navigate('/dashboard/automation'); break
      case 'chat':      navigate('/dashboard/messages'); break
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings':  navigate('/dashboard/settings'); break
      default: break
    }
  }

  return (
    <div style={{
      background: sp.pageBg, minHeight: '100vh',
      fontFamily: 'Manrope, system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarTopNav active="pipeline" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
          active="pipeline"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main style={{ flex: 1, padding: '32px 40px 80px 0', minWidth: 0 }}>
          {/* Page header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, marginBottom: 28 }}>
            <h1 style={{
              margin: 0, fontSize: 38, fontWeight: 800, letterSpacing: -1.2, color: sp.ink, lineHeight: 1,
            }}>Pipeline</h1>
            <span style={{
              fontSize: 13, color: sp.sub, fontWeight: 500, marginBottom: 6,
            }}>
              {filteredDeals.length} deal{filteredDeals.length > 1 ? 's' : ''} · {CRM_STAGE_ORDER.length} étapes
              {activeFilters > 0 && ` · ${activeFilters} filtre${activeFilters > 1 ? 's' : ''}`}
            </span>
            <div style={{ flex: 1 }} />
            <SugarSegmentedView sp={sp} value={view} onChange={setView} />
            <button onClick={() => setNewDealOpen(true)} style={{
              height: 44, padding: '0 22px', borderRadius: 999, border: 0,
              background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 14,
              fontFamily: 'inherit', cursor: 'pointer',
              boxShadow: sp.focusShadow,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <CRMIcon name="plus" size={14} stroke={sp.pageBg} />
              Nouveau deal
            </button>
          </div>

          {/* KYC soft banner — non-bloquant, agrégé sur tous les deals */}
          {showKycSoft && (
            <div style={{ marginBottom: 18 }}>
              <KycSoftBanner
                title={`${kycIncompleteCount} dossier${kycIncompleteCount > 1 ? 's' : ''} KYC à compléter`}
                desc="Pièces manquantes ou non lancé. Vous pouvez continuer à travailler ces deals — pensez à compléter avant la signature."
                onComplete={() => navigate('/dashboard/kyc')}
                onDismiss={() => setKycSoftDismissed(true)}
              />
            </div>
          )}

          {/* KPI tiles */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
            <SugarKpiTile sp={sp} dark={dark} label="Pipeline actif"
              value={CRM_DEALS.length} sub="6 deals · 7 étapes couvertes" />
            <SugarKpiTile sp={sp} dark={dark} label="Valeur totale"
              value={`CHF ${(totalValue / 1e6).toFixed(2)}M`}
              sub="+ CHF 1.1M ce mois" accent={t.primary} />
            <SugarKpiTile sp={sp} dark={dark} label="À risque"
              value={atRisk} sub="Pierre Vionnet · Linda Okafor" accent="#F59E0B" />
            <SugarKpiTile sp={sp} dark={dark} label="Conversion"
              value="18%" sub="vs 14% le mois dernier" accent="#0E9F6E" />
          </div>

          {/* Search + filter pills */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
            <div style={{
              flex: 1, height: 44, padding: '0 16px',
              background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
              borderRadius: 999, boxShadow: sp.shadowSm,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <CRMIcon name="search" size={14} stroke={sp.sub} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher contact, bien, note…"
                style={{
                  flex: 1, background: 'transparent', border: 0, outline: 'none',
                  color: sp.ink, fontSize: 13, fontFamily: 'inherit',
                }}
              />
              {search && (
                <button onClick={() => setSearch('')} style={{
                  background: 'none', border: 0, cursor: 'pointer',
                  color: sp.sub, fontFamily: 'inherit', fontSize: 16,
                }}>×</button>
              )}
            </div>
            <SugarFilterPill sp={sp} label="Étape"
              value={filterStages.length === 0
                ? 'Toutes'
                : filterStages.length === 1
                  ? CRM_STAGES[filterStages[0]].label
                  : `${filterStages.length} étapes`}
              active={filterStages.length > 0}>
              <SugarStageFilter sp={sp} value={filterStages} onChange={setFilterStages} />
            </SugarFilterPill>
            <SugarFilterPill sp={sp} label="Risque"
              value={filterRisk === 'all' ? 'Tous'
                : filterRisk === 'healthy' ? 'Sain'
                : filterRisk === 'at-risk' ? 'À risque' : 'Bloqué'}
              active={filterRisk !== 'all'}>
              <SugarRiskFilter sp={sp} value={filterRisk} onChange={setFilterRisk} />
            </SugarFilterPill>
            <SugarFilterPill sp={sp} label="Période"
              value={filterPeriod === 0 ? 'Tous' : `${filterPeriod}j`}
              active={filterPeriod !== 30}>
              <SugarPeriodFilter sp={sp} value={filterPeriod} onChange={setFilterPeriod} />
            </SugarFilterPill>
            {activeFilters > 0 && (
              <button onClick={resetFilters} style={{
                height: 44, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer',
                background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 12,
                fontFamily: 'inherit', boxShadow: sp.focusShadow,
              }}>Réinitialiser</button>
            )}
          </div>

          {/* KYC block toast */}
          {kycBlockStage && (
            <div style={{
              position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
              background: '#0E1410', color: '#fff', padding: '14px 22px', borderRadius: 14,
              fontSize: 13, fontWeight: 700, zIndex: 200,
              display: 'flex', alignItems: 'center', gap: 12,
              boxShadow: '0 8px 32px rgba(0,0,0,.35)',
              animation: 'sugar-fade-up .2s ease-out',
            }}>
              <CRMIcon name="kyc" size={16} stroke="#F59E0B" />
              KYC requis pour passer en « {CRM_STAGES[kycBlockStage]?.label} ». Vérifiez le contact d'abord.
            </div>
          )}

          {/* Views */}
          {view === 'kanban' && (
            <div style={{
              display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 24,
            }}>
              {CRM_STAGE_ORDER.map(stage => (
                <SugarStageColumn
                  key={stage} stage={stage}
                  deals={filteredByStage(stage)}
                  sp={sp} dark={dark}
                  onOpenDeal={setOpenDealId}
                  draggingId={draggingId}
                  dragOver={dragOverStage === stage}
                  onDragOver={() => handleDragOver(stage)}
                  onDrop={() => handleDrop(stage)}
                  onDragLeave={() => dragOverStage === stage && setDragOverStage(null)}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}

          {view === 'list' && (
            <PipelineList sp={sp} deals={filteredDeals} onOpenDeal={setOpenDealId} />
          )}
          {view === 'timeline' && <PipelineTimeline sp={sp} />}
        </main>
      </div>

      <NewDealDrawer
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        sp={sp} t={t} dark={dark}
        prefill={null}
      />
      <DealDetailDrawer
        open={!!openDealId}
        onClose={() => setOpenDealId(null)}
        dealId={openDealId}
        sp={sp} t={t} dark={dark}
      />
    </div>
  )
}

// Suppress unused parameter warning on generic types
export type { ReactMouseEvent }
