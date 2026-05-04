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
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </>
  ),
  sms: (
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z" />
  ),
  app: (
    <>
      <rect x="5" y="2" width="14" height="20" rx="3" />
      <path d="M11 18h2" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79Z" />,
  keyboard: (
    <>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M6 14h.01M10 14h.01M14 14h.01M18 14h.01" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18Z" />
    </>
  ),
  sparkle: (
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m10.85 12.15 7.85-7.85" />
      <path d="M14.5 8.5l3 3" />
      <path d="M16 6l3 3" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M2 2l20 20" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  alert: (
    <>
      <path d="M10.3 3.5 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.5a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  doc: (
    <>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <path d="M14 3v6h6M9 13h6M9 17h4" />
    </>
  ),
  trash: (
    <>
      <path d="M3 6h18M19 6l-1.5 14a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  receipt: (
    <>
      <path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 3 2V2L17 4l-3-2-3 2-3-2L5 4 4 2Z" />
      <path d="M8 8h8M8 12h8M8 16h5" />
    </>
  ),
  mailSend: (
    <>
      <path d="M22 11V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9" />
      <path d="m2 7 10 6 10-6" />
      <path d="M16 19h6M19 16l3 3-3 3" />
    </>
  ),
  crown: (
    <path d="M2 7l5 5 5-7 5 7 5-5-2 13H4L2 7Z" />
  ),
  more: (
    <>
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
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
  value: string | number
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
  autoFocus?: boolean
  prefix?: string
  suffix?: string
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
  prefix,
  suffix,
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
          gap: prefix || suffix ? 6 : 0,
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
        {prefix && (
          <span style={{ fontSize: 14, color: SET.muted, fontWeight: 500 }}>
            {prefix}
          </span>
        )}
        <input
          type={type}
          value={value === undefined || value === null ? '' : String(value)}
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
        {suffix && (
          <span style={{ fontSize: 14, color: SET.muted, fontWeight: 500 }}>
            {suffix}
          </span>
        )}
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
  icon?: ReactNode
  size?: 'sm' | 'md'
  danger?: boolean
}

export function SetGhostBtn({
  children,
  onClick,
  disabled,
  icon,
  size = 'md',
  danger,
}: SetGhostBtnProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'sm' ? 36 : 44
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: size === 'sm' ? '0 14px' : '0 20px',
        borderRadius: 999,
        border: 0,
        background: hover
          ? danger
            ? `${SET.bad}14`
            : SET.cardSubtle
          : 'transparent',
        color: danger ? SET.bad : SET.inkSoft,
        fontFamily: 'inherit',
        fontSize: size === 'sm' ? 12.5 : 13.5,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        transition: 'all .15s',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

interface ToggleRowProps {
  label: string
  desc?: string
  value: boolean
  onChange: (v: boolean) => void
  emphasis?: boolean
}

export function ToggleRow({ label, desc, value, onChange, emphasis }: ToggleRowProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: emphasis ? '14px 16px' : 0,
        borderRadius: emphasis ? 14 : 0,
        background: emphasis ? SET.cardSubtle : 'transparent',
        boxShadow: emphasis ? 'inset 0 0 0 1px rgba(15,23,42,0.04)' : 'none',
      }}
    >
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.1,
          }}
        >
          {label}
        </div>
        {desc && (
          <div
            style={{
              fontSize: 12.5,
              color: SET.muted,
              fontWeight: 500,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {desc}
          </div>
        )}
      </div>
      <SetSwitch value={value} onChange={onChange} />
    </div>
  )
}

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}

export function Modal({ title, children, onClose, wide }: ModalProps) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(11,12,14,0.40)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 20,
        animation: 'setFadeUp .2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card,
          borderRadius: 24,
          padding: 28,
          width: wide ? 720 : 480,
          maxWidth: '100%',
          boxShadow: '0 40px 100px rgba(11,12,14,0.30)',
          maxHeight: '86vh',
          overflowY: 'auto',
          animation: 'setSlideUp .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {title && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 16,
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                flex: 1,
                margin: 0,
                fontSize: 20,
                fontWeight: 700,
                color: SET.ink,
                letterSpacing: -0.4,
              }}
            >
              {title}
            </h3>
            <button
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                border: 0,
                borderRadius: 999,
                background: SET.cardSubtle,
                color: SET.inkSoft,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <SetIcon name="x" size={14} stroke={SET.inkSoft} sw={2.4} />
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  title: string
  desc: string
  danger?: string
  confirm?: string
  onCancel: () => void
  onConfirm: () => void
  icon?: SettingsIconName
  tone?: 'bad' | 'ok' | 'warn'
}

