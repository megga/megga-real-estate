// MEGGA CRM Sprint 2 — Vue mobile compagnon visite Sugar Pure
// Port pixel-près de VdMobileCompanion (handoff Sprint 2).
//
// C'est la même app, vue responsive 375px. L'agent ouvre depuis son téléphone
// via /visite/:id/companion (QR ou lien direct). Tout ce qu'il capture est
// synchronisé en temps réel vers le desktop via Supabase Realtime.
//
// Route : /dashboard/visites/:id/companion (auth requise — agent uniquement)

import { useParams } from 'react-router-dom'
import { SugarV3, SUGAR_V3_KEYFRAMES } from '@/components/crm-sugar-v3/tokens'
import { VdMobileCompanion } from '@/components/crm-sugar-v3/visite-detail/VdShared'
import {
  useVisitDetail,
  useVisitRealtime,
} from '@/hooks/useVisitDetail'

export default function VisitCompanionPage() {
  const { id } = useParams<{ id: string }>()
  const { data: visit, isLoading } = useVisitDetail(id)
  useVisitRealtime(id)

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: SugarV3.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: SugarV3.muted,
          fontFamily: SugarV3.font,
        }}
      >
        Chargement…
      </div>
    )
  }
  if (!visit) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: SugarV3.bgGradient,
          display: 'grid',
          placeItems: 'center',
          color: SugarV3.muted,
          fontFamily: SugarV3.font,
        }}
      >
        Visite introuvable.
      </div>
    )
  }

  return (
    <div
      data-screen-label="Visite Compagnon (Sugar v3 · 375px)"
      style={{
        width: '100vw',
        minHeight: '100vh',
        background: SugarV3.bgGradient,
        color: SugarV3.ink,
        fontFamily: SugarV3.font,
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <style>{SUGAR_V3_KEYFRAMES}</style>
      <style>{`
        @keyframes vdPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
      `}</style>
      <VdMobileCompanion visit={visit} framed={false} />
    </div>
  )
}
