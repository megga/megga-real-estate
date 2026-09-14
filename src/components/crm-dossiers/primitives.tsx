// MEGGA CRM Sugar v3 — Primitives Sugar Pure
// Port pixel-près de crm-screen-kyc-sugar.jsx + crm-kyc-wizard.jsx (handoff).
// Surfaces blanches, accent unique #0B0C0E, AUCUNE bordure décorative.
//
// Sprint 2 — Les composants ci-dessous portent le préfixe Kyc* historique.
// Pour les nouvelles pages (Bien, Deal, Visite, modals Offre/Visite) on les
// exporte également sous le préfixe Sg* générique : voir le bas de ce fichier.

import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { dossierPalette } from './tokens'
import { crmVoileEncre } from '@/components/crm/tokens'
import { useCrmDark } from '@/lib/crmDark'

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
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
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
        background: disabled ? S.ghost : S.accent,
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
            ? `0 12px 30px ${crmVoileEncre(false, 0.25)}`
            : `0 6px 16px ${crmVoileEncre(false, 0.18)}`,
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
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
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
        background: active ? S.accent : hover ? S.card : 'transparent',
        color: active ? '#fff' : S.inkSoft,
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
          ? `0 6px 16px ${crmVoileEncre(false, 0.18)}`
          : hover
            ? S.shadow
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

// ─── Stepper Sugar 3 cercles connectés (utilisé par wizard) ────────────
interface StepperProps {
  steps: ReadonlyArray<{ id: string; label: string }>
  current: number
  onJump?: (i: number) => void
}

export function KycStepper({ steps, current, onJump }: StepperProps) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
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
                // ⛔ L'ÉTAPE FAITE EST UN APLAT INVERSÉ, pas une encre posée en
                // fond. Elle peignait `inkSoft` sous du blanc : en sombre,
                // `inkSoft` devient l'encre CLAIRE (#ededed) et la pastille
                // rendait blanc sur blanc — 1,06:1. Le défaut a survécu au lot
                // qui a repris ses onze jumeaux parce que le ternaire est
                // MULTI-LIGNE, invisible à un balayage qui lit ligne à ligne ;
                // et la vérification à l'écran ne l'a pas vu non plus, le banc
                // n'affichant aucune étape déjà faite. Un écran ne prouve que
                // les ÉTATS qu'il rend.
                background: active
                  ? S.accent
                  : done
                    ? S.invBgSoft
                    : S.card,
                // ⚠ Deux blancs différents, et c'est le point : sur l'accent
                // l'encre ne bascule pas (l'aplat non plus), sur l'aplat inversé
                // elle DOIT basculer.
                color: active ? S.accentInk : done ? S.invInk : S.muted,
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
                fontWeight: 600,
                cursor: reachable ? 'pointer' : 'default',
                display: 'grid',
                placeItems: 'center',
                boxShadow: active
                  ? `0 6px 16px ${crmVoileEncre(false, 0.25)}, 0 0 0 4px ${crmVoileEncre(false, 0.06)}`
                  : S.shadowSm,
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
                    i < current ? S.inkSoft : crmVoileEncre(false, 0.08),
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
export const CrmBlackPill = KycBlackPill
export const CrmGhostPill = KycGhostPill
export const CrmStepper = KycStepper
