// MEGGA CRM — Refonte « Aujourd'hui » · MODE FOCUS (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-focus-mode.jsx`. S'inscrit dans le cadre du gros bento.
// Traite UNE priorité à la fois, en grand, sans distraction. Réutilise
// FOCUS_QUEUE / FOCUS_TYPE / focusTy (FocusColumn). File « À suivre » en capsules
// contour. Bi-thème : suit l'ambiance du cockpit (TK.mode). La carte immersive
// (photo) reste identique dans les deux thèmes ; seule la chrome bascule.
//
// Self-draw des boutons glassy : `AnimatedTopIcon` (rail liquid-glass), repli
// `RXIcon` jamais nécessaire car les glyphes existent (calendar / check).

import { useState, useEffect, useCallback, type CSSProperties } from 'react'
import { motion } from 'motion/react'
import { TK } from './tk'
import { RXIcon } from './kit'
import { focusTy, type FocusItem, type FocusTypeDef } from './focusQueue'
import { useTodayNav } from './TodayNavContext'
import { AnimatedTopIcon } from '@/components/crm-sugar/LiquidGlassRail'

interface FmPalette {
  bg: string
  line: string; lineHi: string
  n100: string; n200: string; n400: string; n500: string
  ok: string; okFg: string; okDot: string
  chip: string; chipInner: string
  prog: string; progTrack: string
  pct: string; pctDim: string
  capBase: string; capHover: string
  capShadowBase: string; capShadowHi: string
  capArrowBg: string; capArrowFg: string
  solidBg: string; solidFg: string
  grain: number
}

const FM_DARK: FmPalette = {
  bg: '#090A0C',
  line: 'rgba(255,255,255,.11)', lineHi: 'rgba(255,255,255,.26)',
  n100: '#FFFFFF', n200: '#F1F1F3', n400: '#9A9CA6', n500: '#5B5D66',
  ok: '#15643F', okFg: '#DBF4E6', okDot: '#34C796',
  chip: 'rgba(255,255,255,.02)', chipInner: 'rgba(255,255,255,.06)',
  prog: '#FFFFFF', progTrack: 'rgba(255,255,255,.2)',
  pct: 'rgba(255,255,255,.7)', pctDim: 'rgba(255,255,255,.4)',
  capBase: 'linear-gradient(180deg, rgba(255,255,255,.022), rgba(255,255,255,.005))',
  capHover: 'linear-gradient(180deg, rgba(255,255,255,.022), rgba(255,255,255,.005))',
  capShadowBase: 'inset 0 1px 0 rgba(255,255,255,.035)',
  capShadowHi: 'inset 0 1px 0 rgba(255,255,255,.05)',
  capArrowBg: '#fff', capArrowFg: '#15171D',
  solidBg: '#F2F2F6', solidFg: '#0A0A0F',
  grain: 0.05,
}
const FM_LIGHT: FmPalette = {
  bg: '#EBEDF1',
  line: 'rgba(15,23,42,.10)', lineHi: 'rgba(15,23,42,.16)',
  n100: '#0B0C0E', n200: '#1A1C22', n400: '#6B7079', n500: '#9CA1AB',
  ok: '#15923F', okFg: '#FFFFFF', okDot: '#15923F',
  chip: '#FFFFFF', chipInner: 'rgba(15,23,42,.05)',
  prog: '#0B0C0E', progTrack: 'rgba(15,23,42,.14)',
  pct: 'rgba(11,12,14,.72)', pctDim: 'rgba(11,12,14,.4)',
  capBase: '#FFFFFF', capHover: '#FFFFFF',
  capShadowBase: '0 4px 14px -8px rgba(15,23,42,.14)',
  capShadowHi: '0 4px 14px -8px rgba(15,23,42,.14)',
  capArrowBg: '#0B0C0E', capArrowFg: '#FFFFFF',
  solidBg: '#0B0C0E', solidFg: '#FFFFFF',
  grain: 0,
}
const fmPalette = (): FmPalette => (TK.mode === 'light' ? FM_LIGHT : FM_DARK)

