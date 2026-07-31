/**
 * Bandeau LAB plein (étape 5, tâche 4) — persistant sur tout le CRM agent tant
 * que agencies.verification_status n'est ni `auto_validated` ni `validated`.
 * Monté dans AgentSugarLayout, sous ImpersonateBanner, même motif que
 * AnnouncementsBanner (SEVERITY par icône/couleur, aucune donnée de props —
 * se branche lui-même sur son hook).
 *
 * Ne rend RIEN tant que useLabGuard() n'a pas résolu positivement un statut
 * bloqué ('loading'/'unavailable'/'clear' → null) — garde-fou hérité de
 * useIdentityGate.ts : un faux positif ici alarmerait une agence légitime sans
 * raison. 'unavailable' (lecture du statut en échec) reste muet ICI par le même
 * raisonnement : une coupure réseau ne doit pas semer un bandeau d'alerte sur
 * toutes les pages du CRM. Seul l'écran plein de /dashboard/kyc en parle, au
 * moment où l'échec empêche réellement d'avancer. Complément
 * du contrôle serveur (kyc-screening, sign-document via
 * supabase/functions/_shared/agency-lab-guard.ts), qui protège réellement ;
 * ce bandeau évite seulement de laisser l'agence découvrir le blocage en
 * pleine action.
 *
 * Ne rend RIEN non plus sur les routes gardées par KycLabGuard (correctif
 * revue, point mineur) : cet écran plein dit déjà tout, répéter le bandeau
 * au-dessus double le message sans rien ajouter.
 */
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertTriangle, Info, AlertOctagon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useLabGuard, canActOnLabGuard, KYC_LAB_GUARD_ROUTE_PREFIX, LAB_GUARD_LABEL_KEY, type LabGuardStatus } from '@/hooks/useLabGuard'
import { IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'
import { showIntercomSpace } from '@/lib/intercom'

type BlockedStatus = Exclude<LabGuardStatus, 'loading' | 'clear' | 'unavailable'>

const SEVERITY: Record<BlockedStatus, { icon: typeof AlertTriangle; color: string }> = {
  blocked_not_submitted: { icon: AlertTriangle, color: 'text-amber-500' },
  blocked_pending_review: { icon: Info, color: 'text-blue-500' },
  blocked_rejected: { icon: AlertOctagon, color: 'text-red-500' },
  // Ambre comme « non soumis » et non rouge comme « refusé » : la balle est dans le camp de
  // l'agence, il y a quelque chose à faire, ce n'est pas un verdict.
  blocked_correction_requested: { icon: AlertTriangle, color: 'text-amber-500' },
}

export default function LabGuardBanner() {
  const { t } = useTranslation('onboarding')
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useLabGuard()

  if (status === 'loading' || status === 'unavailable' || status === 'clear') return null

  // /dashboard/kyc* affiche déjà l'écran plein (KycLabGuard) qui dit exactement la
  // même chose — le bandeau reste utile PARTOUT AILLEURS (rappel persistant sur les
  // pages non gardées), pas ici.
  if (location.pathname.startsWith(KYC_LAB_GUARD_ROUTE_PREFIX)) return null

  const canAct = profile != null && canActOnLabGuard(profile.role)
  // Jamais proposer de naviguer vers la page d'identité depuis la page d'identité
  // elle-même — même motif que shouldRedirectToIdentityGate (useIdentityGate.ts).
  const onIdentityPage = location.pathname === IDENTITY_GATE_ROUTE
  const { icon: Icon, color } = SEVERITY[status]

  // Un i18n key par statut (LAB_GUARD_LABEL_KEY, pfKit voisin) plutôt qu'une chaîne de
  // ternaires par libellé : l'ajout du 4e cas bloqué (étape 7, tâche 5) portait la chaîne à
  // quatre niveaux sur trois libellés, dans deux composants. Le seul libellé qui reste
  // conditionnel est le corps de « non soumis », qui se dit différemment à un dirigeant et à
  // un employé.
  const ns = LAB_GUARD_LABEL_KEY[status]
  const title = t(`labGuard.banner.${ns}.title`)
  const body = status === 'blocked_not_submitted'
    ? t(canAct ? 'labGuard.banner.notSubmitted.bodyAdmin' : 'labGuard.banner.notSubmitted.bodyOther')
    : t(`labGuard.banner.${ns}.body`)

  return (
    <div className="border-b border-theme-border bg-theme-card">
      <div className="flex items-start gap-3 px-4 md:px-6 py-2.5">
        <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme-primary">{title}</p>
          <p className="text-xs text-theme-secondary mt-0.5">{body}</p>
        </div>
        {(status === 'blocked_not_submitted' || status === 'blocked_correction_requested') && canAct && !onIdentityPage && (
          <button
            type="button"
            onClick={() => navigate(IDENTITY_GATE_ROUTE)}
            className="flex-shrink-0 text-xs font-medium text-theme-secondary border border-theme-border rounded-md px-2.5 py-1 hover:bg-theme-hover transition-colors"
          >
            {t('labGuard.banner.cta')}
          </button>
        )}
        {status === 'blocked_rejected' && (
          <button
            type="button"
            onClick={() => showIntercomSpace('messages')}
            className="flex-shrink-0 text-xs font-medium text-theme-secondary border border-theme-border rounded-md px-2.5 py-1 hover:bg-theme-hover transition-colors"
          >
            {t('labGuard.banner.contactSupport')}
          </button>
        )}
      </div>
    </div>
  )
}
