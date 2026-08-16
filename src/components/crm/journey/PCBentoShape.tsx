// MEGGA CRM Sugar v2 — Bento shape SVG with concave notch (header avatar tray)
// 1:1 port from `crm-screen-journey-screen.jsx` (PCBentoShape).

import { crmVoileEncre } from '@/components/crm/tokens'
import { useLayoutEffect, useRef, useState } from 'react'

interface PCBentoShapeProps {
  headerH: number
  notchW: number
  notchDepth: number
  fill: string
  stroke: string
  shadow?: string
}

export function PCBentoShape({
  notchW,
  notchDepth,
  fill,
  stroke,
  shadow,
}: PCBentoShapeProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    if (!ref.current) return
    const el = ref.current
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const W = size.w
  const H = size.h
  const R = 30

  let path = ''
  if (W > 0 && H > 0) {
    const notchStartX = Math.max(R + 24, (W - notchW) / 2)
    const notchEndX = Math.min(W - R - 24, notchStartX + notchW)
    const sideCurve = 36
    const flatY = notchDepth
    path = [
      `M 0 ${R}`,
      `Q 0 0 ${R} 0`,
      `L ${notchStartX} 0`,
      `C ${notchStartX + sideCurve * 0.55} 0, ${
        notchStartX + sideCurve * 0.45
      } ${flatY}, ${notchStartX + sideCurve} ${flatY}`,
      `L ${notchEndX - sideCurve} ${flatY}`,
      `C ${notchEndX - sideCurve * 0.45} ${flatY}, ${
        notchEndX - sideCurve * 0.55
      } 0, ${notchEndX} 0`,
      `L ${W - R} 0`,
      `Q ${W} 0 ${W} ${R}`,
      `L ${W} ${H - R}`,
      `Q ${W} ${H} ${W - R} ${H}`,
      `L ${R} ${H}`,
      `Q 0 ${H} 0 ${H - R}`,
      'Z',
    ].join(' ')
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        filter: shadow
          ? `drop-shadow(0 12px 28px ${crmVoileEncre(false, 0.10)}) drop-shadow(0 2px 6px ${crmVoileEncre(false, 0.05)})`
          : 'none',
      }}
    >
      {W > 0 && H > 0 && (
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', overflow: 'visible' }}
        >
          <path d={path} fill={fill} stroke={stroke} strokeWidth="1" />
        </svg>
      )}
    </div>
  )
}
