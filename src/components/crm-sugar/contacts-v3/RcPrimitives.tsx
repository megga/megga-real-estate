// MEGGA Contacts V3 — primitives Sugar Pure (Avatar, Pill, InlineEdit, Row, SubNav, Kpi).
// Port 1:1 de `refonte-contacts-primitives.jsx` + `refonte-contacts-primitives-2.jsx`.

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import RcIcon, { type RcIconName } from './RcIcon'
import {
  RC_PILL,
  type RcPalette,
  type RcPillTone,
} from './palette'
import { rcInitials, rcRelative, rcContextLine, type RcContact, type RcKycStatus } from './helpers'

// ─── RcAvatar ──────────────────────────────────────────────────────────
interface RcAvatarProps {
  contact: Pick<RcContact, 'firstName' | 'lastName' | 'avatarBg'>
  size?: number
  sp: RcPalette
}
export function RcAvatar({ contact, size = 40, sp }: RcAvatarProps) {
  const initials = rcInitials(`${contact.firstName} ${contact.lastName}`)
  const bg = contact.avatarBg || sp.muted
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
        letterSpacing: 0.3,
        boxShadow: `0 0 0 4px ${bg}26`,
      }}
    >
      {initials}
    </div>
  )
}

// ─── RcPill (pattern unifié CRM_PILL) ──────────────────────────────────
interface RcPillProps {
  tone?: RcPillTone
  dot?: boolean
  size?: 'sm' | 'md' | 'lg'
  children: ReactNode
}
export function RcPill({
  tone = 'neutral',
  dot = false,
  size = 'md',
  children,
}: RcPillProps) {
  const p = RC_PILL[tone] || RC_PILL.neutral
  const pad =
    size === 'sm' ? '2px 8px' : size === 'lg' ? '5px 11px' : '3px 9px'
  const fSize = size === 'sm' ? 10 : size === 'lg' ? 12 : 10.5
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: pad,
        borderRadius: 999,
        background: p.bg,
        color: p.fg,
        boxShadow: p.shadow,
        fontSize: fSize,
        fontWeight: 700,
        letterSpacing: 0.2,
        fontVariantNumeric: 'tabular-nums',
        whiteSpace: 'nowrap',
      }}
    >
      {dot && (
        <span
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            background: p.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children}
    </span>
  )
}

// ─── RcKycPill ─────────────────────────────────────────────────────────
const KYC_MAP: Record<RcKycStatus, { l: string; tone: RcPillTone }> = {
  verified: { l: 'KYC validé', tone: 'ok' },
  pending: { l: 'KYC en cours', tone: 'warn' },
  stale: { l: 'KYC à rafraîchir', tone: 'warn' },
  none: { l: 'KYC à démarrer', tone: 'neutral' },
}
export function RcKycPill({ status }: { status: RcKycStatus | undefined }) {
  const m = KYC_MAP[status ?? 'none']
  return <RcPill tone={m.tone}>{m.l}</RcPill>
}

// ─── RcInlineEdit ──────────────────────────────────────────────────────
// Pattern BdEditInput Sugar — display + crayon discret, clic → input,
// blur ou Enter = enregistre, Esc = annule.
interface RcInlineEditProps {
  value: string | number | null | undefined
  onChange?: (v: string | number) => void
  placeholder?: string
  type?: 'text' | 'number'
  prefix?: ReactNode
  suffix?: ReactNode
  style?: CSSProperties
  mono?: boolean
  block?: boolean
  sp: RcPalette
}
export function RcInlineEdit({
  value,
  onChange,
  placeholder = '—',
  type = 'text',
  suffix,
  prefix,
  style,
  mono,
  block,
  sp,
}: RcInlineEditProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<string>(
    value == null ? '' : String(value),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value == null ? '' : String(value))
  }, [value])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  const commit = () => {
    onChange?.(type === 'number' ? Number(draft) : draft)
    setEditing(false)
  }
  const cancel = () => {
    setDraft(value == null ? '' : String(value))
    setEditing(false)
  }

  const baseStyle: CSSProperties = {
    fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
    fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
    fontSize: 14,
    fontWeight: 600,
    color: sp.ink,
    letterSpacing: -0.1,
    ...style,
  }

  if (editing) {
    return (
      <div
        style={{
          display: block ? 'flex' : 'inline-flex',
          alignItems: 'baseline',
          gap: 4,
          width: block ? '100%' : 'auto',
          background: sp.cardSubtle,
          borderRadius: 10,
          padding: '4px 10px',
          boxShadow: `inset 0 0 0 2px ${sp.ink}`,
          transition: 'box-shadow .12s ease',
        }}
      >
        {prefix && (
          <span style={{ ...baseStyle, color: sp.muted, fontWeight: 500 }}>
            {prefix}
          </span>
        )}
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit()
            } else if (e.key === 'Escape') {
              e.preventDefault()
              cancel()
            }
          }}
          placeholder={placeholder}
          style={{
            background: 'transparent',
            border: 0,
            outline: 'none',
            padding: 0,
            width: block ? '100%' : 'auto',
            minWidth: 80,
            ...baseStyle,
          }}
        />
        {suffix && (
          <span style={{ ...baseStyle, color: sp.muted, fontWeight: 500 }}>
            {suffix}
          </span>
        )}
      </div>
    )
  }
  const displayValue =
    value === '' || value == null ? placeholder : String(value)
  const isPlaceholder = value === '' || value == null
  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      style={{
        display: block ? 'flex' : 'inline-flex',
        alignItems: 'baseline',
        gap: 6,
        width: block ? '100%' : 'auto',
        background: 'transparent',
        border: 0,
        padding: '4px 10px',
        borderRadius: 10,
        cursor: 'text',
        textAlign: 'left',
        margin: '-4px -10px',
        transition: 'background .12s ease',
        ...baseStyle,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = sp.cardSubtle
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'transparent'
      }}
    >
      {prefix && (
        <span style={{ ...baseStyle, color: sp.muted, fontWeight: 500 }}>
          {prefix}
        </span>
      )}
      <span
        style={{
          flex: block ? 1 : 'none',
          color: isPlaceholder ? sp.muted : baseStyle.color,
          fontWeight: isPlaceholder ? 500 : baseStyle.fontWeight,
        }}
      >
        {displayValue}
      </span>
      {suffix && (
        <span style={{ ...baseStyle, color: sp.muted, fontWeight: 500 }}>
          {suffix}
        </span>
      )}
      <RcIcon name="pencil" size={11} stroke={sp.muted} sw={1.6} />
    </button>
  )
}

