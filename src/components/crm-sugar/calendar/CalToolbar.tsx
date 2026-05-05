// MEGGA CRM Sugar v2 — Calendar toolbar bits (CircleBtn + ViewToggle)
// 1:1 port from `crm-calendar-sugar-shell.jsx`.

import type { ReactNode } from 'react'
import { CAL_PALETTE } from './data'

interface CalCircleBtnProps {
  icon: ReactNode
  onClick?: () => void
  title?: string
  size?: number
}

export function CalCircleBtn({ icon, onClick, title, size = 40 }: CalCircleBtnProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: 0,
        background: CAL_PALETTE.cardSubtle,
        color: CAL_PALETTE.inkSoft,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'all .18s ease',
        flexShrink: 0,
        boxShadow: CAL_PALETTE.shadowSm,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = CAL_PALETTE.card
        e.currentTarget.style.boxShadow = CAL_PALETTE.shadow
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = CAL_PALETTE.cardSubtle
        e.currentTarget.style.boxShadow = CAL_PALETTE.shadowSm
      }}
    >
      {icon}
    </button>
  )
}

export type CalViewId = 'day' | 'week' | 'month' | 'agenda'

interface CalViewToggleProps {
  value: CalViewId
  onChange: (v: CalViewId) => void
}

export function CalViewToggle({ value, onChange }: CalViewToggleProps) {
  const opts: { id: CalViewId; label: string }[] = [
    { id: 'day', label: 'Jour' },
    { id: 'week', label: 'Semaine' },
    { id: 'month', label: 'Mois' },
    { id: 'agenda', label: 'Agenda' },
  ]
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: CAL_PALETTE.cardSubtle,
        boxShadow: `inset 0 0 0 1px ${CAL_PALETTE.line}`,
      }}
    >
      {opts.map(o => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 999,
              border: 0,
              background: active ? CAL_PALETTE.black : 'transparent',
              color: active ? '#fff' : CAL_PALETTE.inkSoft,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              letterSpacing: -0.1,
              boxShadow: active ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
              transition: 'all .18s ease',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
