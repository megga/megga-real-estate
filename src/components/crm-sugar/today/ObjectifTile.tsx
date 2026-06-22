// MEGGA CRM — Refonte « Aujourd'hui » · Tuile « Objectif » (câblée)
// ----------------------------------------------------------------------------
// Visuel porté 1:1 de `today-proto-objectif.jsx` (demi-jauge speedometer) ;
// données CÂBLÉES sur le Cockpit Commission live (mêmes 3 RPC analytics que la
// page Analytics, scope agent 'me' / période 'year'). Mirror du compute prouvé
// dans AxDashboard : projeté/réalisé/cible + projPct (axPace).
// Honnêteté : si l'agence n'a pas saisi d'objectif → état « non défini » (pas de
// fausse jauge). Fallback démo (prototype) quand aucune donnée live (session non
// authentifiée / agence absente).

import { useTranslation } from 'react-i18next'
import { TK } from './tk'
import { DATA, fmtCHF } from './data'
import { useAxDashboardData } from '@/hooks/useAxDashboardData'
import { axPace } from '@/components/crm-sugar/analytics/tokens'

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

export function ObjectifTile({ demo = false }: { demo?: boolean } = {}) {
  const { t } = useTranslation('dashboard')
  const { data: d, isError } = useAxDashboardData('year', 'me')
  const seed = DATA.objectif
  // Agent réel → données live (même partielles) ; le seed démo ne sert que derrière
  // `demo`. Réel sans donnée (chargement / agence sans objectif) → « non défini »,
  // jamais le seed.
  const live = !demo && !!d
  const targetIsSet = live ? (d!.targetIsSet ?? d!.target > 0) : demo
  const noTarget = !targetIsSet

  const objectif = live ? d!.target : demo ? seed.objectif : 0
  const realise = live ? d!.realizedNow : demo ? seed.realise : 0
  const projete = live ? d!.projectedEnd : demo ? seed.projete : 0
  // % projeté de l'objectif (jauge). 0 si pas d'objectif saisi (pas de fausse aiguille).
  const pct = noTarget ? 0 : live ? axPace(d!).projPct : seed.pct
  const pctClamped = Math.max(0, Math.min(100, pct))

  const W = 216, cx = 108, cy = 112, r = 86
  const a0 = 180
  const ang = (fr: number) => a0 + (fr / 100) * 180 // 180°→360° via le haut
  const [nx, ny] = objPol(cx, cy, r - 13, ang(pctClamped))
  const ticks = [0, 25, 50, 75, 100]
  const [mx1, my1] = objPol(cx, cy, r + 8, ang(100))
  const [mx2, my2] = objPol(cx, cy, r - 8, ang(100))

  if (!demo && isError && !d) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 12px' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: TK.ink }}>{t('today.objectif.error.title')}</div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 0 }}>
        <svg width={W} height={124} viewBox={`0 0 ${W} 124`} style={{ display: 'block' }}>
          {/* piste */}
          <path d={objArc(cx, cy, r, a0, 360)} fill="none" stroke={TK.cardHi} strokeWidth="13" strokeLinecap="round" />
          {/* secteur manquant (projeté → cible) en warn discret — masqué si pas d'objectif */}
          {!noTarget && <path d={objArc(cx, cy, r, ang(pctClamped), 360)} fill="none" stroke="#E08A4566" strokeWidth="13" strokeLinecap="round" />}
          {/* remplissage projeté */}
          {!noTarget && <path d={objArc(cx, cy, r, a0, ang(pctClamped))} fill="none" stroke="#424bfb" strokeWidth="13" strokeLinecap="round" />}
          {/* graduations */}
          {ticks.map((t) => {
            const [x1, y1] = objPol(cx, cy, r - 20, ang(t))
            const [x2, y2] = objPol(cx, cy, r - 27, ang(t))
            return <line key={t} x1={x1} y1={y1} x2={x2} y2={y2} stroke={TK.sub} strokeWidth="1.4" />
          })}
          {/* repère rythme (cible) */}
          {!noTarget && <line x1={mx1} y1={my1} x2={mx2} y2={my2} stroke="#F2B855" strokeWidth="2.5" strokeLinecap="round" />}
          {/* aiguille */}
          <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={TK.ink} strokeWidth="3.2" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="6.5" fill={TK.ink} />
          <circle cx={cx} cy={cy} r="2.6" fill={TK.frameHi} />
        </svg>
        <div style={{ textAlign: 'center', marginTop: 4 }}>
          {noTarget ? (
            <>
              <div style={{ fontSize: 23, fontWeight: 800, color: TK.ink, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtCHF(realise)}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: TK.sub, marginTop: 2 }}>{t('today.objectif.realizedNoTarget')}</div>
            </>
          ) : (
            <div style={{ fontSize: 23, fontWeight: 800, color: TK.ink, letterSpacing: -0.8, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtCHF(projete)}</div>
          )}
        </div>
      </div>
      {/* pied : réalisé / cible */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: 12, borderTop: `1px solid ${TK.border}` }}>
        <div><div style={{ fontSize: 13.5, fontWeight: 800, color: TK.ink, fontVariantNumeric: 'tabular-nums' }}>{fmtCHF(realise).replace('CHF ', '')}</div><div style={{ fontSize: 10, color: TK.sub }}>{t('today.objectif.realized')}</div></div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: TK.inkDim, fontVariantNumeric: 'tabular-nums' }}>{noTarget ? '—' : fmtCHF(objectif).replace('CHF ', '')}</div>
          <div style={{ fontSize: 10, color: TK.sub }}>{t('today.objectif.target')}</div>
        </div>
      </div>
    </div>
  )
}
