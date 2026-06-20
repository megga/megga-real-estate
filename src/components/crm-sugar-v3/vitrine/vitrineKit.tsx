// MEGGA CRM — Fiche bien « Vitrine » — Kit de primitives (port TS du handoff
// Claude Design crm-bien-vitrine-kit.jsx). Sugar Pure : surfaces blanches,
// ombres douces, accent noir, la PHOTO porte le design (galerie immersive +
// lightbox plein écran). Câblé sur de VRAIES photos quand elles existent.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { crmInitials } from '@/components/crm-sugar/tokens'

// ─── Palettes (light/dark) ───────────────────────────────────────────────
export interface VxPalette {
  bg: string
  bgGradient: string
  card: string
  cardSub: string
  cardSub2: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  hairline: string
  black: string
  blackHover: string
  onAccent: string
  shadowSm: string
  shadow: string
  shadowHov: string
  ok: string
  okBg: string
  warn: string
  warnBg: string
  info: string
  infoBg: string
}

export const VxSP_LIGHT: VxPalette = {
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
  card: '#FFFFFF',
  cardSub: '#F4F6F9',
  cardSub2: '#EBEEF3',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',
  hairline: 'rgba(15,23,42,0.06)',
  black: '#0B0C0E',
  blackHover: '#22242C',
  onAccent: '#FFFFFF',
  shadowSm: '0 1px 2px rgba(15,23,42,.05), 0 6px 18px -10px rgba(40,55,90,.18)',
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 14px 38px -16px rgba(40,55,90,.24)',
  shadowHov: '0 2px 6px rgba(15,23,42,.06), 0 28px 56px -20px rgba(40,55,90,.34)',
  ok: '#0B7A53',
  okBg: 'rgba(5,150,105,.12)',
  warn: '#B45309',
  warnBg: 'rgba(196,90,0,.12)',
  info: '#1E5BC6',
  infoBg: 'rgba(30,91,198,.12)',
}

export const VxSP_DARK: VxPalette = {
  bg: '#0A0A0F',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #1A1D27 0%, #111219 55%, #0A0A0F 100%)',
  card: 'rgba(255,255,255,0.05)',
  cardSub: 'rgba(255,255,255,0.045)',
  cardSub2: 'rgba(255,255,255,0.07)',
  ink: '#F4F6F8',
  inkSoft: '#C4C8D2',
  muted: '#878D9A',
  ghost: '#4A4E59',
  hairline: 'rgba(255,255,255,0.08)',
  black: '#F2F3F6',
  blackHover: '#FFFFFF',
  onAccent: '#0B0C0E',
  shadowSm: '0 1px 2px rgba(0,0,0,.4), 0 6px 18px -10px rgba(0,0,0,.55)',
  shadow: '0 1px 2px rgba(0,0,0,.45), 0 16px 40px -18px rgba(0,0,0,.65)',
  shadowHov: '0 2px 6px rgba(0,0,0,.5), 0 30px 60px -20px rgba(0,0,0,.75)',
  ok: '#34D399',
  okBg: 'rgba(52,211,153,.16)',
  warn: '#FBBF66',
  warnBg: 'rgba(251,191,102,.16)',
  info: '#7FA8F5',
  infoBg: 'rgba(127,168,245,.16)',
}

export const vxPalette = (dark: boolean): VxPalette => (dark ? VxSP_DARK : VxSP_LIGHT)

// ─── Icônes ──────────────────────────────────────────────────────────────
export type VxIconName =
  | 'arrowL' | 'arrowR' | 'chevL' | 'chevR' | 'chevD'
  | 'eye' | 'heart' | 'cal' | 'home' | 'map' | 'bed' | 'bath' | 'ruler'
  | 'layers' | 'flame' | 'sparkle' | 'pencil' | 'plus' | 'lock' | 'globe'
  | 'shield' | 'shieldCheck' | 'check' | 'arrowUp' | 'photos' | 'grid' | 'star'
  | 'close' | 'expand' | 'share' | 'external' | 'trend' | 'phone' | 'mail'
  | 'send' | 'doc' | 'bolt' | 'dot' | 'user' | 'download' | 'sun' | 'surface'
  | 'calendar' | 'trending-up'

