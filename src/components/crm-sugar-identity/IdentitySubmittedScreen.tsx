/**
 * Écran de CONFIRMATION après la soumission du dossier — le dernier du parcours.
 *
 * Jusqu'au 10 août 2026, `handleSubmit` menait directement à `/dashboard` : on
 * soumettait son dossier de conformité et on était éjecté dans un CRM vide, sans un
 * mot. Cet écran rend son point final au parcours, et sert deux choses que le tableau
 * de bord ne dit pas : ce que devient le dossier, et où a lieu le rendez-vous.
 *
 * ⚠ LE LIEN DE VISIOCONFÉRENCE PEUT NE PAS EXISTER, et ce n'est pas une erreur. Il est
 * produit par Google Calendar au moment où l'edge pose l'événement DANS L'AGENDA DE
 * L'HÔTE (`conferenceData`/`hangoutsMeet`, cf. createHostEvent). Quand l'hôte n'a aucun
 * agenda branché, `createHostEvent` rend `null`, la réservation aboutit quand même et
 * `meeting_url` reste vide. L'écran bascule alors sur ce que la réservation promet
 * déjà : le lien arrive par e-mail. Les deux phrases sont vraies, aucune n'est un
 * pis-aller — mais tant qu'aucun agenda d'hôte n'est connecté, c'est la seconde qui
 * s'affichera toujours.
 *
 * Ni route ni étape : un état de plus d'IdentityShell, arbitré par
 * resolveIdentityScreen, comme l'arrivée, la sortie de secours et le retour du
 * prestataire. Sortir sur une route rejouerait la boucle P0 c830f9a9.
 *
 * Peau MEGGA X, gabarit repris d'IdentityWelcomeScreen : le parcours se ferme dans
 * l'habillage où il s'est ouvert.
 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MeggaX, MxButton } from '@/components/megga-x'
import type { OnboardingCallRow } from '@/hooks/useOnboardingCall'
import { bookedWhenLabel } from '@/components/onboarding-call/ocDates'

/**
 * L'emblème de l'écran : un avion de papier, pas une coche.
 *
 * ⛔ La pastille de la vitrine porte le glyphe U+E805, une COCHE — le même signe qu'à
 * l'écran d'arrivée. Sur « Votre dossier est parti », une coche dit « validé », et
 * c'est faux : la soumission n'est pas une acceptation. Le verdict appartient à
 * l'équipe conformité, qui ne l'a pas encore rendu, et rien de cet écran ne doit le
 * laisser croire (même règle que le sceau de la vérification, qui atteste l'identité
 * et non le dossier).
 *
 * Un avion de papier dit exactement ce qui s'est passé : c'est PARTI. Le disque
 * dégradé de la vitrine est conservé — il porte l'emphase d'un écran terminal, pas
 * l'idée de succès ; c'est le glyphe qui la portait.
 *
 * Dessiné sur `currentColor`, que la pastille fixe déjà en `--neutral-colors--1000`.
 * `aria-hidden` : le titre juste en dessous dit la même chose, en mieux.
 */
function AvionGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2.5 11 13" />
      <path d="M21.5 2.5 15 21.5l-4-8.5-8.5-4z" />
    </svg>
  )
}

/** Combien de temps le bouton dit « Copié » avant de reprendre son libellé. */
const COPIE_VISIBLE_MS = 2_000

interface Props {
  /** Le rendez-vous pris à l'étape 4, ou `null` s'il n'y avait rien à réserver. */
  rendezVous: OnboardingCallRow | null
  /** Fuseau dans lequel l'heure est relue — celui du navigateur. */
  timezone: string
  /** Sortie vers le CRM. C'est la SEULE navigation de cet écran. */
  onEnter: () => void
}

