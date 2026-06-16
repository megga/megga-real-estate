// MEGGA CRM — Refonte « Aujourd'hui » · Colonne FOCUS (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-proto-focus.jsx`. File de priorités dynamique : une
// situation à la fois (appel / KYC / mandat / offre). On la traite → elle
// s'efface → la suivante arrive. Replanifier la repousse en fin de file.
// « Fait » la sort de la file. La carte + le bouton principal s'adaptent au type.

import { useState, useEffect, type CSSProperties } from 'react'
import { TK } from './tk'
import { RXIcon } from './kit'
import { focusTy, type FocusItem, type FocusTypeDef } from './focusQueue'

// ─── Cellule statistique du récap de fin de file (colonne cockpit) ───────
function FcStat({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ flex: 1, padding: '12px 12px', textAlign: 'center', minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.6, color: TK.ink, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: TK.sub, marginTop: 6, whiteSpace: 'nowrap' }}>{label}</div>
    </div>
  )
}

export function FocusColumn({ baseQueue, onDone, onSnooze, isLoading = false }: {
  baseQueue: FocusItem[]
  onDone?: (item: FocusItem) => void
  onSnooze?: (item: FocusItem) => void
  isLoading?: boolean
}) {
  const [queue, setQueue] = useState<FocusItem[]>(baseQueue)
  const [idx, setIdx] = useState(0)
  const [calling, setCalling] = useState(false)
  const [secs, setSecs] = useState(0)
  const [, setHover] = useState(false)
  const [vis, setVis] = useState(true) // contenu visible (false uniquement pendant une transition)
  const [startTs, setStartTs] = useState(() => Date.now()) // début de session
  const [snoozeCount, setSnoozeCount] = useState(0) // reports de la session
  const [elapsedMs, setElapsedMs] = useState<number | null>(null) // figé à la clôture

  // NB : la resync sur changement de file source (démo↔live / refetch) se fait
  // par REMONTAGE via la prop `key` côté PageAujourdhui (pattern React idiomatique
  // « reset state on prop change »), pas par un effet setState.

  const total = queue.length
  const allDone = idx >= total
  const f = allDone ? null : queue[idx]
  const ty = f ? focusTy(f.type) : null

  // chrono d'appel (remis à 0 à l'amorce de l'appel via onPrimary)
  useEffect(() => {
    if (!calling) return
    const id = setInterval(() => setSecs((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [calling])
  const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`

  // transition de sortie → mutation d'état → arrivée
  const swap = (mutate: () => void) => {
    setCalling(false)
    setVis(false)
    setTimeout(() => {
      mutate()
      requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    }, 320)
  }
  // complétion : simple fondu de sortie → bascule vers la priorité suivante (sans burst)
  const done = () => {
    const cur = queue[idx]
    if (cur) onDone?.(cur) // écriture réelle (clôt le reminder) si applicable
    const willFinish = idx + 1 >= total
    setCalling(false)
    setVis(false)
    setTimeout(() => {
      setIdx((i) => i + 1)
      if (willFinish) setElapsedMs(Date.now() - startTs)
      requestAnimationFrame(() => requestAnimationFrame(() => setVis(true)))
    }, 320)
  }
  const snooze = () => {
    const cur = queue[idx]
    if (cur) onSnooze?.(cur) // écriture réelle (reporte le reminder) si applicable
    setSnoozeCount((c) => c + 1)
    swap(() => setQueue((q) => { const n = [...q]; const [it] = n.splice(idx, 1); n.push(it); return n })) // repoussé en fin de file
  }
  const reset = () => swap(() => { setQueue(baseQueue); setIdx(0); setStartTs(Date.now()); setSnoozeCount(0); setElapsedMs(null) })
  const onPrimary = () => {
    if (ty && ty.live) { if (calling) done(); else { setSecs(0); setCalling(true) } } // appel : démarrer → terminer (=fait)
    else done() // autres : action = traité
  }

  const rise = (i: number, on = vis): CSSProperties => ({
    opacity: on ? 1 : 0,
    transform: on ? 'none' : 'translateY(14px)',
    transition: `opacity .5s ease ${i * 60}ms, transform .55s cubic-bezier(.22,1,.36,1) ${i * 60}ms`,
  })

  // ── ÉTAT « chargement » — évite le faux « File traitée » pendant le fetch ──
  if (isLoading && total === 0) {
    return (
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 22, overflow: 'hidden',
        boxShadow: TK.shadowLg, border: `1px solid ${TK.borderHi}`,
        background: `radial-gradient(120% 90% at 50% 0%, ${TK.frameHi} 0%, ${TK.bg} 70%)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28 }}>
        <div style={{ fontSize: 13, color: TK.sub }}>Chargement de tes priorités…</div>
      </div>
    )
  }

  // ── ÉTAT « file vide » ─────────────────────────────────────────────
  if (allDone) {
    const focusMin = Math.max(1, Math.round((elapsedMs || 0) / 60000))
    return (
      <div style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 22, overflow: 'hidden',
        boxShadow: TK.shadowLg, border: `1px solid ${TK.borderHi}`,
        background: `radial-gradient(120% 90% at 50% 0%, ${TK.frameHi} 0%, ${TK.bg} 70%)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 28 }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, display: 'grid', placeItems: 'center',
          background: '#15643F', boxShadow: '0 12px 30px -10px rgba(52,199,150,.5)' }}>
          <RXIcon name="check" size={30} sw={2.4} color="#DBF4E6" />
        </div>
        <h2 style={{ margin: '18px 0 0', fontSize: 23, fontWeight: 800, letterSpacing: -0.6, color: TK.ink }}>File traitée</h2>
        <div style={{ fontSize: 13, color: TK.sub, marginTop: 6, maxWidth: 240, lineHeight: 1.45 }}>
          Toutes tes priorités du moment sont gérées. Profite — ou avance sur le pipeline.</div>

        {/* Récap de session — le sentiment d'accompli qui referme la boucle */}
        <div style={{ display: 'flex', marginTop: 20, borderRadius: 14, overflow: 'hidden',
          border: `1px solid ${TK.borderHi}`, background: TK.card }}>
          <FcStat value={total} label={total > 1 ? 'traitées' : 'traitée'} />
          <div style={{ width: 1, background: TK.borderHi }} />
          <FcStat value={focusMin} label="min focus" />
          {snoozeCount > 0 && (
            <>
              <div style={{ width: 1, background: TK.borderHi }} />
              <FcStat value={snoozeCount} label={snoozeCount > 1 ? 'reportées' : 'reportée'} />
            </>
          )}
        </div>

        <button onClick={reset} style={{ marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8, height: 42, padding: '0 18px',
          borderRadius: 999, border: `1px solid ${TK.borderHi}`, cursor: 'pointer', background: TK.card, color: TK.ink,
          fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700 }}>
          <RXIcon name="arrow" size={16} sw={2} color={TK.ink} />Revoir la file</button>
      </div>
    )
  }

  // ── SITUATION COURANTE ─────────────────────────────────────────────
  const item = f as FocusItem
  const tyy = ty as FocusTypeDef
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ flex: 1, minHeight: 0, position: 'relative', borderRadius: 22, overflow: 'hidden',
        boxShadow: TK.shadowLg, border: `1px solid ${TK.borderHi}`, transition: 'opacity .45s ease' }}
    >
      {/* PHOTO réelle ou fond neutre honnête (items sans bien / sans visuel) */}
      {item.bien.photo ? (
        <img key={item.id} src={item.bien.photo} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          objectFit: 'cover', opacity: vis ? 1 : 0,
          transition: 'opacity .42s ease' }} />
      ) : (
        <div key={item.id} style={{ position: 'absolute', inset: 0, opacity: vis ? 1 : 0, transition: 'opacity .42s ease',
          background: `radial-gradient(120% 90% at 50% 0%, ${TK.frameHi} 0%, ${TK.bg} 72%)` }} />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(8,8,12,.5) 0%, rgba(8,8,12,.04) 34%, rgba(8,8,12,.94) 100%)' }} />
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(150deg, ${TK.primary}1f 0%, transparent 45%, rgba(120,80,200,.14) 100%)`, mixBlendMode: 'soft-light' }} />
      <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 120px 24px rgba(8,8,12,.6)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', padding: 20 }}>

        {/* HAUT — progression dans la file */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...rise(0) }}>
          <div style={{ display: 'flex', gap: 5, flex: 1 }}>
            {queue.map((_, i) => (
              <span key={i} style={{ height: 3, flex: 1, borderRadius: 999, background: i < idx ? '#34C796' : i === idx ? '#fff' : 'rgba(255,255,255,.22)',
                transition: 'background .3s ease' }} />
            ))}
          </div>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.7)', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
            {idx + 1}<span style={{ color: 'rgba(255,255,255,.4)' }}> / {total}</span></span>
        </div>

        <div style={{ flex: 1 }} />

        {/* BAS — situation courante */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', ...rise(1) }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 11px', borderRadius: 999,
              background: 'rgba(8,8,12,.5)', backdropFilter: 'blur(10px)', border: `1px solid ${TK.borderHi}`,
              fontSize: 11, fontWeight: 800, letterSpacing: 0.3, color: '#fff', whiteSpace: 'nowrap' }}>
              <RXIcon name={tyy.icon} size={12} sw={2.1} color={tyy.badge} />{item.category}</span>
            {item.time && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap',
                color: item.urgent ? '#F7B0AA' : 'rgba(255,255,255,.72)' }}>
                <RXIcon name="clock" size={12} color={item.urgent ? '#F7B0AA' : 'rgba(255,255,255,.6)'} />{item.time}</span>
            )}
            {/* Score = estimation (jamais « garanti »/« automatique ») */}
            <span title="Priorité estimée" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', color: 'rgba(255,255,255,.62)' }}>
              <RXIcon name="spark" size={12} color="#9b7cf0" />estimation · {item.displayScore}</span>
          </div>

          <h2 style={{ margin: '12px 0 0', fontSize: 29, fontWeight: 800, letterSpacing: -0.9, color: '#fff', lineHeight: 1.02, ...rise(2) }}>{item.contact}</h2>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.82)', marginTop: 6, lineHeight: 1.4, ...rise(3) }}>{item.sub}</div>
          {/* « pourquoi #1 » — raison déterministe, présentée comme estimation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,.66)', marginTop: 6, ...rise(3) }}>
            <RXIcon name="spark" size={12} color="#9b7cf0" /><span>{item.reason}</span></div>

          {/* prix + actions adaptatives */}
          <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${TK.borderHi}`, ...rise(4) }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 9, marginBottom: 12 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: -0.4, whiteSpace: 'nowrap' }}>{item.bien.price}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {/* PRINCIPAL — change selon le type (et l'état d'appel) */}
              <button onClick={onPrimary} style={{
                flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, height: 46, padding: '0 18px', borderRadius: 999, border: 0, cursor: 'pointer',
                fontFamily: 'inherit', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap',
                backgroundColor: calling ? '#15643F' : '#F2F2F6', color: calling ? '#DBF4E6' : '#0A0A0F',
                boxShadow: calling ? '0 8px 26px -8px rgba(52,199,150,.5)' : '0 8px 22px -8px rgba(0,0,0,.6)',
                transition: 'background-color .25s ease, box-shadow .25s ease',
              }}>
                {calling ? (
                  <>
                    <span style={{ position: 'relative', display: 'inline-flex', width: 9, height: 9 }}>
                      <span style={{ position: 'absolute', inset: 0, borderRadius: 999, background: '#34C796', animation: 'focus-ping 1.4s cubic-bezier(0,0,.2,1) infinite' }} />
                      <span style={{ position: 'relative', width: 9, height: 9, borderRadius: 999, background: '#34C796' }} />
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>Terminer · {mmss}</span>
                  </>
                ) : (
                  <><RXIcon name={tyy.icon} size={18} sw={1.9} />{tyy.label(item.contact)}</>
                )}
              </button>
              {/* Replanifier — repousse en fin de file */}
              <button onClick={snooze} title="Replanifier" style={{
                width: 46, height: 46, borderRadius: 999, border: `1px solid ${TK.borderHi}`, cursor: 'pointer', flexShrink: 0,
                background: 'rgba(8,8,12,.5)', backdropFilter: 'blur(10px)', display: 'grid', placeItems: 'center',
                transition: 'background .2s ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.12)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(8,8,12,.5)' }}>
                <RXIcon name="cal" size={17} sw={1.8} color="#fff" />
              </button>
              {/* Fait — sort de la file */}
              <button onClick={done} title="Marquer fait" style={{
                width: 46, height: 46, borderRadius: 999, border: `1px solid ${TK.borderHi}`, cursor: 'pointer', flexShrink: 0,
                background: 'rgba(8,8,12,.5)', backdropFilter: 'blur(10px)',
                display: 'grid', placeItems: 'center', transition: 'background .25s ease, border-color .25s ease' }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,.12)' }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(8,8,12,.5)' }}>
                <RXIcon name="check" size={18} sw={2.4} color="#fff" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
