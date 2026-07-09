// MEGGA CRM — Modale « Nouveau contact » (refonte Contacts, port fidèle).
// Source design : `nc-bento-b-live.jsx` (NcbConceptBLive) + `nc-bento-shared.jsx`
// (NcbShell/NcbCard/NcbCta/NcbClose/NcbPhotoPicker/NcbCropEditor/NcbCantonAuto) +
// `nc-refonte-shared.jsx` (atomes NCV). Recréée en TSX propre : styles inline,
// police 'Inter Tight', composants au NIVEAU MODULE (hors du render) pour éviter
// la perte de focus des inputs. Elle REMPLIT le cadre (props `fill` du design) :
// racine 100%×100%, position relative, PAS de portail — l'overlay est posé par le
// parent (ContactsPager). Seule addition hors-design : un consentement RGPD au
// pied (compliance CH) qui bloque « Créer le contact » tant que non coché.

import { useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import type { CriteriaInput } from '@/lib/contactCriteria'
import { NcvIcon, type NcvIconName } from '@/components/crm-sugar/contacts-pager/ncvIcon'

// ═══════════════════════════════════════════════════════════════════════
//   API publique
// ═══════════════════════════════════════════════════════════════════════
export interface NewContactData {
  type: 'buyer' | 'tenant' | 'seller' | 'landlord'
  civility: string
  firstName: string
  lastName: string
  email: string
  phone: string
  lang: string
  canal: string
  note: string
  photo?: string | null
  criteria?: CriteriaInput // acheteur / locataire
  linkedBien?: { address: string; propType: string } // vendeur / bailleur
}

type ContactType = NewContactData['type']

// ═══════════════════════════════════════════════════════════════════════
//   Palette NCB dérivée de `sp` (mappe le design NCB_LIGHT / ncbBuildDark)
// ═══════════════════════════════════════════════════════════════════════
interface NcbC {
  white: string
  cardSubtle: string
  cardSub2: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  line: string
  accent: string
  onAccent: string
  ctaGhostBorder: string
  pageBg: string
  frameBorder: string
  cardShadow: string
  shadowSm: string
  shadowLg: string
  ctaShadow: string
  popoverBg: string
  popoverBorder: string
  popoverShadow: string
  typeColor: Record<ContactType, string>
  dark: boolean
}

const TYPE_COLOR: Record<ContactType, string> = {
  buyer: '#1E5BC6',
  tenant: '#0891B2',
  seller: '#C45A00',
  landlord: '#059669',
}

function buildC(sp: SugarPalette, dark: boolean): NcbC {
  if (!dark) {
    return {
      white: '#FFFFFF',
      cardSubtle: '#F6F7F9',
      cardSub2: '#F0F2F5',
      ink: sp.ink,
      inkSoft: sp.soft,
      muted: sp.sub,
      ghost: '#B5BAC2',
      line: 'rgba(15,23,42,0.07)',
      accent: '#0B0C0E',
      onAccent: '#FFFFFF',
      ctaGhostBorder: 'rgba(11,12,14,.14)',
      pageBg: sp.pageBg,
      frameBorder: sp.frameBorder,
      cardShadow: sp.shadow,
      shadowSm: '0 4px 16px rgba(15,23,42,0.04)',
      shadowLg: '0 24px 60px rgba(15,23,42,0.08), 0 4px 16px rgba(15,23,42,0.04)',
      ctaShadow: '0 8px 20px rgba(11,12,14,0.20)',
      popoverBg: sp.solidBg,
      popoverBorder: sp.solidBorder,
      popoverShadow: sp.solidShadow,
      typeColor: TYPE_COLOR,
      dark: false,
    }
  }
  return {
    white: sp.cardBg,
    cardSubtle: sp.cardSubBg,
    cardSub2: 'rgba(255,255,255,0.07)',
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    ghost: 'rgba(255,255,255,0.28)',
    line: sp.cardBorder,
    accent: sp.ink,
    onAccent: sp.pageBg,
    ctaGhostBorder: sp.cardBorder,
    pageBg: sp.pageBg,
    frameBorder: sp.frameBorder,
    cardShadow: `inset 0 0 0 1px ${sp.cardBorder}, 0 10px 30px -14px rgba(0,0,0,.6)`,
    shadowSm: '0 1px 2px rgba(0,0,0,.4), 0 6px 18px -10px rgba(0,0,0,.6)',
    shadowLg: '0 24px 60px -12px rgba(0,0,0,.65), 0 8px 22px -10px rgba(0,0,0,.55)',
    ctaShadow: '0 10px 26px -8px rgba(0,0,0,.6)',
    popoverBg: '#2A2A2A',
    popoverBorder: sp.solidBorder,
    popoverShadow: sp.solidShadow,
    typeColor: TYPE_COLOR,
    dark: true,
  }
}

// ── Styles d'input Sugar (sans bordure, ring au focus via CSS `.ncbm-in`) ──
const ncvInput = (C: NcbC): CSSProperties => ({
  width: '100%', height: 40, padding: '0 13px', boxSizing: 'border-box',
  background: C.cardSubtle, border: 0, borderRadius: 12,
  color: C.ink, fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit', outline: 'none',
})
const MONO: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' }
const ERR_RING: CSSProperties = { boxShadow: 'inset 0 0 0 2px #B4293D' }

// ── 26 cantons groupés par région linguistique ─────────────────────────
interface CantonRegion { id: string; label: string; cantons: [string, string][] }
const CANTON_REGIONS: CantonRegion[] = [
  { id: 'romande', label: 'Suisse romande', cantons: [['GE', 'Genève'], ['VD', 'Vaud'], ['VS', 'Valais'], ['FR', 'Fribourg'], ['NE', 'Neuchâtel'], ['JU', 'Jura']] },
  {
    id: 'aleman', label: 'Suisse alémanique', cantons: [
      ['ZH', 'Zürich'], ['BE', 'Berne'], ['LU', 'Lucerne'], ['SO', 'Soleure'], ['BS', 'Bâle-Ville'], ['BL', 'Bâle-Camp.'],
      ['AG', 'Argovie'], ['ZG', 'Zoug'], ['SZ', 'Schwyz'], ['UR', 'Uri'], ['OW', 'Obwald'], ['NW', 'Nidwald'],
      ['GL', 'Glaris'], ['SH', 'Schaffhouse'], ['AR', 'Appenzell RE'], ['AI', 'Appenzell RI'], ['SG', 'St-Gall'],
      ['TG', 'Thurgovie'], ['GR', 'Grisons'],
    ],
  },
  { id: 'italienne', label: 'Suisse italienne', cantons: [['TI', 'Tessin']] },
]

// ═══════════════════════════════════════════════════════════════════════
//   ATOMES (module-level → focus des inputs préservé)
// ═══════════════════════════════════════════════════════════════════════
function NcvFieldM({ label, required, C, children }: { label?: string; required?: boolean; C: NcbC; children: ReactNode }) {
  return (
    <div>
      {label && (
        <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>
          {label}{required && <span style={{ color: C.inkSoft }}> *</span>}
        </label>
      )}
      {children}
    </div>
  )
}

function NcbSectionLabelM({ C, children }: { C: NcbC; children: ReactNode }) {
  return <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.ink, marginBottom: 14 }}>{children}</div>
}

