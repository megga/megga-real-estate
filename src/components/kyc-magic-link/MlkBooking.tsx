// MEGGA — Écrans de prise de rendez-vous du parcours client KYC.
//
// Affichés une fois le dossier soumis : le client choisit lui-même son créneau
// de vérification d'identité, sur les disponibilités réelles de son agent.
//
// FUSEAU. L'edge renvoie des instants UTC et le fuseau de l'AGENT. Tout est
// rendu dans ce fuseau via TZDate (@date-fns/tz) : un client qui ouvre le lien
// en voyage doit lire l'heure du rendez-vous telle qu'elle sera vécue sur
// place, pas celle de son téléphone. C'est aussi ce qui garde la liste
// cohérente quand elle chevauche une bascule DST — deux jours consécutifs n'y
// ont pas le même décalage UTC.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MLK } from './mlkTokens'
import { MlkShell, MlkWordmark, MlkIcon, MlkBlackPill, MlkFooter, MlkFailureNotice } from './MlkPrimitives'
import { MlkSlotPicker } from './MlkSlotPicker'
import { inZone } from './mlkDateFormat'
import {
  useAppointmentSlots,
  useBookAppointment,
  type PublicAppointment,
  type SlotsUnavailableReason,
} from '@/hooks/useAppointmentBooking'

// ─── Bloc « rendez-vous confirmé » — partagé avec la page de gestion ──────────

