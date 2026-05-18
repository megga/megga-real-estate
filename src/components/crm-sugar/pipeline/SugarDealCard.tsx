// MEGGA CRM Sugar v2 — Pipeline deal card (kanban).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx).

import { memo, useState, type DragEvent as ReactDragEvent } from 'react'
import CRMIcon, { type CrmIconName } from '../CRMIcon'
import { CRM_STAGES, crmFmtCHF, crmInitials, type SugarPalette } from '../tokens'
import { crmContactById, crmBienById, type CrmContact, type CrmDeal } from '../mockData'
import { KycDealBadge } from '../kyc/KycNonBlocking'
import { SugarMiniRing } from './SugarMiniRing'

const KYC_TOTAL_DOCS = 6

/** Compute KYC progress (done/total) from the mock contact KYC status — returns null if KYC is verified (no badge needed). */
function kycProgressFromContact(c: CrmContact): { done: number; total: number } | null {
  switch (c.kyc?.status) {
    case 'verified': return null
    case 'stale':    return { done: KYC_TOTAL_DOCS, total: KYC_TOTAL_DOCS }
    case 'pending':  return { done: 4, total: KYC_TOTAL_DOCS }
    case 'none':
    default:         return { done: 0, total: KYC_TOTAL_DOCS }
  }
}

