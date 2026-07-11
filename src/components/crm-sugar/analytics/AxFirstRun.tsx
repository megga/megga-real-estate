// MEGGA CRM — Dashboard « compte neuf » : cockpit fantôme (wireframe C « Hybride »).
// Port du handoff `analytics-firstrun.jsx`. Ce que voit l'agent objectif fixé mais
// 0 deal : la carte objectif est REMPLIE (montant réel de l'agence), la trajectoire
// montre la ligne objectif déjà allumée, le reste est en silhouettes honnêtes avec
// une ligne d'explication chacune. Aucun faux chiffre. Dès la première activité
// (realizedNow/projectedEnd/composition > 0), l'écran bascule sur le cockpit réel.

import { useTranslation } from 'react-i18next'
import { useAX, axCHF, axShort } from './tokens'
import type { AxfAccent } from './AxDashboard'

export default function AxFirstRun({ acc, dark, target, onGoSettings }: { acc: AxfAccent; dark: boolean; target: number; onGoSettings: (() => void) | null }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  const ghost = dark ? '#23262B' : '#ECEFF4'
  const cap: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: A.muted, lineHeight: 1.4 }

  return (
    <div className="axf-grid" style={{ height: '100%', width: '100%', display: 'flex', gap: 16 }}>
      {/* ── Colonne gauche : objectif (rempli) + composition fantôme ── */}
      <div className="axf-col-left" style={{ flex: '0 0 clamp(300px, 27%, 396px)', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ flex: '0.98 1 0', minHeight: 0, display: 'grid' }}>
          <div style={{ background: A.card, borderRadius: 26, padding: '26px 28px', boxShadow: A.shadowLg, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1.3, textTransform: 'uppercase', color: A.muted }}>{tr('analytics.firstrun.objectiveEyebrow')}</div>
            <div style={{ fontSize: 'clamp(28px, 2.3vw, 42px)', fontWeight: 800, letterSpacing: -1.4, color: A.ink, lineHeight: 0.98, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{target > 0 ? axCHF(target) : '—'}</div>
            {target > 0 && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', borderRadius: 999, background: A.pillAhead.bg, color: A.pillAhead.fg, boxShadow: A.pillAhead.sh, fontSize: 12, fontWeight: 800, width: 'max-content' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13l5 5 11-12" /></svg>
                {tr('analytics.firstrun.objectiveSet')}
              </span>
            )}
            <div style={cap}>
              {tr('analytics.firstrun.objectiveCaption')}
              {onGoSettings && (
                <>{' '}<button onClick={onGoSettings} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 800, color: A.ink, textDecoration: 'underline', textUnderlineOffset: 2 }}>{tr('analytics.hero.modify')}</button></>
              )}
            </div>
          </div>
        </div>
        <div style={{ flex: '1.02 1 0', minHeight: 0, display: 'grid' }}>
          <div style={{ background: A.card, borderRadius: 26, padding: '18px 22px 16px', boxShadow: A.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: A.ink, letterSpacing: -0.4, flexShrink: 0 }}>{tr('analytics.composition.title')}</h3>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
              <div style={{ flex: 58, background: ghost, borderRadius: 16, minHeight: 34 }} />
              <div style={{ flex: 28, background: ghost, borderRadius: 16, minHeight: 26, opacity: 0.72 }} />
              <div style={{ flex: 14, background: ghost, borderRadius: 16, minHeight: 20, opacity: 0.45 }} />
            </div>
            <div style={{ ...cap, marginTop: 12, flexShrink: 0 }}>{tr('analytics.firstrun.compositionCaption')}</div>
          </div>
        </div>
      </div>

      {/* ── Colonne droite : trajectoire (objectif allumé) + silhouettes ── */}
      <div className="axf-col-right" style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ flex: '1.9 1 0', minHeight: 0, display: 'grid' }}>
          <div style={{ background: A.card, borderRadius: 26, padding: '20px 26px 14px', boxShadow: A.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: A.ink, letterSpacing: -0.4, flexShrink: 0 }}>{tr('analytics.chart.title')}</h3>
            <div style={{ flex: 1, minHeight: 0, position: 'relative', marginTop: 8 }}>
              <svg viewBox="0 0 1000 380" width="100%" height="100%" preserveAspectRatio="none" style={{ animation: 'axRise .5s cubic-bezier(.2,.8,.2,1) both' }}>
                <path d="M 22 346 L 978 34" fill="none" stroke={A.goal} strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
                <text x="976" y="22" textAnchor="end" fontSize="12" fontWeight="700" fill={A.muted} fontFamily="Manrope">{tr('analytics.trajectory.objectiveShort', { amount: axShort(target) })}</text>
                <circle cx="22" cy="346" r="11" fill={acc.accent} opacity="0.2" />
                <circle cx="22" cy="346" r="6" fill={acc.accent} />
                <text x="40" y="336" fontSize="12.5" fontWeight="700" fill={A.inkSoft} fontFamily="Manrope">{tr('analytics.firstrun.trajectoryStart')}</text>
              </svg>
            </div>
          </div>
        </div>
        <div className="axf-strip" style={{ flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex', gap: 16 }}>
          <div style={{ flex: '1.42 1 0', minWidth: 0, minHeight: 0, display: 'grid' }}>
            <div style={{ background: A.card, borderRadius: 26, padding: '18px 22px 16px', boxShadow: A.shadow, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: A.ink, letterSpacing: -0.4, flexShrink: 0 }}>{tr('analytics.sources.commissionTitle')}</h3>
              <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', gap: 14, paddingTop: 12 }}>
                {[100, 68, 44, 27, 15].map((h, i) => (
                  <div key={i} style={{ flex: 1, height: `${h}%`, background: ghost, borderRadius: 10, opacity: 1 - i * 0.14 }} />
                ))}
              </div>
              <div style={{ ...cap, marginTop: 12, flexShrink: 0 }}>{tr('analytics.firstrun.sourcesCaption')}</div>
            </div>
          </div>
          <div style={{ flex: '1.05 1 0', minWidth: 0, minHeight: 0, display: 'grid' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 12, minHeight: 0, minWidth: 0 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ background: A.card, borderRadius: 18, boxShadow: A.shadowSm, padding: '13px 15px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
                  <div style={{ width: '55%', height: 9, borderRadius: 999, background: ghost }} />
                  <div style={{ width: '72%', height: 16, borderRadius: 999, background: ghost, opacity: 0.72 }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