const VX_PATHS: Partial<Record<VxIconName, ReactNode>> = {
  arrowL: <path d="M19 12H5M12 19l-7-7 7-7" />,
  arrowR: <path d="M5 12h14M12 5l7 7-7 7" />,
  chevL: <path d="M15 5l-7 7 7 7" />,
  chevR: <path d="M9 5l7 7-7 7" />,
  chevD: <path d="M5 9l7 7 7-7" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />,
  cal: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v9h14v-9" />
    </>
  ),
  map: (
    <>
      <circle cx="12" cy="10" r="3" />
      <path d="M12 22s-7-7-7-12a7 7 0 0 1 14 0c0 5-7 12-7 12Z" />
    </>
  ),
  bed: (
    <>
      <path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10" />
      <path d="M3 14h18M7 11h3" />
    </>
  ),
  bath: (
    <>
      <path d="M5 10V5a2 2 0 0 1 2-2h2" />
      <path d="M3 10h18v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4v-3Z" />
      <path d="M7 21v-1M17 21v-1" />
    </>
  ),
  surface: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18M9 3v18" />
    </>
  ),
  ruler: <path d="M21 3 3 21M9 3l3 3M13 7l3 3M17 11l3 3M3 9l3 3M7 13l3 3M11 17l3 3" />,
  layers: (
    <>
      <path d="m12 2 10 6-10 6L2 8l10-6Z" />
      <path d="m2 14 10 6 10-6" />
      <path d="m2 11 10 6 10-6" />
    </>
  ),
  flame: <path d="M12 2s3 4 3 8a3 3 0 0 1-6 0c0-1 .5-2 1-3 0-2-1-4-1-4-2 3-4 5-4 9a6 6 0 0 0 12 0c0-5-5-10-5-10Z" />,
  sparkle: <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />,
  pencil: (
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
  shieldCheck: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  check: <path d="m5 13 4 4 10-12" />,
  arrowUp: <path d="M12 19V5M5 12l7-7 7 7" />,
  photos: (
    <>
      <rect x="3" y="6" width="14" height="14" rx="2" />
      <path d="M7 2h14v14" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  star: <polygon points="12 2 15 8.5 22 9.5 17 14.5 18.5 21.5 12 18 5.5 21.5 7 14.5 2 9.5 9 8.5" />,
  close: <path d="M18 6 6 18M6 6l12 12" />,
  expand: <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />,
  share: (
    <>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4" />
    </>
  ),
  external: (
    <>
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M21 7v6h-6" />
    </>
  ),
  'trending-up': (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M21 7v6h-6" />
    </>
  ),
  phone: <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z" />,
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-10 6L2 7" />
    </>
  ),
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  doc: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M9 13h6M9 17h6" />
    </>
  ),
  bolt: <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" />,
  dot: <circle cx="12" cy="12" r="3" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
}

export function VxIcon({
  name,
  size = 18,
  stroke = 'currentColor',
  sw = 1.6,
  style,
}: {
  name: VxIconName
  size?: number
  stroke?: string
  sw?: number
  style?: CSSProperties
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      style={style}
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {VX_PATHS[name] ?? null}
    </svg>
  )
}

// ─── Formatters CHF (apostrophes suisses) ─────────────────────────────────
export function vxFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return (
    'CHF ' +
    Math.round(n).toLocaleString('fr-CH').replace(/ /g, "'").replace(/[\s,]/g, "'")
  )
}
export function vxFmtNum(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('fr-CH').replace(/ /g, "'").replace(/[\s,]/g, "'")
}
export function vxCompact(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return '' + n
}

