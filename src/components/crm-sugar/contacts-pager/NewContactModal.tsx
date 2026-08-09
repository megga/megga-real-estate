// MEGGA CRM — Modale « Nouveau contact » (refonte Contacts Beta, port fidèle).
// Source design : `nc-bento-b-live.jsx` (NcbConceptBLive, concept D « Fiche vivante »)
// + `nc-bento-shared.jsx` + `nc-refonte-shared.jsx` (atomes NCV). Recréée en TSX
// propre : styles inline, police 'Inter Tight', composants au NIVEAU MODULE (hors du
// render) pour éviter la perte de focus des inputs.
//
// Mise en page : UN bento fusionné en deux colonnes, sans titre ni barre de pied —
// à gauche un « aperçu vivant » (photo, nom, type, méta, actions) qui se remplit
// pendant la saisie, à droite le panneau « Fiche express » qui porte tout le
// formulaire et qui est LE seul élément scrollable. La modale REMPLIT le cadre
// (props `fill` du design) : racine 100%×100%, PAS de portail — l'overlay est posé
// par le parent (ContactsPager).
//
// Identité LBA : naissance / nationalité / résidence / adresse partent en colonnes
// typées de `contacts` (art. 3 LBA), converties par `identityToColumns()` — jamais
// dans form_data, car elles doivent rester requêtables par le KYC.

import { useMemo, useRef, useState, type CSSProperties, type JSX, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { crmStep, type SugarPalette } from '@/components/crm-sugar/tokens'
import type { CriteriaInput } from '@/lib/contactCriteria'
import { NcvIcon, type NcvIconName } from '@/components/crm-sugar/contacts-pager/ncvIcon'
import { COUNTRIES } from '@/lib/countries'
import { identityToColumns, isInvalidSwissDate } from '@/lib/contactIdentity'
import { formatCHF, formatRent } from '@/lib/utils'

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
  /** Colonnes d'identification LBA de `contacts`, prêtes à l'insert (identityToColumns). */
  birth_date: string | null
  nationality: string | null
  residence_country: string | null
  home_address: string | null
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
  // ── Valeurs propres à l'aperçu vivant (le handoff les code en dur ; on les
  //    dérive ici pour éviter des ternaires `dark ? … : …` dispersés dans le JSX).
  /** Fond de la carte fusionnée et de la colonne d'aperçu (noir de page en sombre). */
  surfaceBg: string
  /** Nom complet renseigné / vide. */
  nameInk: string
  nameGhost: string
  /** Lignes méta : icône, texte renseigné, texte vide. */
  metaIcon: string
  metaText: string
  metaGhost: string
  /** Message d'erreur de validation (lisible sur fond sombre). */
  errText: string
  /** CTA « Créer le contact » — actif / inactif. */
  ctaOnBg: string
  ctaOnInk: string
  ctaOffBg: string
  ctaOffInk: string
  /** CTA « Annuler » (ghost). */
  ctaGhostInk: string
}

const TYPE_COLOR: Record<ContactType, string> = {
  buyer: '#1E5BC6',
  tenant: '#0891B2',
  seller: '#C45A00',
  landlord: '#059669',
}

function buildC(sp: SugarPalette, dark: boolean): NcbC {
  if (!dark) {
    const accent = '#0B0C0E'
    return {
      white: '#FFFFFF',
      cardSubtle: '#F6F7F9',
      cardSub2: '#F0F2F5',
      ink: sp.ink,
      inkSoft: sp.soft,
      muted: sp.sub,
      ghost: '#B5BAC2',
      line: 'rgba(15,23,42,0.07)',
      accent,
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
      surfaceBg: '#FFFFFF',
      nameInk: sp.ink,
      nameGhost: '#B5BAC2',
      metaIcon: sp.soft,
      metaText: sp.soft,
      metaGhost: '#B5BAC2',
      errText: '#B4293D',
      ctaOnBg: accent,
      ctaOnInk: '#FFFFFF',
      ctaOffBg: '#F6F7F9',
      ctaOffInk: '#B5BAC2',
      ctaGhostInk: sp.soft,
    }
  }
  return {
    white: sp.cardBg,
    cardSubtle: sp.cardSubBg,
    cardSub2: crmStep('s3', 'rgba(255,255,255,0.07)'),
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
    // popovers/menus flottants = surface opaque du palier haut, jamais de verre
    popoverBg: crmStep('s4', '#2A2A2A'),
    popoverBorder: sp.solidBorder,
    popoverShadow: sp.solidShadow,
    typeColor: TYPE_COLOR,
    dark: true,
    // En sombre, la carte fusionnée reprend le noir de page pour se souder au cadre.
    surfaceBg: sp.pageBg,
    nameInk: '#FFFFFF',
    nameGhost: 'rgba(255,255,255,0.35)',
    metaIcon: 'rgba(255,255,255,0.75)',
    metaText: 'rgba(255,255,255,0.82)',
    metaGhost: 'rgba(255,255,255,0.35)',
    errText: '#E0738C',
    ctaOnBg: '#FFFFFF',
    ctaOnInk: sp.pageBg,
    ctaOffBg: 'rgba(255,255,255,0.12)',
    ctaOffInk: 'rgba(255,255,255,0.35)',
    ctaGhostInk: 'rgba(255,255,255,0.85)',
  }
}

