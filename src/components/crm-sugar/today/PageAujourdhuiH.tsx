// MEGGA CRM — Today V2 « concept H » · PAGE AUJOURD'HUI (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-h-live.jsx` (handoff Today V2, 3 août 2026). Page 0 du
// pager Today, elle remplace l'ancien cockpit (`PageAujourdhui`).
//
// Un seul bento :
//   - en-tête « Bonjour {prénom} » + bascule What's new (colonne droite) ;
//   - colonne « Ta journée » (420 px) : vue Jour façon Calendrier, fenêtre
//     horaire ADAPTATIVE (1er→dernier créneau arrondi à l'heure), blocs opaques
//     aux couleurs fonctionnelles, ligne « maintenant », fenêtre libre ;
//   - colonne droite : segment Dossiers | Annonces, puis « Pendant ton absence »
//     (teaser 4 lignes + overlay groupé par nature).
// Clic sur un bloc → popover ancré, position mesurée puis CLAMPÉE dans le bento.
//
// Les helpers non rendus du prototype (`HlDossier`, superseded par le popover)
// ne sont pas portés — même règle que le port du catalogue.
//
// ⚠️ Données de démonstration (`./dataH`). Le câblage Supabase est le « Lot 0 »
// du handoff : le payload remplace les constantes, les composants ne bougent pas.

