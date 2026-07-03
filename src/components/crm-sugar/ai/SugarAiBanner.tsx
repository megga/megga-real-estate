// MEGGA CRM — Bandeau proactif « MEGGA AI a repéré » (surfaces Sugar Pure, sp).
// Ruban compact : glyphe IA plein + « MEGGA AI · <titre> » + puces d'insight
// cliquables. Chaque puce ouvre le panneau MEGGA AI pré-rempli (askAi). Rappel
// doux, jamais d'action auto invisible (CLAUDE.md). Port fidèle du handoff.

import { useState } from 'react'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { useAiPanel } from '@/hooks/useAiPanel'
import { AI_SPARK_PATH } from '@/components/ai-copilot/panel/panelIcons'

export type SugarAiTone = 'info' | 'warn' | 'ok' | 'danger' | 'neutral'
export interface SugarAiInsight {
  short: string
  tone: SugarAiTone
  q: string
}

// Couleurs de pastille — couleurs FONCTIONNELLES MEGGA (jamais en accent UI).
const SGAI_DOT: Record<SugarAiTone, string> = {
  info: '#1E5BC6', warn: '#C45A00', ok: '#059669', danger: '#8E1F3D', neutral: '#7A8088',
}

function SugarAiChip({ it, sp, dark }: { it: SugarAiInsight; sp: SugarPalette; dark: boolean }) {
  const [h, setH] = useState(false)
  const { askAi } = useAiPanel()
  const blue = dark ? '#7FB0FF' : '#1E5BC6'
  return (
    <button
      onClick={() => askAi(it.q)}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
        height: 32, padding: '0 13px', borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit',
        background: h ? (dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8') : (dark ? 'rgba(255,255,255,0.03)' : '#F7F8FA'),
        border: 0, transform: h ? 'translateY(-1px)' : 'none',
        transition: 'background .16s, transform .16s',
      }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: SGAI_DOT[it.tone] || SGAI_DOT.neutral, flexShrink: 0 }} />
      <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: -0.1, color: sp.ink, whiteSpace: 'nowrap' }}>{it.short}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={h ? blue : sp.sub} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"
        style={{ transition: 'stroke .16s' }}><path d="M5 12h14M13 6l6 6-6 6" /></svg>
    </button>
  )
}

interface SugarAiBannerProps {
  sp: SugarPalette
  dark: boolean
  title?: string
  insights: SugarAiInsight[]
}
export default function SugarAiBanner({ sp, dark, title = 'Priorités du jour', insights }: SugarAiBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed || !insights.length) return null
  const blue = dark ? '#7FB0FF' : '#1E5BC6'
  const surface = dark ? sp.solidBg : '#FFFFFF'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18,
      background: surface, borderRadius: 16, boxShadow: sp.shadowSm, padding: '12px 12px 12px 16px',
      animation: 'sgaiFade .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <style>{`@keyframes sgaiFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
        <span style={{
          width: 28, height: 28, borderRadius: 999, flexShrink: 0, background: blue,
          boxShadow: dark ? '0 2px 10px rgba(127,176,255,0.45)' : '0 2px 8px rgba(30,91,198,0.35)',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true"><path d={AI_SPARK_PATH} /></svg>
        </span>
        <div style={{ lineHeight: 1.15 }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: blue }}>MEGGA AI</div>
          <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>{title}</div>
        </div>
      </div>
      <span style={{ width: 1, height: 26, background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0, flex: 1 }}>
        {insights.map((it, i) => <SugarAiChip key={i} it={it} sp={sp} dark={dark} />)}
      </div>
      <button
        onClick={() => setDismissed(true)}
        title="Masquer" aria-label="Masquer"
        style={{
          width: 28, height: 28, borderRadius: 999, border: 0, cursor: 'pointer', flexShrink: 0,
          background: 'transparent', display: 'grid', placeItems: 'center', transition: 'background .16s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : '#F1F4F8' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={sp.sub} strokeWidth="2" strokeLinecap="round"><path d="m6 6 12 12M6 18 18 6" /></svg>
      </button>
    </div>
  )
}