// ── Styles d'input Sugar (sans bordure, ring au focus via CSS `.ncbm-in`) ──
const ncvInput = (C: NcbC): CSSProperties => ({
  width: '100%', height: 40, padding: '0 var(--crm-space-xl)', boxSizing: 'border-box',
  background: C.cardSubtle, border: 0, borderRadius: 'var(--crm-radius-lg)',
  color: C.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 500, fontFamily: 'inherit', outline: 'none',
})
const MONO: CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, monospace", fontVariantNumeric: 'tabular-nums' }
const ERR_RING: CSSProperties = { boxShadow: 'inset 0 0 0 2px #B4293D' }

/**
 * Input du panneau « Fiche express ». Le panneau est lui-même en `cardSubtle` :
 * les champs s'inversent en blanc pour rester lisibles (sans quoi champ et fond
 * se confondent).
 */
const inpW = (C: NcbC, err?: boolean): CSSProperties => ({
  ...ncvInput(C), background: C.white, ...(err ? ERR_RING : {}),
})
/** Variante select : même fond blanc, padding latéral réduit (chevron natif). */
const selW = (C: NcbC): CSSProperties => ({ ...inpW(C), padding: '0 var(--crm-space-md)' })

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
        <label style={{ display: 'block', fontSize: 'var(--crm-text-xs)', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 7 }}>
          {label}{required && <span style={{ color: C.inkSoft }}> *</span>}
        </label>
      )}
      {children}
    </div>
  )
}

function NcbCloseM({ C, onClick, label }: { C: NcbC; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ width: 36, height: 36, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', flexShrink: 0, background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}
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
        height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', cursor: off ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        fontSize: 'var(--crm-text-lg)', fontWeight: 700, whiteSpace: 'nowrap',
        border: ink ? 0 : `1px solid ${C.ctaGhostBorder}`,
        background: off ? C.cardSubtle : ink ? C.accent : 'transparent',
        color: off ? C.ghost : ink ? C.onAccent : C.inkSoft,
        boxShadow: ink && !off ? C.ctaShadow : 'none',
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
      }}
    >
      {icon && <NcvIcon name={icon} size={15} stroke={off ? C.ghost : ink ? C.onAccent : C.inkSoft} sw={2.2} />}
      {children}
    </button>
  )
}

function NcbTypePillM({ C, type, label }: { C: NcbC; type: ContactType; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: C.typeColor[type], color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 700, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

/**
 * Chip du panneau « Fiche express ». `onWhite` bascule l'état inactif sur blanc +
 * ombre : sur le fond `cardSubtle` du panneau, un chip inactif en `cardSubtle`
 * serait invisible.
 */
function NcvChipM({ C, active, onClick, check = true, onWhite = false, children }: {
  C: NcbC; active: boolean; onClick: () => void; check?: boolean; onWhite?: boolean; children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 34, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', fontFamily: 'inherit',
        background: active ? C.accent : onWhite ? C.white : C.cardSubtle,
        color: active ? C.onAccent : C.inkSoft, border: 0,
        boxShadow: !active && onWhite ? C.shadowSm : 'none',
        fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
      }}
    >
      {active && check && <NcvIcon name="check" size={12} stroke={C.onAccent} sw={2.2} />}
      {children}
    </button>
  )
}

function NcvAvatarM({ initials, color, size }: { initials: string; color: string; size: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: color, color: '#fff', display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 700, letterSpacing: 0.3, boxShadow: `0 6px 18px ${color}55` }}>
      {initials}
    </div>
  )
}

