// MEGGA Marketplace — Property X "Single Property — Hero gallery" section.
// Source : Figma node 9613:28969 — layout 1 large + 2x2 grid (5 photos).
//
// Accepte un prop `photos` (string[]) pour afficher les vraies photos du
// bien. Sans prop, fallback sur les images démo Figma pour la route demo
// `/propriete` (sans :id).
//
// Responsive :
//   - desktop (>768px) : layout Figma 1 large + 4 tiles
//   - mobile  (≤768px) : 1 colonne, photo principale puis grille 2×2 réduite

import { useTranslation } from 'react-i18next'
import { lazy, Suspense, useState } from 'react'
import { PX } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'

// Lightbox lazy-loadé : seulement chargé quand l'utilisateur clique sur une
// photo (économise ~150KB sur le bundle initial de la page propriete).
const ListingLightbox = lazy(() => import('@/components/listing/ListingLightbox'))

interface PxSinglePropertyHeroProps {
  photos?: string[]
  title?: string
  listingId?: string
}

const DEMO_IMAGES = [
  '/images/sections/single-property/hero-1-living.jpg',
  '/images/sections/single-property/hero-2-bedroom.jpg',
  '/images/sections/single-property/hero-3-kitchen.jpg',
  '/images/sections/single-property/hero-4-bathroom.jpg',
  '/images/sections/single-property/hero-5-lounge.jpg',
]

const tileStyle: React.CSSProperties = {
  borderRadius: PX.radius.small,
  objectFit: 'cover',
  display: 'block',
  width: '100%',
  height: '100%',
}

export default function PxSinglePropertyHero({ photos, title, listingId }: PxSinglePropertyHeroProps) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('marketplaceProperty.defaultTitle')
  const isMobile = useIsMobile()
  const hasPhotos = !!photos && photos.length > 0
  const count = photos?.length ?? 0

  // Lightbox state : ouvert au clic, navigation au clavier + swipe via le composant.
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const openLightbox = (index: number) => {
    if (!hasPhotos) return
    setLightboxIndex(Math.min(index, count - 1))
    setLightboxOpen(true)
  }

  // On déduplique : si moins de 5 photos, on remplit avec des null (placeholders
  // gris) plutôt que de répéter la même photo. Évite l'effet "même image x5".
  const sourceImages: (string | null)[] = hasPhotos
    ? Array.from({ length: 5 }, (_, i) => photos![i] ?? null)
    : DEMO_IMAGES

  const [main, t1, t2, t3, t4] = sourceImages

  // Hauteurs Hero
  const mainAspect = isMobile ? '4 / 3' : '594.7 / 435.4'

  return (
    <section style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
    }}>
      <div style={{
        width: 'min(1200px, calc(100% - 32px))',
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 594.7fr) minmax(0, 593.2fr)',
        gap: isMobile ? 8 : 12,
        boxSizing: 'border-box',
      }}>
        <button
          type="button"
          onClick={() => openLightbox(0)}
          disabled={!hasPhotos}
          aria-label={resolvedTitle}
          style={{
            width: '100%',
            aspectRatio: mainAspect,
            overflow: 'hidden',
            borderRadius: PX.radius.small,
            background: PX.neutral200,
            border: 0,
            padding: 0,
            cursor: hasPhotos ? 'zoom-in' : 'default',
            display: 'block',
          }}
        >
          {main ? <img src={main} alt={resolvedTitle} style={tileStyle} /> : null}
        </button>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: isMobile ? 8 : 12,
          aspectRatio: isMobile ? '2 / 1' : undefined,
        }}>
          <Tile src={t1} alt={`${resolvedTitle} — 2`} index={1} onClick={() => openLightbox(1)} clickable={hasPhotos} extraCount={count > 5 ? count - 5 : 0} />
          <Tile src={t2} alt={`${resolvedTitle} — 3`} index={2} onClick={() => openLightbox(2)} clickable={hasPhotos} />
          <Tile src={t3} alt={`${resolvedTitle} — 4`} index={3} onClick={() => openLightbox(3)} clickable={hasPhotos} />
          <Tile src={t4} alt={`${resolvedTitle} — 5`} index={4} onClick={() => openLightbox(4)} clickable={hasPhotos} extraOverlay={count > 5} extraCount={count - 5} />
        </div>
      </div>

      {lightboxOpen && hasPhotos ? (
        <Suspense fallback={null}>
          <ListingLightbox
            photos={photos!}
            open={lightboxOpen}
            index={lightboxIndex}
            onClose={() => setLightboxOpen(false)}
            onIndexChange={setLightboxIndex}
            listingId={listingId}
          />
        </Suspense>
      ) : null}
    </section>
  )
}

interface TileProps {
  src: string | null
  alt: string
  index: number
  extraOverlay?: boolean
  extraCount?: number
  onClick?: () => void
  clickable?: boolean
}

function Tile({ src, alt, extraOverlay, extraCount, onClick, clickable }: TileProps) {
  const Wrapper = clickable ? 'button' : 'div'
  return (
    <Wrapper
      onClick={clickable ? onClick : undefined}
      type={clickable ? 'button' : undefined}
      aria-label={clickable ? alt : undefined}
      style={{
        overflow: 'hidden',
        borderRadius: PX.radius.small,
        position: 'relative',
        background: PX.neutral200,
        border: 0,
        padding: 0,
        cursor: clickable ? 'zoom-in' : 'default',
        display: 'block',
        width: '100%',
        height: '100%',
      }}
    >
      {src ? <img src={src} alt={alt} style={tileStyle} /> : null}
      {extraOverlay && extraCount && extraCount > 0 ? (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(20, 22, 28, 0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 18,
          color: PX.neutral100,
          letterSpacing: '-0.4px',
        }}>
          +{extraCount}
        </div>
      ) : null}
    </Wrapper>
  )
}
