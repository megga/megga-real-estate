/**
 * Réservation de l'appel d'accueil — le bloc complet, partagé par les deux surfaces
 * connectées qui le portent : l'étape 4 du wizard d'identité (StepRendezVous) et
 * l'écran `/dashboard/rendez-vous-accueil` (OnboardingCallPage), qui sert désormais
 * ceux qui ont franchi le wizard avant que l'étape n'existe, le bandeau de rappel du
 * CRM, et toute reprise ultérieure.
 *
 * Deux surfaces, un seul composant, parce que c'est le MÊME geste : sans ça, les deux
 * écrans divergeraient au premier correctif porté d'un seul côté. La page publique de
 * replanification (OnboardingCallManagePage) ne le monte pas — elle n'a ni téléphone
 * ni note à demander, et son jeton la fait passer par une autre edge — mais partage
 * avec lui le calendrier (OcSlotPicker) et la carte de confirmation (OcBookedCard).
 *
 * ÉTAT ET ÉCRITURE. Ce composant détient l'état de saisie (mois affiché, jour, créneau,
 * téléphone, note) et déclenche l'écriture lui-même. La réservation est engagée AU CLIC
 * sur Confirmer, pas à la soumission du dossier : l'edge function écrit la ligne, envoie
 * les e-mails et pose l'événement dans l'agenda de l'hôte d'un bloc (cf. son en-tête —
 * « l'ordre des opérations est la fonctionnalité »). Conséquence assumée : quelqu'un qui
 * abandonne le wizard après cette étape garde son rendez-vous, ce qui vaut mieux que
 * l'inverse — un créneau seulement « retenu » côté navigateur peut être pris entre-temps,
 * et le refus tomberait alors au moment le plus sensible du parcours.
 *
 * HABILLAGE : MEGGA X. Suppose d'être rendu dans un conteneur `<MeggaX>`.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MxButton, MxField, MxInput } from '@/components/megga-x'
import OcSlotPicker from './OcSlotPicker'
import OcBookedCard from './OcBookedCard'
import { dayKeyOf } from './ocDates'
import {
  useMyOnboardingCall,
  useOnboardingSlots,
  useBookOnboardingCall,
  browserTimezone,
} from '@/hooks/useOnboardingCall'

/** Refus que l'edge function nomme, et pour lesquels l'écran a une phrase propre. */
const KNOWN_BOOK_ERRORS = ['slot_taken', 'already_booked', 'no_host_available', 'slot_in_past']

/**
 * Ce que l'appelant doit savoir de l'état de la réservation, à chaque changement.
 *
 * `booked` gate le bouton Continuer de l'étape du wizard ; `nothingToBook` dit qu'il
 * n'y a RIEN à réserver (aucun hôte actif, ou plus aucun créneau sur l'horizon) et
 * lève cette exigence — sans quoi l'étape serait un cul-de-sac, ce qu'elle serait
 * aujourd'hui même : la table `onboarding_hosts` est vide en production.
 */
export interface OcBookingState {
  booked: boolean
  nothingToBook: boolean
}

export interface OcBookingProps {
  /** Remonté à chaque changement d'état — l'appelant en fait ce qu'il veut (gate, bouton). */
  onStateChange?: (state: OcBookingState) => void
  /**
   * Rendu SOUS le bloc quand rien n'est encore réservé : la sortie propre à chaque
   * surface (« Plus tard » sur l'écran du CRM, rien dans le wizard, où le pied
   * d'actions de la coquille porte déjà la navigation).
   */
  secondaryAction?: React.ReactNode
}

/** Bornes ISO du mois affiché — jamais de créneau déjà passé sur le mois courant. */
function monthBounds(month: Date): { from: string; to: string } {
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const now = new Date()
  return {
    from: (from < now ? now : from).toISOString(),
    to: to.toISOString(),
  }
}

