// MEGGA CRM Sugar v3 — Primitives Sugar Pure
// Port pixel-près de crm-screen-kyc-sugar.jsx + crm-kyc-wizard.jsx (handoff).
// Surfaces blanches, accent unique #0B0C0E, AUCUNE bordure décorative.
//
// Sprint 2 — Les composants ci-dessous portent le préfixe Kyc* historique.
// Pour les nouvelles pages (Bien, Deal, Visite, modals Offre/Visite) on les
// exporte également sous le préfixe Sg* générique : voir le bas de ce fichier.

import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { SugarV3, KYC_STATUS_LABELS, KYC_RISK_LABELS } from './tokens'
import type { KycDossierStatus } from '@/types/kyc'

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
        borderRadius: 999,
        border: 0,
        background: disabled
          ? SugarV3.ghost
          : hover
            ? SugarV3.blackHover
            : SugarV3.black,
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: size === 'lg' ? 14.5 : 13,
        fontWeight: 600,
        letterSpacing: 0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        whiteSpace: 'nowrap',
        boxShadow: disabled
          ? 'none'
          : hover
            ? '0 12px 30px rgba(11,12,14,0.25)'
            : '0 6px 16px rgba(11,12,14,0.18)',
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
        borderRadius: 999,
        border: 0,
        background: active ? SugarV3.black : hover ? SugarV3.card : 'transparent',
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
          ? '0 6px 16px rgba(11,12,14,0.18)'
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
        borderRadius: 999,
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
            borderRadius: 999,
            background: SugarV3.err,
            boxShadow: `0 0 0 2px ${SugarV3.cardSubtle}`,
          }}
        />
      )}
    </button>
  )
}

// ─── Anneau de progression ─────────────────────────────────────────────
interface RingProps {
  pct: number
  size?: number
  stroke?: number
}

export function KycRing({ pct, size = 56, stroke = 3 }: RingProps) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = c * (1 - pct / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(11,12,14,0.08)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={SugarV3.black}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .6s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          fontSize: size >= 56 ? 14 : 11,
          fontWeight: 700,
          color: SugarV3.ink,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: -0.3,
        }}
      >
        {pct}%
      </div>
    </div>
  )
}

// ─── Pilule de statut KYC (avec micro-pastille colorée) ────────────────
interface StatusPillProps {
  status: KycDossierStatus
}

export function KycStatusPill({ status }: StatusPillProps) {
  const meta = KYC_STATUS_LABELS[status] ?? KYC_STATUS_LABELS.none
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px 5px 9px',
        borderRadius: 999,
        background: SugarV3.cardSubtle,
        color: SugarV3.ink,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 999,
          background: meta.tone,
          flexShrink: 0,
        }}
      />
      {meta.label}
    </span>
  )
}

// ─── Pilule de risque (3 niveaux) ──────────────────────────────────────
interface RiskPillProps {
  risk: keyof typeof KYC_RISK_LABELS
}

export function KycRiskPill({ risk }: RiskPillProps) {
  const meta = KYC_RISK_LABELS[risk] ?? KYC_RISK_LABELS.unassessed
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px 5px 9px',
        borderRadius: 999,
        background: SugarV3.cardSubtle,
        color: SugarV3.ink,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{ width: 7, height: 7, borderRadius: 999, background: meta.tone }}
      />
      {meta.label}
    </span>
  )
}

// ─── Pilule neutre générique (statut, tag) ─────────────────────────────
interface NeutralPillProps {
  label: string
  tone?: string
  icon?: ReactNode
}

export function KycNeutralPill({ label, tone, icon }: NeutralPillProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        padding: '5px 11px 5px 9px',
        borderRadius: 999,
        background: SugarV3.cardSubtle,
        color: SugarV3.ink,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: 0.1,
        whiteSpace: 'nowrap',
      }}
    >
      {tone && (
        <span
          style={{
            width: 7,
            height: 7,
            borderRadius: 999,
            background: tone,
            flexShrink: 0,
          }}
        />
      )}
      {icon}
      {label}
    </span>
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
        borderRadius: 22,
        padding: '22px 24px',
        boxShadow: SugarV3.shadow,
        minHeight: 124,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 1.1,
          textTransform: 'uppercase',
          color: SugarV3.muted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 8,
          marginTop: 14,
        }}
      >
        <span
          style={{
            fontSize: 44,
            fontWeight: 700,
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
              borderRadius: 999,
              background: accent,
              marginBottom: 6,
            }}
          />
        )}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 12.5,
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

// ─── Section générique (titre + eyebrow + action) ──────────────────────
interface SectionProps {
  title?: string
  eyebrow?: string
  action?: ReactNode
  children: ReactNode
  padded?: boolean
}

export function KycSection({
  title,
  eyebrow,
  action,
  children,
  padded = true,
}: SectionProps) {
  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 22,
        padding: padded ? '26px 28px' : 0,
        boxShadow: SugarV3.shadow,
        animation: 'sgFadeUp .55s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      {(title || action || eyebrow) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 18,
            padding: padded ? 0 : '26px 28px 0',
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            {eyebrow && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: SugarV3.muted,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {eyebrow}
              </div>
            )}
            {title && (
              <h3
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 700,
                  color: SugarV3.ink,
                  letterSpacing: -0.3,
                }}
              >
                {title}
              </h3>
            )}
          </div>
          {action && <div style={{ flexShrink: 0 }}>{action}</div>}
        </div>
      )}
      <div style={{ padding: padded ? 0 : '0 28px 26px' }}>{children}</div>
    </div>
  )
}

// ─── Avatar initiales ──────────────────────────────────────────────────
interface AvatarProps {
  firstName: string
  lastName: string
  avatarBg?: string | null
  /** Couleur des initiales. Défaut '#fff'. À passer (= onAccent) quand le fond
   *  est l'accent thémé, sinon les initiales disparaissent en dark mode. */
  color?: string
  size?: number
}

export function KycAvatar({ firstName, lastName, avatarBg, color = '#fff', size = 56 }: AvatarProps) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase()
  const bg = avatarBg || SugarV3.black
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        background: bg,
        color,
        display: 'grid',
        placeItems: 'center',
        fontSize: Math.max(11, size * 0.3),
        fontWeight: 700,
        letterSpacing: -0.3,
        flexShrink: 0,
        boxShadow: '0 4px 12px rgba(11,12,14,0.12)',
      }}
    >
      {initials}
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
                borderRadius: 999,
                border: 0,
                background: active
                  ? SugarV3.black
                  : done
                    ? SugarV3.inkSoft
                    : SugarV3.card,
                color: active || done ? '#fff' : SugarV3.muted,
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                cursor: reachable ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
                boxShadow: active
                  ? '0 6px 16px rgba(11,12,14,0.25), 0 0 0 4px rgba(11,12,14,0.06)'
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
                    i < current ? SugarV3.inkSoft : 'rgba(11,12,14,0.08)',
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
export const SgCircleBtn = KycCircleBtn
export const SgRing = KycRing
export const SgStatusPill = KycStatusPill
export const SgRiskPill = KycRiskPill
export const SgNeutralPill = KycNeutralPill
export const SgStatCard = KycStatCard
export const SgSection = KycSection
export const SgAvatar = KycAvatar
export const SgStepper = KycStepper