const FM_GRAIN = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

// Lignes « sur photo » — fixes dans les deux thèmes.
const FM_ONPHOTO = 'rgba(255,255,255,.26)'
const FM_GLASS = 'rgba(8,8,12,.5)'

// ─── Capsule contour « À suivre » ───────────────────────────────────────
function FmCapsule({ item, onClick, delay, fm }: { item: FocusItem; onClick: () => void; delay: number; fm: FmPalette }) {
  const ty = focusTy(item.type)
  const [h, setH] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14, height: 68, padding: '0 12px',
        borderRadius: 200, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
        background: h ? fm.capHover : fm.capBase,
        border: `1px solid ${h ? fm.lineHi : fm.line}`,
        boxShadow: h ? fm.capShadowHi : fm.capShadowBase,
        transform: h ? 'translateY(-1px)' : 'none',
        opacity: 0, animation: 'fmRise .6s cubic-bezier(.22,1,.36,1) both', animationDelay: `${delay}ms`,
        transition: 'transform .35s, background .35s, border-color .35s, box-shadow .35s',
      }}>
      <span style={{ position: 'relative', width: 42, height: 42, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
        border: `1px solid ${ty.badge}`,
        background: `radial-gradient(circle at 30% 26%, color-mix(in oklab, ${ty.badge} 52%, #fff) 0%, ${ty.badge} 72%)` }}>
        <RXIcon name={ty.icon} size={18} sw={1.9} color="#fff" />
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: fm.n200, letterSpacing: -0.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.contact}</span>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: fm.n400, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.category}{item.time ? ` · ${item.time}` : ''}</span>
      </span>
      <span style={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center',
        background: fm.capArrowBg, opacity: h ? 1 : 0, transform: h ? 'translateX(0)' : 'translateX(-6px)',
        transition: 'opacity .3s, transform .3s' }}>
        <RXIcon name="arrow" size={13} sw={2.1} color={fm.capArrowFg} />
      </span>
    </button>
  )
}

