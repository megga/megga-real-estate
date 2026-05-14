// MEGGA CRM Sugar v2 — Calendar right panel (event detail + AI brief + actions)
// 1:1 port from `crm-calendar-sugar-panels.jsx` (CalRightPanel + CalAction).

import { CalIcon, type CalIconName } from './CalIcon'
import { CAL_EVENT_TYPES, CAL_PALETTE, type CalEvent } from './data'
import { fmtDate, fmtTime, generateBrief, shadeMix } from './helpers'

interface CalRightPanelProps {
  event: CalEvent | null | undefined
}

export function CalRightPanel({ event }: CalRightPanelProps) {
  const SP = CAL_PALETTE

  if (!event) {
    return (
      <aside
        style={{
          width: 320,
          flexShrink: 0,
          background: SP.card,
          borderRadius: 24,
          padding: 24,
          boxShadow: SP.shadowSm,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: 10,
          color: SP.muted,
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: SP.cardSubtle,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <CalIcon name="eye" size={20} stroke={SP.muted} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: SP.inkSoft }}>
          Sélectionnez un événement
        </div>
        <div style={{ fontSize: 11, color: SP.muted, lineHeight: 1.5, maxWidth: 200 }}>
          Cliquez sur un RDV pour voir le détail, le brief AI et lancer les actions.
        </div>
      </aside>
    )
  }

  const t = CAL_EVENT_TYPES[event.type]

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
      {/* Header */}
      <div
        style={{
          background: t.bg,
          color: t.ink,
          borderRadius: 24,
          padding: 20,
          boxShadow: SP.shadow,
        }}
      >
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 800,
            opacity: 0.7,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
            marginBottom: 8,
          }}
        >
          {t.label}
        </div>
        <div
          style={{
            fontSize: 19,
            fontWeight: 700,
            letterSpacing: -0.4,
            lineHeight: 1.25,
            marginBottom: 12,
          }}
        >
          {event.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <CalIcon name="clock" size={13} stroke={t.ink} sw={2} />
          {fmtDate(event.start)} · {fmtTime(event.start)} – {fmtTime(event.end)}
        </div>
        {event.location && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 12,
              fontWeight: 500,
              marginTop: 8,
              opacity: 0.85,
            }}
          >
            <CalIcon name="pin" size={13} stroke={t.ink} sw={2} />
            <span>{event.location}</span>
          </div>
        )}
      </div>

      {/* Property */}
      {event.property && (
        <div
          style={{
            background: SP.card,
            borderRadius: 18,
            padding: 14,
            boxShadow: SP.shadowSm,
            display: 'flex',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              flexShrink: 0,
              background: `repeating-linear-gradient(135deg, ${event.property.tone} 0 10px, ${shadeMix(
                event.property.tone,
                -0.04,
              )} 10px 20px)`,
              display: 'grid',
              placeItems: 'center',
              color: 'rgba(11,12,14,0.18)',
            }}
          >
            <CalIcon name="home" size={26} stroke="currentColor" sw={1} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: SP.muted,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                marginBottom: 3,
              }}
            >
              Bien lié
            </div>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: SP.ink,
                letterSpacing: -0.2,
                lineHeight: 1.3,
                marginBottom: 4,
              }}
            >
              {event.property.title}
            </div>
            <div style={{ fontSize: 11.5, color: SP.muted, fontWeight: 500 }}>
              {event.property.area} m²
              {event.property.price && (
                <>
                  {' '}
                  ·{' '}
                  {event.property.price
                    .toLocaleString('fr-CH')
                    .replace(/[\u00A0\u202F,]/g, "'")}{' '}
                  CHF
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Contact */}
      {event.contact && (
        <div
          style={{
            background: SP.card,
            borderRadius: 18,
            padding: 14,
            boxShadow: SP.shadowSm,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                background: SP.black,
                color: '#fff',
                display: 'grid',
                placeItems: 'center',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {event.contact.name
                .split(' ')
                .map(s => s[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: SP.muted,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  marginBottom: 2,
                }}
              >
                {event.contact.role}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: SP.ink,
                  letterSpacing: -0.2,
                }}
              >
                {event.contact.name}
              </div>
            </div>
            {event.contact.warm && (
              <div
                style={{
                  padding: '4px 8px',
                  borderRadius: 999,
                  background: '#FFF3E1',
                  color: '#7A4A14',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <CalIcon name="flame" size={9} stroke="#A8631C" sw={2.4} />
                {event.contact.warm}%
              </div>
            )}
          </div>
          {event.contact.phone && (
            <div
              style={{
                marginTop: 12,
                padding: '8px 11px',
                borderRadius: 10,
                background: SP.cardSubtle,
                fontSize: 12,
                fontWeight: 600,
                color: SP.inkSoft,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontFamily: 'ui-monospace, Menlo, monospace',
              }}
            >
              <CalIcon name="phone" size={12} stroke={SP.inkSoft} sw={2} />
              {event.contact.phone}
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {event.notes && (
        <div
          style={{
            background: SP.card,
            borderRadius: 18,
            padding: 14,
            boxShadow: SP.shadowSm,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: SP.muted,
              letterSpacing: 0.9,
              textTransform: 'uppercase',
              marginBottom: 6,
            }}
          >
            Notes
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: SP.inkSoft,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            {event.notes}
          </div>
        </div>
      )}

      {/* AI brief */}
      <div
        style={{
          background: SP.black,
          color: '#fff',
          borderRadius: 18,
          padding: 16,
          boxShadow: SP.shadow,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 8,
            opacity: 0.6,
          }}
        >
          <CalIcon name="sparkle" size={11} stroke="#fff" sw={2.2} />
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            Brief MEGGA AI
          </div>
        </div>
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.55,
            fontWeight: 500,
            opacity: 0.92,
          }}
        >
          {generateBrief(event)}
        </div>
        <button
          style={{
            marginTop: 12,
            height: 34,
            padding: '0 14px',
            borderRadius: 999,
            border: 0,
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            fontSize: 11.5,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CalIcon name="mic" size={11} stroke="#fff" sw={2} />
          Écouter le brief vocal
        </button>
      </div>

      {/* Actions */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 8,
        }}
      >
        {event.contact?.phone && <CalAction icon="phone" label="Appeler" />}
        {event.location && <CalAction icon="car" label="Itinéraire" />}
        <CalAction icon="check" label="Marquer fait" />
        <CalAction icon="close" label="Annuler" danger />
      </div>
    </aside>
  )
}

function CalAction({
  icon,
  label,
  danger,
}: {
  icon: CalIconName
  label: string
  danger?: boolean
}) {
  const SP = CAL_PALETTE
  return (
    <button
      style={{
        height: 40,
        borderRadius: 12,
        border: 0,
        background: danger ? '#FFF' : SP.card,
        color: danger ? '#B33A2A' : SP.ink,
        boxShadow: SP.shadowSm,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        transition: 'all .15s',
      }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = SP.shadow)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = SP.shadowSm)}
    >
      <CalIcon name={icon} size={13} stroke={danger ? '#B33A2A' : SP.ink} sw={2} />
      {label}
    </button>
  )
}
