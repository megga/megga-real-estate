// MEGGA Marketplace — Property X icon wrapper FOR REAL FIGMA ICONS.
//
// PxIcon utilise des SVG paths que j'ai dessinés à la main (approximations).
// PxFigmaIcon charge les VRAIS SVG exportés depuis Figma via get_design_context
// et stockés dans /public/icons/figma/.
//
// Les SVG ont été modifiés pour utiliser `fill="currentColor"` afin de pouvoir
// les recolorier avec `color` ou `style.color`.
//
// Usage :
//   <PxFigmaIcon name="key" size={16} color={PX.neutral100} />

import { useEffect, useState } from 'react'
import { PX } from './tokens'

// Liste des icônes officielles téléchargées depuis Figma.
// Ajouter une icône :
//   1. Récupérer son URL via get_design_context Figma
//   2. curl -o public/icons/figma/<name>.svg <url>
//   3. sed -i '' 's/var(--fill-0[^)]*)/currentColor/g' public/icons/figma/<name>.svg
//   4. Ajouter le nom ici dans le type
export type PxFigmaIconName =
  // Real estate amenities (Figma "Small Icon/Vxx")
  | 'key'         // V34 : For rent badge
  | 'location'    // V37 : map pin
  | 'surface'     // V31 : m² / sqft
  | 'bed'         // V23 : chambres
  | 'bath'        // V33 : salles de bain
  | 'parking'     // V27 : garage / parking
  // UI controls (Line Rounded)
  | 'chevron-right'
  | 'chevron-left'
  | 'plus'
  | 'sparkle'

interface PxFigmaIconProps {
  name: PxFigmaIconName
  size?: number
  color?: string
  className?: string
}

// Cache SVG content après le premier fetch (les fichiers sont small)
const svgCache = new Map<string, string>()

export default function PxFigmaIcon({
  name,
  size = 16,
  color = PX.neutral700,
  className,
}: PxFigmaIconProps) {
  const [svg, setSvg] = useState<string | null>(svgCache.get(name) ?? null)

  useEffect(() => {
    if (svg) return
    fetch(`/icons/figma/${name}.svg`)
      .then(r => r.text())
      .then(text => {
        svgCache.set(name, text)
        setSvg(text)
      })
      .catch(() => setSvg(null))
  }, [name, svg])

  // Avant le chargement, on rend un placeholder transparent pour réserver l'espace
  if (!svg) {
    return (
      <span
        className={className}
        style={{
          display: 'inline-block',
          width: size,
          height: size,
        }}
        aria-hidden="true"
      />
    )
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        width: size,
        height: size,
        color,
        flexShrink: 0,
      }}
      aria-hidden="true"
      // SVG injecté inline pour permettre currentColor
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
