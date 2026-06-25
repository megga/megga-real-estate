import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { CRM_STAGES, CRM_STAGE_ORDER, type StageId } from '@/components/crm-sugar/tokens'
import { crmBienById, crmContactById, type CrmDeal } from '@/components/crm-sugar/mockData'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { stageIdToTransactionStage } from '@/lib/sugarAdapters'
import { formatCHF } from '@/lib/utils'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'
import SgActionMenu from '../primitives/SgActionMenu'
import SgConfirmDestructive from '../primitives/SgConfirmDestructive'
import SgBottomCard from '../primitives/SgBottomCard'
import SgToast from '../primitives/SgToast'
import { useSgToast } from '../primitives/useSgToast'

interface DealVM {
  id: string
  stage: StageId
  name: string
  initials: string
  av: string
  bienTitle: string
  value: number | null
  prob: number
  risk: CrmDeal['risk']
  note: string
  noteKind: string
  needsKyc: boolean
}

// nextAction.kind → MEIcon (source unique).
const NOTE_ICON: Record<string, MEIconName> = {
  call: 'phone',
  phone: 'phone',
  kyc: 'shield',
  shield: 'shield',
  visit: 'calendar',
  cal: 'calendar',
  offer: 'banknote',
  bank: 'banknote',
  sign: 'file',
  mandate: 'file',
  file: 'file',
  bolt: 'bolt',
  clock: 'clock',
}

const DEMO_VMS: DealVM[] = [
  { id: 'd1', stage: 'to-qualify', name: 'Jean-Marc Aebischer', initials: 'JA', av: '#F59E0B', bienTitle: '4 pièces · Eaux-Vives', value: null, prob: 30, risk: 'healthy', note: 'Mandat exclusif à signer', noteKind: 'file', needsKyc: false },
  { id: 'd2', stage: 'searching', name: 'Nadia Berset', initials: 'NB', av: '#06B6D4', bienTitle: '3 pièces meublé · Pâquis', value: 38400, prob: 35, risk: 'healthy', note: 'Diffusion annonce', noteKind: 'bolt', needsKyc: false },
  { id: 'd3', stage: 'visit-scheduled', name: 'Marie Bertrand', initials: 'MB', av: '#0041D9', bienTitle: '5 pièces familial · Carouge', value: 1100000, prob: 65, risk: 'healthy', note: 'Relancer après visite', noteKind: 'phone', needsKyc: false },
  { id: 'd4', stage: 'visit-scheduled', name: 'Olivier Marchand', initials: 'OM', av: '#6366F1', bienTitle: '4 pièces · Servette', value: 720000, prob: 45, risk: 'stalled', note: 'Visite sans suite · 9 j', noteKind: 'clock', needsKyc: false },
  { id: 'd5', stage: 'offer', name: 'Antoine Picard', initials: 'AP', av: '#0041D9', bienTitle: 'Villa contemporaine · Cologny', value: 3850000, prob: 70, risk: 'healthy', note: 'Réponse vendeur attendue', noteKind: 'bank', needsKyc: false },
  { id: 'd6', stage: 'offer', name: 'Élodie Schmidt', initials: 'ES', av: '#10B981', bienTitle: '4 pièces · Eaux-Vives', value: 850000, prob: 80, risk: 'healthy', note: '', noteKind: 'shield', needsKyc: true },
  { id: 'd7', stage: 'signed', name: 'Béatrice Nussbaum', initials: 'BN', av: '#0041D9', bienTitle: '3 pièces · Champel', value: 500000, prob: 92, risk: 'healthy', note: 'Compromis chez le notaire', noteKind: 'file', needsKyc: false },
]

function dealToVM(d: CrmDeal): DealVM {
  const c = crmContactById(d.contactId)
  const b = d.bienId ? crmBienById(d.bienId) : null
  const name = c ? `${c.firstName} ${c.lastName}` : '—'
  const initials = c ? `${c.firstName[0] ?? ''}${c.lastName[0] ?? ''}`.toUpperCase() : '—'
  const needsKyc = !!c?.kyc && c.kyc.status !== 'verified'
  return {
    id: d.id,
    stage: d.stage,
    name,
    initials,
    av: c?.avatarBg ?? '#0041D9',
    bienTitle: b?.title ?? '',
    value: d.value,
    prob: d.probability,
    risk: d.risk,
    note: d.nextAction.note,
    noteKind: d.nextAction.kind,
    needsKyc,
  }
}

function ProbRing({ pct, color }: { pct: number; color: string }) {
  const { tk } = useMobileTokens()
  const size = 38
  const r = (size - 5) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - Math.max(0, Math.min(100, pct)) / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={tk.hair} strokeWidth={3.5} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={3.5} fill="none" strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.22,1,.36,1)' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 10.5, fontWeight: 800, color: tk.ink, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.3 }}>
        {pct}
      </div>
    </div>
  )
}

