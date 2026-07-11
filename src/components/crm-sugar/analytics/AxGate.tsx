// MEGGA CRM — Dashboard « Première connexion » (porte d'accueil, concept A2 « Monument centré »).
// Port du handoff `analytics-gate.jsx`. Premier temps du parcours « compte neuf » :
// porte immersive plein cadre, un seul axe vertical, geste unique et obligatoire —
// fixer l'objectif annuel. Différence prod : la validation écrit l'objectif via le
// backend réel (useAgencyTargets → RPC analytics_set_target), PAS en localStorage.
// L'écran bascule ensuite tout seul vers le cockpit fantôme (objectif défini, 0 deal).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAX } from './tokens'

// Format d'apostrophes suisse pendant la saisie (max 9 chiffres).
const agFmtInput = (v: string): string =>
  String(v).replace(/\D/g, '').slice(0, 9).replace(/\B(?=(\d{3})+(?!\d))/g, "'")

export default function AxGate({ dark, saving, onDone }: { dark: boolean; saving: boolean; onDone: (amount: number) => void | Promise<unknown> }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const [val, setVal] = useState('')
  const [err, setErr] = useState(false)
  const num = parseInt(String(val).replace(/\D/g, ''), 10) || 0
  const canSubmit = num > 0 && !saving
  // La validation écrit l'objectif via le backend (RPC analytics_set_target) ; on
  // capture un éventuel rejet (réseau/RLS) pour ne jamais laisser la porte figée
  // sans retour — au lieu d'un `void` qui produirait un unhandled rejection.
  const submit = () => {
    if (!canSubmit) return
    setErr(false)
    Promise.resolve(onDone(num)).catch(() => setErr(true))
  }

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
      <style>{`
        @keyframes agFloat{from{transform:translateY(0)}to{transform:translateY(-10px)}}
        @keyframes agUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .ax-gate-input{outline:none !important}
        .ax-gate-input:focus-within{box-shadow:inset 0 0 0 2px ${A.ink}}
        .ax-gate-input input::placeholder{color:${A.ghost}}
        .ax-gate-cta{outline:none !important}
        .ax-gate-cta:hover{background:${dark ? '#E4E6EA' : '#1F2024'} !important}
        @media (prefers-reduced-motion: no-preference){
          .ax-gate-icon{animation:agFloat 6s ease-in-out infinite alternate}
          .ax-gate-in1{animation:agUp .5s cubic-bezier(.2,.8,.2,1) both}
          .ax-gate-in2{animation:agUp .5s .08s cubic-bezier(.2,.8,.2,1) both}
          .ax-gate-in3{animation:agUp .5s .16s cubic-bezier(.2,.8,.2,1) both}
        }
      `}</style>

      <img className="ax-gate-icon ax-gate-in1" src="/iconly-glass/Activity.svg" alt=""
        style={{ width: 170, filter: `drop-shadow(0 24px 48px ${dark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.28)'})` }} />

      <div className="ax-gate-in2" style={{ marginTop: 34, fontSize: 11, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase', color: A.muted }}>{tr('analytics.gate.eyebrow')}</div>
      <h1 className="ax-gate-in2" style={{ margin: '14px 0 0', fontSize: 44, fontWeight: 800, letterSpacing: -1.6, lineHeight: 1.06, color: A.ink, textAlign: 'center' }}>{tr('analytics.gate.title')}</h1>

      <div className="ax-gate-in3" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36, width: 340 }}>
        <div className="ax-gate-input" style={{ display: 'flex', alignItems: 'center', gap: 10, background: A.card, borderRadius: 14, padding: '4px 4px 4px 18px', boxShadow: A.shadowSm }}>
          <span style={{ fontSize: 17, fontWeight: 800, color: A.muted, flexShrink: 0 }}>CHF</span>
          <input autoFocus inputMode="numeric" placeholder={tr('analytics.gate.placeholder')} value={val}
            onChange={e => setVal(agFmtInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 24, fontWeight: 800, letterSpacing: -0.6, color: A.ink, padding: '12px 14px 12px 0', fontVariantNumeric: 'tabular-nums', outline: 'none' }} />
        </div>
        <button className="ax-gate-cta" onClick={submit} disabled={!canSubmit} style={{
          height: 48, borderRadius: 999, border: 0, background: A.ink, color: A.onAccent,
          fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: canSubmit ? 'pointer' : 'default',
          opacity: canSubmit ? 1 : 0.45, width: '100%',
        }}>
          {saving ? tr('analytics.gate.saving') : tr('analytics.gate.cta')}
        </button>
        {err && (
          <div role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: A.pillBehind.bg, textAlign: 'center' }}>
            {tr('analytics.gate.error')}
          </div>
        )}
      </div>
    </div>
  )
}
