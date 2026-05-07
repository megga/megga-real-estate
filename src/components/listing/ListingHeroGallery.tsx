// MEGGA — Bien hero gallery (port 1:1 du proto megga-bien-gallery.jsx).
// Trois layouts : hero (1 grande + 2×2), mosaic (6 asymétriques), carousel
// (single + flèches + thumbs). Status overlay diagonal (Vendu / Sous compromis).

import { useState } from 'react'
import { optimizeImageUrl, IMAGE_PRESETS } from '@/lib/imageOptimizer'
import type { PhotoTag } from '@/types/floorPlan'

const M = {
  ink: '#0E1410',
  border: '#E6E8EC',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

type GalleryVariant = 'hero' | 'mosaic' | 'carousel'
type ListingStatus = 'available' | 'sold' | 'under_contract' | 'compromis'

interface ListingHeroGalleryProps {
  photos: string[]
  videoUrl?: string
  title: string
  onOpenLightbox: (index: number) => void
  activeRoom?: string | null
  photoTags?: PhotoTag[]
  /** Layout variant — proto default = "hero" (1 large + 2×2) */
  variant?: GalleryVariant
  /** Statut du bien — affiche un ribbon diagonal "VENDU"/"SOUS COMPROMIS" */
  status?: ListingStatus
}

// ─── PhotoTile primitive (port 1:1 proto) ────────────────────────────────

interface PhotoTileProps {
  src?: string
  onClick?: () => void
  style?: React.CSSProperties
  alt?: string
  label?: string
  preset?: 'full' | 'preview'
}

function PhotoTile({ src, onClick, style, alt = '', label, preset = 'preview' }: PhotoTileProps) {
  const optimizedSrc = src ? optimizeImageUrl(src, preset === 'full' ? IMAGE_PRESETS.full : IMAGE_PRESETS.preview) : null
  return (
    <button
      onClick={onClick}
      aria-label={alt || 'Voir la photo'}
      style={{
        position: 'relative',
        padding: 0,
        border: 'none',
        cursor: 'pointer',
        background: optimizedSrc
          ? `url(${optimizedSrc}) center/cover no-repeat #E6EBF5`
          : 'linear-gradient(135deg, #0041D9 0%, #002DA8 100%)',
        overflow: 'hidden',
        display: 'block',
        ...style,
      }}
    >
      {!optimizedSrc && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: 1,
          }}
        >
          {label || 'PHOTO'}
        </div>
      )}
    </button>
  )
}

// ─── Layout 1: Hero (1 grande + 2×2) ─────────────────────────────────────

interface GalleryLayoutProps {
  photos: string[]
  onOpen: (i: number) => void
  statusOverlay?: React.ReactNode
}

function GalleryHero({ photos, onOpen, statusOverlay }: GalleryLayoutProps) {
  const [a, b, c, d, e] = photos
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 6,
        height: 520,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <PhotoTile src={a} onClick={() => onOpen(0)} style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }} preset="full" />
      <PhotoTile src={b} onClick={() => onOpen(1)} />
      <PhotoTile src={c} onClick={() => onOpen(2)} />
      <PhotoTile src={d} onClick={() => onOpen(3)} />
      <PhotoTile src={e} onClick={() => onOpen(4)} />
      {statusOverlay}
    </div>
  )
}

// ─── Layout 2: Mosaic (6 photos asymétriques) ────────────────────────────

function GalleryMosaic({ photos, onOpen, statusOverlay }: GalleryLayoutProps) {
  const [a, b, c, d, e] = photos
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        gap: 6,
        height: 540,
        borderRadius: 16,
        overflow: 'hidden',
      }}
    >
      <PhotoTile src={a} onClick={() => onOpen(0)} style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }} preset="full" />
      <PhotoTile src={b} onClick={() => onOpen(1)} style={{ gridRow: '1 / 2', gridColumn: '2 / 4' }} />
      <PhotoTile src={c} onClick={() => onOpen(2)} style={{ gridRow: '2 / 3', gridColumn: '2 / 3' }} />
      <PhotoTile src={d} onClick={() => onOpen(3)} style={{ gridRow: '2 / 3', gridColumn: '3 / 4' }} />
      <PhotoTile src={e} onClick={() => onOpen(4)} style={{ gridRow: '1 / 3', gridColumn: '4 / 5' }} />
      <PhotoTile src={photos[5]} onClick={() => onOpen(5)} style={{ gridRow: '3 / 4', gridColumn: '1 / 5' }} />
      {statusOverlay}
    </div>
  )
}

// ─── Layout 3: Carousel (full-width single + arrows + thumbs) ───────────

