/** Illustration décorative « scan de carte » (états vides Contacts), variantes clair/sombre. */
import type { CSSProperties } from 'react'

interface Props {
  /** Bascule sur la variante sombre (traits blancs, fond crème → translucide). */
  dark?: boolean
  size?: number
  className?: string
  style?: CSSProperties
}

/**
 * Illustration « premier lancement » de la surface Contacts (refonte handoff).
 * Deux variantes servies statiquement depuis public/illustrations/. Purement
 * décorative → aria-hidden, non sélectionnable.
 */
export default function ScanCardIllustration({ dark = false, size = 208, className, style }: Props) {
  return (
    <img
      src={dark ? '/illustrations/scan-card-dark.svg' : '/illustrations/scan-card.svg'}
      alt=""
      aria-hidden="true"
      draggable={false}
      className={className}
      loading="lazy"
      decoding="async"
      style={{
        width: size,
        height: size,
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        ...style,
      }}
    />
  )
}
