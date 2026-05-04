// MEGGA CRM Sugar v2 — Filter dropdown (Acrean style)
// 1:1 port from `crm-screen-biens-sugar.jsx` (BnFilterDropdown).

import { useEffect, useRef, useState } from 'react'
import type { SugarPalette } from '../tokens'

export interface FilterOption {
  value: string
  label: string
}

interface BnFilterDropdownProps {
  label: string
  value: string
  options: FilterOption[]
  onChange: (v: string) => void
  sp: SugarPalette
}

export function BnFilterDropdown({
  label,
  value,
  options,
  onChange,
  sp,
}: BnFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const active = value && value !== 'all'
  const current = options.find(o => o.value === value)

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 36,
          padding: '0 14px',
          borderRadius: 999,
          background: active ? sp.ink : sp.cardBg,
          color: active ? sp.pageBg : sp.ink,
          border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
          cursor: 'pointer',
          fontFamily: 'inherit',
          fontSize: 12.5,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
        }}
      >
        <span
          style={{
            color: active ? 'rgba(255,255,255,.7)' : sp.sub,
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <span>{current?.label || 'Tous'}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M2 4l3 3 3-3"
            stroke={active ? sp.pageBg : sp.sub}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            minWidth: 200,
            background: sp.cardBg,
            border: `1px solid ${sp.cardBorder}`,
            borderRadius: 12,
            boxShadow: sp.shadow,
            padding: 6,
            zIndex: 50,
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          {options.map(o => (
            <button
              key={o.value}
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                height: 32,
                padding: '0 10px',
                borderRadius: 8,
                background: o.value === value ? sp.cardSubBg : 'transparent',
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: o.value === value ? 700 : 500,
                color: sp.ink,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

interface BnSpecProps {
  value: string | number
  label: string
  sp: SugarPalette
}

export function BnSpec({ value, label, sp }: BnSpecProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
        fontSize: 12,
        fontWeight: 500,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ color: sp.ink, fontWeight: 600 }}>{value}</span>
      <span
        style={{
          color: sp.sub,
          fontSize: 10.5,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.3,
        }}
      >
        {label}
      </span>
    </span>
  )
}
