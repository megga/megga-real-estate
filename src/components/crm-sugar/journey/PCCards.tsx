// MEGGA CRM Sugar v2 — Parcours task cards (BigCard, MiniRow, GridCard) + connectors
// 1:1 port from `crm-screen-parcours-sugar.jsx`.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '../tokens'
import type { ParcoursAgent, ParcoursTask } from './journeyData'

interface CardProps {
  task: ParcoursTask
  agent: ParcoursAgent | undefined
  sp: SugarPalette
  dark: boolean
  onClick: () => void
}

export function PCBigCard({ task, agent, sp, dark, onClick }: CardProps) {
  const { t: tr } = useTranslation('pipeline')
  const [hover, setHover] = useState(false)
  const isActive = task.state === 'active'
  const isDone = task.state === 'done'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isActive
          ? sp.focusBg
          : hover
            ? sp.cardBg
            : dark
              ? 'rgba(255,255,255,.025)'
              : 'rgba(255,255,255,.62)',
        color: isActive ? sp.focusInk : sp.ink,
        border: isActive ? 0 : `1px solid ${sp.cardBorder}`,
        borderRadius: 22,
        padding: '14px 16px 16px',
        boxShadow: isActive ? sp.focusShadow : hover ? sp.shadow : sp.shadowSm,
        position: 'relative',
        minHeight: 132,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition:
          'transform 220ms cubic-bezier(.22,1,.36,1), box-shadow 220ms ease, opacity 220ms ease',
        opacity: isDone ? 0.78 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            background: agent ? agent.avatarBg : '#0B0C0E',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 13,
            fontWeight: 700,
            border: `2px solid ${
              isActive ? 'rgba(255,255,255,0.18)' : sp.avatarBorder
            }`,
            boxShadow: '0 2px 6px rgba(0,0,0,.18)',
          }}
        >
          {agent ? agent.initials : '+'}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={e => e.stopPropagation()}
            title={tr('journey.task.actions.markDone')}
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: 0,
              padding: 0,
              cursor: 'pointer',
              background: isDone
                ? '#0E9F6E'
                : isActive
                  ? 'rgba(255,255,255,0.14)'
                  : sp.cardSubBg,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isDone ? '#fff' : isActive ? sp.focusInk : '#0E9F6E'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m3 13 4 4 8-10" />
              <path d="m9 13 4 4 8-10" />
            </svg>
          </button>
          <button
            onClick={e => e.stopPropagation()}
            title={tr('journey.task.actions.reschedule')}
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: 0,
              padding: 0,
              cursor: 'pointer',
              background: isActive ? 'rgba(255,255,255,0.14)' : sp.cardSubBg,
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <MEIcon name="calendar" size={12} color={isActive ? sp.focusInk : sp.soft} />
          </button>
        </div>
      </div>

      <div style={{ marginTop: 'auto' }}>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            lineHeight: 1.3,
            color: isActive ? sp.focusInk : sp.ink,
            letterSpacing: -0.1,
          }}
        >
          {task.label}
        </div>
        {task.sub && (
          <div
            style={{
              fontSize: 11,
              marginTop: 4,
              fontWeight: 500,
              color: isActive ? 'rgba(255,255,255,.7)' : sp.sub,
            }}
          >
            {task.sub}
          </div>
        )}
      </div>

      {isActive && (
        <span
          style={{
            position: 'absolute',
            top: -8,
            left: -8,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: sp.pageBg,
            display: 'grid',
            placeItems: 'center',
            boxShadow: sp.shadowSm,
          }}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill={sp.focusBg}
            stroke="none"
            strokeLinejoin="round"
          >
            <path d="m3 3 7 18 2.5-7.5L20 11Z" />
          </svg>
        </span>
      )}
    </div>
  )
}

export function PCMiniRow({ task, agent, sp, dark, onClick }: CardProps) {
  const { t: tr } = useTranslation('pipeline')
  const [hover, setHover] = useState(false)
  const isActive = task.state === 'active'
  const isDone = task.state === 'done'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isActive
          ? sp.focusBg
          : hover
            ? sp.cardBg
            : dark
              ? 'rgba(255,255,255,.025)'
              : 'rgba(255,255,255,.6)',
        color: isActive ? sp.focusInk : sp.ink,
        border: isActive ? 0 : `1px solid ${sp.cardBorder}`,
        borderRadius: 16,
        padding: '10px 12px',
        boxShadow: isActive ? sp.focusShadow : hover ? sp.shadow : 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease',
        opacity: isDone ? 0.65 : 1,
        position: 'relative',
      }}
    >
      {agent ? (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: agent.avatarBg,
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {agent.initials}
        </div>
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            background: sp.cardSubBg,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <MEIcon name="plus" size={12} color={sp.soft} />
        </div>
      )}
      <div
        style={{
          flex: 1,
          fontSize: 12.5,
          fontWeight: 600,
          lineHeight: 1.3,
          color: isActive ? sp.focusInk : sp.ink,
          textDecoration: isDone ? 'line-through' : 'none',
        }}
      >
        {task.label}
      </div>
      <button
        onClick={e => e.stopPropagation()}
        title={tr('journey.task.actions.more')}
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          border: 0,
          padding: 0,
          cursor: 'pointer',
          background: isActive ? 'rgba(255,255,255,0.12)' : 'transparent',
          color: isActive ? sp.focusInk : sp.sub,
          fontSize: 13,
          lineHeight: 0.5,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
          fontFamily: 'inherit',
        }}
      >
        ···
      </button>
    </div>
  )
}

export function PCGridCard({ task, agent, sp, dark, onClick }: CardProps) {
  const [hover, setHover] = useState(false)
  const isActive = task.state === 'active'
  const isDone = task.state === 'done'
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: isActive
          ? sp.focusBg
          : hover
            ? sp.cardBg
            : dark
              ? 'rgba(255,255,255,.025)'
              : 'rgba(255,255,255,.6)',
        color: isActive ? sp.focusInk : sp.ink,
        border: isActive ? 0 : `1px solid ${sp.cardBorder}`,
        borderRadius: 18,
        padding: '12px 12px 14px',
        boxShadow: isActive ? sp.focusShadow : hover ? sp.shadow : sp.shadowSm,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        cursor: 'pointer',
        transform: hover ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease',
        opacity: isDone ? 0.72 : 1,
        minHeight: 78,
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: 999,
          background: isDone
            ? '#0E9F6E'
            : isActive
              ? 'rgba(255,255,255,0.14)'
              : agent
                ? agent.avatarBg
                : sp.cardSubBg,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 9,
          fontWeight: 700,
        }}
      >
        {isDone ? (
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 13 4 4 10-12" />
          </svg>
        ) : agent ? (
          agent.initials
        ) : (
          '+'
        )}
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 700,
          lineHeight: 1.25,
          color: isActive ? sp.focusInk : sp.ink,
          letterSpacing: -0.1,
        }}
      >
        {task.label}
      </div>
    </div>
  )
}

export function PCColConnector({ sp, dark, hot }: { sp: SugarPalette; dark: boolean; hot: boolean }) {
  const stroke = hot
    ? sp.ink
    : dark
      ? 'rgba(255,255,255,0.22)'
      : 'rgba(15,23,42,0.22)'
  return (
    <div
      style={{
        height: 14,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width="2" height="14" viewBox="0 0 2 14" style={{ overflow: 'visible' }}>
        <line
          x1="1"
          y1="0"
          x2="1"
          y2="14"
          stroke={stroke}
          strokeWidth="1.6"
          strokeDasharray="2 3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}
