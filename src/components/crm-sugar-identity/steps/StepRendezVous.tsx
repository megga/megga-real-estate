/**
 * Wizard « Identité légale » (KYB) — étape 4, le CHOIX du rendez-vous d'accueil.
 *
 * POURQUOI ELLE EST ICI, ET POURQUOI ELLE NE RÉSERVE PLUS. L'étape choisit le créneau
 * avant le récapitulatif — donc relu avec le reste avant d'attester — mais depuis le
 * 15.08.2026 (décision client, renversant celle du 04.08) la RÉSERVATION part avec le
 * dossier, dans `handleSubmit` : réserver ici générait le lien de visioconférence et
 * l'e-mail de confirmation avant même que le dossier soit soumis, et un abandon au
 * récapitulatif laissait un rendez-vous confirmé pour un dossier jamais envoyé. La
 * confirmation (« C'est réservé », date, lien Meet) vit désormais sur l'écran de
 * SORTIE (IdentitySubmittedScreen), après la soumission.
 *
 * ⚠ CETTE ÉTAPE RESTE BLOQUANTE, mais jamais un cul-de-sac. Le bouton Continuer exige
 * un créneau retenu (`rdvChoice` de la coquille) ou un rendez-vous déjà en base
 * (agence repassant par le wizard) — SAUF quand il n'y a rien à réserver : aucun hôte
 * actif, ou plus aucun créneau sur l'horizon. C'est OcBooking qui tranche
 * (`nothingToBook`), sur la réponse de l'edge function et non sur une supposition.
 *
 * Elle ne détient AUCUN état : la saisie vit dans OcBooking (mode `deferred`), le
 * créneau retenu vit dans IdentityShell — qui le portera jusqu'à la soumission.
 *
 * Peau MEGGA X comme les trois étapes précédentes : aucune valeur de couleur, taille,
 * rayon ou ombre posée ici. Suppose d'être rendue dans le `<MeggaX>` de la coquille.
 */
import { useTranslation } from 'react-i18next'
import OcBooking, { type OcBookingChoice, type OcBookingState } from '@/components/onboarding-call/OcBooking'

interface StepRendezVousProps {
  /** Remonte l'état de la réservation à IdentityShell (gate du bouton Continuer). */
  onStateChange: (state: OcBookingState) => void
  /** Le créneau retenu, détenu par IdentityShell — relu quand on revient sur l'étape. */
  choice: OcBookingChoice | null
  /** Remonte le créneau retenu ; la coquille en est la mémoire jusqu'à la soumission. */
  onChoiceChange: (choice: OcBookingChoice | null) => void
}

/** Étape 4 du wizard identité : choix du rendez-vous d'accueil. */
export function StepRendezVous({ onStateChange, choice, onChoiceChange }: StepRendezVousProps) {
  const { t } = useTranslation('onboarding')

  // PLUS LARGE que les quatre autres étapes (634 px), et c'est délibéré : la prise de
  // rendez-vous porte deux volets côte à côte — l'hôte à gauche, le calendrier et ses
  // heures à droite. Mesuré à 634 px : la grille du mois tombe sous 200 px et la colonne
  // des heures lui passe dessus. Aucune autre étape n'a ce besoin, aucune autre n'est
  // élargie.
  return (
    <div className="inner-container _1050px center">
      {/* Mêmes marges que les trois étapes précédentes, posées sur le <h1> lui-même :
          la feuille de base lui donne un `margin` que `.display-6` ne remet pas à zéro,
          et un wrapper sans bordure FUSIONNE avec ces marges au lieu de s'y ajouter. */}
      <h1 className="display-6 mg-top-3x-extra-small mg-bottom-2x-extra-small">
        {t('call.intro.title')}
      </h1>

      <div className="mg-top-medium">
        <OcBooking mode="deferred" choice={choice} onChoiceChange={onChoiceChange} onStateChange={onStateChange} />
      </div>
    </div>
  )
}
