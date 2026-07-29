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
 * Quatrième écran, distinct des trois motifs de blocage : 'unavailable', quand la
 * LECTURE du statut a échoué (réseau, RLS, schéma). Ce layout remplaçant tout le
 * contenu de la page — les pages Sugar portent leur propre chrome, AgentSugarLayout
 * n'en fournit aucun — un spinner sans issue ici laisse une page entièrement muette,
 * sans un mot ni un bouton. L'écran « statut indisponible » dit donc ce qui est vrai
 * (on n'a pas pu lire, ce n'est pas une décision sur le dossier) et propose une
 * reprise. Il ne dévoile rien : le contenu KYC reste caché, exactement comme sur les
 * trois écrans de blocage.
 *
 * Complément du contrôle serveur (kyc-screening via
 * supabase/functions/_shared/agency-lab-guard.ts), pas le contrôle lui-même :
 * un blocage seulement ici se contournerait en appelant l'edge function
 * directement. Ce composant évite seulement de proposer une action vouée à
 * l'échec.
 */
import { Outlet, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Info, AlertOctagon, AlertCircle, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useLabGuard, canActOnLabGuard, LAB_GUARD_STATUS_QUERY_KEY, type LabGuardStatus } from '@/hooks/useLabGuard'
import { IDENTITY_GATE_ROUTE } from '@/hooks/useIdentityGate'
import { showIntercomSpace } from '@/lib/intercom'

/** Les trois MOTIFS de blocage. 'unavailable' en est exclu à dessein : ce n'est pas un
 *  verdict sur le dossier mais un échec de lecture, et il a son propre écran. */
type BlockedStatus = Exclude<LabGuardStatus, 'loading' | 'clear' | 'unavailable'>

const SEVERITY: Record<BlockedStatus, { icon: typeof AlertTriangle; color: string }> = {
  blocked_not_submitted: { icon: AlertTriangle, color: 'text-amber-500' },
  blocked_pending_review: { icon: Info, color: 'text-blue-500' },
  blocked_rejected: { icon: AlertOctagon, color: 'text-red-500' },
}

/** État 'loading' — écran neutre, jamais le blocage ni le contenu réel (cf. en-tête du fichier).
 *
 * Le spinner est ACCOMPAGNÉ de son libellé, comme celui d'IdentityShell
 * (`gate.shell.preparing`, même parcours KYB) : ce layout remplaçant toute la page,
 * un spinner nu laissait un écran sans un seul mot, où l'agent ne pouvait ni savoir
 * ce qu'on attendait ni le dire à un support. Le libellé énonce l'attente en cours,
 * jamais un verdict — il reste vrai quelle que soit l'issue.
 *
 * min-h-full (pas min-h-screen, correctif revue, point mineur) : AgentSugarLayout
 * enveloppe déjà l'Outlet dans un conteneur flex qui occupe toute la hauteur
 * disponible sous les bandeaux (ImpersonateBanner/LabGuardBanner) — un second
 * ancrage indépendant sur 100vh ICI ignorait la hauteur déjà prise par ces
 * bandeaux et produisait un ascenseur de page parasite (bandeau + 100vh > hauteur
 * de la fenêtre). min-h-full se cale sur l'espace réellement disponible. */
function LoadingScreen() {
  const { t } = useTranslation('onboarding')
  return (
    <div
      className="flex items-center justify-center gap-3 min-h-full px-4 py-12"
      role="status"
      aria-live="polite"
    >
      <div className="h-5 w-5 flex-shrink-0 border-2 border-theme-border border-t-accent rounded-full animate-spin" />
      <p className="text-sm text-theme-tertiary">{t('labGuard.block.checking')}</p>
    </div>
  )
}

/**
 * État 'unavailable' — la lecture du statut a échoué. Dit l'échec plutôt que de
 * tourner indéfiniment (cf. en-tête), et surtout ne l'énonce PAS comme un verdict :
 * ni « pas soumis », ni « refusé », rien sur le dossier lui-même.
 *
 * Teinte neutre (`text-theme-tertiary`) et non une couleur de sévérité : les trois
 * ambre/bleu/rouge de SEVERITY qualifient l'état du dossier de l'agence, ce qu'un
 * incident technique ne fait pas.
 */
function KycStatusUnavailableScreen() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // Invalidation par PRÉFIXE (sans l'agencyId) : la reprise n'a pas à redécouvrir
  // quelle agence useLabGuard interroge, et la requête, montée juste au-dessus,
  // est active — l'invalidation la relance donc réellement.
  const retry = () => { void queryClient.invalidateQueries({ queryKey: [LAB_GUARD_STATUS_QUERY_KEY] }) }

  return (
    <div className="flex items-center justify-center min-h-full px-4 py-12">
      <div className="w-full max-w-lg rounded-xl border border-theme-border bg-theme-card p-6 md:p-8">
        <AlertCircle className="h-6 w-6 text-theme-tertiary" />
        <p className="mt-4 text-xs font-medium uppercase tracking-wide text-theme-tertiary">
          {t('labGuard.block.unavailable.eyebrow')}
        </p>
        <h1 className="mt-2 text-lg font-semibold text-theme-primary">{t('labGuard.block.unavailable.title')}</h1>
        <p className="mt-3 text-sm text-theme-secondary leading-relaxed">{t('labGuard.block.unavailable.body')}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={retry}
            className="text-sm font-medium text-theme-secondary border border-theme-border rounded-md px-3.5 py-2 hover:bg-theme-hover transition-colors"
          >
            {t('labGuard.block.unavailable.retry')}
          </button>
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
    // min-h-full, pas min-h-screen : voir le commentaire equivalent sur LoadingScreen
    // ci-dessus (correctif revue, point mineur — ascenseur de page parasite).
    <div className="flex items-center justify-center min-h-full px-4 py-12">
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
          {status === 'blocked_rejected' && (
            <button
              type="button"
              onClick={() => showIntercomSpace('messages')}
              className="text-sm font-medium text-theme-secondary border border-theme-border rounded-md px-3.5 py-2 hover:bg-theme-hover transition-colors"
            >
              {t('labGuard.block.contactSupport')}
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

/** Layout-route sans path (App.tsx) : Outlet si l'agence est cleared, écran de blocage
 *  sinon — et écran « statut indisponible » si la lecture a échoué. Le spinner ne reste
 *  donc affiché que pour une attente réelle, jamais pour un échec. */
export default function KycLabGuard() {
  const status = useLabGuard()

  if (status === 'loading') return <LoadingScreen />
  if (status === 'unavailable') return <KycStatusUnavailableScreen />
  if (status === 'clear') return <Outlet />
  return <KycBlockedScreen status={status} />
}
