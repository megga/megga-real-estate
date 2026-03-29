import { useRef, useEffect } from 'react'
import { Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  className?: string
  mode: 'thumbnail' | 'lightbox'
  onClick?: () => void
  /** Reset playback when this changes (e.g. lightbox index) */
  resetKey?: number
}

export default function VideoPlayer({ src, className, mode, onClick, resetKey }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  // Pause and reset when navigating away in lightbox
  useEffect(() => {
    if (resetKey !== undefined && videoRef.current) {
      videoRef.current.pause()
      videoRef.current.currentTime = 0
    }
  }, [resetKey])

  if (mode === 'thumbnail') {
    return (
      <div
        className={cn('relative cursor-pointer group/video', className)}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' && onClick) onClick() }}
        aria-label="Lire la vidéo"
      >
        <video
          ref={videoRef}
          src={src}
          preload="metadata"
          muted
          playsInline
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/20 group-hover/video:bg-black/30 transition-colors flex items-center justify-center">
          <div className="h-12 w-12 rounded-full bg-white/90 flex items-center justify-center shadow-sm">
            <Play className="h-5 w-5 text-gray-900 ml-0.5 fill-gray-900" />
          </div>
        </div>
      </div>
    )
  }

  // Lightbox mode
  return (
    <video
      ref={videoRef}
      src={src}
      controls
      playsInline
      preload="auto"
      className={cn('max-h-full max-w-full object-contain rounded-lg', className)}
      aria-label="Vidéo du bien"
    />
  )
}
