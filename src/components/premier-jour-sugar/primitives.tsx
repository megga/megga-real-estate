// MEGGA Premier jour — Primitives spécifiques au Day 0
// Source : handoff-premier-jour/premier-jour/crm-day0-tokens.jsx
import { useState, type ReactNode } from 'react'
import { obPalette } from '@/components/onboarding-sugar/tokens'
import PxIcon, { type PxIconName } from '@/components/propertyx/PxIcon'

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

// ─── Card option : pattern bento avec icône top-left + ghost décoratif
// bottom-right. Border 1px hybrid PX. Sélection via thick ink border.

export function D0OptionCard({
  label,
  hint,
  selected,
  onClick,
  dark,
  trailing,
  iconName,
}: {
  label: string
  hint: string
  selected: boolean
  onClick: () => void
  dark?: boolean
  trailing?: ReactNode
  /** Nom PxIcon — affiché en small top-left + ghost décoratif bottom-right. */
  iconName?: PxIconName
}) {
  const t = obPalette(dark)
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        textAlign: 'left',
        fontFamily: 'inherit',
        padding: '40px 44px',
        background: t.card,
        border: `1px solid ${t.cardBorder}`,
        borderRadius: 24,
        cursor: 'pointer',
        boxShadow: selected ? t.shadowHov : h ? t.shadowHov : t.shadow,
        transform: h && !selected ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .22s cubic-bezier(.2,.8,.2,1)',
        width: '100%',
        minHeight: 280,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      {/* Ghost icon décoratif bottom-right — seule signature visuelle.
          Plus de small icon top-left : la card respire, l'icône ghost suffit. */}
      {iconName && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            // Ajustement par icône — certaines (building, target) remplissent
            // leur viewBox jusqu'au bord et touchent la bordure de la card.
            bottom:
              iconName === 'building' ? -10 :
              iconName === 'target' ? -16 :
              -22,
            right: -18,
            pointerEvents: 'none',
            width: 180,
            height: 180,
          }}
        >
          {/* Layer 1 — ghost line constant en fond (line-style 1.2) */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              color: t.ink,
              opacity: dark ? 0.11 : 0.07,
            }}
          >
            <PxIcon name={iconName} size={180} strokeWidth={1.2} color={t.ink} />
          </div>

          {/* Layer 2 — version foncée révélée par clip-path animation
              quand la card est sélectionnée. Effet "remplissage du bas
              vers le haut" en temps réel. */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              color: t.ink,
              opacity: dark ? 0.48 : 0.38,
              clipPath: selected
                ? 'inset(0% 0 0 0)'
                : 'inset(100% 0 0 0)',
              transition: 'clip-path .6s cubic-bezier(.2,.8,.2,1)',
            }}
          >
            <PxIcon name={iconName} size={180} strokeWidth={1.2} color={t.ink} />
          </div>
        </div>
      )}

      {/* Label + hint — alignés en bas pour libérer le top de la card */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: t.ink,
            letterSpacing: -0.4,
            marginBottom: 8,
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 14.5,
            color: t.muted,
            fontWeight: 500,
            lineHeight: 1.5,
            maxWidth: 'calc(100% - 80px)',
          }}
        >
          {hint}
        </div>
      </div>

      {/* Trailing slot (legacy — pour les usages externes qui passent un radio) */}
      {trailing && (
        <div
          style={{
            position: 'absolute',
            top: 22,
            right: 22,
            zIndex: 1,
          }}
        >
          {trailing}
        </div>
      )}
    </button>
  )
}
