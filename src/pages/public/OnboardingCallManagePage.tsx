/**
 * Page publique — gestion de l'appel d'accueil par son lien personnel.
 *
 * Route `/rendez-vous/:token`. Le jeton EST l'authentification : c'est une capability
 * URL, servie par la RPC `get_onboarding_call_by_token` (SECURITY DEFINER, scopée
 * jeton), jamais par une policy `manage_token is not null` — cette forme-là avait
 * ouvert toute la table `visits` en lecture et en écriture à la clé anonyme
 * (cf. migration 20260711190000).
 *
 * Contrairement à `VisitManagePage`, les heures proposées ici ne sont pas une liste
 * figée : elles viennent du même moteur de créneaux que la réservation initiale, donc
 * elles tiennent compte de l'agenda réel de l'hôte.
 */
import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, Loader2, Video, X } from 'lucide-react'
import PublicPageHeader from '@/components/layout/PublicPageHeader'
import OcPicker from '@/components/crm-sugar/onboarding-call/OcPicker'
import { dayKeyOf } from '@/components/crm-sugar/onboarding-call/ocDates'
import { crmSugarPalette, sugarThemeTokens } from '@/components/crm-sugar/tokens'
import {
  usePublicOnboardingCall,
  useOnboardingSlots,
  useManageOnboardingCall,
  browserTimezone,
} from '@/hooks/useOnboardingCall'

