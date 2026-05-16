// MEGGA Marketplace — Property X "Single Property — Hero gallery" section.
// Source : Figma node 9613:28969 — layout 1 large + 2x2 grid (5 photos).
//
// Optimisations :
//   - Photo principale : variant `hero` (1600w) + srcset + fetchPriority=high
//     + loading=eager + decoding=async (LCP-friendly)
//   - Tiles 2-5 : variant `detail` (1200w) + srcset + loading=lazy
//   - Si photos_cf absent (listings Flatfox non encore backfillés), fallback
//     sur Flatfox URL avec referrerPolicy=no-referrer (anti-hotlink)
//
// Layout :
//   - desktop (>768px) : grid 2 cols. Photo principale (594.7fr) + grille 2x2
//     (593.2fr), DEUX avec aspectRatio matching pour éliminer le trou visuel
//     en bas quand les ratios diffèrent.
//   - mobile  (≤768px) : 1 colonne, photo principale 4/3 + grille 2x2 2/1

import { lazy, Suspense, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PX } from '..'
import { useIsMobile } from '@/hooks/useMediaQuery'
import { pickPhoto, pickSrcSet, type CFVariant } from '@/lib/listingPhotos'

const ListingLightbox = lazy(() => import('@/components/listing/ListingLightbox'))

interface PxSinglePropertyHeroProps {
  photos?: string[]
  photosCf?: CFVariant[] | null
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

// Matching aspect ratio between main photo and 2x2 grid block.
// Figma : photo principale 594.7×435.4 (ratio 1.366). On donne le même ratio
// au bloc 2x2 pour que les deux blocs aient EXACTEMENT la même hauteur,
// peu importe l'aspect réel des images chargées dedans.
const HERO_ASPECT_RATIO = '594.7 / 435.4'

export default function PxSinglePropertyHero({ photos, photosCf, title, listingId }: PxSinglePropertyHeroProps) {
  const { t } = useTranslation()
  const resolvedTitle = title ?? t('marketplaceProperty.defaultTitle')
  const isMobile = useIsMobile()
  const hasPhotos = !!photos && photos.length > 0
  const count = photos?.length ?? 0

  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState(0)
  const openLightbox = (index: number) => {
    if (!hasPhotos) return
    setLightboxIndex(Math.min(index, count - 1))
    setLightboxOpen(true)
  }

  // Photo source + responsive variants. Si pas de photos_cf (Flatfox raw),
  // pickPhoto retourne photos[index]. Pas de srcset dans ce cas (le browser
  // utilise juste src).
  const data = { photos: photos ?? null, photos_cf: photosCf ?? null }
  const photoForIndex = (i: number, variant: 'hero' | 'detail') => {
    if (!hasPhotos) return DEMO_IMAGES[i] ?? null
    return pickPhoto(data, i, variant) ?? null
  }
  const srcSetForIndex = (i: number) => {
    if (!hasPhotos) return undefined
    return pickSrcSet(data, i)
  }

  // 5 photos pour le layout — null si pas dispo (placeholder gris)
  const slots = Array.from({ length: 5 }, (_, i) => ({
    src: photoForIndex(i, i === 0 ? 'hero' : 'detail'),
    srcSet: srcSetForIndex(i),
  }))
  const [main, t1, t2, t3, t4] = slots

  const mainAspect = isMobile ? '4 / 3' : HERO_ASPECT_RATIO
  // En desktop, le bloc 2x2 reçoit le même aspectRatio que la photo principale
  // → garantit la même hauteur, élimine le trou blanc en bas.
  const sideAspect = isMobile ? '2 / 1' : HERO_ASPECT_RATIO

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
        gridTemplateColumns: isMobile ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)',
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
          {main.src ? (
            <img
              src={main.src}
              srcSet={main.srcSet}
              sizes="(max-width: 768px) 100vw, 600px"
              alt={resolvedTitle}
              loading="eager"
              fetchPriority="high"
              decoding="async"
              referrerPolicy="no-referrer"
              style={tileStyle}
            />
          ) : null}
        </button>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: isMobile ? 8 : 12,
          aspectRatio: sideAspect,
        }}>
          <Tile
            slot={t1}
            alt={`${resolvedTitle} — 2`}
            onClick={() => openLightbox(1)}
            clickable={hasPhotos}
            extraCount={count > 5 ? count - 5 : 0}
          />
          <Tile slot={t2} alt={`${resolvedTitle} — 3`} onClick={() => openLightbox(2)} clickable={hasPhotos} />
          <Tile slot={t3} alt={`${resolvedTitle} — 4`} onClick={() => openLightbox(3)} clickable={hasPhotos} />
          <Tile
            slot={t4}
            alt={`${resolvedTitle} — 5`}
            onClick={() => openLightbox(4)}
            clickable={hasPhotos}
            extraOverlay={count > 5}
            extraCount={count - 5}
          />
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
  slot: { src: string | null; srcSet: string | undefined }
  alt: string
  extraOverlay?: boolean
  extraCount?: number
  onClick?: () => void
  clickable?: boolean
}

function Tile({ slot, alt, extraOverlay, extraCount, onClick, clickable }: TileProps) {
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
      {slot.src ? (
        <img
          src={slot.src}
          srcSet={slot.srcSet}
          sizes="(max-width: 768px) 50vw, 300px"
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          style={tileStyle}
        />
      ) : null}
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
