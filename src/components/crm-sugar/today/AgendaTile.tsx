// MEGGA CRM — Refonte « Aujourd'hui » · Tuile « Agenda du jour » (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-proto-agenda.jsx`. Héro « prochain RDV » (actions) + rail
// dense pour le reste + ligne « faits ». Rendu comme CORPS de tuile (l'en-tête
// TileHead reste géré par la page).

import { useState, type MouseEvent } from 'react'
import { TK } from './tk'
import { RXIcon, Av } from './kit'
import { DATA, type AgendaItem } from './data'

const AGF = DATA.agenda
const AGF_TYPE: Record<string, { icon: string; c: string; label: string }> = {
  call: { icon: 'phone', c: '#6F8CFF', label: 'Appel' },
  shield: { icon: 'shield', c: '#39B7C9', label: 'KYC' },
  doc: { icon: 'doc', c: '#E08A45', label: 'Mandat' },
  home: { icon: 'home', c: '#6F8CFF', label: 'Visite' },
  offer: { icon: 'offer', c: '#34C796', label: 'Offre' },
}
const agfTy = (k: string) => AGF_TYPE[k] || AGF_TYPE.call

function AgfAct({ name, primary = false }: { name: string; primary?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      width: 32, height: 32, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
      background: primary ? '#F2F2F6' : (h ? TK.cardHi : TK.card), color: primary ? '#0A0A0F' : (h ? TK.ink : TK.sub),
      display: 'grid', placeItems: 'center', transition: 'background .15s, color .15s',
    }}><RXIcon name={name} size={15} sw={1.9} /></button>
  )
}

// ─── Ligne dense d'un RDV (rail « Ensuite ») ────────────────────────────
function AgfRow({ a, hovered, onHover }: { a: AgendaItem; hovered: boolean; onHover: (v: MouseEvent | null) => void }) {
  const t = agfTy(a.kind)
  return (
    <div onMouseEnter={onHover} onMouseLeave={() => onHover(null)} style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderRadius: 10,
      background: hovered ? TK.cardHi : 'transparent', transition: 'background .15s',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: TK.sub, width: 38, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{a.time}</span>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: t.c, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: TK.ink }}>{a.label}</span>
        <span style={{ fontSize: 11.5, color: TK.sub }}> · {a.meta}</span>
      </div>
      {hovered ? (
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          {a.kind === 'home' ? <AgfAct name="home" primary /> : a.kind === 'call' ? <AgfAct name="phone" primary /> : null}
          <AgfAct name="cal" />
        </div>
      ) : (
        <span style={{ fontSize: 10, fontWeight: 800, color: t.c, letterSpacing: 0.4, textTransform: 'uppercase', flexShrink: 0, opacity: 0.85 }}>{t.label}</span>
      )}
    </div>
  )
}

// ─── Corps de tuile Agenda (à placer dans <Tile> après le TileHead) ─────
export function AgendaTile() {
  const [hover, setHover] = useState<number | null>(null)
  const next = AGF.find((a) => a.now) || AGF[1]
  const rest = AGF.filter((a) => !a.now && !a.done)
  const done = AGF.filter((a) => a.done)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* faits ce matin — replié, discret */}
      {done.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10, opacity: 0.6, whiteSpace: 'nowrap' }}>
          <RXIcon name="check" size={12} color="#34C796" sw={2.6} />
          <span style={{ fontSize: 11, color: TK.sub, fontWeight: 600 }}>{done.length} fait ce matin · {done.map((d) => d.time).join(', ')}</span>
        </div>
      )}

      {/* HÉRO — prochain RDV */}
      <div style={{ position: 'relative', background: 'rgba(111,140,255,0.1)', border: '1px solid rgba(111,140,255,0.3)',
        borderRadius: 15, padding: '12px 13px', marginBottom: 12, overflow: 'hidden', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Av initials={next.initials} av={next.av} size={38} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, minWidth: 0 }}>
              <span style={{ fontSize: 11, color: TK.sub, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.time} · dans 7 min</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: TK.ink, letterSpacing: -0.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{next.label}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 11 }}>
          <button style={{ flex: 1, height: 36, borderRadius: 999, border: 0, cursor: 'pointer', background: '#F2F2F6', color: '#0A0A0F',
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <RXIcon name="phone" size={15} sw={1.9} />Appeler</button>
          <AgfAct name="cal" /><AgfAct name="user" />
        </div>
      </div>

      {/* ENSUITE — rail dense */}
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase', color: TK.sub, marginBottom: 5, paddingLeft: 2 }}>Ensuite</div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', marginRight: -6, paddingRight: 6,
        maskImage: 'linear-gradient(to bottom, #000 88%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 88%, transparent 100%)' }}>
        {rest.map((a, i) => (
          <AgfRow key={i} a={a} hovered={hover === i} onHover={(v) => setHover(v === null ? null : i)} />
        ))}
      </div>
    </div>
  )
}
