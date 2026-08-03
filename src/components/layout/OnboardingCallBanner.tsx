/**
 * Rappel de l'appel d'accueil — bandeau persistant du CRM agent.
 *
 * Même emplacement et même grammaire que LabGuardBanner : monté dans
 * AgentSugarLayout, sans props, branché sur son propre hook.
 *
 * Deux visages selon l'état :
 *   - aucun appel réservé et rappel non mis en sommeil : invitation à réserver ;
 *   - appel réservé et à venir : rappel de la date, avec le lien de visioconférence.
 *
 * Ne rend RIEN tant que la lecture n'a pas abouti. Un bandeau « réservez votre appel »
 * qui clignote pendant le chargement chez une agence qui a déjà réservé se lit comme
 * un bug, et le hook peut répondre en plusieurs centaines de millisecondes.
 */
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { CalendarCheck, Video } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { canActOnLabGuard } from '@/hooks/useLabGuard'
import { IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'
import {
  useMyOnboardingCall,
  isOnboardingCallSnoozed,
  ONBOARDING_CALL_ROUTE,
} from '@/hooks/useOnboardingCall'

export default function OnboardingCallBanner() {
  const { t } = useTranslation('onboarding')
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { data: call, isLoading, isError } = useMyOnboardingCall()

  // Une lecture en cours ou en échec reste muette : mieux vaut pas de rappel qu'un
  // rappel faux.
  if (isLoading || isError) return null

  // Redire sur l'écran de réservation ce que cet écran dit déjà, ou couvrir le gate
  // d'identité d'un second message, n'ajoute rien.
  if (location.pathname === ONBOARDING_CALL_ROUTE) return null
  if (location.pathname === IDENTITY_GATE_ROUTE) return null

  // L'appel engage l'agence : seul un dirigeant le prend ou le déplace.
  if (!profile || !canActOnLabGuard(profile.role)) return null

  if (call) {
    const startMs = Date.parse(call.scheduled_at)
    if (!Number.isFinite(startMs) || startMs <= Date.now()) return null

    const when = new Intl.DateTimeFormat('fr-CH', {
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(startMs))

    return (
      <div className="border-b border-theme-border bg-theme-card">
        <div className="flex items-start gap-3 px-4 md:px-6 py-2.5">
          <CalendarCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-blue-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-theme-primary">{t('call.banner.booked.title')}</p>
            <p className="text-xs text-theme-secondary mt-0.5 first-letter:uppercase">
              {when} · {call.host_display_name}
            </p>
          </div>
          {call.meeting_url && (
            <a
              href={call.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-theme-secondary border border-theme-border rounded-md px-2.5 py-1 hover:bg-theme-hover transition-colors"
            >
              <Video className="h-3.5 w-3.5" />
              {t('call.banner.booked.join')}
            </a>
          )}
        </div>
      </div>
    )
  }

  if (isOnboardingCallSnoozed(profile.agency_id)) return null

  return (
    <div className="border-b border-theme-border bg-theme-card">
      <div className="flex items-start gap-3 px-4 md:px-6 py-2.5">
        <CalendarCheck className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme-primary">{t('call.banner.pending.title')}</p>
          <p className="text-xs text-theme-secondary mt-0.5">{t('call.banner.pending.body')}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(ONBOARDING_CALL_ROUTE)}
          className="flex-shrink-0 text-xs font-medium text-theme-secondary border border-theme-border rounded-md px-2.5 py-1 hover:bg-theme-hover transition-colors"
        >
          {t('call.banner.pending.cta')}
        </button>
      </div>
    </div>
  )
}
