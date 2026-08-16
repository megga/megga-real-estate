// MEGGA CRM Sugar v2 — Settings atoms (icon, input, textarea, switch, buttons, card)
// 1:1 port from `crm-screen-settings-sugar.jsx`.

import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { useState, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { SET_PALETTE, type SettingsIconName } from './data'

// iOS-style tap feedback: scale 0.96 + snappy spring. Shared by SetBlackBtn
// and SetGhostBtn — Gregory clicks "Sauvegarder" / "Annuler" / "Confirmer"
// dozens of times per day, and the tap response is what makes a productivity
// tool feel native vs. web-y.
const TAP_SPRING = { type: 'spring' as const, stiffness: 480, damping: 28, mass: 0.6 }

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
      <circle cx="7" cy="14" r="4" />
      <path d="m21 2-9.5 9.5" />
      <path d="M15 8l3 3" />
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
      <path d="M22 2 11 13" />
      <path d="M22 2 15 22l-4-9-9-4 20-7Z" />
    </>
  ),
  crown: <path d="M2 19h20l-2-12-5 4-5-7-5 7-5-4-2 12Z" />,
  more: (
    <>
      <circle cx="5" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="19" cy="12" r="1.5" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.72" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.72" />
    </>
  ),
  external: (
    <>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
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
            fontSize: 'var(--crm-text-lg)',
            fontWeight: 400,
            color: SET.muted,
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
          padding: '0 var(--crm-space-3xl)',
          borderRadius: 'var(--crm-radius-xl)',
          background: focus ? SET.inputFocusBg : SET.cardSubtle,
          boxShadow: focus
            ? `0 0 0 2px ${SET.black}, 0 4px 12px ${sgVoileEncre(false, 0.05)}`
            : `inset 0 0 0 1px ${sgVoileEncre(false, 0.04)}`,
          opacity: disabled ? 0.55 : 1,
          transition: 'all .18s ease',
        }}
      >
        {prefix && (
          <span
            style={{
              fontSize: 'var(--crm-text-xl)',
              color: SET.muted,
              fontWeight: 500,
              marginRight: 8,
            }}
          >
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
            fontSize: 'var(--crm-text-xl)',
            fontWeight: 500,
            color: SET.ink,
          }}
        />
        {suffix && (
          <span
            style={{
              fontSize: 'var(--crm-text-lg)',
              color: SET.muted,
              fontWeight: 500,
              marginLeft: 8,
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <div style={{ marginTop: 6, fontSize: 'var(--crm-text-md)', color: SET.muted }}>{hint}</div>
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
  const reducedMotion = useReducedMotion()
  const h = size === 'lg' ? 50 : size === 'sm' ? 36 : 44
  const tapDisabled = reducedMotion || disabled || loading
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={tapDisabled ? undefined : { scale: 0.96 }}
      transition={TAP_SPRING}
      style={{
        height: h,
        padding: size === 'lg' ? '0 28px' : size === 'sm' ? '0 16px' : '0 22px',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: disabled || loading ? SET.ghost : hover ? SET.blackHover : SET.black,
        color: SET.blackInk,
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 'var(--crm-text-lg)' : size === 'sm' ? 'var(--crm-text-sm)' : 'var(--crm-text-md)',
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-md)',
        boxShadow: disabled || loading
          ? 'none'
          : hover
            ? `0 12px 30px ${sgVoileEncre(false, 0.25)}`
            : `0 6px 16px ${sgVoileEncre(false, 0.18)}`,
        transition: 'all .18s ease',
        transform: hover && !disabled && !loading ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      {loading && (
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 'var(--crm-radius-pill)',
            border: `2px solid ${SET.blackInk}4d`,
            borderTopColor: SET.blackInk,
            animation: 'setSpin .7s linear infinite',
          }}
        />
      )}
      {!loading && icon}
      {children}
    </motion.button>
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
  const reducedMotion = useReducedMotion()
  const h = size === 'sm' ? 36 : 44
  return (
    <motion.button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      whileTap={reducedMotion || disabled ? undefined : { scale: 0.96 }}
      transition={TAP_SPRING}
      style={{
        height: h,
        padding: size === 'sm' ? '0 14px' : '0 20px',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: hover
          ? danger
            ? `${SET.bad}14`
            : SET.cardSubtle
          : 'transparent',
        color: danger ? SET.bad : SET.inkSoft,
        fontFamily: 'inherit',
        fontSize: size === 'sm' ? 'var(--crm-text-sm)' : 'var(--crm-text-md)',
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-sm)',
        transition: 'all .15s',
      }}
    >
      {icon}
      {children}
    </motion.button>
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
        background: sgVoileEncre(false, 0.40),
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        display: 'grid',
        placeItems: 'center',
        padding: 'var(--crm-space-5xl)',
        animation: 'setFadeUp .2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card,
          borderRadius: 'var(--crm-radius-5xl)',
          padding: 28,
          width: wide ? 720 : 480,
          maxWidth: '100%',
          boxShadow: `0 40px 100px ${sgVoileEncre(false, 0.30)}`,
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
              gap: 'var(--crm-space-3xl)',
              marginBottom: 18,
            }}
          >
            <h3
              style={{
                flex: 1,
                margin: 0,
                fontSize: 'var(--crm-text-4xl)',
                fontWeight: 500,
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
                borderRadius: 'var(--crm-radius-pill)',
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
  const { t } = useTranslation('settings')
  const toneMap = { bad: SET.bad, ok: SET.ok, warn: SET.warn }
  const c = toneMap[tone]
  return (
    <Modal title="" onClose={onCancel}>
      <div style={{ display: 'flex', gap: 'var(--crm-space-3xl)', marginTop: -6, marginBottom: 8 }}>
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--crm-radius-xl)',
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
              fontSize: 'var(--crm-text-3xl)',
              fontWeight: 500,
              color: SET.ink,
              letterSpacing: -0.3,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--crm-text-lg)',
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
          gap: 'var(--crm-space-lg)',
          marginTop: 22,
        }}
      >
        <SetGhostBtn onClick={onCancel}>{t('common:actions.cancel')}</SetGhostBtn>
        {danger ? (
          <button
            onClick={onConfirm}
            style={{
              height: 44,
              padding: '0 var(--crm-space-6xl)',
              border: 0,
              borderRadius: 'var(--crm-radius-pill)',
              background: SET.bad,
              color: '#fff',
              fontFamily: 'inherit',
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 500,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(220,38,38,0.30)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-md)',
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
          fontSize: 'var(--crm-text-lg)',
          fontWeight: 400,
          color: SET.muted,
          marginBottom: 12,
        }}
      >
        {kicker}
      </div>
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: 'var(--crm-text-9xl)',
          fontWeight: 500,
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
          fontSize: 'var(--crm-text-3xl)',
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
        color: SET.blackInk,
        borderRadius: 'var(--crm-radius-pill)',
        padding: 'var(--crm-space-xl) var(--crm-space-6xl)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--crm-space-lg)',
        boxShadow: `0 24px 60px ${sgVoileEncre(false, 0.30)}`,
        fontSize: 'var(--crm-text-lg)',
        fontWeight: 600,
        animation: 'setSlideUp .3s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <span
        style={{
          width: 20,
          height: 20,
          borderRadius: 'var(--crm-radius-pill)',
          background: SET.ok,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SetIcon name="check" size={12} stroke={SET.blackInk} sw={3} />
      </span>
      {label}
    </div>
  )
}

// ─── useEaseNumber — count-up façon Framer Motion ───────────────────────────
// Anime un nombre depuis sa valeur courante vers `target` (easeOutCubic ~1.1s),
// via requestAnimationFrame. Respecte `prefers-reduced-motion` (saut direct).
// Réanime depuis la valeur affichée quand `target` change (ex. score 78 → 100).


// ─── Keyframes partagées de l'écran Settings ────────────────────────────────
// Montées une fois par la page racine (SettingsPage). Si une section est
// rendue isolément (test, story), inclure ce bloc sinon les `animation:` muettes.
export const SETTINGS_KEYFRAMES = `
@keyframes setFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
@keyframes setSlideUp { from { opacity: 0; transform: translate(-50%, 16px); } to { opacity: 1; transform: translate(-50%, 0); } }
@keyframes setFadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes setScaleIn { from { opacity: 0; transform: scale(.94); } to { opacity: 1; transform: scale(1); } }
@keyframes setSpin { to { transform: rotate(360deg); } }
@keyframes setRingPop { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: scale(1); } }
@keyframes setRingSweep { from { stroke-dashoffset: var(--sweep-c, 600); } to { stroke-dashoffset: 0; } }
@keyframes setLogoPop { 0% { opacity: 0; transform: scale(.6); } 60% { transform: scale(1.08); } 100% { opacity: 1; transform: scale(1); } }
@keyframes setCheckPop { 0% { opacity: 0; transform: scale(.4); } 100% { opacity: 1; transform: scale(1); } }
@keyframes setCheckDraw { from { stroke-dashoffset: 48; } to { stroke-dashoffset: 0; } }
@keyframes setPing { 0% { transform: scale(1); opacity: .9; } 80%, 100% { transform: scale(2.2); opacity: 0; } }
`
