// MEGGA CRM Sugar v2 — Pipeline deal card (kanban).
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx).

import { memo, useState, type DragEvent as ReactDragEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { CRM_STAGES, crmFmtCHF, crmInitials, type SugarPalette } from '../tokens'
import { crmContactById, crmBienById, type CrmContact, type CrmDeal } from '../mockData'
import { KycDealBadge } from '../kyc/KycNonBlocking'
import { SugarMiniRing } from './SugarMiniRing'
import { useUpdateTransactionStage } from '@/hooks/useTransactions'
import { useTeamMembers } from '@/hooks/useTeam'
import { supabase } from '@/lib/supabase'

// Mock-id guard — CRM_DEALS uses `d-…` ids; real Supabase rows use UUIDs.
const MOCK_ID_RE = /^[bcd]-\d/
const isMockId = (id: string | null | undefined): boolean => !!id && MOCK_ID_RE.test(id)

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

function nextActionIcon(kind: string): MEIconName {
  if (kind === 'call') return 'phone'
  if (kind === 'visit') return 'home'
  if (kind === 'kyc') return 'shield'
  if (kind === 'match') return 'sparkle'
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
        <CardQuickActions
          sp={sp}
          focused={focused}
          contact={c}
          dealId={deal.id}
          menuOpen={menuOpen}
          setMenuOpen={setMenuOpen}
          dark={dark}
        />
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
            <MEIcon name="alert" size={10} color={riskColor} />
          </span>
        )}
        {focused && <MEIcon name="check" size={13} color={sp.focusInk} />}
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
            <MEIcon
              name={nextActionIcon(deal.nextAction.kind)}
              size={10}
              color={focused ? sp.focusInk : sp.soft} />
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
  sp, focused, contact, dealId, menuOpen, setMenuOpen, dark,
}: {
  sp: SugarPalette
  focused: boolean
  contact: CrmContact
  dealId: string
  menuOpen: boolean
  setMenuOpen: (v: boolean | ((o: boolean) => boolean)) => void
  dark: boolean
}) {
  const navigate = useNavigate()
  const updateStage = useUpdateTransactionStage()
  const [reassignOpen, setReassignOpen] = useState(false)
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  // Helper: status update on transactions (archive only — stage transitions
  // for 'lost' use useUpdateTransactionStage which also writes an audit
  // event for compliance).
  async function archiveDeal() {
    if (isMockId(dealId)) {
       
      window.alert('Archivage disponible sur un deal réel uniquement (donnée de démo).')
      return
    }
    if (typeof window !== 'undefined' && !window.confirm('Archiver ce deal ?')) return
    // The transactions.status enum has no 'archived' — we use 'cancelled'
    // as the closest "remove from active view" semantic. Could split into
    // a dedicated 'archived' value via a future migration if needed.
    const { error } = await supabase
      .from('transactions')
      .update({ status: 'cancelled' })
      .eq('id', dealId)
     
    if (error) window.alert(`Échec : ${error.message}`)
    // Cache Helpers in sibling hooks invalidates on update via auto-key
    // matching; the pipeline kanban refreshes on next render.
  }

  async function markLost() {
    if (isMockId(dealId)) {
       
      window.alert('Marquer perdu disponible sur un deal réel uniquement (donnée de démo).')
      return
    }
    if (typeof window === 'undefined') return
    const reason = window.prompt('Motif de la perte (optionnel, journalisé dans l\'audit trail) :')
    if (reason === null) return // cancelled
    try {
      await updateStage.mutateAsync({
        id: dealId,
        stage: 'lost',
        lostReason: reason.trim() || undefined,
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'erreur inconnue'
       
      window.alert(`Échec : ${msg}`)
    }
  }
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
      <button title="Planifier une visite"
        onClick={e => {
          stop(e)
          const q = new URLSearchParams()
          if (!isMockId(contact.id)) q.set('contactId', contact.id)
          navigate(`/dashboard/visits/nouveau${q.toString() ? '?' + q : ''}`)
        }}
        style={baseBtn()}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'none' }}>
        <MEIcon name="home" size={11} color={btnFg} />
      </button>
      <div style={{ position: 'relative' }}>
        <button title="Plus d'options"
          onClick={e => { stop(e); setMenuOpen(o => !o) }}
          style={baseBtn(menuOpen ? { background: sp.ink, color: sp.pageBg, borderColor: sp.ink } : {})}
          onMouseEnter={e => { if (!menuOpen) e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.transform = 'none' }}>
          <MEIcon name="more-horizontal" size={13} color={menuOpen ? sp.pageBg : btnFg} />
        </button>
        {menuOpen && (
          <div style={{
            position: 'absolute', top: 32, right: 0, minWidth: 180,
            background: dark ? 'rgba(26,26,32,.96)' : 'rgba(255,255,255,.95)',
            border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
            boxShadow: '0 10px 30px -10px rgba(14,20,16,.20), 0 2px 6px rgba(14,20,16,.06)',
            backdropFilter: 'blur(16px) saturate(1.4)',
            WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
            padding: 6, zIndex: 10, animation: 'qaFade .14s ease-out',
          }}>
            <MenuItem sp={sp} dark={dark} icon="users" label="Réassigner" onClick={() => {
              if (isMockId(dealId)) {
                setMenuOpen(false)
                 
                window.alert('Réassignation disponible sur un deal réel uniquement (donnée de démo).')
                return
              }
              setReassignOpen(true)
            }} />
            <MenuItem sp={sp} dark={dark} icon="file" label="Archiver" onClick={() => { setMenuOpen(false); void archiveDeal() }} />
            <MenuItem sp={sp} dark={dark} icon="alert" label="Marquer perdu" tone="danger" onClick={() => { setMenuOpen(false); void markLost() }} />
          </div>
        )}
        {reassignOpen && (
          <ReassignPicker
            sp={sp}
            dark={dark}
            dealId={dealId}
            onClose={() => { setReassignOpen(false); setMenuOpen(false) }}
          />
        )}
      </div>
    </div>
  )
}

