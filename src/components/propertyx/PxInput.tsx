// MEGGA Marketplace — Property X inputs (port fidèle du composant 📨 Inputs Figma).
//
// Atomes :
// - PxInput : pill (radius 200) bg ink ou neutral 200, padding pl-16 pr-6 py-6
// - PxSelect : pill bg neutral 200, chevron-down à droite
// - PxTextArea : radius 8, bg neutral 200, padding 16
// - PxCheckbox : 14 ou 18px, radius 4
// - PxRadio : 14 ou 18px, radius pill, dot intérieur
// - PxToggle : 14×24 ou 18×32, radius pill, slide

import { forwardRef } from 'react'
import type { InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes, ReactNode } from 'react'
import { PX } from './tokens'

// ─── Chevron down icon ────────────────────────────────────────────────
function ChevronDown({ color = PX.neutral500 }: { color?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <path d="m4 6 4 4 4-4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── PxInput (text input pill) ────────────────────────────────────────
interface PxInputProps extends InputHTMLAttributes<HTMLInputElement> {
  variant?: 'light' | 'dark'
  leftIcon?: ReactNode
  rightSlot?: ReactNode    // pour bouton intégré à droite (Inputs "dark" w/ Primary button)
}

export const PxInput = forwardRef<HTMLInputElement, PxInputProps>(
  ({ variant = 'light', leftIcon, rightSlot, style, ...rest }, ref) => {
    const isDark = variant === 'dark'
    const bg = isDark ? PX.neutral700 : PX.neutral200
    const textColor = isDark ? PX.neutral100 : PX.neutral700
    const placeholderColor = isDark ? PX.neutral400 : PX.neutral500
    const padLeft = leftIcon ? 16 : 16
    const padRight = rightSlot ? 6 : 16
    const minH = isDark ? 52 : 48

    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: bg,
        borderRadius: PX.radius.pill,
        paddingLeft: padLeft,
        paddingRight: padRight,
        paddingTop: 6,
        paddingBottom: 6,
        minHeight: minH,
        width: '100%',
        ...style,
      }}>
        {leftIcon && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: textColor,
            flexShrink: 0,
            width: 18, height: 18,
          }}>
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          {...rest}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: textColor,
            fontFamily: PX.font.sans,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            paddingTop: 2,
          }}
        />
        <style>{`
          input::placeholder { color: ${placeholderColor} !important; opacity: 1; }
        `}</style>
        {rightSlot && <span style={{ flexShrink: 0 }}>{rightSlot}</span>}
      </div>
    )
  }
)
PxInput.displayName = 'PxInput'

// ─── PxSelect (native dropdown styled pill) ───────────────────────────
interface PxSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  leftIcon?: ReactNode
}

export const PxSelect = forwardRef<HTMLSelectElement, PxSelectProps>(
  ({ leftIcon, style, children, ...rest }, ref) => {
    return (
      <div style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        background: PX.neutral200,
        borderRadius: PX.radius.pill,
        paddingLeft: 16,
        paddingRight: 14,
        paddingTop: 6,
        paddingBottom: 6,
        minHeight: 48,
        width: '100%',
        ...style,
      }}>
        {leftIcon && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: PX.neutral700,
            flexShrink: 0,
            width: 16, height: 16,
          }}>
            {leftIcon}
          </span>
        )}
        <select
          ref={ref}
          {...rest}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            color: PX.neutral700,
            fontFamily: PX.font.sans,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            paddingTop: 2,
            paddingRight: 20,
            cursor: 'pointer',
            appearance: 'none',
            WebkitAppearance: 'none',
          }}>
          {children}
        </select>
        <span style={{
          position: 'absolute',
          right: 14, top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
          display: 'flex',
        }}>
          <ChevronDown />
        </span>
      </div>
    )
  }
)
PxSelect.displayName = 'PxSelect'

// ─── PxTextArea ───────────────────────────────────────────────────────
interface PxTextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  leftIcon?: ReactNode
}

export const PxTextArea = forwardRef<HTMLTextAreaElement, PxTextAreaProps>(
  ({ leftIcon, style, ...rest }, ref) => {
    return (
      <div style={{
        display: 'flex',
        gap: 6,
        background: PX.neutral200,
        borderRadius: PX.radius.tiny,
        padding: 16,
        minHeight: 104,
        width: '100%',
        ...style,
      }}>
        {leftIcon && (
          <span style={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            color: PX.neutral500,
            flexShrink: 0,
            width: 14, height: 14,
            marginTop: 2,
          }}>
            {leftIcon}
          </span>
        )}
        <textarea
          ref={ref}
          {...rest}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'transparent',
            border: 0,
            outline: 'none',
            resize: 'vertical',
            color: PX.neutral700,
            fontFamily: PX.font.sans,
            fontSize: 14,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.42px',
          }}
        />
      </div>
    )
  }
)
PxTextArea.displayName = 'PxTextArea'

