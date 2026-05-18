// MEGGA CRM Sugar v2 — Parcours équipe (Tier 3.h)
// 1:1 port from the Claude Design bundle (`crm-screen-parcours-sugar.jsx`).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { PCDossierFrame } from '@/components/crm-sugar/parcours/PCDossierFrame'
import { PCFilters } from '@/components/crm-sugar/parcours/PCFilters'
import {
  type ParcoursTask,
  type StageId,
  type Urgency,
} from '@/components/crm-sugar/parcours/parcoursData'
import { useParcoursSugar } from '@/hooks/useParcoursSugar'

const DARK_TONE: DarkTone = 'meggaAi'

export default function ParcoursSugarV2Page() {
  const navigate = useNavigate()

  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  // Source de vérité : transactions actives Supabase (1 dossier = 1 transaction)
  // Équipe agence + tâches granulaires restent dérivés heuristiquement (chantier RBAC séparé).
  const { dossiers: liveDossiers } = useParcoursSugar()

  const [agentFilter, setAgentFilter] = useState<string>('all')
  const [stageFilter, setStageFilter] = useState<StageId | 'all'>('all')
  const [urgencyFilter, setUrgencyFilter] = useState<Urgency | 'all'>('all')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2000)
    return () => window.clearTimeout(id)
  }, [toast])

  const dossiers = useMemo(() => {
    return liveDossiers.filter(d => {
      if (urgencyFilter !== 'all' && d.urgency !== urgencyFilter) return false
      if (stageFilter !== 'all' && d.stageActive !== stageFilter) return false
      if (agentFilter !== 'all') {
        const has =
          d.team.some(m => m.agentId === agentFilter) ||
          Object.values(d.columns).some(arr =>
            arr.some(task => task.agentId === agentFilter),
          )
        if (!has) return false
      }
      return true
    })
  }, [liveDossiers, agentFilter, stageFilter, urgencyFilter])

  const onCmd = () => {
    /* placeholder */
  }

  const onNavigate = (id: SugarScreenId | string) => {
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
      case 'docs':
        navigate('/dashboard/documents'); break
      case 'inbox': navigate('/dashboard/inbox'); break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'reseau':
        navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien':
        navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      default:
    }
  }

  const handleTaskClick = (task: ParcoursTask) => {
    setToast(`Tâche ouverte — ${task.label}`)
  }

  return (
    <div
      style={{
        background: sp.pageBg,
        minHeight: '100vh',
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <style>{`
        @keyframes pc-toast {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <SugarTopNav
        active="parcours"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
      />

      <div style={{ display: 'flex' }}>
        <SugarIconRail
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
                fontSize: 38,
                fontWeight: 800,
                letterSpacing: -1.2,
                color: sp.ink,
                lineHeight: 1,
              }}
            >
              Parcours équipe
            </h1>
            <span
              style={{
                fontSize: 13,
                color: sp.sub,
                fontWeight: 500,
                marginLeft: 6,
              }}
            >
              Suivi temps réel de chaque dossier · vue panoramique
            </span>
          </div>

          {/* Filters */}
          <div style={{ marginBottom: 28 }}>
            <PCFilters
              sp={sp}
              dark={dark}
              agentFilter={agentFilter}
              setAgentFilter={setAgentFilter}
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
                  fontSize: 14,
                  fontWeight: 500,
                }}
              >
                Aucun dossier ne correspond aux filtres choisis.
              </div>
            ) : (
              dossiers.map(d => (
                <PCDossierFrame
                  key={d.id}
                  dossier={d}
                  sp={sp}
                  dark={dark}
                  onTaskClick={handleTaskClick}
                />
              ))
            )}
          </div>
        </main>
      </div>

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 28,
            left: '50%',
            transform: 'translateX(-50%)',
            background: sp.focusBg,
            color: sp.focusInk,
            padding: '10px 18px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: sp.focusShadow,
            animation: 'pc-toast 220ms cubic-bezier(.22,1,.36,1)',
            zIndex: 50,
          }}
        >
          {toast}
        </div>
      )}
    </div>
  )
}
