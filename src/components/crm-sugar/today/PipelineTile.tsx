// MEGGA CRM — Refonte « Aujourd'hui » · Tuile « Pipeline » (port fidèle)
// ----------------------------------------------------------------------------
// Port 1:1 de `today-proto-pipeline.jsx`. Entonnoir horizontal : largeur ∝
// valeur du stage, count inline, pastille risque sur le stage concerné, deal à
// risque en pied. Rendu comme CORPS de tuile (TileHead géré par la page).

import { useState } from 'react'
import { TK, TK_STAGE } from './tk'
import { Av } from './kit'
import { DATA } from './data'

const PIPE = DATA.pipeline
const PIPE_RISK = DATA.dealRisk
const pipeMaxV = Math.max(...PIPE.map((p) => p.value))

export function PipelineTile() {
  const [hover, setHover] = useState<number | null>(null)
  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      {/* entonnoir */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 8, minHeight: 0 }}>
        {PIPE.map((p, i) => {
          const st = TK_STAGE[p.key]
          const w = Math.round((p.value / pipeMaxV) * 100)
          const hov = hover === i
          return (
            <div key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              style={{ display: 'flex', alignItems: 'center', gap: 11, cursor: 'default' }}>
              <div style={{ width: 138, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: TK.inkDim, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{st.label}</span>
              </div>
              <div style={{ flex: 1, position: 'relative', height: 26 }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${w}%`, minWidth: 46,
                  borderRadius: 7, background: hov ? `${st.color}44` : `${st.color}2e`,
                  border: `1px solid ${st.color}${hov ? '99' : '66'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 9px',
                  transition: 'background .15s, border-color .15s' }}>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums' }}>{p.count}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {/* deal à risque */}
      <div style={{ marginTop: 'auto', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', borderRadius: 13,
          background: 'rgba(126,28,54,0.16)', border: '1px solid rgba(242,107,101,0.32)' }}>
          <Av initials={PIPE_RISK.initials} av={PIPE_RISK.av} size={32} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PIPE_RISK.bien}</span>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#F0A8AC', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{PIPE_RISK.why}</div>
          </div>
          <span style={{ fontSize: 12.5, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{PIPE_RISK.value}</span>
        </div>
      </div>
    </div>
  )
}
