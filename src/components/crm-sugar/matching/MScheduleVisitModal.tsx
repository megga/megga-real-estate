// MEGGA CRM Sugar v2 — Schedule visit modal
// 1:1 port from `crm-screen-matching-sugar.jsx` (MScheduleVisitModal).

import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { crmBienById, type CrmBien, type CrmContact } from '../mockData'
import type { SugarPalette } from '../tokens'
import { BienIcon } from './BienIcon'
import type { MatchGroup } from './helpers'

const VISIT_DURATIONS = [30, 45, 60, 90]

export interface ScheduleDay {
  iso: string
  label: string
  day: number
  month: string
  isToday: boolean
  isWeekend: boolean
}

export interface ScheduleConfirmPayload {
  buyer: CrmContact
  bien: CrmBien
  day: ScheduleDay
  slot: string
  duration: number
  notes: string
}

function buildScheduleDays(): ScheduleDay[] {
  const days: ScheduleDay[] = []
  const now = new Date()
  for (let i = 0; i < 14; i++) {
    const d = new Date(now)
    d.setDate(now.getDate() + i)
    const dow = d.getDay()
    const isWeekend = dow === 0 || dow === 6
    days.push({
      iso: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('fr-CH', { weekday: 'short' }),
      day: d.getDate(),
      month: d.toLocaleDateString('fr-CH', { month: 'short' }),
      isToday: i === 0,
      isWeekend,
    })
  }
  return days
}

interface SlotInfo {
  label: string
  busy: boolean
}

function buildSlots(iso: string): SlotInfo[] {
  const slots: SlotInfo[] = []
  const seed = iso.split('-').reduce((a, b) => a + parseInt(b, 10), 0)
  for (let h = 9; h <= 18; h++) {
    for (const m of [0, 30]) {
      if (h === 18 && m === 30) continue
      const idx = h * 2 + m / 30
      const busy = ((seed * 7 + idx * 13) % 11) < 3
      slots.push({
        label: `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`,
        busy,
      })
    }
  }
  return slots
}

interface MScheduleVisitModalProps {
  group: MatchGroup
  sp: SugarPalette
  dark: boolean
  onClose: () => void
  onConfirm: (payload: ScheduleConfirmPayload) => void
}

