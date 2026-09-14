// MEGGA CRM — Parcours équipe (Tier 3.h)
// 1:1 port from the Claude Design bundle (`crm-screen-journey-screen.jsx`).

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { crmPalette } from '@/components/crm/tokens'
import { CRM_KEYFRAMES } from '@/components/crm/CrmShell'
import CrmWorkspace from '@/components/crm/CrmWorkspace'
import EtatVide from '@/components/crm/EtatVide'
import { PCDossierFrame } from '@/components/crm/journey/PCDossierFrame'
import { PCFilters } from '@/components/crm/journey/PCFilters'
import {
  type StageId,
  type Urgency,
} from '@/components/crm/journey/journeyData'
import { useJourneyScreen } from '@/hooks/useJourneyScreen'
import { useTabScopedState } from '@/hooks/useCrmTabs'
import { useCrmDarkPref } from '@/lib/crmDark'

export default function JourneyPage() {
  const { t: tr } = useTranslation('pipeline')
  const navigate = useNavigate()

  const [dark, setDark] = useCrmDarkPref()

  const sp = crmPalette(dark)

  // Source de vérité : transactions actives Supabase (1 dossier = 1 transaction).
  // Filtre Agent retiré (pas de table profiles/teammates wire) — réintroduit avec RBAC.
  const { dossiers: liveDossiers, isLoading, isError, refetch } = useJourneyScreen()

  // Les deux filtres de la liste : position d'écran, portée par l'onglet.
  const [stageFilter, setStageFilter] = useTabScopedState<StageId | 'all'>('filtreEtape', 'all')
  const [urgencyFilter, setUrgencyFilter] = useTabScopedState<Urgency | 'all'>('filtreUrgence', 'all')

  const dossiers = useMemo(() => {
    return liveDossiers.filter(d => {
      if (urgencyFilter !== 'all' && d.urgency !== urgencyFilter) return false
      if (stageFilter !== 'all' && d.stageActive !== stageFilter) return false
      return true
    })
  }, [liveDossiers, stageFilter, urgencyFilter])

  const filtre = stageFilter !== 'all' || urgencyFilter !== 'all'

  return (
    <div
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

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmWorkspace active="parcours" sp={sp} dark={dark} setDark={setDark}>
        {/* ⚠ Le CADRE BENTO des pages sœurs (Analytics, Réglages, KYC…). Le Parcours
            posait son contenu à même le canvas, à 12 px de la barre latérale : son
            titre et ses filtres touchaient la gouttière, et la languette de repli de
            la barre venait mordre sur la rangée « Stade ». */}
        <main style={{ flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingTop: 'var(--crm-space-lg)', paddingLeft: 'var(--crm-space-lg)', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)' }}>
          <div style={{ position: 'relative', height: '100%', borderRadius: 26, overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow, background: sp.pageBg }}>
            <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', padding: 'var(--crm-space-7xl)' }}>
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
                {/* Trois raisons d'une liste vide, trois phrases. « Aucun dossier ne
                    correspond aux filtres choisis » s'affichait SANS filtre, et en cas
                    d'échec de chargement. */}
                {isError ? (
                  <EtatVide
                    dark={dark}
                    registre="erreur"
                    titre={tr('journey.errorTitle')}
                    corps={tr('journey.errorDesc')}
                    action={{ libelle: tr('journey.retry'), onClick: refetch }}
                  />
                ) : isLoading ? null : dossiers.length === 0 ? (
                  filtre ? (
                    <EtatVide
                      dark={dark}
                      titre={tr('journey.emptyState')}
                      action={{ libelle: tr('journey.resetFilters'), onClick: () => { setStageFilter('all'); setUrgencyFilter('all') } }}
                    />
                  ) : (
                    <EtatVide dark={dark} titre={tr('journey.emptyAllTitle')} corps={tr('journey.emptyAllDesc')} />
                  )
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
            </div>
          </div>
        </main>
        </CrmWorkspace>
      </div>
    </div>
  )
}
