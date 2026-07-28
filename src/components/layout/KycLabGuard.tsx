/**
 * Blocage plein de la route /dashboard/kyc (étape 5, tâche 4) — layout-route
 * (Outlet) monté au-dessus de kyc, kyc/bienvenue et kyc/:dossierId dans
 * App.tsx, même motif que AgentSugarLayout (route parente sans path, enfants
 * rendus via <Outlet/>). Remplace le contenu normal par un écran plein qui
 * explique pourquoi, tant que useLabGuard() renvoie un statut bloqué.
 *
 * « Une porte fermée avec un motif lisible vaut mieux qu'un bouton absent » —
 * ce n'est donc pas un simple message d'erreur : trois raisons distinctes
 * (jamais soumis, en attente de revue, rejeté) reçoivent chacune leur propre
 * titre et corps de texte, avec un renvoi vers /dashboard/identite quand
 * l'utilisateur courant (admin/manager) peut lui-même agir.
 *
 * Ne rend JAMAIS le blocage ni le contenu réel tant que le statut n'est pas
 * connu ('loading') — même garde-fou anti-faux-positif que useLabGuard.ts et
 * useIdentityGate.ts (incident P0 c830f9a9).
 *
 * Complément du contrôle serveur (kyc-screening via
 * supabase/functions/_shared/agency-lab-guard.ts), pas le contrôle lui-même :
 * un blocage seulement ici se contournerait en appelant l'edge function
 * directement. Ce composant évite seulement de proposer une action vouée à
 * l'échec.
 */
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, AlertOctagon, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useLabGuard, canActOnLabGuard, type LabGuardStatus } from '@/hooks/useLabGuard'
import { IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'

type BlockedStatus = Exclude<LabGuardStatus, 'loading' | 'clear'>

const SEVERITY: Record<BlockedStatus, { icon: typeof AlertTriangle; color: string }> = {
  blocked_not_submitted: { icon: AlertTriangle, color: 'text-amber-500' },
  blocked_pending_review: { icon: Info, color: 'text-blue-500' },
  blocked_rejected: { icon: AlertOctagon, color: 'text-red-500' },
}

/** État 'loading' — écran neutre, jamais le blocage ni le contenu réel (cf. en-tête du fichier). */
function LoadingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="h-5 w-5 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
    </div>
  )
}

function KycBlockedScreen({ status }: { status: BlockedStatus }) {
  const { t } = useTranslation('onboarding')
  const { profile } = useAuth()
  const navigate = useNavigate()
  const canAct = profile != null && canActOnLabGuard(profile.role)
  const { icon: Icon, color } = SEVERITY[status]

  const eyebrow = status === 'blocked_not_submitted'
    ? t('labGuard.block.notSubmitted.eyebrow')
    : status === 'blocked_pending_review'
      ? t('labGuard.block.pendingReview.eyebrow')
      : t('labGuard.block.rejected.eyebrow')

  const title = status === 'blocked_not_submitted'
    ? t('labGuard.block.notSubmitted.title')
    : status === 'blocked_pending_review'
      ? t('labGuard.block.pendingReview.title')
      : t('labGuard.block.rejected.title')

  const body = status === 'blocked_not_submitted'
    ? t(canAct ? 'labGuard.block.notSubmitted.bodyAdmin' : 'labGuard.block.notSubmitted.bodyOther')
    : status === 'blocked_pending_review'
      ? t('labGuard.block.pendingReview.body')
      : t('labGuard.block.rejected.body')

  return (
    <div className="flex items-center justify-center min-h-screen px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-theme-border bg-theme-card p-6 md:p-8">
        <Icon className={cn('h-6 w-6', color)} />
        <p className={cn('mt-4 text-xs font-medium uppercase tracking-wide', color)}>{eyebrow}</p>
        <h1 className="mt-2 text-lg font-semibold text-theme-primary">{title}</h1>
        <p className="mt-3 text-sm text-theme-secondary leading-relaxed">{body}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {status === 'blocked_not_submitted' && canAct && (
            <button
              type="button"
              onClick={() => navigate(IDENTITY_GATE_ROUTE)}
              className="text-sm font-medium text-theme-secondary border border-theme-border rounded-md px-3.5 py-2 hover:bg-theme-hover transition-colors"
            >
              {t('labGuard.block.cta')}
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-theme-secondary border border-theme-border rounded-md px-3.5 py-2 hover:bg-theme-hover transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('labGuard.block.back')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Layout-route sans path (App.tsx) : Outlet si l'agence est cleared, écran de blocage sinon. */
export default function KycLabGuard() {
  const status = useLabGuard()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'clear') return <Outlet />
  return <KycBlockedScreen status={status} />
}
