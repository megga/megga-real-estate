// MEGGA CRM — SugarIconRail « Liquid Glass »
// ----------------------------------------------------------------------------
// Refonte du rail vertical gauche (outils transverses, jamais la navigation
// pages — celle-ci reste à la TopNav). Recréation fidèle du handoff design
// « Liquid Glass — Icon Rail » :
//   • capsule en verre harmonisée sur les tokens des cards Sugar (frameBg /
//     frameBorder / shadow) + léger backdrop-filter (même matériau que le reste)
//   • icônes line-art qui se redessinent (self-draw Framer Motion) à l'activation
//     ET au survol — pop spring + tracé manuscrit décalé par sous-tracé. Le rejeu
//     est LOCAL au bouton survolé (même patron qu'AnimatedTopIcon) : survoler une
//     icône ne remonte jamais l'arbre motion des 7 autres.
//   • bascule de thème : échange d'icône soleil ↔ lune (self-draw, pas un morph)
//   • filet anti-throttle (état final garanti même rAF gelé)
//
// Câblage réel (le proto utilisait des globales window.* — remplacées ici) :
//   search / add → onCmd (palette ⌘K)   ·   relances → overlay RelanceSession
//   import → /dashboard/import-lead       ·   kyc/dashboard/settings → onNavigate
//   __dark → setDark
//
// Source : design_handoff_sidebar_liquid_glass (README + reference-demo).

import { useState, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion, type Transition } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import type { SugarPalette } from './tokens'
import { RelanceSession } from '@/components/crm-sugar/today/RelanceSession'
import { openSugarSearch } from './search/openSearch'

// ─── Tracés SVG des icônes du rail (glyphes officiels MEGGA, viewBox 24) ───
// On embarque les tracés ici plutôt que via <MEIcon> : MEIcon délègue dashboard
// /sun/moon à une icon-font (pas de paths → ni self-draw ni morph possibles).
// `line:true` ⇒ stroke, éligible au self-draw. `line:false` ⇒ fill, pop+fondu.
type SvgTag = 'path' | 'circle' | 'rect'
interface IconKid {
  tag: SvgTag
  d?: string
  cx?: number; cy?: number; r?: number
  x?: number; y?: number; width?: number; height?: number; rx?: number
}
interface RailIconDef { line: boolean; kids: IconKid[] }

