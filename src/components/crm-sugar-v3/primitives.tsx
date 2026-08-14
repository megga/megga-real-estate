// MEGGA CRM Sugar v3 — Primitives Sugar Pure
// Port pixel-près de crm-screen-kyc-sugar.jsx + crm-kyc-wizard.jsx (handoff).
// Surfaces blanches, accent unique #0B0C0E, AUCUNE bordure décorative.
//
// Sprint 2 — Les composants ci-dessous portent le préfixe Kyc* historique.
// Pour les nouvelles pages (Bien, Deal, Visite, modals Offre/Visite) on les
// exporte également sous le préfixe Sg* générique : voir le bas de ce fichier.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { SugarV3 } from './tokens'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'

// ─── Pilule noire (CTA principal) ──────────────────────────────────────
interface BlackPillProps {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
  /** `md` = 40px, `lg` = 50px. */
  size?: 'md' | 'lg'
  style?: CSSProperties
  /** Native HTML title attribute — tooltip au survol. */
  title?: string
}

export function KycBlackPill({
  children,
  onClick,
  disabled,
  icon,
  size = 'md',
  style,
  title,
}: BlackPillProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'lg' ? 50 : 40
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: size === 'lg' ? '0 26px' : '0 18px',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: disabled ? SugarV3.ghost : SugarV3.accent,
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 'var(--crm-text-lg)' : 'var(--crm-text-md)',
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-md)',
        whiteSpace: 'nowrap',
        boxShadow: disabled
          ? 'none'
          : hover
            ? `0 12px 30px ${sgVoileEncre(false, 0.25)}`
            : `0 6px 16px ${sgVoileEncre(false, 0.18)}`,
        transform: hover && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .18s ease',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Pilule fantôme ────────────────────────────────────────────────────
interface GhostPillProps {
  children: ReactNode
  onClick?: () => void
  icon?: ReactNode
  active?: boolean
  size?: 'sm' | 'md'
  style?: CSSProperties
  disabled?: boolean
  /** Native HTML title attribute — tooltip au survol. */
  title?: string
}

export function KycGhostPill({
  children,
  onClick,
  icon,
  active,
  size = 'md',
  style,
  disabled,
  title,
}: GhostPillProps) {
  const [hover, setHover] = useState(false)
  const h = size === 'sm' ? 36 : 40
  const fontSize = size === 'sm' ? 12.5 : 13
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      onMouseEnter={() => !disabled && setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        height: h,
        padding: size === 'sm' ? '0 14px' : '0 18px',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: active ? SugarV3.accent : hover ? SugarV3.card : 'transparent',
        color: active ? '#fff' : SugarV3.inkSoft,
        fontFamily: 'inherit',
        fontSize,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? 7 : 8,
        whiteSpace: 'nowrap',
        boxShadow: active
          ? `0 6px 16px ${sgVoileEncre(false, 0.18)}`
          : hover
            ? SugarV3.shadow
            : 'none',
        transition: 'all .18s ease',
        ...style,
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ─── Bouton circulaire gris ────────────────────────────────────────────
interface CircleBtnProps {
  icon: ReactNode
  onClick?: () => void
  title?: string
  size?: number
  badge?: boolean
}

export function KycCircleBtn({
  icon,
  onClick,
  title,
  size = 44,
  badge,
}: CircleBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: SugarV3.cardSubtle,
        color: SugarV3.inkSoft,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        boxShadow: SugarV3.shadowSm,
        transition: 'all .18s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = SugarV3.card
        e.currentTarget.style.boxShadow = SugarV3.shadow
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = SugarV3.cardSubtle
        e.currentTarget.style.boxShadow = SugarV3.shadowSm
      }}
    >
      {icon}
      {badge && (
        <span
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            width: 8,
            height: 8,
            borderRadius: 'var(--crm-radius-pill)',
            background: SugarV3.err,
            boxShadow: `0 0 0 2px ${SugarV3.cardSubtle}`,
          }}
        />
      )}
    </button>
  )
}





// ─── Card stat bento ───────────────────────────────────────────────────
interface StatCardProps {
  label: string
  value: ReactNode
  sub?: string
  accent?: string
}

export function KycStatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 'var(--crm-radius-5xl)',
        padding: 'var(--crm-space-6xl) var(--crm-space-7xl)',
        boxShadow: SugarV3.shadow,
        minHeight: 124,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          fontSize: 'var(--crm-text-sm)',
          fontWeight: 500,
          color: SugarV3.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--crm-space-md)',
          marginTop: 14,
        }}
      >
        <span
          style={{
            fontSize: 44,
            fontWeight: 600,
            letterSpacing: -1.4,
            lineHeight: 1,
            color: SugarV3.ink,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        {accent && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 'var(--crm-radius-pill)',
              background: accent,
              marginBottom: 6,
            }}
          />
        )}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 'var(--crm-text-md)',
            fontWeight: 500,
            color: SugarV3.muted,
            marginTop: 8,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  )
}


// ─── Stepper Sugar 3 cercles connectés (utilisé par wizard) ────────────
interface StepperProps {
  steps: ReadonlyArray<{ id: string; label: string }>
  current: number
  onJump?: (i: number) => void
}

export function KycStepper({ steps, current, onJump }: StepperProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        const reachable = i <= current
        return (
          <span key={s.id} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <button
              onClick={() => reachable && onJump?.(i)}
              title={s.label}
              style={{
                width: 32,
                height: 32,
                borderRadius: 'var(--crm-radius-pill)',
                border: 0,
                background: active
                  ? SugarV3.accent
                  : done
                    ? SugarV3.inkSoft
                    : SugarV3.card,
                color: active || done ? '#fff' : SugarV3.muted,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
                fontWeight: 600,
                cursor: reachable ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
                boxShadow: active
                  ? `0 6px 16px ${sgVoileEncre(false, 0.25)}, 0 0 0 4px ${sgVoileEncre(false, 0.06)}`
                  : SugarV3.shadowSm,
                transition: 'all .2s ease',
                flexShrink: 0,
              }}
            >
              {done ? '✓' : i + 1}
            </button>
            {i < steps.length - 1 && (
              <span
                style={{
                  width: 36,
                  height: 2,
                  flexShrink: 0,
                  background:
                    i < current ? SugarV3.inkSoft : sgVoileEncre(false, 0.08),
                  transition: 'background .3s ease',
                }}
              />
            )}
          </span>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Aliases Sg* — Sprint 2 onwards (Bien, Deal, Visite, modals).
// Les primitives sont communes à toutes les pages Sugar Pure ; seul leur
// nom évolue pour ne plus laisser entendre qu'elles sont KYC-only.
// ═══════════════════════════════════════════════════════════════════════
export const SgBlackPill = KycBlackPill
export const SgGhostPill = KycGhostPill
export const SgStepper = KycStepper
