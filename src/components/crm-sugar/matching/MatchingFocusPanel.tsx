// MEGGA CRM Sugar v2 — Matching focus panel (Inbox split, right side)
// 1:1 port from `crm-screen-matching-sugar.jsx` (FocusPanel + sub-components
// MCriteriaPill / MBienHero / MBienMiniRow). Cf. HANDOFF_MATCHING_REFONTE_CLAUDE_CODE.md.

import { useEffect, useRef, useState } from 'react'
import { crmBienById, type CrmContact, type CrmMatch } from '../mockData'
import { crmInitials, type SugarPalette } from '../tokens'
import { BienIcon } from './BienIcon'
import {
  fmtPriceShort,
  getBuyerType,
  getEngagement,
  mColor,
  matchKey,
  tabOfGroup,
  // AI_NOTES import removed alongside the "Note IA" panel — see line ~864.
  type MatchGroup,
} from './helpers'
import {
  MBienStatusPill,
  MKycChip,
  MStatusDot,
} from './MatchingPills'

interface ScheduledVisit {
  buyerId: string
  bienId: string
  dayIso: string
  slot: string
  duration: number
  notes: string
}

// ─── Avatar plat avec halo doux optionnel ────────────────────────────────
interface MAvatarProps {
  contact: CrmContact
  size?: number
  halo?: boolean
  sp: SugarPalette
}

export function MAvatar({ contact, size = 44, halo = false, sp }: MAvatarProps) {
  const bg = contact.avatarBg || '#0041D9'
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: bg,
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.max(11, size * 0.34),
        fontWeight: 700,
        flexShrink: 0,
        boxShadow: halo
          ? `0 0 0 4px ${bg}22`
          : '0 2px 6px rgba(0,0,0,0.15)',
        border: halo ? `2px solid ${sp.avatarBorder}` : 'none',
        boxSizing: 'border-box',
      }}
    >
      {crmInitials(`${contact.firstName} ${contact.lastName}`)}
    </div>
  )
}

// ─── Pilule de critère éditable inline ───────────────────────────────────
// Click → input, Enter commit, Esc annule.
interface MCriteriaPillProps {
  label: string
  value: string
  suffix?: string
  onChange: (v: string) => void
  sp: SugarPalette
  editing: boolean
  onEdit: (field: string | null) => void
}

export function MCriteriaPill({
  label,
  value,
  suffix,
  onChange,
  sp,
  editing,
  onEdit,
}: MCriteriaPillProps) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (editing && ref.current) {
      ref.current.focus()
      ref.current.select()
    }
  }, [editing])

  const commit = (v: string) => {
    onChange(v)
    onEdit(null)
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        flex: '1 1 150px',
        minWidth: 130,
      }}
    >
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 800,
          color: sp.sub,
          letterSpacing: 0.7,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      {editing ? (
        <input
          ref={ref}
          defaultValue={value}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commit((e.target as HTMLInputElement).value)
            if (e.key === 'Escape') onEdit(null)
          }}
          style={{
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            border: 0,
            background: sp.cardBg,
            color: sp.ink,
            fontFamily: 'inherit',
            fontSize: 13.5,
            fontWeight: 600,
            outline: 'none',
            boxShadow: `0 0 0 2px ${sp.ink}, 0 4px 12px rgba(15,23,42,0.06)`,
            width: '100%',
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <button
          onClick={() => onEdit(label)}
          style={{
            height: 36,
            padding: '0 12px',
            borderRadius: 10,
            border: 0,
            background: sp.cardSubBg,
            color: sp.ink,
            fontFamily: 'inherit',
            fontSize: 13.5,
            fontWeight: 600,
            cursor: 'text',
            textAlign: 'left',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'box-shadow .15s ease',
            boxShadow: 'inset 0 0 0 1px transparent',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.boxShadow = `inset 0 0 0 1px ${sp.cardBorder}`
          }}
          onMouseLeave={e => {
            e.currentTarget.style.boxShadow = 'inset 0 0 0 1px transparent'
          }}
        >
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value || '—'}
            {suffix && (
              <span
                style={{
                  color: sp.sub,
                  fontSize: 11,
                  fontWeight: 500,
                  marginLeft: 4,
                }}
              >
                {suffix}
              </span>
            )}
          </span>
          <svg
            width={11}
            height={11}
            viewBox="0 0 24 24"
            fill="none"
            stroke={sp.sub}
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.5 }}
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
        </button>
      )}
    </div>
  )
}