// ─── Cellule statistique du récap de fin de session ──────────────────────
function FmStat({ fm, value, label }: { fm: FmPalette; value: number; label: string }) {
  return (
    <div style={{ padding: '16px 28px', textAlign: 'center', minWidth: 128 }}>
      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: -1, color: fm.n100, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: fm.n400, marginTop: 9, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

// ─── Bouton d'action glassy avec icône self-draw (grammaire sidebar) ─────
// Rejoue l'animation AnimatedTopIcon (pop + self-draw) au survol, comme les
// boutons du rail.
function FmGlassBtn({ meName, onClick, title }: { meName: string; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title}
      style={{ width: 52, height: 52, borderRadius: 999, border: `1px solid ${FM_ONPHOTO}`, cursor: 'pointer', flexShrink: 0,
        background: FM_GLASS, backdropFilter: 'blur(12px)', display: 'grid', placeItems: 'center', color: '#fff' }}>
      <AnimatedTopIcon name={meName} color="#fff" size={20} tempo={1.7} />
    </button>
  )
}

// ─── Mode Focus ─────────────────────────────────────────────────────────
export function FocusMode({ onClose, baseQueue, onDone, onSnooze }: {
  onClose: () => void
  baseQueue: FocusItem[]
  onDone?: (item: FocusItem) => void
  onSnooze?: (item: FocusItem) => void
}) {
  const FM = fmPalette()
  const { goToPage } = useTodayNav()
  const [queue, setQueue] = useState<FocusItem[]>(baseQueue)
  const [idx, setIdx] = useState(0)
  const [calling, setCalling] = useState(false)
  const [secs, setSecs] = useState(0)
  const [show, setShow] = useState(false) // entrée/sortie de l'overlay
  const [vis, setVis] = useState(true) // crossfade entre priorités
  const [startTs, setStartTs] = useState(() => Date.now()) // début de session focus
  const [snoozeCount, setSnoozeCount] = useState(0) // replanifications de la session
  const [elapsedMs, setElapsedMs] = useState<number | null>(null) // figé à la clôture de la file

  const total = queue.length
  const allDone = idx >= total
  const f = allDone ? null : queue[idx]
  const ty = f ? focusTy(f.type) : null
  const upcoming = allDone ? [] : queue.slice(idx + 1)

  useEffect(() => { const r = requestAnimationFrame(() => setShow(true)); return () => cancelAnimationFrame(r) }, [])
  useEffect(() => {
    if (!calling) return
    const t = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(t)
  }, [calling])
  const close = useCallback(() => { setShow(false); setTimeout(() => onClose && onClose(), 300) }, [onClose])
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); close() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [close])

  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
  const focusMin = Math.max(1, Math.round((elapsedMs || 0) / 60000)) // minutes de concentration de la session

  const swap = (mutate: () => void) => {
    setCalling(false); setVis(false)
    setTimeout(() => { mutate(); requestAnimationFrame(() => requestAnimationFrame(() => setVis(true))) }, 300)
  }
  const done = () => { const cur = queue[idx]; if (cur) onDone?.(cur); const willFinish = idx + 1 >= total; swap(() => { setIdx((i) => i + 1); if (willFinish) setElapsedMs(Date.now() - startTs) }) }
  const snooze = () => { const cur = queue[idx]; if (cur) onSnooze?.(cur); setSnoozeCount((c) => c + 1); swap(() => setQueue((q) => { const n = [...q]; const [it] = n.splice(idx, 1); n.push(it); return n })) }
  const jump = (absIdx: number) => swap(() => setIdx(absIdx))
  const reset = () => swap(() => { setQueue(baseQueue); setIdx(0); setStartTs(Date.now()); setSnoozeCount(0); setElapsedMs(null) })
  // Pont focus → catalogue : lance le glissement du pager vers le mur de matchs
  // (page 1), puis fait fondre l'overlay.
  const goCatalogue = () => { goToPage(1); close() }
  const onPrimary = () => { if (ty && ty.live) { if (calling) done(); else { setSecs(0); setCalling(true) } } else done() }

  const overlay: CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 60, fontFamily: 'Manrope, system-ui, sans-serif',
    background: FM.bg, color: FM.n100,
    opacity: show ? 1 : 0, transform: show ? 'scale(1)' : 'scale(.986)',
    transition: 'opacity .34s cubic-bezier(.22,1,.36,1), transform .34s cubic-bezier(.22,1,.36,1)',
    display: 'flex', flexDirection: 'column', overflowY: 'auto',
  }
  const contentFade: CSSProperties = {
    opacity: vis ? 1 : 0, transform: vis ? 'translateY(0)' : 'translateY(10px)',
    transition: 'opacity .3s ease, transform .34s cubic-bezier(.22,1,.36,1)',
  }

  const item = f as FocusItem
  const tyy = ty as FocusTypeDef

  return (
    <div style={overlay} role="dialog" aria-modal="true" aria-label="Mode Focus">
      {FM.grain > 0 && (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: FM.grain, mixBlendMode: 'overlay', backgroundImage: `url("${FM_GRAIN}")` }} />
      )}

      {/* ── Barre haute ── */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '26px 34px', flexShrink: 0 }}>
        <div style={{ flex: 1 }} />
        {!allDone && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, maxWidth: 360, margin: '0 28px' }}>
            <div style={{ display: 'flex', gap: 5, flex: 1 }}>
              {queue.map((_, i) => (
                <span key={i} style={{ height: 3, flex: 1, borderRadius: 999,
                  background: i < idx ? FM.okDot : i === idx ? FM.prog : FM.progTrack, transition: 'background .3s' }} />
              ))}
            </div>
            <span style={{ fontSize: 12, fontWeight: 800, color: FM.pct, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {idx + 1}<span style={{ color: FM.pctDim }}> / {total}</span></span>
          </div>
        )}
        <button onClick={close} title="Quitter (Échap)" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, height: 38, padding: '0 18px', borderRadius: 999,
          border: `1px solid ${FM.line}`, background: FM.chip, color: FM.n200, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 13, fontWeight: 700, flexShrink: 0 }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = FM.lineHi }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = FM.line }}>
          Échap
        </button>
      </div>

      {/* ── Corps ── */}
      {allDone ? (
        <div style={{ flex: 1, minHeight: 420, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', ...contentFade }}>
          <div style={{ width: 74, height: 74, borderRadius: '50%', display: 'grid', placeItems: 'center', background: FM.ok,
            boxShadow: '0 16px 40px -12px rgba(52,199,150,.5)' }}>
            <RXIcon name="check" size={34} sw={2.4} color={FM.okFg} />
          </div>
          <h2 style={{ margin: '22px 0 0', fontSize: 30, fontWeight: 800, letterSpacing: -0.8, color: FM.n100 }}>File traitée</h2>
          <div style={{ fontSize: 14.5, color: FM.n400, marginTop: 8, maxWidth: 340, lineHeight: 1.5 }}>
            Toutes tes priorités sont gérées. Enchaîne sur le mur de matchs pour placer tes biens.</div>

          {/* Récap de session */}
          <div style={{ display: 'flex', alignItems: 'stretch', marginTop: 28, borderRadius: 18, overflow: 'hidden',
            border: `1px solid ${FM.line}`, background: FM.chip }}>
            <FmStat fm={FM} value={total} label={total > 1 ? 'priorités traitées' : 'priorité traitée'} />
            <div style={{ width: 1, background: FM.line }} />
            <FmStat fm={FM} value={focusMin} label="min de concentration" />
            {snoozeCount > 0 && (
              <>
                <div style={{ width: 1, background: FM.line }} />
                <FmStat fm={FM} value={snoozeCount} label={snoozeCount > 1 ? 'replanifiées' : 'replanifiée'} />
              </>
            )}
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            <button onClick={reset} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: 46, padding: '0 20px', borderRadius: 999,
              border: `1px solid ${FM.line}`, background: FM.chip, color: FM.n100, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700 }}>
              <RXIcon name="arrow" size={16} sw={2} color={FM.n100} />Revoir la file</button>
            <button onClick={goCatalogue} style={{ display: 'inline-flex', alignItems: 'center', gap: 9, height: 46, padding: '0 14px 0 22px', borderRadius: 999, border: 0, background: FM.solidBg, color: FM.solidFg,
              cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 800 }}>
              Voir le catalogue de matchs
              <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: FM.solidFg === '#FFFFFF' ? 'rgba(255,255,255,.16)' : 'rgba(11,12,14,.12)' }}>
                <RXIcon name="arrow" size={15} sw={2.2} color={FM.solidFg} /></span></button>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 520, display: 'flex', gap: 26, padding: '0 34px 34px', ...contentFade }}>

          {/* PRIORITÉ COURANTE — carte immersive (identique dans les 2 thèmes) */}
          <div style={{ flex: 1, minWidth: 0, position: 'relative', borderRadius: 28, overflow: 'hidden',
            border: `1px solid ${FM_ONPHOTO}`, boxShadow: '0 40px 90px -40px rgba(0,0,0,.9)' }}>
            <img key={item.id} src={item.bien.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,12,.46) 0%, rgba(8,8,12,.05) 32%, rgba(8,8,12,.95) 100%)' }} />
            <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 160px 40px rgba(8,8,12,.55)', pointerEvents: 'none' }} />

            <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '40px 44px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999,
                  background: FM_GLASS, backdropFilter: 'blur(12px)', border: `1px solid ${FM_ONPHOTO}`,
                  fontSize: 12, fontWeight: 800, letterSpacing: 0.4, color: '#fff' }}>
                  <RXIcon name={tyy.icon} size={14} sw={2.1} color={tyy.badge} />{item.category}</span>
                {item.time && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600,
                    color: item.urgent ? '#F7B0AA' : 'rgba(255,255,255,.74)' }}>
                    <RXIcon name="clock" size={13} color={item.urgent ? '#F7B0AA' : 'rgba(255,255,255,.6)'} />{item.time}</span>
                )}
                <span title="Priorité estimée" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.68)' }}>
                  <RXIcon name="spark" size={13} color="#9b7cf0" />estimation · {item.score}</span>
              </div>

              <h1 style={{ margin: 0, fontSize: 46, fontWeight: 800, letterSpacing: -1.4, lineHeight: 1.02, color: '#fff' }}>{item.contact}</h1>
              <div style={{ fontSize: 16, color: 'rgba(255,255,255,.84)', marginTop: 10, maxWidth: 520, lineHeight: 1.45 }}>{item.sub}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: 'rgba(255,255,255,.7)', marginTop: 8, maxWidth: 520, lineHeight: 1.4 }}>
                <RXIcon name="spark" size={13} color="#9b7cf0" /><span>{item.reason}</span></div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 28, paddingTop: 24, borderTop: `1px solid ${FM_ONPHOTO}` }}>
                <span style={{ fontSize: 24, fontWeight: 800, color: '#fff', letterSpacing: -0.6, whiteSpace: 'nowrap' }}>{item.bien.price}</span>
                <div style={{ flex: 1 }} />
                <motion.button onClick={onPrimary} whileHover={{ scale: 1.03, y: -2 }} whileTap={{ scale: 0.96 }} transition={{ type: 'spring', stiffness: 420, damping: 24 }} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, height: 52, padding: '0 26px', borderRadius: 999, border: 0, cursor: 'pointer',
                  fontFamily: 'inherit', fontSize: 16, fontWeight: 800, whiteSpace: 'nowrap',
                  backgroundColor: calling ? FM_DARK.ok : '#F2F2F6', color: calling ? FM_DARK.okFg : '#0A0A0F',
                  boxShadow: calling ? '0 12px 30px -10px rgba(52,199,150,.5)' : '0 12px 28px -10px rgba(0,0,0,.6)',
                  transition: 'background-color .25s, box-shadow .25s' }}>
                  {calling ? (
                    <>
                      <span style={{ position: 'relative', display: 'inline-flex', width: 10, height: 10 }}>
                        <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: FM_DARK.okDot, animation: 'focus-ping 1.4s cubic-bezier(0,0,.2,1) infinite' }} />
                        <span style={{ position: 'relative', width: 10, height: 10, borderRadius: 999, background: FM_DARK.okDot }} />
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>Terminer · {mmss}</span>
                    </>
                  ) : (
                    <><RXIcon name={tyy.icon} size={20} sw={1.9} />{tyy.label(item.contact)}</>
                  )}
                </motion.button>
                <FmGlassBtn onClick={snooze} title="Replanifier" meName="calendar" />
                <FmGlassBtn onClick={done} title="Marquer fait" meName="check" />
              </div>
            </div>
          </div>

          {/* À SUIVRE — capsules */}
          <aside style={{ width: 338, flexShrink: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 16, paddingLeft: 4 }}>
              <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: FM.n400, whiteSpace: 'nowrap' }}>À suivre</span>
              <span style={{ fontSize: 11.5, fontWeight: 800, color: FM.n500, fontVariantNumeric: 'tabular-nums' }}>{upcoming.length}</span>
            </div>
            {upcoming.length === 0 ? (
              <div style={{ fontSize: 13.5, color: FM.n500, paddingLeft: 4 }}>Dernière priorité de la file.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto', marginRight: -6, paddingRight: 6 }}>
                {upcoming.map((it, k) => (
                  <FmCapsule key={it.id} item={it} delay={k * 70} onClick={() => jump(idx + 1 + k)} fm={FM} />
                ))}
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
