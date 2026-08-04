/**
 * Page publique — gestion de l'appel d'accueil par son lien personnel.
 *
 * Route `/rendez-vous-accueil/:token`. Le jeton EST l'authentification : c'est une
 * capability URL, servie par la RPC `get_onboarding_call_by_token` (SECURITY DEFINER,
 * scopée jeton), jamais par une policy `manage_token is not null` — cette forme-là avait
 * ouvert toute la table `visits` en lecture et en écriture à la clé anonyme
 * (cf. migration 20260711190000).
 *
 * ⚠ La route était `/rendez-vous/:token` jusqu'au 04.08.2026, chemin DÉJÀ pris par
 * AppointmentManagePage (RDV de vérification KYC) et déclaré avant elle dans App.tsx :
 * React Router retenant la première correspondance, cette page n'a jamais été atteinte
 * depuis sa création, et tout lien « replanifier ou annuler » d'un e-mail d'appel
 * d'accueil ouvrait l'écran KYC. Le chemin vit à SIX endroits — cette route, les trois
 * edge functions qui bâtissent l'URL (onboarding-call-book, -manage, -reminder) et les
 * deux gardes de redaction de jeton (src/lib/sentry.ts + sa jumelle d'index.html, plus
 * _shared/pii-redaction.ts côté edge). Les six ont bougé ensemble ; `tests/unit/
 * token-routes.spec.ts` tient les gardes.
 *
 * Contrairement à `VisitManagePage`, les heures proposées ici ne sont pas une liste
 * figée : elles viennent du même moteur de créneaux que la réservation initiale, donc
 * elles tiennent compte de l'agenda réel de l'hôte.
 *
 * HABILLAGE : MEGGA X depuis le 4 août 2026, comme les deux autres écrans de
 * rendez-vous. C'est la peau de la vitrine, et c'est exactement ce qu'il faut ici : le
 * visiteur arrive d'un e-mail, hors du CRM, souvent sans y avoir jamais mis les pieds.
 * Elle n'existe qu'en une polarité, donc cette page ne suit aucune préférence
 * clair/sombre — elle n'en avait déjà aucune à suivre (elle forçait le thème clair).
 *
 * Elle NE MONTE PAS OcBooking, contrairement aux deux surfaces connectées : il n'y a ni
 * téléphone ni note à demander à quelqu'un qui déplace un rendez-vous déjà pris, et
 * l'écriture passe par une autre edge function (jeton, pas session). Le calendrier
 * (OcSlotPicker) et la carte de confirmation (OcBookedCard) sont en revanche les mêmes,
 * pour que le rendez-vous se lise partout pareil.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MeggaX, MxButton, MxLink } from '@/components/megga-x'
import OcSlotPicker from '@/components/onboarding-call/OcSlotPicker'
import OcBookedCard from '@/components/onboarding-call/OcBookedCard'
import { dayKeyOf } from '@/components/onboarding-call/ocDates'
import {
  usePublicOnboardingCall,
  useOnboardingSlots,
  useManageOnboardingCall,
  browserTimezone,
} from '@/hooks/useOnboardingCall'

type Mode = 'view' | 'reschedule' | 'done_cancelled' | 'done_rescheduled'

/** Refus que l'edge function nomme, et pour lesquels l'écran a une phrase propre. */
const KNOWN_MANAGE_ERRORS = [
  'slot_taken', 'reschedule_limit_reached', 'call_in_past', 'call_not_active', 'slot_in_past',
]

function monthBounds(month: Date): { from: string; to: string } {
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const now = new Date()
  return { from: (from < now ? now : from).toISOString(), to: to.toISOString() }
}

