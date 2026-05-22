// MEGGA Premier jour — Primitives spécifiques au Day 0
// Source : handoff-premier-jour/premier-jour/crm-day0-tokens.jsx
import { useState, type ReactNode } from 'react'
import { obPalette } from '@/components/onboarding-sugar/tokens'

// ─── Badge MEGGA AI animé — pulse subtil ─────────────────────────────

export function D0AIBadge({
  size = 28,
  dark,
  label = 'MEGGA AI',
  showLabel = true,
}: {
  size?: number
  dark?: boolean
  label?: string
  showLabel?: boolean
}) {
  const t = obPalette(dark)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          position: 'relative',
          width: size,
          height: size,
          borderRadius: 999,
          background: t.black,
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 4px 14px rgba(11,12,14,0.20)',
        }}
      >
        <span
          style={{
            color: dark ? '#0B0C0E' : '#fff',
            fontSize: size * 0.42,
            fontWeight: 800,
            letterSpacing: -0.3,
          }}
        >
          M
        </span>
        <span
          style={{
            position: 'absolute',
            inset: -3,
            borderRadius: 999,
            animation: 'd0AiPulse 2.4s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      </div>
      {showLabel && (
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: t.muted,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
      )}
    </div>
  )
}

// ─── Progression dots (4 questions) — minimaliste ────────────────────

export function D0Dots({
  count,
  current,
  dark,
}: {
  count: number
  current: number
  dark?: boolean
}) {
  const t = obPalette(dark)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      {Array.from({ length: count }).map((_, i) => {
        const active = i === current
        const done = i < current
        return (
          <div
            key={i}
            style={{
              width: active ? 24 : 6,
              height: 6,
              borderRadius: 999,
              background: done
                ? t.inkSoft
                : active
                  ? t.black
                  : dark
                    ? 'rgba(236,237,243,0.18)'
                    : 'rgba(11,12,14,0.12)',
              transition: 'all .35s cubic-bezier(.2,.8,.2,1)',
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Card option : label + hint, radio cercle qui se remplit en noir ─

export function D0OptionCard({
  label,
  hint,
  selected,
  onClick,
  dark,
  trailing,
}: {
  label: string
  hint: string
  selected: boolean
  onClick: () => void
  dark?: boolean
  trailing?: ReactNode
}) {
  const t = obPalette(dark)
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        textAlign: 'left',
        fontFamily: 'inherit',
        padding: '22px 26px',
        background: t.card,
        border: 0,
        borderRadius: 18,
        cursor: 'pointer',
        boxShadow: selected
          ? `${t.shadowHov}, 0 0 0 2px ${t.black} inset`
          : h
            ? t.shadowHov
            : t.shadow,
        transform: h && !selected ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .22s cubic-bezier(.2,.8,.2,1)',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        width: '100%',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 17,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.35,
            marginBottom: 4,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13.5,
            color: t.muted,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {hint}
        </div>
      </div>
      {trailing ?? (
        <div
          style={{
            flexShrink: 0,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: selected ? t.black : 'transparent',
            boxShadow: selected
              ? 'none'
              : `0 0 0 1.5px ${dark ? 'rgba(236,237,243,0.22)' : 'rgba(11,12,14,0.18)'} inset`,
            display: 'grid',
            placeItems: 'center',
            transition: 'all .2s ease',
          }}
        >
          {selected && (
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: dark ? '#0B0C0E' : '#fff',
              }}
            />
          )}
        </div>
      )}
    </button>
  )
}
