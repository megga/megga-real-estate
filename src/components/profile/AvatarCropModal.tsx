import { useState, useRef, useCallback, useEffect } from 'react'
import { ZoomIn, ZoomOut, RotateCcw, RotateCw, Trash2, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import Modal from '@/components/ui/modal'

// ─── TYPES ──────────────────────────────────────────────────────────────────

interface AvatarCropModalProps {
  open: boolean
  imageSrc: string | null        // data URL of newly selected file
  existingAvatar: string | null  // current saved avatar
  onSave: (dataUrl: string) => void
  onDelete: () => void
  onClose: () => void
}

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const CANVAS_SIZE = 300
const CIRCLE_RADIUS = 118 // leaves 32px margin on each side
const OUTPUT_SIZE = 256
const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.1
const ROTATE_STEP = 90
const PREVIEW_SIZE = 48

// ─── COMPONENT ──────────────────────────────────────────────────────────────

export default function AvatarCropModal({ open, imageSrc, existingAvatar, onSave, onDelete, onClose }: AvatarCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)

  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)

  const src = imageSrc || existingAvatar
  const hasExisting = !!existingAvatar
  const isModified = zoom !== 1 || rotation !== 0 || offset.x !== 0 || offset.y !== 0

  // Load image when modal opens — setState in effect is intentional (sync with external image load)
  useEffect(() => {
    if (!open || !src) return
    setImageLoaded(false) // eslint-disable-line react-hooks/set-state-in-effect
    setZoom(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })

    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      imgRef.current = img
      setImageLoaded(true)
    }
    img.onerror = () => {
      // Fallback: try without crossOrigin for data URLs
      const img2 = new Image()
      img2.onload = () => {
        imgRef.current = img2
        setImageLoaded(true)
      }
      img2.src = src
    }
    img.src = src
  }, [open, src])

  // ─── DRAW FUNCTIONS ───────────────────────────────────────────────────

  const drawImageOnCtx = useCallback((ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, circleR: number, applyClip: boolean) => {
    const img = imgRef.current
    if (!img) return

    const scale = canvasW / CANVAS_SIZE

    if (applyClip) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(canvasW / 2, canvasH / 2, circleR, 0, Math.PI * 2)
      ctx.clip()
    }

    ctx.save()
    ctx.translate(canvasW / 2 + offset.x * scale, canvasH / 2 + offset.y * scale)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(zoom, zoom)

    const imgScale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height) * scale
    const w = img.width * imgScale
    const h = img.height * imgScale
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()

    if (applyClip) {
      ctx.restore()
    }
  }, [zoom, rotation, offset])

  // Draw main canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_SIZE * dpr
    canvas.height = CANVAS_SIZE * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Draw image
    drawImageOnCtx(ctx, CANVAS_SIZE, CANVAS_SIZE, CIRCLE_RADIUS, false)

    // Draw dark overlay outside circle
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.6)'
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    ctx.globalCompositeOperation = 'destination-out'
    ctx.beginPath()
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CIRCLE_RADIUS, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    // Circle border
    ctx.strokeStyle = 'rgba(255,255,255,0.4)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, CIRCLE_RADIUS, 0, Math.PI * 2)
    ctx.stroke()
  }, [drawImageOnCtx])

  // Draw mini preview
  const drawPreview = useCallback(() => {
    const canvas = previewRef.current
    if (!canvas || !imgRef.current) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = PREVIEW_SIZE * dpr
    canvas.height = PREVIEW_SIZE * dpr
    ctx.scale(dpr, dpr)

    // Clear with transparent
    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)

    // Draw clipped to circle
    drawImageOnCtx(ctx, PREVIEW_SIZE, PREVIEW_SIZE, PREVIEW_SIZE / 2, true)
  }, [drawImageOnCtx])

  useEffect(() => {
    if (imageLoaded) {
      draw()
      drawPreview()
    }
  }, [imageLoaded, draw, drawPreview])

  // ─── HANDLERS ─────────────────────────────────────────────────────────

  function handleZoomIn() { setZoom(z => Math.min(z + ZOOM_STEP, MAX_ZOOM)) }
  function handleZoomOut() { setZoom(z => Math.max(z - ZOOM_STEP, MIN_ZOOM)) }
  function handleRotateLeft() { setRotation(r => r - ROTATE_STEP) }
  function handleRotateRight() { setRotation(r => r + ROTATE_STEP) }

  function handleReset() {
    setZoom(1)
    setRotation(0)
    setOffset({ x: 0, y: 0 })
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    if (e.deltaY < 0) handleZoomIn()
    else handleZoomOut()
  }

  function handlePointerDown(e: React.PointerEvent) {
    setDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragging) return
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  function handlePointerUp() { setDragging(false) }

  function handleSave() {
    const img = imgRef.current
    if (!img) return

    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = OUTPUT_SIZE
    outputCanvas.height = OUTPUT_SIZE
    const ctx = outputCanvas.getContext('2d')
    if (!ctx) return

    // Scale proportionally
    const scale = OUTPUT_SIZE / CANVAS_SIZE
    const circleR = CIRCLE_RADIUS * scale

    ctx.save()
    ctx.beginPath()
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, circleR, 0, Math.PI * 2)
    ctx.clip()

    ctx.translate(OUTPUT_SIZE / 2 + offset.x * scale, OUTPUT_SIZE / 2 + offset.y * scale)
    ctx.rotate((rotation * Math.PI) / 180)
    ctx.scale(zoom, zoom)

    const imgScale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height) * scale
    const w = img.width * imgScale
    const h = img.height * imgScale
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
    ctx.restore()

    onSave(outputCanvas.toDataURL('image/jpeg', 0.9))
  }

  return (
    <Modal open={open} onClose={onClose} title="Photo de profil" size="sm">
        {/* Canvas area */}
        <div className="flex items-center justify-center px-6 pt-5 pb-2">
          <canvas
            ref={canvasRef}
            style={{ width: CANVAS_SIZE, height: CANVAS_SIZE, cursor: dragging ? 'grabbing' : 'grab' }}
            className="rounded-xl"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        <p className="text-xs text-theme-tertiary text-center mb-3">
          Glissez pour repositionner · Scrollez pour zoomer
        </p>

        {/* Controls row */}
        <div className="flex items-center justify-center gap-1.5 px-5 pb-2">
          <CtrlBtn onClick={handleZoomOut} tip="Dézoomer" off={zoom <= MIN_ZOOM}>
            <ZoomOut className="w-[18px] h-[18px]" />
          </CtrlBtn>

          <input
            type="range"
            min={MIN_ZOOM * 100}
            max={MAX_ZOOM * 100}
            value={zoom * 100}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            className="w-28 h-1.5 accent-accent mx-1 rounded-full"
          />

          <CtrlBtn onClick={handleZoomIn} tip="Zoomer" off={zoom >= MAX_ZOOM}>
            <ZoomIn className="w-[18px] h-[18px]" />
          </CtrlBtn>

          <Divider />

          <CtrlBtn onClick={handleRotateLeft} tip="Rotation gauche">
            <RotateCcw className="w-[18px] h-[18px]" />
          </CtrlBtn>
          <CtrlBtn onClick={handleRotateRight} tip="Rotation droite">
            <RotateCw className="w-[18px] h-[18px]" />
          </CtrlBtn>

          {isModified && (
            <>
              <Divider />
              <CtrlBtn onClick={handleReset} tip="Réinitialiser">
                <Undo2 className="w-[18px] h-[18px]" />
              </CtrlBtn>
            </>
          )}
        </div>

        {/* Preview + delete row */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-3">
            <canvas
              ref={previewRef}
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
              className="rounded-full border border-theme-border"
            />
            <span className="text-xs text-theme-tertiary">Aperçu</span>
          </div>
          {hasExisting && (
            <button
              onClick={onDelete}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-theme-border">
          <button onClick={onClose} className="h-9 px-4 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors">
            Annuler
          </button>
          <button onClick={handleSave} className="h-9 px-5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors">
            Enregistrer
          </button>
        </div>
    </Modal>
  )
}

// ─── SUB-COMPONENTS ─────────────────────────────────────────────────────────

function CtrlBtn({ children, onClick, tip, off }: {
  children: React.ReactNode; onClick: () => void; tip: string; off?: boolean
}) {
  return (
    <button
      onClick={onClick}
      title={tip}
      disabled={off}
      className={cn(
        'w-9 h-9 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30',
        'text-theme-muted hover:bg-theme-hover hover:text-theme-primary'
      )}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div className="w-px h-6 bg-theme-border mx-1" />
}