import EtatVide from '@/components/crm-sugar/EtatVide'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { useState, useRef, useCallback, useEffect, useLayoutEffect, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
// `motion/react` = la voie du dépôt (18 fichiers, dont le voisin FocusMode).
import { AnimatePresence, motion } from 'motion/react'
import { TK } from './tk'
import { RXIcon, Av, Eyebrow } from './kit'
import { DATA } from './data'
import {
  HL_TYPES, HL_KIND_TYPE,
  type HlSignalData, type HlHotData, type HlAnnData, type HlNewsData,
} from './dataH'
import { useHotDeals } from './useHotDeals'
import { useListingActions } from './useListingActions'
import { useTodayH, type TodayHBlock, type TodayHDay } from './useTodayH'
import { useAbsenceSignals, type AbsenceGroup, type AbsenceSignal } from './useAbsenceSignals'
import { useTodayNav } from './TodayNavContext'
import { useAuth } from '@/hooks/useAuth'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── Glyphes de réaction (boucle de match) ──────────────────────────────
function HlHeart({ s = 9, col = '#fff' }: { s?: number; col?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={col} stroke={col} strokeWidth="1.5" strokeLinejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

function HlCross({ s = 8, col }: { s?: number; col?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={col || TK.sub} strokeWidth="3.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function HlSpark({ s = 14, col }: { s?: number; col?: string }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={col || TK.primary}>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  )
}

const hlColor = (kind: string): string => {
  const ty = HL_TYPES[HL_KIND_TYPE[kind]] || HL_TYPES.relance
  return TK.mode === 'light' ? ty.l : ty.d
}

function HlSignalBadge({ s, size = 32 }: { s: HlSignalData; size?: number }) {
  if (s.type === 'ia') {
    return (
      <span style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, display: 'grid', placeItems: 'center', background: TK.primarySoft }}>
        <HlSpark s={size * 0.46} />
      </span>
    )
  }
  const dot = s.type === 'like' ? TK.danger.dot : s.type === 'rappel' ? (s.late ? TK.danger.dot : TK.neutral.dot) : TK.frameHi
  return (
    <span style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <span style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', background: s.av, color: '#fff', display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 600 }}>{s.initials}</span>
      <span style={{ position: 'absolute', right: -3, bottom: -3, width: 16, height: 16, borderRadius: 'var(--crm-radius-pill)', background: s.type === 'skip' ? TK.frameHi : dot, boxShadow: `0 0 0 2px ${TK.frameSolid}`, display: 'grid', placeItems: 'center' }}>
        {s.type === 'like' ? <HlHeart s={8} /> : s.type === 'skip' ? <HlCross s={7} /> : <RXIcon name="clock" size={9} sw={3} color="#fff" />}
      </span>
    </span>
  )
}

// Fil sobre : une ligne par signal, filets internes (jamais de bordure de
// carte), CTA en texte. Aucune animation au survol — au plus un fond instantané.
function HlSignalCard({ s, onCta, first }: { s: AbsenceSignal; onCta?: (s: AbsenceSignal) => void; first?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)', minWidth: 0, borderTop: first ? 'none' : `1px solid ${TK.border}` }}>
      <HlSignalBadge s={s} size={30} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {s.type === 'ia'
          ? <span style={{ fontWeight: 600, color: TK.ink }}>{s.text}</span>
          : <><span style={{ fontWeight: 600, color: TK.ink }}>{s.who.split(' ')[0]}</span> <span style={{ fontWeight: 600, color: TK.inkDim }}>{s.text}</span></>}
      </div>
      <span style={{ flexShrink: 0, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: s.late ? TK.danger.dot : TK.sub, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{s.meta}</span>
      {s.cta && (
        <button
          onClick={() => onCta && onCta(s)} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
          style={{ flexShrink: 0, background: h ? TK.card : 'transparent', border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.ink, whiteSpace: 'nowrap', cursor: 'pointer', padding: 'var(--crm-space-xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-sm)', marginRight: -5 }}
        >
          {s.cta}
        </button>
      )}
    </div>
  )
}

// ─── Overlay « Voir les N » — focus léger + Framer Motion ────────────────
// Backdrop doux (dim + micro-flou) pour garder le focus sur le panneau, sans le
// scrim lourd d'un plein écran. Panneau flottant OPAQUE (règle Sugar sombre :
// TK.frameSolid), ancré bas-droite du bento, groupé par nature. La cascade des
// lignes est en CSS (.hl-abs-row + animation-delay), PAS en variants Framer
// (qui bloquaient l'animation d'entrée du panneau).
function HlAbsenceOverlay({ groups, total, sinceLabel, onSignal, onClose, onClearAll }: {
  groups: AbsenceGroup[]
  total: number
  sinceLabel: string | null
  onSignal: (s: AbsenceSignal) => void
  onClose: () => void
  onClearAll: () => void
}) {
  const { t } = useTranslation('dashboard')
  const reduce = prefersReducedMotion()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  let ri = 0
  const row = (child: ReactNode, key: string) => (
    <div key={key} className="hl-abs-row" style={{ animationDelay: `${0.04 + (ri++) * 0.04}s` }}>{child}</div>
  )

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        position: 'absolute', inset: 0, zIndex: 30,
        background: TK.mode === 'light' ? sgVoileEncre(false, 0.13) : 'rgba(4,5,8,0.44)',
        backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)',
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.975 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 400, damping: 34, mass: 0.9 }}
        style={{
          position: 'absolute', right: 22, bottom: 22, width: 480, maxHeight: 'calc(100% - 96px)', zIndex: 40, transformOrigin: 'bottom right',
          background: TK.frameSolid, borderRadius: 'var(--crm-radius-4xl)', boxShadow: TK.shadowLg, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-3xl) var(--crm-space-4xl) var(--crm-space-lg)' }}>
          <div>
            <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.4, color: TK.ink }}>{t('today.h.absence.title')}</div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub, marginTop: 3 }}>
              {/* Sans présence enregistrée (toute première session), on annonce
                  le compte sans prétendre à un « depuis » qu'on ignore. */}
              {total > 0
                ? (sinceLabel ? t('today.h.absence.countSince', { count: total, since: sinceLabel }) : t('today.h.absence.count', { count: total }))
                : (sinceLabel ? t('today.h.absence.upToDateSince', { since: sinceLabel }) : t('today.h.absence.emptyTitle'))}
            </div>
          </div>
          <button onClick={onClose} aria-label={t('today.h.close')} style={{ width: 30, height: 30, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: TK.cardHi, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <HlCross s={12} col={TK.inkDim} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: total > 0 ? '2px 18px 6px' : '0 18px', display: total > 0 ? 'block' : 'flex' }}>
          {total > 0 ? groups.map((g, gi) => (
            <div key={g.name}>
              {row(
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', marginTop: gi ? 13 : 0, marginBottom: 1 }}>
                  <Eyebrow>{g.name}</Eyebrow>
                  <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: TK.faint, fontVariantNumeric: 'tabular-nums' }}>{g.items.length}</span>
                </div>, `h-${g.name}`)}
              {g.items.map((s, i) => row(<HlSignalCard s={s} onCta={onSignal} first={i === 0} />, s.id))}
            </div>
          )) : (
            <EtatVide
              dark={TK.mode !== 'light'}
              registre="aJour"
              glyphe={<RXIcon name="check" size={26} sw={2.1} />}
              titre={t('today.h.absence.emptyTitle')}
              corps={t('today.h.absence.emptyDesc')}
            />
          )}
        </div>
        {total > 0 && (
          <div style={{ flexShrink: 0, padding: 'var(--crm-space-lg) var(--crm-space-4xl) var(--crm-space-2xl)', display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${TK.border}` }}>
            <button onClick={onClearAll} style={{ height: 30, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', background: TK.cardHi, color: TK.inkDim, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>
              {t('today.h.absence.markAll')}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}

// ─── Bloc de la journée (calqué sur CalEventBlock du Calendrier) ────────
// Aplat opaque de la couleur fonctionnelle + texte blanc, dimensionné par la
// durée. Sélection = anneau (jamais de remplissage noir). Aucun survol animé.
function HlBlock({ b, pct, span, sel, done, past, onSel }: {
  b: TodayHBlock
  pct: (m: number) => number
  /** Amplitude de la fenêtre horaire, en minutes — dimensionne la hauteur. */
  span: number
  sel: boolean
  done: boolean
  past: boolean
  onSel: (id: string, el: HTMLElement) => void
}) {
  const bg = hlColor(b.kind)
  const short = b.dur <= 30 // ≤ 30 min → une seule ligne
  const softSh = TK.mode === 'light'
    ? `0 2px 8px ${sgVoileEncre(false, 0.10)}, 0 1px 3px ${sgVoileEncre(false, 0.06)}`
    : '0 2px 10px rgba(0,0,0,0.45)'
  return (
    <button
      onClick={(e) => onSel(b.id, e.currentTarget)}
      style={{
        position: 'absolute', top: `${pct(b.from)}%`, height: `calc(${(b.dur / span) * 100}% - 3px)`,
        left: 8, right: 8, minHeight: 22, borderRadius: 'var(--crm-radius-md)', border: 0, background: bg, color: '#fff',
        padding: short ? '0 12px' : '5px 12px', textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
        boxShadow: sel ? `0 0 0 2px ${TK.ink}, ${softSh}` : softSh,
        opacity: sel ? 1 : done ? 0.5 : past ? 0.55 : 1, overflow: 'hidden', zIndex: sel ? 6 : 3,
        display: 'flex', flexDirection: short ? 'row' : 'column', alignItems: short ? 'center' : 'stretch', gap: short ? 8 : 0,
      }}
    >
      <span style={{
        fontSize: 'var(--crm-text-md)', fontWeight: 600, letterSpacing: -0.2, lineHeight: 1.25,
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: short ? 1 : 'none',
        textDecoration: done ? 'line-through' : 'none',
      }}>{b.contact}</span>
      {b.dur >= 60 && b.role && (
        <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, opacity: 0.8, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.role}</span>
      )}
      {/* Le prototype passe un `style` au ✓ — mais `RXIcon` ne le transmet pas à
          MEIcon, donc il ne s'applique pas là-bas non plus : le ✓ suit le flux.
          Ne pas « corriger » sans décision produit, ce serait un écart visuel. */}
      {done
        ? <RXIcon name="check" size={12} sw={2.6} color="#fff" />
        : (b.risk && (
          <span style={{
            flexShrink: 0, marginLeft: short ? 0 : 'auto', position: short ? 'static' : 'absolute', top: 8, right: 9,
            width: 15, height: 15, borderRadius: 'var(--crm-radius-pill)', background: '#fff', display: 'grid', placeItems: 'center',
            color: bg, fontSize: 'var(--crm-text-sm)', fontWeight: 600, lineHeight: 1,
          }}>!</span>
        ))}
    </button>
  )
}

// ─── Colonne du temps (calquée sur la vue Jour du Calendrier) ───────────
function HlDay({ day, selId, onSel }: {
  day: TodayHDay
  selId: string | null
  onSel: (id: string, el: HTMLElement) => void
}) {
  const { t } = useTranslation('dashboard')
  const { blocks, startMin, endMin, nowMin, nowLabel, free } = day
  const span = endMin - startMin
  const pct = (m: number) => ((m - startMin) / span) * 100
  const nowM = nowMin
  const nowCol = TK.mode === 'light' ? '#E54D38' : '#FFFFFF'
  const hours: number[] = []
  for (let h = startMin / 60; h <= endMin / 60; h++) hours.push(h)
  // « Maintenant » n'a de sens que DANS la fenêtre du jour. À 19 h 30 sur une
  // journée qui finit à 17 h, `pct` vaut 131 % : le repère se faisait CLIPPER
  // en silence. On le retire explicitement — une journée terminée n'a pas de
  // « maintenant » à montrer, et un clip n'est pas une décision.
  const nowInWindow = nowM >= startMin && nowM <= endMin
  const freeMin = free ? free.to - free.from : 0
  const freeLabel = freeMin % 60 === 0 ? `${freeMin / 60} h` : `${Math.floor(freeMin / 60)} h ${freeMin % 60}`
  return (
    <div style={{ display: 'flex', gap: 0, flex: 1, minHeight: 0 }}>
      {/* gouttière des heures */}
      <div style={{ position: 'relative', width: 52, flexShrink: 0 }}>
        {hours.map((h) => (
          <span key={h} style={{
            position: 'absolute', top: `${pct(h * 60)}%`, right: 12, transform: 'translateY(-6px)',
            fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: TK.faint, fontVariantNumeric: 'tabular-nums', letterSpacing: 0.2,
          }}>{t('today.h.hour', { hour: String(h).padStart(2, '0') })}</span>
        ))}
        {/* badge « maintenant » dans la gouttière */}
        {nowInWindow && <span style={{
          position: 'absolute', top: `${pct(nowM)}%`, right: 10, transform: 'translateY(-8px)', zIndex: 8,
          fontSize: 'var(--crm-text-xs)', fontWeight: 600, fontVariantNumeric: 'tabular-nums', background: nowCol,
          color: TK.mode === 'light' ? MXC_COLOR.n1000 : MXC_COLOR.n100, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)',
        }}>{nowLabel}</span>}
      </div>
      {/* colonne timeline */}
      <div style={{ position: 'relative', flex: 1, borderLeft: `1px solid ${TK.border}` }}>
        {hours.map((h) => (
          <span key={h} style={{ position: 'absolute', top: `${pct(h * 60)}%`, left: 0, right: 0, height: 1, background: TK.border, opacity: 0.45 }} />
        ))}
        {/* fenêtre libre (spécifique Today, sobre) — absente si la journée n'a
            aucun trou d'au moins 45 min. */}
        {free && (
          <div style={{
            position: 'absolute', top: `${pct(free.from)}%`, height: `calc(${pct(free.to) - pct(free.from)}% - 3px)`, left: 8, right: 8, borderRadius: 'var(--crm-radius-md)',
            background: TK.card, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)',
          }}>
            <RXIcon name="bolt" size={13} sw={2.1} color={TK.sub} />
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t('today.h.freeWindow', { duration: freeLabel })}
            </span>
          </div>
        )}
        {blocks.map((b) => (
          <HlBlock key={b.id} b={b} pct={pct} span={span} sel={b.id === selId} done={!!b.done} past={(b.from + b.dur) <= nowM} onSel={onSel} />
        ))}
        {/* ligne « maintenant » */}
        {nowInWindow && <div className="hl-now" style={{ position: 'absolute', top: `${pct(nowM)}%`, left: 0, right: 0, display: 'flex', alignItems: 'center', zIndex: 7, pointerEvents: 'none' }}>
          <span className="hl-now-dot" style={{ width: 9, height: 9, borderRadius: 'var(--crm-radius-pill)', background: nowCol, marginLeft: -5 }} />
          <span style={{ flex: 1, height: 2, background: nowCol }} />
        </div>}
      </div>
    </div>
  )
}

// ─── État vide d'un segment ─────────────────────────────────────────────
// Un segment sans contenu doit le DIRE. Sans ça, « 0 chaud » surplombe un vide
// qu'on ne sait pas lire : rien à traiter, ou rien qui charge ?
function HlZoneEmpty({ label }: { label: string }) {
  // Registre « à jour » : la coche verte disait déjà « tu es à jour », mais par
  // une PASTILLE. La direction le fait dire par l'encre du titre — voir le
  // JSDoc d'`EtatVide`, qui explique pourquoi ce registre n'est pas dans la
  // vitrine et pourquoi on le garde quand même.
  return (
    <EtatVide
      dark={TK.mode !== 'light'}
      forme="ligne"
      registre="aJour"
      glyphe={<RXIcon name="check" size={16} sw={2.2} />}
      titre={label}
    />
  )
}

// ─── Dossiers chauds ────────────────────────────────────────────────────
function HlDealCard({ d, first, onCta }: { d: HlHotData; first?: boolean; onCta?: (d: HlHotData) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)', minWidth: 0, borderTop: first ? 'none' : `1px solid ${TK.border}` }}>
      <div style={{ position: 'relative', width: 76, height: 56, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', flexShrink: 0, background: d.photo ? '#1c1e24' : `linear-gradient(135deg, ${d.g1 || '#262C3A'}, ${d.g2 || '#181B22'})` }}>
        {d.photo && <img src={d.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <Av initials={d.init} av={d.av} size={22} />
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: TK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</span>
        </div>
      </div>
      <button
        onClick={() => onCta && onCta(d)}
        style={{ flexShrink: 0, height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, fontFamily: 'inherit', background: TK.accent, color: TK.accentInk, fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >{d.cta}</button>
    </div>
  )
}

// ─── Mes annonces — actions de diffusion ────────────────────────────────
function HlAnnCard({ a, first, onCta }: { a: HlAnnData; first?: boolean; onCta?: (a: HlAnnData) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)', minWidth: 0, borderTop: first ? 'none' : `1px solid ${TK.border}` }}>
      <div style={{ position: 'relative', width: 76, height: 56, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', flexShrink: 0, background: a.photo ? '#1c1e24' : `linear-gradient(135deg, ${a.g1 || '#262C3A'}, ${a.g2 || '#181B22'})` }}>
        {a.photo && <img src={a.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: TK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {a.title} <span style={{ fontWeight: 600, color: TK.sub }}>{a.price}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', marginTop: 4, minWidth: 0 }}>
          <span style={{ width: 6, height: 6, borderRadius: 'var(--crm-radius-pill)', background: a.dot, flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: TK.sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.issue}</span>
        </div>
      </div>
      <button
        onClick={() => onCta && onCta(a)}
        style={{ flexShrink: 0, height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, fontFamily: 'inherit', background: TK.accent, color: TK.accentInk, fontSize: 'var(--crm-text-sm)', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}
      >{a.cta}</button>
    </div>
  )
}

// ─── What's new — nouveautés du système MEGGA ──────────────────────
function HlNewsCard({ n, first }: { n: HlNewsData; first?: boolean }) {
  const { t } = useTranslation('dashboard')
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '82px 1fr', gap: 'var(--crm-space-3xl)', padding: 'var(--crm-space-2xl) var(--crm-space-2xs)', borderTop: first ? 'none' : `1px solid ${TK.border}` }}>
      <div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: TK.ink, lineHeight: 1.3 }}>{n.date}</div>
        <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: TK.faint, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{n.year}</div>
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 5 }}>
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: TK.ink }}>{n.title}</span>
          {n.fresh && (
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: TK.accentInk, background: TK.accent, borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-2xs) var(--crm-space-sm)', flexShrink: 0 }}>
              {t('today.h.news.fresh')}
            </span>
          )}
        </div>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: TK.inkDim, lineHeight: 1.5, textWrap: 'pretty' }}>{n.desc}</div>
      </div>
    </div>
  )
}

function HlWhatsNew({ news, onClose }: { news: HlNewsData[]; onClose: () => void }) {
  const { t } = useTranslation('dashboard')
  return (
    <div className="hl-dossier" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexShrink: 0 }}>
        <Eyebrow>{t('today.h.whatsNew')}</Eyebrow>
        <button
          onClick={onClose}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 28, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${TK.cardBorder}`, background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.inkDim, cursor: 'pointer' }}
        >{t('today.h.close')}</button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 'var(--crm-space-xs)' }}>
        {news.map((n, i) => <HlNewsCard key={n.id} n={n} first={i === 0} />)}
      </div>
    </div>
  )
}

