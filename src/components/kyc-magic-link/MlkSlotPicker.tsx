// MEGGA — Sélecteur de créneau du parcours client (réservation ET report).
//
// Extrait de MlkBooking parce que la page de gestion en a besoin à l'identique :
// déplacer un rendez-vous, c'est en choisir un autre dans la même liste. Deux
// grilles séparées auraient dérivé (fuseau, regroupement, ordre) au premier
// changement.
//
// FUSEAU. Les instants arrivent en UTC, accompagnés du fuseau de l'AGENT ; tout
// est rendu dans ce fuseau via TZDate. Un client qui ouvre le lien en voyage
// doit lire l'heure telle qu'elle sera vécue sur place, pas celle de son
// téléphone. C'est aussi ce qui garde la liste juste quand elle chevauche une
// bascule DST : deux jours consécutifs n'y ont pas le même décalage UTC.

import { useMemo } from 'react'
import { MLK } from './mlkTokens'
import { inZone } from './mlkDateFormat'
import type { AppointmentSlot } from '@/hooks/useAppointmentBooking'

interface SlotPickerProps {
  slots: AppointmentSlot[]
  timezone: string
  selected: string | null
  onSelect: (startIso: string) => void
  /** Jour affiché ; non contrôlé, le premier jour disponible par défaut. */
  activeDay: string | null
  onDayChange: (dayKey: string) => void
}

export function MlkSlotPicker({
  slots, timezone, selected, onSelect, activeDay, onDayChange,
}: SlotPickerProps) {
  // L'edge renvoie les créneaux déjà triés ; Map préserve l'ordre d'insertion,
  // donc aucun tri à refaire ici.
  const days = useMemo(() => {
    const map = new Map<string, { label: string; slots: { start: string; time: string }[] }>()
    for (const s of slots) {
      const z = inZone(s.start, timezone)
      if (!map.has(z.dayKey)) map.set(z.dayKey, { label: z.dayLabel, slots: [] })
      map.get(z.dayKey)!.slots.push({ start: s.start, time: z.time })
    }
    return Array.from(map, ([key, v]) => ({ key, ...v }))
  }, [slots, timezone])

  const current = activeDay ?? days[0]?.key ?? null
  const visible = days.find(d => d.key === current)?.slots ?? []

  return (
    <>
      <div
        style={{ display: 'flex', gap: 'var(--crm-space-sm)', overflowX: 'auto', paddingBottom: 'var(--crm-space-sm)', marginBottom: 'var(--crm-space-4xl)' }}
        className="scrollbar-hide"
      >
        {days.map(d => {
          const on = d.key === current
          return (
            <button
              key={d.key}
              type="button"
              onClick={() => onDayChange(d.key)}
              style={{
                flexShrink: 0, padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderRadius: 999, border: 'none',
                cursor: 'pointer', fontFamily: MLK.font, fontSize: 'var(--crm-text-md)', fontWeight: 600,
                letterSpacing: -0.1, whiteSpace: 'nowrap',
                background: on ? MLK.accent : MLK.card,
                color: on ? '#fff' : MLK.inkSoft,
                boxShadow: on ? 'none' : MLK.shadowSm,
              }}
            >
              {d.label}
            </button>
          )
        })}
      </div>

      <div
        style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
          gap: 'var(--crm-space-sm)', marginBottom: 'var(--crm-space-6xl)',
        }}
      >
        {visible.map(s => {
          const on = s.start === selected
          return (
            <button
              key={s.start}
              type="button"
              onClick={() => onSelect(s.start)}
              style={{
                padding: 'var(--crm-space-xl) var(--crm-space-sm)', borderRadius: 14, cursor: 'pointer',
                fontFamily: MLK.font, fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.1,
                border: on ? `1.5px solid ${MLK.accent}` : '1.5px solid transparent',
                background: on ? MLK.accent : MLK.card,
                color: on ? '#fff' : MLK.ink,
                boxShadow: on ? 'none' : MLK.shadowSm,
              }}
            >
              {s.time}
            </button>
          )
        })}
      </div>
    </>
  )
}
