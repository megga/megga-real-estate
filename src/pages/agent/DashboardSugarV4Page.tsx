// MEGGA CRM Sugar — Dashboard Analytics « Le Cockpit Commission »
// Port du handoff Claude Design `design_handoff_analytics_dashboard` : commission
// projetée, trajectoire vers l'objectif, KPI, deals à signer, composition du
// projeté, sources des deals, drawer de drill-down. 2 thèmes, 3 périodes.
//
// La page est wrappée par AgentSugarLayout (cf. App.tsx). Elle fournit son propre
// chrome Sugar (SugarTopNav + SugarIconRail) comme les autres pages V3/V4 et
// embarque AxDashboardBody via le provider de thème analytics (AXCtx).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import AxDashboardBody from '@/components/crm-sugar/analytics/AxDashboard'
import { AXCtx, AX, AX_DARK } from '@/components/crm-sugar/analytics/tokens'

const DARK_TONE: DarkTone = 'meggaAi'

export default function DashboardSugarV4Page() {
  const navigate = useNavigate()
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('megga.sugar.dark') === '1'
  })
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = useMemo(() => crmSugarPalette(t, dark, DARK_TONE), [t, dark])
  const axTheme = dark ? AX_DARK : AX

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':
        navigate('/dashboard')
        break
      case 'pipeline':
        navigate('/dashboard/pipeline')
        break
      case 'contacts':
        navigate('/dashboard/contacts')
        break
      case 'biens':
        navigate('/dashboard/listings')
        break
      case 'kyc':
        navigate('/dashboard/kyc')
        break
      case 'audit':
        navigate('/dashboard/audit')
        break
      case 'calendar':
        navigate('/dashboard/calendar')
        break
      case 'matching':
        navigate('/dashboard/matching')
        break
      case 'parcours':
        navigate('/dashboard/journey')
        break
      case 'ai':
      case 'julien':
        navigate('/dashboard/julien')
        break
      case 'settings':
        navigate('/dashboard/settings')
        break
      case 'dashboard':
        // Already on dashboard
        break
      case 'biens-new':
        navigate('/dashboard/listings/new')
        break
      case 'reseau':
        navigate('/dashboard/network')
        break
      default:
    }
  }
  const onCmd = () => {}

  return (
    <div
      data-screen-label="CRM Dashboard Analytics (cockpit commission)"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: sp.pageBg,
        fontFamily: "'Manrope', system-ui, sans-serif",
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>

      <SugarTopNav
        active={'today' as SugarScreenId}
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', minHeight: 'calc(100vh - 0px)' }}>
        <SugarIconRail
          active="dashboard"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main
          className="sg-main-padded"
          style={{ flex: 1, minWidth: 0, padding: '30px 48px 96px' }}
        >
          <AXCtx.Provider value={axTheme}>
            <AxDashboardBody embedded dark={dark} setDark={setDark} onNavigate={onNavigate} />
          </AXCtx.Provider>
        </main>
      </div>
    </div>
  )
}
