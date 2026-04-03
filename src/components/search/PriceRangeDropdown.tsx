import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { ChevronDown, Calculator } from 'lucide-react'
import { cn } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────

interface Props {
  minPrice: string
  maxPrice: string
  onChange: (min: string, max: string) => void
  context: 'buy' | 'rent'
  prices?: number[]
  label: string
  active: boolean
}

type PriceMode = 'list' | 'monthly'

// ─── Constants ────────────────────────────────────────────────────────

const BLUE = '#2563EB'
const BLUE_LIGHT = '#DBEAFE'

const BUY_BOUNDS = { min: 0, max: 10_000_000, step: 50_000 }
const RENT_BOUNDS = { min: 0, max: 15_000, step: 100 }
const MONTHLY_BOUNDS = { min: 0, max: 30_000, step: 500 }


// ─── Price formatter ─────────────────────────────────────────────────

function formatPriceShort(v: number): string {
  if (v >= 1_000_000) return `CHF ${(v / 1_000_000).toFixed(1).replace('.0', '')}M`
  if (v >= 1_000) return `CHF ${Math.round(v / 1000)}'000`
  return `CHF ${v}`
}

// ─── Bar Histogram (Zillow-style) ────────────────────────────────────

function PriceHistogram({
  prices,
  bounds,
  rangeMin,
  rangeMax,
  bucketCount = 40,
}: {
  prices: number[]
  bounds: { min: number; max: number }
  rangeMin: number
  rangeMax: number
  bucketCount?: number
}) {
  const buckets = useMemo(() => {
    const bSize = (bounds.max - bounds.min) / bucketCount
    const b = new Array(bucketCount).fill(0) as number[]
    for (const p of prices) {
      const idx = Math.min(Math.floor((p - bounds.min) / bSize), bucketCount - 1)
      if (idx >= 0 && idx < bucketCount) b[idx]++
    }
    return b
  }, [prices, bounds.min, bounds.max, bucketCount])

  const maxCount = Math.max(...buckets, 1)

  return (
    <div className="flex items-end gap-[1.5px] h-20 w-full">
      {buckets.map((count, i) => {
        const bucketStart = bounds.min + (i * (bounds.max - bounds.min)) / bucketCount
        const bucketEnd = bounds.min + ((i + 1) * (bounds.max - bounds.min)) / bucketCount
        const inRange = bucketEnd >= rangeMin && bucketStart <= rangeMax
        const height = count === 0 ? 1 : Math.max(3, (count / maxCount) * 100)

        return (
          <div
            key={i}
            className="flex-1 rounded-t-[1px] transition-colors duration-100"
            style={{
              height: `${height}%`,
              backgroundColor: inRange ? BLUE : '#C7D2E0',
              opacity: inRange ? 1 : 0.5,
            }}
          />
        )
      })}
    </div>
  )
}

// ─── Dual Range Slider (Zillow-style with blue thumbs + tooltip) ─────

