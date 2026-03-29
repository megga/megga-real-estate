import { useState, useRef, useCallback, useEffect } from 'react'
import { MapPinned, ChevronDown, Upload, Trash2, GripVertical } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { FLOOR_PLAN_ROOMS, getRoomLabel } from '@/types/floorPlan'
import type { FloorPlanHotspot, PhotoTag } from '@/types/floorPlan'

interface FloorPlanEditorProps {
  floorPlanUrl: string | null
  hotspots: FloorPlanHotspot[]
  photos: string[]
  photoTags: PhotoTag[]
  onFloorPlanChange: (url: string | null) => void
  onHotspotsChange: (hotspots: FloorPlanHotspot[]) => void
  onPhotoTagsChange: (tags: PhotoTag[]) => void
  onUploadFloorPlan: (file: File) => Promise<string>
  isUploading?: boolean
}

export default function FloorPlanEditor({
  floorPlanUrl,
  hotspots,
  photos,
  // photoTags and onPhotoTagsChange reserved for photo-room tagging (Phase 2)
  onFloorPlanChange,
  onHotspotsChange,
  onUploadFloorPlan,
  isUploading,
}: FloorPlanEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeHotspot, setActiveHotspot] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; startX: number; startY: number } | null>(null)

  // Cleanup stale photo references when photos change
  useEffect(() => {
    if (hotspots.length === 0) return
    const photoSet = new Set(photos)
    const cleaned = hotspots.map(h => ({
      ...h,
      photoUrls: h.photoUrls.filter(url => photoSet.has(url)),
    }))
    const changed = cleaned.some((h, i) => h.photoUrls.length !== hotspots[i].photoUrls.length)
    if (changed) onHotspotsChange(cleaned)
  }, [photos]) // eslint-disable-line react-hooks/exhaustive-deps

  const handlePlanUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 15 * 1024 * 1024) return
    const url = await onUploadFloorPlan(file)
    onFloorPlanChange(url)
  }

  const handlePlanDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    if (file.size > 15 * 1024 * 1024) return
    const url = await onUploadFloorPlan(file)
    onFloorPlanChange(url)
  }

  const handlePlanClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || !containerRef.current) return
    // Don't place hotspot if clicking on an existing one
    const target = e.target as HTMLElement
    if (target.closest('[data-hotspot]')) return

    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100

    const newHotspot: FloorPlanHotspot = {
      id: `hs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      label: '',
      roomKey: 'salon',
      photoUrls: [],
    }
    onHotspotsChange([...hotspots, newHotspot])
    setActiveHotspot(newHotspot.id)
  }, [isDragging, hotspots, onHotspotsChange])

  const updateHotspot = (id: string, updates: Partial<FloorPlanHotspot>) => {
    onHotspotsChange(hotspots.map(h => h.id === id ? { ...h, ...updates } : h))
  }

  const removeHotspot = (id: string) => {
    onHotspotsChange(hotspots.filter(h => h.id !== id))
    if (activeHotspot === id) setActiveHotspot(null)
  }

  const togglePhotoForHotspot = (hotspotId: string, photoUrl: string) => {
    const hs = hotspots.find(h => h.id === hotspotId)
    if (!hs) return
    const has = hs.photoUrls.includes(photoUrl)
    updateHotspot(hotspotId, {
      photoUrls: has ? hs.photoUrls.filter(u => u !== photoUrl) : [...hs.photoUrls, photoUrl],
    })
  }

  // Unified drag handlers (mouse + touch)
  const startDrag = (id: string, clientX: number, clientY: number) => {
    if (!containerRef.current) return
    dragRef.current = { id, startX: clientX, startY: clientY }

    const onMove = (cx: number, cy: number) => {
      if (!dragRef.current || !containerRef.current) return
      setIsDragging(true)
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((cx - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((cy - rect.top) / rect.height) * 100))
      updateHotspot(dragRef.current.id, {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      })
    }

    const onMouseMove = (ev: MouseEvent) => onMove(ev.clientX, ev.clientY)
    const onTouchMove = (ev: TouchEvent) => { ev.preventDefault(); onMove(ev.touches[0].clientX, ev.touches[0].clientY) }

    const onEnd = () => {
      dragRef.current = null
      setTimeout(() => setIsDragging(false), 50)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onEnd)
  }

  const handleDragStart = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    startDrag(id, e.clientX, e.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    e.stopPropagation()
    startDrag(id, e.touches[0].clientX, e.touches[0].clientY)
  }

  const removePlan = () => {
    onFloorPlanChange(null)
    onHotspotsChange([])
  }

  return (
    <div className="mt-6 rounded-xl border border-theme-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-theme-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
            <MapPinned className="w-4 h-4 text-accent" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-theme-primary">Plan interactif</p>
            <p className="text-xs text-theme-tertiary">Ajoutez un plan et associez vos photos par pièce</p>
          </div>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-theme-muted transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-4 border-t border-theme-border pt-4">
          {!floorPlanUrl ? (
            /* Upload zone */
            <div
              onDragOver={e => e.preventDefault()}
              onDrop={handlePlanDrop}
              className="border-2 border-dashed border-theme-border rounded-lg p-8 text-center hover:border-accent/50 transition-colors"
            >
              <Upload className="w-6 h-6 mx-auto text-theme-muted mb-2" />
              <p className="text-sm text-theme-secondary mb-1">
                {isUploading ? 'Upload en cours...' : 'Glissez votre plan ici'}
              </p>
              <p className="text-xs text-theme-muted mb-3">JPG, PNG, WebP ou SVG — max 15 MB</p>
              <label className="inline-flex items-center gap-2 h-8 px-3 text-xs font-medium border border-theme-border rounded-lg cursor-pointer hover:border-theme-active transition-colors text-theme-secondary hover:text-theme-primary">
                Parcourir
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  onChange={handlePlanUpload}
                  className="hidden"
                />
              </label>
            </div>
          ) : (
            /* Plan editor */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-theme-secondary">
                  Cliquez sur le plan pour placer un point. Glissez pour repositionner.
                </p>
                <button
                  type="button"
                  onClick={removePlan}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Supprimer
                </button>
              </div>

              <div
                ref={containerRef}
                onClick={handlePlanClick}
                className="relative rounded-lg overflow-hidden border border-theme-border cursor-crosshair select-none"
              >
                <img
                  src={floorPlanUrl}
                  alt="Plan d'étage"
                  className="w-full h-auto block"
                  draggable={false}
                  decoding="async"
                />

                {hotspots.map(hs => (
                  <Popover
                    key={hs.id}
                    open={activeHotspot === hs.id}
                    onOpenChange={open => { if (!open) setActiveHotspot(null) }}
                  >
                    <PopoverTrigger asChild>
                      <div
                        data-hotspot
                        role="button"
                        tabIndex={0}
                        onMouseDown={e => handleDragStart(e, hs.id)}
                        onTouchStart={e => handleTouchStart(e, hs.id)}
                        onClick={e => {
                          e.stopPropagation()
                          if (!isDragging) setActiveHotspot(hs.id === activeHotspot ? null : hs.id)
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setActiveHotspot(hs.id === activeHotspot ? null : hs.id)
                          }
                          if (e.key === 'Delete' || e.key === 'Backspace') {
                            e.preventDefault()
                            removeHotspot(hs.id)
                          }
                        }}
                        style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                        className={cn(
                          'absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white cursor-grab active:cursor-grabbing transition-all z-10 flex items-center justify-center animate-in zoom-in-50 duration-200',
                          activeHotspot === hs.id ? 'bg-accent ring-2 ring-accent/30' : 'bg-accent hover:ring-2 hover:ring-accent/20'
                        )}
                        aria-label={`Hotspot ${getRoomLabel(hs.roomKey)}`}
                      >
                        <GripVertical className="w-2.5 h-2.5 text-white" />
                      </div>
                    </PopoverTrigger>

                    <PopoverContent
                      side="right"
                      align="start"
                      className="w-72 p-3 bg-theme-card border border-theme-border rounded-xl"
                      onOpenAutoFocus={e => e.preventDefault()}
                    >
                      <div className="space-y-3">
                        {/* Room selector */}
                        <div>
                          <label className="text-xs text-theme-secondary mb-1 block">Pièce</label>
                          <select
                            value={hs.roomKey}
                            onChange={e => {
                              const room = FLOOR_PLAN_ROOMS.find(r => r.key === e.target.value)
                              updateHotspot(hs.id, {
                                roomKey: e.target.value,
                                label: room?.label ?? e.target.value,
                              })
                            }}
                            className="w-full h-8 px-2 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent text-theme-primary"
                          >
                            {FLOOR_PLAN_ROOMS.map(r => (
                              <option key={r.key} value={r.key}>{r.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* Photo association */}
                        {photos.length > 0 && (
                          <div>
                            <label className="text-xs text-theme-secondary mb-1 block">
                              Photos associées ({hs.photoUrls.length})
                            </label>
                            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto scrollbar-hide">
                              {photos.map((url, i) => (
                                <button
                                  key={i}
                                  type="button"
                                  onClick={() => togglePhotoForHotspot(hs.id, url)}
                                  className={cn(
                                    'relative aspect-square rounded overflow-hidden border-2 transition-colors',
                                    hs.photoUrls.includes(url) ? 'border-accent' : 'border-transparent hover:border-theme-border'
                                  )}
                                >
                                  <img src={url} alt="" className="w-full h-full object-cover" decoding="async" />
                                  {hs.photoUrls.includes(url) && (
                                    <div className="absolute inset-0 bg-accent/20 flex items-center justify-center">
                                      <div className="w-3 h-3 rounded-full bg-accent border border-white" />
                                    </div>
                                  )}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex justify-between items-center pt-1">
                          <button
                            type="button"
                            onClick={() => removeHotspot(hs.id)}
                            className="text-xs text-red-500 hover:text-red-600 transition-colors"
                          >
                            Supprimer
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveHotspot(null)}
                            className="h-7 px-3 text-xs font-medium border border-theme-border rounded-lg hover:border-theme-active transition-colors text-theme-secondary hover:text-theme-primary"
                          >
                            Fermer
                          </button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ))}

                {/* Hotspot labels */}
                {hotspots.map(hs => hs.label && (
                  <div
                    key={`label-${hs.id}`}
                    style={{ left: `${hs.x}%`, top: `${hs.y}%` }}
                    className="absolute translate-x-[-50%] translate-y-3 text-[10px] font-medium bg-gray-900 text-white px-1.5 py-0.5 rounded pointer-events-none whitespace-nowrap z-[5]"
                  >
                    {hs.label}
                  </div>
                ))}
              </div>

              {/* Hotspot summary + photo counter */}
              {hotspots.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-wrap gap-1.5">
                      {hotspots.map(hs => (
                        <span
                          key={hs.id}
                          className="inline-flex items-center gap-1 text-xs text-theme-secondary bg-theme-hover px-2 py-1 rounded-md"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-accent" />
                          {getRoomLabel(hs.roomKey)}
                          {hs.photoUrls.length > 0 && (
                            <span className="text-theme-muted">· {hs.photoUrls.length} photo{hs.photoUrls.length > 1 ? 's' : ''}</span>
                          )}
                        </span>
                      ))}
                    </div>
                    <span className="text-[10px] text-theme-muted whitespace-nowrap ml-2">
                      {hotspots.reduce((n, h) => n + h.photoUrls.length, 0)}/{photos.length} photos taguées
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
