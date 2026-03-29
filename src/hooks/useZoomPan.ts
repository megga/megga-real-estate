import { useState, useRef, useEffect, useCallback } from 'react'

interface UseZoomPanOptions {
  index: number
  enabled?: boolean
  minScale?: number
  maxScale?: number
}

export function useZoomPan({
  index,
  enabled = true,
  minScale = 1,
  maxScale = 5,
}: UseZoomPanOptions) {
  const [scale, setScale] = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)

  // Pinch state
  const pinchRef = useRef<{ initialDist: number; initialScale: number } | null>(null)
  // Pan state
  const panRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null)
  // Double-tap state
  const lastTapRef = useRef<{ time: number; x: number; y: number } | null>(null)
  // Mouse drag state
  const mouseDragRef = useRef<{ startX: number; startY: number; startTx: number; startTy: number } | null>(null)

  const isZoomed = scale > 1.05
  const [isGesturing, setIsGesturing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [prevIndex, setPrevIndex] = useState(index)

  // Reset zoom when photo changes (render-time state sync)
  if (prevIndex !== index) {
    setPrevIndex(index)
    if (scale !== 1 || translate.x !== 0 || translate.y !== 0) {
      setScale(1)
      setTranslate({ x: 0, y: 0 })
      setIsGesturing(false)
      setIsDragging(false)
    }
  }

  const resetZoom = useCallback(() => {
    setScale(1)
    setTranslate({ x: 0, y: 0 })
    setIsGesturing(false)
    setIsDragging(false)
    pinchRef.current = null
    panRef.current = null
    mouseDragRef.current = null
  }, [])

  const clampScale = useCallback((s: number) => Math.min(maxScale, Math.max(minScale, s)), [minScale, maxScale])

  const dist = (t1: React.Touch, t2: React.Touch) =>
    Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    // Pinch (2 fingers)
    if (e.touches.length === 2) {
      const d = dist(e.touches[0], e.touches[1])
      pinchRef.current = { initialDist: d, initialScale: scale }
      panRef.current = null
      setIsGesturing(true)
      return
    }
    // Double-tap detection
    if (e.touches.length === 1) {
      const now = Date.now()
      const touch = e.touches[0]
      const last = lastTapRef.current
      if (last && now - last.time < 300 && Math.abs(touch.clientX - last.x) < 30 && Math.abs(touch.clientY - last.y) < 30) {
        // Double-tap: toggle zoom
        lastTapRef.current = null
        if (isZoomed) {
          resetZoom()
        } else {
          const rect = containerRef.current?.getBoundingClientRect()
          if (rect) {
            const cx = touch.clientX - rect.left - rect.width / 2
            const cy = touch.clientY - rect.top - rect.height / 2
            const newScale = 2.5
            setScale(newScale)
            setTranslate({ x: -cx * (newScale - 1) / newScale, y: -cy * (newScale - 1) / newScale })
          }
        }
        return
      }
      lastTapRef.current = { time: now, x: touch.clientX, y: touch.clientY }

      // Pan start (only when zoomed)
      if (isZoomed) {
        panRef.current = { startX: touch.clientX, startY: touch.clientY, startTx: translate.x, startTy: translate.y }
        setIsGesturing(true)
      }
    }
  }, [enabled, scale, isZoomed, translate, resetZoom])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled) return
    // Pinch zoom
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault()
      const d = dist(e.touches[0], e.touches[1])
      const newScale = clampScale(pinchRef.current.initialScale * (d / pinchRef.current.initialDist))
      setScale(newScale)
      return
    }
    // Pan
    if (e.touches.length === 1 && panRef.current && isZoomed) {
      e.preventDefault()
      const touch = e.touches[0]
      const dx = touch.clientX - panRef.current.startX
      const dy = touch.clientY - panRef.current.startY
      setTranslate({ x: panRef.current.startTx + dx / scale, y: panRef.current.startTy + dy / scale })
    }
  }, [enabled, isZoomed, scale, clampScale])

  const onTouchEnd = useCallback(() => {
    pinchRef.current = null
    panRef.current = null
    setIsGesturing(false)
  }, [])

  // Mouse drag for desktop pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (!enabled || !isZoomed) return
    e.preventDefault()
    mouseDragRef.current = { startX: e.clientX, startY: e.clientY, startTx: translate.x, startTy: translate.y }
    setIsDragging(true)
  }, [enabled, isZoomed, translate])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!mouseDragRef.current) return
    const dx = e.clientX - mouseDragRef.current.startX
    const dy = e.clientY - mouseDragRef.current.startY
    setTranslate({ x: mouseDragRef.current.startTx + dx / scale, y: mouseDragRef.current.startTy + dy / scale })
  }, [scale])

  const onMouseUp = useCallback(() => {
    mouseDragRef.current = null
    setIsDragging(false)
  }, [])

  // Scroll zoom (desktop) — must use native listener for { passive: false }
  useEffect(() => {
    if (!enabled) return
    const el = containerRef.current
    if (!el) return
    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const cx = e.clientX - rect.left - rect.width / 2
      const cy = e.clientY - rect.top - rect.height / 2

      setScale(prev => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
        const next = Math.min(maxScale, Math.max(minScale, prev * factor))
        if (next <= 1.05) {
          setTranslate({ x: 0, y: 0 })
          return 1
        }
        setTranslate(t => ({
          x: t.x - cx * (factor - 1) / next,
          y: t.y - cy * (factor - 1) / next,
        }))
        return next
      })
    }
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [enabled, minScale, maxScale])

  const style: React.CSSProperties = {
    transform: `scale(${scale}) translate(${translate.x}px, ${translate.y}px)`,
    transformOrigin: 'center center',
    transition: isGesturing || isDragging ? 'none' : 'transform 0.2s ease-out',
    cursor: isZoomed ? (isDragging ? 'grabbing' : 'grab') : 'default',
    touchAction: isZoomed ? 'none' : 'auto',
  }

  return {
    scale,
    isZoomed,
    style,
    containerRef,
    resetZoom,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
      onMouseMove,
      onMouseUp,
    },
  }
}