function GalleryCarousel({ photos, onOpen, statusOverlay }: GalleryLayoutProps) {
  const [idx, setIdx] = useState(0)
  const main = photos[idx]
  const optimizedMain = main ? optimizeImageUrl(main, IMAGE_PRESETS.full) : null
  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: 540,
          borderRadius: 16,
          overflow: 'hidden',
          background: optimizedMain ? `url(${optimizedMain}) center/cover no-repeat` : '#0041D9',
        }}
      >
        <button
          onClick={() => setIdx(p => (p - 1 + photos.length) % photos.length)}
          aria-label="Photo précédente"
          style={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.95)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3l-5 5 5 5" stroke={M.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        <button
          onClick={() => setIdx(p => (p + 1) % photos.length)}
          aria-label="Photo suivante"
          style={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 'none',
            background: 'rgba(255,255,255,0.95)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke={M.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
        </button>
        <button
          onClick={() => onOpen(idx)}
          aria-label={`Voir les ${photos.length} photos`}
          style={{
            position: 'absolute',
            bottom: 18,
            right: 18,
            height: 40,
            padding: '0 18px',
            borderRadius: 999,
            border: 'none',
            background: M.ink,
            color: '#fff',
            cursor: 'pointer',
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="2" width="12" height="9" rx="1.5" stroke="#fff" strokeWidth="1.4" />
            <circle cx="7" cy="6.5" r="2" stroke="#fff" strokeWidth="1.4" />
          </svg>
          Voir les {photos.length} photos
        </button>
        {statusOverlay}
      </div>
      <div
        style={{
          display: 'flex',
          gap: 6,
          marginTop: 8,
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {photos.map((p, i) => {
          const optimizedThumb = p ? optimizeImageUrl(p, IMAGE_PRESETS.preview) : null
          return (
            <button
              key={i}
              onClick={() => setIdx(i)}
              aria-label={`Photo ${i + 1}`}
              style={{
                flex: '0 0 auto',
                width: 96,
                height: 64,
                borderRadius: 8,
                border: idx === i ? `2px solid ${M.ink}` : '2px solid transparent',
                padding: 0,
                cursor: 'pointer',
                background: optimizedThumb ? `url(${optimizedThumb}) center/cover no-repeat` : '#0041D9',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}

// ─── Status overlay (Vendu / Sous compromis ribbon) ─────────────────────

function StatusOverlay({ status }: { status: ListingStatus }) {
  if (status === 'available') return null
  const label = status === 'sold' ? 'VENDU' : 'SOUS COMPROMIS'
  const bg = status === 'sold' ? '#0E1410' : '#0041D9'
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        width: 320,
        height: 320,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 60,
          right: -60,
          width: 360,
          transform: 'rotate(35deg)',
          background: bg,
          color: '#fff',
          fontFamily: FONT,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: 4,
          textAlign: 'center',
          padding: '12px 0',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ─── Main component (port proto window.MEGGA_BienGallery) ───────────────

export default function ListingHeroGallery({
  photos,
  videoUrl: _videoUrl,
  title: _title,
  onOpenLightbox,
  activeRoom,
  photoTags,
  variant = 'hero',
  status = 'available',
}: ListingHeroGalleryProps) {
  void _videoUrl
  void _title

  // Filter photos by active floor-plan room if set
  const filtered = (() => {
    if (!activeRoom || !photoTags?.length) return photos
    const roomUrls = new Set(photoTags.filter(t => t.room === activeRoom).map(t => t.url))
    const r = photos.filter(p => roomUrls.has(p))
    return r.length > 0 ? r : photos
  })()

  if (!filtered || filtered.length === 0) {
    // Proto: no photos → blue gradient placeholder height 520
    return (
      <div
        style={{
          height: 520,
          borderRadius: 16,
          background: 'linear-gradient(135deg, #0041D9 0%, #002DA8 100%)',
        }}
      />
    )
  }

  const overlay = <StatusOverlay status={status} />

  // Mobile: compact horizontal scroll (1 layout)
  return (
    <>
      <section className="hidden md:block">
        {variant === 'mosaic' && filtered.length >= 6 ? (
          <GalleryMosaic photos={filtered} onOpen={onOpenLightbox} statusOverlay={overlay} />
        ) : variant === 'carousel' ? (
          <GalleryCarousel photos={filtered} onOpen={onOpenLightbox} statusOverlay={overlay} />
        ) : (
          <GalleryHero photos={filtered} onOpen={onOpenLightbox} statusOverlay={overlay} />
        )}
      </section>

      {/* Mobile: same proto carousel layout (height 540 → adjusted for mobile) */}
      <section className="md:hidden">
        <GalleryCarousel photos={filtered} onOpen={onOpenLightbox} statusOverlay={overlay} />
      </section>
    </>
  )
}