const RAIL_ICONS: Record<string, RailIconDef> = {
  search: { line: true, kids: [
    { tag: 'circle', cx: 11, cy: 11, r: 7 },
    { tag: 'path', d: 'm20 20-3.5-3.5' },
  ] },
  plus: { line: true, kids: [
    { tag: 'path', d: 'M12 5v14M5 12h14' },
  ] },
  phone: { line: true, kids: [
    { tag: 'path', d: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z' },
  ] },
  // check / calendar — ajoutés pour le self-draw des boutons glassy du Mode
  // Focus (refonte « Aujourd'hui »). Glyphes MEIcon officiels.
  check: { line: true, kids: [
    { tag: 'path', d: 'm5 12 5 5L20 7' },
  ] },
  calendar: { line: true, kids: [
    { tag: 'rect', x: 3, y: 5, width: 18, height: 16, rx: 2 },
    { tag: 'path', d: 'M3 9h18M8 3v4M16 3v4' },
  ] },
  download: { line: true, kids: [
    { tag: 'path', d: 'M12 3v14' },
    { tag: 'path', d: 'm5 12 7 7 7-7' },
    { tag: 'path', d: 'M4 21h16' },
  ] },
  refresh: { line: true, kids: [
    { tag: 'path', d: 'M3 12a9 9 0 0 1 15-6.7L21 8' },
    { tag: 'path', d: 'M21 3v5h-5' },
    { tag: 'path', d: 'M21 12a9 9 0 0 1-15 6.7L3 16' },
    { tag: 'path', d: 'M3 21v-5h5' },
  ] },
  shield: { line: true, kids: [
    { tag: 'path', d: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z' },
    { tag: 'path', d: 'm9 12 2 2 4-4' },
  ] },
  dashboard: { line: false, kids: [
    { tag: 'path', d: 'M3 3h8v9H3V3Zm0 11h8v7H3v-7Zm10-11h8v5h-8V3Zm0 7h8v11h-8V10Z' },
  ] },
  settings: { line: true, kids: [
    { tag: 'circle', cx: 12, cy: 12, r: 3 },
    { tag: 'path', d: 'M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 0 0-2.2 1.3l-2.3-.9-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .9.1 1.3l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2.2 1.3L10 21h4l.4-2.4a7 7 0 0 0 2.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3Z' },
  ] },
  sun: { line: true, kids: [
    { tag: 'circle', cx: 12, cy: 12, r: 4 },
    { tag: 'path', d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41' },
  ] },
  moon: { line: false, kids: [
    { tag: 'path', d: 'M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z' },
  ] },
  // — TopNav (cluster droit) —
  sparkle: { line: true, kids: [
    { tag: 'path', d: 'm12 3-1.91 5.81a2 2 0 0 1-1.28 1.28L3 12l5.81 1.91a2 2 0 0 1 1.28 1.28L12 21l1.91-5.81a2 2 0 0 1 1.28-1.28L21 12l-5.81-1.91a2 2 0 0 1-1.28-1.28L12 3Z' },
  ] },
  bell: { line: true, kids: [
    { tag: 'path', d: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9' },
    { tag: 'path', d: 'M10 21a2 2 0 0 0 4 0' },
  ] },
  help: { line: true, kids: [
    { tag: 'circle', cx: 12, cy: 12, r: 10 },
    { tag: 'path', d: 'M9.1 9a3 3 0 0 1 5.82 1c0 2-3 3-3 3' },
    { tag: 'path', d: 'M12 17h.01' },
  ] },
}

// Signature d'entrée par icône (amplitude du pop) — donne du caractère à chacune.
type Signature = { scale?: number; rotate?: number; y?: number }
const SIGNATURES: Record<string, Signature> = {
  search:    { scale: 0.55, rotate: -14 },
  plus:      { scale: 0.5,  rotate: 90 },
  phone:     { scale: 0.6,  y: 7 },
  download:  { scale: 0.6,  y: -9 },
  shield:    { scale: 0.55, y: 7 },
  dashboard: { scale: 0.6 },
  settings:  { scale: 0.55, rotate: 180 },
  sun:       { scale: 0.5,  rotate: -90 },
  moon:      { scale: 0.6,  rotate: 18 },
  // TopNav (cluster droit)
  sparkle:   { scale: 0.3,  rotate: 90 },
  bell:      { scale: 0.62, rotate: 10, y: -3 },
  help:      { scale: 0.55, rotate: -12 },
}

const SUB_STYLE: CSSProperties = { transformBox: 'fill-box', transformOrigin: 'center' }

// ─── Icône animée : pop spring (toute l'icône) + self-draw par sous-tracé ──
// `nonce` est piloté par l'appelant. 0 ⇒ état final figé. >0 ⇒ l'icône joue/rejoue
// son entrée ; chaque incrément la relance. `tempo` ralentit l'ensemble (1.7 =
// réglage canonique du design, plus fluide). `size` = taille du SVG (rail 23, TopNav ~19).
interface AnimatedRailIconProps { name: string; nonce: number; tempo?: number; size?: number; signature?: Signature }
function AnimatedRailIcon({ name, nonce, tempo = 1, size = 23, signature }: AnimatedRailIconProps) {
  const def = RAIL_ICONS[name] ?? RAIL_ICONS.search
  const isLine = def.line
  const kidCount = def.kids.length
  const wrapRef = useRef<HTMLDivElement>(null)
  const reduced = useReducedMotion()
  // Joue dès qu'un déclencheur (montage actif / survol) a eu lieu — sauf si
  // l'utilisateur a demandé « réduire les animations » : `play=false` rend
  // directement l'état final (initial={false}), sans pop ni tracé.
  const play = nonce > 0 && !reduced

  // Filet anti-throttle : si le rAF est gelé (onglet en arrière-plan), Framer ne
  // commit jamais → l'icône resterait INVISIBLE (pathLength 0 ⇒ dasharray "0 1",
  // donc un bouton vide). Après la durée nominale, on écrit l'état final dans le
  // DOM, indépendamment du rAF.
  // ⚠ Motion écrit opacity / stroke-dash* en ATTRIBUTS de présentation sur les
  // enfants SVG ; un `style` inline gagnerait la cascade DÉFINITIVEMENT et
  // gèlerait le nœud. On purge donc le style et on écrit par le même canal que
  // motion, pour qu'il puisse toujours reprendre la main.
  useEffect(() => {
    if (!play) return
    const drawMs = (0.5 + Math.max(0, kidCount - 1) * 0.06) * tempo * 1000
    const id = window.setTimeout(() => {
      const el = wrapRef.current
      if (!el) return
      el.style.transform = 'none' // wrapper HTML : motion écrit aussi via style
      el.querySelectorAll<SVGElement>('svg > *').forEach((k) => {
        k.style.removeProperty('opacity')
        k.style.removeProperty('stroke-dasharray')
        k.style.removeProperty('stroke-dashoffset')
        k.style.transform = 'none'
        k.setAttribute('opacity', '1')
        k.setAttribute('stroke-dasharray', 'none')
        k.setAttribute('stroke-dashoffset', '0')
      })
    }, drawMs + 400)
    return () => window.clearTimeout(id)
  }, [nonce, play, tempo, kidCount])

  const sig = signature ?? SIGNATURES[name] ?? { scale: 0.6 }

  return (
    <motion.div
      ref={wrapRef}
      key={play ? `play-${nonce}` : 'rest'} // remonter pour rejouer initial → animate
      initial={play ? { scale: sig.scale ?? 0.6, rotate: sig.rotate ?? 0, y: sig.y ?? 0 } : false}
      animate={{ scale: 1, rotate: 0, y: 0 }}
      transition={{ type: 'spring', stiffness: 440 / tempo, damping: 16, mass: 0.6 * tempo }}
      style={{ display: 'grid', placeItems: 'center' }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={isLine ? 'none' : 'currentColor'}
        stroke={isLine ? 'currentColor' : 'none'}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.25))', overflow: 'visible' }}
      >
        {def.kids.map((kid, i) => {
          const initial = !play
            ? false
            : isLine
              ? { pathLength: 0, opacity: 0 }
              : { opacity: 0, scale: 0.7 }
          const animate = isLine ? { pathLength: 1, opacity: 1 } : { opacity: 1, scale: 1 }
          const transition: Transition = isLine
            ? {
                pathLength: { duration: 0.5 * tempo, delay: i * 0.06 * tempo, ease: [0.4, 0, 0.2, 1] },
                opacity: { duration: 0.05, delay: i * 0.06 * tempo },
              }
            : { duration: 0.34 * tempo, ease: [0.34, 1.4, 0.5, 1] }
          const common = { initial, animate, transition, style: SUB_STYLE }
          if (kid.tag === 'circle') {
            return <motion.circle key={i} cx={kid.cx} cy={kid.cy} r={kid.r} {...common} />
          }
          if (kid.tag === 'rect') {
            return <motion.rect key={i} x={kid.x} y={kid.y} width={kid.width} height={kid.height} rx={kid.rx} {...common} />
          }
          return <motion.path key={i} d={kid.d} {...common} />
        })}
      </svg>
    </motion.div>
  )
}

// ─── Icône animée TopNav (barre du haut) ───────────────────────────────────
// Wrapper autonome (per-bouton) pour les icônes d'action de la TopNav : il gère
// son propre hover/nonce et rejoue le self-draw à chaque survol. `active` ⇒
// l'icône se dessine dès le montage (ex. ✦ Julien sur sa page). Couleur via `color`.
export function AnimatedTopIcon({
  name, color, size = 19, tempo = 1.7, active = false, signature,
}: { name: string; color: string; size?: number; tempo?: number; active?: boolean; signature?: Signature }) {
  const [animN, setAnimN] = useState(active ? 1 : 0)
  return (
    <span
      onMouseEnter={() => setAnimN((n) => n + 1)}
      style={{ display: 'grid', placeItems: 'center', color, lineHeight: 0 }}
    >
      <AnimatedRailIcon name={name} nonce={animN} size={size} tempo={tempo} signature={signature} />
    </span>
  )
}

// ─── Bouton d'outil (46×46, transparent, pop au survol) ────────────────────
// Le nonce de rejeu est LOCAL au bouton (même patron qu'AnimatedTopIcon) : seule
// l'icône réellement survolée rejoue son pop + self-draw. Il repart de 1 quand le
// bouton est actif, pour que l'icône active se dessine dès le montage. Le clic
// l'incrémente aussi : le bouton thème échange son glyphe (lune ↔ soleil) sans
// nouveau `mouseenter`, il faut donc relancer le tracé du nouveau glyphe.
interface RailItem {
  id: string
  icon: string
  label: string
  action: () => void
  dot?: boolean
}
interface DockBtnProps {
  it: RailItem
  isActive: boolean
  idleIcon: string
  hoverIcon: string
  activeIcon: string
  sp: SugarPalette
}
function DockBtn({ it, isActive, idleIcon, hoverIcon, activeIcon, sp }: DockBtnProps) {
  const [hover, setHover] = useState(false)
  const [nonce, setNonce] = useState(isActive ? 1 : 0)
  const replay = () => setNonce((n) => n + 1)

  const color = isActive ? activeIcon : hover ? hoverIcon : idleIcon

  return (
    <div style={{ position: 'relative', display: 'grid', placeItems: 'center' }}>
      <button
        type="button"
        title={it.label}
        aria-label={it.label}
        onClick={() => { it.action(); replay() }}
        onMouseEnter={() => { setHover(true); replay() }} // ne relance QUE cette icône
        onMouseLeave={() => setHover(false)}
        style={{
          position: 'relative', width: 46, height: 46, borderRadius: 999,
          border: 0, cursor: 'pointer', background: 'transparent',
          display: 'grid', placeItems: 'center', flexShrink: 0,
          transform: hover && !isActive ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 200ms cubic-bezier(.34,1.4,.5,1)',
        }}
      >
        <span style={{
          position: 'relative', zIndex: 1, display: 'grid', placeItems: 'center',
          color, transition: 'color 240ms ease',
        }}>
          <AnimatedRailIcon name={it.icon} nonce={nonce} tempo={1.7} />
        </span>
      </button>
      {it.dot && !isActive && (
        <span style={{
          position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 999,
          background: '#F02849', border: `2px solid ${sp.pageBg}`, zIndex: 2,
        }} />
      )}
    </div>
  )
}

// ─── Le rail ───────────────────────────────────────────────────────────────
export interface SugarIconRailProps {
  active?: string
  onNavigate?: (id: string) => void
  dark: boolean
  setDark: (v: boolean) => void
  sp: SugarPalette
  onCmd?: () => void
  extraBottomBtn?: ReactNode
}

export function SugarIconRail({
  active = 'today', onNavigate, dark, setDark, sp, onCmd, extraBottomBtn,
}: SugarIconRailProps) {
  const navigate = useNavigate()
  const { t } = useTranslation('common')
  const [relanceOpen, setRelanceOpen] = useState(false)

  // Pas de nonce de rejeu au niveau du rail : chaque DockBtn tient le sien. Un
  // survol ne re-rend donc que le bouton pointé — le rail lui-même ne re-rend pas.
  const idleIcon = dark ? 'rgba(255,255,255,0.62)' : 'rgba(20,22,34,0.50)'
  const hoverIcon = dark ? 'rgba(255,255,255,0.92)' : 'rgba(11,12,14,0.85)'
  const activeIcon = dark ? '#FFFFFF' : '#0B0C0E'

  // Capsule harmonisée — mêmes tokens que les cards/frames Sugar (frameBg /
  // frameBorder / shadow) pour que le rail soit du MÊME matériau que le reste de
  // l'UI. On garde uniquement un fin reflet supérieur pour le caractère verre.
  const capsule: CSSProperties = {
    background: sp.frameBg,
    border: `1px solid ${sp.frameBorder}`,
    boxShadow: `inset 0 1px 0.5px ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)'}, ${sp.shadow}`,
  }

  // Outils transverses (la TopNav gère les PAGES — aucun doublon ici).
  const items: RailItem[] = [
    { id: 'search', icon: 'search', label: t('actions.search'), action: () => openSugarSearch() },
    { id: 'add', icon: 'plus', label: t('actions.create'), action: () => onCmd?.() },
    { id: 'relances', icon: 'phone', label: t('nav.callbacksToday'), action: () => setRelanceOpen(true) },
    { id: 'import', icon: 'download', label: t('nav.importLeads'), action: () => navigate('/dashboard/import-lead') },
    { id: 'kyc', icon: 'shield', label: t('nav.kyc'), action: () => onNavigate?.('kyc') },
    { id: 'dashboard', icon: 'dashboard', label: t('nav.dashboard'), action: () => onNavigate?.('dashboard') },
  ]
  const settingsItem: RailItem = { id: 'settings', icon: 'settings', label: t('nav.settings'), action: () => onNavigate?.('settings') }
  // Icône sun/moon selon la maquette (lune en clair, soleil en sombre). Le rejeu
  // du tracé après bascule est assuré par le `replay()` au clic dans DockBtn.
  const darkItem: RailItem = {
    id: '__dark', icon: dark ? 'sun' : 'moon',
    label: dark ? t('nav.lightMode') : t('nav.darkMode'),
    action: () => setDark(!dark),
  }

  const renderBtn = (it: RailItem) => (
    <DockBtn
      key={it.id}
      it={it}
      isActive={it.id === active}
      idleIcon={idleIcon}
      hoverIcon={hoverIcon}
      activeIcon={activeIcon}
      sp={sp}
    />
  )

  return (
    <>
      <aside style={{
        width: 128, flexShrink: 0,
        padding: '96px 0 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          position: 'sticky', top: 16, overflow: 'visible',
          borderRadius: 34,
          // Backdrop tonifié, aligné sur les cards Sugar (blur 8px) — sans boost
          // de luminosité ni filtre SVG de réfraction.
          backdropFilter: 'blur(8px) saturate(1.15)',
          WebkitBackdropFilter: 'blur(8px) saturate(1.15)',
          padding: '14px 10px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          animation: 'sugar-fade-up 480ms cubic-bezier(.22,1,.36,1) both',
          ...capsule,
        }}>
          {items.map(renderBtn)}

          {extraBottomBtn && <>{extraBottomBtn}</>}

          {renderBtn(settingsItem)}
          {renderBtn(darkItem)}
        </div>
      </aside>

      {/* Session de relance — déclenchée par l'outil « Relances du jour ».
          Recâblée (refonte « Aujourd'hui », juin 2026) vers la NOUVELLE
          RelanceSession plein cadre. Montée à la demande seulement. */}
      {relanceOpen && (
        <RelanceSession onClose={() => setRelanceOpen(false)} />
      )}
    </>
  )
}

