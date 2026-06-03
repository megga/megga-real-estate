// MEGGA CRM Sugar v2 — Today screen components
// 1:1 port from the Claude Design bundle (crm-screen-today-sugar.jsx).
// Includes: SugarConnector, SugarTeamChip, SugarTaskCard, SugarMiniRow,
//   SugarMiniRowCreate, SugarColumn, SugarKnowledgeTable, SugarDonut,
//   SugarPipelineStat, SugarFocusView/Card, COLUMNS_DEFS
/* eslint-disable react-refresh/only-export-components */

import {
  useState, useEffect, useRef, type ReactNode, type CSSProperties,
  type DragEvent as ReactDragEvent, type MouseEvent as ReactMouseEvent,
} from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { crmInitials, type SugarPalette } from './tokens'
import { type CrmContact, crmContactById } from './mockData'

// Local alias kept for prototype-fidelity comments — the canonical name in
// the prototype is "contact" with first/last; we keep that ergonomic call.
const initialsOf = (name: string) => crmInitials(name)

// ─── Curved connector between two anchor points ───────────────────────
// Reacts to hovered column: highlights when its source/target column is hovered.
// Coordinates are in viewBox user units — the parent <svg> must declare
// viewBox="0 0 100 100" so values map to percent-like positions.
interface SugarConnectorProps {
  x1: number; y1: number; x2: number; y2: number
  color?: string; dashed?: boolean
  fromCol?: string; toCol?: string; hoveredCol?: string | null
  accentColor?: string
}
export function SugarConnector({
  x1, y1, x2, y2, color = '#C7CFDB', dashed = true,
  fromCol, toCol, hoveredCol, accentColor,
}: SugarConnectorProps) {
  const mid = (x1 + x2) / 2
  const d = `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
  const active = hoveredCol != null && (hoveredCol === fromCol || hoveredCol === toCol)
  const dimmed = hoveredCol != null && !active
  const strokeColor = active ? (accentColor || color) : color
  const opacity = dimmed ? 0.25 : 1
  const width = active ? 2 : 1.2
  return (
    <g style={{ transition: 'opacity 220ms ease' }} opacity={opacity}>
      {active && (
        <path d={d} fill="none" stroke={strokeColor} strokeWidth="6"
          strokeLinecap="round" opacity="0.18" style={{ filter: 'blur(2px)' }} />
      )}
      <path d={d} fill="none" stroke={strokeColor} strokeWidth={width}
        strokeDasharray={dashed ? '3 4' : 'none'} strokeLinecap="round"
        style={{
          transition: 'stroke 220ms ease, stroke-width 220ms ease',
          animation: active ? 'sugar-dash-flow 1.4s linear infinite' : 'none',
        }} />
    </g>
  )
}

// ─── Team chip — avatar with optional count badge underneath ──────────
interface SugarTeamChipProps {
  contact: CrmContact
  count?: number | null
  color?: string
  offset?: number
  sp: SugarPalette
}
export function SugarTeamChip({ contact, count, color, offset = 0, sp }: SugarTeamChipProps) {
  return (
    <div style={{
      width: 42, height: 42, marginLeft: offset === 0 ? 0 : -8,
      position: 'relative',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 999, background: contact.avatarBg || '#0041D9',
        color: '#fff', display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
        border: `3px solid ${sp.avatarBorder}`, boxSizing: 'border-box',
        boxShadow: '0 2px 6px rgba(0,0,0,.18)',
      }}>{initialsOf(`${contact.firstName} ${contact.lastName}`)}</div>
      {count != null && color && (
        <div style={{
          position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
          background: color, color: '#fff', fontSize: 10, fontWeight: 700,
          padding: '1px 6px', borderRadius: 999, border: `2px solid ${sp.avatarBorder}`,
          minWidth: 18, textAlign: 'center',
        }}>{count}</div>
      )}
    </div>
  )
}

// ─── Task card — large card with avatar + actions ─────────────────────
interface SugarTaskCardProps {
  contact?: CrmContact
  label: string
  checked?: boolean
  sub?: string
  focused?: boolean
  dueLabel?: string
  sp: SugarPalette
  dark?: boolean
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void
  onCheck?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onSchedule?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  doneState?: boolean
}
export function SugarTaskCard({
  contact, label, checked = true, sub, focused = false, dueLabel,
  sp, dark = false, onClick, onCheck, onSchedule, doneState = false,
}: SugarTaskCardProps) {
  const [hover, setHover] = useState(false)
  const isDone = doneState
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: focused ? sp.focusBg : (hover ? sp.cardBg : (dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.55)')),
        color: focused ? sp.focusInk : sp.ink,
        border: focused ? '0' : `1px solid ${sp.cardBorder}`,
        borderRadius: 20,
        padding: '14px 16px',
        boxShadow: focused ? sp.focusShadow : (hover ? sp.shadow : sp.shadowSm),
        position: 'relative',
        minHeight: 88,
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 220ms cubic-bezier(.22,1,.36,1), box-shadow 220ms ease, opacity 220ms ease',
        opacity: isDone ? 0.55 : 1,
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {contact && (
          <div style={{
            width: 40, height: 40, borderRadius: 999,
            background: contact.avatarBg || '#0041D9', color: '#fff',
            display: 'grid', placeItems: 'center', fontSize: 12, fontWeight: 700,
            border: `2px solid ${sp.avatarBorder}`, boxShadow: '0 2px 6px rgba(0,0,0,.18)',
          }}>{initialsOf(`${contact.firstName} ${contact.lastName}`)}</div>
        )}
        <div style={{ display: 'flex', gap: 6 }}>
          {checked && (
            <button
              onClick={e => { e.stopPropagation(); onCheck?.(e) }}
              title={isDone ? 'Marquer à refaire' : 'Marquer exécutée'}
              style={{
                width: 24, height: 24, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
                background: isDone ? '#0E9F6E' : (focused ? sp.focusSurface : sp.cardSubBg),
                display: 'grid', placeItems: 'center',
                transition: 'background 180ms ease',
              }}>
              <MEIcon name="check" size={11} color={isDone ? '#fff' : (focused ? sp.focusInk : '#0E9F6E')} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onSchedule?.(e) }}
            title="Replanifier"
            style={{
              width: 24, height: 24, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
              background: focused ? sp.focusSurface : sp.cardSubBg,
              display: 'grid', placeItems: 'center',
              transition: 'transform 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)' }}
            onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
          >
            <MEIcon name="calendar" size={11} color={focused ? sp.focusInk : sp.soft} />
          </button>
        </div>
      </div>
      <div>
        <div style={{
          fontSize: 13.5, fontWeight: 600, lineHeight: 1.3,
          color: focused ? sp.focusInk : sp.ink,
        }}>{label}</div>
        {sub && (
          <div style={{
            fontSize: 11, marginTop: 4,
            color: focused ? 'rgba(255,255,255,.7)' : sp.sub,
          }}>{sub}</div>
        )}
        {dueLabel && (
          <div style={{
            marginTop: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
            color: focused ? 'rgba(255,255,255,.55)' : sp.sub,
          }}>{dueLabel}</div>
        )}
      </div>
    </div>
  )
}

// ─── Mini row — small row inside a column ─────────────────────────────
interface SugarMiniRowProps {
  contact?: CrmContact
  label: string
  prefix?: 'plus'
  hasMenu?: boolean
  dueColor?: string
  sp: SugarPalette
  dark?: boolean
  onClick?: (e: ReactMouseEvent<HTMLDivElement>) => void
  onSchedule?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onMenu?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  onCheck?: (e: ReactMouseEvent<HTMLButtonElement>) => void
  doneState?: boolean
}
export function SugarMiniRow({
  contact, label, prefix, hasMenu, dueColor, sp, dark = false,
  onClick, onSchedule, onMenu, doneState = false,
}: SugarMiniRowProps) {
  const [hover, setHover] = useState(false)
  const isDone = doneState
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? sp.cardBg : (dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.55)'),
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 14,
        padding: '10px 12px',
        boxShadow: hover ? sp.shadow : 'none',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease, background 200ms ease, opacity 200ms ease',
        opacity: isDone ? 0.5 : 1,
        textDecoration: isDone ? 'line-through' : 'none',
      }}>
      {prefix === 'plus' && (
        <div style={{
          width: 26, height: 26, borderRadius: 999, background: sp.cardSubBg,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <MEIcon name="plus" size={12} color={sp.soft} />
        </div>
      )}
      {contact && (
        <div style={{
          width: 28, height: 28, borderRadius: 999,
          background: contact.avatarBg || '#0041D9', color: '#fff',
          display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0,
        }}>{initialsOf(`${contact.firstName} ${contact.lastName}`)}</div>
      )}
      <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: sp.ink, lineHeight: 1.3 }}>
        {label}
      </div>
      {dueColor && (
        <span style={{ width: 6, height: 6, borderRadius: 999, background: dueColor, flexShrink: 0 }} />
      )}
      {hasMenu ? (
        <button
          onClick={e => { e.stopPropagation(); onMenu?.(e) }}
          title="Plus d'actions"
          style={{
            width: 22, height: 22, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
            background: 'transparent',
            color: sp.sub, fontSize: 14, letterSpacing: 1, lineHeight: 0.5,
            display: 'grid', placeItems: 'center', flexShrink: 0,
            fontFamily: 'inherit',
            transition: 'background 160ms ease, transform 160ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = sp.cardSubBg; e.currentTarget.style.transform = 'scale(1.08)' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.transform = 'scale(1)' }}
        >···</button>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); onSchedule?.(e) }}
          title="Replanifier"
          style={{
            width: 22, height: 22, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
            background: sp.cardSubBg,
            display: 'grid', placeItems: 'center', flexShrink: 0,
            transition: 'transform 160ms ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.12)' }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
        >
          <MEIcon name="calendar" size={10} color={sp.soft} />
        </button>
      )}
    </div>
  )
}

// ─── Mini row create — dashed row that becomes editable input ─────────
interface SugarMiniRowCreateProps {
  suggestion: string
  sp: SugarPalette
  dark?: boolean
  onCreate?: (v: string) => void
}
export function SugarMiniRowCreate({ suggestion, sp, dark = false, onCreate }: SugarMiniRowCreateProps) {
  const [editing, setEditing] = useState(false)
  const [hover, setHover] = useState(false)
  const [value, setValue] = useState('')
  const [created, setCreated] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  const submit = () => {
    const v = (value || suggestion).trim()
    if (!v) { setEditing(false); return }
    onCreate?.(v)
    setCreated(v)
    setValue('')
    setEditing(false)
    setTimeout(() => setCreated(null), 1400)
  }
  const cancel = () => { setValue(''); setEditing(false) }

  const baseStyle: CSSProperties = {
    background: editing || hover ? sp.cardBg : (dark ? 'rgba(255,255,255,.025)' : 'rgba(255,255,255,.55)'),
    border: `1px dashed ${editing ? sp.ink : sp.cardBorder}`,
    borderRadius: 14,
    padding: '10px 12px',
    display: 'flex', alignItems: 'center', gap: 10,
    cursor: editing ? 'text' : 'pointer',
    backdropFilter: 'blur(6px)',
    WebkitBackdropFilter: 'blur(6px)',
    transition: 'transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease, background 200ms ease, border-color 200ms ease',
    boxShadow: hover || editing ? sp.shadow : 'none',
    transform: hover && !editing ? 'translateY(-1px)' : 'translateY(0)',
  }

  if (created) {
    return (
      <div style={{
        ...baseStyle,
        background: 'rgba(14,159,110,0.10)',
        borderStyle: 'solid',
        borderColor: 'rgba(14,159,110,0.4)',
        animation: 'sugar-fade-up 320ms cubic-bezier(.22,1,.36,1)',
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 999, background: 'rgba(14,159,110,0.18)',
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <MEIcon name="check" size={12} color="#0E9F6E" />
        </div>
        <div style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: '#0E9F6E', lineHeight: 1.3 }}>
          Ajouté · {created}
        </div>
      </div>
    )
  }

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => !editing && setEditing(true)}
      style={baseStyle}
    >
      <div style={{
        width: 26, height: 26, borderRadius: 999,
        background: editing ? sp.ink : sp.cardSubBg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        transition: 'background 200ms ease',
      }}>
        <MEIcon name="plus" size={12} color={editing ? sp.pageBg : sp.soft} />
      </div>
      {editing ? (
        <input
          ref={inputRef}
          value={value}
          placeholder={suggestion}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); submit() }
            else if (e.key === 'Escape') { e.preventDefault(); cancel() }
          }}
          onBlur={() => { if (!value.trim()) cancel(); else submit() }}
          style={{
            flex: 1, minWidth: 0, border: 0, outline: 'none',
            background: 'transparent', fontFamily: 'inherit',
            fontSize: 12.5, fontWeight: 600, color: sp.ink, lineHeight: 1.3,
            padding: 0,
          }}
        />
      ) : (
        <div style={{
          flex: 1, fontSize: 12.5, fontWeight: 500, color: sp.sub,
          lineHeight: 1.3, fontStyle: 'italic',
        }}>
          {suggestion}
        </div>
      )}
      {editing ? (
        <button
          onMouseDown={e => { e.preventDefault(); submit() }}
          title="Créer"
          style={{
            width: 22, height: 22, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
            background: sp.ink, color: sp.pageBg,
            display: 'grid', placeItems: 'center', flexShrink: 0,
            fontFamily: 'inherit',
          }}
        >
          <MEIcon name="check" size={10} color={sp.pageBg} />
        </button>
      ) : (
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase',
          color: sp.soft, opacity: hover ? 1 : 0.6,
          transition: 'opacity 200ms ease',
        }}>Suggéré</span>
      )}
    </div>
  )
}

// ─── Column wrapper inside the journey ─────────────────────────────────
interface SugarColumnProps {
  label: string
  children: ReactNode
  sp: SugarPalette
  columnId?: string
  onDragStart?: (e: ReactDragEvent) => void
  onDragOver?: (e: ReactDragEvent) => void
  onDrop?: (e: ReactDragEvent) => void
  isDragging?: boolean
  isDragOver?: boolean
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}
export function SugarColumn({
  label, children, sp, columnId, onDragStart, onDragOver, onDrop,
  isDragging, isDragOver, onMouseEnter, onMouseLeave,
}: SugarColumnProps) {
  return (
    <div
      draggable={!!columnId}
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); if (onDragOver) onDragOver(e) }}
      onDrop={onDrop}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10, position: 'relative',
        opacity: isDragging ? 0.4 : 1,
        transform: isDragOver ? 'scale(1.02)' : 'scale(1)',
        transition: 'opacity 180ms ease, transform 220ms cubic-bezier(.22,1,.36,1)',
        cursor: columnId ? 'grab' : 'default',
      }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 4px 8px' }}>
        {children}
      </div>
      <div style={{
        textAlign: 'center', fontSize: 12, fontWeight: 600, color: sp.soft,
        letterSpacing: -0.1, marginTop: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      }}>
        {columnId && <span style={{ opacity: 0.5, fontSize: 10 }}>⋮⋮</span>}
        {label}
      </div>
    </div>
  )
}

// ─── Suggested Knowledge table ─────────────────────────────────────────
export interface KnowledgeRow {
  id: string
  fav: boolean
  subject: string
  status: 'Planifié' | 'À faire' | 'En cours' | 'Bloqué' | 'Exécuté'
  start: string
  end: string
  user: string
  contactId?: string
}

const STATUS_STYLES: Record<KnowledgeRow['status'], { color: string; bg: string }> = {
  'Planifié': { color: '#0041D9', bg: 'rgba(0,65,217,0.12)' },
  'À faire':  { color: '#E53935', bg: 'rgba(229,57,53,0.10)' },
  'En cours': { color: '#F59E0B', bg: 'rgba(245,158,11,0.16)' },
  'Bloqué':   { color: '#E53935', bg: 'rgba(229,57,53,0.10)' },
  'Exécuté':  { color: '#0E9F6E', bg: 'rgba(14,159,110,0.12)' },
}

const INITIAL_KNOWLEDGE: KnowledgeRow[] = [
  { id: 'k1', fav: true,  subject: 'Visite Carouge — Marie Bertrand',         status: 'Planifié', start: '2026-05-01 14:00', end: '2026-05-01 14:45', user: 'Gregory L.', contactId: 'c-001' },
  { id: 'k2', fav: false, subject: 'Relance Pierre Vionnet (3 nouv. matchs)', status: 'À faire',  start: '2026-05-01 09:30', end: '2026-05-01 10:00', user: 'Gregory L.' },
  { id: 'k3', fav: true,  subject: 'KYC Élodie Schmidt',                       status: 'En cours', start: '2026-05-01 11:00', end: '2026-05-01 11:30', user: 'Sophie M.',  contactId: 'c-003' },
  { id: 'k4', fav: false, subject: 'Suivi offre Antoine Picard — Cologny',     status: 'Bloqué',   start: '2026-04-30 18:00', end: '2026-05-02 18:00', user: 'Gregory L.', contactId: 'c-007' },
  { id: 'k5', fav: false, subject: 'Premier appel Catherine Loreau',           status: 'Exécuté',  start: '2026-04-30 15:00', end: '2026-04-30 15:20', user: 'Gregory L.', contactId: 'c-006' },
]

interface SugarKnowledgeTableProps {
  sp: SugarPalette
  onOpenStatus: (e: ReactMouseEvent<HTMLButtonElement>, rowId: string, currentStatus: KnowledgeRow['status'], applyStatus: (s: KnowledgeRow['status']) => void) => void
  onOpenRow?: (r: KnowledgeRow) => void
  flashToast?: (msg: string) => void
}
export function SugarKnowledgeTable({ sp, onOpenStatus, onOpenRow, flashToast }: SugarKnowledgeTableProps) {
  const [rows, setRows] = useState<KnowledgeRow[]>(INITIAL_KNOWLEDGE)
  const [hoverId, setHoverId] = useState<string | null>(null)

  const toggleFav = (id: string) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, fav: !r.fav } : r))
    const r = rows.find(x => x.id === id)
    if (r && flashToast) flashToast(r.fav ? `Retiré des favoris — ${r.subject}` : `Ajouté aux favoris — ${r.subject}`)
  }
  const setStatus = (id: string, status: KnowledgeRow['status']) => {
    setRows(rs => rs.map(r => r.id === id ? { ...r, status } : r))
    if (flashToast) flashToast(`Statut → ${status}`)
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        display: 'grid', gridTemplateColumns: '30px 2.5fr 1fr 1.2fr 1.2fr 1.2fr',
        padding: '10px 16px', fontSize: 11, fontWeight: 600, color: sp.sub,
        borderBottom: `1px solid ${sp.cardBorder}`,
      }}>
        <span></span>
        <span>Subject</span>
        <span>Status</span>
        <span>Start Date</span>
        <span>End Date</span>
        <span>Assigned User</span>
      </div>
      {rows.map((r, i) => {
        const style = STATUS_STYLES[r.status]
        const isHover = hoverId === r.id
        return (
          <div key={r.id}
            onMouseEnter={() => setHoverId(r.id)}
            onMouseLeave={() => setHoverId(null)}
            onClick={() => onOpenRow?.(r)}
            style={{
              display: 'grid', gridTemplateColumns: '30px 2.5fr 1fr 1.2fr 1.2fr 1.2fr',
              padding: '12px 16px', alignItems: 'center',
              borderBottom: i < rows.length - 1 ? `1px solid ${sp.cardBorder}` : 0,
              fontSize: 12.5,
              cursor: 'pointer',
              background: isHover ? sp.cardSubBg : 'transparent',
              transition: 'background 160ms ease',
            }}>
            <button
              onClick={e => { e.stopPropagation(); toggleFav(r.id) }}
              title={r.fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}
              style={{
                width: 24, height: 24, borderRadius: 999, border: 0, padding: 0, cursor: 'pointer',
                background: 'transparent',
                display: 'grid', placeItems: 'center',
                transition: 'transform 160ms ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.18)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
            >
              <MEIcon name="star" size={13} color={r.fav ? '#F59E0B' : sp.sub} fill={r.fav ? '#F59E0B' : 'none'} strokeWidth={1.4} />
            </button>
            <span style={{ color: sp.ink, fontWeight: 500 }}>{r.subject}</span>
            <span>
              <button
                onClick={e => { e.stopPropagation(); onOpenStatus(e, r.id, r.status, s => setStatus(r.id, s)) }}
                title="Changer le statut"
                style={{
                  padding: '3px 10px', borderRadius: 999, fontSize: 10.5, fontWeight: 700,
                  background: style.bg, color: style.color,
                  border: 0, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  transition: 'transform 160ms ease, box-shadow 160ms ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = sp.shadowSm }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {r.status}
                <span style={{ fontSize: 8, opacity: 0.7, marginTop: -1 }}>▾</span>
              </button>
            </span>
            <span style={{ color: sp.soft, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>{r.start}</span>
            <span style={{ color: sp.soft, fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>{r.end}</span>
            <span style={{ color: sp.ink }}>{r.user}</span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Donut for Pipeline Snapshot ───────────────────────────────────────
interface SugarDonutProps {
  value: number
  total: number
  color: string
  bg: string
  label: string
  sp: SugarPalette
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
}
export function SugarDonut({ value, total, color, bg, label, sp, onClick }: SugarDonutProps) {
  const r = 60
  const c = 2 * Math.PI * r
  const off = c * (1 - value / total)
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative', width: 140, height: 140,
        border: 0, padding: 0, background: 'transparent',
        cursor: onClick ? 'pointer' : 'default',
        borderRadius: 999,
        transform: hover && onClick ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
        transition: 'transform 220ms cubic-bezier(.22,1,.36,1), filter 220ms ease',
        filter: hover && onClick ? 'drop-shadow(0 6px 16px rgba(0,0,0,0.12))' : 'none',
        fontFamily: 'inherit',
      }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} stroke={bg} strokeWidth="14" fill="none" />
        <circle cx="70" cy="70" r={r} stroke={color} strokeWidth="14" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          transform="rotate(-90 70 70)" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 26, fontWeight: 800, color: sp.ink, letterSpacing: -0.6, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
          <div style={{ fontSize: 11, fontWeight: 600, color: sp.sub, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2 }}>{label}</div>
        </div>
      </div>
    </button>
  )
}

// ─── Pipeline stat (CHF / +N / risk) — clickable, drill-down ─────────
interface SugarPipelineStatProps {
  sp: SugarPalette
  value: string
  valueColor: string
  label: string
  onClick?: (e: ReactMouseEvent<HTMLButtonElement>) => void
}
export function SugarPipelineStat({ sp, value, valueColor, label, onClick }: SugarPipelineStatProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        textAlign: 'center', border: 0, background: hover ? sp.cardSubBg : 'transparent',
        cursor: 'pointer', fontFamily: 'inherit',
        padding: '8px 14px', borderRadius: 14,
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'background 200ms ease, transform 200ms cubic-bezier(.22,1,.36,1)',
      }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: valueColor }}>{value}</div>
      <div style={{ marginTop: 2, fontSize: 11.5, color: sp.sub }}>{label}</div>
    </button>
  )
}

// ─── Focus mode view — 3 priority cards ───────────────────────────────
interface FocusPriority {
  contact: CrmContact
  kind: string
  kindColor: string
  kindBg: string
  title: string
  sub: string
  due: string
  cta: string
  ctaIcon: MEIconName
}

function SugarFocusCard({ sp, index, priority: p, onContactClick }: {
  sp: SugarPalette
  index: number
  priority: FocusPriority
  onContactClick?: (c: CrmContact) => void
}) {
  const [hover, setHover] = useState(false)
  const isPrimary = index === 0
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isPrimary ? sp.focusBg : sp.frameBg,
        color: isPrimary ? sp.focusInk : sp.ink,
        border: isPrimary ? '0' : `1px solid ${sp.frameBorder}`,
        borderRadius: 24,
        padding: '24px 28px',
        boxShadow: isPrimary ? sp.focusShadow : (hover ? (sp.shadowHover || sp.shadow) : sp.shadow),
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 240ms cubic-bezier(.22,1,.36,1), box-shadow 240ms ease',
        animation: `sugar-fade-up 480ms cubic-bezier(.22,1,.36,1) ${index * 90}ms backwards`,
        display: 'flex', alignItems: 'center', gap: 22,
      }}>
      <div style={{
        width: 44, height: 44, borderRadius: 999,
        background: isPrimary ? 'rgba(255,255,255,0.18)' : sp.cardSubBg,
        display: 'grid', placeItems: 'center', flexShrink: 0,
        fontSize: 18, fontWeight: 800,
        color: isPrimary ? sp.focusInk : sp.ink,
      }}>{index + 1}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{
            padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
            letterSpacing: 0.4, textTransform: 'uppercase',
            background: isPrimary ? 'rgba(255,255,255,0.18)' : p.kindBg,
            color: isPrimary ? sp.focusInk : p.kindColor,
          }}>{p.kind}</span>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: isPrimary ? 'rgba(255,255,255,0.7)' : sp.sub,
          }}>· {p.due}</span>
        </div>
        <div style={{
          fontSize: 17, fontWeight: 700, lineHeight: 1.3, marginBottom: 4,
          color: isPrimary ? sp.focusInk : sp.ink,
        }}>{p.title}</div>
        <div style={{
          fontSize: 12.5, lineHeight: 1.4,
          color: isPrimary ? 'rgba(255,255,255,0.72)' : sp.sub,
        }}>{p.sub}</div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        {p.contact && (
          <div
            onClick={e => { e.stopPropagation(); onContactClick?.(p.contact) }}
            style={{
              width: 44, height: 44, borderRadius: 999,
              background: p.contact.avatarBg || '#0041D9', color: '#fff',
              display: 'grid', placeItems: 'center', fontSize: 13, fontWeight: 700,
              border: `2px solid ${isPrimary ? 'rgba(255,255,255,0.3)' : sp.avatarBorder}`,
              boxShadow: '0 2px 6px rgba(0,0,0,.18)', cursor: 'pointer',
            }}>{initialsOf(`${p.contact.firstName} ${p.contact.lastName}`)}</div>
        )}
        <button style={{
          height: 44, padding: '0 18px', borderRadius: 14, border: 0, cursor: 'pointer',
          background: isPrimary ? '#FFFFFF' : sp.ink,
          color: isPrimary ? sp.focusBg : sp.pageBg,
          fontFamily: 'inherit', fontWeight: 700, fontSize: 13,
          boxShadow: '0 4px 12px rgba(0,0,0,.18)',
          display: 'flex', alignItems: 'center', gap: 8,
          whiteSpace: 'nowrap',
        }}>
          <MEIcon name={p.ctaIcon} size={14} color={isPrimary ? sp.focusBg : sp.pageBg} />
          {p.cta}
        </button>
      </div>
    </div>
  )
}

export function SugarFocusView({ sp, contacts, onContactClick }: {
  sp: SugarPalette
  contacts: CrmContact[]
  onContactClick?: (c: CrmContact) => void
}) {
  const priorities: FocusPriority[] = [
    {
      contact: contacts[0],
      kind: 'Relance',
      kindColor: '#0041D9', kindBg: 'rgba(0,65,217,0.10)',
      title: 'Recontacter Marie Bertrand',
      sub: 'Suite visite Carouge — opportunité tiède à confirmer',
      due: '10:00',
      cta: 'Appeler maintenant',
      ctaIcon: 'phone',
    },
    {
      contact: contacts[1],
      kind: 'Mandat',
      kindColor: '#B45309', kindBg: 'rgba(245,158,11,0.16)',
      title: 'Confirmer mandat exclusif',
      sub: 'Jean-Marc Aebischer · CHF 1.4M · décision attendue',
      due: '11:30',
      cta: 'Préparer le mandat',
      ctaIcon: 'file',
    },
    {
      contact: contacts[2],
      kind: 'KYC',
      kindColor: '#0E9F6E', kindBg: 'rgba(14,159,110,0.12)',
      title: 'Lancer dossier KYC Élodie Schmidt',
      sub: 'Acheteuse qualifiée · score 92 · CHF 850k',
      due: "Aujourd'hui",
      cta: 'Démarrer le KYC',
      ctaIcon: 'shield',
    },
  ]

  return (
    <div style={{
      maxWidth: 760, margin: '0 auto', padding: '20px 0 60px',
      animation: 'sugar-fade-up 480ms cubic-bezier(.22,1,.36,1)',
    }}>
      <div style={{ marginBottom: 32, textAlign: 'center' }}>
        <h2 style={{
          margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.8,
          color: sp.ink, lineHeight: 1.15,
        }}>
          3 priorités absolues pour aujourd'hui
        </h2>
        <p style={{ margin: '10px 0 0', fontSize: 14, color: sp.sub, lineHeight: 1.5 }}>
          Tout le reste peut attendre. Respire, fais ces trois choses bien.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {priorities.map((p, i) => (
          <SugarFocusCard key={i} sp={sp} index={i} priority={p} onContactClick={onContactClick} />
        ))}
      </div>
    </div>
  )
}

// ─── Columns definitions for the journey ──────────────────────────────
// `ctx` provides the contact lookups + popover openers + done-state helpers.
export interface ColumnRenderCtx {
  sp: SugarPalette
  dark: boolean
  c001: CrmContact
  c002: CrmContact
  c003: CrmContact
  c004: CrmContact
  c005: CrmContact
  c006: CrmContact
  c007: CrmContact
  c008: CrmContact
  setDetailContact: (c: CrmContact) => void
  openSchedule: (e: ReactMouseEvent<HTMLButtonElement>, taskId: string, label: string) => void
  openMenu: (e: ReactMouseEvent<HTMLButtonElement>, taskId: string, label: string) => void
  openAILeads: (e: ReactMouseEvent<HTMLDivElement>) => void
  toggleDone: (id: string) => void
  doneSet: Set<string>
  flashToast: (msg: string) => void
}

export type ColumnId = 'relances' | 'qualif' | 'offres' | 'comm'

export const COLUMNS_DEFS: Record<ColumnId, { label: string; render: (ctx: ColumnRenderCtx) => ReactNode }> = {
  relances: {
    label: 'Relances',
    render: ({ sp, dark, c001, c004, setDetailContact, openSchedule, toggleDone, doneSet }) => (<>
      <SugarTaskCard sp={sp} dark={dark} contact={c001} label="Recontacter Marie Bertrand" sub="Suite visite Carouge" dueLabel="10:00"
        doneState={doneSet.has('r1')}
        onClick={() => setDetailContact(c001)}
        onCheck={() => toggleDone('r1')}
        onSchedule={e => openSchedule(e, 'r1', 'Recontacter Marie Bertrand · 10:00')} />
      <SugarTaskCard sp={sp} dark={dark} contact={c004} label="Confirmer mandat exclusif" sub="Jean-Marc Aebischer" dueLabel="11:30"
        doneState={doneSet.has('r2')}
        onClick={() => setDetailContact(c004)}
        onCheck={() => toggleDone('r2')}
        onSchedule={e => openSchedule(e, 'r2', 'Mandat Aebischer · 11:30')} />
    </>),
  },
  qualif: {
    label: 'Qualification & Match',
    render: ({ sp, dark, c001, c002, c003, c006, c008, setDetailContact, openSchedule, openMenu, doneSet }) => (<>
      <SugarMiniRow sp={sp} dark={dark} contact={c003} label="KYC Élodie Schmidt" doneState={doneSet.has('q1')}
        onClick={() => setDetailContact(c003)}
        onSchedule={e => openSchedule(e, 'q1', 'KYC Élodie Schmidt')} />
      <SugarMiniRow sp={sp} dark={dark} contact={c002} label="Envoyer 3 nouveaux matchs" dueColor="#E53935" doneState={doneSet.has('q2')}
        onClick={() => setDetailContact(c002)}
        onSchedule={e => openSchedule(e, 'q2', '3 nouveaux matchs')} />
      <SugarMiniRow sp={sp} dark={dark} contact={c008} label="1er appel Linda Okafor" doneState={doneSet.has('q3')}
        onClick={() => setDetailContact(c008)}
        onSchedule={e => openSchedule(e, 'q3', '1er appel Linda Okafor')} />
      <SugarMiniRow sp={sp} dark={dark} contact={c001} label="Préparer dossier 2e visite" hasMenu
        onClick={() => setDetailContact(c001)}
        onMenu={e => openMenu(e, 'q4', 'Préparer dossier 2e visite — Marie Bertrand')} />
      <SugarMiniRow sp={sp} dark={dark} contact={c006} label="1er contact Catherine Loreau" hasMenu
        onClick={() => setDetailContact(c006)}
        onMenu={e => openMenu(e, 'q5', '1er contact Catherine Loreau')} />
    </>),
  },
  offres: {
    label: 'Offres & Signature',
    render: ({ sp, dark, c005, c007, setDetailContact, openSchedule, toggleDone, doneSet, flashToast }) => (<>
      <SugarMiniRowCreate sp={sp} dark={dark} suggestion="Vérifier dépendances offre Picard" onCreate={v => flashToast(`Tâche créée — ${v}`)} />
      <SugarMiniRowCreate sp={sp} dark={dark} suggestion="Identifier prochaine étape Cologny" onCreate={v => flashToast(`Tâche créée — ${v}`)} />
      <SugarTaskCard sp={sp} dark={dark} contact={c007} label="Estimer délai signature" sub="Antoine Picard · CHF 3.85M" dueLabel="14:00"
        doneState={doneSet.has('o1')}
        onClick={() => setDetailContact(c007)}
        onCheck={() => toggleDone('o1')}
        onSchedule={e => openSchedule(e, 'o1', 'Délai signature Picard · 14:00')} />
      <SugarMiniRow sp={sp} dark={dark} contact={c005} label="Préparer bon de visite Pâquis" doneState={doneSet.has('o2')}
        onClick={() => setDetailContact(c005)}
        onSchedule={e => openSchedule(e, 'o2', 'Bon de visite Pâquis')} />
      <SugarMiniRowCreate sp={sp} dark={dark} suggestion="Bouclage offre Eaux-Vives" onCreate={v => flashToast(`Tâche créée — ${v}`)} />
    </>),
  },
  comm: {
    label: 'Communication client',
    render: ({ sp, dark, flashToast, openAILeads }) => (<>
      <SugarTaskCard sp={sp} dark={dark} label="Demande de traitement" sub="MEGGA AI · 4 leads en attente" focused
        onClick={e => openAILeads(e)} />
      <SugarMiniRowCreate sp={sp} dark={dark} suggestion="Résolution de conflit (vendeur)" onCreate={v => flashToast(`Tâche créée — ${v}`)} />
      <SugarMiniRowCreate sp={sp} dark={dark} suggestion="Notifier client visite" onCreate={v => flashToast(`Tâche créée — ${v}`)} />
      <SugarMiniRowCreate sp={sp} dark={dark} suggestion="Sondage satisfaction" onCreate={v => flashToast(`Tâche créée — ${v}`)} />
    </>),
  },
}

// Re-export contact lookup helper for convenience
export { crmContactById }
export type { CrmContact }
