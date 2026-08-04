/**
 * Wizard « Identité légale » (KYB) — étape 4, le rendez-vous d'accueil.
 *
 * POURQUOI ELLE EST ICI, ET PAS APRÈS. Jusqu'au 4 août 2026, la réservation vivait
 * APRÈS la soumission : `handleSubmit` menait à `/dashboard/rendez-vous-accueil`, un
 * écran passable, en habillage CRM, au moment précis où le dirigeant croyait avoir
 * terminé. Elle est désormais une étape du parcours, avant le récapitulatif — donc
 * relue avec le reste avant d'attester, et engagée dans le même mouvement que le
 * dossier.
 *
 * ⚠ CETTE ÉTAPE EST BLOQUANTE, mais jamais un cul-de-sac. Le bouton Continuer exige un
 * rendez-vous pris — SAUF quand il n'y a rien à réserver : aucun hôte actif, ou plus
 * aucun créneau sur l'horizon. Sans cette réserve, l'étape enfermerait aujourd'hui même
 * chaque nouvelle agence hors du CRM : la table `onboarding_hosts` est vide en
 * production et aucun agenda n'y est connecté. C'est OcBooking qui tranche
 * (`nothingToBook`), sur la réponse de l'edge function et non sur une supposition.
 *
 * Elle ne détient AUCUN état : la saisie, l'écriture et la lecture du rendez-vous
 * existant vivent dans OcBooking, partagé avec l'écran `/dashboard/rendez-vous-accueil`.
 * Cette étape n'en remonte que le verdict à IdentityShell, qui en fait son `canNext`.
 *
 * Peau MEGGA X comme les trois étapes précédentes : aucune valeur de couleur, taille,
 * rayon ou ombre posée ici. Suppose d'être rendue dans le `<MeggaX>` de la coquille.
 */
import { useTranslation } from 'react-i18next'
import OcBooking, { type OcBookingState } from '@/components/onboarding-call/OcBooking'

interface StepRendezVousProps {
  /** Remonte l'état de la réservation à IdentityShell (gate du bouton Continuer). */
  onStateChange: (state: OcBookingState) => void
}

/** Étape 4 du wizard identité : prise du rendez-vous d'accueil. */
export function StepRendezVous({ onStateChange }: StepRendezVousProps) {
  const { t } = useTranslation('onboarding')

  return (
    <div className="inner-container _634px center">
      {/* Mêmes marges que les trois étapes précédentes, posées sur le <h1> lui-même :
          la feuille de base lui donne un `margin` que `.display-6` ne remet pas à zéro,
          et un wrapper sans bordure FUSIONNE avec ces marges au lieu de s'y ajouter. */}
      <h1 className="display-6 mg-top-3x-extra-small mg-bottom-2x-extra-small">
        {t('call.intro.title')}
      </h1>
      <p className="paragraph-large text-paragraph">{t('call.intro.body')}</p>

      <div className="mg-top-medium">
        <OcBooking onStateChange={onStateChange} />
      </div>
    </div>
  )
}