/**
 * Pipeline mobile — onglets de stade (scroll horizontal) + liste verticale des
 * affaires du stade actif. Pattern visuel du proto préservé, mais sur les VRAIS
 * 8 stades CRM (`CRM_STAGE_ORDER`, labels `t('stages.*')`, couleurs CRM_STAGES)
 * pour fidélité données + cohérence desktop. Câblé `usePipelineSugar` (mêmes
 * deals/`updateStage` que le board desktop ; mutation = `transactions.stage`,
 * event émis par le trigger DB). **KYC non-bloquant** : rappel doux sur la carte,
 * jamais un verrou. Réutilise les primitives P1 (menu, confirmation, toast).
 * Seeds derrière `demo`.
 */
export function MobilePipelineScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('pipeline')
  const { tk, isDark } = useMobileTokens()
  const { deals, updateStage } = usePipelineSugar()
  const { toast, showToast } = useSgToast()

  const vms = useMemo<DealVM[]>(() => (demo ? DEMO_VMS : deals.filter((d) => d.stage !== 'lost').map(dealToVM)), [demo, deals])
  const totalValue = demo ? 'CHF 7.6M' : `CHF ${(vms.reduce((s, v) => s + (v.value || 0), 0) / 1e6).toFixed(1)}M`
  const totalCount = vms.length

  const firstWithDeals = CRM_STAGE_ORDER.find((s) => vms.some((v) => v.stage === s))
  const [active, setActive] = useState<StageId>(() => firstWithDeals ?? 'offer')

  const [menuDeal, setMenuDeal] = useState<DealVM | null>(null)
  const [stagePick, setStagePick] = useState<DealVM | null>(null)
  const [confirmLost, setConfirmLost] = useState<DealVM | null>(null)

  const stageColor = (s: StageId) => CRM_STAGES[s].color
  const visible = vms.filter((v) => v.stage === active)

  const doMove = (deal: DealVM, target: StageId) => {
    setStagePick(null)
    setActive(target)
    if (!demo) updateStage.mutate({ id: deal.id, stage: stageIdToTransactionStage(target) })
    showToast(t('toast.movedTo', { name: deal.name, stage: t(`stages.${target}`) }))
  }
  const doLost = (deal: DealVM) => {
    setConfirmLost(null)
    if (!demo) updateStage.mutate({ id: deal.id, stage: stageIdToTransactionStage('lost') })
    showToast(t('toast.markedLost', { name: deal.name }))
  }

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink }}>
      {/* En-tête */}
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 6px' }}>
        <MeggaWordmark color={tk.ink} height={22} />
        <button
          type="button"
          onClick={() => openSugarSearch()}
          aria-label={t('common:nav.search')}
          style={{ width: 38, height: 38, borderRadius: 999, border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, display: 'grid', placeItems: 'center' }}
        >
          <MEIcon name="search" size={18} color={tk.ink} />
        </button>
      </header>

      <div style={{ padding: '4px 18px 0' }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>
          {t('common:nav.pipeline')}
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 7, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: tk.ink, letterSpacing: -0.3, fontVariantNumeric: 'tabular-nums' }}>{totalValue}</span>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: tk.inkSoft }}>{t('dealsCount', { count: totalCount })}</span>
        </div>
      </div>

      {/* Onglets de stade */}
      <div style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '18px 18px 4px', scrollbarWidth: 'none' }}>
        {CRM_STAGE_ORDER.map((s) => {
          const on = s === active
          return (
            <button
              key={s}
              type="button"
              onClick={() => setActive(s)}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 40,
                padding: '0 16px',
                borderRadius: 999,
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: on ? tk.accent : tk.card,
                boxShadow: on ? tk.shadow : 'none',
                transition: 'background .2s ease',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: 999, background: stageColor(s), flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: on ? 800 : 700, letterSpacing: -0.2, color: on ? tk.accentInk : tk.ink, whiteSpace: 'nowrap' }}>
                {t(`stages.${s}`)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Sous-titre stade */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, margin: '18px 18px 0' }}>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: stageColor(active) }} />
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: tk.ink }}>{t(`stages.${active}`)}</h2>
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 11, padding: '13px 18px 0' }}>
        {visible.map((d) => (
          <div
            key={d.id}
            role="button"
            tabIndex={0}
            onClick={() => navigate(`/dashboard/transactions/${d.id}`)}
            style={{ background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 18, boxShadow: tk.shadowSm, padding: '14px 15px 13px', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <span style={{ width: 36, height: 36, borderRadius: 999, display: 'grid', placeItems: 'center', background: d.av, color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{d.initials}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: tk.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                <div style={{ fontSize: 11.5, color: tk.muted, fontWeight: 600, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.bienTitle}</div>
              </div>
              <ProbRing pct={d.prob} color={stageColor(d.stage)} />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setMenuDeal(d)
                }}
                aria-label={t('common:actions.options')}
                style={{ width: 32, height: 32, borderRadius: 999, border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, marginRight: -4, color: tk.muted }}
              >
                <MEIcon name="more-horizontal" size={18} color={tk.muted} />
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: tk.ink, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {d.value == null ? <span style={{ fontSize: 13.5, fontWeight: 700, color: tk.muted, letterSpacing: 0 }}>{t('toEstimate')}</span> : formatCHF(d.value)}
              </div>
              {d.risk !== 'healthy' ? (
                <span style={{ marginLeft: 'auto', fontSize: 9.5, fontWeight: 800, letterSpacing: 0.3, color: tk.riskFg, background: tk.riskBg, padding: '3px 9px', borderRadius: 999, whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                  {t('board.risk.atRisk')}
                </span>
              ) : null}
            </div>
            {(d.note || d.needsKyc) ? (
              <div
                style={{
                  marginTop: 11,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: '9px 11px',
                  borderRadius: 12,
                  background: d.needsKyc ? (isDark ? 'rgba(14,116,144,.18)' : '#E0F1F5') : tk.cardSubtle,
                }}
              >
                <span style={{ width: 22, height: 22, borderRadius: 999, background: d.needsKyc ? 'transparent' : tk.card, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: d.needsKyc ? 'none' : tk.shadowSm }}>
                  <MEIcon name={d.needsKyc ? 'shield' : (NOTE_ICON[d.noteKind] ?? 'clock')} size={12} color={d.needsKyc ? (isDark ? '#7FCFE0' : '#0E7490') : tk.inkSoft} />
                </span>
                <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: d.needsKyc ? (isDark ? '#9FD8E6' : '#0E6580') : tk.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {d.needsKyc ? t('kycSoft') : d.note}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* ••• menu */}
      <SgActionMenu
        open={menuDeal !== null}
        onClose={() => setMenuDeal(null)}
        title={menuDeal?.name}
        items={[
          { id: 'stage', icon: 'trending-up', label: t('actions.changeStage') },
          { id: 'rdv', icon: 'calendar', label: t('actions.scheduleRdv') },
          { id: 'lost', icon: 'close-circle', label: t('actions.markLost'), danger: true, divider: true },
        ]}
        onAction={(id) => {
          const d = menuDeal
          setMenuDeal(null)
          if (!d) return
          if (id === 'stage') setStagePick(d)
          else if (id === 'rdv') navigate('/dashboard/visits/new')
          else if (id === 'lost') setConfirmLost(d)
        }}
      />

      {/* Changer d'étape */}
      <SgBottomCard open={stagePick !== null} onClose={() => setStagePick(null)} ariaLabel={t('actions.changeStage')}>
        <div style={{ padding: '18px 16px 6px' }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: -0.4, color: tk.ink }}>{t('actions.changeStage')}</div>
          {stagePick ? <div style={{ fontSize: 13, fontWeight: 600, color: tk.muted, marginTop: 3 }}>{stagePick.name}</div> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 8px 12px' }}>
          {CRM_STAGE_ORDER.map((s) => {
            const cur = stagePick?.stage === s
            return (
              <button
                key={s}
                type="button"
                disabled={cur}
                onClick={() => {
                  if (!cur && stagePick) doMove(stagePick, s)
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '13px 12px', borderRadius: 14, border: 0, cursor: cur ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left', background: cur ? tk.cardSubtle : 'transparent', opacity: cur ? 0.6 : 1 }}
              >
                <span style={{ width: 10, height: 10, borderRadius: 999, background: stageColor(s), flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, letterSpacing: -0.2, color: tk.ink }}>{t(`stages.${s}`)}</span>
                {cur ? (
                  <span style={{ fontSize: 11, fontWeight: 800, color: tk.muted, letterSpacing: 0.2, textTransform: 'uppercase' }}>{t('stagePick.current')}</span>
                ) : (
                  <MEIcon name="arrow-right" size={16} color={tk.muted} />
                )}
              </button>
            )
          })}
        </div>
      </SgBottomCard>

      {/* Marquer perdue */}
      <SgConfirmDestructive
        open={confirmLost !== null}
        title={t('lost_dialog.title')}
        message={confirmLost ? t('lost_dialog.message', { name: confirmLost.name }) : undefined}
        confirmLabel={t('actions.markLost')}
        onConfirm={() => {
          if (confirmLost) doLost(confirmLost)
        }}
        onCancel={() => setConfirmLost(null)}
      />

      <SgToast toast={toast} />
    </div>
  )
}