function NcbAvatarM({ photo, initials, color, size }: { photo: string | null; initials: string; color: string; size: number }) {
  return photo
    ? <img src={photo} alt="" style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', objectFit: 'cover', flexShrink: 0, boxShadow: '0 6px 18px rgba(15,23,42,0.14)' }} />
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
          width: S, height: S, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', padding: 0, overflow: 'hidden',
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
      <span onClick={open} style={{ position: 'absolute', right: -2, bottom: -2, width: 27, height: 27, borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}>
        <NcvIcon name="camera" size={14} stroke={C.inkSoft} sw={1.8} />
      </span>
      {photo && (
        <span onClick={onClear} title={removeLabel} style={{ position: 'absolute', right: -2, top: -2, width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', background: C.white, boxShadow: C.shadowSm, display: 'grid', placeItems: 'center' }}>
          <NcvIcon name="x" size={11} stroke={C.inkSoft} sw={2.2} />
        </span>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
    </div>
  )
}

// ── Éditeur de recadrage manuel ────────────────────────────────────────
function NcbCropEditorM({ C, src, onCancel, onDone, title, hint, cancelLabel, validateLabel, tint }: {
  C: NcbC; src: string; onCancel: () => void; onDone: (dataUrl: string) => void
  title: string; hint: string; cancelLabel: string; validateLabel: string
  /** Couleur du type sélectionné — teinte le voile (suffixe alpha 59 ≈ 35 %). */
  tint?: string
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
    <div style={{ position: 'absolute', inset: 0, zIndex: 60, display: 'grid', placeItems: 'center', background: tint ? `${tint}59` : 'rgba(20,28,45,0.34)', backdropFilter: 'blur(2px)' }}>
      <div style={{ width: 340, background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 'var(--crm-radius-5xl)', boxShadow: C.popoverShadow, padding: 'var(--crm-space-7xl) var(--crm-space-7xl) var(--crm-space-5xl)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, color: C.ink, alignSelf: 'flex-start' }}>{title}</div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: C.muted, alignSelf: 'flex-start', marginTop: 3, marginBottom: 16 }}>{hint}</div>
        <div
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          style={{ position: 'relative', width: V, height: V, borderRadius: 'var(--crm-radius-pill)', overflow: 'hidden', background: C.cardSubtle, cursor: 'grab', touchAction: 'none', boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.06)' }}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', width: '100%', margin: '18px 0 20px' }}>
          <NcvIcon name="search" size={15} stroke={C.muted} />
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => onZoom(parseFloat(e.target.value))} style={{ flex: 1, accentColor: C.ink, cursor: 'pointer' }} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', width: '100%', alignItems: 'center' }}>
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
  // La liste garde les cantons déjà choisis (marqués d'une coche) : cliquer une
  // entrée sélectionnée la retire, et le popover reste ouvert pour enchaîner.
  const matches = ql
    ? all.filter(([c, n]) => c.toLowerCase().startsWith(ql) || n.toLowerCase().includes(ql))
    : all
  const nameFor = (code: string) => (all.find(([c]) => c === code) || [code, code])[1]

  const remove = (code: string) => onChange(value.filter((x) => x !== code))
  const add = (code?: string) => {
    if (!code) return
    if (value.includes(code)) remove(code)
    else onChange([...value, code])
    setQ('')
  }
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
          minHeight: 40, padding: 'var(--crm-space-xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-lg)', background: C.white,
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', cursor: 'text',
          boxShadow: open ? `inset 0 0 0 2px ${C.accent}` : 'none',
        }}
      >
        {value.map((c) => (
          <span key={c} title={nameFor(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 26, padding: '0 var(--crm-space-xs) 0 var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: C.accent, color: C.onAccent, fontSize: 'var(--crm-text-sm)', fontWeight: 700 }}>
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
          style={{ flex: 1, minWidth: 90, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', color: C.ink, fontWeight: 600, height: 28, textTransform: 'uppercase' }}
        />
      </div>
      {open && matches.length > 0 && (
        <div style={{ position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 50, background: C.popoverBg, border: `1px solid ${C.popoverBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: C.popoverShadow, padding: 'var(--crm-space-sm)', maxHeight: 300, overflowY: 'auto' }}>
          {matches.slice(0, 40).map(([c, n], i) => {
            const on = value.includes(c)
            return (
              <button
                key={c}
                type="button"
                onMouseEnter={() => setHi(i)}
                onMouseDown={(e) => { e.preventDefault(); add(c) }}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', background: i === hi ? C.cardSubtle : 'transparent' }}
              >
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 800, color: C.ink, width: 24 }}>{c}</span>
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: C.muted, flex: 1 }}>{n}</span>
                {on && <NcvIcon name="check" size={13} stroke={C.ink} sw={2.4} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Ligne méta de l'aperçu vivant (icône + valeur, état vide « ghost ») ─
function MetaLineM({ C, icon, ghost, children }: { C: NcbC; icon: NcvIconName; ghost: boolean; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: ghost ? C.metaGhost : C.metaText }}>
      <span style={{ width: 24, height: 24, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
        <NcvIcon name={icon} size={19} stroke={C.metaIcon} sw={1.8} />
      </span>
      <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{children}</span>
    </div>
  )
}

/** Textes de la colonne d'aperçu — résolus par le parent (i18n hors des atomes). */
interface PreviewLabels {
  namePlaceholder: string
  birth: string
  budget: string
  cantons: string
  cancel: string
  addPhoto: string
  removePhoto: string
}

/**
 * Colonne gauche « aperçu vivant » : la fiche telle qu'elle existera, qui se
 * remplit à mesure de la saisie, et qui porte les deux actions. Elle ne scrolle
 * jamais — le spacer `flex:1` pousse les CTA en bas quelle que soit la hauteur.
 */
function PreviewColM({
  C, photo, initials, tint, type, typeLabel, fullName, birth, budgetLine, cantonsLine,
  isBuyer, labels, messages, canSubmit, submitLabel, onSubmit, onCancel, onPick, onClear,
}: {
  C: NcbC
  photo: string | null
  initials: string
  tint: string
  type: ContactType
  typeLabel: string
  fullName: string
  birth: string
  /** Budget / loyer / adresse du bien déjà formaté, ou null si non renseigné. */
  budgetLine: string | null
  /** Cantons joints, ou null si aucun. */
  cantonsLine: string | null
  isBuyer: boolean
  labels: PreviewLabels
  /** Erreurs à afficher au-dessus des CTA (validation, puis serveur). */
  messages: string[]
  canSubmit: boolean
  /** Libellé du CTA principal (bascule sur « Création… » pendant l'envoi). */
  submitLabel: string
  onSubmit: () => void
  onCancel: () => void
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void
  onClear: () => void
}) {
  return (
    <div style={{ width: 316, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '30px 20px 18px', textAlign: 'center', minHeight: 0, background: C.dark ? crmStep('s2', C.surfaceBg) : 'transparent', borderRadius: 'var(--crm-radius-2xl)' }}>
      <NcbPhotoPickerM C={C} photo={photo} initials={initials} color={tint} onPick={onPick} onClear={onClear} addLabel={labels.addPhoto} removeLabel={labels.removePhoto} />
      <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 800, letterSpacing: -0.5, color: fullName ? C.nameInk : C.nameGhost, marginTop: 14 }}>
        {fullName || labels.namePlaceholder}
      </div>
      <div style={{ marginTop: 9 }}><NcbTypePillM C={C} type={type} label={typeLabel} /></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', alignSelf: 'stretch', marginTop: 24, textAlign: 'left' }}>
        <MetaLineM C={C} icon="calendar" ghost={!birth}>{birth || labels.birth}</MetaLineM>
        <MetaLineM C={C} icon={isBuyer ? 'wallet' : 'pin'} ghost={!budgetLine}>{budgetLine || labels.budget}</MetaLineM>
        {isBuyer && <MetaLineM C={C} icon="pin" ghost={!cantonsLine}>{cantonsLine || labels.cantons}</MetaLineM>}
      </div>
      <div style={{ flex: 1 }} />
      {messages.map((m) => (
        <div key={m} style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: C.errText, marginBottom: 10, alignSelf: 'stretch', textAlign: 'left' }}>{m}</div>
      ))}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', alignSelf: 'stretch' }}>
        <button
          type="button"
          onClick={canSubmit ? onSubmit : undefined}
          disabled={!canSubmit}
          style={{
            height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: canSubmit ? 'pointer' : 'not-allowed', fontFamily: 'inherit',
            fontSize: 'var(--crm-text-lg)', fontWeight: 700,
            background: canSubmit ? C.ctaOnBg : C.ctaOffBg,
            color: canSubmit ? C.ctaOnInk : C.ctaOffInk,
            boxShadow: canSubmit && !C.dark ? C.ctaShadow : 'none',
          }}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          style={{
            height: 44, borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700,
            border: `1px solid ${C.dark ? 'rgba(255,255,255,0.22)' : C.ctaGhostBorder}`,
            background: 'transparent', color: C.ctaGhostInk,
          }}
        >
          {labels.cancel}
        </button>
      </div>
    </div>
  )
}

// ── Tuile secondaire (écran de confirmation) ───────────────────────────
function SecTileM({ C, icon, title, sub, onClick }: { C: NcbC; icon: NcvIconName; title: string; sub: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ flex: 1, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer', border: 0, background: C.white, borderRadius: 'var(--crm-radius-5xl)', boxShadow: C.cardShadow, padding: 'var(--crm-space-3xl) var(--crm-space-4xl)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}
    >
      <span style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-lg)', flexShrink: 0, display: 'grid', placeItems: 'center', background: C.cardSubtle }}>
        <NcvIcon name={icon} size={18} stroke={C.inkSoft} sw={1.9} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: C.ink }}>{title}</div>
        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: C.muted, marginTop: 2 }}>{sub}</div>
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
  /** JJ.MM.AAAA (saisie suisse) — converti en `date` ISO par identityToColumns. */
  birth: string
  /** ISO 3166-1 alpha-2. */
  nationality: string
  residence: string
  homeAddress: string
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
  // Nationalité / résidence démarrent VIDES et non à 'CH'. Le prototype pré-remplit
  // « Suisse », mais le bloc « Identité complète » qui les porte est replié par défaut :
  // un défaut y serait persisté comme une donnée d'identification LBA que l'agent n'a
  // jamais vue ni confirmée, et qui alimente le scoring de risque pays (listes FATF).
  // Une case vide se lit « À renseigner » sur la fiche — l'absence de donnée reste visible.
  type: 'buyer', civ: 'mrs', firstName: '', lastName: '', birth: '', nationality: '', residence: '', homeAddress: '',
  email: '', phone: '', lang: 'fr', canal: 'whatsapp', photo: null,
  budgetMin: '', budgetMax: '', rentMax: '', pTypes: ['appartement'], cantons: ['GE', 'VD'], rooms: '', address: '', propType: 'appartement', note: '',
}

const TYPE_IDS: ContactType[] = ['buyer', 'tenant', 'seller', 'landlord']

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
  onOpenKyc,
  onOpenFiche,
}: {
  sp: SugarPalette
  dark: boolean
  onClose: () => void
  onCreate: (data: NewContactData) => Promise<void>
  isPending: boolean
  error: string | null
  onOpenMatching: () => void
  /** Écran de confirmation — tuiles secondaires (contact créé). Repli sur onClose. */
  onOpenKyc?: () => void
  onOpenFiche?: () => void
}): JSX.Element {
  const { t } = useTranslation('contacts')
  const C = useMemo(() => buildC(sp, dark), [sp, dark])

  const [f, setF] = useState<FormState>(EMPTY)
  const [tried, setTried] = useState(false)
  const [created, setCreated] = useState(false)
  const [moreId, setMoreId] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const onField = (k: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }))
  const toggleIn = (k: 'pTypes', v: string) => setF((s) => ({ ...s, [k]: s[k].includes(v) ? s[k].filter((x) => x !== v) : [...s[k], v] }))

  const isBuyer = f.type === 'buyer' || f.type === 'tenant'
  const tc = C.typeColor[f.type]
  const fullName = `${f.firstName} ${f.lastName}`.trim()
  const initials = ((f.firstName[0] || '') + (f.lastName[0] || '')).toUpperCase()
  const emailOk = emailOkFn(f.email)
  // Une date impossible (30.02.1990, 5.3.80…) ne doit PAS passer : parseSwissDate la
  // convertirait en null et le contact serait créé sans date de naissance, alors que
  // l'agent l'a saisie. Même garde que CdIdentityModal sur la fiche, pour que les deux
  // surfaces refusent exactement le même contenu.
  const birthKo = isInvalidSwissDate(f.birth)
  const valid = !!(f.firstName.trim() && f.lastName.trim() && emailOk) && !birthKo
  const canSubmit = valid && !isPending

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
      // Colonnes typées LBA (art. 3) — jamais dans form_data : le KYC les requête.
      ...identityToColumns({ birth: f.birth, nationality: f.nationality, residence: f.residence, homeAddress: f.homeAddress }),
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
    if (!valid) { setTried(true); return }
    try {
      await onCreate(buildData())
      setCreated(true)
    } catch {
      // L'erreur est reflétée via le prop `error` — on reste ouvert.
    }
  }
  const reset = () => { setF(EMPTY); setTried(false); setCreated(false); setMoreId(false) }

  const onPickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => setCropSrc(typeof r.result === 'string' ? r.result : null)
    r.readAsDataURL(file)
    e.target.value = ''
  }
  const clearPhoto = () => setF((s) => ({ ...s, photo: null }))

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
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', marginBottom: 20 }}>
              <NcbAvatarM photo={f.photo} initials={initials} color={tc} size={46} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', color: GREEN }}>{t('newContactPager.created.eyebrow')}</div>
                <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 800, letterSpacing: -0.5, color: C.ink, marginTop: 1 }}>{fullName}</div>
              </div>
              <NcbTypePillM C={C} type={f.type} label={typeLabel(f.type)} />
            </div>
            <button
              type="button"
              onClick={onOpenMatching}
              style={{ fontFamily: 'inherit', cursor: 'pointer', border: 0, textAlign: 'left', background: C.accent, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-6xl) var(--crm-space-7xl)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4xl)', boxShadow: C.dark ? '0 20px 44px rgba(0,0,0,0.5)' : '0 20px 44px rgba(11,12,14,0.26)' }}
            >
              <span style={{ width: 48, height: 48, borderRadius: 'var(--crm-radius-xl)', flexShrink: 0, display: 'grid', placeItems: 'center', background: heroVeil }}>
                <NcvIcon name="sparkle" size={24} stroke={C.onAccent} sw={1.9} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, color: C.onAccent, letterSpacing: -0.3 }}>{t('newContactPager.created.heroTitle')}</div>
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: heroSub, marginTop: 3 }}>{t('newContactPager.created.heroSub')}</div>
              </div>
              <span style={{ display: 'grid', placeItems: 'center', transform: 'rotate(-90deg)' }}>
                <NcvIcon name="chevron" size={20} stroke={heroChev} sw={2.2} />
              </span>
            </button>
            <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 12 }}>
              <SecTileM C={C} icon="shield" title={t('newContactPager.created.kycTitle')} sub={t('newContactPager.created.kycSub')} onClick={onOpenKyc ?? onClose} />
              <SecTileM C={C} icon="user" title={t('newContactPager.created.ficheTitle')} sub={t('newContactPager.created.ficheSub')} onClick={onOpenFiche ?? onClose} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
              <NcbCtaM C={C} tone="ghost" icon="plus" onClick={reset}>{t('newContactPager.created.createAnother')}</NcbCtaM>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ══════════════ Formulaire — bento fusionné (concept D) ══════════════
  // Ligne méta « argent » : jamais de concaténation brute, formatCHF porte
  // l'apostrophe suisse (CHF 900'000) exigée par CLAUDE.md §6.
  const bMin = parseNum(f.budgetMin)
  const bMax = parseNum(f.budgetMax)
  const rMax = parseNum(f.rentMax)
  const budgetLine = isBuyer
    ? (f.type === 'tenant'
      ? (rMax !== null ? formatRent(rMax) : null)
      : (bMin !== null || bMax !== null ? `${bMin !== null ? formatCHF(bMin) : '…'} – ${bMax !== null ? formatCHF(bMax) : '…'}` : null))
    : (f.address.trim() || null)
  const budgetFallback = isBuyer
    ? (f.type === 'tenant' ? t('newContactPager.preview.rentMax') : t('newContactPager.preview.budget'))
    : t('newContactPager.preview.propertyAddress')
  const critTitle = isBuyer
    ? (f.type === 'tenant' ? t('newContactPager.criteriaRent') : t('newContactPager.criteriaBuy'))
    : (f.type === 'seller' ? t('newContact.property.titleSell') : t('newContact.property.titleRent'))
  const messages: string[] = []
  // Message dédié : sinon une date impossible grise le CTA en affichant « Prénom, nom
  // et e-mail valide requis », alors que ces trois champs sont corrects.
  if (tried && birthKo) messages.push(t('newContactPager.birthError'))
  if (tried && !valid && !birthKo) messages.push(t('newContactPager.validationError'))
  if (error) messages.push(error)

  // Beta v1 supprime le titre héros (D7) : sans lui la modale n'a plus aucun nom
  // accessible. Le libellé du panneau sert de nom, sans rien ajouter à l'écran.
  return (
    <div role="dialog" aria-modal="true" aria-label={t('newContactPager.expressCard')} className={C.dark ? 'ncbm-dark' : undefined} style={shellStyle}>
      {focusCss}
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Panneau = palier « cadre » ; la colonne d'aperçu se pose un cran au-dessus. */}
        <div style={{ flex: 1, display: 'flex', padding: 'var(--crm-space-3xl)', gap: 'var(--crm-space-7xl)', minHeight: 0, borderRadius: 'var(--crm-radius-6xl)', background: C.dark ? crmStep('s1', C.surfaceBg) : C.surfaceBg, boxShadow: C.cardShadow }}>

          {/* Aperçu vivant — se remplit pendant la saisie */}
          <PreviewColM
            C={C}
            photo={f.photo}
            initials={initials}
            tint={tc}
            type={f.type}
            typeLabel={typeLabel(f.type)}
            fullName={fullName}
            birth={f.birth}
            budgetLine={budgetLine}
            cantonsLine={f.cantons.length ? f.cantons.join(' · ') : null}
            isBuyer={isBuyer}
            labels={{
              namePlaceholder: t('newContactPager.preview.name'),
              birth: t('newContactPager.birth'),
              budget: budgetFallback,
              cantons: t('newContact.cantons'),
              cancel: t('newContactPager.cancel'),
              addPhoto: t('newContactPager.addPhoto'),
              removePhoto: t('newContactPager.removePhoto'),
            }}
            messages={messages}
            canSubmit={canSubmit}
            submitLabel={isPending ? t('newContact.creating') : t('newContact.submit')}
            onSubmit={submit}
            onCancel={onClose}
            onPick={onPickPhoto}
            onClear={clearPhoto}
          />

          {/* Fiche express — panneau soudé, seul élément scrollable */}
          <div style={{ flex: 1, minWidth: 0, background: C.cardSubtle, borderRadius: 'var(--crm-radius-2xl)', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)' }}>
              <div style={{ flex: 1, fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.ink }}>{t('newContactPager.expressCard')}</div>
              <NcbCloseM C={C} onClick={onClose} label={t('newContactPager.close')} />
            </div>

            {/* Type — pilules */}
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
              {TYPE_IDS.map((id) => {
                const on = f.type === id
                const col = C.typeColor[id]
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setF((s) => ({ ...s, type: id }))}
                    style={{
                      flex: 1, height: 38, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 'var(--crm-text-md)', fontWeight: on ? 800 : 600,
                      background: on ? col : C.white, color: on ? '#fff' : C.inkSoft,
                      boxShadow: on ? 'none' : C.shadowSm,
                    }}
                  >
                    {typeLabel(id)}
                  </button>
                )
              })}
            </div>

            {/* Identité — civilité, prénom, nom */}
            <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr 1fr', gap: 'var(--crm-space-xl)' }}>
              <NcvFieldM C={C} label={t('newContactPager.civ')}>
                <select className="ncbm-in" value={f.civ} onChange={onField('civ')} style={selW(C)}>
                  <option value="mrs">{t('newContact.civility.mrs')}</option>
                  <option value="mr">{t('newContact.civility.mr')}</option>
                </select>
              </NcvFieldM>
              <NcvFieldM C={C} label={t('newContactPager.firstName')} required>
                <input className="ncbm-in" value={f.firstName} onChange={onField('firstName')} placeholder={t('newContactPager.firstName')} style={inpW(C, tried && !f.firstName.trim())} />
              </NcvFieldM>
              <NcvFieldM C={C} label={t('newContactPager.lastName')} required>
                <input className="ncbm-in" value={f.lastName} onChange={onField('lastName')} placeholder={t('newContactPager.lastName')} style={inpW(C, tried && !f.lastName.trim())} />
              </NcvFieldM>
            </div>

            {/* Naissance (LBA, en clair) + langue */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
              <NcvFieldM C={C} label={t('newContactPager.birth')}>
                <input className="ncbm-in" value={f.birth} onChange={onField('birth')} placeholder={t('newContactPager.birthPlaceholder')} style={{ ...inpW(C, isInvalidSwissDate(f.birth)), ...MONO }} />
              </NcvFieldM>
              <NcvFieldM C={C} label={t('newContactPager.lang')}>
                <select className="ncbm-in" value={f.lang} onChange={onField('lang')} style={selW(C)}>
                  <option value="fr">{t('newContactPager.langOpt.fr')}</option>
                  <option value="de">{t('newContactPager.langOpt.de')}</option>
                  <option value="en">{t('newContactPager.langOpt.en')}</option>
                  <option value="it">{t('newContactPager.langOpt.it')}</option>
                </select>
              </NcvFieldM>
            </div>

            {/* Identité complète — replié par défaut (données LBA secondaires) */}
            <button
              type="button"
              onClick={() => setMoreId((m) => !m)}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', padding: 0, alignSelf: 'flex-start' }}
            >
              <span style={{ display: 'grid', placeItems: 'center', transform: moreId ? 'rotate(180deg)' : 'none', transition: 'transform 160ms ease' }}>
                <NcvIcon name="chevron" size={14} stroke={C.muted} sw={2} />
              </span>
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: C.inkSoft }}>{t('newContactPager.moreIdentity')}</span>
              {!moreId && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: C.muted }}>{t('newContactPager.moreIdentityHint')}</span>}
            </button>
            {moreId && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
                  <NcvFieldM C={C} label={t('newContactPager.nationality')}>
                    <select className="ncbm-in" value={f.nationality} onChange={onField('nationality')} style={selW(C)}>
                      <option value="">{t('fiche.identity.countryNone')}</option>
                      {COUNTRIES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                    </select>
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContactPager.residence')}>
                    <select className="ncbm-in" value={f.residence} onChange={onField('residence')} style={selW(C)}>
                      <option value="">{t('fiche.identity.countryNone')}</option>
                      {COUNTRIES.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
                    </select>
                  </NcvFieldM>
                </div>
                <NcvFieldM C={C} label={t('newContactPager.homeAddress')}>
                  <input className="ncbm-in" value={f.homeAddress} onChange={onField('homeAddress')} style={inpW(C)} />
                </NcvFieldM>
              </>
            )}

            {/* Contact */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 'var(--crm-space-xl)' }}>
              <NcvFieldM C={C} label={t('newContactPager.email')} required>
                <input className="ncbm-in" value={f.email} onChange={onField('email')} placeholder={t('newContactPager.emailPlaceholder')} style={inpW(C, tried && !emailOk)} />
              </NcvFieldM>
              <NcvFieldM C={C} label={t('newContactPager.phone')}>
                <input className="ncbm-in" value={f.phone} onChange={onField('phone')} placeholder={t('newContactPager.phonePlaceholder')} style={{ ...inpW(C), ...MONO }} />
              </NcvFieldM>
            </div>
            <NcvFieldM C={C} label={t('newContactPager.canal')}>
              <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', background: C.white, padding: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-lg)', boxShadow: C.shadowSm }}>
                {(['whatsapp', 'sms', 'call', 'email'] as const).map((cv) => {
                  const on = f.canal === cv
                  return (
                    <button
                      key={cv}
                      type="button"
                      onClick={() => setF((s) => ({ ...s, canal: cv }))}
                      style={{ flex: 1, height: 32, borderRadius: 'var(--crm-radius-sm)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: on ? 700 : 600, background: on ? C.accent : 'transparent', color: on ? C.onAccent : C.muted }}
                    >
                      {t(`newContactPager.canalOpt.${cv}`)}
                    </button>
                  )
                })}
              </div>
            </NcvFieldM>

            {/* Critères / bien — adapté au type */}
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: C.ink, marginTop: 4 }}>{critTitle}</div>
            {isBuyer ? (
              <>
                {f.type === 'tenant' ? (
                  <NcvFieldM C={C} label={t('newContactPager.rentMax')}>
                    <input className="ncbm-in" value={f.rentMax} onChange={onField('rentMax')} placeholder={t('newContactPager.rentMaxPlaceholder')} style={{ ...inpW(C), ...MONO, maxWidth: 220 }} />
                  </NcvFieldM>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
                    <NcvFieldM C={C} label={t('newContactPager.budgetMin')}>
                      <input className="ncbm-in" value={f.budgetMin} onChange={onField('budgetMin')} placeholder={t('newContactPager.budgetMinPlaceholder')} style={{ ...inpW(C), ...MONO }} />
                    </NcvFieldM>
                    <NcvFieldM C={C} label={t('newContactPager.budgetMax')}>
                      <input className="ncbm-in" value={f.budgetMax} onChange={onField('budgetMax')} placeholder={t('newContactPager.budgetMaxPlaceholder')} style={{ ...inpW(C), ...MONO }} />
                    </NcvFieldM>
                  </div>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 'var(--crm-space-xl)' }}>
                  <NcvFieldM C={C} label={t('newContact.propertyTypeLabel')}>
                    <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
                      {(['appartement', 'maison', 'terrain', 'commercial'] as const).map((id) => (
                        <NcvChipM key={id} C={C} active={f.pTypes.includes(id)} check={false} onWhite onClick={() => toggleIn('pTypes', id)}>
                          {t(`newContact.propertyType.${id === 'appartement' ? 'apartment' : id === 'maison' ? 'house' : id === 'terrain' ? 'land' : 'commercial'}`)}
                        </NcvChipM>
                      ))}
                    </div>
                  </NcvFieldM>
                  <NcvFieldM C={C} label={t('newContact.minRooms')}>
                    <input className="ncbm-in" value={f.rooms} onChange={onField('rooms')} placeholder={t('newContactPager.roomsPlaceholder')} style={{ ...inpW(C), ...MONO }} />
                  </NcvFieldM>
                </div>
                <NcvFieldM C={C} label={t('newContact.cantons')}>
                  <NcbCantonAutoM C={C} value={f.cantons} onChange={(v) => setF((s) => ({ ...s, cantons: v }))} placeholder={t('newContactPager.cantonPlaceholder')} />
                </NcvFieldM>
              </>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 'var(--crm-space-xl)' }}>
                <NcvFieldM C={C} label={t('newContact.property.address')}>
                  <input className="ncbm-in" value={f.address} onChange={onField('address')} placeholder={t('newContactPager.addressPlaceholder')} style={inpW(C)} />
                </NcvFieldM>
                <NcvFieldM C={C} label={t('newContact.property.type')}>
                  <select className="ncbm-in" value={f.propType} onChange={onField('propType')} style={inpW(C)}>
                    <option value="appartement">{t('newContact.propertyType.apartment')}</option>
                    <option value="maison">{t('newContact.propertyType.house')}</option>
                    <option value="terrain">{t('newContact.propertyType.land')}</option>
                    <option value="commercial">{t('newContact.propertyType.commercial')}</option>
                  </select>
                </NcvFieldM>
              </div>
            )}

            {/* Note — absorbe la hauteur résiduelle du panneau (soude la mise en page) */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
              <label style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('newContactPager.note')}</label>
              <textarea
                className="ncbm-in"
                value={f.note}
                onChange={onField('note')}
                placeholder={t('newContactPager.notePlaceholder')}
                style={{ ...inpW(C), flex: 1, height: 'auto', minHeight: 56, padding: 'var(--crm-space-lg) var(--crm-space-xl)', resize: 'none', lineHeight: 1.5, display: 'block' }}
              />
            </div>
          </div>
        </div>
      </div>

      {cropSrc && (
        <NcbCropEditorM
          C={C}
          src={cropSrc}
          tint={tc}
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
