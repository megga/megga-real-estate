// MEGGA CRM — Cockpit « Aujourd'hui » · bandeau proactif MEGGA AI (tokens TK).
// Un ruban compact sous la salutation : MEGGA AI a repéré les priorités du jour.
// Chaque puce ouvre le panneau MEGGA AI pré-rempli (askAi) — rappel doux, jamais
// d'action auto invisible (CLAUDE.md).
//
// Décision produit (03/07/2026) : insights branchés sur DONNÉES RÉELLES (pipeline
// live), pas d'exemples codés en dur — masqué s'il n'y a aucun signal (le CRM
// interdit les données fabriquées en prod). Grammaire cockpit (TK), accent IA bleu.

import { useState } from 'react'
import { TK } from '@/components/crm-sugar/today/tk'
import { usePipelineSugar } from '@/hooks/usePipelineSugar'
import { useAiPanel } from '@/hooks/useAiPanel'
import { AI_SPARK_PATH } from '@/components/ai-copilot/panel/panelIcons'

const CKAI_BLUE = '#6F8CFF'      // bleu IA (dark) — cohérent TK.primary sombre
const CKAI_BLUE_LT = '#1E5BC6'   // bleu IA (clair)

type CkTone = 'warn' | 'danger' | 'info'
interface CkInsight {
  short: string
  tone: CkTone
  q: string
}

function CockpitAIChip({ it }: { it: CkInsight }) {
  const [h, setH] = useState(false)
  const { askAi } = useAiPanel()
  const p = TK[it.tone] || TK.neutral
  return (
    <button
      onClick={() => askAi(it.q)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
        height: 32, padding: '0 12px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        background: h ? TK.cardHi : TK.card,
        border: `1px solid ${h ? TK.borderHi : TK.cardBorder}`,
        transform: h ? 'translateY(-1px)' : 'none',
        transition: 'background .16s, border-color .16s, transform .16s',
      }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: p.dot, flexShrink: 0 }} />
      <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: -0.1, color: TK.ink, whiteSpace: 'nowrap' }}>{it.short}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={h ? (TK.mode === 'light' ? CKAI_BLUE_LT : CKAI_BLUE) : TK.sub} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke .16s' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  )
}

const plural = (n: number) => (n > 1 ? 's' : '')

export function CockpitAiInsights() {
  const { deals } = usePipelineSugar()
  const blue = TK.mode === 'light' ? CKAI_BLUE_LT : CKAI_BLUE

  // Signaux réels dérivés du pipeline live (aucun exemple fabriqué).
  const active = deals.filter((d) => d.stage !== 'lost')
  const atRisk = active.filter((d) => d.risk === 'at-risk').length
  const stalled = active.filter((d) => d.risk === 'stalled').length
  const offers = active.filter((d) => d.stage === 'offer').length

  const insights: CkInsight[] = []
  if (atRisk) insights.push({
    short: `${atRisk} deal${plural(atRisk)} à risque`, tone: 'warn',
    q: 'Passe en revue mes deals à risque, priorise-les et propose la prochaine meilleure action pour chacun.',
  })
  if (stalled) insights.push({
    short: `${stalled} sans activité`, tone: 'danger',
    q: "Quels deals n'ont eu aucune activité récente, et comment les relancer en priorité ?",
  })
  if (offers) insights.push({
    short: `${offers} offre${plural(offers)} à suivre`, tone: 'info',
    q: 'Quelles offres dois-je relancer en priorité, et rédige-moi la relance.',
  })

  // Empty-state honnête : rien à signaler → pas de bandeau.
  if (!insights.length) return null

  const flagged = new Set<string>()
  active.forEach((d) => { if (d.risk === 'at-risk' || d.risk === 'stalled' || d.stage === 'offer') flagged.add(d.id) })
  const total = flagged.size

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
      animation: 'ckaiFade .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <style>{`@keyframes ckaiFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <span style={{
          width: 26, height: 26, borderRadius: 999, flexShrink: 0, background: blue,
          boxShadow: TK.mode === 'light' ? '0 2px 8px rgba(30,91,198,0.35)' : '0 2px 10px rgba(111,140,255,0.45)',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true"><path d={AI_SPARK_PATH} /></svg>
        </span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: blue }}>MEGGA AI</div>
          <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: -0.2, color: TK.ink }}>
            {total} priorité{plural(total)} aujourd'hui
          </div>
        </div>
      </div>
      <span style={{ width: 1, height: 26, background: TK.cardBorder, flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
        {insights.map((it, i) => <CockpitAIChip key={i} it={it} />)}
      </div>
    </div>
  )
}
