/**
 * Écran de réservation de l'appel d'accueil — route `/dashboard/rendez-vous-accueil`.
 *
 * C'est la suite immédiate du wizard d'identité KYB : `IdentityShell.handleSubmit`
 * mène ici plutôt qu'au dashboard. Avant, une agence qui venait de soumettre son
 * dossier atterrissait dans un CRM vide sans que personne chez MEGGA ne la contacte.
 *
 * PASSABLE, JAMAIS BLOQUANT. Le gate d'identité, lui, enferme, parce qu'aucun dossier
 * ne peut avancer sans son contenu. Un appel commercial n'est pas de cette nature :
 * enfermer une agence hors de son CRM pour l'obliger à parler à quelqu'un serait un
 * mauvais échange. « Plus tard » met le rappel en sommeil et laisse passer.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, Check, Loader2, Video, ArrowRight } from 'lucide-react'
import { crmSugarPalette, sugarThemeTokens } from '@/components/crm-sugar/tokens'
import { useDarkTone } from '@/hooks/useDarkTone'
import { useAuth } from '@/hooks/useAuth'
import OcPicker from '@/components/crm-sugar/onboarding-call/OcPicker'
import { dayKeyOf } from '@/components/crm-sugar/onboarding-call/ocDates'
import {
  useMyOnboardingCall,
  useOnboardingSlots,
  useBookOnboardingCall,
  snoozeOnboardingCall,
  browserTimezone,
} from '@/hooks/useOnboardingCall'

/** Bornes ISO du mois affiché, élargies pour couvrir les bords de fuseau. */
function monthBounds(month: Date): { from: string; to: string } {
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const now = new Date()
  return {
    // Inutile de demander des créneaux déjà passés quand on regarde le mois courant.
    from: (from < now ? now : from).toISOString(),
    to: to.toISOString(),
  }
}

export default function OnboardingCallPage() {
  const { t } = useTranslation('onboarding')
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [dark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('megga.sugar.dark') === '1'
  })
  const darkTone = useDarkTone()
  const theme = sugarThemeTokens(dark, darkTone)
  const sp = useMemo(() => crmSugarPalette(theme, dark, darkTone), [theme, dark, darkTone])

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

  const slots = slotsQuery.data?.slots ?? []

  // Ouvrir sur le premier jour qui a quelque chose à proposer : demander à
  // l'utilisateur de chercher lui-même le prochain jour ouvert est du travail qu'on
  // sait faire pour lui.
  useEffect(() => {
    if (selectedDay || slots.length === 0) return
    setSelectedDay(dayKeyOf(slots[0], timezone))
  }, [slots, selectedDay, timezone])

  const skip = () => {
    snoozeOnboardingCall(profile?.agency_id ?? null)
    navigate('/dashboard')
  }

  const confirm = () => {
    if (!selectedSlot) return
    book.mutate({ slot: selectedSlot, phone: phone.trim() || undefined, note: note.trim() || undefined })
  }

  const errorKey = book.error instanceof Error ? book.error.message : null
  const knownError = errorKey && ['slot_taken', 'already_booked', 'no_host_available', 'slot_in_past'].includes(errorKey)
    ? errorKey
    : errorKey
      ? 'generic'
      : null

  // ── Déjà réservé, ou réservation qui vient d'aboutir ──
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

  if (booked) {
    const when = new Intl.DateTimeFormat('fr-CH', {
      timeZone: timezone,
      weekday: 'long', day: 'numeric', month: 'long',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(booked.scheduledAt))

    return (
      <div className="min-h-full p-4 md:p-8" style={{ background: sp.pageBg }}>
        <div
          className="mx-auto max-w-xl rounded-2xl p-8 text-center"
          style={{ background: sp.cardBg, boxShadow: sp.shadow }}
        >
          <div
            className="mx-auto mb-5 h-12 w-12 rounded-full flex items-center justify-center"
            style={{ background: sp.accent, color: sp.accentInk }}
          >
            <Check className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold mb-2" style={{ color: sp.ink }}>
            {t('call.confirmed.title')}
          </h1>
          <p className="text-sm mb-6 first-letter:uppercase" style={{ color: sp.sub }}>
            {when} · {booked.durationMinutes} min · {booked.hostName}
          </p>

          {booked.meetingUrl && (
            <a
              href={booked.meetingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold mb-4"
              style={{ background: sp.accent, color: sp.accentInk }}
            >
              <Video className="h-4 w-4" />
              {t('call.confirmed.join')}
            </a>
          )}

          <p className="text-xs leading-relaxed mb-6" style={{ color: sp.soft }}>
            {t('call.confirmed.emailSent')}
          </p>

          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: sp.sub }}
          >
            {t('call.confirmed.toDashboard')}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    )
  }

  // ── Aucun hôte, ou aucun créneau : le dire honnêtement ──
  const poolEmpty = slotsQuery.data?.pool_empty === true
  const nothingFree = !slotsQuery.isLoading && !poolEmpty && slots.length === 0

  return (
    <div className="min-h-full p-4 md:p-8" style={{ background: sp.pageBg }}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-start gap-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: sp.cardSubBg, color: sp.ink }}
          >
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: sp.ink }}>
              {t('call.intro.title')}
            </h1>
            <p className="text-sm mt-1 leading-relaxed" style={{ color: sp.sub }}>
              {t('call.intro.body')}
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-6" style={{ background: sp.cardBg, boxShadow: sp.shadow }}>
          {poolEmpty && (
            <p className="text-sm leading-relaxed" style={{ color: sp.sub }}>
              {t('call.empty.noHost')}
            </p>
          )}

          {nothingFree && (
            <p className="text-sm leading-relaxed" style={{ color: sp.sub }}>
              {t('call.empty.noSlot')}
            </p>
          )}

          {!poolEmpty && !nothingFree && (
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

              <div className="mt-6 pt-6 grid gap-4 md:grid-cols-2" style={{ borderTop: `1px solid ${sp.cardBorder}` }}>
                <label className="block">
                  <span className="text-xs font-medium block mb-1.5" style={{ color: sp.sub }}>
                    {t('call.form.phone')}
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder={t('call.form.phonePlaceholder')}
                    className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                    style={{ background: sp.cardSubBg, color: sp.ink, border: `1px solid ${sp.cardBorder}` }}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium block mb-1.5" style={{ color: sp.sub }}>
                    {t('call.form.note')}
                  </span>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={t('call.form.notePlaceholder')}
                    className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                    style={{ background: sp.cardSubBg, color: sp.ink, border: `1px solid ${sp.cardBorder}` }}
                  />
                </label>
              </div>

              {knownError && (
                <p className="mt-4 text-sm" style={{ color: '#ef4444' }} role="alert">
                  {t(`call.errors.${knownError}`)}
                </p>
              )}

              <div className="mt-6 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={skip}
                  className="text-sm font-medium"
                  style={{ color: sp.soft }}
                >
                  {t('call.actions.later')}
                </button>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!selectedSlot || book.isPending}
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: sp.accent, color: sp.accentInk }}
                >
                  {book.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('call.actions.confirm')}
                </button>
              </div>
            </>
          )}

          {(poolEmpty || nothingFree) && (
            <button
              type="button"
              onClick={skip}
              className="mt-5 text-sm font-medium"
              style={{ color: sp.sub }}
            >
              {t('call.actions.continue')}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
