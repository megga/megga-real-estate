// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — App composer
// Port pixel-près de sprint-4/crm-dashboard-shell.jsx → DashboardApp.
//
// Compose la barre de contexte + les 3 onglets (Cockpit / Entonnoir / Objectif)
// + l'animation de refresh + le toast de confirmation.
// La page conteneur (DashboardSugarV4Page) gère le shell Sugar autour.

import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DB_SP, DB_KEYFRAMES } from './tokens'
import './responsive.css'
import {
  CK_DATA,
  ckMapPeriod,
  getDashboardData,
  type DashboardData,
  type DecompStage,
  type PeriodKey,
  type ScopeKey,
} from './data'
import { useDashboardFunnel } from '@/hooks/useDashboardFunnel'
import { DBContextBar, type DashboardTab } from './Shell'
import { DBCockpit } from './DBCockpit'
import { DBEntonnoir } from './DBEntonnoir'
import { DBObjectif } from './DBObjectif'
import { OnboardingChecklist } from './OnboardingChecklist'
import { useDashboardAudit } from './useDashboardAudit'

interface DashboardAppProps {
  /** `true` quand la page est embeddée sous une barre de nav (top 64). */
  embedded?: boolean
}

export function DashboardApp({ embedded = true }: DashboardAppProps) {
  const navigate = useNavigate()
  const audit = useDashboardAudit()
  const [period, setPeriod] = useState<PeriodKey>('month')
  const [scope, setScope] = useState<ScopeKey>('me')
  const [tab, setTab] = useState<DashboardTab>('cockpit')
  const [refreshing, setRefreshing] = useState(false)
  const [toast, setToast] = useState(false)
  const [exportToast, setExportToast] = useState(false)

  // Funnel + sources + forecast live (Sprint B) — fallback fixture pendant load
  const funnelLive = useDashboardFunnel(period, scope)
  const data = useMemo<DashboardData>(() => {
    const fixture = getDashboardData(period, scope)
    if (funnelLive.isLoading) return fixture
    return {
      ...fixture,
      funnel: funnelLive.funnel.length > 0 ? funnelLive.funnel : fixture.funnel,
      sources: funnelLive.sources.length > 0 ? funnelLive.sources : fixture.sources,
      forecast: funnelLive.forecast,
      compareLabel: funnelLive.compareLabel || fixture.compareLabel,
    }
  }, [period, scope, funnelLive])

  const triggerRefresh = () => {
    if (refreshing) return
    setRefreshing(true)
    window.setTimeout(() => {
      setRefreshing(false)
      setToast(true)
      window.setTimeout(() => setToast(false), 1800)
    }, 1200)
  }

  const triggerExportPdf = () => {
    // Stub : export PDF post-launch (cf. handoff §"Export PDF : bouton stub").
    setExportToast(true)
    window.setTimeout(() => setExportToast(false), 2400)
  }

  // Drilldowns Cockpit → Pipeline filtré par stage(s).
  // Les IDs ci-dessous viennent de CRM_STAGES (src/components/crm-sugar/tokens.ts).
  // La Sugar V2 a fusionné "compromis" et "interest-confirmed" en un seul stade.
  const handleDrilldownStage = (id: DecompStage['id']) => {
    const stageMap: Record<DecompStage['id'], string[]> = {
      signed: ['signed'],
      compromis: ['interest-confirmed'],
      offres: ['offer'],
      pipeline: ['visit-scheduled', 'visit-done'],
    }
    navigate(`/dashboard/pipeline?stage=${stageMap[id].join(',')}`)
  }
  const handleDrilldownVital = (id: string) => {
    if (id === 'kyc') navigate('/dashboard/kyc?risk=high')
    else if (id === 'conversion') setTab('entonnoir')
    else navigate('/dashboard/pipeline')
  }
  const handleCoachCta = () => {
    // AuditEvent (c) : clic CTA IA Coach — handoff DoD.
    const ai = CK_DATA[ckMapPeriod(period)]?.aiHint
    audit('coach-cta-clicked', ai?.title, { period, cta: ai?.cta })
    // Stub : v1 ouvre le modal Visite (lien Sprint 2)
    navigate('/dashboard/visites/nouveau')
  }

  // Drilldown source de leads → Contacts filtrés (handoff §"Polish Entonnoir").
  const handleSourceClick = (slug: string) => {
    navigate(`/dashboard/contacts?source=${encodeURIComponent(slug)}`)
  }

  // Drilldown horizon forecast → Pipeline trié par close date (≤ N jours).
  const handleHorizonClick = (days: number) => {
    navigate(`/dashboard/pipeline?sort=closeDate&closeWithin=${days}`)
  }

  return (
    <div style={{ minHeight: embedded ? 'auto' : '100vh', paddingBottom: 24 }}>
      <style>{DB_KEYFRAMES}</style>

      <DBContextBar
        period={period}
        setPeriod={setPeriod}
        scope={scope}
        setScope={setScope}
        tab={tab}
        setTab={setTab}
        embedded={embedded}
        refreshing={refreshing}
        onRefresh={triggerRefresh}
        onExportPdf={triggerExportPdf}
      />

      <div
        style={{
          paddingTop: 24,
          filter: refreshing ? 'saturate(0.55)' : 'none',
          animation: refreshing ? 'dbRefreshPulse 1.2s ease-in-out infinite' : 'none',
          pointerEvents: refreshing ? 'none' : 'auto',
          userSelect: refreshing ? 'none' : 'auto',
          transition: 'filter .35s ease, opacity .35s ease',
        }}
      >
        {tab === 'cockpit' && (
          <section
            style={{
              maxWidth: 1320,
              margin: '0 auto 16px',
              padding: '0 32px',
            }}
          >
            <OnboardingChecklist
              onStepCta={(step) => {
                // AuditEvent — l'agent a cliqué une étape d'onboarding.
                audit('nudge-cta-clicked', `Onboarding · ${step.title}`, {
                  stepId: step.id,
                  ctaPath: step.ctaPath,
                })
                navigate(step.ctaPath)
              }}
            />
          </section>
        )}
        {tab === 'cockpit' && (
          <DBCockpit
            period={period}
            scope={scope}
            onDrilldownStage={handleDrilldownStage}
            onDrilldownVital={handleDrilldownVital}
            onCoachCta={handleCoachCta}
          />
        )}
        {tab === 'entonnoir' && (
          <DBEntonnoir
            data={data}
            onSourceClick={handleSourceClick}
            onHorizonClick={handleHorizonClick}
          />
        )}
        {tab === 'objectif' && <DBObjectif period={period} />}
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            background: DB_SP.black,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: -0.1,
            padding: '10px 14px',
            borderRadius: 999,
            boxShadow:
              '0 16px 40px rgba(11,12,14,0.28), 0 4px 12px rgba(11,12,14,0.18)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'dbToastIn .3s cubic-bezier(.2,.8,.2,1) both',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: DB_SP.ok,
              boxShadow: `0 0 0 3px ${DB_SP.ok}33`,
            }}
          />
          Données à jour · à l'instant
        </div>
      )}

      {exportToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 200,
            background: DB_SP.black,
            color: '#fff',
            fontSize: 12,
            fontWeight: 600,
            letterSpacing: -0.1,
            padding: '10px 14px',
            borderRadius: 999,
            boxShadow:
              '0 16px 40px rgba(11,12,14,0.28), 0 4px 12px rgba(11,12,14,0.18)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            animation: 'dbToastIn .3s cubic-bezier(.2,.8,.2,1) both',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: 999,
              background: DB_SP.warn,
              boxShadow: `0 0 0 3px ${DB_SP.warn}33`,
            }}
          />
          Export PDF · bientôt disponible
        </div>
      )}
    </div>
  )
}
