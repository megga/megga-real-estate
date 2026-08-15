// MEGGA CRM Sugar v3 — Ligne d'évènement journal d'audit
// Port 1:1 de crm-screen-audit-sugar.jsx lignes 136-241 (AudEventRow).

import { useMemo, useState } from 'react'
import i18n from '@/i18n' // libellés acteur/sévérité/détails traduits au render (common:audit.*)
import { auditActionLabel } from '@/lib/auditActionLabel'
import { useSugarDark } from '@/lib/sugarDark'
import { sugarV3Palette, AUDIT_CATEGORIES, AUDIT_CAT_ICONS } from '../tokens'
import { SgIcon } from '../icons'
import { KycCircleBtn } from '../primitives'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  event: AuditEvent
  last: boolean
}

export function AudEventRow({ event, last }: Props) {
  const [hover, setHover] = useState(false)
  const dark = useSugarDark()
  const S = useMemo(() => sugarV3Palette(dark), [dark])

  const cat = event.category
    ? AUDIT_CATEGORIES[event.category] ?? {
        label: event.category,
        tone: S.muted,
      }
    : { label: '—', tone: S.muted }

  const actor = event.actor_id
    ? {
        name: i18n.t('common:audit.actor.agent'),
        initials: 'AG',
        // Avatar > 7x7 px → reste neutre Sugar Pure (zero bleu marketplace #0041D9)
        avatarBg: S.invBgSoft,
        isSystem: false,
      }
    : {
        name: i18n.t('common:audit.actor.system'),
        initials: 'AI',
        avatarBg: S.invBg,
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
        gap: 'var(--crm-space-4xl)',
        alignItems: 'center',
        padding: 'var(--crm-space-4xl) var(--crm-space-7xl)',
        background: hover ? S.cardSubtle : 'transparent',
        borderBottom: last ? 'none' : `1px solid ${S.cardSubtle}`,
        transition: 'background .15s ease',
      }}
    >
      {/* Date/heure */}
      <div
        style={{
          fontSize: 'var(--crm-text-md)',
          color: S.muted,
          fontWeight: 500,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <div style={{ fontWeight: 600, color: S.ink, marginBottom: 2 }}>
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
          borderRadius: 'var(--crm-radius-pill)',
          color: S.invInk,
          background: actor.avatarBg,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontSize: 'var(--crm-text-sm)',
          fontWeight: 600,
          letterSpacing: 0.2,
        }}
      >
        {actor.isSystem ? (
          <SgIcon name="sparkle" size={15} stroke={S.invInk} />
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
            gap: 'var(--crm-space-md)',
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
              color: S.ink,
              letterSpacing: -0.15,
              whiteSpace: 'nowrap',
            }}
          >
            {auditActionLabel(event.action)}
          </span>
          {sev !== 'info' && (
            <span
              style={{
                padding: 'var(--crm-space-2xs) var(--crm-space-md)',
                borderRadius: 'var(--crm-radius-pill)',
                background:
                  sev === 'critical' ? S.errSoft : S.warnSoft,
                color: sev === 'critical' ? S.errDarker : '#8C5A00',
                fontSize: 'var(--crm-text-xs)',
                fontWeight: 600,
                                              }}
            >
              {sev === 'critical' ? i18n.t('common:audit.severity.critical') : i18n.t('common:audit.severity.warning')}
            </span>
          )}
        </div>
        <div
          style={{
            fontSize: 'var(--crm-text-md)',
            color: S.muted,
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
          gap: 'var(--crm-space-lg)',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--crm-radius-md)',
            background: S.cardSubtle,
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
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 600,
              color: cat.tone,
                                          marginBottom: 1,
            }}
          >
            {cat.label}
          </div>
          <div
            style={{
              fontSize: 'var(--crm-text-md)',
              fontWeight: 600,
              color: S.ink,
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
        {event.ip_address && (
          <span
            style={{
              fontSize: 'var(--crm-text-xs)',
              color: S.muted,
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
          icon={<SgIcon name="arrowR" size={13} stroke={S.inkSoft} />}
        />
      </div>
    </div>
  )
}
