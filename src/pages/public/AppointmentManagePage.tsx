// MEGGA — Page publique de gestion d'un rendez-vous de vérification KYC.
// Route /rendez-vous/:token (publique, HORS AgentLayout).
//
// Le client arrive ici depuis le lien de son courriel de confirmation. Il peut
// déplacer ou annuler SON rendez-vous, tant qu'il reste hors de la fenêtre de
// prévenance et sous le plafond de reports — deux règles appliquées par les RPC,
// jamais recalculées ici. L'UI se contente de lire `can_change` pour ne pas
// proposer un geste qui serait refusé.
//
// Le jeton porte k='appt' : c'est l'edge qui refuse un lien magique KYC présenté
// à cette adresse.

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MLK } from '@/components/kyc-magic-link/mlkTokens'
import { MlkBackground, MlkShell, MlkWordmark, MlkBlackPill, MlkFooter } from '@/components/kyc-magic-link/MlkPrimitives'
import { MlkAppointmentCard } from '@/components/kyc-magic-link/MlkBooking'
import { MlkSlotPicker } from '@/components/kyc-magic-link/MlkSlotPicker'
import { inZone } from '@/components/kyc-magic-link/mlkDateFormat'
import {
  useAppointmentByToken,
  useAppointmentSlots,
  useManageAppointment,
  type PublicAppointment,
} from '@/hooks/useAppointmentBooking'

type Mode = 'view' | 'reschedule' | 'confirm_cancel'

/** Bouton secondaire (contour discret) — le noir plein est réservé à l'action principale. */
function GhostButton({ onClick, children, disabled }: {
  onClick: () => void; children: React.ReactNode; disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, height: 46, borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        fontFamily: MLK.font, fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.1,
        background: MLK.card, color: disabled ? MLK.ghost : MLK.inkSoft,
        border: 'none', boxShadow: MLK.shadowSm,
      }}
    >
      {children}
    </button>
  )
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ padding: '26px 24px', background: MLK.cardSubtle, borderRadius: 18, textAlign: 'center' }}>
      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: MLK.ink, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 'var(--crm-text-md)', color: MLK.inkSoft, fontWeight: 500, lineHeight: 1.6 }}>{body}</div>
    </div>
  )
}

