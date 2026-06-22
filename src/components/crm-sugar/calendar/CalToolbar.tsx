// MEGGA CRM Sugar v2 — Calendar toolbar bits (CircleBtn + ViewToggle)
// 1:1 port from `crm-calendar-sugar-shell.jsx`.

import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useCalPalette } from './data'

interface CalCircleBtnProps {
  icon: ReactNode
  onClick?: () => void
  title?: string
  size?: number
}

export function CalCircleBtn({ icon, onClick, title, size = 40 }: CalCircleBtnProps) {
  const SP = useCalPalette()
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: 0,
        background: SP.cardSubtle,
        color: SP.inkSoft,
        cursor: 'pointer',
        display: 'grid',
        placeItems: 'center',
        transition: 'all .18s ease',
        flexShrink: 0,
        boxShadow: SP.shadowSm,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = SP.card
        e.currentTarget.style.boxShadow = SP.shadow
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = SP.cardSubtle
        e.currentTarget.style.boxShadow = SP.shadowSm
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
  const SP = useCalPalette()
  const { t } = useTranslation('calendar')
  const opts: { id: CalViewId; label: string }[] = [
    { id: 'day', label: t('panel.views.day') },
    { id: 'week', label: t('panel.views.week') },
    { id: 'month', label: t('panel.views.month') },
    { id: 'agenda', label: t('panel.views.agenda') },
  ]
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: 4,
        borderRadius: 999,
        background: SP.cardSubtle,
        boxShadow: `inset 0 0 0 1px ${SP.line}`,
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
              background: active ? SP.accent : 'transparent',
              color: active ? SP.onAccent : SP.inkSoft,
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
