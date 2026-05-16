// MEGGA CRM Sugar v3 — Groupe d'évènements par jour
// Port 1:1 de crm-screen-audit-sugar.jsx lignes 244-268 (AudDayGroup).

import { SugarV3 } from '../tokens'
import { AudEventRow } from './AudEventRow'
import type { AuditEvent } from '@/types/kyc'

interface Props {
  dateLabel: string
  events: AuditEvent[]
}

export function AudDayGroup({ dateLabel, events }: Props) {
  const count = events.length
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '18px 28px 12px',
          background: SugarV3.cardSubtle,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.1,
            }}
          >
            {dateLabel}
          </span>
          <span
            style={{
              padding: '2px 9px',
              borderRadius: 999,
              background: SugarV3.card,
              fontSize: 10.5,
              fontWeight: 700,
              color: SugarV3.inkSoft,
              fontVariantNumeric: 'tabular-nums',
              boxShadow: SugarV3.shadowSm,
            }}
          >
            {count} évènement{count > 1 ? 's' : ''}
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