interface DealCardProps {
  deal: CrmDeal
  focused?: boolean
  sp: SugarPalette
  dark: boolean
  isDragging: boolean
  onClick?: () => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

function nextActionIcon(kind: string): CrmIconName {
  if (kind === 'call') return 'phone'
  if (kind === 'visit') return 'home'
  if (kind === 'kyc') return 'kyc'
  if (kind === 'match') return 'spark'
  return 'flag'
}

function SugarDealCardImpl({
  deal, focused = false, sp, dark, onClick, isDragging, onDragStart, onDragEnd,
}: DealCardProps) {
  const c = crmContactById(deal.contactId)!
  const b = deal.bienId ? crmBienById(deal.bienId) : null
  const riskColor = deal.risk === 'at-risk' ? '#F59E0B' : deal.risk === 'stalled' ? '#E53935' : null
  const kycProg = kycProgressFromContact(c)
  const stage = CRM_STAGES[deal.stage]
  const ink = focused ? sp.focusInk : sp.ink
  const sub = focused ? 'rgba(255,255,255,.65)' : sp.sub
  const surface = focused ? sp.focusSurface : sp.cardSubBg
  const [hover, setHover] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const onCardDragStart = (e: ReactDragEvent) => {
    e.dataTransfer.effectAllowed = 'move'
    onDragStart?.()
  }

  return (
    <div
      draggable
      onDragStart={onCardDragStart}
      onDragEnd={onDragEnd}
      onClick={!isDragging ? onClick : undefined}
      style={{
        background: focused ? sp.focusBg : (hover ? sp.cardBg : (dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.55)')),
        border: focused ? '0' : `1px solid ${sp.cardBorder}`,
        borderRadius: 18,
        padding: '14px 14px 12px',
        boxShadow: isDragging ? 'none' : (focused ? sp.focusShadow : (hover ? sp.shadow : sp.shadowSm)),
        cursor: isDragging ? 'grabbing' : 'grab',
        position: 'relative',
        opacity: isDragging ? 0.38 : 1,
        transition: 'opacity .15s, transform .15s, box-shadow .15s, background .15s',
        transform: isDragging ? 'scale(.97)' : 'none',
        userSelect: 'none',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
      }}
      onMouseEnter={() => { if (!isDragging) setHover(true) }}
      onMouseLeave={() => { setHover(false); setMenuOpen(false) }}>

      {(hover || menuOpen) && (
        <CardQuickActions sp={sp} focused={focused} contact={c} menuOpen={menuOpen} setMenuOpen={setMenuOpen} dark={dark} />
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 999,
          background: c.avatarBg || '#0041D9', color: '#fff',
          fontSize: 11, fontWeight: 700,
          display: 'grid', placeItems: 'center',
          border: `2px solid ${sp.avatarBorder}`, boxShadow: '0 2px 4px rgba(0,0,0,.18)',
          flexShrink: 0,
        }}>{crmInitials(`${c.firstName} ${c.lastName}`)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 12.5, fontWeight: 700, color: ink, lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {c.firstName} {c.lastName}
          </div>
          <div style={{
            fontSize: 10.5, color: sub, marginTop: 1,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {b ? b.title : 'Recherche active'}
          </div>
        </div>
        {kycProg && !focused && !hover && !menuOpen && (
          <KycDealBadge done={kycProg.done} total={kycProg.total} />
        )}
        {!kycProg && riskColor && !focused && !hover && !menuOpen && (
          <span style={{
            width: 18, height: 18, borderRadius: 999,
            background: riskColor + '1F', color: riskColor,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <CRMIcon name="risk" size={10} stroke={riskColor} />
          </span>
        )}
        {focused && <CRMIcon name="check" size={13} stroke={sp.focusInk} />}
      </div>

      <div style={{
        marginTop: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontSize: 17, fontWeight: 800, color: ink, letterSpacing: -0.4,
            fontVariantNumeric: 'tabular-nums',
          }}>{deal.value ? crmFmtCHF(deal.value) : '—'}</div>
          <div style={{ fontSize: 10.5, color: sub, fontWeight: 600, marginTop: 1 }}>
            {deal.probability}% · {stage.label}
          </div>
        </div>
        <SugarMiniRing
          value={deal.probability}
          color={focused ? sp.focusInk : stage.color}
          bg={focused ? 'rgba(255,255,255,.12)' : sp.cardSubBg}
          ink={ink} />
      </div>

      {deal.nextAction && (
        <div style={{
          marginTop: 12,
          padding: '8px 10px', borderRadius: 12,
          background: surface,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 20, height: 20, borderRadius: 999,
            background: focused ? 'rgba(255,255,255,.18)' : sp.cardBg,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <CRMIcon
              name={nextActionIcon(deal.nextAction.kind)}
              size={10}
              stroke={focused ? sp.focusInk : sp.soft} />
          </div>
          <span style={{
            flex: 1, fontSize: 11, fontWeight: 600, color: ink,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>{deal.nextAction.note}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, color: sub, fontVariantNumeric: 'tabular-nums',
          }}>{deal.nextAction.dueAt.slice(5, 10).split('-').reverse().join('/')}</span>
        </div>
      )}
    </div>
  )
}

// ─── Quick action overlay (phone/visit/menu) ──────────────────────────
function CardQuickActions({
  sp, focused, contact, menuOpen, setMenuOpen, dark,
}: {
  sp: SugarPalette
  focused: boolean
  contact: CrmContact
  menuOpen: boolean
  setMenuOpen: (v: boolean | ((o: boolean) => boolean)) => void
  dark: boolean
}) {
  const stop = (e: React.MouseEvent) => e.stopPropagation()
  const btnBg = focused ? 'rgba(255,255,255,.16)' : sp.cardBg
  const btnFg = focused ? sp.focusInk : sp.ink
  const btnBorder = focused ? 'rgba(255,255,255,.18)' : sp.cardBorder

  const baseBtn = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    width: 26, height: 26, borderRadius: 999, border: `1px solid ${btnBorder}`,
    background: btnBg, color: btnFg, cursor: 'pointer', fontFamily: 'inherit',
    display: 'grid', placeItems: 'center', boxShadow: focused ? 'none' : sp.shadowSm,
    transition: 'transform .12s, background .12s',
    ...extra,
  })

  return (
    <div onClick={stop} style={{
      position: 'absolute', top: 8, right: 8, display: 'flex', gap: 4, zIndex: 5,
      animation: 'qaFade .14s ease-out',
    }}>
      <style>{`@keyframes qaFade { from { opacity: 0; transform: translateY(-2px) } to { opacity: 1; transform: none } }`}</style>
      <button title={contact.phone ? `Appeler ${contact.phone}` : 'Appeler'}
        onClick={e => { stop(e); window.alert(`Appel ${contact.firstName} ${contact.lastName} — ${contact.phone || 'numéro non renseigné'}`) }}
        style={baseBtn()}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
        <CRMIcon name="phone" size={11} stroke={btnFg} />
      </button>
      <button title="Planifier une visite"
        onClick={e => { stop(e); window.alert(`Planifier une visite avec ${contact.firstName}`) }}
        style={baseBtn()}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
        <CRMIcon name="home" size={11} stroke={btnFg} />
      </button>
      <div style={{ position: 'relative' }}>
        <button title="Plus d'options"
          onClick={e => { stop(e); setMenuOpen(o => !o) }}
          style={baseBtn(menuOpen ? { background: sp.ink, color: sp.pageBg, borderColor: sp.ink } : {})}
          onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.transform = 'none' }}>
          <span style={{
            fontSize: 14, lineHeight: 0, fontWeight: 800, letterSpacing: 0,
            transform: 'translateY(-3px)', color: menuOpen ? sp.pageBg : btnFg,
          }}>···</span>
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: 32, right: 0, minWidth: 180,
            background: dark ? 'rgba(28,36,30,.92)' : 'rgba(255,255,255,.95)',
            border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
            boxShadow: '0 10px 30px -10px rgba(14,20,16,.20), 0 2px 6px rgba(14,20,16,.06)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            padding: 6, zIndex: 10, animation: 'qaFade .14s ease-out',
          }}>
            <MenuItem sp={sp} icon="contacts" label="Réassigner" onClick={() => { setMenuOpen(false); window.alert('Réassigner le deal à un autre agent') }} />
            <MenuItem sp={sp} icon="docs" label="Archiver" onClick={() => { setMenuOpen(false); window.alert('Archiver ce deal') }} />
            <MenuItem sp={sp} icon="risk" label="Marquer perdu" tone="danger" onClick={() => { setMenuOpen(false); window.alert('Marquer ce deal comme perdu — choisir un motif') }} />
          </div>
        )}
      </div>
    </div>
  )
}

function MenuItem({
  sp, icon, label, tone, onClick,
}: {
  sp: SugarPalette
  icon: CrmIconName
  label: string
  tone?: 'danger'
  onClick: () => void
}) {
  const danger = tone === 'danger'
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: 10, border: 0,
        background: hov ? (danger ? '#FDECEA' : sp.cardSubBg) : 'transparent',
        color: danger ? '#A11C16' : sp.ink, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600,
        textAlign: 'left',
      }}>
      <CRMIcon name={icon} size={12} stroke={danger ? '#A11C16' : sp.soft} />
      {label}
    </button>
  )
}

// Memoïsation : pendant un drag, le PipelineSugarV2Page re-render à chaque
// `setDragOverStage`. Sans React.memo, toutes les SugarDealCard de toutes
// les colonnes recalculent (60+ cards en pipeline réaliste).
// Comparaison custom : on saute le re-render si le deal n'a pas changé ET que
// les flags `focused`/`isDragging` sont identiques. `sp` change avec dark/light
// (référence stable au sein du parent) — on l'inclut.
export const SugarDealCard = memo(SugarDealCardImpl, (prev, next) => {
  return (
    prev.deal === next.deal
    && prev.focused === next.focused
    && prev.isDragging === next.isDragging
    && prev.sp === next.sp
    && prev.dark === next.dark
    && prev.onClick === next.onClick
    && prev.onDragStart === next.onDragStart
    && prev.onDragEnd === next.onDragEnd
  )
})
