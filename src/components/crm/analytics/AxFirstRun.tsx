// MEGGA CRM — Dashboard « compte neuf » : cockpit fantôme (wireframe C « Hybride »).
// Port du handoff `analytics-firstrun.jsx` (fusion, 18 août 2026). Ce que voit
// l'agent objectif fixé mais 0 deal : la carte objectif est REMPLIE (montant réel
// de l'agence), la trajectoire montre la ligne objectif déjà allumée, le reste est
// en silhouettes honnêtes avec une ligne d'explication chacune. Aucun faux chiffre.
// Dès la première activité (realizedNow/projectedEnd/composition > 0), l'écran
// bascule sur le cockpit réel.
//
// ⛔ MÊME NAPPE QUE LE COCKPIT RÉEL — mêmes fractions, mêmes filets de 1 px, même
// plein cadre. C'est la raison d'être de cet écran : quand le premier deal tombe,
// les chiffres s'allument DANS la géométrie où les silhouettes étaient, sans saut
// de mise en page. Une grille de cartes espacées ici rendrait la bascule visible.

import { useTranslation } from 'react-i18next'
import { useAX, axCHF, axShort, AX_FILET, type AxfAccent } from './tokens'

export default function AxFirstRun({ acc, target, onGoSettings }: { acc: AxfAccent; target: number; onGoSettings: (() => void) | null }) {
  const A = useAX()
  const { t: tr } = useTranslation('dashboard')
  // La silhouette EST le dernier barreau de la rampe du treemap : un fantôme
  // n'est pas une couleur de plus, c'est la place que prendra la donnée.
  const ghost = acc.rampC
  const cap: React.CSSProperties = { fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.muted, lineHeight: 1.4 }
  const cell: React.CSSProperties = { background: A.card, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }

  return (
    <div className="axf-merge" style={{ position: 'absolute', inset: 0, background: A.border, display: 'grid', gridTemplateColumns: 'clamp(300px, 27%, 396px) 1fr', gap: AX_FILET }}>
      {/* ── Colonne gauche : objectif (rempli) + composition fantôme ── */}
      <div className="axf-col-left" style={{ display: 'grid', gridTemplateRows: '0.98fr 1.02fr', gap: AX_FILET, background: A.border, minWidth: 0, minHeight: 0 }}>
        <div style={{ ...cell, padding: '26px 28px', justifyContent: 'center', gap: 'var(--crm-space-3xl)' }}>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: A.muted }}>{tr('analytics.firstrun.objectiveEyebrow')}</div>
          <div style={{ fontSize: 'clamp(28px, 2.3vw, 42px)', fontWeight: 600, letterSpacing: -1.4, color: A.ink, lineHeight: 0.98, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{target > 0 ? axCHF(target) : '—'}</div>
          {target > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-xs) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: A.pillAhead.bg, color: A.pillAhead.fg, boxShadow: A.pillAhead.sh, fontSize: 'var(--crm-text-md)', fontWeight: 600, width: 'max-content' }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13l5 5 11-12" /></svg>
              {tr('analytics.firstrun.objectiveSet')}
            </span>
          )}
          <div style={cap}>
            {tr('analytics.firstrun.objectiveCaption')}
            {onGoSettings && (
              <>{' '}<button onClick={onGoSettings} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: A.accText, textDecoration: 'underline', textUnderlineOffset: 2 }}>{tr('analytics.hero.modify')}</button></>
            )}
          </div>
        </div>
        <div style={{ ...cell, padding: 'var(--crm-space-4xl) var(--crm-space-6xl) var(--crm-space-4xl)' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: A.ink, letterSpacing: -0.3, flexShrink: 0 }}>{tr('analytics.composition.title')}</h3>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 14 }}>
            <div style={{ flex: 58, background: ghost, borderRadius: 'var(--crm-radius-lg)', minHeight: 34 }} />
            <div style={{ flex: 28, background: ghost, borderRadius: 'var(--crm-radius-lg)', minHeight: 26, opacity: 0.72 }} />
            <div style={{ flex: 14, background: ghost, borderRadius: 'var(--crm-radius-lg)', minHeight: 20, opacity: 0.45 }} />
          </div>
          <div style={{ ...cap, marginTop: 12, flexShrink: 0 }}>{tr('analytics.firstrun.compositionCaption')}</div>
        </div>
      </div>

      {/* ── Colonne droite : trajectoire (objectif allumé) + silhouettes ── */}
      <div className="axf-col-right" style={{ display: 'grid', gridTemplateRows: '1.9fr 1fr', gap: AX_FILET, background: A.border, minWidth: 0, minHeight: 0 }}>
        <div className="axf-cell-chart" style={{ ...cell, padding: '20px 26px 14px' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: A.ink, letterSpacing: -0.3, flexShrink: 0 }}>{tr('analytics.chart.title')}</h3>
          <div style={{ flex: 1, minHeight: 0, position: 'relative', marginTop: 8 }}>
            <svg viewBox="0 0 1000 380" width="100%" height="100%" preserveAspectRatio="none" style={{ animation: 'axRise .5s cubic-bezier(.2,.8,.2,1) both' }}>
              <path d="M 22 346 L 978 34" fill="none" stroke={A.goal} strokeWidth="2" strokeDasharray="3 6" strokeLinecap="round" />
              <text x="976" y="22" textAnchor="end" fontSize="12" fontWeight="600" fill={A.muted}>{tr('analytics.trajectory.objectiveShort', { amount: axShort(target) })}</text>
              <circle cx="22" cy="346" r="11" fill={acc.accent} opacity="0.2" />
              <circle cx="22" cy="346" r="6" fill={acc.accent} />
              <text x="40" y="336" fontSize="12.5" fontWeight="600" fill={A.inkSoft}>{tr('analytics.firstrun.trajectoryStart')}</text>
            </svg>
          </div>
        </div>
        <div className="axf-strip" style={{ display: 'grid', gridTemplateColumns: '1.42fr 1.05fr', gap: AX_FILET, background: A.border, minWidth: 0, minHeight: 0 }}>
          <div style={{ ...cell, padding: 'var(--crm-space-4xl) var(--crm-space-6xl) var(--crm-space-4xl)' }}>
            <h3 style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: A.ink, letterSpacing: -0.3, flexShrink: 0 }}>{tr('analytics.sources.commissionTitle')}</h3>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'flex-end', gap: 'var(--crm-space-2xl)', paddingTop: 'var(--crm-space-xl)' }}>
              {[100, 68, 44, 27, 15].map((h, i) => (
                <div key={i} style={{ flex: 1, height: `${h}%`, background: ghost, borderRadius: 'var(--crm-radius-md)', opacity: 1 - i * 0.14 }} />
              ))}
            </div>
            <div style={{ ...cap, marginTop: 12, flexShrink: 0 }}>{tr('analytics.firstrun.sourcesCaption')}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: AX_FILET, background: A.border, minWidth: 0, minHeight: 0 }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ background: A.card, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
                <div style={{ width: '55%', height: 9, borderRadius: 'var(--crm-radius-pill)', background: ghost }} />
                <div style={{ width: '72%', height: 16, borderRadius: 'var(--crm-radius-pill)', background: ghost, opacity: 0.72 }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
