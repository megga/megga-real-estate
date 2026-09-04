// MEGGA CRM — Dashboard Analytics « Le Cockpit Commission »
// Port du handoff Claude Design `design_handoff_analytics_dashboard` : commission
// projetée, trajectoire vers l'objectif, KPI, deals à signer, composition du
// projeté, sources des deals, drawer de drill-down. 2 thèmes, 3 périodes.
//
// La page est wrappée par AgentLayout (cf. App.tsx). Elle fournit son propre
// chrome Sugar (CrmTopNav + CrmIconRail) comme les autres pages V3/V4 et
// embarque AxDashboardBody via le provider de thème analytics (AXCtx).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CrmTopNav,
  CrmIconRail,
  CRM_KEYFRAMES,
  type CrmScreenId,
} from '@/components/crm/CrmShell'
import { crmPalette } from '@/components/crm/tokens'
import AxDashboardBody from '@/components/crm/analytics/AxDashboard'
import { AXCtx, AX, AX_DARK } from '@/components/crm/analytics/tokens'
import { readCrmDark } from '@/lib/crmDark'

export default function AnalyticsPage() {
  const navigate = useNavigate()
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return readCrmDark()
  })
  const sp = useMemo(() => crmPalette(dark), [dark])
  const axTheme = dark ? AX_DARK : AX

  const onNavigate = (id: CrmScreenId | string) => {
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
      case 'messagerie':
        navigate('/dashboard/messagerie')
        break
      case 'matching':
        navigate('/dashboard/matching')
        break
      case 'parcours':
        navigate('/dashboard/journey')
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
      default:
    }
  }
  const onCmd = () => {}

  return (
    <div
      data-screen-label="CRM Dashboard Analytics (cockpit commission fusion)"
      style={{
        position: 'relative',
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: sp.pageBg,
        fontFamily: 'var(--crm-font)',
        color: sp.ink,
      }}
    >
      <style>{CRM_KEYFRAMES}</style>

      <CrmTopNav
        active={'today' as CrmScreenId}
       
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmIconRail
          active="dashboard"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />

        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 24, paddingBottom: 22 }}>
          <div style={{ position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg }}>
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', padding: '20px 24px 22px' }}>
              <AXCtx.Provider value={axTheme}>
                <AxDashboardBody embedded dark={dark} setDark={setDark} onNavigate={onNavigate} />
              </AXCtx.Provider>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