// ─── Hero card pour le top match — fond ink (s'inverse en dark) ──────────
type BienStatus = 'scheduled' | 'sent' | 'liked' | 'viewed' | null

interface MBienHeroProps {
  match: CrmMatch
  sp: SugarPalette
  dark: boolean
  bienStatus: BienStatus
  reasons: string[] | undefined
  onOpen?: (bienId: string) => void
}

export function MBienHero({
  match,
  sp,
  dark,
  bienStatus,
  reasons,
  onOpen,
}: MBienHeroProps) {
  const b = crmBienById(match.bienId)
  const [hov, setHov] = useState(false)
  if (!b) return null

  const heroBg = sp.ink
  const heroText = sp.pageBg
  // Dark : hero inversé (fond blanc) → labels foncés à 0.70 pour passer WCAG AA.
  // Light : labels blancs sur ink noir → 0.55 suffit pour le contraste.
  const heroSub = dark ? 'rgba(11,12,14,0.70)' : 'rgba(255,255,255,0.55)'
  const heroMid = dark ? 'rgba(11,12,14,0.78)' : 'rgba(255,255,255,0.65)'
  const heroIconBg = dark ? 'rgba(11,12,14,0.10)' : 'rgba(255,255,255,0.08)'
  const heroChipBg = dark ? 'rgba(11,12,14,0.08)' : 'rgba(255,255,255,0.10)'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 16,
        borderRadius: 16,
        background: heroBg,
        color: heroText,
        boxShadow: '0 10px 28px rgba(11,12,14,0.18)',
      }}
    >
      {/* Ligne principale — cliquable pour ouvrir la fiche bien */}
      <button
        onClick={() => onOpen && onOpen(b.id)}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: 0,
          margin: 0,
          border: 0,
          background: 'transparent',
          color: 'inherit',
          fontFamily: 'inherit',
          textAlign: 'left',
          cursor: onOpen ? 'pointer' : 'default',
          width: '100%',
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            background: heroIconBg,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <BienIcon bien={b} size={22} color={heroText} opacity={0.9} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 2,
            }}
          >
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: heroSub,
                letterSpacing: 0.7,
                textTransform: 'uppercase',
              }}
            >
              Top match
            </div>
            {bienStatus && <MBienStatusPill status={bienStatus} />}
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: -0.2,
              marginBottom: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                flex: 1,
                minWidth: 0,
              }}
            >
              {b.title || `${b.type} ${b.canton || ''}`}
            </span>
            {onOpen && (
              <span
                style={{
                  fontSize: 13,
                  color: heroSub,
                  fontWeight: 600,
                  opacity: hov ? 1 : 0,
                  transform: hov ? 'translateX(0)' : 'translateX(-4px)',
                  transition: 'all .18s ease',
                  flexShrink: 0,
                }}
              >
                Voir la fiche →
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: heroMid, fontWeight: 500 }}>
            {fmtPriceShort(b)} · {b.area || '—'} m² · {b.rooms || '—'} pièces
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -1.2,
            }}
          >
            {match.score}
          </div>
          <div
            style={{
              fontSize: 9,
              fontWeight: 700,
              color: heroSub,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginTop: 2,
            }}
          >
            score
          </div>
        </div>
      </button>

      {/* Raisons du score — top 4 contributeurs */}
      {reasons && reasons.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            alignItems: 'center',
            paddingTop: 10,
            borderTop: `1px solid ${heroChipBg}`,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 800,
              color: heroSub,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginRight: 4,
            }}
          >
            Pourquoi
          </span>
          {reasons.slice(0, 4).map((r, i) => (
            <span
              key={i}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 9px',
                borderRadius: 999,
                background: heroChipBg,
                color: heroText,
                whiteSpace: 'nowrap',
              }}
            >
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Mini-row pour les biens secondaires (sous le hero) ──────────────────
// Cliquable pour déplier les raisons du score en place.
interface MBienMiniRowProps {
  match: CrmMatch
  sp: SugarPalette
  bienStatus: BienStatus
  reasons: string[] | undefined
  onOpen?: (bienId: string) => void
}

export function MBienMiniRow({
  match,
  sp,
  bienStatus,
  reasons,
  onOpen,
}: MBienMiniRowProps) {
  const b = crmBienById(match.bienId)
  const [expanded, setExpanded] = useState(false)
  if (!b) return null
  const col = mColor(match.score)
  const hasReasons = !!reasons && reasons.length > 0

  return (
    <div
      style={{
        borderRadius: 12,
        background: sp.cardSubBg,
        overflow: 'hidden',
        transition: 'all .2s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          padding: 12,
          gap: 12,
        }}
      >
        {/* Zone gauche — cliquable pour ouvrir la fiche bien */}
        <button
          onClick={() => onOpen && onOpen(b.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flex: 1,
            minWidth: 0,
            padding: 0,
            border: 0,
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            textAlign: 'left',
            cursor: onOpen ? 'pointer' : 'default',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 9,
              background: sp.cardBg,
              boxShadow: '0 4px 12px rgba(15,23,42,0.04)',
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <BienIcon bien={b} size={16} color={sp.soft} opacity={0.65} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: sp.ink,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {b.title || `${b.type} ${b.canton || ''}`}
              </span>
              {bienStatus && <MBienStatusPill status={bienStatus} />}
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 1 }}>
              {fmtPriceShort(b)} · {b.area || '—'} m² · {b.rooms || '—'}p
            </div>
          </div>
        </button>

        {/* Zone droite — score + chevron pour déplier les raisons */}
        <button
          onClick={() => hasReasons && setExpanded(!expanded)}
          disabled={!hasReasons}
          title={
            hasReasons
              ? expanded
                ? 'Masquer les raisons'
                : 'Voir les raisons du score'
              : undefined
          }
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            flexShrink: 0,
            padding: '2px 4px',
            border: 0,
            background: 'transparent',
            color: 'inherit',
            fontFamily: 'inherit',
            cursor: hasReasons ? 'pointer' : 'default',
            borderRadius: 8,
          }}
        >
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              color: col,
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: -0.5,
            }}
          >
            {match.score}
          </div>
          {hasReasons && (
            <svg
              width={10}
              height={10}
              viewBox="0 0 24 24"
              fill="none"
              stroke={sp.sub}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{
                transform: expanded ? 'rotate(180deg)' : 'rotate(0)',
                transition: 'transform .2s ease',
                opacity: 0.6,
              }}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          )}
        </button>
      </div>

      {/* Raisons dépliables */}
      {expanded && hasReasons && (
        <div
          style={{
            padding: '0 12px 12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            animation: 'sugar-fade-up .25s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          {reasons!.map((r, i) => (
            <span
              key={i}
              style={{
                fontSize: 10.5,
                fontWeight: 600,
                color: sp.soft,
                padding: '3px 8px',
                borderRadius: 999,
                background: sp.cardBg,
                whiteSpace: 'nowrap',
              }}
            >
              {r}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Panneau focus droite ────────────────────────────────────────────────
interface FocusPanelProps {
  group: MatchGroup
  sp: SugarPalette
  dark: boolean
  editingField: string | null
  setEditingField: (v: string | null) => void
  critVal: (key: string, fallback: string) => string
  setCrit: (key: string, v: string) => void
  sentMatchIds: Set<string>
  scheduledVisits: ScheduledVisit[]
  onSend: () => void
  onSchedule: () => void
  onStartKyc: (buyer: CrmContact) => void
  onOpenBien: (bienId: string) => void
}

export function FocusPanel({
  group,
  sp,
  dark,
  editingField,
  setEditingField,
  critVal,
  setCrit,
  sentMatchIds,
  scheduledVisits,
  onSend,
  onSchedule,
  onStartKyc,
  onOpenBien,
}: FocusPanelProps) {
  const { buyer, matches, topScore } = group
  const tab = tabOfGroup(group)
  // aiNote derivation removed alongside the "Note IA" panel.
  const kycStatus = buyer.kyc?.status || 'none'
  const needsKyc =
    (kycStatus === 'none' || kycStatus === 'stale') && tab !== 'archived'

  // Statut bien : visite planifiée > envoyé (local) > engagement (m.status).
  const bienStatusFor = (m: CrmMatch): BienStatus => {
    if (
      scheduledVisits.some(v => v.buyerId === buyer.id && v.bienId === m.bienId)
    )
      return 'scheduled'
    if (sentMatchIds.has(matchKey(m))) return 'sent'
    if (m.status === 'liked' || m.status === 'viewed') return m.status
    if (m.status === 'sent') return 'sent'
    return null
  }

  // Critères dérivés du buyer
  const cr = buyer.criteria
  const budgetDefault = cr?.budgetMax
    ? cr.budgetMax.toLocaleString('fr-CH').replace(/,/g, "'")
    : cr?.budgetMin
    ? cr.budgetMin.toLocaleString('fr-CH').replace(/,/g, "'")
    : '—'
  const typesDefault =
    (cr?.types || []).map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(', ') ||
    '—'
  const roomsDefault = cr?.roomsMin ? `${cr.roomsMin}+` : '—'
  const surfaceDefault = cr?.areaMin ? `${cr.areaMin} m²+` : '—'
  const quartiersDefault =
    ((cr?.cities as string[] | undefined) || (cr?.cantons as string[] | undefined) || []).join(', ') ||
    '—'

  return (
    <div
      style={{
        background: sp.frameBg,
        borderRadius: 24,
        border: `1px solid ${sp.frameBorder}`,
        boxShadow: sp.shadow,
        padding: '24px 28px 20px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        animation: 'sugar-fade-up .4s cubic-bezier(.22,1,.36,1) both',
        gap: 16,
      }}
    >
      {/* Header acheteur */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <MAvatar contact={buyer} size={56} halo sp={sp} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 3,
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                color: sp.ink,
                letterSpacing: -0.5,
              }}
            >
              {buyer.firstName} {buyer.lastName}
            </h2>
            <MStatusDot status={tab} />
            <MKycChip kyc={buyer.kyc} />
          </div>
          <div style={{ fontSize: 12.5, color: sp.sub, fontWeight: 500 }}>
            {getBuyerType(buyer)} · CHF {critVal('budget', budgetDefault)} ·{' '}
            {getEngagement(matches).label}
          </div>
        </div>

        {topScore > 0 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '6px 16px',
              borderRadius: 14,
              background: sp.cardSubBg,
            }}
          >
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: sp.ink,
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: -1,
                lineHeight: 1,
              }}
            >
              {topScore}
            </div>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: sp.sub,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginTop: 3,
              }}
            >
              top match
            </div>
          </div>
        )}
      </div>

      {/* Critères éditables — sauf si archivé */}
      {tab !== 'archived' && (
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: sp.sub,
                letterSpacing: 1,
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              Critères de recherche
            </div>
            <span
              style={{
                fontSize: 11,
                color: sp.sub,
                fontStyle: 'italic',
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              Cliquez pour modifier en place
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <MCriteriaPill
              label="Budget"
              value={critVal('budget', budgetDefault)}
              suffix="CHF"
              onChange={v => setCrit('budget', v)}
              sp={sp}
              editing={editingField === 'Budget'}
              onEdit={setEditingField}
            />
            <MCriteriaPill
              label="Type"
              value={critVal('types', typesDefault)}
              onChange={v => setCrit('types', v)}
              sp={sp}
              editing={editingField === 'Type'}
              onEdit={setEditingField}
            />
            <MCriteriaPill
              label="Pièces"
              value={critVal('rooms', roomsDefault)}
              onChange={v => setCrit('rooms', v)}
              sp={sp}
              editing={editingField === 'Pièces'}
              onEdit={setEditingField}
            />
            <MCriteriaPill
              label="Surface"
              value={critVal('surface', surfaceDefault)}
              onChange={v => setCrit('surface', v)}
              sp={sp}
              editing={editingField === 'Surface'}
              onEdit={setEditingField}
            />
            <MCriteriaPill
              label="Quartiers"
              value={critVal('quartiers', quartiersDefault)}
              onChange={v => setCrit('quartiers', v)}
              sp={sp}
              editing={editingField === 'Quartiers'}
              onEdit={setEditingField}
            />
          </div>
        </div>
      )}

      {/* "Note IA" block removed — AI_NOTES was a hardcoded Record<string,
          string> keyed on demo contact IDs (c-001..c-007). Real Supabase
          contacts have UUIDs so the panel never rendered for production
          data. Real AI-generated notes (ai-copilot Edge Function tied to
          contact context) are tracked as a separate sprint. */}

      {/* Bannière KYC — visible si none / stale (CLAUDE.md : KYC requis avant offre) */}
      {needsKyc && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '11px 14px',
            borderRadius: 14,
            background: dark ? 'rgba(245,158,11,0.10)' : 'rgba(245,158,11,0.08)',
            boxShadow: 'inset 0 0 0 1px rgba(245,158,11,0.22)',
          }}
        >
          <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="#F59E0B"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <path d="M10.3 3.5 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: sp.ink,
                marginBottom: 1,
              }}
            >
              KYC requis avant l'offre
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, fontWeight: 500 }}>
              {kycStatus === 'stale'
                ? 'Vérification expirée — à re-screener avant tout engagement.'
                : "Aucune vérification d'identité enregistrée pour ce contact."}
            </div>
          </div>
          <button
            onClick={() => onStartKyc(buyer)}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 999,
              border: 0,
              background: sp.ink,
              color: sp.pageBg,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              boxShadow: '0 4px 12px rgba(11,12,14,0.18)',
            }}
          >
            Démarrer KYC
          </button>
        </div>
      )}

      {/* Biens correspondants */}
      {matches.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            minHeight: 0,
            flex: 1,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 2,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 800,
                color: sp.sub,
                letterSpacing: 1,
                textTransform: 'uppercase',
              }}
            >
              {matches.length} bien{matches.length > 1 ? 's' : ''} correspondant
              {matches.length > 1 ? 's' : ''}
            </div>
            <span style={{ fontSize: 11, color: sp.sub, fontWeight: 500 }}>
              Trié par score
            </span>
          </div>
          <MBienHero
            match={matches[0]}
            sp={sp}
            dark={dark}
            bienStatus={bienStatusFor(matches[0])}
            reasons={matches[0].reasons}
            onOpen={onOpenBien}
          />
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {matches.slice(1).map((m, i) => (
              <MBienMiniRow
                key={i}
                match={m}
                sp={sp}
                bienStatus={bienStatusFor(m)}
                reasons={m.reasons}
                onOpen={onOpenBien}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'grid',
            placeItems: 'center',
            padding: 28,
            borderRadius: 16,
            background: sp.cardSubBg,
            color: sp.sub,
            fontSize: 13,
            fontStyle: 'italic',
            textAlign: 'center',
          }}
        >
          {tab === 'archived'
            ? 'Acheteur archivé — pas de matching actif.'
            : 'Aucun bien ne correspond — affinez les critères ci-dessus.'}
        </div>
      )}

      {/* Footer actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingTop: 14,
          borderTop: `1px solid ${sp.cardBorder}`,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: sp.sub,
            fontWeight: 500,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <kbd
            style={{
              padding: '2px 7px',
              borderRadius: 5,
              background: sp.cardSubBg,
              fontSize: 10,
              fontFamily: 'ui-monospace, monospace',
              color: sp.soft,
              boxShadow: `inset 0 0 0 1px ${sp.cardBorder}`,
            }}
          >
            E
          </kbd>
          pour envoyer
        </span>
        <div style={{ flex: 1 }} />
        {tab !== 'archived' && matches.length > 0 && (
          <>
            <button
              onClick={onSchedule}
              style={{
                height: 40,
                padding: '0 18px',
                borderRadius: 999,
                border: 0,
                background: sp.cardSubBg,
                color: sp.soft,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke={sp.soft}
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="5" width="18" height="16" rx="2" />
                <path d="M3 10h18M8 3v4M16 3v4" />
              </svg>
              Planifier une visite
            </button>
            <button
              onClick={onSend}
              style={{
                height: 40,
                padding: '0 20px',
                borderRadius: 999,
                border: 0,
                background: sp.ink,
                color: sp.pageBg,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <svg
                width={14}
                height={14}
                viewBox="0 0 24 24"
                fill="none"
                stroke={sp.pageBg}
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m22 2-7 20-4-9-9-4 20-7Z" />
                <path d="M22 2 11 13" />
              </svg>
              Envoyer le dossier ({matches.length})
            </button>
          </>
        )}
      </div>
    </div>
  )
}
