// MEGGA Pro — iPad Pro 11 Landscape frame, réutilisable.
// Pattern fidèle PxExploreCTA :
// - Bezel PNG Space Gray landscape (851.64 × 613.898) au-dessus du contenu
// - Screen content positionné aux insets exacts Figma
//   top 5.09% / right 3.56% / bottom 5.02% / left 3.67%
// - bg neutral200 pour combler le cutout du bezel
// - Scale optionnel pour viewports contraints (Hero right column)

import type { ReactNode } from 'react'
import { PX } from '../..'

const NATIVE_W = 851.64
const NATIVE_H = 613.898

interface IpadFrameProps {
  children: ReactNode
  /** Scale factor 0–1. Défaut 1 (natif). */
  scale?: number
}

export default function IpadFrame({ children, scale = 1 }: IpadFrameProps) {
  return (
    <div style={{
      position: 'relative',
      width: NATIVE_W * scale,
      height: NATIVE_H * scale,
    }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: NATIVE_W,
        height: NATIVE_H,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      }}>
        {/* Screen content */}
        <div style={{
          position: 'absolute',
          top: '5.09%',
          right: '3.56%',
          bottom: '5.02%',
          left: '3.67%',
          background: PX.neutral200,
          borderRadius: 18,
          overflow: 'hidden',
          zIndex: 1,
        }}>
          {children}
        </div>
        {/* Bezel PNG au-dessus */}
        <img
          src="/images/sections/cta-ipad/ipad-bezel.png"
          alt=""
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        />
      </div>
    </div>
  )
}