// ─── Photo : image réelle si dispo, sinon placeholder déterministe ────────
const VX_HUES = [210, 28, 165, 268, 18, 200, 42, 150]
export function VxPhoto({
  src,
  index = 0,
  dark,
  radius = 0,
  style,
  children,
}: {
  src?: string | null
  index?: number
  dark: boolean
  radius?: number
  style?: CSSProperties
  children?: ReactNode
}) {
  const [err, setErr] = useState(false)
  const overlay = (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0) 46%, rgba(0,0,0,.34) 100%)',
      }}
    />
  )
  if (src && !err) {
    return (
      <div style={{ position: 'absolute', inset: 0, borderRadius: radius, overflow: 'hidden', ...style }}>
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
  const h = VX_HUES[index % VX_HUES.length]
  const sat = dark ? 20 : 26
  const l1 = dark ? 30 : 70
  const l2 = dark ? 16 : 50
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        borderRadius: radius,
        overflow: 'hidden',
        background: `linear-gradient(145deg, hsl(${h} ${sat}% ${l1}%), hsl(${(h + 28) % 360} ${sat}% ${l2}%))`,
        ...style,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: dark ? 0.18 : 0.22,
          backgroundImage:
            'repeating-linear-gradient(58deg, rgba(255,255,255,.55) 0 1px, transparent 1px 13px)',
        }}
      />
      {overlay}
      {children}
    </div>
  )
}

// ─── Galerie mosaïque (1 grande + 2×2) ────────────────────────────────────
export function VxGallery({
  photos,
  count,
  dark,
  onOpen,
}: {
  photos: string[]
  count: number
  dark: boolean
  onOpen: (i: number) => void
}) {
  const sp = vxPalette(dark)
  const tile = (i: number, extra?: ReactNode) => (
    <button
      key={i}
      onClick={() => onOpen(i)}
      className="vx-tile"
      style={{
        position: 'relative',
        border: 0,
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        borderRadius: 0,
        background: sp.cardSub,
        fontFamily: 'inherit',
      }}
    >
      <VxPhoto src={photos[i]} index={i} dark={dark} />
      {extra}
    </button>
  )
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.62fr 1fr', gap: 6, height: 460 }}>
      {tile(0)}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 6 }}>
        {tile(1)}
        {tile(2)}
        {tile(3)}
        {tile(
          4,
          count > 5 ? (
            <span
              style={{
                position: 'absolute',
                inset: 0,
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(8,10,14,.52)',
                color: '#fff',
                backdropFilter: 'blur(2px)',
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: -0.3,
              }}
            >
              +{count - 5}
            </span>
          ) : undefined,
        )}
      </div>
    </div>
  )
}