function DualRangeSlider({
  min,
  max,
  valueMin,
  valueMax,
  step,
  onChange,
}: {
  min: number
  max: number
  valueMin: number
  valueMax: number
  step: number
  onChange: (min: number, max: number) => void
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState<'min' | 'max' | null>(null)

  const pctMin = ((valueMin - min) / (max - min)) * 100
  const pctMax = ((valueMax - min) / (max - min)) * 100

  const handlePointer = useCallback(
    (thumb: 'min' | 'max') => (e: React.PointerEvent) => {
      e.preventDefault()
      const track = trackRef.current
      if (!track) return
      setDragging(thumb)

      const move = (ev: PointerEvent) => {
        const rect = track.getBoundingClientRect()
        const pct = Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width))
        const raw = min + pct * (max - min)
        const snapped = Math.round(raw / step) * step

        if (thumb === 'min') {
          onChange(Math.min(snapped, valueMax - step), valueMax)
        } else {
          onChange(valueMin, Math.max(snapped, valueMin + step))
        }
      }

      const up = () => {
        setDragging(null)
        document.removeEventListener('pointermove', move)
        document.removeEventListener('pointerup', up)
      }

      document.addEventListener('pointermove', move)
      document.addEventListener('pointerup', up)
    },
    [min, max, step, valueMin, valueMax, onChange]
  )

  return (
    <div className="relative h-6 flex items-center -mt-1" ref={trackRef}>
      {/* Track — left inactive (solid blue line) */}
      <div
        className="absolute h-[2px] rounded-full"
        style={{ left: 0, width: `${pctMin}%`, backgroundColor: BLUE }}
      />
      {/* Track — active range (solid blue line) */}
      <div
        className="absolute h-[2px] rounded-full"
        style={{ left: `${pctMin}%`, width: `${pctMax - pctMin}%`, backgroundColor: BLUE }}
      />
      {/* Track — right inactive (dashed blue line) */}
      <svg className="absolute h-[2px]" style={{ left: `${pctMax}%`, width: `${100 - pctMax}%` }}>
        <line x1="0" y1="1" x2="100%" y2="1" stroke={BLUE} strokeWidth="2" strokeDasharray="4 3" opacity="0.5" />
      </svg>

      {/* Min thumb */}
      <div
        className="absolute z-20 -translate-x-1/2 cursor-grab active:cursor-grabbing"
        style={{ left: `${pctMin}%` }}
        onPointerDown={handlePointer('min')}
      >
        {/* Tooltip */}
        {(dragging === 'min' || valueMin > min) && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none">
            <div className="bg-white border border-gray-200 shadow-md rounded-md px-2 py-1 text-xs font-semibold text-gray-900 whitespace-nowrap">
              {formatPriceShort(valueMin)}
            </div>
            <div className="w-2 h-2 bg-white border-r border-b border-gray-200 rotate-45 mx-auto -mt-1" />
          </div>
        )}
        {/* Glow ring */}
        <div className={cn(
          'w-8 h-8 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity',
          dragging === 'min' ? 'opacity-100' : 'opacity-0'
        )} style={{ backgroundColor: BLUE_LIGHT }} />
        {/* Dot */}
        <div className="relative w-5 h-5 rounded-full border-[3px] border-white shadow-md" style={{ backgroundColor: BLUE }} />
      </div>

      {/* Max thumb */}
      <div
        className="absolute z-20 -translate-x-1/2 cursor-grab active:cursor-grabbing"
        style={{ left: `${pctMax}%` }}
        onPointerDown={handlePointer('max')}
      >
        {/* Glow ring */}
        <div className={cn(
          'w-8 h-8 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 transition-opacity',
          dragging === 'max' ? 'opacity-100' : 'opacity-0'
        )} style={{ backgroundColor: BLUE_LIGHT }} />
        {/* Dot */}
        <div className="relative w-5 h-5 rounded-full border-[3px] border-white shadow-md" style={{ backgroundColor: BLUE }} />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────

