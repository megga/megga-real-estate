// MEGGA Marketplace — Property X icon wrapper FOR REAL FIGMA ICONS.
//
// Charge les vrais SVG exportés depuis Figma via get_design_context et stockés
// dans /public/icons/figma/. Les SVG utilisent `fill="currentColor"` pour
// pouvoir être recoloriés avec `color`/`style.color`.
//
// IMPORTANT : les viewBox des icônes Figma ne sont pas tous carrés. Certains
// icônes (key 18×9, chevron 10×6, etc.) ont des aspect ratios non-1:1. Le
// composant utilise `preserveAspectRatio="xMidYMid meet"` (inscrit dans
// chaque SVG) pour préserver les proportions et centrer dans le conteneur.
//
// Le `size` représente la dimension MAXIMALE (largeur OU hauteur), pas les
// deux — comme dans Figma.

import { useEffect, useState } from 'react'
import { PX } from './tokens'

export type PxFigmaIconName =
  // Real estate amenities (Figma "Small Icon/Vxx")
  | 'key'         // V34 : For rent badge
  | 'tag'         // V35 : For sale badge (tag/étiquette)
  | 'location'    // V37 : map pin
  | 'surface'     // V31 : m² / sqft
  | 'bed'         // V23 : chambres
  | 'bath'        // V33 : salles de bain
  | 'parking'     // V27 : garage / parking
  | 'home-poi'    // Home icon utilisée pour les POI du Hero
  // UI controls (Line Rounded)
  | 'chevron-right'
  | 'chevron-left'
  | 'chevron-down'
  | 'arrow-right'
  | 'plus'
  | 'search'
  | 'sparkle'
  // Badges des eyebrows
  | 'badge-featured-star'
  | 'badge-allprops-home'
  | 'badge-process-check'
  | 'badge-about-user'
  | 'badge-testimonials-message'
  | 'badge-blog-edit'
  | 'badge-blog-resources'
  | 'badge-blog-news'
  | 'blog-calendar'
  // Form icons (Single Property + Contact contact forms)
  | 'form-person'
  | 'form-mail'
  | 'form-phone'
  | 'form-edit'   // V30 : pencil/edit (textarea Message)
  | 'currency'    // V55 : dollar sign in a circle (Listing price)
  | 'link'        // V55 : chain link (Listing images URL)
  | 'home-simple' // V36 : simple solid house silhouette (form headers, listing title)
  | 'check'       // Stroke checkmark (Submit Property hero badge, amenity checked)
  // Contact page badges
  | 'badge-faq'   // V29 : message bubble (FAQs section)

interface PxFigmaIconProps {
  name: PxFigmaIconName
  size?: number
  color?: string
  className?: string
}

// Cache SVG content après le premier fetch
const svgCache = new Map<string, string>()

// Extrait le ratio width/height du viewBox pour calculer les dimensions
function getAspectRatio(svgContent: string): number {
  const match = svgContent.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
  if (!match) return 1
  const w = parseFloat(match[1])
  const h = parseFloat(match[2])
  return h > 0 ? w / h : 1
}

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

  // Placeholder pendant le fetch
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

  // Calcul des dimensions finales selon l'aspect ratio du SVG
  // size = dimension MAX (comme Figma : un icône 18×9 dans un container 16 reste 16×8)
  const aspectRatio = getAspectRatio(svg)
  const width = aspectRatio >= 1 ? size : size * aspectRatio
  const height = aspectRatio >= 1 ? size / aspectRatio : size

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width,
        height,
        color,
        flexShrink: 0,
      }}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
