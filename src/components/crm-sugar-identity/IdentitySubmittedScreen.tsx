/**
 * Écran de CONFIRMATION DU RENDEZ-VOUS, affiché après la soumission du dossier.
 *
 * ⚠ SON SUJET EST L'APPEL, PAS LE DOSSIER. Première version écrite à l'envers le
 * 10 août 2026 : elle annonçait « Votre dossier est parti » et le suivi de la revue de
 * conformité, alors que ce que le dirigeant vient chercher ici est la date de son
 * rendez-vous et le lien pour y entrer. Le sort du dossier se dit ailleurs — par
 * e-mail à la décision, et dans le CRM.
 *
 * Jusqu'au 10 août 2026, `handleSubmit` menait directement à `/dashboard` : on
 * soumettait et on était éjecté dans un CRM vide, sans un mot, en emportant un
 * rendez-vous dont on n'avait plus ni l'heure ni le lien.
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
 * L'emblème : un calendrier.
 *
 * ⛔ Ni la COCHE de la vitrine, ni l'avion de papier de la première version. La coche
 * dit « validé » — le dossier ne l'est pas, le verdict appartient à la conformité.
 * L'avion disait « parti », ce qui décrivait le dossier alors que l'écran parle du
 * RENDEZ-VOUS. Un calendrier nomme le sujet, et rien d'autre.
 *
 * Dessiné sur `currentColor`, que la pastille fixe déjà. `aria-hidden` : le titre
 * juste en dessous dit la même chose.
 */
function CalendrierGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
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
                      {/* Le disque de la vitrine, mais pas son glyphe : cf. CalendrierGlyph.
                          `display: flex` pour centrer un SVG là où la feuille attendait
                          un caractère de police. */}
                      <div className="success-message-icon-top" style={{ display: 'flex' }}>
                        <CalendrierGlyph />
                      </div>
                      {/* Deux titres, parce que l'écran a deux sujets possibles. Avec un
                          rendez-vous, c'est LUI qu'on confirme. Sans, il ne reste que
                          l'envoi du dossier — et le dire autrement serait annoncer un
                          rendez-vous qui n'existe pas. */}
                      <h1 className="display-6">
                        {t(`gate.submitted.${rendezVous ? 'title' : 'titleNoCall'}`)}
                      </h1>
                      {/* Sous le titre et AVANT la carte : c'est une suite du titre, pas
                          une note de bas de carte. Elle rassure avant qu'on lise l'heure,
                          et dispense de retenir le lien.
                          Conditionnée au rendez-vous : sans réservation, aucun e-mail de
                          confirmation n'est parti — c'est `onboarding-call-book` qui
                          l'envoie, pas la soumission. */}
                      {rendezVous && (
                        <div className="mg-top-4x-extra-small">
                          <p className="paragraph-large">{t('gate.submitted.mailConfirmation')}</p>
                        </div>
                      )}
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
