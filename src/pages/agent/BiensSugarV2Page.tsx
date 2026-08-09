// MEGGA CRM Sugar v2 — Mes biens (design final : pager plein écran)
// Port du handoff Claude Design (crm-screen-biens-proto.jsx). La page « Mes
// biens » adopte l'architecture bento des autres surfaces CRM (Today / Contacts /
// Matching) : un pager vertical à deux pages —
//   Page 0 « Galerie »  (recherche · statut · tri · grille/liste)
//   Page 1 « À suivre »  (mandats à renouveler · brouillons · [diffusion dormante])
// Données réelles via useBiensSugar (RLS agency-scopée). Wizard « Créer un bien »
// embarqué dans le bento ; « Finir/Compléter » ouvre l'édition en place.

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import type { CrmBien } from '@/components/crm-sugar/mockData'
import { mxSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import { SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { BiensPager } from '@/components/crm-sugar/biens/pager/BiensPager'
import WizardShell from '@/components/crm-sugar-wizard/WizardShell'

export default function BiensSugarV2Page() {
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

  const sp = crmSugarPalette(dark)
  const surf = mxSurfaces(sp)

  // Source de vérité : Supabase via useBiensSugar (RLS agency-scopée).
  const { biens, isLoading, isError, refetch } = useBiensSugar()
  // Stable pour la fenêtre d'échéance des mandats (évite le churn de recalcul).
  const now = useMemo(() => new Date(), [])
  // Compte neuf : aucune donnée après chargement → couverture premier lancement.
  const fresh = !isLoading && !isError && biens.length === 0

  const [wizardOpen, setWizardOpen] = useState(false)

  const onCmd = () => { /* placeholder command palette */ }
  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': break
      case 'biens-new': setWizardOpen(true); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc': navigate('/dashboard/kyc'); break
      case 'ai':
      case 'julien': navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard': navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default: /* no-op */
    }
  }

  const onOpenBien = (bienId: string) => navigate(`/dashboard/listings/${bienId}`)
  // Reprise de brouillon → surface d'édition en place (édite le bien existant,
  // jamais de doublon), plutôt qu'un ré-amorçage du wizard.
  const onResumeDraft = (b: CrmBien) => navigate(`/dashboard/listings/${b.id}/edit`)

  return (
    <div
      style={{
        position: 'relative',
        background: sp.pageBg,
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <SugarTopNav active="biens" sp={sp} onNavigate={onNavigate} dark={dark} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="biens" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
        <BiensPager
          biens={biens}
          sp={sp}
          surf={surf}
          dark={dark}
          now={now}
          fresh={fresh}
          isLoading={isLoading}
          isError={isError}
          refetch={refetch}
          // Diffusion Immobilier.ch dormante : go-live bloqué sur les accès FTP du
          // tiers (agency_syndication_config.idx_enabled). À câbler ici quand le
          // canal s'ouvre (lecture idx_enabled de l'agence).
          idxEnabled={false}
          onOpenBien={onOpenBien}
          onCreate={() => setWizardOpen(true)}
          onResumeDraft={onResumeDraft}
          wizardOpen={wizardOpen}
          wizardSlot={<WizardShell embedded dark={dark} onClose={() => setWizardOpen(false)} />}
        />
      </div>
    </div>
  )
}
