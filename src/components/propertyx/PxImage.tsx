// MEGGA Marketplace — Property X image wrapper.
// Container avec radius (tiny/small/large), ratios (square/landscape/portrait),
// object-fit cover. Skeleton de fond Neutrals 300 si pas de src.

import type { CSSProperties, ReactNode } from 'react'
import { PX } from './tokens'

export type PxImageRadius = 'none' | 'tiny' | 'small' | 'large'
export type PxImageRatio = 'square' | 'landscape' | 'portrait' | 'wide' | 'auto'

interface PxImageProps {
  src?: string
  alt?: string
  radius?: PxImageRadius
  ratio?: PxImageRatio
  overlay?: ReactNode    // contenu superposé (badge, gradient, etc.)
  className?: string
  style?: CSSProperties
}

const ratioToAspect: Record<PxImageRatio, string | undefined> = {
  square: '1 / 1',
  landscape: '4 / 3',
  portrait: '3 / 4',
  wide: '16 / 9',
  auto: undefined,
}

const radiusValue: Record<PxImageRadius, number> = {
  none: 0,
  tiny: PX.radius.tiny,
  small: PX.radius.small,
  large: PX.radius.large,
}

export default function PxImage({
  src,
  alt = '',
  radius = 'large',
  ratio = 'landscape',
  overlay,
  className,
  style,
}: PxImageProps) {
  const aspectRatio = ratioToAspect[ratio]

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        borderRadius: radiusValue[radius],
        overflow: 'hidden',
        background: PX.neutral300,
        aspectRatio,
        ...style,
      }}>
      {src && (
        <img
          src={src}
          alt={alt}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      )}
      {overlay}
    </div>
  )
}