type Mode = 'view' | 'reschedule' | 'done_cancelled' | 'done_rescheduled'

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

  // Page publique : elle se lit en clair, hors du thème du CRM.
  const sp = useMemo(() => crmSugarPalette(sugarThemeTokens(false, 'graphite'), false, 'graphite'), [])

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

  const slots = slotsQuery.data?.slots ?? []

  useEffect(() => {
    if (mode !== 'reschedule' || selectedDay || slots.length === 0) return
    setSelectedDay(dayKeyOf(slots[0], timezone))
  }, [mode, slots, selectedDay, timezone])

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen" style={{ background: sp.pageBg }}>
      <PublicPageHeader />
      <div className="mx-auto max-w-2xl px-4 py-10">{children}</div>
    </div>
  )

  if (call.isLoading) {
    return shell(
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="h-7 w-7 animate-spin mb-3" style={{ color: sp.soft }} />
        <p className="text-sm" style={{ color: sp.sub }}>{t('call.public.loading')}</p>
      </div>,
    )
  }

  if (call.isError || !call.data) {
    return shell(
      <div className="rounded-2xl p-8 text-center" style={{ background: sp.cardBg, boxShadow: sp.shadow }}>
        <h1 className="text-lg font-bold mb-2" style={{ color: sp.ink }}>{t('call.public.invalid.title')}</h1>
        <p className="text-sm leading-relaxed" style={{ color: sp.sub }}>{t('call.public.invalid.body')}</p>
      </div>,
    )
  }

  const data = call.data
  const when = new Intl.DateTimeFormat('fr-CH', {
    timeZone: timezone,
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(data.scheduled_at))

  if (mode === 'done_cancelled') {
    return shell(
      <div className="rounded-2xl p-8 text-center" style={{ background: sp.cardBg, boxShadow: sp.shadow }}>
        <h1 className="text-lg font-bold mb-2" style={{ color: sp.ink }}>{t('call.public.cancelled.title')}</h1>
        <p className="text-sm leading-relaxed" style={{ color: sp.sub }}>{t('call.public.cancelled.body')}</p>
      </div>,
    )
  }

  if (mode === 'done_rescheduled') {
    return shell(
      <div className="rounded-2xl p-8 text-center" style={{ background: sp.cardBg, boxShadow: sp.shadow }}>
        <h1 className="text-lg font-bold mb-2" style={{ color: sp.ink }}>{t('call.public.rescheduled.title')}</h1>
        <p className="text-sm leading-relaxed" style={{ color: sp.sub }}>{t('call.public.rescheduled.body')}</p>
      </div>,
    )
  }

  const errorMessage = manage.error instanceof Error ? manage.error.message : null
  const errorKey = errorMessage
    ? ['slot_taken', 'reschedule_limit_reached', 'call_in_past', 'call_not_active', 'slot_in_past'].includes(errorMessage)
      ? errorMessage
      : 'generic'
    : null

  return shell(
    <div className="rounded-2xl p-6 md:p-8" style={{ background: sp.cardBg, boxShadow: sp.shadow }}>
      <div className="flex items-start gap-3 mb-6">
        <div
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: sp.cardSubBg, color: sp.ink }}
        >
          <CalendarCheck className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-bold" style={{ color: sp.ink }}>
            {t('call.public.title')}
          </h1>
          <p className="text-sm mt-0.5 first-letter:uppercase" style={{ color: sp.sub }}>
            {when} · {data.duration_minutes} min · {data.host_name}
          </p>
        </div>
      </div>

      {data.status !== 'confirmed' && (
        <p className="text-sm leading-relaxed" style={{ color: sp.sub }}>
          {t('call.public.notActive')}
        </p>
      )}

      {data.status === 'confirmed' && mode === 'view' && (
        <>
          {data.meeting_url && (
            <a
              href={data.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold mb-6"
              style={{ background: sp.accent, color: sp.accentInk }}
            >
              <Video className="h-4 w-4" />
              {t('call.confirmed.join')}
            </a>
          )}

          {!data.can_manage && (
            <p className="text-sm leading-relaxed" style={{ color: sp.soft }}>
              {t('call.public.tooLate')}
            </p>
          )}

          {data.can_manage && (
            <div className="flex flex-wrap items-center gap-3 pt-5" style={{ borderTop: `1px solid ${sp.cardBorder}` }}>
              <button
                type="button"
                disabled={!data.can_reschedule}
                onClick={() => setMode('reschedule')}
                className="rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: sp.cardSubBg, color: sp.ink }}
              >
                {t('call.public.reschedule')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!token) return
                  manage.mutate(
                    { token, action: 'cancel' },
                    { onSuccess: () => setMode('done_cancelled') },
                  )
                }}
                disabled={manage.isPending}
                className="inline-flex items-center gap-1.5 text-sm font-medium"
                style={{ color: sp.soft }}
              >
                {manage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                {t('call.public.cancel')}
              </button>
              {!data.can_reschedule && (
                <span className="text-xs" style={{ color: sp.soft }}>
                  {t('call.errors.reschedule_limit_reached')}
                </span>
              )}
            </div>
          )}
        </>
      )}

      {data.status === 'confirmed' && mode === 'reschedule' && (
        <>
          <OcPicker
            slots={slots}
            month={month}
            onMonthChange={(next) => { setMonth(next); setSelectedDay(null); setSelectedSlot(null) }}
            selectedDay={selectedDay}
            onSelectDay={(day) => { setSelectedDay(day); setSelectedSlot(null) }}
            selectedSlot={selectedSlot}
            onSelectSlot={setSelectedSlot}
            timezone={timezone}
            loading={slotsQuery.isLoading}
            sp={sp}
          />

          {errorKey && (
            <p className="mt-4 text-sm" style={{ color: '#ef4444' }} role="alert">
              {t(`call.errors.${errorKey}`)}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setMode('view')}
              className="text-sm font-medium"
              style={{ color: sp.soft }}
            >
              {t('call.public.back')}
            </button>
            <button
              type="button"
              disabled={!selectedSlot || manage.isPending}
              onClick={() => {
                if (!token || !selectedSlot) return
                manage.mutate(
                  { token, action: 'reschedule', slot: selectedSlot },
                  { onSuccess: () => setMode('done_rescheduled') },
                )
              }}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: sp.accent, color: sp.accentInk }}
            >
              {manage.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('call.public.confirmReschedule')}
            </button>
          </div>
        </>
      )}
    </div>,
  )
}
