// MEGGA CRM Sugar v2 — Mini probability ring (used inside DealCard).

interface MiniRingProps {
  value: number
  color: string
  bg: string
  ink?: string
  size?: number
}

export function SugarMiniRing({ value, color, bg, ink = '#0E1410', size = 36 }: MiniRingProps) {
  const r = (size / 2) - 4
  const c = 2 * Math.PI * r
  const off = c * (1 - value / 100)
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke={bg} strokeWidth="3" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="3" fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontSize: 9.5, fontWeight: 800, color: ink,
        fontVariantNumeric: 'tabular-nums',
      }}>{value}</div>
    </div>
  )
}
