// MEGGA CRM Sugar v2 — Mes biens · Galerie — atomes
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx).
// GalPhoto (photo réelle + fallback placeholder), GalStatusPill (façon KYC),
// GalKpi (bandeau portefeuille), GalSegmented (statut + bascule vue),
// GalSortDropdown (tri en surface opaque).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '../../tokens'
import { galStatus, type GalSurfaces } from './galHelpers'

// ─── Vignette photo : image réelle si dispo, sinon placeholder déterministe ──
interface GalPhotoProps {
  id: string
  src?: string | null
  dark: boolean
  radius?: number
  children?: ReactNode
}

export function GalPhoto({ id, src, dark, radius = 0, children }: GalPhotoProps) {
  const [err, setErr] = useState(false)
  const overlay = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,.28) 100%)',
      }}
    />
  )

  if (src && !err) {
    return (
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden' }}>
        <img
          src={src}
          alt=""
          loading="lazy"
          onError={() => setErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {overlay}
        {children}
      </div>
    )
  }

  let n = 0
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) % 360
  const h1 = n
  const h2 = (n + 30) % 360
  const sat = dark ? 18 : 22
  const l1 = dark ? 30 : 78
  const l2 = dark ? 18 : 60
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
        background: `linear-gradient(150deg, hsl(${h1} ${sat}% ${l1}%), hsl(${h2} ${sat}% ${l2}%))`,
      }}
    >
      <svg
        viewBox="0 0 100 75"
        preserveAspectRatio="xMidYMid meet"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: dark ? 0.26 : 0.34 }}
      >
        <path fill="rgba(255,255,255,.5)" d="M50 22 L82 47 L18 47 Z" />
        <path fill="rgba(255,255,255,.32)" d="M26 46 H74 V75 H26 Z" />
        <path fill="rgba(0,0,0,.20)" d="M45 60 H55 V75 H45 Z" />
      </svg>
      {overlay}
      {children}
    </div>
  )
}

// ─── Pilule de statut « façon KYC » : fond plein opaque + texte blanc ────────
export function GalStatusPill({
  status,
  dark,
  style,
}: {
  status: string
  dark: boolean
  style?: CSSProperties
}) {
  const st = galStatus(status, dark)
  const onTone = status === 'sold' && dark ? '#0B0C0E' : '#fff'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 12px',
        borderRadius: 999,
        background: st.tone,
        color: onTone,
        fontSize: 11.5,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        letterSpacing: -0.1,
        ...style,
      }}
    >
      {st.label}
    </span>
  )
}

// ─── Sparkline + delta (tendance, façon maquette) ────────────────────────────
function GalSpark({
  points,
  color,
  w = 240,
  h = 34,
}: {
  points: number[]
  color: string
  w?: number
  h?: number
}) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / span) * (h - 4) - 2}`)
    .join(' ')
  return (
    <svg
      width="100%"
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      fill="none"
      style={{ display: 'block', marginTop: 14, overflow: 'visible' }}
    >
      <polyline
        points={d}
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.9"
      />
    </svg>
  )
}

function GalDelta({ children, color }: { children: ReactNode; color: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 12,
        fontWeight: 700,
        color,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M5 8V2M2 5l3-3 3 3"
          stroke={color}
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {children}
    </span>
  )
}

// ─── Carte KPI portefeuille (tendance : sparkline + évolution 30 j) ──────────
// `value` = donnée réelle ; `spark`/`delta` = tendance illustrative de la maquette.
export function GalKpi({
  label,
  value,
  sub,
  spark,
  delta,
  sp,
  surf,
  dark,
}: {
  label: string
  value: string
  sub?: string
  spark: number[]
  delta?: string
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
}) {
  const ok = dark ? '#34D399' : '#0B7A53'
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: surf.card,
        borderRadius: 18,
        padding: '18px 20px',
        boxShadow: surf.shadow,
        border: surf.hairline,
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <span style={{ fontSize: 11.5, color: sp.sub, fontWeight: 600, letterSpacing: 0.1 }}>
          {label}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div
          style={{
            fontSize: 30,
            fontWeight: 800,
            color: sp.ink,
            letterSpacing: -1,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        {delta ? (
          <GalDelta color={ok}>{delta}</GalDelta>
        ) : (
          sub && <span style={{ fontSize: 12, color: sp.sub, fontWeight: 500 }}>{sub}</span>
        )}
      </div>
      <GalSpark points={spark} color={delta ? ok : sp.sub} />
    </div>
  )
}

// ─── Contrôle segmenté (statut + bascule Galerie/Liste), accent noir ─────────
export interface SegOption {
  value: string
  label: string
  icon?: MEIconName
  count?: number
}

export function GalSegmented({
  options,
  value,
  onChange,
  sp,
  surf,
  dark,
}: {
  options: SegOption[]
  value: string
  onChange: (v: string) => void
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 3,
        padding: 3,
        borderRadius: 999,
        background: surf.cardSub,
        border: surf.hairline,
      }}
    >
      {options.map(o => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 12.5,
              fontWeight: on ? 700 : 600,
              background: on ? sp.ink : 'transparent',
              color: on ? sp.pageBg : sp.sub,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              whiteSpace: 'nowrap',
              transition: 'background .15s, color .15s',
            }}
          >
            {o.icon && <MEIcon name={o.icon} size={14} color={on ? sp.pageBg : sp.sub} />}
            {o.label}
            {o.count != null && (
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  padding: '1px 6px',
                  borderRadius: 999,
                  background: on
                    ? 'rgba(255,255,255,.18)'
                    : dark
                      ? 'rgba(255,255,255,.08)'
                      : 'rgba(15,23,42,.06)',
                  color: on ? sp.pageBg : sp.sub,
                }}
              >
                {o.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Dropdown de tri : surface OPAQUE (sp.solid*) ────────────────────────────
export interface SortOption {
  value: string
  label: string
}

export function GalSortDropdown({
  value,
  options,
  onChange,
  sp,
  surf,
}: {
  value: string
  options: SortOption[]
  onChange: (v: string) => void
  sp: SugarPalette
  surf: GalSurfaces
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  const cur = options.find(o => o.value === value)
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 38,
          padding: '0 14px',
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'inherit',
          background: surf.card,
          border: surf.hairline,
          boxShadow: surf.shadow,
          color: sp.ink,
          fontSize: 12.5,
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          whiteSpace: 'nowrap',
        }}
      >
        <MEIcon name="filter" size={13} color={sp.sub} />
        <span style={{ color: sp.sub, fontWeight: 500 }}>Trier</span>
        <span>{cur?.label}</span>
        <MEIcon name="chevron-down" size={12} color={sp.sub} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 190,
            zIndex: 100,
            background: sp.solidBg,
            border: `1px solid ${sp.solidBorder}`,
            borderRadius: 14,
            boxShadow: sp.solidShadow,
            padding: 6,
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
                height: 34,
                padding: '0 12px',
                borderRadius: 9,
                background: o.value === value ? sp.solidBgSub : 'transparent',
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