// ─── Lightbox plein écran ─────────────────────────────────────────────────
export function VxLightbox({
  open,
  index,
  photos,
  count,
  onClose,
  onIndex,
}: {
  open: boolean
  index: number
  photos: string[]
  count: number
  onClose: () => void
  onIndex: (i: number) => void
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') onIndex((index + 1) % count)
      else if (e.key === 'ArrowLeft') onIndex((index - 1 + count) % count)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, index, count, onClose, onIndex])
  if (!open) return null
  const navBtn = (dir: 'prev' | 'next', name: VxIconName) => (
    <button
      onClick={() => onIndex((index + (dir === 'next' ? 1 : count - 1)) % count)}
      style={{
        width: 52,
        height: 52,
        borderRadius: 999,
        border: 0,
        cursor: 'pointer',
        background: 'rgba(255,255,255,.10)',
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        backdropFilter: 'blur(8px)',
        transition: 'background .15s',
        flexShrink: 0,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,.10)')}
    >
      <VxIcon name={name} size={22} stroke="#fff" sw={1.8} />
    </button>
  )
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(8,9,12,.92)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'vxFade .2s ease-out',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '20px 26px', color: '#fff', flexShrink: 0 }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, letterSpacing: 0.6 }}>
          <span style={{ fontWeight: 600 }}>{String(index + 1).padStart(2, '0')}</span>
          <span style={{ opacity: 0.5 }}> / {String(count).padStart(2, '0')}</span>
        </div>
        <div style={{ flex: 1 }} />
        <button
          onClick={onClose}
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 0,
            cursor: 'pointer',
            background: 'rgba(255,255,255,.1)',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <VxIcon name="close" size={20} stroke="#fff" sw={1.8} />
        </button>
      </div>
      <div
        style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 22, padding: '0 26px', minHeight: 0 }}
        onClick={e => e.stopPropagation()}
      >
        {navBtn('prev', 'chevL')}
        <div style={{ flex: 1, height: '100%', position: 'relative', borderRadius: 18, overflow: 'hidden', maxWidth: 1180, margin: '0 auto' }}>
          <VxPhoto src={photos[index]} index={index} dark />
        </div>
        {navBtn('next', 'chevR')}
      </div>
      <div
        style={{ display: 'flex', gap: 8, padding: '18px 26px 24px', overflowX: 'auto', flexShrink: 0, justifyContent: 'center' }}
        onClick={e => e.stopPropagation()}
      >
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            onClick={() => onIndex(i)}
            style={{
              position: 'relative',
              width: 84,
              height: 56,
              borderRadius: 8,
              overflow: 'hidden',
              flexShrink: 0,
              border: 0,
              padding: 0,
              cursor: 'pointer',
              opacity: i === index ? 1 : 0.5,
              outline: i === index ? '2px solid #fff' : 'none',
              outlineOffset: 2,
              transition: 'opacity .15s',
            }}
          >
            <VxPhoto src={photos[i]} index={i} dark />
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Pilule de statut (façon KYC : fond plein opaque + texte blanc) ───────
// Libellé via i18n (listings:status.*) ; tonalités conservées telles quelles.
export function VxStatusPill({ status, dark }: { status: string; dark: boolean }) {
  const { t: tr } = useTranslation('listings')
  const map: Record<string, { tone: string; on: string }> = {
    active: { tone: dark ? '#0E9F6E' : '#059669', on: '#fff' },
    reserved: { tone: dark ? '#D97A1E' : '#C45A00', on: '#fff' },
    draft: { tone: '#6B7280', on: '#fff' },
    paused: { tone: dark ? '#7C8593' : '#7A8088', on: '#fff' },
    sold: { tone: dark ? '#E5E7EB' : '#0B0C0E', on: dark ? '#0B0C0E' : '#fff' },
  }
  const m = map[status] || map.draft
  const labelKey = map[status] ? status : 'draft'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '5px 12px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: -0.1,
        color: m.on,
        background: m.tone,
        whiteSpace: 'nowrap',
      }}
    >
      {tr(`status.${labelKey}`)}
    </span>
  )
}

// ─── Pilule méta (icône + label, neutre) ──────────────────────────────────
export function VxMetaPill({
  icon,
  children,
  dark,
}: {
  icon?: VxIconName
  children: ReactNode
  dark: boolean
}) {
  const sp = vxPalette(dark)
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        height: 27,
        padding: '0 13px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        color: sp.inkSoft,
        background: sp.cardSub,
        whiteSpace: 'nowrap',
      }}
    >
      {icon && <VxIcon name={icon} size={12} stroke={sp.inkSoft} sw={1.9} />}
      {children}
    </span>
  )
}