function NcbCloseM({ C, onClick, label }: { C: NcbC; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ width: 36, height: 36, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0, background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}
    >
      <NcvIcon name="x" size={16} stroke={C.inkSoft} />
    </button>
  )
}

function NcbCtaM({ C, tone = 'ink', icon, onClick, disabled, children }: {
  C: NcbC; tone?: 'ink' | 'ghost'; icon?: NcvIconName; onClick?: () => void; disabled?: boolean; children: ReactNode
}) {
  const ink = tone === 'ink'
  const off = !!disabled
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      disabled={off}
      style={{
        height: 44, padding: '0 22px', borderRadius: 999, cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
        border: ink ? 0 : `1px solid ${C.ctaGhostBorder}`,
        background: off ? C.cardSubtle : ink ? C.accent : 'transparent',
        color: off ? C.ghost : ink ? C.onAccent : C.inkSoft,
        boxShadow: ink && !off ? C.ctaShadow : 'none',
        display: 'inline-flex', alignItems: 'center', gap: 8,
      }}
    >
      {icon && <NcvIcon name={icon} size={15} stroke={off ? C.ghost : ink ? C.onAccent : C.inkSoft} sw={2.2} />}
      {children}
    </button>
  )
}

function NcbTypePillM({ C, type, label }: { C: NcbC; type: ContactType; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 10px', borderRadius: 999, background: C.typeColor[type], color: '#fff', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

function NcvChipM({ C, active, onClick, check = true, children }: { C: NcbC; active: boolean; onClick: () => void; check?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 34, padding: '0 14px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        background: active ? C.accent : C.cardSubtle, color: active ? C.onAccent : C.inkSoft, border: 0,
        fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 6,
      }}
    >
      {active && check && <NcvIcon name="check" size={12} stroke={C.onAccent} sw={2.2} />}
      {children}
    </button>
  )
}

function NcvAvatarM({ initials, color, size }: { initials: string; color: string; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 700, letterSpacing: 0.3, boxShadow: `0 6px 18px ${color}55` }}>
      {initials}
    </div>
  )
}

