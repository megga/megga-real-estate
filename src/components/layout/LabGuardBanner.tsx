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
 *
 * Ni sur le gate d'identité, pour les deux statuts qui y CONDUISENT — cf.
 * shouldShowLabGuardBanner ci-dessous.
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

/**
 * Ce bandeau doit-il s'afficher sur la route du wizard d'identité ?
 *
 * Il existe pour avertir quelqu'un qui fait AUTRE CHOSE que son agence est bloquée. Sur
 * /dashboard/identite, l'utilisateur fait exactement ce que le bandeau réclame — et ce
 * sont précisément les deux statuts ci-dessous qui l'y ont conduit : le gate d'identité
 * y redirige tant qu'`identity_submitted_at` est nul, ce que « jamais soumis » et
 * « correction demandée » ont tous deux en commun (admin_request_agency_correction
 * remet la colonne à NULL). Le wizard porte déjà le message, et mieux : depuis le
 * 05.08.2026 il affiche le MOTIF de la correction, que ce bandeau ne peut que résumer.
 *
 * S'y ajoute une raison d'habillage, et elle ne se rattrape pas au cas par cas : ce
 * parcours porte la peau MEGGA X (transcription de la vitrine, une seule polarité), pas
 * le thème du CRM. Un bandeau bâti sur `bg-theme-card`/`border-theme-border` posé
 * au-dessus s'y lit comme une bande rapportée d'une autre application — visible en clair
 * comme en sombre, puisque les deux surfaces ne suivent pas la même préférence.
 *
 * Les deux AUTRES statuts restent affichés là : « en revue » et « refusé » n'amènent
 * personne ici (le gate est franchi, `identity_submitted_at` est posé) — on n'y arrive
 * qu'en tapant l'URL, devant un formulaire que la base a gelé. Le bandeau est alors la
 * seule chose qui dise pourquoi rien ne s'enregistrera.
 *
 * Pur, testé directement (tests/unit/lab-guard-banner-routes.spec.ts). Vit ICI et non
 * dans useLabGuard.ts : la règle ne parle que de CE bandeau, et l'y déplacer forcerait
 * useLabGuard — que tout le CRM monte — à importer la route du gate d'identité, deux
 * gardes que son en-tête tient délibérément indépendants.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement, même motif que les règles exportées d'IdentityShell.tsx.
export function shouldShowLabGuardBanner(status: BlockedStatus, pathname: string): boolean {
  if (pathname.startsWith(KYC_LAB_GUARD_ROUTE_PREFIX)) return false
  if (pathname === IDENTITY_GATE_ROUTE) {
    return status !== 'blocked_not_submitted' && status !== 'blocked_correction_requested'
  }
  return true
}

export default function LabGuardBanner() {
  const { t } = useTranslation('onboarding')
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const status = useLabGuard()

  if (status === 'loading' || status === 'unavailable' || status === 'clear') return null

  // Deux surfaces disent déjà tout, chacune mieux que ce bandeau : l'écran plein de
  // /dashboard/kyc* et le wizard d'identité. Cf. shouldShowLabGuardBanner.
  if (!shouldShowLabGuardBanner(status, location.pathname)) return null

  const canAct = profile != null && canActOnLabGuard(profile.role)
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
        {/* Aucun garde de route ici : les deux seuls statuts qui portent ce bouton ne
            s'affichent plus SUR /dashboard/identite (shouldShowLabGuardBanner), donc il
            ne peut plus proposer d'aller là où l'on est déjà. */}
        {(status === 'blocked_not_submitted' || status === 'blocked_correction_requested') && canAct && (
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