export default function OnboardingCallManagePage() {
  const { t } = useTranslation('onboarding')
  const { token } = useParams<{ token: string }>()
  const timezone = useMemo(() => browserTimezone(), [])

  const [mode, setMode] = useState<Mode>('view')
  const [month, setMonth] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const call = usePublicOnboardingCall(token)
  const bounds = useMemo(() => monthBounds(month), [month])
  const slotsQuery = useOnboardingSlots(
    mode === 'reschedule' ? bounds.from : null,
    mode === 'reschedule' ? bounds.to : null,
    token,
  )
  const manage = useManageOnboardingCall()

  const slots = useMemo(() => slotsQuery.data?.slots ?? [], [slotsQuery.data])

  useEffect(() => {
    if (mode !== 'reschedule' || selectedDay || slots.length === 0) return
    setSelectedDay(dayKeyOf(slots[0], timezone))
  }, [mode, slots, selectedDay, timezone])

  /**
   * Coquille commune : en-tête au logo de la vitrine, contenu centré.
   *
   * Le logo n'est PAS un lien, comme dans le wizard : le visiteur vient gérer un
   * rendez-vous, l'envoyer sur la page d'accueil serait lui faire perdre le sien.
   */
  const shell = (children: React.ReactNode) => (
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
          <div className="container-default w-container mx-scrollarea mx-scrollarea--center">
            <div className="inner-container _634px center">{children}</div>
          </div>
        </section>
      </div>
    </MeggaX>
  )

  if (call.isLoading) {
    return shell(
      <div className="text-center" role="status" aria-live="polite">
        <p className="paragraph-large">{t('call.public.loading')}</p>
      </div>,
    )
  }

  if (call.isError || !call.data) {
    return shell(
      <div className="card sign-in-card">
        <div className="pd---content-inside-card text-center">
          <h1 className="display-6">{t('call.public.invalid.title')}</h1>
          <p className="paragraph-large text-paragraph mg-top-4x-extra-small">
            {t('call.public.invalid.body')}
          </p>
        </div>
      </div>,
    )
  }

  const data = call.data

  if (mode === 'done_cancelled' || mode === 'done_rescheduled') {
    const key = mode === 'done_cancelled' ? 'cancelled' : 'rescheduled'
    return shell(
      <div className="card sign-in-card">
        <div className="pd---content-inside-card text-center">
          <h1 className="display-6">{t(`call.public.${key}.title`)}</h1>
          <p className="paragraph-large text-paragraph mg-top-4x-extra-small">
            {t(`call.public.${key}.body`)}
          </p>
        </div>
      </div>,
    )
  }

  const errorMessage = manage.error instanceof Error ? manage.error.message : null
  const errorKey = errorMessage
    ? KNOWN_MANAGE_ERRORS.includes(errorMessage) ? errorMessage : 'generic'
    : null

  // ── Replanification : le même calendrier qu'à la réservation initiale ──
  if (data.status === 'confirmed' && mode === 'reschedule') {
    return shell(
      <>
        <h1 className="display-6 mg-bottom-2x-extra-small">{t('call.public.reschedule')}</h1>
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

            {errorKey && (
              <p className="paragraph-small mx-field__error mg-top-3x-extra-small" role="alert">
                {t(`call.errors.${errorKey}`)}
              </p>
            )}

            <div className="mg-top-small flex-horizontal gap-16px">
              <MxButton
                type="button"
                disabled={!selectedSlot || manage.isPending}
                onClick={() => {
                  if (!token || !selectedSlot) return
                  manage.mutate(
                    { token, action: 'reschedule', slot: selectedSlot },
                    { onSuccess: () => setMode('done_rescheduled') },
                  )
                }}
              >
                {manage.isPending ? t('call.actions.confirming') : t('call.public.confirmReschedule')}
              </MxButton>
              <MxLink onClick={() => setMode('view')}>{t('call.public.back')}</MxLink>
            </div>
          </div>
        </div>
      </>,
    )
  }

  // ── Vue par défaut : le rendez-vous, et ce qu'on peut en faire ──
  return shell(
    <>
      <h1 className="display-6 mg-bottom-2x-extra-small">{t('call.public.title')}</h1>

      {data.status !== 'confirmed' ? (
        <div className="card">
          <div className="pd---content-inside-card">
            <p className="paragraph-large text-paragraph">{t('call.public.notActive')}</p>
          </div>
        </div>
      ) : (
        <OcBookedCard
          scheduledAt={data.scheduled_at}
          hostName={data.host_name}
          durationMinutes={data.duration_minutes}
          meetingUrl={data.meeting_url}
          timezone={timezone}
          // Trop tard pour toucher au rendez-vous : le dire sous la carte plutôt que
          // d'afficher deux boutons inertes.
          note={data.can_manage ? undefined : t('call.public.tooLate')}
        >
          {data.can_manage && (
            <div className="flex-horizontal gap-16px">
              <MxButton
                type="button"
                variant="secondary"
                disabled={!data.can_reschedule}
                onClick={() => setMode('reschedule')}
              >
                {t('call.public.reschedule')}
              </MxButton>
              <MxLink
                onClick={() => {
                  if (!token) return
                  manage.mutate(
                    { token, action: 'cancel' },
                    { onSuccess: () => setMode('done_cancelled') },
                  )
                }}
                disabled={manage.isPending}
              >
                {t('call.public.cancel')}
              </MxLink>
            </div>
          )}
          {/* La limite de replanification explique un bouton désactivé : sans elle, il
              ne reste qu'un bouton mort et aucune raison. */}
          {data.can_manage && !data.can_reschedule && (
            <p className="paragraph-small text-color-neutral-600 mg-top-3x-extra-small">
              {t('call.errors.reschedule_limit_reached')}
            </p>
          )}
          {errorKey && (
            <p className="paragraph-small mx-field__error mg-top-3x-extra-small" role="alert">
              {t(`call.errors.${errorKey}`)}
            </p>
          )}
        </OcBookedCard>
      )}
    </>,
  )
}
