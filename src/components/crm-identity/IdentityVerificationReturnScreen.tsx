/**
 * Écran de RETOUR de la vérification d'identité — ce que voit le dirigeant quand Stripe
 * le renvoie sur l'app, après avoir photographié sa pièce et son visage.
 *
 * ⚠ Ce n'est ni une route ni une étape du wizard, et les deux sont délibérés.
 *
 * Pas une ROUTE : `kyb-identity-verify` envoie déjà Stripe sur
 * `${origin}/dashboard/identite?verification=done` (constante `RETURN_PATH` de son
 * index.ts). Le chemin est donc celui du wizard, et seul le paramètre change — personne
 * ne le lisait jusqu'ici, c'est ce que ce fichier vient brancher. Une route enfant
 * (`/dashboard/identite/retour`) aurait exigé d'élargir l'exemption du gate d'identité,
 * qui est une ÉGALITÉ STRICTE de pathname : c'est exactement le geste qui a produit
 * l'incident P0 c830f9a9 (boucle d'onboarding). La query string, elle, n'entre pas dans
 * `location.pathname` — le gate ne la voit même pas.
 *
 * Pas une ÉTAPE : le rail d'étapes n'en compte que cinq, et ce moment-ci n'en est pas
 * une sixième — on ne saisit rien, on constate. Même statut qu'IdentityWelcomeScreen et
 * qu'ExitPendingScreen : une page pleine, rendue à la place de la coquille, arbitrée par
 * resolveIdentityScreen().
 *
 * ⚠ LE NOM AFFICHÉ EST LE NOM DÉCLARÉ, pas celui que Stripe a lu. Le webhook développe
 * bien `verified_outputs` (prénom, nom, date de naissance) mais ne les STOCKE jamais :
 * il n'en tire que des verdicts de correspondance (`exact|approx|differs|unreadable`)
 * dans `agency_related_persons.id_document_read`, puis les jette. C'est une
 * minimisation LPD assumée, pas un oubli — aucune colonne ne porte ces valeurs. Le
 * sceau ne dit donc pas « voici ce que Stripe a lu » mais « le nom que nous détenons
 * correspond au document vérifié », ce qui est précisément ce que ces verdicts
 * attestent.
 *
 * Peau MEGGA X, gabarit repris verbatim d'IdentityWelcomeScreen (même carte
 * `sign-in-card`, même en-tête à logo) : le dirigeant revient d'un domaine tiers, il
 * doit reconnaître l'écran qu'il a quitté.
 */
import { useTranslation } from 'react-i18next'
import { MeggaX, MxButton } from '@/components/megga-x'
import VerifiedSeal, { VERIFIED_SEAL_ON_DARK } from '@/components/ui/VerifiedSeal'
import type { IdentityVerificationStatus } from '@/hooks/useAgencyIdentity'

/**
 * Les trois issues possibles à ce moment du parcours, et rien d'autre.
 *
 * `processing` n'est pas un cas dégradé : c'est le cas NORMAL au retour. Le verdict
 * arrive par webhook, de façon asynchrone, et l'onglet revient presque toujours avant
 * lui. D'où un écran qui l'assume au lieu de faire attendre — le parcours accepte déjà
 * d'avancer sur `processing` (isIdentityVerificationSufficient).
 */
function resolveReturnTone(status: IdentityVerificationStatus | null): 'verified' | 'processing' | 'incomplete' {
  if (status === 'verified') return 'verified'
  if (status === 'processing') return 'processing'
  return 'incomplete'
}

interface Props {
  /** Statut relu en base, `null` tant qu'aucune vérification n'a été lancée. */
  status: IdentityVerificationStatus | null
  /** Prénom et nom DÉCLARÉS à l'étape 1 (cf. en-tête). Chaîne vide si la personne n'est pas encore chargée. */
  fullName: string
  /** Ouvre l'étape « Rendez-vous » du wizard (index 3). Ne change pas de route. */
  onBook: () => void
  /** Ramène à l'étape « Pièce d'identité » (index 2), pour reprendre une vérification non aboutie. */
  onRetryDocument: () => void
}

