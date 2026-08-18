// MEGGA CRM — Dashboard « Première connexion » (porte d'accueil, concept A2 « Monument centré »).
// Port du handoff `analytics-gate.jsx`. Premier temps du parcours « compte neuf » :
// porte immersive plein cadre, un seul axe vertical, geste unique et obligatoire —
// fixer l'objectif annuel. Différence prod : la validation écrit l'objectif via le
// backend réel (useAgencyTargets → RPC analytics_set_target), PAS en localStorage.
// L'écran bascule ensuite tout seul vers le cockpit fantôme (objectif défini, 0 deal).

import { crmVoileEncre } from '@/components/crm/tokens'
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
        /* L'anneau de focus prend l'accent-ENCRE : sur fond sombre l'aplat
           #424bfb rendrait 3,44:1, sous le seuil des filets.

           ⛔ ET IL LUI FAUT LA PRIORITÉ, sinon il ne peint RIEN. Le champ porte
           son ombre en style EN LIGNE, qui l'emporte sur toute règle de feuille
           sans priorité — l'anneau était donc écrit, lu par personne, depuis le
           premier port. La maquette porte le même défaut ; il ne se voit qu'en
           relisant le box-shadow CALCULÉ pendant que le champ a le focus. */
        .ax-gate-input:focus-within{box-shadow:inset 0 0 0 2px ${A.accText} !important}
        .ax-gate-input input::placeholder{color:${A.ghost}}
        /* Zéro état de survol : la nappe a banni les transitions d'affordance,
           et le survol qui vivait ici repeignait le CTA en GRIS — un reste de
           l'époque où l'affordance primaire était l'encre, pas l'accent. */
        @media (prefers-reduced-motion: no-preference){
          .ax-gate-icon{animation:agFloat 6s ease-in-out infinite alternate}
          .ax-gate-in1{animation:agUp .5s cubic-bezier(.2,.8,.2,1) both}
          .ax-gate-in2{animation:agUp .5s .08s cubic-bezier(.2,.8,.2,1) both}
          .ax-gate-in3{animation:agUp .5s .16s cubic-bezier(.2,.8,.2,1) both}
        }
      `}</style>

      <img className="ax-gate-icon ax-gate-in1" src="/iconly-glass/Activity.svg" alt=""
        style={{ width: 170, filter: `drop-shadow(0 24px 48px ${dark ? 'rgba(0,0,0,0.55)' : `${crmVoileEncre(false, 0.28)}`})` }} />

      {/* ⚠ Le sur-titre « Première connexion » est RETIRÉ (19 août 2026, décision
          Julien). Le titre reprend son écart à l'icône — 34 px, la valeur que le
          sur-titre portait — plutôt qu'un nouveau : l'axe vertical du monument
          ne bouge pas, seule la ligne disparaît. */}
      <h1 className="ax-gate-in2" style={{ margin: '34px 0 0', fontSize: 44, fontWeight: 600, letterSpacing: -1.6, lineHeight: 1.06, color: A.ink, textAlign: 'center' }}>{tr('analytics.gate.title')}</h1>

      <div className="ax-gate-in3" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)', marginTop: 36, width: 340 }}>
        <div className="ax-gate-input" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', background: A.card, border: `1px solid ${A.border}`, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-xs) var(--crm-space-xs) var(--crm-space-xs) var(--crm-space-4xl)', boxShadow: A.shadow }}>
          <span style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: A.muted, flexShrink: 0 }}>CHF</span>
          <input autoFocus inputMode="numeric" placeholder={tr('analytics.gate.placeholder')} value={val}
            onChange={e => setVal(agFmtInput(e.target.value))}
            onKeyDown={e => { if (e.key === 'Enter') submit() }}
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-5xl)', fontWeight: 600, letterSpacing: -0.6, color: A.ink, padding: 'var(--crm-space-xl) var(--crm-space-2xl) var(--crm-space-xl) 0', fontVariantNumeric: 'tabular-nums', outline: 'none' }} />
        </div>
        <button onClick={submit} disabled={!canSubmit} style={{
          height: 48, borderRadius: 'var(--crm-radius-pill)', border: 0, background: A.accent, color: A.accentInk,
          fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'default',
          opacity: canSubmit ? 1 : 0.45, width: '100%',
        }}>
          {saving ? tr('analytics.gate.saving') : tr('analytics.gate.cta')}
        </button>
        {err && (
          <div role="alert" style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.errInk, textAlign: 'center' }}>
            {tr('analytics.gate.error')}
          </div>
        )}
      </div>
    </div>
  )
}