// ─── Carte section blanche (radius 22, ombre douce, fade-up + lift hover) ─
export function VxCard({
  children,
  padding = 26,
  style,
  index = 0,
  hover,
  onClick,
}: {
  children: ReactNode
  padding?: number
  style?: CSSProperties
  index?: number
  hover?: boolean
  onClick?: () => void
}) {
  const [h, setH] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={hover ? () => setH(true) : undefined}
      onMouseLeave={hover ? () => setH(false) : undefined}
      style={{
        background: 'var(--vx-card)',
        borderRadius: 22,
        padding,
        border: '1px solid var(--vx-hairline)',
        boxShadow: h ? 'var(--vx-shadow-hov)' : 'var(--vx-shadow)',
        transform: h ? 'translateY(-3px)' : 'none',
        transition: 'transform .22s cubic-bezier(.2,.8,.2,1), box-shadow .22s',
        animation: `vxFadeUp .5s cubic-bezier(.2,.8,.2,1) ${0.04 * index}s both`,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

// ─── Eyebrow + titre de section ───────────────────────────────────────────
export function VxSectionHead({
  eyebrow,
  title,
  right,
  dark,
}: {
  eyebrow?: string
  title?: string
  right?: ReactNode
  dark: boolean
}) {
  const sp = vxPalette(dark)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 18 }}>
      <div>
        {eyebrow && (
          <div style={{ fontSize: 11.5, fontWeight: 700, color: sp.muted, letterSpacing: 1.1, textTransform: 'uppercase' }}>
            {eyebrow}
          </div>
        )}
        {title && (
          <h2 style={{ margin: eyebrow ? '9px 0 0' : 0, fontSize: 19, fontWeight: 700, color: sp.ink, letterSpacing: -0.4 }}>
            {title}
          </h2>
        )}
      </div>
      {right}
    </div>
  )
}

// ─── Sparkline (avec aire) ────────────────────────────────────────────────
export function VxSpark({ points, color, h = 38 }: { points: number[]; color: string; h?: number }) {
  const max = Math.max(...points)
  const min = Math.min(...points)
  const span = max - min || 1
  const w = 240
  const d = points
    .map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / span) * (h - 6) - 3}`)
    .join(' ')
  const area = `0,${h} ` + d + ` ${w},${h}`
  return (
    <svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" fill="none" style={{ display: 'block', overflow: 'visible' }}>
      <polygon points={area} fill={color} opacity="0.10" />
      <polyline points={d} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

// ─── Avatar initiales ──────────────────────────────────────────────────────
export function VxAvatar({
  name,
  bg,
  size = 40,
  dark,
}: {
  name: string
  bg?: string
  size?: number
  dark: boolean
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        flexShrink: 0,
        background: bg || (dark ? '#2A2D38' : '#0B0C0E'),
        color: '#fff',
        display: 'grid',
        placeItems: 'center',
        fontWeight: 700,
        fontSize: size * 0.34,
      }}
    >
      {crmInitials(name)}
    </div>
  )
}

// ─── Input inline (mode édition) ──────────────────────────────────────────
export function VxEditInput({
  value,
  onChange,
  type = 'text',
  style,
  prefix,
  suffix,
  block,
  dark,
}: {
  value: string | number
  onChange: (v: string) => void
  type?: string
  style?: CSSProperties
  prefix?: ReactNode
  suffix?: ReactNode
  block?: boolean
  dark: boolean
}) {
  const sp = vxPalette(dark)
  return (
    <span
      style={{
        display: block ? 'flex' : 'inline-flex',
        alignItems: 'baseline',
        gap: 5,
        width: block ? '100%' : 'auto',
        background: sp.cardSub,
        borderRadius: 11,
        padding: '4px 11px',
        boxShadow: 'inset 0 0 0 1px ' + sp.hairline,
        boxSizing: 'border-box',
      }}
    >
      {prefix && <span style={{ color: sp.muted, fontSize: 14, fontWeight: 500 }}>{prefix}</span>}
      <input
        type={type}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{
          background: 'transparent',
          border: 0,
          outline: 'none',
          fontFamily: 'inherit',
          color: sp.ink,
          padding: 0,
          width: '100%',
          minWidth: 28,
          ...style,
        }}
      />
      {suffix && <span style={{ color: sp.muted, fontSize: 14, fontWeight: 500 }}>{suffix}</span>}
    </span>
  )
}
