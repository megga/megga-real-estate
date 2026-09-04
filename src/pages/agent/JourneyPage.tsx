// MEGGA CRM — Parcours équipe (Tier 3.h)
// 1:1 port from the Claude Design bundle (`crm-screen-journey-screen.jsx`).

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { crmPalette } from '@/components/crm/tokens'
import {
  CrmTopNav, CrmIconRail, CRM_KEYFRAMES, type CrmScreenId,
} from '@/components/crm/CrmShell'
import { PCDossierFrame } from '@/components/crm/journey/PCDossierFrame'
import { PCFilters } from '@/components/crm/journey/PCFilters'
import {
  type StageId,
  type Urgency,
} from '@/components/crm/journey/journeyData'
import { useJourneyScreen } from '@/hooks/useJourneyScreen'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'

export default function JourneyPage() {
  const { t: tr } = useTranslation('pipeline')
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return readCrmDark()
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CRM_DARK_KEY, dark ? '1' : '0')
    }
  }, [dark])

  const sp = crmPalette(dark)

  // Source de vérité : transactions actives Supabase (1 dossier = 1 transaction).
  // Filtre Agent retiré (pas de table profiles/teammates wire) — réintroduit avec RBAC.
  const { dossiers: liveDossiers } = useJourneyScreen()

  const [stageFilter, setStageFilter] = useState<StageId | 'all'>('all')
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all')

  const dossiers = useMemo(() => {
    return liveDossiers.filter(d => {
      if (urgencyFilter !== 'all' && d.urgency !== urgencyFilter) return false
      if (stageFilter !== 'all' && d.stageActive !== stageFilter) return false
      return true
    })
  }, [liveDossiers, stageFilter, urgencyFilter])

  const onCmd = () => {
    /* placeholder */
  }

  const onNavigate = (id: CrmScreenId | string) => {
    switch (id) {
      case 'today':
        navigate('/dashboard'); break
      case 'pipeline':
        navigate('/dashboard/pipeline'); break
      case 'matching':
        navigate('/dashboard/matching'); break
      case 'contacts':
        navigate('/dashboard/contacts'); break
      case 'biens':
        navigate('/dashboard/listings'); break
      case 'biens-new':
        navigate('/dashboard/listings/new'); break
      case 'parcours':
        break
      case 'calendar':
        navigate('/dashboard/calendar'); break
      case 'messagerie':
        navigate('/dashboard/messagerie'); break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      default:
    }
  }

  return (
    <div
      style={{
        background: sp.pageBg,
        minHeight: '100vh',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{CRM_KEYFRAMES}</style>
      <CrmTopNav
        active="parcours"
       
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex' }}>
        <CrmIconRail
          active="parcours"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />
        <main
          style={{
            flex: 1,
            padding: '32px 40px 80px 0',
            minWidth: 0,
          }}
        >
          {/* Page title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginBottom: 22,
              flexWrap: 'wrap',
            }}
          >
            <h1
              style={{
                margin: 0,
                fontSize: 'var(--crm-text-9xl)',
                fontWeight: 600,
                letterSpacing: -1.2,
                color: sp.ink,
                lineHeight: 1,
              }}
            >
              {tr('journey.title')}
            </h1>
            <span
              style={{
                fontSize: 'var(--crm-text-md)',
                color: sp.sub,
                fontWeight: 500,
                marginLeft: 6,
              }}
            >
              {tr('journey.subtitle')}
            </span>
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 28 }}>
            <PCFilters
              sp={sp}
              dark={dark}
              stageFilter={stageFilter}
              setStageFilter={setStageFilter}
              urgencyFilter={urgencyFilter}
              setUrgencyFilter={setUrgencyFilter}
              count={dossiers.length}
            />
          </div>

          {/* Dossiers list */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 22,
            }}
          >
            {dossiers.length === 0 ? (
              <div
                style={{
                  padding: '60px 20px',
                  textAlign: 'center',
                  background: sp.frameBg,
                  border: `1px solid ${sp.frameBorder}`,
                  borderRadius: 24,
                  color: sp.sub,
                  fontSize: 'var(--crm-text-lg)',
                  fontWeight: 500,
                }}
              >
                {tr('journey.emptyState')}
              </div>
            ) : (
              dossiers.map(d => (
                <PCDossierFrame
                  key={d.id}
                  dossier={d}
                  sp={sp}
                  dark={dark}
                  onTaskClick={() => navigate(`/dashboard/transactions/${d.id}`)}
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
