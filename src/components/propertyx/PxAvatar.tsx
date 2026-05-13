// MEGGA Marketplace — Property X avatar (port fidèle du composant 👥 Avatars).
// Cercle avec photo (object-cover). Sizes : 32 / 40 / 48 / 80 / 120 / 160.

import type { CSSProperties } from 'react'
import { PX } from './tokens'

export type PxAvatarSize = 32 | 40 | 48 | 80 | 120 | 160 | 200

interface PxAvatarProps {
  src?: string
  alt?: string
  size?: PxAvatarSize
  fallback?: string  // initiales si pas de src
  className?: string
  style?: CSSProperties
}

export default function PxAvatar({
  src,
  alt = '',
  size = 48,
  fallback,
  className,
  style,
}: PxAvatarProps) {
  const initialFontSize =
    size <= 32 ? 11 :
    size <= 48 ? 14 :
    size <= 80 ? 22 :
    size <= 120 ? 32 : 40

  return (
    <span
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: PX.radius.pill,
        background: PX.neutral300,
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: PX.neutral500,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: initialFontSize,
        letterSpacing: -0.3,
        ...style,
      }}>
      {src ? (
        <img
          src={src}
          alt={alt}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        fallback || '··'
      )}
    </span>
  )
}