// ─── Reassign-to-agent popover ────────────────────────────────────────
// Lists the agency's team members (via useTeamMembers), shows each agent's
// current pipeline load (count of active transactions assigned to them),
// updates transactions.assigned_to on pick. RLS already gates this so
// agent A can only reassign deals in their own agency.
function ReassignPicker({
  sp, dark, dealId, onClose,
}: {
  sp: SugarPalette
  dark: boolean
  dealId: string
  onClose: () => void
}) {
  const { data: members = [] as Array<{ id: string; full_name: string; avatar_url: string | null }>, isLoading } = useTeamMembers()
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(agentId: string) {
    setSaving(agentId)
    setError(null)
    try {
      const { error: err } = await supabase
        .from('transactions')
        .update({ assigned_to: agentId })
        .eq('id', dealId)
      if (err) {
        setError(err.message)
        return
      }
      onClose()
    } finally {
      setSaving(null)
    }
  }

  const surface = dark ? 'rgba(28,36,30,.96)' : 'rgba(255,255,255,.98)'

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', top: 32, right: 0, minWidth: 240, maxWidth: 280,
        background: surface,
        border: `1px solid ${sp.cardBorder}`, borderRadius: 14,
        boxShadow: '0 10px 30px -10px rgba(14,20,16,.25), 0 2px 6px rgba(14,20,16,.08)',
        backdropFilter: 'blur(16px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(16px) saturate(1.4)',
        padding: 8, zIndex: 20, animation: 'qaFade .14s ease-out',
      }}
    >
      <div style={{ padding: '4px 8px 8px', fontSize: 11, fontWeight: 700, color: sp.sub, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        Réassigner à
      </div>
      {isLoading && (
        <div style={{ padding: 12, color: sp.sub, fontSize: 12 }}>Chargement…</div>
      )}
      {!isLoading && members.length === 0 && (
        <div style={{ padding: 12, color: sp.sub, fontSize: 12 }}>
          Aucun autre agent dans l'agence.
        </div>
      )}
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {members.map((m) => (
          <button
            key={m.id}
            disabled={saving !== null}
            onClick={() => { void pick(m.id) }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '8px 10px', background: 'transparent', border: 0, borderRadius: 8,
              cursor: saving === null ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit', textAlign: 'left',
              opacity: saving !== null && saving !== m.id ? 0.5 : 1,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = sp.cardSubBg }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 999,
              background: m.avatar_url ? `center/cover no-repeat url(${m.avatar_url})` : sp.ink,
              color: '#fff', fontSize: 10, fontWeight: 700,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              {!m.avatar_url && crmInitials(m.full_name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.full_name}
              </div>
            </div>
            {saving === m.id && (
              <span style={{ fontSize: 10, color: sp.sub }}>…</span>
            )}
          </button>
        ))}
      </div>
      {error && (
        <div role="alert" style={{
          marginTop: 6, padding: '6px 10px', borderRadius: 8,
          background: '#FEF2F2', color: '#B91C1C',
          fontSize: 11, fontWeight: 600, border: '1px solid #FCA5A5',
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  sp, icon, label, tone, onClick, dark,
}: {
  sp: SugarPalette
  icon: MEIconName
  label: string
  tone?: 'danger'
  onClick: () => void
  dark: boolean
}) {
  const danger = tone === 'danger'
  const dangerInk = dark ? '#F26B65' : '#A11C16'
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', padding: '8px 10px', borderRadius: 10, border: 0,
        background: hov ? (danger ? (dark ? 'rgba(242,107,101,0.14)' : '#FDECEA') : sp.cardSubBg) : 'transparent',
        color: danger ? dangerInk : sp.ink, cursor: 'pointer', fontFamily: 'inherit',
        display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, fontWeight: 600,
        textAlign: 'left',
      }}>
      <MEIcon name={icon} size={12} color={danger ? dangerInk : sp.soft} />
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
