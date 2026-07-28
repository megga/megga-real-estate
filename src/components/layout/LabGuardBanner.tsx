/**
 * Bandeau LAB plein (étape 5, tâche 4) — persistant sur tout le CRM agent tant
 * que agencies.verification_status n'est ni `auto_validated` ni `validated`.
 * Monté dans AgentSugarLayout, sous ImpersonateBanner, même motif que
 * AnnouncementsBanner (SEVERITY par icône/couleur, aucune donnée de props —
 * se branche lui-même sur son hook).
 *
 * Ne rend RIEN tant que useLabGuard() n'a pas résolu positivement un statut
 * bloqué ('loading'/'clear' → null) — garde-fou hérité de useIdentityGate.ts :
 * un faux positif ici alarmerait une agence légitime sans raison. Complément
 * du contrôle serveur (kyc-screening, sign-document via
 * supabase/functions/_shared/agency-lab-guard.ts), qui protège réellement ;
 * ce bandeau évite seulement de laisser l'agence découvrir le blocage en
 * pleine action.
 */
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react'
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

export default function LabGuardBanner() {
  const { t } = useTranslation('onboarding')
  const { profile } = useAuth()
  const navigate = useNavigate()
  const status = useLabGuard()

  if (status === 'loading' || status === 'clear') return null

  const canAct = profile != null && canActOnLabGuard(profile.role)
  const { icon: Icon, color } = SEVERITY[status]

  const title = status === 'blocked_not_submitted'
    ? t('labGuard.banner.notSubmitted.title')
    : status === 'blocked_pending_review'
      ? t('labGuard.banner.pendingReview.title')
      : t('labGuard.banner.rejected.title')

  const body = status === 'blocked_not_submitted'
    ? t(canAct ? 'labGuard.banner.notSubmitted.bodyAdmin' : 'labGuard.banner.notSubmitted.bodyOther')
    : status === 'blocked_pending_review'
      ? t('labGuard.banner.pendingReview.body')
      : t('labGuard.banner.rejected.body')

  return (
    <div className="border-b border-theme-border bg-theme-card">
      <div className="flex items-start gap-3 px-4 md:px-6 py-2.5">
        <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme-primary">{title}</p>
          <p className="text-xs text-theme-secondary mt-0.5">{body}</p>
        </div>
        {status === 'blocked_not_submitted' && canAct && (
          <button
            type="button"
            onClick={() => navigate(IDENTITY_GATE_ROUTE)}
            className="flex-shrink-0 text-xs font-medium text-theme-secondary border border-theme-border rounded-md px-2.5 py-1 hover:bg-theme-hover transition-colors"
          >
            {t('labGuard.banner.cta')}
          </button>
        )}
      </div>
    </div>
  )
}
