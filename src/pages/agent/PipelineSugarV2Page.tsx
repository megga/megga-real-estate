// MEGGA CRM Sugar v2 — Pipeline page (Tier 3.c).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx — `CRMScreenPipelineSugar`).

import { useState, useEffect, useMemo, type MouseEvent as ReactMouseEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  CRM_TOKENS, CRM_STAGES, CRM_STAGE_ORDER, crmSugarPalette,
  type DarkTone, type StageId,
} from '@/components/crm-sugar/tokens'
import { crmBienById, crmContactById, type CrmDeal } from '@/components/crm-sugar/mockData'
import MEIcon from '@/components/propertyx/MEIcon'
import { SugarPipelineKycLock } from '@/components/crm-sugar-v3/pipeline/SugarPipelineKycLock'
import { PipelineKycToast } from '@/components/crm-sugar-v3/pipeline/PipelineKycToast'
import { KycOverrideModal } from '@/components/crm-sugar-v3/pipeline/KycOverrideModal'
import { useLogAudit } from '@/hooks/useAuditLog'
import { useToast } from '@/components/ui/Toast'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { stageIdToTransactionStage } from '@/lib/sugarAdapters'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_STAGE_PROBS } from '@/components/crm-sugar/pipeline/stageConstants'
import { SugarStageColumn } from '@/components/crm-sugar/pipeline/SugarStageColumn'
import { PipelineList } from '@/components/crm-sugar/pipeline/PipelineList'
import {
  SugarKpiTile, SugarSegmentedView, SugarFilterPill,
  SugarStageFilter, SugarRiskFilter, SugarPeriodFilter,
  type PipelineView, type RiskFilterValue,
} from '@/components/crm-sugar/pipeline/PipelineFilters'
import { NewDealDrawer } from '@/components/crm-sugar/pipeline/NewDealDrawer'

const DARK_TONE: DarkTone = 'meggaAi'

