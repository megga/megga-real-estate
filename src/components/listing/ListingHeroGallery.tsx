// MEGGA — Bien detail: photo gallery with 3 layout variants.
// Port `megga-bien-gallery.jsx` du bundle (369l proto).
//
// 3 layouts au choix via prop `variant` :
// - `hero` (default) : 1 grande gauche + grille 2×2 droite (5 photos visibles)
// - `mosaic` : 6 photos asymétriques (gridTemplateColumns 2fr 1fr 1fr 1fr × 3 rows)
// - `carousel` : 1 photo full-width + flèches gauche/droite + bandeau de thumbs
//
// Préserve les features du port précédent : video, filtrage par pièce (photoTags),
// mobile carousel snap, image optimization.

import { useState, useRef, useMemo, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight, Images, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { optimizeImageUrl, IMAGE_PRESETS } from '@/lib/imageOptimizer'
import { buildGalleryMedia } from '@/lib/galleryMedia'
import VideoPlayer from '@/components/listing/VideoPlayer'
import type { PhotoTag } from '@/types/floorPlan'

type GalleryVariant = 'hero' | 'mosaic' | 'carousel'

type ListingStatus = 'available' | 'sold' | 'under_contract'

interface ListingHeroGalleryProps {
  photos: string[]
  videoUrl?: string
  title: string
  onOpenLightbox: (index: number) => void
  activeRoom?: string | null
  photoTags?: PhotoTag[]
  /** Layout variant — defaults to 'hero' (1 grande + 2×2). */
  variant?: GalleryVariant
  /** Statut du bien — affiche un overlay diagonal "VENDU"/"SOUS COMPROMIS" si != 'available'. */
  status?: ListingStatus
}

export default function ListingHeroGallery({
  photos, videoUrl, title, onOpenLightbox, activeRoom, photoTags,
  variant = 'hero', status = 'available',
}: ListingHeroGalleryProps) {
  const [mobileIndex, setMobileIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement>(null)

  // Filter photos by active room if set
  const filteredPhotos = useMemo(() => {
    if (!activeRoom || !photoTags?.length) return photos
    const roomUrls = new Set(photoTags.filter(t => t.room === activeRoom).map(t => t.url))
    const filtered = photos.filter(p => roomUrls.has(p))
    return filtered.length > 0 ? filtered : photos
  }, [photos, activeRoom, photoTags])

  const photoCount = filteredPhotos.length
  if (photoCount === 0) {
    return (
      <div className="w-full h-[40vh] bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Building2 className="h-12 w-12 text-gray-500 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Aucune photo disponible</p>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* ── Desktop: layout variant ── */}
      <section className="hidden md:block w-full">
        <div className="relative">
          {variant === 'mosaic' && (
            <GalleryMosaic photos={filteredPhotos} onOpen={onOpenLightbox} />
          )}
          {variant === 'carousel' && (
            <GalleryCarousel
              photos={filteredPhotos}
              onOpen={onOpenLightbox}
              videoUrl={videoUrl}
              title={title}
            />
          )}
          {variant === 'hero' && (
            <GalleryHero
              photos={filteredPhotos}
              onOpen={onOpenLightbox}
              videoUrl={videoUrl}
              title={title}
            />
          )}
          <StatusOverlay status={status} />
        </div>
      </section>

      {/* ── Mobile: horizontal carousel (unchanged) ── */}
      <section className="md:hidden relative">
        <div
          ref={carouselRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none h-[50vh]"
          onScroll={(e) => {
            const el = e.currentTarget
            const idx = Math.round(el.scrollLeft / el.offsetWidth)
            setMobileIndex(idx)
          }}
        >
          {filteredPhotos.map((photo, i) => (
            <div
              key={i}
              className="w-full flex-shrink-0 snap-center cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={`Photo ${i + 1}`}
              onClick={() => onOpenLightbox(i)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenLightbox(i) } }}
            >
              <img
                src={optimizeImageUrl(photo, IMAGE_PRESETS.preview)}
                alt={i === 0 ? title : ''}
                className="w-full h-full object-cover"
                loading={i > 2 ? 'lazy' : undefined}
                decoding="async"
              />
            </div>
          ))}
        </div>
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {filteredPhotos.slice(0, 7).map((_, i) => (
            <div
              key={i}
              className={cn(
                'h-1.5 rounded-full transition-all',
                mobileIndex === i ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
              )}
            />
          ))}
          {photoCount > 7 && <div className="w-1.5 h-1.5 rounded-full bg-white/40" />}
        </div>
        <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full">
          {mobileIndex + 1}/{photoCount}
        </div>
        <StatusOverlay status={status} />
      </section>
    </>
  )
}

// ─── PhotoTile primitive (réutilisé par les 3 layouts) ──────────────────

interface PhotoTileProps {
  src?: string
  onClick?: () => void
  style?: CSSProperties
  alt?: string
  preset?: 'full' | 'preview'
  ariaLabel?: string
}

function PhotoTile({ src, onClick, style, alt = '', preset = 'preview', ariaLabel }: PhotoTileProps) {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel || 'Voir la photo'}
      style={{
        position: 'relative', padding: 0, border: 'none', cursor: 'pointer',
        background: src ? '#E6EBF5' : 'linear-gradient(135deg, #0041D9 0%, #002DA8 100%)',
        overflow: 'hidden', display: 'block',
        ...style,
      }}
    >
      {src ? (
        <img
          src={optimizeImageUrl(src, preset === 'full' ? IMAGE_PRESETS.full : IMAGE_PRESETS.preview)}
          alt={alt}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          loading="lazy"
          decoding="async"
        />
      ) : (
        <div
          style={{
            position: 'absolute', inset: 0, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.6)',
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 10, letterSpacing: 1,
          }}
        >
          PHOTO
        </div>
      )}
    </button>
  )
}

