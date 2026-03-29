import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useZoomPan } from '@/hooks/useZoomPan'
import type { GalleryMediaItem } from '@/lib/galleryMedia'

interface ListingLightboxProps {
  photos: string[]
  media?: GalleryMediaItem[]
  open: boolean
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

export default function ListingLightbox({ photos, media, open, index, onClose, onIndexChange }: ListingLightboxProps) {
  const items = media ?? photos.map(url => ({ type: 'photo' as const, url }))
  const currentItem = items[index]
  const isVideo = currentItem?.type === 'video'

  const goNext = useCallback(() => {
    if (index < items.length - 1) onIndexChange(index + 1)
  }, [index, items.length, onIndexChange])

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1)
  }, [index, onIndexChange])

  const { isZoomed, style: zoomStyle, containerRef, handlers: zoomHandlers } = useZoomPan({
    index,
    enabled: open && !isVideo,
  })

  const { onTouchStart: swipeTouchStart, onTouchEnd: swipeTouchEnd } = useSwipeNavigation({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
    enabled: open && !isZoomed,
  })

  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, goNext, goPrev])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-white/80 text-sm font-medium">{index + 1} / {items.length}</span>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Image / Video */}
      <div
        ref={containerRef}
        className="flex-1 flex items-center justify-center px-4 relative min-h-0 overflow-hidden"
        onTouchStart={(e) => { zoomHandlers.onTouchStart(e); swipeTouchStart(e) }}
        onTouchMove={zoomHandlers.onTouchMove}
        onTouchEnd={(e) => { zoomHandlers.onTouchEnd(); swipeTouchEnd(e) }}
        onMouseDown={zoomHandlers.onMouseDown}
        onMouseMove={zoomHandlers.onMouseMove}
        onMouseUp={zoomHandlers.onMouseUp}
        onMouseLeave={zoomHandlers.onMouseUp}
      >
        {isVideo ? (
          <video
            key={index}
            src={currentItem.url}
            controls
            playsInline
            preload="auto"
            className="max-h-full max-w-full object-contain rounded-lg"
            aria-label="Vidéo du bien"
          />
        ) : (
          <img
            src={currentItem.url}
            alt=""
            className="max-h-full max-w-full object-contain rounded-lg select-none"
            style={zoomStyle}
            draggable={false}
          />
        )}
        {index > 0 && !isZoomed && (
          <button
            onClick={goPrev}
            className="absolute left-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        {index < items.length - 1 && !isZoomed && (
          <button
            onClick={goNext}
            className="absolute right-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronRight className="h-6 w-6 text-white" />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      <div className="flex justify-center gap-2 px-4 py-4 overflow-x-auto scrollbar-hide">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => onIndexChange(i)}
            className={cn(
              'h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all relative',
              index === i ? 'border-white opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
            )}
          >
            {item.type === 'video' ? (
              <>
                <video src={item.url} preload="metadata" className="w-full h-full object-cover" muted />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="h-6 w-6 rounded-full bg-white/80 flex items-center justify-center">
                    <div className="w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-l-[8px] border-l-gray-800 ml-0.5" />
                  </div>
                </div>
              </>
            ) : (
              <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