// ─── PxCheckbox ──────────────────────────────────────────────────────
interface PxCheckboxProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: ReactNode
  size?: 'sm' | 'lg'
}

function CheckIcon({ size = 8 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path d="M2 6.5l2.5 2.5L10 3" stroke={PX.neutral100} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function PxCheckbox({ checked, onChange, label, size = 'sm' }: PxCheckboxProps) {
  const dim = size === 'lg' ? 18 : 14
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <span style={{
        position: 'relative',
        width: dim, height: dim,
        borderRadius: 4,
        background: checked ? PX.neutral700 : PX.neutral100,
        border: checked ? 0 : `1px solid ${PX.neutral200}`,
        boxShadow: checked ? 'none' : '0 1px 3px rgba(25,33,61,0.10)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: `background ${PX.duration.fast} ${PX.ease}`,
      }}>
        {checked && <CheckIcon size={size === 'lg' ? 10 : 8} />}
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </span>
      {label && (
        <span style={{
          fontFamily: PX.font.sans,
          fontSize: size === 'lg' ? 16 : 14,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: size === 'lg' ? '-0.48px' : '-0.42px',
          color: checked ? PX.neutral700 : PX.neutral500,
        }}>{label}</span>
      )}
    </label>
  )
}

// ─── PxRadio ─────────────────────────────────────────────────────────
interface PxRadioProps {
  checked: boolean
  onChange: () => void
  label?: ReactNode
  size?: 'sm' | 'lg'
  name?: string
}

export function PxRadio({ checked, onChange, label, size = 'sm', name }: PxRadioProps) {
  const dim = size === 'lg' ? 18 : 14
  const dot = size === 'lg' ? 6 : 4
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <span style={{
        position: 'relative',
        width: dim, height: dim,
        borderRadius: PX.radius.pill,
        background: checked ? PX.neutral700 : PX.neutral100,
        border: checked ? 0 : `1px solid ${PX.neutral200}`,
        boxShadow: checked ? 'none' : '0 1px 3px rgba(25,33,61,0.10)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        transition: `background ${PX.duration.fast} ${PX.ease}`,
      }}>
        {checked && (
          <span style={{
            width: dot, height: dot,
            borderRadius: PX.radius.pill,
            background: PX.neutral100,
          }} />
        )}
        <input
          type="radio"
          name={name}
          checked={checked}
          onChange={onChange}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </span>
      {label && (
        <span style={{
          fontFamily: PX.font.sans,
          fontSize: size === 'lg' ? 16 : 14,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: size === 'lg' ? '-0.48px' : '-0.42px',
          color: checked ? PX.neutral700 : PX.neutral500,
        }}>{label}</span>
      )}
    </label>
  )
}

// ─── PxToggle ────────────────────────────────────────────────────────
interface PxToggleProps {
  checked: boolean
  onChange: (next: boolean) => void
  label?: ReactNode
  size?: 'sm' | 'lg'
}

export function PxToggle({ checked, onChange, label, size = 'sm' }: PxToggleProps) {
  const w = size === 'lg' ? 32 : 24
  const h = size === 'lg' ? 18 : 14
  const thumb = h - 4

  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
      <span style={{
        position: 'relative',
        width: w, height: h,
        borderRadius: PX.radius.pill,
        background: checked ? PX.neutral700 : PX.neutral200,
        boxShadow: checked ? 'none' : '0 1px 3px rgba(25,33,61,0.10)',
        flexShrink: 0,
        transition: `background ${PX.duration.fast} ${PX.ease}`,
      }}>
        <span style={{
          position: 'absolute',
          top: 2, left: checked ? w - thumb - 2 : 2,
          width: thumb, height: thumb,
          borderRadius: PX.radius.pill,
          background: PX.neutral100,
          transition: `left ${PX.duration.fast} ${PX.ease}`,
        }} />
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
        />
      </span>
      {label && (
        <span style={{
          fontFamily: PX.font.sans,
          fontSize: size === 'lg' ? 16 : 14,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: size === 'lg' ? '-0.48px' : '-0.42px',
          color: checked ? PX.neutral700 : PX.neutral500,
        }}>{label}</span>
      )}
    </label>
  )
}