// ─── Variant 1: Hero (1 large gauche + grille 2×2 droite, 5 photos) ─────

interface GalleryHeroProps {
  photos: string[]
  onOpen: (i: number) => void
  videoUrl?: string
  title: string
}

function GalleryHero({ photos, onOpen, videoUrl, title }: GalleryHeroProps) {
  const [a, b, c, d, e] = photos
  const photoCount = photos.length

  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '1.5fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr',
        gap: 6, height: '65vh', maxHeight: 600,
        borderRadius: 16, overflow: 'hidden',
      }}
    >
      <PhotoTile
        src={a}
        onClick={() => onOpen(0)}
        style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }}
        alt={title}
        preset="full"
        ariaLabel={`Voir photo 1 sur ${photoCount}`}
      />
      <PhotoTile src={b} onClick={() => onOpen(1)} ariaLabel="Voir photo 2" />
      <PhotoTile src={c} onClick={() => onOpen(2)} ariaLabel="Voir photo 3" />
      {videoUrl ? (
        <div
          style={{ position: 'relative', overflow: 'hidden' }}
          role="button"
          tabIndex={0}
          onClick={() => onOpen(3)}
          onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onOpen(3) } }}
          aria-label="Voir la vidéo"
        >
          <VideoPlayer src={videoUrl} mode="thumbnail" className="w-full h-full" onClick={() => onOpen(3)} />
        </div>
      ) : (
        <PhotoTile src={d} onClick={() => onOpen(3)} ariaLabel="Voir photo 4" />
      )}
      <PhotoTile src={e} onClick={() => onOpen(4)} ariaLabel="Voir photo 5" />

      {/* "Voir toutes les photos" overlay */}
      <div style={{ position: 'absolute', bottom: 18, right: 18 }}>
        <button
          onClick={() => onOpen(0)}
          aria-label={`Voir toutes les ${photoCount} photos`}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            height: 40, padding: '0 18px', borderRadius: 999, border: 'none',
            background: 'rgba(255,255,255,0.95)', color: '#0E1410',
            fontSize: 13, fontWeight: 700, cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <Images className="h-4 w-4" />
          Voir les {photoCount} photos
        </button>
      </div>
    </div>
  )
}

// ─── Variant 2: Mosaic (6 photos asymétriques) ──────────────────────────

function GalleryMosaic({ photos, onOpen }: { photos: string[]; onOpen: (i: number) => void }) {
  const [a, b, c, d, e, f] = photos
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gridTemplateRows: '1fr 1fr 1fr',
        gap: 6, height: '70vh', maxHeight: 640,
        borderRadius: 16, overflow: 'hidden',
      }}
    >
      <PhotoTile
        src={a}
        onClick={() => onOpen(0)}
        style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }}
        preset="full"
        ariaLabel="Voir photo 1"
      />
      <PhotoTile
        src={b}
        onClick={() => onOpen(1)}
        style={{ gridRow: '1 / 2', gridColumn: '2 / 4' }}
        ariaLabel="Voir photo 2"
      />
      <PhotoTile
        src={c}
        onClick={() => onOpen(2)}
        style={{ gridRow: '2 / 3', gridColumn: '2 / 3' }}
        ariaLabel="Voir photo 3"
      />
      <PhotoTile
        src={d}
        onClick={() => onOpen(3)}
        style={{ gridRow: '2 / 3', gridColumn: '3 / 4' }}
        ariaLabel="Voir photo 4"
      />
      <PhotoTile
        src={e}
        onClick={() => onOpen(4)}
        style={{ gridRow: '1 / 3', gridColumn: '4 / 5' }}
        ariaLabel="Voir photo 5"
      />
      <PhotoTile
        src={f}
        onClick={() => onOpen(5)}
        style={{ gridRow: '3 / 4', gridColumn: '1 / 5' }}
        ariaLabel="Voir photo 6"
      />
    </div>
  )
}

