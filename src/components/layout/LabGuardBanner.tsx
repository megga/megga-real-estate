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
import { useState } from 'react'
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

const DISMISS_STORAGE_KEY = 'megga.labguard-dismissed'

/**
 * Ce qu'un renvoi mémorise : l'AGENCE et l'ÉTAT, jamais « ce bandeau ».
 *
 * ⚠ C'est l'état dans la clé qui fait toute la règle. Mémoriser un simple booléen
 * « fermé » ferait taire la SUITE : quelqu'un qui écarte « non soumise » n'entendrait
 * plus « Correction demandée » — or ce bandeau-là est, d'après l'en-tête de ce fichier,
 * la SEULE chose qui explique pourquoi son formulaire vient de se rouvrir. Le message
 * n'est pas « un bandeau », c'est « votre dossier est dans l'état X » : une fois X
 * acquitté, le répéter n'apprend rien, et tout passage à Y doit se redire.
 *
 * L'agence y est aussi : sur un poste qui a vu deux agences (super-admin, impersonation),
 * le renvoi de l'une ne doit pas éteindre le bandeau de l'autre.
 *
 * Une VALEUR unique plutôt qu'une liste de clés cochées : elle se remplace à chaque
 * renvoi, donc le stockage ne grossit jamais et rien n'est à purger.
 */
// eslint-disable-next-line react-refresh/only-export-components -- fonction pure testée directement (tests/unit/lab-guard-dismiss.spec.ts), même motif que resolveDeclaredIdentityGap.
export function labGuardDismissKey(agencyId: string | null | undefined, status: BlockedStatus): string {
  return `${agencyId ?? 'sans-agence'}:${status}`
}

/**
 * ⚠ `window.localStorage` N'EST PAS TOUJOURS LÀ, ET SON ACCÈS PEUT LEVER.
 *
 * Safari en navigation privée et Firefox avec le stockage DOM désactivé jettent une
 * `SecurityError` sur la simple LECTURE de la propriété — pas sur `getItem`, sur
 * `window.localStorage` lui-même. Un `typeof window !== 'undefined'` ne protège donc de
 * rien, et sous jsdom la propriété EXISTE en valant `undefined` (mesuré : `'localStorage'
 * in window` est vrai, `typeof window.localStorage` vaut `undefined`).
 *
 * Sans ces deux enveloppes, une exception ici ferait tomber `LabGuardBanner`, donc
 * `IdentityShell`, donc TOUT le wizard d'onboarding — un écran blanc, pour un confort
 * d'affichage. Le renvoi est la seule chose qui a le droit d'échouer : il redevient
 * simplement sans mémoire.
 */
function lireRenvoi(): string | null {
  try {
    return window.localStorage?.getItem(DISMISS_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function ecrireRenvoi(cle: string): void {
  try {
    window.localStorage?.setItem(DISMISS_STORAGE_KEY, cle)
  } catch {
    // Stockage indisponible ou plein : le bandeau se referme pour cette visite et
    // reviendra au prochain montage. Rien à dire à l'utilisateur.
  }
}

export default function LabGuardBanner() {
  const { t } = useTranslation('onboarding')
  const { profile } = useAuth()
  const status = useLabGuard()
  // L'état porte la VALEUR mémorisée, pas un booléen « masqué » : la comparer à la clé
  // du rendu courant fait réapparaître le bandeau au changement d'état sans le moindre
  // effet de synchronisation. Lu une fois, à l'initialisation — `localStorage` ne
  // change pas sous nos pieds pour cette clé, et le lire à chaque rendu serait un accès
  // synchrone gratuit.
  const [renvoye, setRenvoye] = useState<string | null>(lireRenvoi)

  if (status === 'loading' || status === 'unavailable' || status === 'clear') return null

  const cleRenvoi = labGuardDismissKey(profile?.agency_id, status)
  if (renvoye === cleRenvoi) return null

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
          <div className="flex-horizontal mx-notice__actions">
            {status === 'blocked_rejected' && (
              <MxLink onClick={() => showIntercomSpace('messages')}>
                {t('labGuard.banner.contactSupport')}
              </MxLink>
            )}
            {/* ⚠ Le renvoi NE LÈVE RIEN : le blocage réel est côté serveur
                (_shared/agency-lab-guard.ts), ce bandeau n'a jamais fait que l'annoncer
                à l'avance. Le fermer ne fait donc pas courir de risque — il retire une
                phrase que le wizard juste en dessous dit déjà. Et il revient de lui-même
                à tout changement d'état, cf. labGuardDismissKey. */}
            <button
              type="button"
              className="mx-notice__close"
              onClick={() => {
                ecrireRenvoi(cleRenvoi)
                setRenvoye(cleRenvoi)
              }}
              aria-label={t('labGuard.banner.dismiss')}
              title={t('labGuard.banner.dismiss')}
            >
              {/* Deux traits dans un viewBox carré, jamais le caractère « × » : son encre
                  se pose sur l'axe mathématique de la police, donc au-dessus du milieu de
                  la ligne. Même glyphe que MxModal, même raison.

                  Sans `width`/`height` — la taille vient de `.mx-notice__close svg`, comme
                  tout le reste de ce fichier (cf. son en-tête : aucune valeur de couleur,
                  de taille ni de rayon posée ici). C'est aussi ce qu'exige le cliquet de
                  grammaire, qui compte les littéraux de taille par zone. */}
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <path d="M3 3l10 10M13 3L3 13" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
