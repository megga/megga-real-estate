// MEGGA CRM — CrmIconRail « Liquid Glass » — DOCK DE LA CONSOLE SUPER-ADMIN
//
// ⚠ CE RAIL N'EST PLUS LE CHROME DU CRM. Depuis le 4 septembre 2026 les
// surfaces agent montent `CrmSidebar.tsx` — une barre latérale repliable qui
// porte les pages, les outils et le compte. Il ne reste ici QU'UN
// consommateur : `AdminShell`, qui s'en sert comme dock de quatre boutons
// (recherche, retour au CRM, réglages, thème).
//
// Deux conséquences écrites dans le code plus bas :
//   • `items` est désormais REQUIS. La liste par défaut portait des gestes
//     d'agence (relances, import, KYC, analytics) qu'aucun appelant ne demande
//     plus ; la garder aurait laissé une porte ouverte sur des actions que
//     seule la barre latérale doit offrir.
//   • `RelanceSession` ne se monte plus ici : son état ET son montage sont
//     passés à la barre, qui est maintenant l'unique porte de bureau.
//
// Ce fichier reste le jeu de glyphes tracés du CRM (`RAIL_ICONS`), et il en
// expose DEUX rendus : `RailIcon`, statique, que monte la barre latérale ; et
// `AnimatedRailIcon`, privé, que seul le dock de la console fait vibrer.
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
//   import → /dashboard/import-lead       ·   kyc/dashboard/settings → onNavigate
//   __dark → setDark
//
// Source : design_handoff_sidebar_liquid_glass (README + reference-demo).

