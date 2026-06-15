// MEGGA CRM — Refonte « Aujourd'hui » · Tuile « Objectif » (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-proto-objectif.jsx`. Demi-jauge 180° (speedometer) :
// piste + remplissage projeté + secteur manquant + repère rythme + aiguille.
// Rendu comme CORPS de tuile (TileHead géré par la page).

import { TK } from './tk'
import { DATA, fmtCHF } from './data'

const OBJ = DATA.objectif
const OBJ_PROJ = OBJ.pct // 90
const objPol = (cx: number, cy: number, r: number, deg: number): [number, number] => {
  const a = (deg * Math.PI) / 180
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}
const objArc = (cx: number, cy: number, r: number, s: number, e: number): string => {
  const [x1, y1] = objPol(cx, cy, r, s)
  const [x2, y2] = objPol(cx, cy, r, e)
  const large = (e - s) % 360 > 180 ? 1 : 0
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`
}

export function ObjectifTile() {
  const W = 216, cx = 108, cy = 112, r = 86
  const a0 = 180
  const ang = (fr: number) => a0 + (fr / 100) * 180 // 180°→360° via le haut
  const [nx, ny] = objPol(cx, cy, r - 13, ang(OBJ_PROJ))
  const ticks = [0, 25, 50, 75, 100]
  const [mx1, my1] = objPol(cx, cy, r + 8, ang(100))
  const [mx2, my2] = objPol(cx, cy, r - 8, ang(100))
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <svg width={W} height={124} viewBox={`0 0 ${W} 124`} style={{ display: 'block' }}>
          {/* piste */}
          <path d={objArc(cx, cy, r, a0, 360)} fill="none" stroke={TK.cardHi} strokeWidth="13" strokeLinecap="round" />
          {/* secteur manquant (projeté → cible) en warn discret */}
          <path d={objArc(cx, cy, r, ang(OBJ_PROJ), 360)} fill="none" stroke="#E08A4566" strokeWidth="13" strokeLinecap="round" />
          {/* remplissage projeté */}
          <path d={objArc(cx, cy, r, a0, ang(OBJ_PROJ))} fill="none" stroke="#424bfb" strokeWidth="13" strokeLinecap="round" />
          {/* graduations */}
          {ticks.map((t) => {
            const [x1, y1] = objPol(cx, cy, r - 20, ang(t))
            const [x2, y2] = objPol(cx, cy, r - 27, ang(t))
            return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={TK.sub} strokeWidth="1.4" />
          })}
          {/* repère rythme (cible) */}
          <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="#F2B855" strokeWidth="2.5" strokeLinecap="round" />
          {/* aiguille */}
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={TK.ink} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="6.5" fill={TK.ink} />
          <circle cx={cx} cy={cy} r="2.6" fill={TK.frameHi} />
        </svg>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          <div style={{ fontSize: 23, fontWeight: 800, color: TK.ink, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtCHF(OBJ.projete)}</div>
        </div>
      </div>
      {/* pied : réalisé / retard / cible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${TK.border}` }}>
        <div><div style={{ fontSize: 13.5, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtCHF(OBJ.realise).replace('CHF ', '')}</div><div style={{ fontSize: 10, color: TK.sub }}>réalisé</div></div>
        <div style={{ textAlign: 'right' }}><div style={{ fontSize: 13.5, fontWeight: 800, color: TK.inkDim, fontVariantNumeric: 'tabular-nums' }}>{fmtCHF(OBJ.objectif).replace('CHF ', '')}</div><div style={{ fontSize: 10, color: TK.sub }}>cible</div></div>
      </div>
    </div>
  )
}
