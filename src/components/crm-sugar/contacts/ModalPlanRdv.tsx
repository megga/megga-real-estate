// MEGGA CRM Sugar v2 — Plan RDV modal
// 1:1 port from `crm-screen-contacts-sugar.jsx` (CtModalPlanRdv).

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { Trans, useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import { CRM_BIENS, CRM_MATCHES, type CrmContact } from '../mockData'
import type { SugarPalette } from '../tokens'
import { ctFmtCHF } from './helpers'

export type RdvType = 'visit' | 'phone' | 'video' | 'notary' | 'other'

export interface RdvPayload {
  type: RdvType
  date: string
  time: string
  duration: number
  location: string
  bienId: string
  agents: string[]
  notes: string
}

// Clés i18n stables (`labelKey`) résolues au rendu via `t(...)`.
const CT_RDV_TYPES: { id: RdvType; labelKey: string; icon: MEIconName; color: string }[] = [
  { id: 'visit', labelKey: 'planRdv.type.visit', icon: 'home', color: '#0041D9' },
  { id: 'phone', labelKey: 'planRdv.type.phone', icon: 'phone', color: '#06B6D4' },
  { id: 'video', labelKey: 'planRdv.type.video', icon: 'message', color: '#8B5CF6' },
  { id: 'notary', labelKey: 'planRdv.type.notary', icon: 'check', color: '#0E9F6E' },
  { id: 'other', labelKey: 'planRdv.type.other', icon: 'calendar', color: '#7A8079' },
]

const CT_RDV_DURATIONS = [15, 30, 45, 60, 90, 120]

const CT_RDV_AGENTS = [
  { id: 'gl', name: 'Gregory Lyonnet' },
  { id: 'ml', name: 'Mathilde Laurent' },
  { id: 'rs', name: 'Romain Saulnier' },
  { id: 'ec', name: 'Élodie Chen' },
]

interface ModalPlanRdvProps {
  contact: CrmContact
  sp: SugarPalette
  dark: boolean
  onClose: () => void
  onSave: (data: RdvPayload) => void
}

export function ModalPlanRdv({ contact, sp, dark, onClose, onSave }: ModalPlanRdvProps) {
  const { t } = useTranslation('contacts')
  const [type, setType] = useState<RdvType>('visit')
  const today = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().slice(0, 10)
  }, [])
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('10:00')
  const [duration, setDuration] = useState(60)
  const [location, setLocation] = useState('')
  const [bienId, setBienId] = useState('')
  const [agents, setAgents] = useState<string[]>(['gl'])
  const [notes, setNotes] = useState('')

  const linkedBiens = useMemo(() => {
    if (contact.type === 'seller' || contact.type === 'landlord') {
      return CRM_BIENS.filter(b => b.ownerContactId === contact.id)
    }
    const matchedIds = CRM_MATCHES.filter(m => m.contactId === contact.id).map(m => m.bienId)
    return CRM_BIENS.filter(b => matchedIds.includes(b.id))
  }, [contact])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSave = () => {
    onSave({ type, date, time, duration, location, bienId, agents, notes })
    onClose()
  }

  const labelStyle: CSSProperties = {
    fontSize: 11,
    fontWeight: 700,
    color: sp.sub,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    display: 'block',
  }
  const inputStyle: CSSProperties = {
    width: '100%',
    height: 38,
    padding: '0 12px',
    boxSizing: 'border-box',
    background: sp.pageBg,
    border: `1px solid ${sp.cardBorder}`,
    borderRadius: 10,
    color: sp.ink,
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
  }

  const fullName = contact.firstName + ' ' + contact.lastName

  return createPortal(
    <div
      onMouseDown={e => {
        if (e.target === e.currentTarget) onClose()
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ct-rdv-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: dark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        padding: 32,
        animation: 'ctModalFade 220ms cubic-bezier(.22,1,.36,1)',
      }}
    >
      <style>{`
        @keyframes ctModalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes ctModalLift { from { opacity: 0; transform: translateY(12px) scale(.98); } to { opacity: 1; transform: none; } }
      `}</style>
      <div
        onMouseDown={e => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: 'calc(100vh - 64px)',
          background: sp.cardBg,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 24,
          boxShadow: '0 24px 64px rgba(15,23,42,0.18)',
          backdropFilter: 'blur(14px)',
          WebkitBackdropFilter: 'blur(14px)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'ctModalLift 280ms cubic-bezier(.22,1,.36,1)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: `1px solid ${sp.cardBorder}`,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: sp.ink,
              color: sp.pageBg,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <MEIcon name="calendar" size={16} color={sp.pageBg} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2
              id="ct-rdv-title"
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 800,
                color: sp.ink,
                letterSpacing: -0.4,
              }}
            >
              {t('planRdv.title')}
            </h2>
            <div style={{ fontSize: 12, color: sp.sub, marginTop: 2 }}>
              <Trans
                t={t}
                i18nKey="planRdv.withContact"
                values={{ name: fullName }}
                components={{ strong: <strong style={{ color: sp.soft, fontWeight: 700 }} /> }}
              />
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common:actions.close')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              color: sp.sub,
              fontSize: 20,
              lineHeight: 1,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
          }}
        >
          <div>
            <label style={labelStyle}>{t('planRdv.typeLabel')}</label>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(5, 1fr)',
                gap: 6,
              }}
            >
              {CT_RDV_TYPES.map(rt => {
                const active = type === rt.id
                return (
                  <button
                    key={rt.id}
                    onClick={() => setType(rt.id)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: active ? sp.ink : sp.pageBg,
                      border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
                      color: active ? sp.pageBg : sp.ink,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <MEIcon
                      name={rt.icon}
                      size={14}
                      color={active ? sp.pageBg : rt.color}
                    />
                    {t(rt.labelKey)}
                  </button>
                )
              })}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.2fr 1fr 1fr',
              gap: 12,
            }}
          >
            <div>
              <label style={labelStyle}>{t('planRdv.date')}</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('planRdv.time')}</label>
              <input
                type="time"
                value={time}
                onChange={e => setTime(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('planRdv.duration')}</label>
              <select
                value={duration}
                onChange={e => setDuration(Number(e.target.value))}
                style={inputStyle}
              >
                {CT_RDV_DURATIONS.map(d => (
                  <option key={d} value={d}>
                    {t('planRdv.minutes', { count: d })}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {(type === 'visit' || type === 'notary') && linkedBiens.length > 0 && (
            <div>
              <label style={labelStyle}>{t('planRdv.linkedProperty')}</label>
              <select
                value={bienId}
                onChange={e => setBienId(e.target.value)}
                style={inputStyle}
              >
                <option value="">{t('planRdv.noProperty')}</option>
                {linkedBiens.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.title || b.addr || b.id}
                    {b.price ? ` · ${ctFmtCHF(b.price)}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {(type === 'visit' || type === 'notary' || type === 'other') && (
            <div>
              <label style={labelStyle}>{t('planRdv.location')}</label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder={
                  type === 'visit'
                    ? t('planRdv.locationPlaceholder.visit')
                    : type === 'notary'
                      ? t('planRdv.locationPlaceholder.notary')
                      : t('planRdv.locationPlaceholder.other')
                }
                style={inputStyle}
              />
            </div>
          )}

          <div>
            <label style={labelStyle}>{t('planRdv.invitedAgents')}</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CT_RDV_AGENTS.map(a => {
                const active = agents.includes(a.id)
                return (
                  <button
                    key={a.id}
                    onClick={() =>
                      setAgents(prev =>
                        active ? prev.filter(x => x !== a.id) : [...prev, a.id],
                      )
                    }
                    style={{
                      height: 32,
                      padding: '0 12px',
                      borderRadius: 999,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: active ? sp.ink : sp.pageBg,
                      border: `1px solid ${active ? sp.ink : sp.cardBorder}`,
                      color: active ? sp.pageBg : sp.ink,
                      fontSize: 12,
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {active && <span style={{ fontSize: 10 }}>✓</span>}
                    {a.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t('planRdv.notes')}</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder={t('planRdv.notesPlaceholder')}
              style={{
                ...inputStyle,
                height: 80,
                padding: '10px 12px',
                resize: 'vertical',
                lineHeight: 1.5,
              }}
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: `1px solid ${sp.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            background: dark ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
          }}
        >
          <div style={{ fontSize: 11, color: sp.sub, fontWeight: 500 }}>
            {t('planRdv.shortcutHint')}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                background: 'transparent',
                border: `1px solid ${sp.cardBorder}`,
                color: sp.ink,
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('common:actions.cancel')}
            </button>
            <button
              onClick={handleSave}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 999,
                background: sp.ink,
                border: 0,
                color: sp.pageBg,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: sp.focusShadow,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MEIcon name="check" size={12} color={sp.pageBg} />
              {t('planRdv.submit')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
