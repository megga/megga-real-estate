// MEGGA CRM Sugar v2 — Mes biens · Galerie — atomes
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx).
// GalPhoto (photo réelle + fallback placeholder), GalStatusPill (façon KYC),
// GalSegmented (statut + bascule vue), GalSortDropdown (tri en surface opaque).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
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
        padding: 'var(--crm-space-xs) var(--crm-space-xl)',
        borderRadius: 'var(--crm-radius-pill)',
        background: st.tone,
        color: onTone,
        fontSize: 'var(--crm-text-sm)',
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
        gap: 'var(--crm-space-2xs)',
        padding: 'var(--crm-space-2xs)',
        borderRadius: 'var(--crm-radius-pill)',
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
              padding: '0 var(--crm-space-2xl)',
              borderRadius: 'var(--crm-radius-pill)',
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 'var(--crm-text-md)',
              fontWeight: on ? 700 : 600,
              background: on ? sp.accent : 'transparent',
              color: on ? sp.accentInk : sp.sub,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-sm)',
              whiteSpace: 'nowrap',
              transition: 'background .15s, color .15s',
            }}
          >
            {o.icon && <MEIcon name={o.icon} size={14} color={on ? sp.pageBg : sp.sub} />}
            {o.label}
            {o.count != null && (
              <span
                style={{
                  fontSize: 'var(--crm-text-xs)',
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                  padding: 'var(--crm-space-2xs) var(--crm-space-sm)',
                  borderRadius: 'var(--crm-radius-pill)',
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
  const { t } = useTranslation('listings')
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
          padding: '0 var(--crm-space-2xl)',
          borderRadius: 'var(--crm-radius-pill)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          background: surf.card,
          border: surf.hairline,
          boxShadow: surf.shadow,
          color: sp.ink,
          fontSize: 'var(--crm-text-md)',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--crm-space-md)',
          whiteSpace: 'nowrap',
        }}
      >
        <MEIcon name="filter" size={13} color={sp.sub} />
        <span style={{ color: sp.sub, fontWeight: 500 }}>{t('gallery.sort')}</span>
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
            borderRadius: 'var(--crm-radius-xl)',
            boxShadow: sp.solidShadow,
            padding: 'var(--crm-space-sm)',
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
                padding: '0 var(--crm-space-xl)',
                borderRadius: 'var(--crm-radius-sm)',
                background: o.value === value ? sp.solidBgSub : 'transparent',
                border: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'var(--crm-text-md)',
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