// ─── Aperçu d'un rendez-vous (popover ancré au bloc) ────────────────────
// Position mesurée puis CLAMPÉE dans le bento (à droite du bloc, sinon à
// gauche) — conserver la logique `useLayoutEffect`.
interface PopAnchor { top: number; left: number; width: number; height: number }

function HlBlockPopover({ b, anchor, cw, ch, done, onClose, onCal, onCta }: {
  b: TodayHBlock
  anchor: PopAnchor | null
  cw: number
  ch: number
  done: boolean
  onClose: () => void
  onCal: () => void
  onCta: () => void
}) {
  const { t } = useTranslation('dashboard')
  const reduce = prefersReducedMotion()
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; top: number; side: string } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    const w = el.offsetWidth, h = el.offsetHeight, GAP = 14, EDGE = 16
    if (!anchor) { setPos({ left: Math.max(EDGE, (cw - w) / 2), top: Math.max(EDGE, (ch - h) / 2), side: 'left' }); return }
    let left = anchor.left + anchor.width + GAP, side = 'left' // à droite du bloc (origine à gauche)
    if (left + w > cw - EDGE) { left = anchor.left - w - GAP; side = 'right' }
    if (left < EDGE) left = EDGE
    let top = anchor.top + anchor.height / 2 - h / 2
    if (top + h > ch - EDGE) top = ch - h - EDGE
    if (top < EDGE) top = EDGE
    setPos({ left, top, side })
  }, [anchor, cw, ch])

  const end = b.from + b.dur
  const endStr = `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
  const typeLabel = t(`today.h.types.${HL_KIND_TYPE[b.kind] || 'default'}`)

  return (
    <motion.div
      onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
      style={{
        position: 'absolute', inset: 0, zIndex: 50,
        background: TK.mode === 'light' ? sgVoileEncre(false, 0.10) : 'rgba(4,5,8,0.40)',
        backdropFilter: 'blur(1.5px)', WebkitBackdropFilter: 'blur(1.5px)',
      }}
    >
      <motion.div
        ref={panelRef} onClick={(e) => e.stopPropagation()}
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.975 }}
        animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.9 }}
        style={{
          position: 'absolute', zIndex: 51, width: 336, padding: 'var(--crm-space-4xl)',
          left: pos ? pos.left : 0, top: pos ? pos.top : 0, visibility: pos ? 'visible' : 'hidden',
          transformOrigin: `${pos ? pos.side : 'left'} center`,
          background: TK.frameSolid, borderRadius: 'var(--crm-radius-3xl)', boxShadow: TK.shadowLg,
          maxHeight: 'calc(100% - 24px)', overflowY: 'auto',
        }}
      >
        {/* Barre de titre — pastille de couleur fonctionnelle + type */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 12 }}>
          <span style={{ width: 11, height: 11, borderRadius: 'var(--crm-radius-xs)', background: hlColor(b.kind), flexShrink: 0 }} />
          <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: TK.sub }}>{typeLabel}</span>
          {done && (
            <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', background: '#059669', color: '#FFFFFF' }}>
              {t('today.h.doneBadge')}
            </span>
          )}
          <button
            onClick={onClose} title={t('today.h.close')}
            style={{ marginLeft: 'auto', width: 32, height: 32, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = TK.cardHi }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            <HlCross s={13} col={TK.inkDim} />
          </button>
        </div>
        {/* Titre — le contact */}
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: TK.ink, letterSpacing: -0.5, lineHeight: 1.2, marginBottom: 12, textDecoration: done ? 'line-through' : 'none' }}>{b.contact}</div>
        {/* Infos — lignes façon Calendrier */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: TK.inkDim, lineHeight: 1.4 }}>
            <span style={{ flexShrink: 0, marginTop: 1 }}><RXIcon name="clock" size={15} sw={1.9} color={TK.sub} /></span>
            <span>{t('today.h.todayLabel')}<span style={{ color: TK.sub }}> · {b.time} – {endStr}</span></span>
          </div>
          {b.role && (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)', fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: TK.inkDim, lineHeight: 1.4 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><RXIcon name="user" size={15} sw={1.9} color={TK.sub} /></span>
              <span>{b.role}</span>
            </div>
          )}
          {/* Bien concerné — sous-carte cardSubtle */}
          {b.photo && (
            <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'center', background: TK.card, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg)', marginTop: 2 }}>
              <div style={{ width: 42, height: 42, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', flexShrink: 0, position: 'relative', background: '#1c1e24' }}>
                <img src={b.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: TK.ink, letterSpacing: -0.2 }}>{b.price}</div>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{b.place}</div>
              </div>
            </div>
          )}
          {/* Note MEGGA AI — encart cardSubtle. Absent quand l'événement n'en
              porte pas : aucune table d'insight par événement n'existe, et en
              fabriquer une supposerait un LLM par bloc affiché. */}
          {b.line && (
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', alignItems: 'flex-start', background: TK.card, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-lg)', marginTop: 2 }}>
              <span style={{ flexShrink: 0, marginTop: 1 }}><HlSpark s={13} /></span>
              <span style={{ fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: TK.inkDim, fontWeight: 500 }}>{b.line}</span>
            </div>
          )}
        </div>
        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 14 }}>
          <button onClick={onCta} style={{ width: '100%', height: 42, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TK.accent, color: TK.accentInk }}>
            {b.cta}
          </button>
          <button onClick={onCal} style={{ width: '100%', height: 42, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', background: TK.card, color: TK.ink }}>
            {t('today.h.openInCalendar')}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── PAGE AUJOURD'HUI (concept H) ───────────────────────────────────────
export function PageAujourdhuiH() {
  const { t } = useTranslation('dashboard')
  const { navigate: nav } = useTodayNav()
  const { profile } = useAuth()
  // Le prénom vient du profil réel : la donnée existe côté app, aucune raison
  // de la simuler. Le reste de l'écran reste en démo jusqu'au Lot 0.
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || DATA.agent.name

  const [whatsNew, setWhatsNew] = useState(false)
  const [absOpen, setAbsOpen] = useState(false)
  const [zone, setZone] = useState<'dossiers' | 'annonces'>('dossiers')
  // Lot 1 — « Pendant ton absence » : réactions acheteur et rappels échus réels,
  // bornés par la présence de l'agent.
  const {
    signals: absenceSignals, groups: absenceGroups, total: absenceTotal,
    sinceLabel, markAllSeen, resumeReminder,
  } = useAbsenceSignals()
  // Lot 3 — Dossiers (file Focus, déterministe) et Annonces (complétude +
  // état de diffusion). Les deux dernières zones de démonstration tombent.
  const { deals: hotDeals } = useHotDeals()
  const { actions: listingActions } = useListingActions()
  // Lot 0 — journée, nouveautés et total Pipeline viennent de Supabase.
  // « fait » reste un ÉTAT DE DONNÉE (barré + badge « Terminé ») : le geste
  // `event_mark_done` est du Lot 2, et le popover de la maquette ne l'expose pas.
  const { day, news, pipelineTotal, isLoading } = useTodayH()
  const [toast, setToast] = useState<string | null>(null)
  const toastRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const say = useCallback((msg: string) => {
    setToast(msg)
    if (toastRef.current) clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(null), 2200)
  }, [])
  useEffect(() => () => { if (toastRef.current) clearTimeout(toastRef.current) }, [])

  const rootRef = useRef<HTMLDivElement>(null)
  const [pop, setPop] = useState<{ b: TodayHBlock; cw: number; ch: number; anchor: PopAnchor | null } | null>(null)
  const openPop = (id: string, el: HTMLElement) => {
    const b = day.blocks.find((x) => x.id === id)
    if (!b) return
    const cont = rootRef.current
    const cr = cont && cont.getBoundingClientRect()
    const er = el && el.getBoundingClientRect()
    setPop({
      b, cw: cr ? cr.width : 0, ch: cr ? cr.height : 0,
      anchor: (cr && er) ? { top: er.top - cr.top, left: er.left - cr.left, width: er.width, height: er.height } : null,
    })
  }

  // La cible et sa référence viennent du bloc lui-même (le hook les dérive de
  // l'événement réel) : plus de mapping par `kind`, donc plus de CTA sans cible.
  const onCta = (blk: TodayHBlock) => nav(blk.route, blk.navRef)
  // « Tout marquer comme vu » avance la PRÉSENCE : le fil se vide parce que sa
  // borne bouge, pas parce qu'on a coché des lignes une à une.
  const clearAll = async () => {
    setAbsOpen(false)
    await markAllSeen()
    say(t('today.h.toast.allUpToDate'))
  }
  // Lot 2 — « Reprendre » AGIT : il marque le rappel traité, puis ouvre la fiche.
  // Si l'écriture échoue, on ne navigue PAS et on le dit : partir en laissant
  // croire que c'est fait serait pire que l'échec lui-même.
  //
  // « Proposer la visite » et « Recalibrer » EMMÈNENT seulement, à dessein : le
  // premier suppose la chaîne de transmission WhatsApp/SMS, le second un
  // recalcul du moteur de matching — et surtout, la base ne contient AUCUNE
  // réaction acheteur, donc aucun des deux ne pourrait être éprouvé aujourd'hui.
  const onSignal = async (s: AbsenceSignal) => {
    if (s.type === 'rappel') {
      const ok = await resumeReminder(s)
      if (!ok) { say(t('today.h.toast.resumeFailed')); return }
    }
    nav(s.route, s.navRef)
  }
  // Dossiers et Annonces EMMÈNENT vers la fiche concernée. « Publier » n'écrit
  // rien : le go-live est bloqué chez le tiers (FTP, `idx_enabled` à false), donc
  // un bouton qui écrirait `queued` mentirait. Il ouvre la fiche du bien, là où
  // la diffusion se pilote.
  const onDeal = (d: HlHotData) => nav('contact-detail', (d as { contactId?: string }).contactId)
  const onAnn = (a: HlAnnData) => nav('biens-detail', (a as { propertyId?: string }).propertyId)

  // Teaser : les 4 signaux les plus récents, tous groupes confondus.
  const teaser = absenceSignals.slice(0, 4)

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '100%', height: '100%', background: TK.frame, fontFamily: 'Manrope, system-ui, sans-serif', color: TK.ink, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <style>{`
        @keyframes hlFade { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:none } }
        .hl-dossier { animation: hlFade .32s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce){ .hl-dossier{ animation:none !important } }
        @keyframes hlRow { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        .hl-abs-row { animation: hlRow .32s cubic-bezier(.2,.8,.2,1) both; }
        @media (prefers-reduced-motion: reduce){ .hl-abs-row{ animation:none !important } }
      `}</style>

      {/* EN-TÊTE — intégré dans le bento */}
      <div style={{ flexShrink: 0, padding: '18px 26px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-3xl)' }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: -0.8, color: TK.ink }}>{t('today.h.greeting', { name: firstName })}</h1>
        {/* Pas de nouveauté publiée ⇒ pas de bouton : il ouvrirait un panneau vide. */}
        {news.length > 0 && (
        <button
          onClick={() => setWhatsNew((v) => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 36, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, fontFamily: 'inherit', cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
            background: whatsNew ? TK.accent : TK.card, color: whatsNew ? TK.accentInk : TK.ink, fontSize: 'var(--crm-text-md)', fontWeight: 600,
            boxShadow: whatsNew ? 'none' : `inset 0 0 0 1px ${TK.cardBorder}`,
          }}
        >{t('today.h.whatsNew')}</button>
        )}
      </div>
      <div style={{ height: 1, background: TK.border, flexShrink: 0 }} />

      {/* CORPS : journée (temps) | dossier du moment + pendant ton absence */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden' }}>
        {/* LA JOURNÉE */}
        <div style={{ width: 420, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 'var(--crm-space-4xl) var(--crm-space-3xl) var(--crm-space-3xl)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, padding: '0 var(--crm-space-xs)', flexShrink: 0 }}>
            <Eyebrow>{t('today.h.yourDay')}</Eyebrow>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub, fontVariantNumeric: 'tabular-nums' }}>{t('today.h.appointments', { count: day.blocks.length })}</span>
          </div>
          {!isLoading && !day.blocks.length ? (
                <EtatVide
                  dark={TK.mode !== 'light'}
                  glyphe={<RXIcon name="cal" size={26} sw={1.9} />}
                  titre={t('today.h.day.emptyTitle')}
                  corps={t('today.h.day.emptyDesc')}
                />
              ) : (
            <HlDay day={day} selId={pop && pop.b ? pop.b.id : null} onSel={(id, el) => { setWhatsNew(false); openPop(id, el) }} />
          )}
        </div>
        {/* filet séparateur */}
        <div style={{ width: 1, background: TK.border, flexShrink: 0, margin: '18px 0' }} />
        {/* COLONNE DROITE */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, padding: 'var(--crm-space-5xl)' }}>
          {whatsNew ? (
            <HlWhatsNew news={news} onClose={() => setWhatsNew(false)} />
          ) : (
            <>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0, gap: 'var(--crm-space-xl)' }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
                  <div style={{ display: 'inline-flex', gap: 'var(--crm-space-2xs)', padding: 'var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)', background: TK.card }}>
                    {([['dossiers', t('today.h.tabs.deals')], ['annonces', t('today.h.tabs.listings')]] as const).map(([k, l]) => (
                      <button
                        key={k} onClick={() => setZone(k as 'dossiers' | 'annonces')}
                        style={{ height: 26, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', background: zone === k ? TK.accent : 'transparent', color: zone === k ? TK.accentInk : TK.sub }}
                      >{l}</button>
                    ))}
                  </div>
                  </div>
                  {zone === 'dossiers'
                    ? <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub }}>{t('today.h.hotCount', { count: hotDeals.length })}</span>
                    : <button onClick={() => nav('biens')} style={{ background: 'none', border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: TK.sub, cursor: 'pointer', padding: 'var(--crm-space-xs) var(--crm-space-sm)', marginRight: -4 }}>{t('today.h.openListings')}</button>}
                </div>
                <div key={zone} className="hl-dossier" style={{ minHeight: 0 }}>
                  {zone === 'dossiers' ? (
                    <>
                      {!hotDeals.length && <HlZoneEmpty label={t('today.h.deals.empty')} />}
                      {hotDeals.map((d, i) => <HlDealCard key={d.id} d={d} first={i === 0} onCta={onDeal} />)}
                      {/* Pipeline vide ⇒ pas de renvoi : « Voir les 0 dossiers »
                          serait une invitation à ouvrir un écran vide. */}
                      {pipelineTotal > 0 && (
                        <button
                          onClick={() => nav('pipeline')}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 'var(--crm-space-lg)', marginTop: 2, padding: 'var(--crm-space-xl) var(--crm-space-2xs) var(--crm-space-2xs)', borderTop: `1px solid ${TK.border}`, background: 'none', border: 0, fontFamily: 'inherit', cursor: 'pointer', textAlign: 'left' }}
                        >
                          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: TK.inkDim }}>{t('today.h.seeDealsInPipeline', { count: pipelineTotal })}</span>
                          <RXIcon name="arrow" size={15} sw={2.2} color={TK.sub} />
                        </button>
                      )}
                    </>
                  ) : (
                    listingActions.length
                      ? listingActions.map((a, i) => <HlAnnCard key={a.id} a={a} first={i === 0} onCta={onAnn} />)
                      : <HlZoneEmpty label={t('today.h.listings.empty')} />
                  )}
                </div>
              </div>
              {/* PENDANT TON ABSENCE */}
              <div style={{ flexShrink: 0, borderTop: `1px solid ${TK.border}`, marginTop: 16, paddingTop: 'var(--crm-space-3xl)' }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                  <Eyebrow>{t('today.h.absence.title')}</Eyebrow>
                  {absenceTotal > 0 && (
                    <button
                      onClick={() => setAbsOpen((v) => !v)}
                      style={{ background: absOpen ? TK.cardHi : 'none', border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: absOpen ? TK.ink : TK.sub, cursor: 'pointer', padding: 'var(--crm-space-xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-sm)', marginRight: -5 }}
                    >{t('today.h.absence.seeAll', { count: absenceTotal })}</button>
                  )}
                </div>
                {absenceTotal > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {teaser.map((s, i) => <HlSignalCard key={s.id} s={s} onCta={onSignal} first={i === 0} />)}
                  </div>
                ) : (
                  <EtatVide
                    dark={TK.mode !== 'light'}
                    forme="ligne"
                    registre="aJour"
                    glyphe={<RXIcon name="check" size={16} sw={2.2} />}
                    titre={sinceLabel ? t('today.h.absence.upToDateInline', { since: sinceLabel }) : t('today.h.absence.emptyDesc')}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overlay « Pendant ton absence » — focus léger, animé */}
      <AnimatePresence>
        {absOpen && <HlAbsenceOverlay key="abs" groups={absenceGroups} total={absenceTotal} sinceLabel={sinceLabel} onSignal={onSignal} onClose={() => setAbsOpen(false)} onClearAll={() => { void clearAll() }} />}
      </AnimatePresence>

      {/* Aperçu d'un rendez-vous de la journée — popover ancré au bloc */}
      <AnimatePresence>
        {pop && (
          <HlBlockPopover
            key="pop" b={pop.b} anchor={pop.anchor} cw={pop.cw} ch={pop.ch} done={!!pop.b.done}
            onClose={() => setPop(null)}
            onCal={() => { setPop(null); nav('calendar') }}
            onCta={() => { const blk = pop.b; setPop(null); onCta(blk) }}
          />
        )}
      </AnimatePresence>

      {/* TOAST */}
      {toast && (
        <div style={{ position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', zIndex: 80, display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', background: TK.accent, color: TK.accentInk, fontSize: 'var(--crm-text-md)', fontWeight: 600, boxShadow: TK.shadowLg, animation: 'hlFade .2s ease both' }}>
          <RXIcon name="check" size={14} sw={2.4} color={TK.accentInk} />{toast}
        </div>
      )}
    </div>
  )
}