export default function OcBooking({ onStateChange, secondaryAction }: OcBookingProps) {
  const { t } = useTranslation('onboarding')

  const timezone = useMemo(() => browserTimezone(), [])
  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')

  const bounds = useMemo(() => monthBounds(month), [month])
  const existing = useMyOnboardingCall()
  const slotsQuery = useOnboardingSlots(bounds.from, bounds.to)
  const book = useBookOnboardingCall()

  const slots = useMemo(() => slotsQuery.data?.slots ?? [], [slotsQuery.data])

  // Ouvrir sur le premier jour qui a quelque chose à proposer : demander à
  // l'utilisateur de chercher lui-même le prochain jour ouvert est du travail qu'on
  // sait faire pour lui.
  useEffect(() => {
    if (selectedDay || slots.length === 0) return
    setSelectedDay(dayKeyOf(slots[0], timezone))
  }, [slots, selectedDay, timezone])

  // Le rendez-vous qui vient d'être pris l'emporte sur celui qui a été lu au montage :
  // la lecture est mise en cache 60 s, elle peut encore répondre « aucun » juste après
  // une réservation réussie.
  const booked = book.data
    ? {
        scheduledAt: book.data.scheduled_at,
        hostName: book.data.host_name,
        meetingUrl: book.data.meeting_url,
        durationMinutes: book.data.duration_minutes,
      }
    : existing.data
      ? {
          scheduledAt: existing.data.scheduled_at,
          hostName: existing.data.host_display_name,
          meetingUrl: existing.data.meeting_url,
          durationMinutes: existing.data.duration_minutes,
        }
      : null

  const poolEmpty = slotsQuery.data?.pool_empty === true
  const nothingFree = !slotsQuery.isLoading && !poolEmpty && slots.length === 0
  const nothingToBook = poolEmpty || nothingFree

  // Remontée à l'appelant. Les deux booléens sont dérivés du rendu courant, donc
  // l'effet ne fait que les transmettre — jamais de second état parallèle à tenir.
  useEffect(() => {
    onStateChange?.({ booked: booked != null, nothingToBook })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onStateChange est une prop
    // que l'appelant recrée à chaque rendu (fonction inline) : la mettre en dépendance
    // relancerait l'effet en boucle. Seuls les deux faits transmis comptent.
  }, [booked != null, nothingToBook])

  const errorKey = book.error instanceof Error ? book.error.message : null
  const knownError = errorKey && KNOWN_BOOK_ERRORS.includes(errorKey)
    ? errorKey
    : errorKey
      ? 'generic'
      : null

  if (booked) {
    return (
      <OcBookedCard
        scheduledAt={booked.scheduledAt}
        hostName={booked.hostName}
        durationMinutes={booked.durationMinutes}
        meetingUrl={booked.meetingUrl}
        timezone={timezone}
        note={t('call.confirmed.emailSent')}
      />
    )
  }

  // Rien à réserver : le dire honnêtement plutôt que d'afficher un calendrier vide,
  // que le visiteur passerait à fouiller mois après mois.
  if (nothingToBook) {
    return (
      <div className="card">
        <div className="pd---content-inside-card">
          <p className="paragraph-large text-paragraph">
            {t(poolEmpty ? 'call.empty.noHost' : 'call.empty.noSlot')}
          </p>
          {secondaryAction && <div className="mg-top-small">{secondaryAction}</div>}
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="pd---content-inside-card">
        <OcSlotPicker
          slots={slots}
          month={month}
          onMonthChange={(next) => { setMonth(next); setSelectedDay(null); setSelectedSlot(null) }}
          selectedDay={selectedDay}
          onSelectDay={(day) => { setSelectedDay(day); setSelectedSlot(null) }}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
          timezone={timezone}
          loading={slotsQuery.isLoading}
        />

        <div className="grid-2-columns mg-top-small">
          <MxField label={t('call.form.phone')}>
            {(id) => (
              <MxInput
                id={id}
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('call.form.phonePlaceholder')}
              />
            )}
          </MxField>
          <MxField label={t('call.form.note')}>
            {(id) => (
              <MxInput
                id={id}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('call.form.notePlaceholder')}
              />
            )}
          </MxField>
        </div>

        {knownError && (
          <p className="paragraph-small mx-field__error mg-top-3x-extra-small" role="alert">
            {t(`call.errors.${knownError}`)}
          </p>
        )}

        <div className="mg-top-small flex-horizontal gap-16px">
          <MxButton
            type="button"
            onClick={() => {
              if (!selectedSlot) return
              book.mutate({
                slot: selectedSlot,
                phone: phone.trim() || undefined,
                note: note.trim() || undefined,
              })
            }}
            disabled={!selectedSlot || book.isPending}
          >
            {book.isPending ? t('call.actions.confirming') : t('call.actions.confirm')}
          </MxButton>
          {secondaryAction}
        </div>
      </div>
    </div>
  )
}