export function MlkAppointmentCard({ appointment }: { appointment: PublicAppointment }) {
  const { t } = useTranslation('kyc')
  const when = inZone(appointment.starts_at, appointment.timezone)
  const isCancelled = appointment.status === 'cancelled'

  return (
    <div
      style={{
        padding: '22px 24px',
        background: MLK.card,
        borderRadius: 20,
        boxShadow: MLK.shadow,
        marginBottom: 24,
        opacity: isCancelled ? 0.6 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <div
          style={{
            width: 38, height: 38, borderRadius: 999,
            background: isCancelled ? MLK.ghost : MLK.ink,
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <MlkIcon name={isCancelled ? 'alert' : 'check'} size={19} stroke="#fff" sw={2.2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.2 }}>
            {when.dayLabel}
          </div>
          <div style={{ fontSize: 'var(--crm-text-md)', color: MLK.muted, fontWeight: 500, marginTop: 1 }}>
            {t('client.booking.at_time', { time: when.time })}
          </div>
        </div>
      </div>

      {appointment.mode === 'video' ? (
        <div style={{ fontSize: 'var(--crm-text-md)', color: MLK.inkSoft, fontWeight: 500 }}>
          {appointment.video_link ? (
            <a href={appointment.video_link} style={{ color: MLK.ink, fontWeight: 600 }}>
              {t('client.booking.join_video')}
            </a>
          ) : (
            t('client.booking.video_link_later')
          )}
        </div>
      ) : appointment.location ? (
        <div style={{ fontSize: 'var(--crm-text-md)', color: MLK.inkSoft, fontWeight: 500 }}>{appointment.location}</div>
      ) : null}
    </div>
  )
}

// ─── Message plein écran (indisponible / vide) ────────────────────────────────

function BookingNotice({ title, body }: { title: string; body: string }) {
  return (
    <div
      style={{
        padding: '26px 24px',
        background: MLK.cardSubtle,
        borderRadius: 18,
        marginBottom: 24,
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: MLK.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 'var(--crm-text-md)', color: MLK.inkSoft, fontWeight: 500, lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

/** Chacun des motifs d'indisponibilité appelle son propre message. */
function noticeFor(reason: SlotsUnavailableReason, t: (k: string) => string) {
  switch (reason) {
    case 'booking_closed':
      return { title: t('client.booking.closed_title'), body: t('client.booking.closed_body') }
    case 'calendar_unavailable':
      return { title: t('client.booking.unavailable_title'), body: t('client.booking.unavailable_body') }
    case 'link_expired':
      return { title: t('client.booking.expired_title'), body: t('client.booking.expired_body') }
    case 'link_invalid':
      return { title: t('client.booking.invalid_title'), body: t('client.booking.invalid_body') }
    default:
      return { title: t('client.booking.network_title'), body: t('client.booking.network_body') }
  }
}

// ─── Écran principal ──────────────────────────────────────────────────────────

interface BookingProps {
  token: string
  firstName: string
  agentFullName: string
  agencyName: string
}

export function MlkBooking({ token, firstName, agentFullName, agencyName }: BookingProps) {
  const { t } = useTranslation('kyc')
  const { data, isLoading, isError } = useAppointmentSlots(token)
  const bookMut = useBookAppointment()

  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [booked, setBooked] = useState<PublicAppointment | null>(null)

  const timezone = data?.timezone ?? 'Europe/Zurich'

  // ── Confirmation (vient de réserver, ou lien déjà utilisé) ──
  const confirmed = booked ?? (data?.already_booked ? data.appointment ?? null : null)
  if (confirmed) {
    return (
      <MlkShell width={640} pad={52}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <MlkWordmark size={16} />
        </div>
        <h1
          className="mlk-h1"
          style={{
            margin: '0 0 12px', fontSize: 'var(--crm-text-6xl)', fontWeight: 600, color: MLK.ink,
            letterSpacing: -0.8, lineHeight: 1.15, textAlign: 'center',
          }}
        >
          {t('client.booking.confirmed_title')}
        </h1>
        <p
          style={{
            margin: '0 auto 30px', fontSize: 'var(--crm-text-lg)', color: MLK.inkSoft, fontWeight: 500,
            lineHeight: 1.6, textAlign: 'center', maxWidth: 420,
          }}
        >
          {t('client.booking.confirmed_body', { agentName: agentFullName, agencyName })}
        </p>
        <MlkAppointmentCard appointment={confirmed} />
        <p style={{ margin: '0 0 8px', fontSize: 'var(--crm-text-sm)', color: MLK.muted, textAlign: 'center', lineHeight: 1.6 }}>
          {t('client.booking.confirmed_email')}
        </p>
        <MlkFooter />
      </MlkShell>
    )
  }

  // ── Chargement ──
  if (isLoading) {
    return (
      <MlkShell width={640} pad={52}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <MlkWordmark size={16} />
        </div>
        <BookingNotice title={t('client.booking.loading_title')} body={t('client.booking.loading_body')} />
        <MlkFooter />
      </MlkShell>
    )
  }

  // ── Échec de la requête — distinct du chargement, sinon l'écran reste figé
  //    sur « recherche des disponibilités » sans jamais rien annoncer. ──
  if (isError || !data) {
    return (
      <MlkShell width={640} pad={52}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <MlkWordmark size={16} />
        </div>
        <BookingNotice title={t('client.booking.network_title')} body={t('client.booking.network_body')} />
        <MlkFooter />
      </MlkShell>
    )
  }

  // ── Indisponible : chaque motif a son message, jamais « une erreur est survenue » ──
  const unavailable = data.unavailable ?? (data.slots.length === 0 ? 'no_slots' : null)
  if (unavailable) {
    const notice = unavailable === 'no_slots'
      ? { title: t('client.booking.empty_title'), body: t('client.booking.empty_body', { days: data.max_advance_days }) }
      : noticeFor(unavailable as SlotsUnavailableReason, t)
    return (
      <MlkShell width={640} pad={52}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
          <MlkWordmark size={16} />
        </div>
        <BookingNotice {...notice} />
        <div style={{ fontSize: 'var(--crm-text-sm)', color: MLK.muted, textAlign: 'center' }}>
          {t('client.booking.contact_agent', { agentName: agentFullName, agencyName })}
        </div>
        <MlkFooter />
      </MlkShell>
    )
  }

  // ── Sélection ──
  const failure = bookMut.error
  return (
    <MlkShell width={680} pad={52}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
        <MlkWordmark size={16} />
      </div>

      <h1
        className="mlk-h1"
        style={{
          margin: '0 0 12px', fontSize: 'var(--crm-text-6xl)', fontWeight: 600, color: MLK.ink,
          letterSpacing: -0.8, lineHeight: 1.15, textAlign: 'center',
        }}
      >
        {t('client.booking.title', { firstName })}
      </h1>
      <p
        style={{
          margin: '0 auto 28px', fontSize: 'var(--crm-text-lg)', color: MLK.inkSoft, fontWeight: 500,
          lineHeight: 1.6, textAlign: 'center', maxWidth: 440,
        }}
      >
        {t('client.booking.subtitle', { agentName: agentFullName, minutes: data.slot_minutes })}
      </p>

      <MlkSlotPicker
        slots={data.slots}
        timezone={timezone}
        selected={selectedSlot}
        onSelect={setSelectedSlot}
        activeDay={selectedDay}
        onDayChange={(k) => { setSelectedDay(k); setSelectedSlot(null) }}
      />

      {/* Lieu / mode */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '13px 16px',
          background: MLK.cardSubtle, borderRadius: 14, marginBottom: 20,
        }}
      >
        <MlkIcon name={data.mode === 'video' ? 'lock' : 'home'} size={17} stroke={MLK.muted} />
        <div style={{ fontSize: 'var(--crm-text-sm)', color: MLK.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
          {data.mode === 'video'
            ? t('client.booking.mode_video')
            : data.location
              ? t('client.booking.mode_onsite_at', { location: data.location })
              : t('client.booking.mode_onsite')}
        </div>
      </div>

      {failure && <MlkFailureNotice code={failure.code} style={{ marginBottom: 'var(--crm-space-2xl)' }} />}

      <MlkBlackPill
        onClick={() => {
          if (!selectedSlot) return
          bookMut.mutate({ token, startsAt: selectedSlot }, { onSuccess: setBooked })
        }}
        disabled={!selectedSlot || bookMut.isPending}
      >
        {bookMut.isPending
          ? t('client.booking.cta_booking')
          : selectedSlot
            ? t('client.booking.cta_confirm_at', { when: inZone(selectedSlot, timezone).full })
            : t('client.booking.cta_pick')}
      </MlkBlackPill>

      <MlkFooter />
    </MlkShell>
  )
}