export function MScheduleVisitModal({
  group,
  sp,
  dark,
  onClose,
  onConfirm,
}: MScheduleVisitModalProps) {
  const { buyer, matches } = group
  const fullName = `${buyer.firstName} ${buyer.lastName}`
  const initials = (buyer.firstName?.[0] || '') + (buyer.lastName?.[0] || '')
  const avatarBg = buyer.avatarBg || '#0041D9'

  const days = useMemo(() => buildScheduleDays(), [])

  const [bienId, setBienId] = useState<string | null>(matches[0]?.bienId || null)
  const [dayIso, setDayIso] = useState<string>(
    days.find(d => !d.isWeekend && !d.isToday)?.iso || days[0].iso,
  )
  const [slot, setSlot] = useState<string | null>(null)
  const [duration, setDuration] = useState(45)
  const [notes, setNotes] = useState('')

  const slots = useMemo(() => buildSlots(dayIso), [dayIso])
  const selectedDay = days.find(d => d.iso === dayIso)!
  const selectedBien = bienId ? crmBienById(bienId) : null
  const canConfirm = !!(bienId && slot && selectedBien)

  const handleConfirm = () => {
    if (!canConfirm) return
    onConfirm({
      buyer,
      bien: selectedBien!,
      day: selectedDay,
      slot: slot!,
      duration,
      notes: notes.trim(),
    })
  }

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          background: dark ? 'rgba(0,0,0,0.62)' : 'rgba(15,23,42,0.42)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: 'sugar-overlay-fade 220ms ease',
        }}
      />

      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1301,
          display: 'grid',
          placeItems: 'center',
          padding: 24,
          pointerEvents: 'none',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: 'min(620px, 100%)',
            maxHeight: 'calc(100vh - 48px)',
            background: sp.frameBg,
            backdropFilter: 'blur(24px) saturate(140%)',
            WebkitBackdropFilter: 'blur(24px) saturate(140%)',
            border: `1px solid ${sp.frameBorder}`,
            borderRadius: 32,
            boxShadow: dark
              ? '0 30px 80px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset'
              : '0 30px 80px rgba(15,23,42,0.20), 0 1px 0 rgba(255,255,255,0.6) inset',
            display: 'flex',
            flexDirection: 'column',
            animation: 'sugar-bento-in 380ms cubic-bezier(.22,1,.36,1)',
            color: sp.ink,
            overflow: 'hidden',
            pointerEvents: 'auto',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '22px 24px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              position: 'relative',
            }}
          >
            <div
              aria-hidden
              style={{
                position: 'absolute',
                top: -40,
                left: -40,
                right: -40,
                height: 160,
                background: `radial-gradient(circle at 30% 0%, ${avatarBg}22 0%, transparent 65%)`,
                pointerEvents: 'none',
                zIndex: 0,
              }}
            />
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: avatarBg,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 14,
                fontWeight: 800,
                border: `2px solid ${sp.avatarBorder}`,
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              {initials}
            </div>
            <div
              style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}
            >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  color: sp.sub,
                }}
              >
                Planifier une visite
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  color: sp.ink,
                  letterSpacing: -0.3,
                  marginTop: 2,
                }}
              >
                {fullName}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                border: 0,
                background: sp.cardSubBg,
                cursor: 'pointer',
                color: sp.soft,
                fontSize: 16,
                fontFamily: 'inherit',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                position: 'relative',
                zIndex: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '4px 24px 16px' }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: sp.sub,
                marginBottom: 8,
              }}
            >
              Bien à visiter
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                marginBottom: 18,
              }}
            >
              {matches.map((m, i) => {
                const b = crmBienById(m.bienId)
                if (!b) return null
                const active = bienId === m.bienId
                return (
                  <label
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: active ? sp.cardBg : sp.cardSubBg,
                      border: `1px solid ${active ? '#0041D9' : sp.cardBorder}`,
                      cursor: 'pointer',
                      transition: 'all 160ms ease',
                    }}
                  >
                    <input
                      type="radio"
                      name="visit-bien"
                      checked={active}
                      onChange={() => setBienId(m.bienId)}
                      style={{
                        width: 16,
                        height: 16,
                        accentColor: '#0041D9',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 9,
                        background: dark ? 'rgba(255,255,255,.04)' : '#FBFAF8',
                        border: `1px solid ${sp.cardBorder}`,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BienIcon bien={b} size={18} color={sp.soft} opacity={0.55} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: sp.ink,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {b.title}
                      </div>
                      <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 2 }}>
                        {b.canton} · {b.addr || 'Adresse à confirmer'}
                      </div>
                    </div>
                  </label>
                )
              })}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: sp.sub,
                marginBottom: 8,
              }}
            >
              Date
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                overflowX: 'auto',
                paddingBottom: 4,
                marginBottom: 18,
                scrollbarWidth: 'thin',
              }}
            >
              {days.map((d, i) => {
                const active = d.iso === dayIso
                return (
                  <button
                    key={i}
                    onClick={() => {
                      setDayIso(d.iso)
                      setSlot(null)
                    }}
                    disabled={d.isWeekend}
                    style={{
                      flexShrink: 0,
                      width: 60,
                      height: 72,
                      borderRadius: 14,
                      background: active ? '#0041D9' : sp.cardSubBg,
                      border: `1px solid ${active ? '#0041D9' : sp.cardBorder}`,
                      color: active ? '#fff' : d.isWeekend ? sp.soft : sp.ink,
                      fontFamily: 'inherit',
                      cursor: d.isWeekend ? 'not-allowed' : 'pointer',
                      opacity: d.isWeekend ? 0.4 : 1,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 2,
                      transition: 'all 160ms ease',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        opacity: active ? 0.85 : 0.6,
                      }}
                    >
                      {d.isToday ? 'Auj.' : d.label}
                    </span>
                    <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>
                      {d.day}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        opacity: active ? 0.85 : 0.55,
                      }}
                    >
                      {d.month.replace('.', '')}
                    </span>
                  </button>
                )
              })}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: sp.sub,
                marginBottom: 8,
              }}
            >
              Créneau
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 6,
                marginBottom: 18,
              }}
            >
              {slots.map((s, i) => {
                const active = slot === s.label
                return (
                  <button
                    key={i}
                    onClick={() => !s.busy && setSlot(s.label)}
                    disabled={s.busy}
                    style={{
                      height: 36,
                      borderRadius: 10,
                      background: active
                        ? '#0041D9'
                        : s.busy
                          ? sp.cardSubBg
                          : sp.cardBg,
                      border: `1px solid ${active ? '#0041D9' : sp.cardBorder}`,
                      color: active ? '#fff' : s.busy ? sp.soft : sp.ink,
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: s.busy ? 'not-allowed' : 'pointer',
                      opacity: s.busy ? 0.45 : 1,
                      textDecoration: s.busy ? 'line-through' : 'none',
                      transition: 'all 120ms ease',
                    }}
                  >
                    {s.label}
                  </button>
                )
              })}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: sp.sub,
                marginBottom: 8,
              }}
            >
              Durée
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
              {VISIT_DURATIONS.map(d => {
                const active = duration === d
                return (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    style={{
                      flex: 1,
                      height: 36,
                      borderRadius: 10,
                      background: active ? sp.ink : sp.cardSubBg,
                      border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
                      color: active ? sp.pageBg : sp.ink,
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      transition: 'all 160ms ease',
                    }}
                  >
                    {d} min
                  </button>
                )
              })}
            </div>

            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: sp.sub,
                marginBottom: 8,
              }}
            >
              Notes{' '}
              <span
                style={{
                  fontWeight: 500,
                  textTransform: 'none',
                  letterSpacing: 0,
                  opacity: 0.7,
                }}
              >
                (optionnel)
              </span>
            </div>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Code d'accès, point de rendez-vous, contact concierge…"
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 12,
                borderRadius: 12,
                border: `1px solid ${sp.cardBorder}`,
                background: sp.cardBg,
                color: sp.ink,
                fontSize: 13,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '14px 24px 22px',
              borderTop: `1px solid ${sp.cardBorder}`,
              display: 'flex',
              gap: 10,
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: sp.sub,
                fontWeight: 500,
                minWidth: 0,
                flex: 1,
              }}
            >
              {canConfirm ? (
                <>
                  <span style={{ color: sp.ink, fontWeight: 700 }}>
                    {selectedDay.label} {selectedDay.day} {selectedDay.month}
                  </span>{' '}
                  · {slot} · {duration} min
                </>
              ) : (
                'Sélectionnez un bien et un créneau'
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={onClose}
                style={{
                  height: 44,
                  padding: '0 18px',
                  borderRadius: 999,
                  border: `1px solid ${sp.cardBorder}`,
                  background: 'transparent',
                  color: sp.ink,
                  fontSize: 13.5,
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleConfirm}
                disabled={!canConfirm}
                style={{
                  height: 44,
                  padding: '0 22px',
                  borderRadius: 999,
                  border: 0,
                  background: canConfirm ? sp.ink : sp.sub,
                  color: sp.pageBg,
                  fontSize: 13.5,
                  fontWeight: 700,
                  fontFamily: 'inherit',
                  cursor: canConfirm ? 'pointer' : 'not-allowed',
                  boxShadow: canConfirm ? sp.focusShadow : 'none',
                  opacity: canConfirm ? 1 : 0.6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <svg
                  width={14}
                  height={14}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={sp.pageBg}
                  strokeWidth={2.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="3" y="4" width="18" height="18" rx="3" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
                Planifier
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
