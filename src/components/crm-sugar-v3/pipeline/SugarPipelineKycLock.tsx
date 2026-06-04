// MEGGA CRM Sugar v3 — Rappel KYC pipeline (haut du pipeline)
//
// KYC/LBA = nice to have, JAMAIS un verrou (règle métier mai 2026). Un deal
// avance à toutes les étapes sans KYC validé. Refonte visuelle (handoff §3) :
// l'ancien bandeau noir pleine largeur devient une PILULE DISCRÈTE, alignée sur
// la grammaire du bouton « Importer un lead » (mêmes tokens sp.cardBg/ink/shadow).
// Toujours un RAPPEL DOUX non-bloquant. Cachée si aucun dossier en attente.

import { useState } from 'react'
import MEIcon from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '@/components/crm-sugar/tokens'

interface PendingDeal {
  id: string
  contactFullName: string
}

interface Props {
  /** Deals avec KYC non vérifié sur stage sensible (rappel doux, non-bloquant). */
  pending: PendingDeal[]
  onOpenKyc: () => void
  /** Palette Sugar du pipeline (pour aligner la pilule sur la barre d'outils). */
  sp: SugarPalette
}

export function SugarPipelineKycLock({ pending, onOpenKyc, sp }: Props) {
  const [hover, setHover] = useState(false)
  if (pending.length === 0) return null
  const count = pending.length

  return (
    <div style={{ marginBottom: 18, display: 'flex' }}>
      <button
        onClick={onOpenKyc}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title="Rappel non-bloquant — ouvrir les dossiers KYC"
        style={{
          height: 44,
          padding: '0 10px 0 16px',
          borderRadius: 999,
          border: 0,
          background: sp.cardBg,
          color: sp.ink,
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: hover ? sp.shadow : sp.shadowSm,
          transform: hover ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'all .18s ease',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          whiteSpace: 'nowrap',
          animation: 'sgFadeUp .45s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <MEIcon name="shield" size={16} color={sp.ink} strokeWidth={1.7} />
        <span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {count}
          </span>{' '}
          dossier{count > 1 ? 's' : ''} KYC à compléter
        </span>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            padding: '3px 9px',
            borderRadius: 999,
            whiteSpace: 'nowrap',
            background: sp.cardSubBg,
            color: sp.sub,
          }}
        >
          Optionnel
        </span>
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            flexShrink: 0,
            background: hover ? sp.ink : sp.cardSubBg,
            color: hover ? sp.pageBg : sp.sub,
            display: 'grid',
            placeItems: 'center',
            transition: 'all .18s ease',
          }}
        >
          <MEIcon
            name="arrow-right"
            size={14}
            color={hover ? sp.pageBg : sp.sub}
            strokeWidth={2}
          />
        </span>
      </button>
    </div>
  )
}
