// MEGGA CRM — Cockpit « Aujourd'hui » · briefing matinal généré (tokens TK).
// Une carte sous le bandeau proactif : MEGGA AI résume les priorités du jour en
// 3-5 points argumentés (généré côté serveur, pseudonymisé, 1×/jour). Se masque
// tant que le flag copilot_briefing_enabled est OFF ou qu'il n'y a rien à dire.
// CTA doux « Approfondir » → ouvre le panneau MEGGA AI (askAi), jamais d'action auto.

import { useTranslation } from 'react-i18next'
import { TK } from '@/components/crm-sugar/today/tk'
import { useAiPanel } from '@/hooks/useAiPanel'
import { useDailyBrief } from '@/hooks/useDailyBrief'
import { AI_SPARK_PATH } from '@/components/ai-copilot/panel/panelIcons'

const BRIEF_BLUE = '#6F8CFF'
const BRIEF_BLUE_LT = '#1E5BC6'

export function MorningBriefing() {
  const { t } = useTranslation('dashboard')
  const { text, isLoading } = useDailyBrief()
  const { askAi } = useAiPanel()
  const blue = TK.mode === 'light' ? BRIEF_BLUE_LT : BRIEF_BLUE

  // Rien à afficher (flag OFF, aucun signal, ou pas encore chargé) → carte masquée.
  if (isLoading || !text.trim()) return null

  return (
    <div style={{
      marginBottom: 14, padding: '14px 16px', borderRadius: 16,
      background: TK.card, border: `1px solid ${TK.cardBorder}`,
      animation: 'brfFade .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      <style>{`@keyframes brfFade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
        <span style={{
          width: 24, height: 24, borderRadius: 999, flexShrink: 0, background: blue,
          boxShadow: TK.mode === 'light' ? '0 2px 8px rgba(30,91,198,0.35)' : '0 2px 10px rgba(111,140,255,0.45)',
          display: 'grid', placeItems: 'center',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true"><path d={AI_SPARK_PATH} /></svg>
        </span>
        <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: blue }}>
          {t('today.brief.eyebrow')}
        </div>
      </div>

      <div style={{
        fontSize: 13, lineHeight: 1.6, fontWeight: 500, color: TK.ink,
        whiteSpace: 'pre-wrap',
      }}>{text}</div>

      <button
        onClick={() => askAi(t('today.brief.deepenQuestion'))}
        style={{
          marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px',
          borderRadius: 999, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
          letterSpacing: -0.1, color: TK.ink, background: TK.card, border: `1px solid ${TK.cardBorder}`,
          transition: 'background .16s, border-color .16s',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = TK.cardHi; e.currentTarget.style.borderColor = TK.borderHi }}
        onMouseLeave={(e) => { e.currentTarget.style.background = TK.card; e.currentTarget.style.borderColor = TK.cardBorder }}>
        {t('today.brief.deepen')}
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={blue} strokeWidth="2.4"
          strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
      </button>
    </div>
  )
}
