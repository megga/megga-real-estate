// MEGGA CRM Sugar v3 — Groupe d'évènements par jour
// Port 1:1 de crm-screen-audit-sugar.jsx lignes 244-268 (AudDayGroup).

import { useMemo } from 'react'
import i18n from '@/i18n'
import { useCrmDark } from '@/lib/crmDark'
import { dossierPalette } from '../tokens'
import { AudEventRow } from './AudEventRow'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  dateLabel: string
  events: AuditEvent[]
}

export function AudDayGroup({ dateLabel, events }: Props) {
  const dark = useCrmDark()
  const S = useMemo(() => dossierPalette(dark), [dark])
  const count = events.length
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 28px 12px',
          background: S.cardSubtle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
          <span
            style={{
              fontSize: 'var(--crm-text-lg)',
              fontWeight: 600,
              color: S.ink,
              letterSpacing: -0.1,
            }}
          >
            {dateLabel}
          </span>
          <span
            style={{
              padding: 'var(--crm-space-2xs) var(--crm-space-md)',
              borderRadius: 'var(--crm-radius-pill)',
              background: S.card,
              fontSize: 'var(--crm-text-xs)',
              fontWeight: 600,
              color: S.inkSoft,
              fontVariantNumeric: 'tabular-nums',
              boxShadow: S.shadowSm,
            }}
          >
            {i18n.t('common:audit.eventCount', { count })}
          </span>
        </div>
      </div>
      {events.map((ev, i) => (
        <AudEventRow
          key={ev.id}
          event={ev}
          last={i === events.length - 1}
        />
      ))}
    </div>
  )
}
