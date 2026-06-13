// MEGGA CRM Sugar v4 — Dashboard Analytics (Sprint 4)
// Port pixel-près du handoff `handoff-sprint-4/` :
//   • Cockpit V2 — Vitals reconstruits (hero adaptatif 4 tons + 4 cartes
//     décompo + stats supports + coach IA)
//   • Entonnoir — Funnel 5 paliers + bottleneck IA (session de relance) +
//     sources de leads + forecast 30/60/90j
//   • Objectif V2 — Cône d'incertitude (graph SVG) + scénarios + leviers +
//     jalons + nudges
//
// La page est wrappée par AgentSugarLayout (cf. App.tsx). Elle fournit son
// propre chrome Sugar (SugarTopNav + SugarIconRail) comme les autres pages
// V3 (AuditSugarPage, ContactDetailSugarV3Page, …).

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import { SugarV3, SUGAR_V3_KEYFRAMES } from '@/components/crm-sugar-v3/tokens'
import { DashboardApp } from '@/components/crm-sugar-v3/dashboard/DashboardApp'

const DARK_TONE: DarkTone = 'meggaAi'

export default function DashboardSugarV4Page() {
  const navigate = useNavigate()
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('megga.sugar.dark') === '1'
  })
  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = useMemo(() => crmSugarPalette(t, dark, DARK_TONE), [t, dark])

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
      data-screen-label="CRM Dashboard Analytics (sugar v4)"
      style={{
        minHeight: '100vh',
        width: '100%',
        background: SugarV3.bgGradient,
        fontFamily: SugarV3.font,
        color: SugarV3.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{SUGAR_V3_KEYFRAMES}</style>

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
          style={{ flex: 1, minWidth: 0, paddingBottom: 80 }}
        >
          <DashboardApp embedded />
        </main>
      </div>
    </div>
  )
}