// ─── RcSubNav (pills + tabs) ────────────────────────────────────────────
export interface RcSubNavItem {
  id: string
  label: string
  icon?: RcIconName
  count?: number
}
interface RcSubNavProps {
  items: RcSubNavItem[]
  value: string
  onChange: (id: string) => void
  variant?: 'pills' | 'tabs'
  size?: 'md' | 'lg'
  sp: RcPalette
}
export function RcSubNav({
  items,
  value,
  onChange,
  variant = 'pills',
  size = 'md',
  sp,
}: RcSubNavProps) {
  if (variant === 'tabs') {
    return (
      <div
        style={{
          display: 'flex',
          gap: 28,
          padding: '0 2px',
          borderBottom: `1px solid ${sp.line}`,
        }}
      >
        {items.map(it => {
          const active = it.id === value
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onChange(it.id)}
              style={{
                padding: '14px 0 16px',
                border: 0,
                background: 'transparent',
                cursor: 'pointer',
                fontFamily: 'inherit',
                color: active ? sp.ink : sp.muted,
                fontSize: 15,
                fontWeight: active ? 700 : 500,
                letterSpacing: -0.2,
                borderBottom: `2px solid ${active ? sp.ink : 'transparent'}`,
                marginBottom: -1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all .15s ease',
              }}
            >
              {it.icon && (
                <RcIcon
                  name={it.icon}
                  size={15}
                  stroke={active ? sp.ink : sp.muted}
                />
              )}
              {it.label}
              {it.count != null && (
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 7px',
                    borderRadius: 999,
                    background: active ? sp.ink : sp.cardSubtle,
                    color: active ? sp.inkInverse : sp.muted,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {it.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    )
  }
  // pills
  const h = size === 'lg' ? 44 : 38
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: sp.card,
        boxShadow: sp.shadowSm,
      }}
    >
      {items.map(it => {
        const active = it.id === value
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onChange(it.id)}
            style={{
              height: h,
              padding: '0 18px',
              borderRadius: 999,
              border: 0,
              background: active ? sp.black : 'transparent',
              color: active ? sp.inkInverse : sp.inkSoft,
              fontFamily: 'inherit',
              fontSize: size === 'lg' ? 14 : 13,
              fontWeight: active ? 700 : 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: active ? '0 6px 16px rgba(11,12,14,0.20)' : 'none',
              transition: 'all .18s ease',
              whiteSpace: 'nowrap',
            }}
          >
            {it.icon && (
              <RcIcon
                name={it.icon}
                size={14}
                stroke={active ? sp.inkInverse : sp.inkSoft}
              />
            )}
            {it.label}
            {it.count != null && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '1px 7px',
                  borderRadius: 999,
                  background: active ? sp.accentTint : sp.cardSubtle,
                  color: active ? sp.inkInverse : sp.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {it.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── RcContactRow — UNE ligne de contexte sous le nom ───────────────────
interface RcContactRowProps {
  contact: RcContact
  selected: boolean
  onClick: () => void
  sp: RcPalette
}
export function RcContactRow({
  contact,
  selected,
  onClick,
  sp,
}: RcContactRowProps) {
  const ctx = rcContextLine(contact)
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 18px',
        background: selected ? sp.cardSubtle : 'transparent',
        boxShadow: selected
          ? `inset 0 0 0 2px ${sp.ink}, ${sp.shadowSm}`
          : 'none',
        borderRadius: 16,
        border: 0,
        width: '100%',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        transition: 'all .15s ease',
      }}
      onMouseEnter={e => {
        if (!selected) e.currentTarget.style.background = sp.cardSubtle
      }}
      onMouseLeave={e => {
        if (!selected) e.currentTarget.style.background = 'transparent'
      }}
    >
      <RcAvatar contact={contact} size={42} sp={sp} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14.5,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.2,
            marginBottom: 3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {contact.firstName} {contact.lastName}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: sp.muted,
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {ctx}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: sp.muted,
          fontWeight: 500,
          flexShrink: 0,
          textAlign: 'right',
        }}
      >
        {rcRelative(contact.lastActivityAt)}
      </div>
    </button>
  )
}

// ─── RcKpi — mini-bloc KPI uniforme ────────────────────────────────────
interface RcKpiProps {
  value: ReactNode
  label: string
  mono?: boolean
  accent?: string
  sp: RcPalette
}
export function RcKpi({
  value,
  label,
  mono = true,
  accent,
  sp,
}: RcKpiProps) {
  return (
    <div
      style={{
        padding: '12px 16px',
        borderRadius: 14,
        background: sp.cardSubtle,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 140,
        flex: '1 1 140px',
      }}
    >
      <div
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: accent || sp.ink,
          letterSpacing: -0.4,
          lineHeight: 1.15,
          fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: sp.muted,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {label}
      </div>
    </div>
  )
}
