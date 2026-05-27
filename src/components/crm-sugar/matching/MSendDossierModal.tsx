// MEGGA CRM Sugar v2 — Send dossier modal
// 1:1 port from `crm-screen-matching-sugar.jsx` (MSendDossierModal).

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { crmBienById } from '../mockData'
import { useAuth } from '@/hooks/useAuth'
import { useAgencySettings } from '@/hooks/useAgencySettings'
import type { SugarPalette } from '../tokens'
import { BienIcon } from './BienIcon'
import { mColor, matchKey, type MatchGroup } from './helpers'

export type SendChannel = 'email' | 'whatsapp' | 'sms'

interface MSendDossierModalProps {
  group: MatchGroup
  sp: SugarPalette
  dark: boolean
  onClose: () => void
  onSend: (matchIds: string[], channel: SendChannel) => void
}

export function MSendDossierModal({
  group,
  sp,
  dark,
  onClose,
  onSend,
}: MSendDossierModalProps) {
  const { buyer, matches } = group
  const fullName = `${buyer.firstName} ${buyer.lastName}`
  const initials = (buyer.firstName?.[0] || '') + (buyer.lastName?.[0] || '')
  const avatarBg = buyer.avatarBg || '#0041D9'

  // Signature email lue depuis le vrai agent connecté + agence (au lieu de
  // "Gregory Lyonnet · MEGGA Genève · +41 22 555 01 02" hardcodé).
  const { profile, user } = useAuth()
  const { agency } = useAgencySettings()
  const agentName = profile?.full_name?.trim() || user?.email?.split('@')[0] || 'L\'équipe MEGGA'
  const agencyName = agency?.name?.trim() || 'MEGGA'
  const agencyPhone = agency?.phone?.trim() || ''

  const [channel, setChannel] = useState<SendChannel>('email')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(matches.filter(m => m.score >= 75).map(matchKey)),
  )

  const defaultMessage =
    `Bonjour ${buyer.firstName},\n\n` +
    `Suite à notre échange, je vous transmets une sélection de biens qui correspondent à vos critères.\n\n` +
    `N'hésitez pas à me dire ce que vous en pensez, et nous organiserons les visites des biens qui vous intéressent.\n\n` +
    `Bien à vous,\n` +
    `${agentName}\n` +
    `${agencyName}` +
    (agencyPhone ? `\n${agencyPhone}` : '')
  const [message, setMessage] = useState(defaultMessage)

  const recipient = channel === 'email' ? buyer.email : buyer.phone

  const toggle = (key: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const selectedCount = selectedIds.size
  const canSend = selectedCount > 0

  const handleSend = () => {
    if (!canSend) return
    const ids = matches.filter(m => selectedIds.has(matchKey(m))).map(matchKey)
    onSend(ids, channel)
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
            width: 'min(560px, 100%)',
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
                Envoyer un dossier
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
              Canal
            </div>
            <div
              style={{
                display: 'flex',
                gap: 6,
                padding: 4,
                marginBottom: 16,
                background: sp.cardSubBg,
                borderRadius: 12,
                border: `1px solid ${sp.cardBorder}`,
              }}
            >
              {(
                [
                  { id: 'email', label: 'Email' },
                  { id: 'whatsapp', label: 'WhatsApp' },
                  { id: 'sms', label: 'SMS' },
                ] as const
              ).map(c => {
                const active = channel === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => setChannel(c.id)}
                    style={{
                      flex: 1,
                      height: 34,
                      borderRadius: 9,
                      border: 0,
                      background: active ? sp.cardBg : 'transparent',
                      color: active ? sp.ink : sp.sub,
                      fontSize: 12.5,
                      fontWeight: 600,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      boxShadow: active ? '0 1px 3px rgba(0,0,0,.06)' : 'none',
                      transition: 'all 160ms ease',
                    }}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>

            <div
              style={{
                padding: '10px 14px',
                borderRadius: 12,
                background: sp.cardSubBg,
                border: `1px solid ${sp.cardBorder}`,
                fontSize: 12.5,
                color: sp.sub,
                marginBottom: 18,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span style={{ fontWeight: 600, color: sp.ink }}>À :</span>
              <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 12 }}>
                {recipient}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
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
                Biens à envoyer · {selectedCount}/{matches.length}
              </div>
              <button
                onClick={() =>
                  setSelectedIds(
                    selectedCount === matches.length
                      ? new Set()
                      : new Set(matches.map(matchKey)),
                  )
                }
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#0041D9',
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  padding: 0,
                }}
              >
                {selectedCount === matches.length
                  ? 'Tout désélectionner'
                  : 'Tout sélectionner'}
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                marginBottom: 18,
              }}
            >
              {matches.map((m, i) => {
                const b = crmBienById(m.bienId)
                if (!b) return null
                const key = matchKey(m)
                const checked = selectedIds.has(key)
                const col = mColor(m.score)
                const price = b.price?.toLocaleString('fr-CH').replace(/,/g, ' ')
                return (
                  <label
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: 10,
                      borderRadius: 14,
                      background: checked ? sp.cardBg : sp.cardSubBg,
                      border: `1px solid ${checked ? '#0041D955' : sp.cardBorder}`,
                      cursor: 'pointer',
                      transition: 'all 160ms ease',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(key)}
                      style={{
                        width: 18,
                        height: 18,
                        accentColor: '#0041D9',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    />
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: dark ? 'rgba(255,255,255,.04)' : '#FBFAF8',
                        border: `1px solid ${sp.cardBorder}`,
                        display: 'grid',
                        placeItems: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <BienIcon bien={b} size={22} color={sp.soft} opacity={0.55} />
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
                        {b.canton} · {price ? `CHF ${price}` : '—'}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: col,
                        flexShrink: 0,
                      }}
                    >
                      {m.score}
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
              Message
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={8}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: 14,
                borderRadius: 14,
                border: `1px solid ${sp.cardBorder}`,
                background: sp.cardBg,
                color: sp.ink,
                fontSize: 13,
                lineHeight: 1.55,
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
              justifyContent: 'flex-end',
            }}
          >
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
              onClick={handleSend}
              disabled={!canSend}
              style={{
                height: 44,
                padding: '0 22px',
                borderRadius: 999,
                border: 0,
                background: canSend ? sp.ink : sp.sub,
                color: sp.pageBg,
                fontSize: 13.5,
                fontWeight: 700,
                fontFamily: 'inherit',
                cursor: canSend ? 'pointer' : 'not-allowed',
                boxShadow: canSend ? sp.focusShadow : 'none',
                opacity: canSend ? 1 : 0.6,
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
                <path d="m22 2-7 20-4-9-9-4 20-7Z" />
              </svg>
              Envoyer ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body,
  )
}