import { useState, useEffect, useRef } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, type Transition } from 'motion/react'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { crmVoileEncre, type CrmPalette } from './tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

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
  // — Sections de la barre latérale (CrmSidebar) —
  // Tracés repris des glyphes MEIcon officiels. Tous en `line:true` : une seule
  // graisse dans la colonne. MEIcon en délègue plusieurs (dashboard, chart) à
  // une icon-font qui rend PLEIN — les mélanger se lirait comme deux jeux.
  // Boîte de réception — même tracé que `MEIcon.inbox`, redessiné ici parce que
  // le rail se dessine lui-même (il ne monte pas MEIcon).
  inbox: { line: true, kids: [
    { tag: 'path', d: 'M22 12h-6l-2 3h-4l-2-3H2' },
    { tag: 'path', d: 'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z' },
  ] },
  home: { line: true, kids: [
    { tag: 'path', d: 'M3 11 12 4l9 7' },
    { tag: 'path', d: 'M5 10v10h14V10' },
    { tag: 'path', d: 'M10 20v-6h4v6' },
  ] },
  pipeline: { line: true, kids: [
    { tag: 'circle', cx: 5, cy: 6, r: 2.4 },
    { tag: 'circle', cx: 5, cy: 18, r: 2.4 },
    { tag: 'circle', cx: 19, cy: 12, r: 2.4 },
    { tag: 'path', d: 'M7 6h6a2 2 0 0 1 2 2v2' },
    { tag: 'path', d: 'M7 18h6a2 2 0 0 0 2-2v-2' },
  ] },
  compass: { line: true, kids: [
    { tag: 'circle', cx: 12, cy: 12, r: 9 },
    { tag: 'path', d: 'm15 9-2 6-6 2 2-6 6-2Z' },
  ] },
  // « Parcours » : trois jalons reliés — le graphe de `share` dit la trajectoire
  // mieux qu'un fanion. MEIcon n'a ni `journey` ni `parcours`.
  journey: { line: true, kids: [
    { tag: 'circle', cx: 18, cy: 5, r: 3.2 },
    { tag: 'circle', cx: 6, cy: 12, r: 3.2 },
    { tag: 'circle', cx: 18, cy: 19, r: 3.2 },
    { tag: 'path', d: 'm8.6 13.5 6.8 4' },
    { tag: 'path', d: 'm15.4 6.5-6.8 4' },
  ] },
  users: { line: true, kids: [
    { tag: 'circle', cx: 9, cy: 8, r: 3.7 },
    { tag: 'path', d: 'M2.8 20c.7-3.5 3.1-5.2 6.2-5.2s5.5 1.7 6.2 5.2' },
    { tag: 'circle', cx: 17.4, cy: 9.2, r: 2.9 },
    { tag: 'path', d: 'M15.4 20.2c.5-2.2 1.6-3.4 3.3-3.4s2.7 1.1 3.3 3' },
  ] },
  // ⚠ Les six fenêtres sont des BARREAUX, pas les points de MEIcon : à 20 px,
  // six `h.01` en bout rond dans un cadre se lisent comme un pavé numérique, pas
  // comme un immeuble. La porte au pied lève l'ambiguïté qui restait.
  building: { line: true, kids: [
    { tag: 'rect', x: 4, y: 3, width: 16, height: 18, rx: 1.5 },
    { tag: 'path', d: 'M8 7.5h2.2M13.8 7.5H16M8 11.5h2.2M13.8 11.5H16' },
    { tag: 'path', d: 'M10 21v-3.5h4V21' },
  ] },
  // Analytics = l'objectif et le rythme, d'où la cible plutôt qu'une courbe :
  // `trending-up` et `trending-down` rendent le MÊME glyphe dans MEIcon.
  // ⚠ Le centre est un `h.01` en bout ROND, pas un cercle : un cercle de rayon
  // 1,4 sous un trait de 1,6 n'a plus de trou — il sortait en pâté. Le segment
  // nul rend un point net du diamètre du trait. Idiome de MEIcon (`info`, `help`).
  target: { line: true, kids: [
    { tag: 'circle', cx: 12, cy: 12, r: 9 },
    { tag: 'circle', cx: 12, cy: 12, r: 4.6 },
    { tag: 'path', d: 'M12 12h.01' },
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

// ─── Glyphe STATIQUE ───────────────────────────────────────────────────────
// Mêmes tracés, même graisse, aucun mouvement : ni pop d'entrée, ni self-draw,
// ni rejeu au survol. C'est ce que monte la barre latérale (décision Julien,
// 4 septembre 2026) — seize lignes qui se redessinent au passage du curseur
// font grouiller la colonne au lieu de la rendre lisible.
//
// ⚠ Ni filtre d'ombre ici : celui du rail appartient au VERRE de sa capsule.
// Sur une ligne plate — a fortiori sur son aplat d'accent — il salit le tracé.
/**
 * Graisse du glyphe STATIQUE — 1,6, et non le 1,8 du rail.
 *
 * ⛔ Mesuré à l'écran, pas déduit : sur un viewBox de 24, un trait de 1,8 BOUCHE
 * tout cercle de rayon ≤ 2 (il ne lui reste qu'un trou de 1,1). Les nœuds de
 * « Pipeline », les têtes de « Contacts » et les jalons de « Parcours » sortaient
 * en pâtés pleins. La capsule du rail, elle, garde 1,8 : son verre avale un
 * trait plus fin.
 */
const STATIC_STROKE = 1.6

export function RailIcon({ name, size = 23 }: { name: string; size?: number }) {
  const def = RAIL_ICONS[name] ?? RAIL_ICONS.search
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={def.line ? 'none' : 'currentColor'}
      stroke={def.line ? 'currentColor' : 'none'}
      strokeWidth={STATIC_STROKE}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ display: 'block', overflow: 'visible' }}
    >
      {def.kids.map((kid, i) => {
        if (kid.tag === 'circle') return <circle key={i} cx={kid.cx} cy={kid.cy} r={kid.r} />
        if (kid.tag === 'rect') return <rect key={i} x={kid.x} y={kid.y} width={kid.width} height={kid.height} rx={kid.rx} />
        return <path key={i} d={kid.d} />
      })}
    </svg>
  )
}

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

