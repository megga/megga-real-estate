// Atelier Matching — COL 3 · « Pourquoi ça matche » + zone de triage.
// Critères au format « groupé » (Atouts / Points d'attention) — seul format
// retenu en prod (handoff §6.4). KYC = rappel doux, JAMAIS bloquant.

import SgaIcon from './SgaIcon'
import { SGA_ENGAGE_TONE, SGA_KYC } from './constants'
import { sgaInitials, sgaScoreColor } from './format'
import type { AtelierBuyer, AtelierReason } from './types'

// ── Critères · format « groupé » (Atouts / Points d'attention) ──────────
function SgaReasonsGroupes({ reasons }: { reasons: AtelierReason[] }) {
  const pos = reasons.filter(r => r.ok)
  const neg = reasons.filter(r => !r.ok)
  const group = (title: string, items: AtelierReason[], tone: 'pos' | 'neg', delay: string) => (
    <div className="sga-rgroup" style={{ animationDelay: delay }}>
      <div className="gh">
        <span className="gt">{title}</span>
      </div>
      {items.map((r, i) => (
        <div className="sga-rgrow" key={i}>
          <span className={`tick ${tone}`}>
            <SgaIcon d={tone === 'pos' ? 'check' : 'close'} size={11} />
          </span>
          <span className="lbl">{r.label} <em>· {r.detail}</em></span>
        </div>
      ))}
    </div>
  )
  return (
    <div className="sga-rgroups">
      {pos.length > 0 && group('Atouts', pos, 'pos', '0.03s')}
      {neg.length > 0 && group("Points d'attention", neg, 'neg', '0.12s')}
    </div>
  )
}

interface SgaWhyProps {
  b: AtelierBuyer
  poolCount: number
  canVisit: boolean
  onSend: () => void
  onSkip: () => void
  onLater: () => void
  onVisit: () => void
  onRelance: () => void
  onPivot: () => void
  onStartKyc: () => void
}

export default function SgaWhy({ b, poolCount, canVisit, onSend, onSkip, onLater, onVisit, onRelance, onPivot, onStartKyc }: SgaWhyProps) {
  const kyc = SGA_KYC[b.kyc]
  const softKyc = b.kyc === 'none' || b.kyc === 'stale'
  const showVisit = b.status === 'engaged' && canVisit
  const reasons = [...b.reasons].sort((a, z) => Number(z.ok) - Number(a.ok) || z.pts - a.pts)
  const engageTone = SGA_ENGAGE_TONE[b.status]

  return (
    <div className="sga-why-anim" key={b.matchId}>
      <div className="sga-why-head">
        <div className="av" style={{ width: 48, height: 48, background: b.av, fontSize: 17, boxShadow: `0 0 0 4px ${b.av}22` }}>
          {sgaInitials(b.first, b.last)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="t4 semi" style={{ color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {b.first} {b.last}
          </div>
        </div>
        <div className="sga-bigscore" title="Score de compatibilité (estimation)">
          <span className="v nums" style={{ color: sgaScoreColor(b.score) }}>{b.score}</span>
          <span className="pct">/100</span>
        </div>
      </div>

      <div className="sga-gauge"><i style={{ width: `${b.score}%` }} /></div>

      <div className="sga-why-scroll">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className={`sga-spill ${kyc.tone}`}>
            <SgaIcon d="shield" size={12} /> {kyc.label}
          </span>
          <span className={`sga-spill ${engageTone}`}>
            <SgaIcon d="sparkle" size={11} /> {b.engage}
          </span>
        </div>

        {poolCount > 1 && (
          <button className="sga-morebtn" onClick={onPivot}>
            <SgaIcon d="layers" size={13} />
            <span>
              {poolCount - 1} autre{poolCount > 2 ? 's' : ''} bien{poolCount > 2 ? 's' : ''} matche{poolCount > 2 ? 'nt' : ''} ce profil
            </span>
            <SgaIcon d="chevron-right" size={13} />
          </button>
        )}

        <div className="sga-aicard">
          <span className="spark"><SgaIcon d="sparkle" size={15} /></span>
          <div style={{ flex: 1 }}>
            <div className="t1 semi" style={{ marginBottom: 2, color: 'var(--ink)' }}>MEGGA AI</div>
            <div className="t1 soft" style={{ lineHeight: 1.5 }}>{b.ai}</div>
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 9 }}>
            <span className="eyebrow">Pourquoi ça matche</span>
          </div>
          <SgaReasonsGroupes reasons={reasons} />
        </div>

        {softKyc && (
          <div className="sga-aicard">
            <span className="spark kyc"><SgaIcon d="shield" size={15} /></span>
            <div style={{ flex: 1 }}>
              <div className="t1 semi" style={{ marginBottom: 2, color: 'var(--ink)' }}>KYC à compléter — optionnel à ce stade</div>
              <div className="t1 muted" style={{ lineHeight: 1.5 }}>Rappel doux, non bloquant. À finaliser avant une offre.</div>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'center' }} onClick={onStartKyc}>Démarrer</button>
          </div>
        )}
      </div>

      <div className="sga-triage">
        {b.status === 'no-reply' && (
          <button className="btn btn-ghost" onClick={onRelance}>
            <SgaIcon d="refresh" size={15} /> Relancer · autre canal
          </button>
        )}
        {showVisit && (
          <button className="btn btn-ghost" onClick={onVisit}>
            <SgaIcon d="calendar" size={16} /> Proposer une visite
          </button>
        )}
        <div className="btns" data-cols="3">
          <button className="btn btn-ghost" onClick={onSkip}>
            <SgaIcon d="close" size={16} /> Écarter
          </button>
          <button className="btn btn-ghost" onClick={onLater}>
            <SgaIcon d="clock" size={16} /> Plus tard
          </button>
          <button className="btn btn-primary" onClick={onSend}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  )
}