export default function PipelineSugarV2Page() {
  const { t } = useTranslation('pipeline')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Drilldown depuis le Dashboard Analytics : `?stage=signed,visit-scheduled`.
  // On parse une fois au mount et on nettoie l'URL pour ne pas que la même
  // ouverture re-applique le filtre au re-render.
  const initialFilterStages = useMemo<StageId[]>(() => {
    const raw = searchParams.get('stage')
    if (!raw) return []
    const valid = new Set(Object.keys(CRM_STAGES) as StageId[])
    return raw.split(',').filter((s): s is StageId => valid.has(s as StageId))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const tk = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(tk, dark, DARK_TONE)

  const [view, setView] = useState<PipelineView>('kanban')
  const [newDealOpen, setNewDealOpen] = useState(false)
  // Ouverture deal : navigate vers DealDetailSugarV3Page (route réelle wired
  // sur transactions Supabase). L'ancien DealDetailDrawer (737 lignes, lookup
  // dans CRM_DEALS mock) a été supprimé — il ne pouvait pas afficher de deal
  // réel (id UUID jamais dans le mock array).
  const openDeal = (dealId: string) => {
    navigate(`/dashboard/transactions/${dealId}`)
  }

  const logAudit = useLogAudit()
  const toast = useToast()

  // ── Source de vérité : Supabase via usePipelineSugar ────────────────
  // Le hook remplit le registry runtime ; crmContactById/crmBienById ci-dessous
  // renvoient automatiquement les contacts/biens Supabase.
  const { deals: liveDeals, updateStage } = usePipelineSugar()

  // ── Optimistic overlay (drag-drop fluide) ────────────────────────────
  // React Query invalide après mutation → léger délai. On overlay le stage
  // optimiste localement le temps que la mutation aboutisse pour éviter le
  // flash visuel (deal qui revient en arrière puis avance).
  const [pendingStage, setPendingStage] = useState<Map<string, StageId>>(() => new Map())

  const localDeals = useMemo<CrmDeal[]>(() => {
    if (pendingStage.size === 0) return liveDeals
    return liveDeals.map(d => {
      const pending = pendingStage.get(d.id)
      if (!pending) return d
      return { ...d, stage: pending, probability: CRM_STAGE_PROBS[pending] || d.probability }
    })
  }, [liveDeals, pendingStage])

  // ── Drag & drop ──────────────────────────────────────────────────────
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
    // Optimistic overlay
    setPendingStage(prev => {
      const next = new Map(prev)
      next.set(dealId, targetStage)
      return next
    })
    // Mutation Supabase (transactions.stage ; l'event 'stage_change' est émis par le trigger DB trg_transaction_lifecycle)
    updateStage.mutate(
      { id: dealId, stage: stageIdToTransactionStage(targetStage) },
      {
        onError: () => {
          toast.error(t('board.toast.moveFailedTitle'), {
            description: t('board.toast.moveFailedDescription'),
          })
        },
        onSettled: () => {
          setPendingStage(prev => {
            if (!prev.has(dealId)) return prev
            const next = new Map(prev)
            next.delete(dealId)
            return next
          })
        },
      },
    )
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
  const [filterStages, setFilterStages] = useState<StageId[]>(initialFilterStages)
  const [filterRisk, setFilterRisk] = useState<RiskFilterValue>('all')
  const [filterPeriod, setFilterPeriod] = useState(30)

  // Consume the `?stage=` query param : on l'a injecté dans filterStages,
  // on retire le param de l'URL pour que F5 ne re-applique pas.
  useEffect(() => {
    if (searchParams.has('stage')) {
      const next = new URLSearchParams(searchParams)
      next.delete('stage')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  // Pré-calculé une seule fois par render : un Map de stage → deals filtrés.
  // Évite 9 .filter() séparés appelés inline dans la boucle render des colonnes
  // (un par stage Kanban). Avec ~50 deals × 9 stages = 450 itérations par render,
  // optimisé à 50 itérations + 9 lookups O(1).
  const dealsByStage = useMemo(() => {
    const map = new Map<StageId, CrmDeal[]>()
    for (const stage of CRM_STAGE_ORDER) map.set(stage, [])
    for (const d of filteredDeals) {
      const arr = map.get(d.stage)
      if (arr) arr.push(d)
    }
    return map
  }, [filteredDeals])
  const filteredByStage = (stage: StageId) => dealsByStage.get(stage) ?? []
  const activeFilters = (filterStages.length > 0 ? 1 : 0) + (filterRisk !== 'all' ? 1 : 0) + (filterPeriod !== 30 ? 1 : 0)
  const resetFilters = () => {
    setFilterStages([]); setFilterRisk('all'); setFilterPeriod(30); setSearch('')
  }

  // Agrégations basées sur le pipeline complet (non filtré) — memoïsées pour
  // éviter de scanner ~50 deals à chaque drag (chaque setPendingStage trigger
  // un render parent).
  const totalValue = useMemo(
    () => localDeals.reduce((s, d) => s + (d.value || 0), 0),
    [localDeals],
  )
  const atRisk = useMemo(
    () => localDeals.filter(d => d.risk !== 'healthy').length,
    [localDeals],
  )
  // ── Conversion : signed / total des stages clôturés (signed + lost) ──
  // Source : pipeline live. Si pas de deals clôturés, on n'affiche pas de %.
  const closedDeals = useMemo(
    () => localDeals.filter(d => d.stage === 'signed' || d.stage === 'lost').length,
    [localDeals],
  )
  const signedDeals = useMemo(
    () => localDeals.filter(d => d.stage === 'signed').length,
    [localDeals],
  )
  const conversionPct = closedDeals > 0 ? Math.round((signedDeals / closedDeals) * 100) : null

  // ── Dossiers KYC à compléter (rappel doux, NON-bloquant) ────────────
  // Suggestion sur stages sensibles : visit-done/interest-confirmed/offer/signed.
  // KYC = nice to have, jamais un verrou — le deal avance quoi qu'il arrive.
  const pendingKycDeals = useMemo(() => {
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
  const onCmd = () => window.alert(t('board.commandPaletteComingSoon'))
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':     navigate('/dashboard'); break
      case 'pipeline':  navigate('/dashboard/pipeline'); break
      case 'matching':  navigate('/dashboard/matching'); break
      case 'contacts':  navigate('/dashboard/contacts'); break
      case 'biens':     navigate('/dashboard/listings'); break
      case 'biens-new': navigate('/dashboard/listings/new'); break
      case 'calendar':  navigate('/dashboard/calendar'); break
      case 'kyc':       navigate('/dashboard/kyc'); break
      case 'reseau':    navigate('/dashboard/network'); break
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
      fontFamily: '"Inter Tight", system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarTopNav active="pipeline" t={tk} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

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
            }}>{t('title')}</h1>
            <span style={{
              fontSize: 13, color: sp.sub, fontWeight: 500, marginBottom: 6,
            }}>
              {''}
            </span>
            <div style={{ flex: 1 }} />
            <SugarSegmentedView sp={sp} value={view} onChange={setView} />
            {/* Sprint 3 — Bouton ✨ Importer un lead (Sugar Pure : ghost à gauche du CTA noir) */}
            <button
              onClick={() => navigate('/dashboard/import-lead?returnTo=/dashboard/pipeline')}
              title={t('board.importLeadHint')}
              style={{
                height: 44, padding: '0 18px', borderRadius: 999, border: 0,
                background: sp.cardBg, color: sp.ink, fontWeight: 600, fontSize: 13,
                fontFamily: 'inherit', cursor: 'pointer',
                boxShadow: sp.shadowSm,
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              <MEIcon name="sparkle" size={14} color={sp.ink} />
              {t('board.importLead')}
            </button>
            <button onClick={() => setNewDealOpen(true)} style={{
              height: 44, padding: '0 22px', borderRadius: 999, border: 0,
              background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 14,
              fontFamily: 'inherit', cursor: 'pointer',
              boxShadow: sp.focusShadow,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <MEIcon name="plus" size={14} color={sp.pageBg} />
              {t('new_deal')}
            </button>
          </div>

          {/* Rappel KYC pipeline (non-bloquant) — pilule discrète Sugar Pure */}
          <SugarPipelineKycLock
            pending={pendingKycDeals}
            onOpenKyc={() => navigate('/dashboard/kyc')}
            sp={sp}
          />

          {/* KPI tiles — source : pipeline live (usePipelineSugar) */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 22 }}>
            <SugarKpiTile sp={sp} dark={dark} label={t('kpi.active')}
              value={localDeals.length}
              sub="" />
            <SugarKpiTile sp={sp} dark={dark} label={t('kpi.pipeline_value')}
              value={`CHF ${(totalValue / 1e6).toFixed(2)}M`}
              sub="" accent={tk.primary} />
            <SugarKpiTile sp={sp} dark={dark} label={t('kpi.at_risk')}
              value={atRisk}
              sub=""
              accent="#F59E0B" />
            <SugarKpiTile sp={sp} dark={dark} label={t('kpi.conversion')}
              value={conversionPct !== null ? `${conversionPct}%` : '—'}
              sub=""
              accent="#0E9F6E" />
          </div>

          {/* Search + filter pills */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 18 }}>
            <div style={{
              flex: 1, height: 44, padding: '0 16px',
              background: sp.cardBg, border: `1px solid ${sp.cardBorder}`,
              borderRadius: 999, boxShadow: sp.shadowSm,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <MEIcon name="search" size={14} color={sp.sub} />
              <input
                value={search} onChange={e => setSearch(e.target.value)}
                placeholder={t('board.searchPlaceholder')}
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
            <SugarFilterPill sp={sp} dark={dark} label={t('filter.stage')}
              value={filterStages.length === 0
                ? t('board.filter.allStages')
                : filterStages.length === 1
                  ? t(`stages.${filterStages[0]}`)
                  : t('board.filter.stagesSelected', { count: filterStages.length })}
              active={filterStages.length > 0}>
              <SugarStageFilter sp={sp} dark={dark} value={filterStages} onChange={setFilterStages} />
            </SugarFilterPill>
            <SugarFilterPill sp={sp} dark={dark} label={t('board.filter.riskHeader')}
              value={filterRisk === 'all' ? t('board.risk.all')
                : filterRisk === 'healthy' ? t('board.risk.healthy')
                : filterRisk === 'at-risk' ? t('board.risk.atRisk') : t('board.risk.stalled')}
              active={filterRisk !== 'all'}>
              <SugarRiskFilter sp={sp} dark={dark} value={filterRisk} onChange={setFilterRisk} />
            </SugarFilterPill>
            <SugarFilterPill sp={sp} dark={dark} label={t('board.filter.periodHeader')}
              value={filterPeriod === 0 ? t('board.filter.allTime') : t('board.filter.daysShort', { count: filterPeriod })}
              active={filterPeriod !== 30}>
              <SugarPeriodFilter sp={sp} dark={dark} value={filterPeriod} onChange={setFilterPeriod} />
            </SugarFilterPill>
            {activeFilters > 0 && (
              <button onClick={resetFilters} style={{
                height: 44, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer',
                background: sp.ink, color: sp.pageBg, fontWeight: 700, fontSize: 12,
                fontFamily: 'inherit', boxShadow: sp.focusShadow,
              }}>{t('board.filter.reset')}</button>
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
                  onOpenDeal={openDeal}
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
            <PipelineList sp={sp} deals={filteredDeals} onOpenDeal={openDeal} />
          )}
          {/* 'timeline' view retirée — PipelineTimeline iterait CRM_DEALS mock.
              Le toggle est aussi retiré de PipelineFilters.SugarSegmentedView.
              Réintroductible quand on aura des dates start/end par deal. */}
        </main>
      </div>

      <NewDealDrawer
        open={newDealOpen}
        onClose={() => setNewDealOpen(false)}
        sp={sp} t={tk} dark={dark}
        prefill={null}
      />
      {/* DealDetailDrawer retiré : ouvrait CRM_DEALS.find qui ne matche jamais
          un UUID réel. openDeal() navigue vers /dashboard/transactions/:id
          (page wired sur transactions). 0 perte de feature. */}

      {/* Toast verrou KYC : apparaît après drop bloqué ; "Passer outre" → modal motif */}
      {kycBlockState && !overrideOpen && (() => {
        const stageLabel = CRM_STAGES[kycBlockState.targetStage]
          ? t(`stages.${kycBlockState.targetStage}`)
          : kycBlockState.targetStage
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
        const stageLabel = CRM_STAGES[kycBlockState.targetStage]
          ? t(`stages.${kycBlockState.targetStage}`)
          : kycBlockState.targetStage
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