// ─── Bouton d'outil (46×46, transparent, pop au survol) ────────────────────
// Le nonce de rejeu est LOCAL au bouton (même patron qu'AnimatedTopIcon) : seule
// l'icône réellement survolée rejoue son pop + self-draw. Il repart de 1 quand le
// bouton est actif, pour que l'icône active se dessine dès le montage. Le clic
// l'incrémente aussi : le bouton thème échange son glyphe (lune ↔ soleil) sans
// nouveau `mouseenter`, il faut donc relancer le tracé du nouveau glyphe.
export interface RailItem {
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
  sp: CrmPalette
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
          position: 'relative', width: 46, height: 46, borderRadius: 'var(--crm-radius-pill)',
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
          position: 'absolute', top: 6, right: 6, width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)',
          background: '#F02849', border: `2px solid ${sp.pageBg}`, zIndex: 2,
        }} />
      )}
    </div>
  )
}

// ─── Le rail ───────────────────────────────────────────────────────────────
export interface CrmIconRailProps {
  active?: string
  onNavigate?: (id: string) => void
  dark: boolean
  setDark: (v: boolean) => void
  sp: CrmPalette
  extraBottomBtn?: ReactNode
  /**
   * Outils du dock. REQUIS depuis le retrait de la liste par défaut : celle-ci
   * décrivait les gestes d'agence du CRM (relances, import, KYC, analytics),
   * qui vivent maintenant dans `CrmSidebar`. Un rail sans liste rendrait des
   * boutons que sa seule surface — la console — ne sait pas honorer.
   */
  items: RailItem[]
}

export function CrmIconRail({
  active = 'today', onNavigate, dark, setDark, sp, extraBottomBtn, items,
}: CrmIconRailProps) {
  const { t } = useTranslation('common')

  // Pas de nonce de rejeu au niveau du rail : chaque DockBtn tient le sien. Un
  // survol ne re-rend donc que le bouton pointé — le rail lui-même ne re-rend pas.
  // Trois degrés d'encre d'icône, tous dérivés du même pôle. `crmVoileEncre`
  // nomme le rôle — « un voile de ce qui s'oppose à la surface » — au lieu de
  // redire à la main la paire clair/sombre : c'est par cette porte que le noir
  // de Sugar était entré ici, en `rgba(11,12,14,0.85)` que personne ne relit
  // comme une couleur. L'état ACTIF n'est pas un voile mais l'encre pleine.
  //
  // ⚠ `idleIcon` n'était PAS signalé par le cliquet : il portait
  // `rgba(20,22,34,0.50)`, un quasi-noir BLEUTÉ (B−R = 14) — même famille que le
  // gris-bleu slate-900, en plus discret, et qu'aucune garde ne connaît. Mesuré
  // avant de le déplacer, alpha COMPOSÉ sur la surface réelle du rail (`frameBg`,
  // #ffffff en clair) : les trois degrés montent ou ne bougent pas.
  //   idle  clair 3,40 → 3,90 · hover clair 13,17 → 14,55 · actif 19,57 → 20,62
  //   sombre : inchangé (les trois partaient déjà du blanc).
  // Le seuil qui s'applique est celui du NON-TEXTE (3:1) : ce sont des glyphes.
  const idleIcon = crmVoileEncre(dark, dark ? 0.62 : 0.50)
  const hoverIcon = crmVoileEncre(dark, dark ? 0.92 : 0.85)
  const activeIcon = dark ? MXC_COLOR.n1000 : MXC_COLOR.n100

  // Capsule harmonisée — mêmes tokens que les cards/frames Sugar (frameBg /
  // frameBorder / shadow) pour que le rail soit du MÊME matériau que le reste de
  // l'UI. On garde uniquement un fin reflet supérieur pour le caractère verre.
  const capsule: CSSProperties = {
    background: sp.frameBg,
    border: `1px solid ${sp.frameBorder}`,
    boxShadow: `inset 0 1px 0.5px ${dark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.35)'}, ${sp.shadow}`,
  }

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
          padding: 'var(--crm-space-2xl) var(--crm-space-lg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--crm-space-xs)',
          animation: 'crm-fade-up 480ms cubic-bezier(.22,1,.36,1) both',
          ...capsule,
        }}>
          {items.map(renderBtn)}

          {extraBottomBtn && <>{extraBottomBtn}</>}

          {renderBtn(settingsItem)}
          {renderBtn(darkItem)}
        </div>
      </aside>
    </>
  )
}