export default function AppointmentManagePage() {
  const { token } = useParams<{ token: string }>()
  const { t } = useTranslation('kyc')
  const { data, isLoading, isError } = useAppointmentByToken(token)
  const manageMut = useManageAppointment()

  const [mode, setMode] = useState<Mode>('view')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [done, setDone] = useState<PublicAppointment | null>(null)

  // Créneaux chargés UNIQUEMENT en mode report : c'est un appel free/busy vers
  // l'agenda de l'agent, inutile de le déclencher à la simple consultation.
  const slotsQuery = useAppointmentSlots(mode === 'reschedule' ? token : undefined)

  const shell = (children: React.ReactNode) => (
    <MlkBackground>
      <MlkShell width={640} pad={52}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 30 }}>
          <MlkWordmark size={16} />
        </div>
        {children}
        <MlkFooter />
      </MlkShell>
    </MlkBackground>
  )

  if (!token) return shell(<Notice title={t('client.manage.invalid_title')} body={t('client.manage.invalid_body')} />)
  if (isLoading) return shell(<Notice title={t('client.booking.loading_title')} body={t('client.booking.loading_body')} />)

  // `isError` (ou data absente) traité SÉPARÉMENT du chargement : les confondre
  // laissait la page sur « Recherche des disponibilités… » indéfiniment dès que
  // la requête échouait, sans jamais rien dire au client.
  if (isError || !data) {
    return shell(<Notice title={t('client.booking.network_title')} body={t('client.booking.network_body')} />)
  }

  if ('error' in data) {
    if (data.error === 'network') {
      return shell(<Notice title={t('client.booking.network_title')} body={t('client.booking.network_body')} />)
    }
    const key = data.error === 'expired' ? 'expired' : data.error === 'not_found' ? 'not_found' : 'invalid'
    return shell(<Notice title={t(`client.manage.${key}_title`)} body={t(`client.manage.${key}_body`)} />)
  }

  const appointment = done ?? data
  const when = inZone(appointment.starts_at, appointment.timezone)

  // ── Après annulation ou report ──
  if (done) {
    return shell(
      <>
        <h1 className="mlk-h1" style={{ margin: '0 0 12px', fontSize: 'var(--crm-text-6xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.7, textAlign: 'center' }}>
          {done.status === 'cancelled' ? t('client.manage.cancelled_title') : t('client.manage.rescheduled_title')}
        </h1>
        <p style={{ margin: '0 auto 26px', fontSize: 'var(--crm-text-lg)', color: MLK.inkSoft, fontWeight: 500, lineHeight: 1.6, textAlign: 'center', maxWidth: 400 }}>
          {done.status === 'cancelled' ? t('client.manage.cancelled_body') : t('client.manage.rescheduled_body')}
        </p>
        {done.status !== 'cancelled' && <MlkAppointmentCard appointment={done} />}
      </>,
    )
  }

  // ── Rendez-vous déjà annulé côté serveur ──
  if (appointment.status === 'cancelled') {
    return shell(
      <>
        <MlkAppointmentCard appointment={appointment} />
        <Notice title={t('client.manage.already_cancelled_title')} body={t('client.manage.already_cancelled_body')} />
      </>,
    )
  }

  // ── Report ──
  if (mode === 'reschedule') {
    const slots = slotsQuery.data
    const failure = manageMut.error
    return shell(
      <>
        <h1 className="mlk-h1" style={{ margin: '0 0 22px', fontSize: 'var(--crm-text-5xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.6, textAlign: 'center' }}>
          {t('client.manage.reschedule_title')}
        </h1>

        {slotsQuery.isLoading || !slots ? (
          <Notice title={t('client.booking.loading_title')} body={t('client.booking.loading_body')} />
        ) : slots.unavailable || slots.slots.length === 0 ? (
          <Notice title={t('client.booking.empty_title')} body={t('client.booking.empty_body', { days: slots.max_advance_days })} />
        ) : (
          <>
            <MlkSlotPicker
              slots={slots.slots}
              timezone={slots.timezone}
              selected={selectedSlot}
              onSelect={setSelectedSlot}
              activeDay={selectedDay}
              onDayChange={(k) => { setSelectedDay(k); setSelectedSlot(null) }}
            />
            {failure && (
              <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 16, background: '#FEF2F2', fontSize: 'var(--crm-text-md)', color: '#B42318', fontWeight: 500, lineHeight: 1.5 }}>
                {t(`client.booking.error_${failure.code}`, { defaultValue: t('client.booking.error_default') })}
              </div>
            )}
            <MlkBlackPill
              full
              disabled={!selectedSlot || manageMut.isPending}
              onClick={() => {
                if (!selectedSlot) return
                manageMut.mutate(
                  { token, action: 'reschedule', startsAt: selectedSlot },
                  { onSuccess: setDone },
                )
              }}
            >
              {manageMut.isPending
                ? t('client.booking.cta_booking')
                : selectedSlot
                  ? t('client.booking.cta_confirm_at', { when: inZone(selectedSlot, slots.timezone).full })
                  : t('client.booking.cta_pick')}
            </MlkBlackPill>
          </>
        )}

        <div style={{ marginTop: 12 }}>
          <GhostButton onClick={() => { setMode('view'); manageMut.reset() }}>
            {t('client.manage.back')}
          </GhostButton>
        </div>
      </>,
    )
  }

  // ── Confirmation d'annulation — geste irréversible, jamais en un seul clic ──
  if (mode === 'confirm_cancel') {
    const failure = manageMut.error
    return shell(
      <>
        <MlkAppointmentCard appointment={appointment} />
        <Notice title={t('client.manage.confirm_cancel_title')} body={t('client.manage.confirm_cancel_body')} />
        {failure && (
          <div style={{ padding: '12px 16px', borderRadius: 12, margin: '16px 0 0', background: '#FEF2F2', fontSize: 'var(--crm-text-md)', color: '#B42318', fontWeight: 500, lineHeight: 1.5 }}>
            {t(`client.booking.error_${failure.code}`, { defaultValue: t('client.booking.error_default') })}
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <GhostButton onClick={() => { setMode('view'); manageMut.reset() }} disabled={manageMut.isPending}>
            {t('client.manage.keep')}
          </GhostButton>
          <div style={{ flex: 1 }}>
            <MlkBlackPill
              full
              size="md"
              disabled={manageMut.isPending}
              onClick={() => manageMut.mutate({ token, action: 'cancel' }, { onSuccess: setDone })}
            >
              {manageMut.isPending ? t('client.manage.cancelling') : t('client.manage.confirm_cancel_cta')}
            </MlkBlackPill>
          </div>
        </div>
      </>,
    )
  }

  // ── Vue par défaut ──
  return shell(
    <>
      <h1 className="mlk-h1" style={{ margin: '0 0 10px', fontSize: 'var(--crm-text-5xl)', fontWeight: 600, color: MLK.ink, letterSpacing: -0.6, textAlign: 'center' }}>
        {t('client.manage.title')}
      </h1>
      <p style={{ margin: '0 auto 24px', fontSize: 'var(--crm-text-lg)', color: MLK.inkSoft, fontWeight: 500, lineHeight: 1.6, textAlign: 'center', maxWidth: 400 }}>
        {t('client.manage.subtitle', { when: when.full })}
      </p>

      <MlkAppointmentCard appointment={appointment} />

      {appointment.can_change ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <GhostButton onClick={() => setMode('reschedule')}>{t('client.manage.reschedule')}</GhostButton>
          <GhostButton onClick={() => setMode('confirm_cancel')}>{t('client.manage.cancel')}</GhostButton>
        </div>
      ) : (
        <Notice title={t('client.manage.locked_title')} body={t('client.manage.locked_body')} />
      )}
    </>,
  )
}