export default function IdentitySubmittedScreen({ rendezVous, timezone, onEnter }: Props) {
  const { t } = useTranslation('onboarding')
  const [copie, setCopie] = useState(false)
  const lien = rendezVous?.meeting_url ?? null

  // Le témoin « Copié » s'efface seul. Nettoyé au démontage : sans ça, un clic suivi
  // d'une sortie immédiate déclencherait un setState sur un composant démonté.
  useEffect(() => {
    if (!copie) return
    const id = setTimeout(() => setCopie(false), COPIE_VISIBLE_MS)
    return () => { clearTimeout(id) }
  }, [copie])

  const copier = async () => {
    if (!lien) return
    try {
      await navigator.clipboard.writeText(lien)
      setCopie(true)
    } catch {
      // `navigator.clipboard` exige un contexte sécurisé et peut être refusé. Rien à
      // annoncer : le lien est affiché en toutes lettres juste à côté, il reste
      // sélectionnable à la main. Un message d'erreur pour une commodité serait pire
      // que le silence.
    }
  }

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
                      {/* Le disque de la vitrine, mais pas son glyphe : cf. AvionGlyph.
                          `display: flex` pour centrer un SVG là où la feuille attendait
                          un caractère de police. */}
                      <div className="success-message-icon-top" style={{ display: 'flex' }}>
                        <AvionGlyph />
                      </div>
                      <h1 className="display-6">{t('gate.submitted.title')}</h1>
                      <div className="mg-top-4x-extra-small">
                        <p className="paragraph-large">{t('gate.submitted.body')}</p>
                      </div>
                    </div>

                    {rendezVous && (
                      <div className="mg-top-medium">
                        <div className="card">
                          <div className="pd---content-inside-card text-center">
                            <p className="display-2 semi-bold capitalize">
                              {bookedWhenLabel(rendezVous.scheduled_at, timezone)}
                            </p>

                            {lien ? (
                              <>
                                {/* Le lien EN TOUTES LETTRES, pas seulement derrière un
                                    bouton : c'est ce qui permet de le lire, de le
                                    sélectionner à la main, et de vérifier où il mène
                                    avant de le coller ailleurs. `break-all` parce qu'une
                                    URL Meet ne connaît pas d'espace où se couper. */}
                                <div className="mg-top-3x-extra-small">
                                  <p className="paragraph-small" style={{ wordBreak: 'break-all' }}>{lien}</p>
                                </div>
                                <div className="mg-top-3x-extra-small">
                                  <MxButton type="button" variant="secondary" size="small" onClick={() => { void copier() }}>
                                    {copie ? t('gate.submitted.copied') : t('gate.submitted.copy')}
                                  </MxButton>
                                </div>
                              </>
                            ) : null}

                            {/* L'e-mail de confirmation, dit dans LES DEUX cas — c'est le
                                même envoi, celui que `onboarding-call-book` déclenche à la
                                réservation avec le fichier .ics en pièce jointe. Quand le
                                lien est affiché, cette ligne dit qu'on n'est pas obligé de
                                le copier maintenant ; quand il ne l'est pas, elle dit où le
                                trouver. Même phrase que la carte de confirmation de
                                l'écran de réservation : un seul envoi, un seul vocabulaire. */}
                            <div className="mg-top-3x-extra-small">
                              <p className="paragraph-small text-color-neutral-600">
                                {t('gate.submitted.mailConfirmation')}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="mg-top-large text-center">
                      <MxButton type="button" className="app-button" onClick={onEnter}>
                        {t('gate.submitted.enterCta')}
                      </MxButton>
                    </div>

                    {/* Un rendez-vous manquant se dit ICI, sous l'action, et non à la
                        place de la carte : le dossier est parti, c'est le sujet de
                        l'écran ; l'absence de créneau en est une note de bas de page. */}
                    {!rendezVous && (
                      <div className="mg-top-small text-center">
                        <p className="paragraph-small text-color-neutral-600">
                          {t('gate.submitted.noCall')}
                        </p>
                      </div>
                    )}
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
