// MEGGA CRM Sugar v3 — Stepper wizard KYC (contrôle segmenté, handoff §1.5)
// Port de crm-kyc-wizard.jsx §KwStepItem/KwStepper.
//
// Même grammaire que les seg-tabs de la fiche KYC : pilule sur l'étape ACTIVE
// uniquement ; étapes FAITES = libellé + coche verte, cliquables pour revenir ;
// étapes À VENIR = sourdine, non cliquables.
// Palette-aware (useKycPalette) — pas de couleur en dur (sauf le vert/✓ §1.5).
//
// ⚠ LES NUMÉROS ONT ÉTÉ RETIRÉS (16 août 2026). Ils ne disaient rien que la
// position ne dise déjà : trois étapes alignées de gauche à droite SONT 1, 2, 3.
// L'étape courante est portée par la pilule d'accent, pas par son rang. La coche
// RESTE, elle : « fait » est le seul état qui ne se déduit pas de la position.
// Même geste que les sur-titres « Étape X sur 3 » et le compteur « n/3 », retirés
// à la refonte du wizard pour la même raison.

import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { useState } from 'react'
import { SgIcon } from '../icons'
import { useKycPalette } from '../kyc/kycPalette'

const KW_DONE_GREEN = '#10B981' // même vert que le statut « vérifié » du KYC

interface StepItemProps {
  index: number
  label: string
  current: number
  onJump?: (i: number) => void
}

function KwStepItem({ index, label, current, onJump }: StepItemProps) {
  const sp = useKycPalette()
  const [hover, setHover] = useState(false)
  const done = index < current
  const active = index === current
  const reachable = index <= current

  return (
    <button
      onClick={() => reachable && !active && onJump?.(index)}
      onMouseEnter={() => reachable && !active && setHover(true)}
      onMouseLeave={() => setHover(false)}
      disabled={!reachable}
      title={reachable && !active ? `Revenir à « ${label} »` : label}
      style={{
        height: 40,
        padding: '0 var(--crm-space-3xl)',
        borderRadius: 'var(--crm-radius-pill)',
        border: 0,
        background: active ? sp.black : hover ? sp.card : 'transparent',
        color: active ? sp.onAccent : done ? sp.inkSoft : sp.muted,
        fontFamily: 'inherit',
        fontSize: 'var(--crm-text-lg)',
        fontWeight: active ? 600 : 500,
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
        cursor: reachable && !active ? 'pointer' : 'default',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-md)',
        boxShadow: active ? `0 6px 16px ${sgVoileEncre(false, 0.22)}` : 'none',
        transition: 'all .2s ease',
        flexShrink: 0,
      }}
    >
      {/* La coche SEULE, et seulement sur une étape faite : c'est le seul état
          qui ne se lit pas dans la position. L'étape courante a sa pilule, les
          suivantes leur sourdine. */}
      {done && (
        <span
          style={{
            width: 20,
            height: 20,
            borderRadius: 'var(--crm-radius-pill)',
            boxSizing: 'border-box',
            flexShrink: 0,
            background: KW_DONE_GREEN,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SgIcon name="check" size={11} stroke="#FFFFFF" sw={2.6} />
        </span>
      )}
      {label}
    </button>
  )
}

interface Props {
  steps: ReadonlyArray<{ id: string; label: string }>
  current: number
  onJump?: (i: number) => void
}

export function KwStepper({ steps, current, onJump }: Props) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
      {steps.map((s, i) => (
        <KwStepItem key={s.id} index={i} label={s.label} current={current} onJump={onJump} />
      ))}
    </div>
  )
}
