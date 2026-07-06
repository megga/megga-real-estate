// Matching · Recherche — vue Carte (split liste ↔ carte à pins prix).
// Port du proto handoff (branche stylisée CSS : fond abstrait + pins projetés,
// zoom molette / pan glisser, survol liste↔pin synchronisé + mini-aperçu).
// La branche Mapbox live du proto est omise ici (le fond stylisé est complet et
// sans dépendance) ; une vraie carte react-map-gl pourra la remplacer plus tard.

import { useCallback, useMemo, useReducer, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import { useTranslation } from 'react-i18next'
import RechIcon from './RechIcon'
import MrhPhoto from './MrhPhoto'
import { formatCHF } from '@/lib/utils'
import type { MrhBien } from './types'
import type { MrhCtx } from './mrhCtx'
import type { MrhItem } from './MrhGrid'

const mrhM = (n: number) => (n >= 1e6 ? String(Math.round(n / 1e5) / 10).replace('.', ',') + 'M' : Math.round(n / 1e3) + 'k')
const VIO = '#7C63F0', VIO_HOT = '#5B44D6', VIO_NEAR = '#9B86F2'

interface Bounds { minLa: number; maxLa: number; minLo: number; maxLo: number }
interface Pos { left: string; top: string; _x: number; _y: number; _in: boolean }
interface MapItem extends MrhItem { near: boolean }

function mrhBounds(items: MapItem[]): Bounds | null {
  const pts = items.map((x) => x.b).filter((b) => b.lat != null && b.lng != null) as (MrhBien & { lat: number; lng: number })[]
  if (!pts.length) return null
  let minLa = Infinity, maxLa = -Infinity, minLo = Infinity, maxLo = -Infinity
  pts.forEach((b) => { minLa = Math.min(minLa, b.lat); maxLa = Math.max(maxLa, b.lat); minLo = Math.min(minLo, b.lng); maxLo = Math.max(maxLo, b.lng) })
  const dLa = (maxLa - minLa) || 0.03, dLo = (maxLo - minLo) || 0.03
  const pa = dLa * 0.14, po = dLo * 0.14
  return { minLa: minLa - pa, maxLa: maxLa + pa, minLo: minLo - po, maxLo: maxLo + po }
}
function mrhPos(b: MrhBien, bnds: Bounds): Pos {
  const x = ((b.lng ?? 0) - bnds.minLo) / (bnds.maxLo - bnds.minLo)
  const y = 1 - ((b.lat ?? 0) - bnds.minLa) / (bnds.maxLa - bnds.minLa)
  const cx = 6 + Math.max(0, Math.min(1, x)) * 88
  const cy = 7 + Math.max(0, Math.min(1, y)) * 86
  return { left: cx + '%', top: cy + '%', _x: cx, _y: cy, _in: x >= -0.06 && x <= 1.06 && y >= -0.06 && y <= 1.06 }
}

function MapSurface({ dark }: { dark: boolean }) {
  const base = dark ? '#0F131A' : '#E9EDF2'
  const ln = dark ? 'rgba(255,255,255,.05)' : 'rgba(15,23,42,.055)'
  const water = dark ? 'rgba(96,128,170,.12)' : 'rgba(120,150,190,.18)'
  const park = dark ? 'rgba(96,150,112,.09)' : 'rgba(120,170,120,.15)'
  return (
    <div style={{ position: 'absolute', inset: 0, background: base, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: -24, backgroundImage: `linear-gradient(${ln} 1px, transparent 1px), linear-gradient(90deg, ${ln} 1px, transparent 1px)`, backgroundSize: '48px 48px' }} />
      <div style={{ position: 'absolute', top: '-16%', left: '16%', width: '72%', height: '150%', transform: 'rotate(23deg)', background: ln }} />
      <div style={{ position: 'absolute', top: '40%', left: '-10%', width: '130%', height: 10, background: ln }} />
      <div style={{ position: 'absolute', right: '-10%', bottom: '-14%', width: '56%', height: '48%', borderRadius: '50% 46% 44% 52%', background: water, transform: 'rotate(-12deg)' }} />
      <div style={{ position: 'absolute', left: '7%', top: '11%', width: '22%', height: '27%', borderRadius: '46% 54% 50% 48%', background: park }} />
      <div style={{ position: 'absolute', inset: 0, background: dark ? 'radial-gradient(120% 92% at 50% 42%, transparent 54%, rgba(0,0,0,.34))' : 'radial-gradient(120% 92% at 50% 42%, transparent 60%, rgba(15,23,42,.06))' }} />
    </div>
  )
}

function PricePin({ b, pos, active, near, sel, onHover, onOpen }: { b: MrhBien; pos: Pos; active: boolean; near: boolean; sel: string[]; onHover: (id: string | null) => void; onOpen: (b: MrhBien) => void }) {
  const price = b.transaction === 'location' ? b.rent : b.price
  const label = price ? mrhM(price) : '—'
  const on = sel.includes(b.id)
  const hot = active || on
  const z = active ? 60 : on ? 40 : 14 + Math.round(pos._y / 3)
  const bg = hot ? VIO_HOT : near ? VIO_NEAR : VIO
  return (
    <button onMouseEnter={() => onHover(b.id)} onMouseLeave={() => onHover(null)} onClick={(e) => { e.stopPropagation(); onOpen(b) }}
      style={{ position: 'absolute', left: pos.left, top: pos.top, zIndex: z, transform: 'translate(-50%,-50%)', border: 0, cursor: 'pointer', padding: '5px 10px', borderRadius: 999, fontFamily: 'inherit', fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', background: bg, color: '#FFFFFF', boxShadow: '0 3px 10px rgba(76,58,160,.42)', outline: on ? '2px solid rgba(255,255,255,.9)' : 'none', outlineOffset: -2, transition: 'background .14s' }}>
      {label}
    </button>
  )
}

function MapPopover({ b, m, pos, ctx, onOpen, onHover }: { b: MrhBien; m: MrhItem['m']; pos: Pos; ctx: MrhCtx; onOpen: (b: MrhBien) => void; onHover: (id: string | null) => void }) {
  const { sp, surf, dark, cardSolid } = ctx
  const price = b.transaction === 'location' ? b.rent : b.price
  const [pi, setPi] = useState(0)
  const photos = b.photos.length ? b.photos : [null]
  const goPhoto = (e: ReactMouseEvent, d: number) => { e.stopPropagation(); setPi((i) => (i + d + photos.length) % photos.length) }
  return (
    <div onMouseEnter={() => onHover(b.id)} onMouseLeave={() => onHover(null)} onClick={(e) => { e.stopPropagation(); onOpen(b) }}
      style={{ position: 'absolute', left: pos.left, top: pos.top, zIndex: 70, marginLeft: -108, marginTop: 24, width: 216, cursor: 'pointer', background: cardSolid, borderRadius: 14, overflow: 'hidden', boxShadow: sp.solidShadow, border: '1px solid ' + sp.solidBorder, animation: 'sgFadeUp .16s cubic-bezier(.2,.8,.2,1) both' }}>
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: surf.cardSub }}>
        <MrhPhoto url={photos[pi]} dark={dark} alt="" fallbackBg={surf.cardSub} fallbackInk={sp.sub} />
        {photos.length > 1 && (
          <>
            <button onClick={(e) => goPhoto(e, -1)} style={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 999, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, background: 'rgba(11,12,14,.55)' }}><RechIcon name="chevronL" size={14} stroke="#fff" /></button>
            <button onClick={(e) => goPhoto(e, 1)} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 24, height: 24, borderRadius: 999, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, background: 'rgba(11,12,14,.55)' }}><RechIcon name="chevronR" size={14} stroke="#fff" /></button>
          </>
        )}
        {m && m.score != null && <span style={{ position: 'absolute', top: 8, right: 8, display: 'inline-flex', alignItems: 'center', gap: 2, padding: '3px 8px', borderRadius: 999, background: dark ? sp.solidBg : '#FFFFFF', color: sp.ink, fontSize: 11, fontWeight: 800, boxShadow: '0 2px 8px rgba(15,23,42,.2)' }}>{m.score}<span style={{ fontSize: 9, color: sp.sub }}>%</span></span>}
      </div>
      <div style={{ padding: '9px 11px 11px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
        <div style={{ fontSize: 11, color: sp.sub, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.addr}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginTop: 7 }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: sp.ink, letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{price ? formatCHF(price) : '—'}</span>
          <span style={{ fontSize: 11, color: sp.sub, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>{b.rooms ?? '—'} p · {b.area ?? '—'} m²</span>
        </div>
      </div>
    </div>
  )
}

function ListRow({ b, m, active, ctx, onHover, onOpen }: { b: MrhBien; m: MrhItem['m']; active: boolean; ctx: MrhCtx; onHover: (id: string | null) => void; onOpen: (b: MrhBien) => void }) {
  const { sp, surf, dark, line, ACC, ONACC, chipBg, sel, buyer, toggleSel } = ctx
  const price = b.transaction === 'location' ? b.rent : b.price
  const on = sel.includes(b.id)
  return (
    <div onMouseEnter={() => onHover(b.id)} onMouseLeave={() => onHover(null)} onClick={() => onOpen(b)}
      style={{ display: 'flex', gap: 12, padding: 8, borderRadius: 14, cursor: 'pointer', flexShrink: 0, background: surf.card, border: surf.hairline, boxShadow: (on ? '0 0 0 1.5px ' + ACC + ' inset, ' : '') + (active ? surf.shadowHov : surf.shadow), outline: active ? '2px solid ' + ACC : '2px solid transparent', outlineOffset: -2, transition: 'box-shadow .15s, outline-color .15s' }}>
      <div style={{ width: 104, height: 80, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: surf.cardSub, position: 'relative' }}>
        <MrhPhoto url={b.photos[0]} dark={dark} alt="" fallbackBg={surf.cardSub} fallbackInk={sp.sub} />
        {m && m.score != null && <span style={{ position: 'absolute', top: 6, left: 6, display: 'inline-flex', alignItems: 'center', gap: 1, padding: '2px 7px', borderRadius: 999, background: dark ? sp.solidBg : '#FFFFFF', color: sp.ink, fontSize: 10.5, fontWeight: 800, boxShadow: '0 2px 6px rgba(15,23,42,.18)' }}>{m.score}<span style={{ fontSize: 8.5, color: sp.sub }}>%</span></span>}
      </div>
      <div style={{ minWidth: 0, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: sp.ink, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.title}</div>
        <div style={{ fontSize: 12, color: sp.sub, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.addr}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: sp.ink, letterSpacing: -0.4, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{price ? formatCHF(price) : '—'}</span>
          <span style={{ fontSize: 11.5, color: sp.sub, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {b.rooms ?? '—'} p · {b.area ?? '—'} m²</span>
        </div>
      </div>
      {buyer && (
        <button onClick={(e) => { e.stopPropagation(); toggleSel(b.id) }} style={{ alignSelf: 'center', width: 30, height: 30, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0, display: 'grid', placeItems: 'center', padding: 0, background: on ? ACC : chipBg, boxShadow: on ? 'none' : 'inset 0 0 0 1px ' + line, transition: 'background .15s' }}>
          <RechIcon name={on ? 'check' : 'plus'} size={13} stroke={on ? ONACC : sp.soft} />
        </button>
      )}
    </div>
  )
}

interface Props {
  strict: MrhItem[]
  near: MrhItem[]
  ctx: MrhCtx
}

export default function MrhMapView({ strict, near, ctx }: Props) {
  const { t } = useTranslation('matching')
  const { sp, surf, dark } = ctx
  const [hoverId, setHoverId] = useState<string | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const setHover = useCallback((id: string | null) => {
    if (hideTimer.current) clearTimeout(hideTimer.current)
    if (id) setHoverId(id)
    else hideTimer.current = setTimeout(() => setHoverId(null), 140)
  }, [])
  const groups: MapItem[] = useMemo(() => [...strict.map((x) => ({ ...x, near: false })), ...near.map((x) => ({ ...x, near: true }))], [strict, near])
  const stageRef = useRef<HTMLDivElement>(null)
  const bnds0 = useMemo(() => mrhBounds(groups), [groups])
  const [zoom, setZoom] = useState(1)
  const [ctr, setCtr] = useState<{ lng: number; lat: number } | null>(null)
  const zoomRef = useRef(1), ctrRef = useRef<{ lng: number; lat: number } | null>(null)
  zoomRef.current = zoom; ctrRef.current = ctr
  const bnds = useMemo(() => {
    if (!bnds0) return null
    const cLng = ctr ? ctr.lng : (bnds0.minLo + bnds0.maxLo) / 2
    const cLat = ctr ? ctr.lat : (bnds0.minLa + bnds0.maxLa) / 2
    const hLo = (bnds0.maxLo - bnds0.minLo) / 2 / zoom
    const hLa = (bnds0.maxLa - bnds0.minLa) / 2 / zoom
    return { minLo: cLng - hLo, maxLo: cLng + hLo, minLa: cLat - hLa, maxLa: cLat + hLa }
  }, [bnds0, zoom, ctr])
  const located = useMemo(() => groups.filter((x) => x.b.lat != null && x.b.lng != null), [groups])
  const posById = useMemo(() => {
    const m: Record<string, Pos> = {}
    if (bnds) located.forEach((x) => { m[x.b.id] = mrhPos(x.b, bnds) })
    return m
  }, [located, bnds])
  const [, bump] = useReducer((x: number) => x + 1, 0)

  // zoom molette + pan glisser (fond stylisé)
  const onWheel = (e: ReactWheelEvent) => {
    if (!bnds0) return
    e.preventDefault(); e.stopPropagation()
    const el = stageRef.current!
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height
    const z = zoomRef.current, c = ctrRef.current
    const spanLo = bnds0.maxLo - bnds0.minLo, spanLa = bnds0.maxLa - bnds0.minLa
    const baseLng = (bnds0.minLo + bnds0.maxLo) / 2, baseLat = (bnds0.minLa + bnds0.maxLa) / 2
    const nz = Math.min(48, Math.max(1, z * (e.deltaY < 0 ? 1.25 : 0.8)))
    const cLng = c ? c.lng : baseLng, cLat = c ? c.lat : baseLat
    const hLo = spanLo / 2 / z, hLa = spanLa / 2 / z
    const lng = cLng - hLo + px * 2 * hLo, lat = cLat + hLa - py * 2 * hLa
    const nHLo = spanLo / 2 / nz, nHLa = spanLa / 2 / nz
    setZoom(nz)
    setCtr(nz <= 1 ? null : { lng: lng - (px - 0.5) * 2 * nHLo, lat: lat + (py - 0.5) * 2 * nHLa })
    bump()
  }
  const drag = useRef<{ x: number; y: number } | null>(null)
  const onDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    drag.current = { x: e.clientX, y: e.clientY }
    ;(e.currentTarget as HTMLElement).style.cursor = 'grabbing'
  }
  const onMove = (e: ReactPointerEvent) => {
    if (!drag.current || !bnds0) return
    const el = stageRef.current!
    const r = el.getBoundingClientRect()
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    drag.current = { x: e.clientX, y: e.clientY }
    const z = Math.max(1, zoomRef.current), c = ctrRef.current
    const spanLo = bnds0.maxLo - bnds0.minLo, spanLa = bnds0.maxLa - bnds0.minLa
    const baseLng = (bnds0.minLo + bnds0.maxLo) / 2, baseLat = (bnds0.minLa + bnds0.maxLa) / 2
    const hLo = spanLo / 2 / z, hLa = spanLa / 2 / z
    const cLng = c ? c.lng : baseLng, cLat = c ? c.lat : baseLat
    setCtr({ lng: cLng - (dx / r.width) * 2 * hLo, lat: cLat + (dy / r.height) * 2 * hLa })
  }
  const onUp = (e: ReactPointerEvent) => { drag.current = null; (e.currentTarget as HTMLElement).style.cursor = zoomRef.current > 1 ? 'grab' : 'default' }

  const act = groups.find((x) => x.b.id === hoverId)
  const actPos = act && posById[act.b.id] ? posById[act.b.id] : null
  const labStyle = { fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' as const, color: sp.sub }
  const rowOf = (x: MrhItem) => <ListRow key={x.b.id} b={x.b} m={x.m} active={x.b.id === hoverId} ctx={ctx} onHover={setHover} onOpen={ctx.onOpen} />

  return (
    <div className="mrh-split" style={{ flex: 1, minHeight: 0, padding: '8px 30px 30px' }}>
      <div className="mrh-split-list mrh-scroll" style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 8 }}>
        {strict.length === 0 && <div style={{ ...labStyle, padding: '4px 2px 2px' }}>{t('recherche.map.nearHere')}</div>}
        {strict.map(rowOf)}
        {near.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '10px 2px 2px' }}>
            <span style={labStyle}>{t('recherche.near.title')}</span>
            <span style={{ fontSize: 11, color: sp.sub, fontWeight: 600, opacity: 0.8 }}>{t('recherche.near.note')}</span>
          </div>
        )}
        {near.map(rowOf)}
      </div>
      <div ref={stageRef} className="mrh-split-map" onClick={() => setHover(null)} onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: 'relative', borderRadius: 20, overflow: 'hidden', boxShadow: surf.shadow, border: surf.hairline, cursor: zoom > 1 ? 'grab' : 'default', touchAction: 'none' }}>
        <MapSurface dark={dark} />
        {bnds ? located.filter((x) => posById[x.b.id]?._in).map((x) => (
          <PricePin key={x.b.id} b={x.b} pos={posById[x.b.id]} active={x.b.id === hoverId} near={x.near} sel={ctx.sel} onHover={setHover} onOpen={ctx.onOpen} />
        )) : (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: sp.sub, fontSize: 13, fontWeight: 600 }}>{t('recherche.map.noLocated')}</div>
        )}
        {bnds0 && (
          <div style={{ position: 'absolute', right: 12, top: 12, zIndex: 46, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={(e) => { e.stopPropagation(); setZoom((z) => Math.min(48, z * 1.4)) }} title={t('recherche.map.zoomIn')} style={{ width: 32, height: 32, borderRadius: 9, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, background: dark ? sp.solidBg : '#FFFFFF', color: sp.ink, fontSize: 20, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1, boxShadow: '0 2px 8px rgba(15,23,42,.18)' }}>+</button>
            <button onClick={(e) => { e.stopPropagation(); setZoom((z) => { const n = Math.max(1, z / 1.4); if (n <= 1) setCtr(null); return n }) }} title={t('recherche.map.zoomOut')} style={{ width: 32, height: 32, borderRadius: 9, border: 0, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0, background: dark ? sp.solidBg : '#FFFFFF', color: sp.ink, fontSize: 22, fontWeight: 700, fontFamily: 'inherit', lineHeight: 1, boxShadow: '0 2px 8px rgba(15,23,42,.18)' }}>−</button>
          </div>
        )}
        {zoom > 1 && (
          <button onClick={(e) => { e.stopPropagation(); setZoom(1); setCtr(null) }} title={t('recherche.map.overview')}
            style={{ position: 'absolute', left: 12, top: 12, zIndex: 46, height: 32, padding: '0 13px', borderRadius: 999, border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700, background: dark ? sp.solidBg : '#FFFFFF', color: sp.ink, boxShadow: '0 2px 8px rgba(15,23,42,.18)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            {t('recherche.map.overview')}
          </button>
        )}
        {act && actPos && posById[act.b.id]?._in && <MapPopover b={act.b} m={act.m} pos={actPos} ctx={ctx} onOpen={ctx.onOpen} onHover={setHover} />}
      </div>
    </div>
  )
}
