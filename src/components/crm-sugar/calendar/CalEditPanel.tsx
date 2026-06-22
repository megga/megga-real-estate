// MEGGA CRM Sugar v2 — Calendar inline edit/create panel (#6) + time dropdown (#8)
// Port de `crm-calendar-sugar-edit.jsx`. Remplace le détail dans le panneau droit
// (320px, scrollable). Tous les champs éditables ; footer Créer/Enregistrer + Annuler.

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { CalIcon } from './CalIcon'
import {
  CAL_EVENT_TYPES,
  calNormalizeDraft,
  eventTypeColors,
  useCalPalette,
  type CalEvent,
  type CalEventTypeId,
} from './data'

export interface CalEditing {
  mode: 'edit' | 'create'
  draft: CalEvent
}

interface CalEditPanelProps {
  editing: CalEditing
  onSave: (e: CalEvent) => void
  onCancel: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const toTimeStr = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`
const toDateInput = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
function setTimeOn(base: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(base)
  d.setHours(h, m, 0, 0)
  return d
}

// Créneaux par pas de 15 min, 06:00 → 22:00.
const TIME_SLOTS: string[] = (() => {
  const out: string[] = []
  for (let h = 6; h <= 22; h++) {
    for (const m of [0, 15, 30, 45]) {
      if (h === 22 && m > 0) break
      out.push(`${pad(h)}:${pad(m)}`)
    }
  }
  return out
})()

// ── Dropdown d'heure custom (#8) — remplace <input type="time"> ──────────────
function CalTimeSelect({
  value,
  onChange,
  label,
}: {
  value: Date
  onChange: (d: Date) => void
  label: string
}) {
  const SP = useCalPalette()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = toTimeStr(value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const slots = TIME_SLOTS.includes(current) ? TIME_SLOTS : [...TIME_SLOTS, current].sort()

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 700,
          color: SP.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          height: 38,
          padding: '0 12px',
          borderRadius: 10,
          border: 0,
          background: SP.cardSubtle,
          color: SP.ink,
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          boxShadow: open ? `inset 0 0 0 1.5px ${SP.ring}` : 'none',
        }}
      >
        <CalIcon name="clock" size={13} stroke={SP.inkSoft} sw={2} />
        <span style={{ flex: 1, textAlign: 'left' }}>{current}</span>
        <CalIcon name="chevR" size={12} stroke={SP.muted} sw={2} />
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 200,
            overflowY: 'auto',
            background: SP.card,
            borderRadius: 10,
            boxShadow: SP.shadowHover,
            padding: 4,
          }}
        >
          {slots.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(setTimeOn(value, s))
                setOpen(false)
              }}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '7px 10px',
                borderRadius: 7,
                border: 0,
                background: s === current ? SP.accent : 'transparent',
                color: s === current ? SP.onAccent : SP.ink,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CalEditPanel({ editing, onSave, onCancel }: CalEditPanelProps) {
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const [d, setD] = useState<CalEvent>(editing.draft)
  const set = (patch: Partial<CalEvent>) => setD(prev => ({ ...prev, ...patch }))
  const isCreate = editing.mode === 'create'
  const pid = d.property?.id ?? `p_${d.id}`
  const tone = d.property?.tone ?? '#A8B5BF'

  const inputStyle: CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    borderRadius: 10,
    border: 0,
    background: SP.cardSubtle,
    color: SP.ink,
    fontFamily: 'inherit',
    fontSize: 13,
    fontWeight: 600,
    boxSizing: 'border-box',
    minWidth: 0,
  }
  const labelStyle: CSSProperties = {
    fontSize: 10.5,
    fontWeight: 700,
    color: SP.muted,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
    display: 'block',
  }

  return (
    <aside
      style={{
        width: 320,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        overflowY: 'auto',
      }}
    >
      <div
        style={{
          background: SP.card,
          borderRadius: 24,
          padding: 18,
          boxShadow: SP.shadow,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: SP.ink, letterSpacing: -0.3 }}>
          {isCreate ? t('edit.newEvent') : t('common:actions.edit')}
        </div>

        {/* Type */}
        <div>
          <span style={labelStyle}>{t('edit.typeLabel')}</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Object.values(CAL_EVENT_TYPES).map(t => {
              const active = d.type === t.id
              const c = eventTypeColors(t, SP.isDark)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => set({ type: t.id as CalEventTypeId })}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: 0,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 11.5,
                    fontWeight: 700,
                    background: active ? c.bg : SP.cardSubtle,
                    color: active ? c.ink : SP.muted,
                    boxShadow: active ? `inset 0 0 0 1.5px ${c.accent}` : 'none',
                  }}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <span style={labelStyle}>{t('edit.titleLabel')}</span>
          <input
            style={inputStyle}
            value={d.title}
            onChange={e => set({ title: e.target.value })}
            placeholder={t('edit.titlePlaceholder')}
          />
        </div>

        {/* Date */}
        <div>
          <span style={labelStyle}>{t('edit.dateLabel')}</span>
          <input
            type="date"
            style={inputStyle}
            value={toDateInput(d.start)}
            onChange={e => {
              if (!e.target.value) return
              const [y, mo, da] = e.target.value.split('-').map(Number)
              const ns = new Date(d.start)
              ns.setFullYear(y, mo - 1, da)
              const ne = new Date(d.end)
              ne.setFullYear(y, mo - 1, da)
              set({ start: ns, end: ne })
            }}
          />
        </div>

        {/* Start / End */}
        <div style={{ display: 'flex', gap: 10 }}>
          <CalTimeSelect
            label={t('edit.startLabel')}
            value={d.start}
            onChange={ns => set({ start: ns, end: d.end <= ns ? new Date(ns.getTime() + 3600000) : d.end })}
          />
          <CalTimeSelect label={t('edit.endLabel')} value={d.end} onChange={ne => set({ end: ne })} />
        </div>

        {/* Location */}
        <div>
          <span style={labelStyle}>{t('edit.locationLabel')}</span>
          <input
            style={inputStyle}
            value={d.location ?? ''}
            onChange={e => set({ location: e.target.value })}
            placeholder={t('edit.locationPlaceholder')}
          />
        </div>

        {/* Contact */}
        <div>
          <span style={labelStyle}>{t('edit.contactLabel')}</span>
          <input
            style={{ ...inputStyle, marginBottom: 6 }}
            value={d.contact?.name ?? ''}
            onChange={e =>
              set({ contact: { name: e.target.value, role: d.contact?.role ?? 'Contact', phone: d.contact?.phone } })
            }
            placeholder={t('edit.namePlaceholder')}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={inputStyle}
              value={d.contact?.role ?? ''}
              onChange={e =>
                set({ contact: { name: d.contact?.name ?? '', role: e.target.value, phone: d.contact?.phone } })
              }
              placeholder={t('edit.rolePlaceholder')}
            />
            <input
              style={inputStyle}
              value={d.contact?.phone ?? ''}
              onChange={e =>
                set({ contact: { name: d.contact?.name ?? '', role: d.contact?.role ?? 'Contact', phone: e.target.value } })
              }
              placeholder={t('edit.phonePlaceholder')}
            />
          </div>
        </div>

        {/* Property */}
        <div>
          <span style={labelStyle}>{t('edit.propertyLabel')}</span>
          <input
            style={{ ...inputStyle, marginBottom: 6 }}
            value={d.property?.title ?? ''}
            onChange={e =>
              set({ property: { id: pid, title: e.target.value, area: d.property?.area ?? 0, price: d.property?.price ?? null, tone } })
            }
            placeholder={t('edit.designationPlaceholder')}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={inputStyle}
              type="number"
              value={d.property?.area ?? ''}
              onChange={e =>
                set({ property: { id: pid, title: d.property?.title ?? '', area: Number(e.target.value) || 0, price: d.property?.price ?? null, tone } })
              }
              placeholder={t('edit.areaPlaceholder')}
            />
            <input
              style={inputStyle}
              type="number"
              value={d.property?.price ?? ''}
              onChange={e =>
                set({ property: { id: pid, title: d.property?.title ?? '', area: d.property?.area ?? 0, price: e.target.value ? Number(e.target.value) : null, tone } })
              }
              placeholder={t('edit.pricePlaceholder')}
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <span style={labelStyle}>{t('edit.notesLabel')}</span>
          <textarea
            style={{ ...inputStyle, height: 72, padding: '8px 12px', resize: 'vertical', lineHeight: 1.4 }}
            value={d.notes ?? ''}
            onChange={e => set({ notes: e.target.value })}
            placeholder={t('edit.notesPlaceholder')}
          />
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => onSave(calNormalizeDraft(d))}
            style={{
              flex: 1,
              height: 40,
              borderRadius: 12,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              background: SP.accent,
              color: SP.onAccent,
            }}
          >
            {isCreate ? t('common:actions.create') : t('edit.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            style={{
              height: 40,
              padding: '0 16px',
              borderRadius: 12,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 700,
              background: SP.cardSubtle,
              color: SP.ink,
            }}
          >
            {t('common:actions.cancel')}
          </button>
        </div>
      </div>
    </aside>
  )
}
