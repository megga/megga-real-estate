import { useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ListingLightboxProps {
  photos: string[]
  open: boolean
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

export default function ListingLightbox({ photos, open, index, onClose, onIndexChange }: ListingLightboxProps) {
  const goNext = useCallback(() => {
    if (index < photos.length - 1) onIndexChange(index + 1)
  }, [index, photos.length, onIndexChange])

  const goPrev = useCallback(() => {
    if (index > 0) onIndexChange(index - 1)
  }, [index, onIndexChange])

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
        <span className="text-white/80 text-sm font-medium">{index + 1} / {photos.length}</span>
        <button
          onClick={onClose}
          className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center px-4 relative">
        <img
          src={photos[index]}
          alt=""
          className="max-h-full max-w-full object-contain rounded-lg"
        />
        {index > 0 && (
          <button
            onClick={goPrev}
            className="absolute left-4 h-12 w-12 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="h-6 w-6 text-white" />
          </button>
        )}
        {index < photos.length - 1 && (
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
        {photos.map((photo, i) => (
          <button
            key={i}
            onClick={() => onIndexChange(i)}
            className={cn(
              'h-16 w-24 rounded-lg overflow-hidden flex-shrink-0 border-2 transition-all',
              index === i ? 'border-white opacity-100' : 'border-transparent opacity-40 hover:opacity-70'
            )}
          >
            <img src={photo} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
    </div>
  )
}