function NcbAvatarM({ photo, initials, color, size }: { photo: string | null; initials: string; color: string; size: number }) {
  return photo
    ? <img src={photo} alt="" style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', flexShrink: 0, boxShadow: '0 6px 18px rgba(15,23,42,0.14)' }} />
    : <NcvAvatarM initials={initials} color={color} size={size} />
}

// ── Sélecteur de photo (optionnel, repli sur initiales live) ───────────
function NcbPhotoPickerM({ C, photo, initials, color, onPick, onClear, addLabel, removeLabel }: {
  C: NcbC; photo: string | null; initials: string; color: string
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void; onClear: () => void; addLabel: string; removeLabel: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const S = 74
  const open = () => inputRef.current?.click()
  return (
    <div style={{ position: 'relative', width: S, height: S }}>
      <button
        type="button"
        onClick={open}
        aria-label={addLabel}
        style={{
          width: S, height: S, borderRadius: 999, border: 0, cursor: 'pointer', padding: 0, overflow: 'hidden',
          background: photo ? 'transparent' : initials ? color : C.cardSubtle,
          display: 'grid', placeItems: 'center',
          boxShadow: photo ? C.shadowSm : initials ? `0 6px 18px ${color}55` : 'none',
        }}
      >
        {photo
          ? <img src={photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : initials
            ? <span style={{ color: '#fff', fontWeight: 700, fontSize: S * 0.34, letterSpacing: 0.3 }}>{initials}</span>
            : <NcvIcon name="user" size={S * 0.42} stroke={C.ghost} sw={1.7} />}
      </button>
      <span onClick={open} style={{ position: 'absolute', right: -2, bottom: -2, width: 27, height: 27, borderRadius: 999, cursor: 'pointer', background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}>
        <NcvIcon name="camera" size={14} stroke={C.inkSoft} sw={1.8} />
      </span>
      {photo && (
        <span onClick={onClear} title={removeLabel} style={{ position: 'absolute', right: -2, top: -2, width: 22, height: 22, borderRadius: 999, cursor: 'pointer', background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}>
          <NcvIcon name="x" size={11} stroke={C.inkSoft} sw={2.2} />
        </span>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
    </div>
  )
}

// ── Éditeur de recadrage manuel ────────────────────────────────────────
function NcbCropEditorM({ C, src, onCancel, onDone, title, hint, cancelLabel, validateLabel }: {
  C: NcbC; src: string; onCancel: () => void; onDone: (dataUrl: string) => void
  title: string; hint: string; cancelLabel: string; validateLabel: string
}) {
  const V = 236
  const OUT = 360
  const [dims, setDims] = useState<{ iw: number; ih: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOffState] = useState({ x: 0, y: 0 })
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null)

  const baseScale = dims ? V / Math.min(dims.iw, dims.ih) : 1
  const ds = baseScale * zoom
  const dw = dims ? dims.iw * ds : 0
  const dh = dims ? dims.ih * ds : 0

  const clampXY = (x: number, y: number, z = zoom) => {
    const s = baseScale * z
    const w = (dims ? dims.iw : 0) * s
    const h = (dims ? dims.ih : 0) * s
    const minX = Math.min(0, V - w)
    const minY = Math.min(0, V - h)
    return { x: Math.max(minX, Math.min(0, x)), y: Math.max(minY, Math.min(0, y)) }
  }
  const setOff = (x: number, y: number, z?: number) => setOffState(clampXY(x, y, z))

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const iw = e.currentTarget.naturalWidth
    const ih = e.currentTarget.naturalHeight
    const bs = V / Math.min(iw, ih)
    setDims({ iw, ih })
    setOffState({ x: (V - iw * bs) / 2, y: (V - ih * bs) / 2 })
    setZoom(1)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = { px: e.clientX, py: e.clientY, ox: off.x, oy: off.y }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    if (!d) return
    setOff(d.ox + (e.clientX - d.px), d.oy + (e.clientY - d.py))
  }
  const onPointerUp = () => { dragRef.current = null }

  const onZoom = (z: number) => {
    const Vc = V / 2
    const dsOld = baseScale * zoom
    const dsNew = baseScale * z
    const cx = (Vc - off.x) / dsOld
    const cy = (Vc - off.y) / dsOld
    setZoom(z)
    setOff(Vc - cx * dsNew, Vc - cy * dsNew, z)
  }

  const validate = () => {
    if (!dims || !imgRef.current) return
    const k = OUT / V
    const cv = document.createElement('canvas')
    cv.width = OUT
    cv.height = OUT
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, OUT, OUT)
    ctx.drawImage(imgRef.current, off.x * k, off.y * k, dw * k, dh * k)
    onDone(cv.toDataURL('image/jpeg', 0.9))
  }

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: 'rgba(20,28,45,0.34)', backdropFilter: 'blur(2px)' }}>
      <div style={{ width: 340, background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 24, boxShadow: C.popoverShadow, padding: '24px 24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 15.5, fontWeight: 800, color: C.ink, alignSelf: 'flex-start' }}>{title}</div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: C.muted, alignSelf: 'flex-start', marginTop: 3, marginBottom: 16 }}>{hint}</div>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ position: 'relative', width: V, height: V, borderRadius: 999, overflow: 'hidden', background: C.cardSubtle, cursor: 'grab', touchAction: 'none', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)' }}
        >
          <img
            ref={imgRef}
            src={src}
            alt=""
            onLoad={onImgLoad}
            draggable={false}
            style={{ position: 'absolute', left: off.x, top: off.y, width: dw || 'auto', height: dh || 'auto', maxWidth: 'none', pointerEvents: 'none', userSelect: 'none', opacity: dims ? 1 : 0 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', margin: '18px 0 20px' }}>
          <NcvIcon name="search" size={15} stroke={C.muted} />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.ink, cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: 10, width: '100%', alignItems: 'center' }}>
          <NcbCtaM C={C} tone="ghost" onClick={onCancel}>{cancelLabel}</NcbCtaM>
          <div style={{ flex: 1 }} />
          <NcbCtaM C={C} onClick={validate}>{validateLabel}</NcbCtaM>
        </div>
      </div>
    </div>
  )
}

