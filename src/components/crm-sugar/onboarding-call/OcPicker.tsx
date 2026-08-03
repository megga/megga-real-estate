/**
 * Sélecteur de créneau de l'appel d'accueil : calendrier mensuel + liste des heures
 * du jour retenu.
 *
 * Partagé par l'écran de réservation du CRM et la page publique de replanification,
 * pour que les deux se lisent pareil. Il ne calcule aucune disponibilité : il reçoit
 * une liste d'instants déjà arbitrée par le serveur, et se contente de la présenter
 * dans le fuseau du visiteur.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { SugarPalette } from '@/components/crm-sugar/tokens'
import { dayKeyOf, hourLabel, monthGrid, monthKey } from './ocDates'

export interface OcPickerProps {
  /** Instants ISO rendus par l'edge function. */
  slots: string[]
  /** Premier jour du mois affiché. */
  month: Date
  onMonthChange: (next: Date) => void
  selectedDay: string | null
  onSelectDay: (dayKey: string) => void
  selectedSlot: string | null
  onSelectSlot: (iso: string) => void
  timezone: string
  loading?: boolean
  sp: SugarPalette
}

export default function OcPicker({
  slots,
  month,
  onMonthChange,
  selectedDay,
  onSelectDay,
  selectedSlot,
  onSelectSlot,
  timezone,
  loading = false,
  sp,
}: OcPickerProps) {
  const { t } = useTranslation('onboarding')

  const slotsByDay = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const iso of slots) {
      const key = dayKeyOf(iso, timezone)
      const list = map.get(key) ?? []
      list.push(iso)
      map.set(key, list)
    }
    for (const list of map.values()) list.sort()
    return map
  }, [slots, timezone])

  const cells = useMemo(() => monthGrid(month), [month])
  const daySlots = selectedDay ? slotsByDay.get(selectedDay) ?? [] : []

  const todayKey = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())

  const monthLabel = new Intl.DateTimeFormat('fr-CH', {
    month: 'long', year: 'numeric',
  }).format(month)

  const weekdayLabels = t('call.picker.weekdays', { returnObjects: true }) as string[]

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_220px]">
      {/* Calendrier */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label={t('call.picker.prevMonth')}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: sp.cardSubBg, color: sp.sub }}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-semibold capitalize" style={{ color: sp.ink }}>
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label={t('call.picker.nextMonth')}
            className="h-8 w-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: sp.cardSubBg, color: sp.sub }}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {weekdayLabels.map((label, i) => (
            <div
              key={`${monthKey(month)}-wd-${i}`}
              className="text-center text-[11px] font-medium py-1"
              style={{ color: sp.soft }}
            >
              {label}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((dayKey, i) => {
            if (!dayKey) return <div key={`pad-${monthKey(month)}-${i}`} />
            const count = slotsByDay.get(dayKey)?.length ?? 0
            const available = count > 0
            const isSelected = dayKey === selectedDay
            const isToday = dayKey === todayKey

            return (
              <button
                key={dayKey}
                type="button"
                disabled={!available}
                onClick={() => onSelectDay(dayKey)}
                aria-pressed={isSelected}
                className="aspect-square rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed relative"
                style={{
                  background: isSelected ? sp.accent : available ? sp.cardSubBg : 'transparent',
                  color: isSelected ? sp.accentInk : available ? sp.ink : sp.soft,
                  opacity: available || isSelected ? 1 : 0.45,
                  outline: isToday && !isSelected ? `1px solid ${sp.cardBorder}` : undefined,
                }}
              >
                {Number(dayKey.slice(8))}
              </button>
            )
          })}
        </div>

        <p className="text-[11px] mt-3" style={{ color: sp.soft }}>
          {t('call.picker.timezoneHint', { timezone })}
        </p>
      </div>

      {/* Créneaux du jour */}
      <div>
        <p className="text-xs font-semibold mb-2" style={{ color: sp.sub }}>
          {t('call.picker.slotsTitle')}
        </p>

        {loading && (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 rounded-lg animate-pulse" style={{ background: sp.cardSubBg }} />
            ))}
          </div>
        )}

        {!loading && !selectedDay && (
          <p className="text-xs leading-relaxed" style={{ color: sp.soft }}>
            {t('call.picker.pickDayFirst')}
          </p>
        )}

        {!loading && selectedDay && daySlots.length === 0 && (
          <p className="text-xs leading-relaxed" style={{ color: sp.soft }}>
            {t('call.picker.noSlotThatDay')}
          </p>
        )}

        {!loading && daySlots.length > 0 && (
          <div className="grid gap-2 max-h-[280px] overflow-y-auto scrollbar-hide">
            {daySlots.map((iso) => {
              const isSelected = iso === selectedSlot
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelectSlot(iso)}
                  aria-pressed={isSelected}
                  className="h-9 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: isSelected ? sp.accent : sp.cardSubBg,
                    color: isSelected ? sp.accentInk : sp.ink,
                  }}
                >
                  {hourLabel(iso, timezone)}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
