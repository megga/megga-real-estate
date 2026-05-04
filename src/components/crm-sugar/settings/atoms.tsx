// MEGGA CRM Sugar v2 — Settings atoms (icon, input, textarea, switch, buttons, card)
// 1:1 port from `crm-screen-settings-sugar.jsx`.

import { useState, type ReactNode } from 'react'
import { SET_PALETTE, type SettingsIconName } from './data'

const SET = SET_PALETTE

const PATHS: Record<SettingsIconName, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  building: (
    <>
      <path d="M3 21V7l9-4 9 4v14" />
      <path d="M9 21V12h6v9" />
      <path d="M9 8h.01M15 8h.01M9 11h.01M15 11h.01" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0" />
      <circle cx="17" cy="9" r="3" />
      <path d="M22 21a5 5 0 0 0-7-4.5" />
    </>
  ),
  palette: (
    <>
      <path d="M12 22a10 10 0 1 1 0-20 8 8 0 0 1 8 8c0 4.42-3.58 4-6 4s-2 2-1 3 1 5-1 5Z" />
      <circle cx="7" cy="11" r="1" />
      <circle cx="11" cy="7" r="1" />
      <circle cx="16" cy="9" r="1" />
    </>
  ),
  bell: (
    <>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9Z" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </>
  ),
  plug: (
    <>
      <path d="M9 2v6M15 2v6" />
      <path d="M5 8h14v3a7 7 0 0 1-14 0V8Z" />
      <path d="M12 18v4" />
    </>
  ),
  card: (
    <>
      <rect x="2" y="6" width="20" height="13" rx="2" />
      <path d="M2 11h20M6 16h4" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="11" width="16" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
  sliders: (
    <>
      <path d="M4 21V14M4 10V3M12 21V12M12 8V3M20 21v-5M20 12V3" />
      <path d="M2 14h4M10 8h4M18 16h4" />
    </>
  ),
  check: <path d="m5 13 4 4 10-12" />,
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  pen: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </>
  ),
  arrowR: (
    <>
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </>
  ),
  chevR: <path d="m9 6 6 6-6 6" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
}

interface SetIconProps {
  name: SettingsIconName
  size?: number
  stroke?: string
  sw?: number
}

export function SetIcon({ name, size = 18, stroke = 'currentColor', sw = 1.6 }: SetIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name] || null}
    </svg>
  )
}

interface SetInputProps {
  label?: string
  hint?: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
}

export function SetInput({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled,
  autoFocus,
}: SetInputProps) {
  const [focus, setFocus] = useState(false)
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {label}
        </div>
      )}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          height: 48,
          padding: '0 16px',
          borderRadius: 14,
          background: focus ? '#fff' : SET.cardSubtle,
          boxShadow: focus
            ? `0 0 0 2px ${SET.black}, 0 4px 12px rgba(15,23,42,0.05)`
            : 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          opacity: disabled ? 0.55 : 1,
          transition: 'all .18s ease',
        }}
      >
        <input
          type={type}
          value={value || ''}
          autoFocus={autoFocus}
          disabled={disabled}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          style={{
            flex: 1,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 500,
            color: SET.ink,
          }}
        />
      </div>
      {hint && (
        <div style={{ marginTop: 6, fontSize: 12, color: SET.muted }}>{hint}</div>
      )}
    </label>
  )
}

interface SetTextareaProps {
  label?: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  max?: number
}

export function SetTextarea({
  label,
  hint,
  value,
  onChange,
  placeholder,
  rows = 4,
  max,
}: SetTextareaProps) {
  const [focus, setFocus] = useState(false)
  const len = (value || '').length
  return (
    <label style={{ display: 'block' }}>
      {label && (
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            marginBottom: 8,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span>{label}</span>
          {max && (
            <span style={{ color: len > max ? SET.err : SET.muted }}>
              {len}/{max}
            </span>
          )}
        </div>
      )}
      <div
        style={{
          padding: '12px 16px',
          borderRadius: 14,
          background: focus ? '#fff' : SET.cardSubtle,
          boxShadow: focus
            ? `0 0 0 2px ${SET.black}, 0 4px 12px rgba(15,23,42,0.05)`
            : 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          transition: 'all .18s ease',
        }}
      >
        <textarea
          value={value || ''}
          rows={rows}
          onChange={e => onChange(e.target.value)}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          placeholder={placeholder}
          style={{
            width: '100%',
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 14.5,
            fontWeight: 500,
            color: SET.ink,
            resize: 'vertical',
            lineHeight: 1.55,
          }}
        />
      </div>
      {hint && (
        <div style={{ marginTop: 6, fontSize: 12, color: SET.muted }}>{hint}</div>
      )}
    </label>
  )
}

interface SetBlackBtnProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  icon?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}

export function SetBlackBtn({
  children,
  onClick,
  disabled,
  loading,
  icon,
  size = 'md',
}: SetBlackBtnProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'lg' ? 50 : size === 'sm' ? 36 : 44
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: size === 'lg' ? '0 28px' : size === 'sm' ? '0 16px' : '0 22px',
        borderRadius: 999,
        border: 0,
        background: disabled || loading ? SET.ghost : hover ? SET.blackHover : SET.black,
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 14.5 : size === 'sm' ? 12.5 : 13.5,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: disabled || loading
          ? 'none'
          : hover
            ? '0 12px 30px rgba(11,12,14,0.25)'
            : '0 6px 16px rgba(11,12,14,0.18)',
        transition: 'all .18s ease',
        transform: hover && !disabled && !loading ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      {loading && (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            animation: 'setSpin .7s linear infinite',
          }}
        />
      )}
      {!loading && icon}
      {children}
    </button>
  )
}

interface SetGhostBtnProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}

export function SetGhostBtn({ children, onClick, disabled }: SetGhostBtnProps) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: 44,
        padding: '0 20px',
        borderRadius: 999,
        border: 0,
        background: hover ? SET.cardSubtle : 'transparent',
        color: SET.inkSoft,
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all .15s',
      }}
    >
      {children}
    </button>
  )
}

interface SetCardProps {
  title?: string
  sub?: string
  action?: ReactNode
  children: ReactNode
  padding?: number
}

export function SetCard({ title, sub, action, children, padding = 28 }: SetCardProps) {
  return (
    <div
      style={{
        background: SET.card,
        borderRadius: 24,
        padding,
        boxShadow: SET.shadow,
      }}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            marginBottom: 22,
          }}
        >
          <div style={{ flex: 1 }}>
            {title && (
              <h3
                style={{
                  margin: '0 0 4px',
                  fontSize: 17,
                  fontWeight: 700,
                  color: SET.ink,
                  letterSpacing: -0.3,
                }}
              >
                {title}
              </h3>
            )}
            {sub && (
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  color: SET.muted,
                  fontWeight: 500,
                  lineHeight: 1.5,
                }}
              >
                {sub}
              </p>
            )}
          </div>
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
