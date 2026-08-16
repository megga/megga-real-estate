/**
 * Bandeau d'état du dossier KYB — persistant tant que `agencies.verification_status`
 * n'est ni `auto_validated` ni `validated`.
 *
 * ── Où il vit, et pourquoi il a déménagé (04.08.2026) ──────────────────────────────
 *
 * Monté dans **IdentityShell**, à l'intérieur de `.mx-appshell`. Il vivait auparavant
 * dans AgentLayout, au-dessus de tout le CRM, et deux choses ont changé.
 *
 * 1. Il n'a plus de raison d'être ailleurs. La garde d'identité renvoie toute route
 *    vers `/dashboard/identite` tant que le dossier n'est pas soumis, et l'écran plein
 *    de `/dashboard/kyc*` dit déjà tout — le bandeau n'était donc lu QUE sur
 *    l'entonnoir, dont il ne portait pas la peau. Décision client : il appartient à
 *    MEGGA X.
 *
 * 2. Empilé AU-DESSUS de la coquille, il la faisait déborder. `.mx-appshell` réclame
 *    `100dvh` — la fenêtre entière, sans rien retrancher de ce qui la surmonte : ses
 *    59 px s'ajoutaient, le pied d'actions passait sous le bord et « Continuer »
 *    s'affichait coupé en deux. Posé DANS la coquille, il en partage la hauteur et le
 *    défaut ne peut plus revenir.
 *
 * ⛔ Ne PAS le masquer sur `/dashboard/identite` : c'est l'erreur du premier correctif,
 * rattrapée par `tests/e2e/onboarding-identite.spec.ts` (« le bandeau doit annoncer une
 * correction demandée, jamais “non soumise” »). Le raisonnement « le wizard EST le
 * message » ne vaut que pour un dossier jamais soumis. Quand le relecteur RENVOIE un
 * dossier, ce bandeau est la seule chose qui explique pourquoi le formulaire s'est
 * rouvert — sans lui, le dirigeant retrouve sa saisie sans le moindre motif.
 *
 * Ne rend RIEN tant que useLabGuard() n'a pas résolu positivement un statut bloqué
 * ('loading'/'unavailable'/'clear' → null) — garde-fou hérité de useIdentityGate.ts :
 * un faux positif alarmerait une agence légitime sans raison. 'unavailable' (lecture du
 * statut en échec) reste muet ICI par le même raisonnement : une coupure réseau ne doit
 * pas semer une alerte. Complément du contrôle serveur (kyc-screening, sign-document via
 * supabase/functions/_shared/agency-lab-guard.ts), qui protège réellement ; ce bandeau
 * évite seulement de laisser l'agence découvrir le blocage en pleine action.
 *
 * Peau MEGGA X : aucune valeur de couleur, taille ou rayon posée ici — tout vient de
 * `.mx-notice` (megga-x-additions.css, point 16). Suppose d'être rendu dans le
 * `<MeggaX>` de la coquille.
 */
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { useLabGuard, canActOnLabGuard, LAB_GUARD_LABEL_KEY, type LabGuardStatus } from '@/hooks/useLabGuard'
import { showIntercomSpace } from '@/lib/intercom'
import { MxLink } from '@/components/megga-x'

type BlockedStatus = Exclude<LabGuardStatus, 'loading' | 'clear' | 'unavailable'>

/**
 * La gravité, en trois tons et pas quatre.
 *
 * « Correction demandée » partage l'ambre de « non soumis » et NON le rouge de
 * « refusé » : la balle est dans le camp de l'agence, il y a quelque chose à faire.
 * Ce n'est pas un verdict, et le lui dire en rouge lui ferait croire l'inverse.
 */
const TONE: Record<BlockedStatus, 'todo' | 'waiting' | 'refused'> = {
  blocked_not_submitted: 'todo',
  blocked_correction_requested: 'todo',
  blocked_pending_review: 'waiting',
  blocked_rejected: 'refused',
}

export default function LabGuardBanner() {
  const { t } = useTranslation('onboarding')
  const { profile } = useAuth()
  const status = useLabGuard()

  if (status === 'loading' || status === 'unavailable' || status === 'clear') return null

  const canAct = profile != null && canActOnLabGuard(profile.role)

  // Un i18n key par statut (LAB_GUARD_LABEL_KEY, pfKit voisin) plutôt qu'une chaîne de
  // ternaires par libellé : l'ajout du 4e cas bloqué portait la chaîne à quatre niveaux
  // sur trois libellés, dans deux composants. Le seul libellé qui reste conditionnel est
  // le corps de « non soumis », qui se dit différemment à un dirigeant et à un employé.
  const ns = LAB_GUARD_LABEL_KEY[status]
  const title = t(`labGuard.banner.${ns}.title`)
  const body = status === 'blocked_not_submitted'
    ? t(canAct ? 'labGuard.banner.notSubmitted.bodyAdmin' : 'labGuard.banner.notSubmitted.bodyOther')
    : t(`labGuard.banner.${ns}.body`)

  return (
    <div className={cn('mx-notice', `mx-notice--${TONE[status]}`)}>
      {/* Même conteneur que l'en-tête et le pied du parcours : le bandeau s'aligne sur
          eux au lieu de traverser l'écran d'un bord à l'autre. */}
      <div className="container-default w-container">
        <div className="mx-notice__row flex-horizontal space-between">
          <div>
            <p className="paragraph-small medium mx-notice__title">{title}</p>
            <p className="paragraph-small text-color-neutral-600">{body}</p>
          </div>
          {/* Aucun lien vers la page d'identité : ce bandeau n'est plus rendu QUE
              là-bas. Le seul geste qui reste est d'écrire au support, et seulement
              quand il n'y a plus rien à corriger soi-même. */}
          {status === 'blocked_rejected' && (
            <MxLink onClick={() => showIntercomSpace('messages')}>
              {t('labGuard.banner.contactSupport')}
            </MxLink>
          )}
        </div>
      </div>
    </div>
  )
}
