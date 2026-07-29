// MEGGA CRM Sugar v2 — Parcours column (white card holding stacked rows or 2x2 grid for closing)
// 1:1 port from `crm-screen-parcours-sugar.jsx` (PCColumn + ColLabel).

import { Fragment } from 'react'
import { crmStep, type SugarPalette } from '../tokens'
import { parcoursAgentById, type ParcoursStage, type ParcoursTask } from './journeyData'
import { PCBigCard, PCColConnector, PCGridCard, PCMiniRow } from './PCCards'

interface PCColumnProps {
  stage: ParcoursStage
  tasks: ParcoursTask[]
  sp: SugarPalette
  dark: boolean
  onTaskClick: (task: ParcoursTask) => void
}

export function PCColumn({ stage, tasks, sp, dark, onTaskClick }: PCColumnProps) {
  const isClosing = stage.id === 'closing'

  if (isClosing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          {tasks.map(task => (
            <PCGridCard
              key={task.id}
              task={task}
              agent={parcoursAgentById(task.agentId)}
              sp={sp}
              dark={dark}
              onClick={() => onTaskClick(task)}
            />
          ))}
        </div>
        <ColLabel label={stage.label} sp={sp} />
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        position: 'relative',
      }}
    >
      <div
        style={{
          background: dark ? crmStep('s2', 'rgba(255,255,255,0.04)') : '#FFFFFF',
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 22,
          padding: '14px 14px',
          boxShadow: sp.shadowSm,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
        }}
      >
        {tasks.map((task, i) => {
          const Comp = task.big ? PCBigCard : PCMiniRow
          return (
            <Fragment key={task.id}>
              <Comp
                task={task}
                agent={parcoursAgentById(task.agentId)}
                sp={sp}
                dark={dark}
                onClick={() => onTaskClick(task)}
              />
              {i < tasks.length - 1 && (
                <PCColConnector sp={sp} dark={dark} hot={task.state === 'active'} />
              )}
            </Fragment>
          )
        })}
      </div>
      <ColLabel label={stage.label} sp={sp} />
    </div>
  )
}

function ColLabel({ label, sp }: { label: string; sp: SugarPalette }) {
  return (
    <div
      style={{
        textAlign: 'center',
        marginTop: 6,
        fontSize: 12,
        fontWeight: 600,
        color: sp.soft,
        letterSpacing: -0.1,
      }}
    >
      {label}
    </div>
  )
}
