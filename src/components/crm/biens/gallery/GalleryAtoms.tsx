// MEGGA CRM Sugar v2 — Mes biens · Galerie — atomes
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx).
// GalPhoto (photo réelle + fallback placeholder), GalStatusPill (façon KYC),
// GalSegmented (statut + bascule vue), GalSortDropdown (tri en surface opaque).

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '../../tokens'
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
  // L'encre vient de `galStatus`, dérivée de l'aplat. Elle était choisie ici —
  // blanc partout, plus une exception pour `sold` en sombre — et échouait l'AA
  // sur six des neuf combinaisons.
  const st = galStatus(status, dark)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: 'var(--crm-space-xs) var(--crm-space-xl)',
        borderRadius: 'var(--crm-radius-pill)',
        background: st.tone,
        color: st.ink,
        fontSize: 'var(--crm-text-sm)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        letterSpacing: -0.1,
        ...style,
      }}
    >
      {st.label}
    </span>
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
  sp: CrmPalette
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
      {/* 36 px et filet seul : la hauteur et le trait de la barre de « Mes biens ».
          « Trier » passe en nom accessible — l'icône le dit déjà à l'œil. */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t('gallery.sort')} : ${cur?.label ?? ''}`}
        style={{
          height: 36,
          boxSizing: 'border-box',
          padding: '0 var(--crm-space-xl)',
          borderRadius: 'var(--crm-radius-pill)',
          cursor: 'pointer',
          fontFamily: 'inherit',
          background: 'transparent',
          border: surf.hairline,
          color: sp.ink,
          fontSize: 'var(--crm-text-lg)',
          fontWeight: 600,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--crm-space-sm)',
          whiteSpace: 'nowrap',
        }}
      >
        <MEIcon name="sort" size={14} color={sp.sub} />
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
                fontWeight: o.value === value ? 600 : 500,
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
