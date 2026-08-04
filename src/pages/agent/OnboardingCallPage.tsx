/**
 * Écran de réservation de l'appel d'accueil — route `/dashboard/rendez-vous-accueil`.
 *
 * ⚠ CE N'EST PLUS LA SUITE DU WIZARD. Depuis le 4 août 2026, le rendez-vous est une
 * ÉTAPE du parcours d'identité (index 3, StepRendezVous), prise avant le récapitulatif
 * et relue dedans ; `IdentityShell.handleSubmit` mène désormais au dashboard. Cette
 * route survit pour les trois cas qu'elle seule couvre :
 *   - les agences qui ont franchi le wizard AVANT que l'étape n'existe, et que le
 *     bandeau de rappel du CRM (OnboardingCallBanner) envoie ici ;
 *   - celles dont l'étape s'est laissée franchir faute d'hôte ou de créneau, et pour
 *     qui un créneau s'ouvre plus tard ;
 *   - toute reprise ultérieure, le rendez-vous n'étant pas un acte à sens unique.
 *
 * PASSABLE, JAMAIS BLOQUANT — ici, et seulement ici. L'étape du wizard, elle, exige un
 * rendez-vous : c'est le moment du parcours où on le demande. Cet écran-ci est atteint
 * depuis un CRM déjà ouvert ; y enfermer une agence pour l'obliger à parler à quelqu'un
 * serait un mauvais échange. « Plus tard » met le rappel en sommeil et laisse passer.
 *
 * HABILLAGE : MEGGA X et non plus Sugar (bascule du 4 août 2026, avec le reste des
 * écrans de rendez-vous). C'est le même geste, le même composant et la même peau qu'à
 * l'étape du wizard — un dirigeant qui revient ici ne doit pas avoir l'impression de
 * changer de produit. Conséquence assumée, la même qu'au wizard : cet écran ne suit pas
 * la préférence clair/sombre de l'agent, la peau vitrine n'existant qu'en une polarité.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MeggaX, MxButton, MxLink } from '@/components/megga-x'
import { useAuth } from '@/hooks/useAuth'
import OcBooking, { type OcBookingState } from '@/components/onboarding-call/OcBooking'
import { snoozeOnboardingCall } from '@/hooks/useOnboardingCall'

export default function OnboardingCallPage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [state, setState] = useState<OcBookingState | null>(null)

  /** Passer n'est pas refuser : le rappel se rendort, il ne disparaît pas. */
  const skip = () => {
    snoozeOnboardingCall(profile?.agency_id ?? null)
    navigate('/dashboard')
  }

  return (
    <MeggaX>
      {/* Pas de `full-height-page mx-appshell` ici, contrairement au wizard : cet écran
          est rendu DANS la coquille du CRM (rail, en-tête), qui gère déjà la hauteur.
          Seul le fond de la vitrine est repris, pour que le bloc ne flotte pas sur le
          canvas du CRM. */}
      <div className="page-wrapper">
        <section className="section pd-top-0 pd-bottom-0">
          <div className="container-default w-container">
            <div className="inner-container _634px center pd-top-medium pd-bottom-medium">
              <h1 className="display-6 mg-bottom-2x-extra-small">{t('call.intro.title')}</h1>
              <p className="paragraph-large text-paragraph">{t('call.intro.bodyStandalone')}</p>

              <div className="mg-top-medium">
                <OcBooking
                  onStateChange={setState}
                  // Une seule sortie, dont le libellé suit ce que l'écran propose :
                  // « Plus tard » quand un créneau est là à prendre, « Continuer vers
                  // mon espace » quand il n'y a rien à réserver — dans ce dernier cas
                  // rien n'est reporté, il n'y a simplement rien à faire ici.
                  secondaryAction={
                    <MxLink onClick={skip}>
                      {t(state?.nothingToBook ? 'call.actions.continue' : 'call.actions.later')}
                    </MxLink>
                  }
                />
              </div>

              {/* Une fois le rendez-vous pris, la seule chose qui reste à faire est de
                  rentrer : OcBooking rend alors sa carte de confirmation, qui ne porte
                  aucune navigation propre. */}
              {state?.booked && (
                <div className="mg-top-small">
                  <MxButton type="button" variant="secondary" onClick={() => navigate('/dashboard')}>
                    {t('call.confirmed.toDashboard')}
                  </MxButton>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </MeggaX>
  )
}
