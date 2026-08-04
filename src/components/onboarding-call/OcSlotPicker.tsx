/**
 * Sélecteur de créneau de l'appel d'accueil : calendrier mensuel + colonne des
 * heures du jour retenu.
 *
 * Partagé par les TROIS surfaces qui prennent ou déplacent un rendez-vous —
 * l'étape 4 du wizard d'identité (StepRendezVous), l'écran de réservation du CRM
 * (OnboardingCallPage) et la page publique de replanification
 * (OnboardingCallManagePage) — pour que les trois se lisent pareil.
 *
 * Il ne calcule AUCUNE disponibilité : il reçoit une liste d'instants déjà arbitrée
 * par l'edge function (seule à voir les agendas des hôtes) et se contente de la
 * présenter dans le fuseau du visiteur. Un créneau fabriqué côté navigateur serait
 * au mieux faux, au pire une réservation sur un horaire déjà pris.
 *
 * HABILLAGE : MEGGA X, comme tout le parcours d'onboarding depuis le 4 août 2026 —
 * plus aucune palette Sugar, plus aucune prop `sp`. Il n'assemble que des classes
 * de la vitrine et suppose donc d'être rendu à l'intérieur d'un conteneur
 * `<MeggaX>` ; hors de ce scope, aucune de ces classes n'existe.
 *
 * ZÉRO CSS NEUF POUR LE CALENDRIER : la grille de mois est celle de MxDatePicker
 * (point 11 de megga-x-additions.css), réutilisée telle quelle — même case ronde,
 * même liseré d'accent sur le jour retenu, même gris sur les jours indisponibles,
 * qui sont ici les jours SANS créneau. Seule la colonne des heures est neuve
 * (point 14). Deux calendriers d'aspect différent dans un même produit auraient été
 * une dette pour rien.
 */
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { dayKeyOf, hourLabel, monthGrid, monthKey } from './ocDates'

export interface OcSlotPickerProps {
  /** Instants ISO rendus par l'edge function `onboarding-slots`. */
  slots: string[]
  /** Premier jour du mois affiché. */
  month: Date
  onMonthChange: (next: Date) => void
  selectedDay: string | null
  onSelectDay: (dayKey: string) => void
  selectedSlot: string | null
  onSelectSlot: (iso: string) => void
  /**
   * Rendu À CÔTÉ du créneau retenu, qui cède alors la moitié de sa largeur.
   * Le choix reste visible et modifiable pendant qu'on confirme — c'est la
   * différence avec un bouton posé sous la liste, qui oblige à quitter des yeux
   * ce qu'on vient de choisir. Absent : la liste se comporte comme avant.
   */
  slotAction?: React.ReactNode
  timezone: string
  loading?: boolean
}

export default function OcSlotPicker({
  slots, month, onMonthChange, selectedDay, onSelectDay,
  selectedSlot, onSelectSlot, timezone, loading = false, slotAction,
}: OcSlotPickerProps) {
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
    <div className="mx-slotpicker">
      {/* ── Calendrier ── */}
      <div>
        <div className="mx-datepicker__head">
          <button
            type="button"
            className="mx-datepicker__nav"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label={t('call.picker.prevMonth')}
          >
            <ChevronGlyph direction="left" />
          </button>
          {/* `capitalize` : `Intl` rend « août 2026 » en minuscule, et la vitrine
              capitalise ses intitulés. Règle §3 du CLAUDE.md — jamais d'UPPERCASE. */}
          <span className="display-1 medium capitalize">{monthLabel}</span>
          <button
            type="button"
            className="mx-datepicker__nav"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label={t('call.picker.nextMonth')}
          >
            <ChevronGlyph direction="right" />
          </button>
        </div>

        <div className="mx-datepicker__weekdays" aria-hidden="true">
          {weekdayLabels.map((label, i) => (
            <span key={`${monthKey(month)}-wd-${i}`}>{label}</span>
          ))}
        </div>

        <div className="mx-datepicker__grid">
          {cells.map((dayKey, i) => {
            if (!dayKey) return <div key={`pad-${monthKey(month)}-${i}`} />
            const available = (slotsByDay.get(dayKey)?.length ?? 0) > 0
            const isSelected = dayKey === selectedDay

            return (
              <button
                key={dayKey}
                type="button"
                // Un jour sans créneau est DÉSACTIVÉ, pas seulement grisé : c'est ce
                // qui le sort du parcours au clavier, et le point 11 lui donne déjà
                // l'encre atténuée d'un jour hors plage.
                disabled={!available}
                onClick={() => onSelectDay(dayKey)}
                aria-current={dayKey === todayKey ? 'date' : undefined}
                className={cn('mx-datepicker__day', isSelected && 'mx-datepicker__day--selected')}
              >
                {Number(dayKey.slice(8))}
              </button>
            )
          })}
        </div>

        {/* `paragraph-small mx-field__help` : le couple exact que MxField pose sous
            un champ — taille de la vitrine, encre secondaire du point 1. */}
        <p className="paragraph-small mx-field__help mg-top-5x-extra-small">
          {t('call.picker.timezoneHint', { timezone })}
        </p>
      </div>

      {/* ── Heures du jour retenu ── */}
      <div>
        <p className="display-1 medium">{t('call.picker.slotsTitle')}</p>

        <div className="mg-top-5x-extra-small">
          {loading ? (
            // Texte plutôt qu'une roue d'attente : la vitrine n'a aucun indicateur de
            // progression indéterminé, et le reste du parcours annonce ses chargements
            // en toutes lettres (IdentityPreparingScreen, récapitulatif).
            <p className="paragraph-small text-color-neutral-600" role="status" aria-live="polite">
              {t('call.picker.loadingSlots')}
            </p>
          ) : !selectedDay ? (
            <p className="paragraph-small text-color-neutral-600">{t('call.picker.pickDayFirst')}</p>
          ) : daySlots.length === 0 ? (
            <p className="paragraph-small text-color-neutral-600">{t('call.picker.noSlotThatDay')}</p>
          ) : (
            <div className="mx-slotpicker__list" role="radiogroup" aria-label={t('call.picker.slotsTitle')}>
              {daySlots.map((iso) => {
                const isSelected = iso === selectedSlot
                const bouton = (
                  <button
                    key={iso}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => onSelectSlot(iso)}
                    className={cn(
                      'mx-slotpicker__slot',
                      isSelected && 'mx-slotpicker__slot--selected',
                      isSelected && slotAction != null && 'mx-slotpicker__slot--picked',
                    )}
                  >
                    {hourLabel(iso, timezone)}
                  </button>
                )
                // Le créneau retenu partage sa ligne avec l'action de confirmation.
                if (!isSelected || slotAction == null) return bouton
                return (
                  <div key={iso} className="mx-slotpicker__row">
                    {bouton}
                    {slotAction}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/** Même chevron que MxDatePicker : tracé inline, hérite de `currentColor`. */
function ChevronGlyph({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={direction === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} />
    </svg>
  )
}