export default function PriceRangeDropdown({ minPrice, maxPrice, onChange, context, prices = [], label, active }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PriceMode>('list')
  const ref = useRef<HTMLDivElement>(null)

  const bounds = context === 'rent' ? RENT_BOUNDS : mode === 'monthly' ? MONTHLY_BOUNDS : BUY_BOUNDS

  const [localMin, setLocalMin] = useState(minPrice ? Number(minPrice) : bounds.min)
  const [localMax, setLocalMax] = useState(maxPrice ? Number(maxPrice) : bounds.max)

  useEffect(() => {
    setLocalMin(minPrice ? Number(minPrice) : bounds.min)
    setLocalMax(maxPrice ? Number(maxPrice) : bounds.max)
  }, [minPrice, maxPrice, bounds.min, bounds.max])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function applyRange() {
    const min = localMin <= bounds.min ? '' : String(localMin)
    const max = localMax >= bounds.max ? '' : String(localMax)
    onChange(min, max)
    setOpen(false)
  }

  const [inputMin, setInputMin] = useState('')
  const [inputMax, setInputMax] = useState('')

  useEffect(() => {
    setInputMin(localMin <= bounds.min ? '' : String(localMin))
    setInputMax(localMax >= bounds.max ? '' : String(localMax))
  }, [localMin, localMax, bounds.min, bounds.max])

  return (
    <div className="relative" ref={ref}>
      {/* Trigger pill */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1 h-9 px-3 text-xs font-medium rounded-lg transition-all duration-150 whitespace-nowrap cursor-pointer',
          active
            ? 'bg-gray-900 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        )}
      >
        {label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', active ? 'text-white/60' : 'text-gray-400', open && 'rotate-180')} />
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 w-[360px] bg-white rounded-xl shadow-xl border border-gray-100 z-50 p-5">
          {/* Header — blue like Zillow */}
          <p className="text-sm font-bold mb-4" style={{ color: BLUE }}>Fourchette de prix</p>

          {/* Mode toggle — blue border + blue fill */}
          {context === 'buy' && (
            <div className="flex rounded-lg overflow-hidden mb-4" style={{ border: `2px solid ${BLUE}` }}>
              <button
                onClick={() => setMode('list')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-bold transition-colors',
                  mode === 'list' ? 'text-white' : 'bg-white text-gray-800 hover:bg-blue-50'
                )}
                style={mode === 'list' ? { backgroundColor: BLUE } : undefined}
              >
                Prix de vente
              </button>
              <button
                onClick={() => setMode('monthly')}
                className={cn(
                  'flex-1 py-2.5 text-xs font-bold transition-colors',
                  mode === 'monthly' ? 'text-white' : 'bg-white text-gray-800 hover:bg-blue-50'
                )}
                style={mode === 'monthly' ? { backgroundColor: BLUE } : undefined}
              >
                Mensualité
              </button>
            </div>
          )}

          {/* Calculator link */}
          <button className="flex items-center gap-2.5 mb-5 group">
            <Calculator className="h-5 w-5" style={{ color: BLUE }} />
            <span className="text-sm font-bold text-gray-900 group-hover:underline">Calculer votre accessibilité</span>
          </button>

          {/* Histogram — bar chart */}
          <PriceHistogram
            prices={prices}
            bounds={bounds}
            rangeMin={localMin}
            rangeMax={localMax}
          />

          {/* Dual range slider — blue thumbs with glow */}
          <DualRangeSlider
            min={bounds.min}
            max={bounds.max}
            valueMin={localMin}
            valueMax={localMax}
            step={bounds.step}
            onChange={(min, max) => {
              setLocalMin(min)
              setLocalMax(max)
            }}
          />

          {/* Range labels */}
          <div className="flex justify-between text-xs text-gray-500 font-medium mt-1 mb-5">
            <span>CHF 0</span>
            <span>CHF 10M+</span>
          </div>

          {/* Min / Max inputs — bold labels like Zillow */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Min</label>
              <input
                type="text"
                value={inputMin}
                onChange={(e) => {
                  setInputMin(e.target.value)
                  const n = Number(e.target.value.replace(/[^0-9]/g, ''))
                  if (!isNaN(n)) setLocalMin(Math.max(bounds.min, n))
                }}
                placeholder="Pas de min"
                className="w-full h-11 px-3 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
            <span className="text-gray-400 mt-6 text-lg">–</span>
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-900 mb-1.5">Max</label>
              <input
                type="text"
                value={inputMax}
                onChange={(e) => {
                  setInputMax(e.target.value)
                  const n = Number(e.target.value.replace(/[^0-9]/g, ''))
                  if (!isNaN(n)) setLocalMax(Math.min(bounds.max, n))
                }}
                placeholder="Pas de max"
                className="w-full h-11 px-3 text-sm bg-gray-100 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* Apply button — blue like Zillow */}
          <button
            onClick={applyRange}
            className="w-full h-12 text-white text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
            style={{ backgroundColor: BLUE }}
          >
            Appliquer
          </button>
        </div>
      )}
    </div>
  )
}
