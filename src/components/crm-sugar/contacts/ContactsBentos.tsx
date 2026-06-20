// MEGGA CRM Sugar v2 — Contacts bentos (atoms réutilisables dans la fiche)
// 1:1 port from the Claude Design bundle (CtBento, CtCard, CtKv, CtChip, CtAiBubble).

import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '../tokens'

interface CtBentoProps {
  title?: string
  action?: ReactNode
  children: ReactNode
  sp: SugarPalette
  padding?: string
  noTitle?: boolean
  style?: CSSProperties
  span?: 1 | 2
}

export function CtBento({
  title,
  action,
  children,
  sp,
  padding = '18px 20px',
  noTitle,
  style,
  span,
}: CtBentoProps) {
  return (
    <section
      style={{
        background: sp.cardBg,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 20,
        boxShadow: sp.shadowSm,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding,
        display: 'flex',
        flexDirection: 'column',
        gridColumn: span === 2 ? 'span 2' : undefined,
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {!noTitle && (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 14,
            flexShrink: 0,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 11,
              fontWeight: 700,
              color: sp.sub,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            {title}
          </h3>
          <div style={{ flex: 1, height: 1, background: sp.cardBorder }} />
          {action}
        </header>
      )}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {children}
      </div>
    </section>
  )
}

interface CtCardProps {
  children: ReactNode
  sp: SugarPalette
  padding?: string
  style?: CSSProperties
  fill?: boolean
}

export function CtCard({ children, sp, padding = '12px 14px', style, fill }: CtCardProps) {
  return (
    <div
      style={{
        background: sp.cardSubBg || 'transparent',
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 12,
        padding,
        height: fill ? '100%' : 'auto',
        boxSizing: 'border-box',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

interface CtKvProps {
  label: string
  value: ReactNode
  mono?: boolean
  sp: SugarPalette
}

export function CtKv({ label, value, mono, sp }: CtKvProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 12,
        padding: '8px 0',
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 72,
          fontSize: 11,
          color: sp.sub,
          fontWeight: 600,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 12.5,
          color: sp.ink,
          fontWeight: 600,
          fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
          fontVariantNumeric: mono ? 'tabular-nums' : 'normal',
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface CtChipProps {
  children: ReactNode
  color?: string
  sp: SugarPalette
  dark?: boolean
}

export function CtChip({ children, color, sp, dark }: CtChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '3px 10px',
        borderRadius: 999,
        background: color ? color + (dark ? '33' : '1A') : sp.cardSubBg,
        color: color || sp.soft,
        fontSize: 11,
        fontWeight: 600,
        border: `1px solid ${color ? color + (dark ? '55' : '33') : sp.cardBorder}`,
      }}
    >
      {children}
    </span>
  )
}

interface CtAiBubbleProps {
  title: string
  body: string
  cta: string
  sp: SugarPalette
  dark: boolean
}

export function CtAiBubble({ title, body, cta, sp, dark }: CtAiBubbleProps) {
  const { t } = useTranslation('common')
  return (
    <div
      style={{
        padding: '12px 14px',
        borderRadius: 14,
        background: dark
          ? 'linear-gradient(135deg, rgba(74,120,240,.12), rgba(139,92,246,.06))'
          : 'linear-gradient(135deg, rgba(0,65,217,.06), rgba(139,92,246,.04))',
        border: `1px solid ${dark ? 'rgba(74,120,240,.25)' : 'rgba(0,65,217,.18)'}`,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
        marginBottom: 14,
      }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 9,
          flexShrink: 0,
          background: 'linear-gradient(135deg, #0041D9, #8B5CF6)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <MEIcon name="sparkle" size={13} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: sp.ink, marginBottom: 2 }}>
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: sp.soft, lineHeight: 1.5, marginBottom: 8 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            style={{
              height: 26,
              padding: '0 12px',
              borderRadius: 8,
              background: sp.ink,
              color: sp.pageBg,
              border: 0,
              fontSize: 11.5,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {cta}
          </button>
          <button
            style={{
              height: 26,
              padding: '0 12px',
              borderRadius: 8,
              background: 'transparent',
              color: sp.sub,
              border: `1px solid ${sp.cardBorder}`,
              fontSize: 11.5,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {t('actions.later')}
          </button>
        </div>
      </div>
    </div>
  )
}
