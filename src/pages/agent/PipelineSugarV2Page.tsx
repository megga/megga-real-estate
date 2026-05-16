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
import { SugarPipelineKycLock } from '@/components/crm-sugar-v3/pipeline/SugarPipelineKycLock'
import { PipelineKycToast } from '@/components/crm-sugar-v3/pipeline/PipelineKycToast'
import { KycOverrideModal } from '@/components/crm-sugar-v3/pipeline/KycOverrideModal'
import { useLogAudit } from '@/hooks/useAuditLog'
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

  const logAudit = useLogAudit()

  // ── Drag & drop ──────────────────────────────────────────────────────
  const [localDeals, setLocalDeals] = useState<CrmDeal[]>(CRM_DEALS)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<StageId | null>(null)

  // ── KYC override flow (toast + modal motif + audit) ─────────────────
  // Arbitrage README #2 : drop sur stage sensible bloqué par toast,
  // bouton "Passer outre" ouvre la modal de motif (min 20 chars),
  // validation → AuditEvent + drop autorisé.
  const [kycBlockState, setKycBlockState] = useState<{
    dealId: string
    targetStage: StageId
  } | null>(null)
  const [overrideOpen, setOverrideOpen] = useState(false)

  const applyDrop = (dealId: string, targetStage: StageId) => {
    setLocalDeals(prev => prev.map(d =>
      d.id === dealId
        ? { ...d, stage: targetStage, probability: CRM_STAGE_PROBS[targetStage] || d.probability }
        : d
    ))
  }

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
      // Drop bloqué — affiche toast avec option "Passer outre"
      setKycBlockState({ dealId: deal.id, targetStage })
      handleDragEnd(); return
    }
    applyDrop(deal.id, targetStage)
    // AuditEvent normal : Étape changée (info)
    logAudit.mutate({
      category: 'deal',
      severity: 'info',
      action: 'Étape changée',
      entityType: 'deal',
      entityId: deal.id,
      objectLabel: contact ? `${contact.firstName} ${contact.lastName}` : deal.id,
      metadata: { from: deal.stage, to: targetStage },
    })
    handleDragEnd()
  }

  const handleOverrideConfirm = (reason: string) => {
    if (!kycBlockState) return
    const { dealId, targetStage } = kycBlockState
    const deal = localDeals.find(d => d.id === dealId)
    const contact = deal ? crmContactById(deal.contactId) : null
    if (!deal || !contact) {
      setKycBlockState(null); setOverrideOpen(false); return
    }
    applyDrop(dealId, targetStage)
    // AuditEvent : passage outre verrou KYC
    // severity = critical si stage 'signed', sinon warn (KYC_ENRICHISSEMENTS §7)
    const severity = targetStage === 'signed' ? 'critical' : 'warn'
    logAudit.mutate({
      category: 'deal',
      severity,
      action: 'Passage outre verrou KYC',
      entityType: 'deal',
      entityId: deal.id,
      objectLabel: `${contact.firstName} ${contact.lastName}`,
      metadata: {
        from: deal.stage,
        to: targetStage,
        reason,
        contactId: contact.id,
        kycStatus: contact.kyc?.status ?? 'none',
      },
    })
    setKycBlockState(null)
    setOverrideOpen(false)
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

  // ── Deals bloqués par KYC (handoff SugarPipelineKycLock) ────────────
  // Sur stages sensibles uniquement : visit-done/interest-confirmed/offer/signed
  const blockingDeals = useMemo(() => {
    const sensitive: StageId[] = ['visit-done', 'interest-confirmed', 'offer', 'signed']
    return localDeals
      .filter(d => sensitive.includes(d.stage))
      .map(d => {
        const c = crmContactById(d.contactId)
        if (!c) return null
        const verified = c.kyc?.status === 'verified'
        if (verified) return null
        return {
          id: d.id,
          contactFullName: `${c.firstName} ${c.lastName}`,
        }
      })
      .filter((x): x is { id: string; contactFullName: string } => x !== null)
  }, [localDeals])

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

          {/* Verrou KYC pipeline — bannière noire Sugar Pure (handoff §SugarPipelineKycLock) */}
          <SugarPipelineKycLock
            blocking={blockingDeals}
            onOpenKyc={() => navigate('/dashboard/kyc')}
          />

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

          {/* KYC block flow : géré hors du <main> via PipelineKycToast + KycOverrideModal */}

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

      {/* Toast verrou KYC : apparaît après drop bloqué ; "Passer outre" → modal motif */}
      {kycBlockState && !overrideOpen && (() => {
        const stageLabel = CRM_STAGES[kycBlockState.targetStage]?.label ?? kycBlockState.targetStage
        return (
          <PipelineKycToast
            stageLabel={stageLabel}
            onOverride={() => setOverrideOpen(true)}
            onDismiss={() => setKycBlockState(null)}
          />
        )
      })()}

      {/* Modal "Passer outre verrou KYC" — motif min 20 chars + audit nLPD */}
      {overrideOpen && kycBlockState && (() => {
        const deal = localDeals.find(d => d.id === kycBlockState.dealId)
        const contact = deal ? crmContactById(deal.contactId) : null
        const stageLabel = CRM_STAGES[kycBlockState.targetStage]?.label ?? kycBlockState.targetStage
        const severity: 'warn' | 'critical' = kycBlockState.targetStage === 'signed' ? 'critical' : 'warn'
        if (!contact) return null
        return (
          <KycOverrideModal
            stageLabel={stageLabel}
            contactName={`${contact.firstName} ${contact.lastName}`}
            severity={severity}
            onCancel={() => {
              setOverrideOpen(false)
              setKycBlockState(null)
            }}
            onConfirm={handleOverrideConfirm}
          />
        )
      })()}
    </div>
  )
}

// Suppress unused parameter warning on generic types
export type { ReactMouseEvent }
