import { useState, useEffect, useCallback, useMemo } from 'react'
import { X, ChevronLeft, ChevronRight, Share2, Check, LayoutPanelLeft, SlidersHorizontal, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSwipeNavigation } from '@/hooks/useSwipeNavigation'
import { useZoomPan } from '@/hooks/useZoomPan'
import type { GalleryMediaItem } from '@/lib/galleryMedia'
import type { PhotoTag, FloorPlanHotspot } from '@/types/floorPlan'
import { getRoomLabel } from '@/types/floorPlan'
import InteractiveFloorPlan from '@/components/listing/InteractiveFloorPlan'
import BeforeAfterSlider from '@/components/listing/BeforeAfterSlider'
import BuyerStagingPanel from '@/components/listing/BuyerStagingPanel'

interface ListingLightboxProps {
  photos: string[]
  media?: GalleryMediaItem[]
  open: boolean
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
  // Recommandé features
  photoTags?: PhotoTag[]
  floorPlanUrl?: string
  floorPlanHotspots?: FloorPlanHotspot[]
  stagedPhotos?: string[]
  listingId?: string
}

export default function ListingLightbox({
  photos, media, open, index, onClose, onIndexChange,
  photoTags, floorPlanUrl, floorPlanHotspots, stagedPhotos, listingId,
}: ListingLightboxProps) {
  const allItems = useMemo(() =>
    media ?? photos.map(url => ({ type: 'photo' as const, url })),
    [media, photos]
  )

  // ── Room filter tabs ──
  const [activeRoom, setActiveRoom] = useState<string | null>(null)

  const roomTabs = useMemo(() => {
    if (!photoTags?.length) return []
    const rooms = new Map<string, number>()
    for (const tag of photoTags) {
      rooms.set(tag.room, (rooms.get(tag.room) || 0) + 1)
    }
    return Array.from(rooms.entries()).map(([key, count]) => ({ key, label: getRoomLabel(key), count }))
  }, [photoTags])

  const filteredItems = useMemo(() => {
    if (!activeRoom || !photoTags?.length) return allItems
    const roomUrls = new Set(photoTags.filter(t => t.room === activeRoom).map(t => t.url))
    return allItems.filter(item => roomUrls.has(item.url))
  }, [allItems, activeRoom, photoTags])

  // Map filtered index to real index
  const filteredIndex = useMemo(() => {
    if (!activeRoom) return index
    const currentUrl = allItems[index]?.url
    const idx = filteredItems.findIndex(item => item.url === currentUrl)
    return idx >= 0 ? idx : 0
  }, [index, activeRoom, allItems, filteredItems])

  const currentItem = filteredItems[filteredIndex]
  const isVideo = currentItem?.type === 'video'

  const navigateFiltered = useCallback((newFilteredIdx: number) => {
    const realIdx = allItems.findIndex(item => item.url === filteredItems[newFilteredIdx]?.url)
    if (realIdx >= 0) onIndexChange(realIdx)
  }, [allItems, filteredItems, onIndexChange])

  const goNext = useCallback(() => {
    if (filteredIndex < filteredItems.length - 1) navigateFiltered(filteredIndex + 1)
  }, [filteredIndex, filteredItems.length, navigateFiltered])

  const goPrev = useCallback(() => {
    if (filteredIndex > 0) navigateFiltered(filteredIndex - 1)
  }, [filteredIndex, navigateFiltered])

  // ── Floor plan split view ──
  const [showPlan, setShowPlan] = useState(false)
  const hasFloorPlan = !!floorPlanUrl

  // ── Before/After staging ──
  const [showCompare, setShowCompare] = useState(false)
  const [showBuyerStaging, setShowBuyerStaging] = useState(false)
  const hasStagedMatch = stagedPhotos?.length && currentItem?.type === 'photo' &&
    stagedPhotos.some((_, i) => photos[i] === currentItem.url)
  const stagedUrl = hasStagedMatch
    ? stagedPhotos?.[photos.indexOf(currentItem?.url || '')]
    : undefined

  // ── Share photo ──
  const [shareCopied, setShareCopied] = useState(false)

  // ── Zoom + Swipe ──
  const { isZoomed, style: zoomStyle, containerRef, handlers: zoomHandlers } = useZoomPan({
    index,
    enabled: open && !isVideo && !showCompare,
  })

  const { onTouchStart: swipeTouchStart, onTouchEnd: swipeTouchEnd } = useSwipeNavigation({
    onSwipeLeft: goNext,
    onSwipeRight: goPrev,
    enabled: open && !isZoomed && !showCompare,
  })

  // ── Keyboard ──
  useEffect(() => {
    if (!open) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === 'p' || e.key === 'P') { if (hasFloorPlan) setShowPlan(v => !v) }
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, goNext, goPrev, hasFloorPlan])

  // Reset states when closing (render-time sync)
  const [prevOpen, setPrevOpen] = useState(open)
  if (prevOpen && !open) {
    setActiveRoom(null)
    setShowPlan(false)
    setShowCompare(false)
    setShowBuyerStaging(false)
    setPrevOpen(false)
  } else if (!prevOpen && open) {
    setPrevOpen(true)
  }

  const handleSharePhoto = useCallback(async () => {
    const url = listingId
      ? `${window.location.origin}/listing/${listingId}?photo=${index}`
      : window.location.href
    if (navigator.share) {
      await navigator.share({ title: 'Photo du bien', url })
    } else {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }, [listingId, index])

  const handleFloorPlanRoomClick = useCallback((roomKey: string) => {
    if (!roomKey) {
      setActiveRoom(null)
      return
    }
    setActiveRoom(roomKey)
    // Navigate to first photo of this room
    if (photoTags) {
      const firstTag = photoTags.find(t => t.room === roomKey)
      if (firstTag) {
        const realIdx = allItems.findIndex(item => item.url === firstTag.url)
        if (realIdx >= 0) onIndexChange(realIdx)
      }
    }
  }, [photoTags, allItems, onIndexChange])

  if (!open || !currentItem) return null

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 gap-3">
        <span className="text-white/80 text-sm font-medium">
          {filteredIndex + 1} / {filteredItems.length}
        </span>

        <div className="flex items-center gap-2">
          {/* Before/After toggle */}
          {stagedUrl && (
            <button
              onClick={() => setShowCompare(v => !v)}
              className={cn(
                'h-9 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors',
                showCompare ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'
              )}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Comparer
            </button>
          )}

          {/* Buyer staging */}
          {currentItem?.type === 'photo' && !stagedUrl && (
            <button
              onClick={() => setShowBuyerStaging(v => !v)}
              className={cn(
                'h-9 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors',
                showBuyerStaging ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'
              )}
            >
              <Wand2 className="h-3.5 w-3.5" />
              Essayer meublé
            </button>
          )}

          {/* Floor plan toggle */}
          {hasFloorPlan && (
            <button
              onClick={() => setShowPlan(v => !v)}
              className={cn(
                'h-9 px-3 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors',
                showPlan ? 'bg-white/20 text-white' : 'bg-white/10 text-white/70 hover:bg-white/15'
              )}
              aria-label="Afficher le plan"
            >
              <LayoutPanelLeft className="h-3.5 w-3.5" />
              Plan
            </button>
          )}

          {/* Share photo */}
          {listingId && (
            <button
              onClick={handleSharePhoto}
              className="h-9 px-3 rounded-full text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 flex items-center gap-1.5 transition-colors"
            >
              {shareCopied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
              {shareCopied ? 'Copié' : 'Partager'}
            </button>
          )}

          {/* Close */}
          <button
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Room filter tabs */}
      {roomTabs.length > 0 && (
        <div className="flex gap-1.5 px-4 pb-2 overflow-x-auto scrollbar-hide">
          <button
            onClick={() => setActiveRoom(null)}
            className={cn(
              'h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
              !activeRoom ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 hover:text-white/80'
            )}
          >
            Toutes ({allItems.length})
          </button>
          {roomTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveRoom(tab.key)}
              className={cn(
                'h-8 px-3 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0',
                activeRoom === tab.key ? 'bg-white/20 text-white' : 'bg-white/10 text-white/60 hover:text-white/80'
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      )}

      {/* Main content area */}
      <div className={cn('flex-1 flex min-h-0', showPlan ? 'gap-1' : '')}>
        {/* Photo / Video / Compare */}
        <div
          ref={containerRef}
          className={cn(
            'flex items-center justify-center relative overflow-hidden',
            showPlan ? 'w-[60%] px-2' : 'flex-1 px-4'
          )}
          onTouchStart={(e) => { if (!showCompare) { zoomHandlers.onTouchStart(e); swipeTouchStart(e) } }}
          onTouchMove={(e) => { if (!showCompare) zoomHandlers.onTouchMove(e) }}
          onTouchEnd={(e) => { if (!showCompare) { zoomHandlers.onTouchEnd(); swipeTouchEnd(e) } }}
          onMouseDown={(e) => { if (!showCompare) zoomHandlers.onMouseDown(e) }}
          onMouseMove={(e) => { if (!showCompare) zoomHandlers.onMouseMove(e) }}
          onMouseUp={() => { if (!showCompare) zoomHandlers.onMouseUp() }}
          onMouseLeave={() => { if (!showCompare) zoomHandlers.onMouseUp() }}
        >
          {showCompare && stagedUrl ? (
            <BeforeAfterSlider
              before={currentItem.url}
              after={stagedUrl}
              className="max-h-full max-w-full rounded-lg"
            />
          ) : isVideo ? (
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

          {/* Nav arrows */}
          {filteredIndex > 0 && !isZoomed && !showCompare && (
            <button
              onClick={goPrev}
              className="absolute left-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
          )}
          {filteredIndex < filteredItems.length - 1 && !isZoomed && !showCompare && (
            <button
              onClick={goNext}
              className="absolute right-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
          )}
        </div>

        {/* Floor plan side panel */}
        {showPlan && floorPlanUrl && (
          <div className="w-[40%] flex items-center justify-center p-4 bg-white/5 rounded-lg">
            <InteractiveFloorPlan
              floorPlanUrl={floorPlanUrl}
              hotspots={floorPlanHotspots || []}
              onRoomClick={handleFloorPlanRoomClick}
              activeRoom={activeRoom}
            />
          </div>
        )}
      </div>

      {/* Buyer staging panel overlay */}
      {showBuyerStaging && currentItem?.type === 'photo' && (
        <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20">
          <BuyerStagingPanel
            photoUrl={currentItem.url}
            onClose={() => setShowBuyerStaging(false)}
          />
        </div>
      )}

      {/* Thumbnails */}
      <div className="flex justify-center gap-2 px-4 py-4 overflow-x-auto scrollbar-hide">
        {filteredItems.map((item, i) => (
          <button
            key={i}
            onClick={() => navigateFiltered(i)}
            className={cn(
              'h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all relative',
              filteredIndex === i ? 'border-white opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
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