// ── Autocomplétion cantons (chips + popover) ───────────────────────────
function NcbCantonAutoM({ C, value, onChange, placeholder }: { C: NcbC; value: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const all = useMemo(() => CANTON_REGIONS.flatMap((r) => r.cantons), [])
  const ql = q.trim().toLowerCase()
  const matches = ql
    ? all.filter(([c, n]) => !value.includes(c) && (c.toLowerCase().startsWith(ql) || n.toLowerCase().includes(ql)))
    : all.filter(([c]) => !value.includes(c))
  const nameFor = (code: string) => (all.find(([c]) => c === code) || [code, code])[1]

  const add = (code?: string) => { if (code && !value.includes(code)) onChange([...value, code]); setQ(''); setOpen(false) }
  const remove = (code: string) => onChange(value.filter((x) => x !== code))
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      const exact = all.find(([c]) => c.toLowerCase() === ql)
      const pick = matches[hi] || matches[0]
      add((exact && exact[0]) || (pick && pick[0]))
    } else if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Backspace' && q === '' && value.length) { remove(value[value.length - 1]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div
      ref={boxRef}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}
      style={{ position: 'relative' }}
    >
      <div
        onClick={() => setOpen(true)}
        style={{
          minHeight: 40, padding: '5px 8px', borderRadius: 12, background: C.cardSubtle,
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, cursor: 'text',
          boxShadow: open ? `inset 0 0 0 2px ${C.accent}` : 'none',
        }}
      >
        {value.map((c) => (
          <span key={c} title={nameFor(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 5px 0 9px', borderRadius: 999, background: C.accent, color: C.onAccent, fontSize: 11.5, fontWeight: 700 }}>
            {c}
            <span onClick={(e) => { e.stopPropagation(); remove(c) }} style={{ display: 'grid', placeItems: 'center', width: 15, height: 15, cursor: 'pointer' }}>
              <NcvIcon name="x" size={10} stroke={C.dark ? 'rgba(11,12,14,0.55)' : 'rgba(255,255,255,0.7)'} sw={2.2} />
            </span>
          </span>
        ))}
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={value.length ? '' : placeholder}
          style={{ flex: 1, minWidth: 90, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 13, color: C.ink, fontWeight: 600, height: 28, textTransform: 'uppercase' }}
        />
      </div>
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 14, boxShadow: C.popoverShadow, padding: 6, maxHeight: 240, overflowY: 'auto' }}>
          {matches.slice(0, 40).map(([c, n], i) => (
            <button
              key={c}
              type="button"
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => { e.preventDefault(); add(c) }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: i === hi ? C.cardSubtle : 'transparent' }}
            >
              <span style={{ fontSize: 12, fontWeight: 800, color: C.ink, width: 24 }}>{c}</span>
              <span style={{ fontSize: 12.5, fontWeight: 500, color: C.muted }}>{n}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tuile secondaire (écran de confirmation) ───────────────────────────
function SecTileM({ C, icon, title, sub, onClick }: { C: NcbC; icon: NcvIconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ flex: 1, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 0, background: C.white, borderRadius: 22, boxShadow: C.cardShadow, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 13 }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center', background: C.cardSubtle }}>
        <NcvIcon name={icon} size={18} stroke={C.inkSoft} sw={1.9} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: C.muted, marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   État de formulaire
// ═══════════════════════════════════════════════════════════════════════
interface FormState {
  type: ContactType
  civ: string
  firstName: string
  lastName: string
  email: string
  phone: string
  lang: string
  canal: string
  photo: string | null
  budgetMin: string
  budgetMax: string
  rentMax: string
  pTypes: string[]
  cantons: string[]
  rooms: string
  address: string
  propType: string
  note: string
}

const EMPTY: FormState = {
  type: 'buyer', civ: 'mrs', firstName: '', lastName: '', email: '', phone: '', lang: 'fr', canal: 'whatsapp', photo: null,
  budgetMin: '', budgetMax: '', rentMax: '', pTypes: ['appartement'], cantons: ['GE', 'VD'], rooms: '', address: '', propType: 'appartement', note: '',
}

const TYPE_CARDS: { id: ContactType; icon: NcvIconName }[] = [
  { id: 'buyer', icon: 'search' },
  { id: 'tenant', icon: 'home' },
  { id: 'seller', icon: 'flag' },
  { id: 'landlord', icon: 'building' },
]

const emailOkFn = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
const parseNum = (s: string): number | null => {
  const n = Number(String(s).replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n !== 0 ? n : null
}

// ═══════════════════════════════════════════════════════════════════════
//   MODALE
// ═══════════════════════════════════════════════════════════════════════
export default function NewContactModal({
  sp,
  dark,
  onClose,
  onCreate,
  isPending,
  error,
  onOpenMatching,
}: {
  sp: SugarPalette
  dark: boolean
  onClose: () => void
  onCreate: (data: NewContactData) => Promise<void>
  isPending: boolean
  error: string | null
  onOpenMatching: () => void
}): JSX.Element {
  const { t } = useTranslation('contacts')
  const C = useMemo(() => buildC(sp, dark), [sp, dark])

  const [f, setF] = useState<FormState>(EMPTY)
  const [tried, setTried] = useState(false)
  const [created, setCreated] = useState(false)
  const [consent, setConsent] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const onField = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }))
  const toggleIn = (k: 'pTypes', v: string) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }))

  const isBuyer = f.type === 'buyer' || f.type === 'tenant'
  const tc = C.typeColor[f.type]
  const fullName = `${f.firstName} ${f.lastName}`.trim()
  const initials = ((f.firstName[0] || '') + (f.lastName[0] || '')).toUpperCase()
  const emailOk = emailOkFn(f.email)
  const valid = !!(f.firstName.trim() && f.lastName.trim() && emailOk)
  const canSubmit = valid && consent && !isPending

  const typeLabel = (id: ContactType) => t(`contactType.${id}`)

  const buildData = (): NewContactData => {
    const data: NewContactData = {
      type: f.type,
      civility: f.civ,
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim(),
      email: f.email.trim(),
      phone: f.phone.trim(),
      lang: f.lang,
      canal: f.canal,
      note: f.note.trim(),
      photo: f.photo,
    }
    if (isBuyer) {
      data.criteria = {
        transaction: f.type === 'tenant' ? 'location' : 'vente',
        types: f.pTypes,
        cantons: f.cantons,
        budgetMin: f.type === 'tenant' ? null : parseNum(f.budgetMin),
        budgetMax: f.type === 'tenant' ? parseNum(f.rentMax) : parseNum(f.budgetMax),
        roomsMin: parseNum(f.rooms),
      }
    } else {
      data.linkedBien = { address: f.address.trim(), propType: f.propType }
    }
    return data
  }

  const submit = async () => {
    if (!valid || !consent) { setTried(true); return }
    try {
      await onCreate(buildData())
      setCreated(true)
    } catch {
      // L'erreur est reflétée via le prop `error` — on reste ouvert.
    }
  }
  const reset = () => { setF(EMPTY); setTried(false); setCreated(false); setConsent(false) }

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => setCropSrc(typeof r.result === 'string' ? r.result : null)
    r.readAsDataURL(file)
    e.target.value = ''
  }
  const clearPhoto = () => setF((s) => ({ ...s, photo: null }))

  const inp = (k: 'firstName' | 'lastName'): CSSProperties => ({ ...ncvInput(C), ...(tried && !f[k].trim() ? ERR_RING : {}) })

  const shellStyle: CSSProperties = {
    width: '100%', height: '100%', position: 'relative', display: 'flex', flexDirection: 'column',
    background: C.pageBg, color: C.ink, fontFamily: "'Inter Tight', system-ui, sans-serif",
  }
  const focusCss = (
    <style>{`
      .ncbm-in:focus { box-shadow: inset 0 0 0 2px #0B0C0E; }
      .ncbm-dark .ncbm-in:focus { box-shadow: inset 0 0 0 2px #ECEDF3; }
      @keyframes sgFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
  )

  // ══════════════════ Écran de confirmation « héros » ══════════════════
  if (created) {
    const GREEN = C.typeColor.landlord
    const heroVeil = C.dark ? 'rgba(11,12,14,0.10)' : 'rgba(255,255,255,0.12)'
    const heroSub = C.dark ? 'rgba(11,12,14,0.60)' : 'rgba(255,255,255,0.72)'
    const heroChev = C.dark ? 'rgba(11,12,14,0.70)' : 'rgba(255,255,255,0.85)'
    return (
      <div className={C.dark ? 'ncbm-dark' : undefined} style={shellStyle}>
        {focusCss}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: 46 }}>
          <div style={{ width: 560, display: 'flex', flexDirection: 'column', animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 20 }}>
              <NcbAvatarM photo={f.photo} initials={initials} color={tc} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: GREEN }}>{t('newContactPager.created.eyebrow')}</div>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: -0.5, color: C.ink, marginTop: 1 }}>{fullName}</div>
              </div>
              <NcbTypePillM C={C} type={f.type} label={typeLabel(f.type)} />
            </div>
            <button
              type="button"
              onClick={onOpenMatching}
              style={{ fontFamily: 'inherit', cursor: 'pointer', border: 0, textAlign: 'left', background: C.accent, borderRadius: 20, padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 18, boxShadow: C.dark ? '0 20px 44px rgba(0,0,0,0.5)' : '0 20px 44px rgba(11,12,14,0.26)' }}
            >
              <span style={{ width: 48, height: 48, borderRadius: 15, flexShrink: 0, display: 'grid', placeItems: 'center', background: heroVeil }}>
                <NcvIcon name="sparkle" size={24} stroke={C.onAccent} sw={1.9} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: C.onAccent, letterSpacing: -0.3 }}>{t('newContactPager.created.heroTitle')}</div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: heroSub, marginTop: 3 }}>{t('newContactPager.created.heroSub')}</div>
              </div>
              <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(-90deg)' }}>
                <NcvIcon name="chevron" size={20} stroke={heroChev} sw={2.2} />
              </span>
            </button>
            <div style={{ display: 'flex', gap: 11, marginTop: 12 }}>
              <SecTileM C={C} icon="shield" title={t('newContactPager.created.kycTitle')} sub={t('newContactPager.created.kycSub')} onClick={reset} />
              <SecTileM C={C} icon="user" title={t('newContactPager.created.ficheTitle')} sub={t('newContactPager.created.ficheSub')} onClick={reset} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
              <NcbCtaM C={C} tone="ghost" icon="plus" onClick={reset}>{t('newContactPager.created.createAnother')}</NcbCtaM>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════════ Formulaire ══════════════════
  return (
    <div className={C.dark ? 'ncbm-dark' : undefined} style={shellStyle}>
      {focusCss}
      {/* Barre supérieure */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', padding: '18px 26px' }}>
        <NcbCloseM C={C} onClick={onClose} label={t('newContactPager.close')} />
      </div>

      {/* Salle centrée */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '2px 26px 18px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, letterSpacing: -1 }}>{t('newContactPager.heroTitle')}</h1>
          </div>

          {/* Type — cartes héros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            {TYPE_CARDS.map((card) => {
              const on = f.type === card.id
              const col = C.typeColor[card.id]
              return (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => setF((s) => ({ ...s, type: card.id }))}
                  style={{
                    position: 'relative', padding: '18px 16px', minHeight: 118, borderRadius: 18, border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                    background: on ? col : C.white, boxShadow: on ? `0 14px 32px ${col}44` : C.cardShadow,
                    display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 4,
                    transform: on ? 'translateY(-1px)' : 'none',
                  }}
                >
                  <span style={{ position: 'absolute', top: 15, right: 15, display: 'grid', placeItems: 'center' }}>
                    <NcvIcon name={card.icon} size={30} stroke={on ? '#fff' : col} sw={1.7} />
                  </span>
                  <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: -0.2, color: on ? '#fff' : C.ink }}>{typeLabel(card.id)}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 500, lineHeight: 1.35, color: on ? 'rgba(255,255,255,.78)' : C.muted }}>{t(`newContact.typeDesc.${card.id}`)}</div>
                </button>
              )
            })}
          </div>

          {/* Identité */}
          <div style={{ background: C.white, borderRadius: 22, boxShadow: C.cardShadow, padding: '22px 24px' }}>
            <NcbSectionLabelM C={C}>{t('newContact.identity')}</NcbSectionLabelM>
            <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 9, paddingTop: 20 }}>
                <NcbPhotoPickerM C={C} photo={f.photo} initials={initials} color={tc} onPick={onPickPhoto} onClear={clearPhoto} addLabel={t('newContactPager.addPhoto')} removeLabel={t('newContactPager.removePhoto')} />
                <div style={{ fontSize: 10.5, fontWeight: 700, color: C.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{t('newContactPager.photo')}</div>
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr 1fr', gap: 12 }}>
                  <NcvFieldM C={C} label={t('newContactPager.civ')}>
                    <select className="ncbm-in" value={f.civ} onChange={onField('civ')} style={{ ...ncvInput(C), padding: '0 8px' }}>
                      <option value="mrs">{t('newContact.civility.mrs')}</option>
                      <option value="mr">{t('newContact.civility.mr')}</option>
                    </select>
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContactPager.firstName')} required>
                    <input className="ncbm-in" value={f.firstName} onChange={onField('firstName')} placeholder={t('newContactPager.firstName')} style={inp('firstName')} />
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContactPager.lastName')} required>
                    <input className="ncbm-in" value={f.lastName} onChange={onField('lastName')} placeholder={t('newContactPager.lastName')} style={inp('lastName')} />
                  </NcvFieldM>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 150px', gap: 12, alignItems: 'end' }}>
                  <NcvFieldM C={C} label={t('newContactPager.email')} required>
                    <input className="ncbm-in" value={f.email} onChange={onField('email')} placeholder={t('newContactPager.emailPlaceholder')} style={{ ...ncvInput(C), ...(tried && !emailOk ? ERR_RING : {}) }} />
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContactPager.phone')}>
                    <input className="ncbm-in" value={f.phone} onChange={onField('phone')} placeholder={t('newContactPager.phonePlaceholder')} style={{ ...ncvInput(C), ...MONO }} />
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContactPager.lang')}>
                    <select className="ncbm-in" value={f.lang} onChange={onField('lang')} style={{ ...ncvInput(C), padding: '0 8px' }}>
                      <option value="fr">{t('newContactPager.langOpt.fr')}</option>
                      <option value="de">{t('newContactPager.langOpt.de')}</option>
                      <option value="en">{t('newContactPager.langOpt.en')}</option>
                      <option value="it">{t('newContactPager.langOpt.it')}</option>
                    </select>
                  </NcvFieldM>
                </div>
                <NcvFieldM C={C} label={t('newContactPager.canal')}>
                  <div style={{ display: 'flex', gap: 6, background: C.cardSubtle, padding: 4, borderRadius: 12 }}>
                    {(['whatsapp', 'sms', 'call', 'email'] as const).map((cv) => {
                      const on = f.canal === cv
                      return (
                        <button
                          key={cv}
                          type="button"
                          onClick={() => setF((s) => ({ ...s, canal: cv }))}
                          style={{ flex: 1, height: 32, borderRadius: 9, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: on ? 700 : 600, background: on ? C.accent : 'transparent', color: on ? C.onAccent : C.muted, boxShadow: on ? C.shadowSm : 'none' }}
                        >
                          {t(`newContactPager.canalOpt.${cv}`)}
                        </button>
                      )
                    })}
                  </div>
                </NcvFieldM>
              </div>
            </div>
          </div>

          {/* Critères / bien — adapté au type */}
          <div style={{ background: C.white, borderRadius: 22, boxShadow: C.cardShadow, padding: '22px 24px' }}>
            <NcbSectionLabelM C={C}>
              {isBuyer
                ? (f.type === 'tenant' ? t('newContactPager.criteriaRent') : t('newContactPager.criteriaBuy'))
                : (f.type === 'seller' ? t('newContact.property.titleSell') : t('newContact.property.titleRent'))}
            </NcbSectionLabelM>
            {isBuyer ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'grid', gridTemplateColumns: f.type === 'tenant' ? '1fr' : '1fr 1fr', gap: 12 }}>
                  {f.type === 'tenant' ? (
                    <NcvFieldM C={C} label={t('newContactPager.rentMax')}>
                      <input className="ncbm-in" value={f.rentMax} onChange={onField('rentMax')} placeholder={t('newContactPager.rentMaxPlaceholder')} style={{ ...ncvInput(C), ...MONO, maxWidth: 220 }} />
                    </NcvFieldM>
                  ) : (
                    <>
                      <NcvFieldM C={C} label={t('newContactPager.budgetMin')}>
                        <input className="ncbm-in" value={f.budgetMin} onChange={onField('budgetMin')} placeholder={t('newContactPager.budgetMinPlaceholder')} style={{ ...ncvInput(C), ...MONO }} />
                      </NcvFieldM>
                      <NcvFieldM C={C} label={t('newContactPager.budgetMax')}>
                        <input className="ncbm-in" value={f.budgetMax} onChange={onField('budgetMax')} placeholder={t('newContactPager.budgetMaxPlaceholder')} style={{ ...ncvInput(C), ...MONO }} />
                      </NcvFieldM>
                    </>
                  )}
                </div>
                <NcvFieldM C={C} label={t('newContact.propertyTypeLabel')}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['appartement', 'maison', 'terrain', 'commercial'] as const).map((id) => (
                      <NcvChipM key={id} C={C} active={f.pTypes.includes(id)} check={false} onClick={() => toggleIn('pTypes', id)}>
                        {t(`newContact.propertyType.${id === 'appartement' ? 'apartment' : id === 'maison' ? 'house' : id === 'terrain' ? 'land' : 'commercial'}`)}
                      </NcvChipM>
                    ))}
                  </div>
                </NcvFieldM>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
                  <NcvFieldM C={C} label={t('newContact.cantons')}>
                    <NcbCantonAutoM C={C} value={f.cantons} onChange={(v) => setF((s) => ({ ...s, cantons: v }))} placeholder={t('newContactPager.cantonPlaceholder')} />
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContact.minRooms')}>
                    <input className="ncbm-in" value={f.rooms} onChange={onField('rooms')} placeholder={t('newContactPager.roomsPlaceholder')} style={{ ...ncvInput(C), ...MONO }} />
                  </NcvFieldM>
                </div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
                <NcvFieldM C={C} label={t('newContact.property.address')}>
                  <input className="ncbm-in" value={f.address} onChange={onField('address')} placeholder={t('newContactPager.addressPlaceholder')} style={ncvInput(C)} />
                </NcvFieldM>
                <NcvFieldM C={C} label={t('newContact.property.type')}>
                  <select className="ncbm-in" value={f.propType} onChange={onField('propType')} style={ncvInput(C)}>
                    <option value="appartement">{t('newContact.propertyType.apartment')}</option>
                    <option value="maison">{t('newContact.propertyType.house')}</option>
                    <option value="terrain">{t('newContact.propertyType.land')}</option>
                    <option value="commercial">{t('newContact.propertyType.commercial')}</option>
                  </select>
                </NcvFieldM>
              </div>
            )}
          </div>

          {/* Note — libre, optionnelle */}
          <div style={{ background: C.white, borderRadius: 22, boxShadow: C.cardShadow, padding: '22px 24px' }}>
            <NcbSectionLabelM C={C}>{t('newContactPager.note')}</NcbSectionLabelM>
            <textarea
              className="ncbm-in"
              value={f.note}
              onChange={onField('note')}
              placeholder={t('newContactPager.notePlaceholder')}
              rows={3}
              style={{ ...ncvInput(C), height: 'auto', minHeight: 86, padding: '12px 14px', resize: 'vertical', lineHeight: 1.5, fontFamily: 'inherit' }}
            />
          </div>
        </div>
      </div>

      {/* Pied de cadre : consentement RGPD (compliance CH) + erreurs + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 26px', flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} style={{ width: 16, height: 16, accentColor: C.accent, cursor: 'pointer', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: C.muted }} dangerouslySetInnerHTML={{ __html: t('newContact.gdprConsent') }} />
        </label>
        {tried && !valid && <div style={{ fontSize: 12, color: '#B4293D', fontWeight: 600 }}>{t('newContactPager.validationError')}</div>}
        {error && <div style={{ fontSize: 12, color: '#B4293D', fontWeight: 600 }}>{error}</div>}
        <div style={{ flex: 1 }} />
        <NcbCtaM C={C} tone="ghost" onClick={onClose}>{t('newContactPager.cancel')}</NcbCtaM>
        <NcbCtaM C={C} onClick={submit} disabled={!canSubmit}>{isPending ? t('newContact.creating') : t('newContact.submit')}</NcbCtaM>
      </div>

      {cropSrc && (
        <NcbCropEditorM
          C={C}
          src={cropSrc}
          onCancel={() => setCropSrc(null)}
          onDone={(url) => { setF((s) => ({ ...s, photo: url })); setCropSrc(null) }}
          title={t('newContactPager.crop.title')}
          hint={t('newContactPager.crop.hint')}
          cancelLabel={t('newContactPager.cancel')}
          validateLabel={t('newContactPager.crop.validate')}
        />
      )}
    </div>
  )
}
