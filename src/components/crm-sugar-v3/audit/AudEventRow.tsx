// MEGGA CRM Sugar v3 — Ligne d'évènement journal d'audit
// Port 1:1 de crm-screen-audit-sugar.jsx lignes 136-241 (AudEventRow).

import { useState } from 'react'
import i18n from '@/i18n' // libellés acteur/sévérité/détails traduits au render (common:audit.*) ; event.action reste la valeur DB stockée
import { SugarV3, AUDIT_CATEGORIES, AUDIT_CAT_ICONS } from '../tokens'
import { SgIcon } from '../icons'
import { KycCircleBtn } from '../primitives'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  event: AuditEvent
  last: boolean
}

export function AudEventRow({ event, last }: Props) {
  const [hover, setHover] = useState(false)

  const cat = event.category
    ? AUDIT_CATEGORIES[event.category] ?? {
        label: event.category,
        tone: SugarV3.muted,
      }
    : { label: '—', tone: SugarV3.muted }

  const actor = event.actor_id
    ? {
        name: i18n.t('common:audit.actor.agent'),
        initials: 'AG',
        // Avatar > 7x7 px → reste neutre Sugar Pure (zero bleu marketplace #0041D9)
        avatarBg: SugarV3.inkSoft,
        isSystem: false,
      }
    : {
        name: i18n.t('common:audit.actor.system'),
        initials: 'AI',
        avatarBg: SugarV3.black,
        isSystem: true,
      }

  const sev = event.severity ?? 'info'
  const fmt = (iso: string) => {
    const d = new Date(iso)
    return {
      date: d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' }),
      time: d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' }),
    }
  }
  const dt = fmt(event.created_at)

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid',
        gridTemplateColumns: '86px 44px 1.7fr 1fr auto',
        gap: 18,
        alignItems: 'center',
        padding: '18px 24px',
        background: hover ? SugarV3.cardSubtle : 'transparent',
        borderBottom: last ? 'none' : `1px solid ${SugarV3.cardSubtle}`,
        transition: 'background .15s ease',
      }}
    >
      {/* Date/heure */}
      <div
        style={{
          fontSize: 12,
          color: SugarV3.muted,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ fontWeight: 700, color: SugarV3.ink, marginBottom: 2 }}>
          {dt.date}
        </div>
        <div>{dt.time}</div>
      </div>

      {/* Avatar acteur */}
      <div
        title={actor.name}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          color: '#fff',
          background: actor.avatarBg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.2,
        }}
      >
        {actor.isSystem ? (
          <SgIcon name="sparkle" size={15} stroke="#fff" />
        ) : (
          actor.initials
        )}
      </div>

      {/* Action + sévérité */}
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 13.5,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.15,
              whiteSpace: 'nowrap',
            }}
          >
            {event.action}
          </span>
          {sev !== 'info' && (
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 999,
                background:
                  sev === 'critical' ? SugarV3.errSoft : SugarV3.warnSoft,
                color: sev === 'critical' ? SugarV3.errDarker : '#8C5A00',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.2,
                textTransform: 'uppercase',
              }}
            >
              {sev === 'critical' ? i18n.t('common:audit.severity.critical') : i18n.t('common:audit.severity.warning')}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 12,
            color: SugarV3.muted,
            fontWeight: 500,
            lineHeight: 1.5,
          }}
        >
          {event.object_label ?? '—'}
        </div>
      </div>

      {/* Objet ciblé + catégorie */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            background: SugarV3.cardSubtle,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SgIcon
            name={
              event.category
                ? AUDIT_CAT_ICONS[event.category] ?? 'file'
                : 'file'
            }
            size={14}
            stroke={cat.tone}
          />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: cat.tone,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
              marginBottom: 1,
            }}
          >
            {cat.label}
          </div>
          <div
            style={{
              fontSize: 12.5,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: 240,
            }}
          >
            {event.entity_type}
          </div>
        </div>
      </div>

      {/* IP / chevron */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {event.ip_address && (
          <span
            style={{
              fontSize: 10.5,
              color: SugarV3.muted,
              fontWeight: 500,
              fontVariantNumeric: 'tabular-nums',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          >
            {event.ip_address}
          </span>
        )}
        <KycCircleBtn
          size={32}
          title={i18n.t('common:audit.details')}
          icon={<SgIcon name="arrowR" size={13} stroke={SugarV3.inkSoft} />}
        />
      </div>
    </div>
  )
}
