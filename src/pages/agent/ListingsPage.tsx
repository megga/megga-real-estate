// MEGGA CRM — Mes biens (design final : pager plein écran)
// Port du handoff Claude Design (crm-screen-biens-proto.jsx). La page « Mes
// biens » adopte l'architecture bento des autres surfaces CRM (Today / Contacts /
// Matching) : un pager vertical à deux pages —
//   Page 0 « Galerie »  (recherche · statut · tri · grille/liste)
//   Page 1 « À suivre »  (mandats à renouveler · brouillons · [diffusion dormante])
// Données réelles via useListingsScreen (RLS agency-scopée). Wizard « Créer un bien »
// embarqué dans le bento ; « Finir/Compléter » ouvre l'édition en place.

import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { crmPalette } from '@/components/crm/tokens'
import type { CrmBien } from '@/components/crm/mockData'
import { mxSurfaces } from '@/components/crm/biens/gallery/galHelpers'
import { useListingsScreen } from '@/hooks/useListingsScreen'
import { CrmTopNav, CrmIconRail, CRM_KEYFRAMES, type CrmScreenId } from '@/components/crm/CrmShell'
import { BiensPager } from '@/components/crm/biens/pager/BiensPager'
import WizardShell from '@/components/crm-wizard/WizardShell'
import { CRM_DARK_KEY, readCrmDark } from '@/lib/crmDark'

export default function ListingsPage() {
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
  const surf = mxSurfaces(sp)

  // Source de vérité : Supabase via useListingsScreen (RLS agency-scopée).
  const { biens, isLoading, isError, refetch } = useListingsScreen()
  // Stable pour la fenêtre d'échéance des mandats (évite le churn de recalcul).
  const now = useMemo(() => new Date(), [])
  // Compte neuf : aucune donnée après chargement → couverture premier lancement.
  const fresh = !isLoading && !isError && biens.length === 0

  const [wizardOpen, setWizardOpen] = useState(false)

  const onCmd = () => { /* placeholder command palette */ }
  const onNavigate = (id: CrmScreenId | string) => {
    switch (id) {
      case 'today': navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': navigate('/dashboard/contacts'); break
      case 'biens': break
      case 'biens-new': setWizardOpen(true); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'messagerie': navigate('/dashboard/messagerie'); break
      case 'kyc': navigate('/dashboard/kyc'); break
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
      <style>{CRM_KEYFRAMES}</style>
      <CrmTopNav active="biens" sp={sp} onNavigate={onNavigate} dark={dark} />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <CrmIconRail active="biens" onNavigate={onNavigate} onCmd={onCmd} dark={dark} setDark={setDark} sp={sp} />
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