// ─── Variant 3: Carousel (single + flèches + thumbs) ────────────────────

interface GalleryCarouselProps {
  photos: string[]
  onOpen: (i: number) => void
  videoUrl?: string
  title: string
}

function GalleryCarousel({ photos, onOpen, videoUrl, title }: GalleryCarouselProps) {
  const [idx, setIdx] = useState(0)
  const main = photos[idx]
  const photoCount = photos.length
  const media = buildGalleryMedia(photos, videoUrl)
  void media

  return (
    <div>
      <div
        style={{
          position: 'relative',
          height: '70vh', maxHeight: 640,
          borderRadius: 16, overflow: 'hidden',
          background: '#0041D9',
        }}
      >
        {main && (
          <img
            src={optimizeImageUrl(main, IMAGE_PRESETS.full)}
            alt={idx === 0 ? title : ''}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            loading="eager"
            decoding="async"
          />
        )}

        {/* Prev arrow */}
        <button
          onClick={() => setIdx((p) => (p - 1 + photoCount) % photoCount)}
          aria-label="Photo précédente"
          style={{
            position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)',
            width: 44, height: 44, borderRadius: 999, border: 'none',
            background: 'rgba(255,255,255,0.95)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <ChevronLeft className="h-4 w-4 text-gray-800" />
        </button>

        {/* Next arrow */}
        <button
          onClick={() => setIdx((p) => (p + 1) % photoCount)}
          aria-label="Photo suivante"
          style={{
            position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)',
            width: 44, height: 44, borderRadius: 999, border: 'none',
            background: 'rgba(255,255,255,0.95)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
          }}
        >
          <ChevronRight className="h-4 w-4 text-gray-800" />
        </button>

        {/* Open lightbox CTA */}
        <button
          onClick={() => onOpen(idx)}
          aria-label={`Voir toutes les ${photoCount} photos`}
          style={{
            position: 'absolute', bottom: 18, right: 18,
            height: 40, padding: '0 18px', borderRadius: 999, border: 'none',
            background: '#0E1410', color: '#fff', cursor: 'pointer',
            fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <Images className="h-4 w-4" />
          Voir les {photoCount} photos
        </button>

        {/* Counter */}
        <div
          style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(0,0,0,0.4)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            color: '#fff', fontSize: 12, fontWeight: 600,
            padding: '6px 12px', borderRadius: 999,
          }}
        >
          {idx + 1}/{photoCount}
        </div>
      </div>

      {/* Thumbnails strip */}
      <div
        style={{
          display: 'flex', gap: 6, marginTop: 8,
          overflowX: 'auto', paddingBottom: 4,
        }}
      >
        {photos.map((p, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`Voir photo ${i + 1}`}
            style={{
              flex: '0 0 auto', width: 96, height: 64, borderRadius: 8,
              border: idx === i ? '2px solid #0E1410' : '2px solid transparent',
              padding: 0, cursor: 'pointer',
              background: '#E6EBF5',
              overflow: 'hidden',
            }}
          >
            {p && (
              <img
                src={optimizeImageUrl(p, IMAGE_PRESETS.preview)}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                loading="lazy"
                decoding="async"
              />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Status overlay (Vendu / Sous compromis ribbon diagonal) ────────────

function StatusOverlay({ status }: { status: ListingStatus }) {
  if (status === 'available') return null
  const label = status === 'sold' ? 'VENDU' : 'SOUS COMPROMIS'
  const bg = status === 'sold' ? '#0E1410' : '#0041D9'
  return (
    <div
      style={{
        position: 'absolute', top: 0, right: 0, width: 320, height: 320,
        pointerEvents: 'none', overflow: 'hidden', zIndex: 5,
        borderRadius: 16,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 60, right: -60,
          width: 360, transform: 'rotate(35deg)',
          background: bg, color: '#fff',
          fontSize: 22, fontWeight: 800, letterSpacing: 4,
          textAlign: 'center', padding: '12px 0',
          boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