export default function IdentityVerificationReturnScreen({ status, fullName, onBook, onRetryDocument }: Props) {
  const { t } = useTranslation('onboarding')
  const tone = resolveReturnTone(status)

  return (
    <MeggaX>
      <div className="page-wrapper full-height-page mx-appshell">
        <div className="header pd-medium-top-and-bottom">
          <div className="container-default w-container">
            <div className="flex-horizontal">
              <div className="header-logo">
                <img src="/megga-logo.svg" alt="MEGGA" />
              </div>
            </div>
          </div>
        </div>
        <section className="section hero---br pd-top-0 pd-bottom-0 mx-grow mx-shellbody">
          <div className="container-default position-relative---z-index-1 w-container mx-scrollarea mx-scrollarea--center">
            <div className="inner-container _634px center">
              <div className="card sign-in-card">
                <div className="pd---content-inside-card pd---vertical-side-104px">
                  <div className="inner-container _464px center">
                    <div className="text-center">
                      {/* Remerciement AU-DESSUS du nom, en surtitre : le dirigeant vient
                          de photographier sa pièce et son visage chez un tiers, on ouvre
                          par là avant de le nommer.

                          Retiré sur `incomplete` : remercier quelqu'un dont la
                          vérification n'a pas abouti sonnerait faux juste au-dessus de la
                          phrase qui le lui annonce. */}
                      {tone !== 'incomplete' && (
                        <div className="mg-bottom-2x-extra-small">
                          {/* `display-8` (48 px) : c'est le mot le plus gros de l'écran,
                              plus gros que le nom qu'il surmonte (30 px). Il était en
                              `paragraph-large` (18 px) et se lisait comme une légende —
                              or c'est l'accueil, pas une annotation.

                              Un <p> et non un second <h1> : le titre de la page reste le
                              NOM, qui est ce que l'écran désigne. La hiérarchie visuelle
                              et la hiérarchie du document divergent ici volontairement,
                              plutôt que de faire varier le niveau de titre selon l'état. */}
                          <p className="display-8 semi-bold">
                            {t('gate.verificationReturn.thanks')}
                          </p>
                        </div>
                      )}
                      {/* Le NOM, et le sceau juste après lui — jamais avant, jamais sur
                          une ligne à part : c'est la personne qui est vérifiée, la coche
                          la qualifie comme un accent qualifie une lettre.

                          `inline-flex` + `gap` plutôt qu'une espace insécable : le sceau
                          est un bloc SVG, une espace le laisserait retomber sur la ligne
                          de base du texte et flotter trop bas. Le tout reste centré par
                          le `text-center` du parent, qui traite l'inline-flex comme un
                          mot. */}
                      <h1
                        className="display-6"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}
                      >
                        <span>{fullName}</span>
                        {/* Pas de sceau tant que le verdict n'est pas rendu : une coche
                            posée sur un `processing` serait un mensonge de quelques
                            secondes, sur l'écran précis où le dirigeant vient chercher
                            une confirmation. */}
                        {/* ⚠ Le sceau atteste l'IDENTITÉ, pas le dossier. La vérification
                            Stripe n'entre dans aucun score : le verdict `id_document`
                            reste tranché par un humain (`admin_resolve_agency_id_document`).
                            Aucune formule de cet écran ne doit donc laisser entendre que
                            le dossier est accepté — c'est pourquoi la ligne sous le nom
                            parle du rendez-vous, et plus de ce qui vient d'être fait. */}
                        {tone === 'verified' && (
                          <VerifiedSeal
                            size={26}
                            color={VERIFIED_SEAL_ON_DARK}
                            ariaLabel={t('gate.verificationReturn.sealAria')}
                          />
                        )}
                      </h1>
                      <div className="mg-top-4x-extra-small">
                        <p className="paragraph-large" role="status" aria-live="polite">
                          {t(`gate.verificationReturn.body.${tone}`)}
                        </p>
                      </div>
                    </div>

                    <div className="mg-top-large text-center">
                      {/* `type="button"` explicite : MxButton n'en pose aucun et le défaut
                          HTML est `submit` (même correctif que sur les autres écrans de
                          ce parcours). */}
                      {tone === 'incomplete' ? (
                        <MxButton type="button" className="app-button" onClick={onRetryDocument}>
                          {t('gate.verificationReturn.retryCta')}
                        </MxButton>
                      ) : (
                        <MxButton type="button" className="app-button" onClick={onBook}>
                          {t('gate.verificationReturn.bookCta')}
                        </MxButton>
                      )}
                    </div>

                    {/* AUCUNE sortie secondaire ici (retrait du 9 août 2026). « Revoir ma
                        pièce d'identité » y figurait : sur un écran qui vient d'annoncer
                        une identité vérifiée, proposer d'y revenir met en doute ce qu'on
                        vient d'affirmer. Le rail d'étapes du wizard reste le chemin pour
                        y retourner, et l'état `incomplete` porte déjà son propre bouton. */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </MeggaX>
  )
}