export function ConfirmModal({
  title,
  desc,
  danger,
  confirm,
  onCancel,
  onConfirm,
  icon = 'alert',
  tone = 'bad',
}: ConfirmModalProps) {
  const toneMap = { bad: SET.bad, ok: SET.ok, warn: SET.warn }
  const c = toneMap[tone]
  return (
    <Modal title="" onClose={onCancel}>
      <div style={{ display: 'flex', gap: 16, marginTop: -6, marginBottom: 8 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 14,
            background: `${c}18`,
            color: c,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SetIcon name={icon} size={22} stroke={c} sw={2} />
        </div>
        <div style={{ flex: 1 }}>
          <h3
            style={{
              margin: '4px 0 8px',
              fontSize: 18,
              fontWeight: 700,
              color: SET.ink,
              letterSpacing: -0.3,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13.5,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            {desc}
          </p>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 10,
          marginTop: 22,
        }}
      >
        <SetGhostBtn onClick={onCancel}>Annuler</SetGhostBtn>
        {danger ? (
          <button
            onClick={onConfirm}
            style={{
              height: 44,
              padding: '0 22px',
              border: 0,
              borderRadius: 999,
              background: SET.bad,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 13.5,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(220,38,38,0.30)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {danger}
          </button>
        ) : (
          <SetBlackBtn onClick={onConfirm}>{confirm}</SetBlackBtn>
        )}
      </div>
    </Modal>
  )
}

interface SetSwitchProps {
  value: boolean
  onChange: (v: boolean) => void
  size?: 'sm' | 'md'
}

export function SetSwitch({ value, onChange, size = 'md' }: SetSwitchProps) {
  const w = size === 'sm' ? 36 : 44
  const h = size === 'sm' ? 22 : 26
  const t = size === 'sm' ? 16 : 20
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: w,
        height: h,
        borderRadius: 999,
        border: 0,
        background: value ? SET.black : SET.ghost,
        position: 'relative',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'background .2s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: (h - t) / 2,
          left: value ? w - t - (h - t) / 2 : (h - t) / 2,
          width: t,
          height: t,
          borderRadius: 999,
          background: '#fff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          transition: 'left .2s cubic-bezier(.2,.8,.2,1)',
        }}
      />
    </button>
  )
}

interface SectionHeaderProps {
  kicker: string
  title: string
  sub: string
}

export function SectionHeader({ kicker, title, sub }: SectionHeaderProps) {
  return (
    <div style={{ marginBottom: 4, maxWidth: 760 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        {kicker}
      </div>
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 32,
          fontWeight: 700,
          color: SET.ink,
          letterSpacing: -0.6,
          lineHeight: 1.1,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: 14.5,
          color: SET.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
        }}
      >
        {sub}
      </p>
    </div>
  )
}

interface StickySaveBarProps {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

export function StickySaveBar({ dirty, saving, onSave, onCancel }: StickySaveBarProps) {
  if (!dirty) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        background: SET.card,
        borderRadius: 999,
        padding: '8px 8px 8px 24px',
        boxShadow:
          '0 24px 60px rgba(11,12,14,0.20), 0 6px 20px rgba(11,12,14,0.10)',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        animation: 'setSlideUp .3s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <span
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: SET.inkSoft,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span
          style={{ width: 7, height: 7, borderRadius: 999, background: SET.warn }}
        />
        Modifications non enregistrées
      </span>
      <SetGhostBtn onClick={onCancel}>Annuler</SetGhostBtn>
      <SetBlackBtn
        onClick={onSave}
        loading={saving}
        icon={!saving && <SetIcon name="check" size={14} stroke="#fff" sw={2.4} />}
      >
        {saving ? 'Enregistrement…' : 'Enregistrer'}
      </SetBlackBtn>
    </div>
  )
}

interface ToastProps {
  open: boolean
  label: string
}

export function Toast({ open, label }: ToastProps) {
  if (!open) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 101,
        background: SET.black,
        color: '#fff',
        borderRadius: 999,
        padding: '12px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: '0 24px 60px rgba(11,12,14,0.30)',
        fontSize: 13.5,
        fontWeight: 600,
        animation: 'setSlideUp .3s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          background: SET.ok,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SetIcon name="check" size={12} stroke="#fff" sw={3} />
      </span>
      {label}
    </div>
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
