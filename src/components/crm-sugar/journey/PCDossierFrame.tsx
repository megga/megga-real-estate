// MEGGA CRM Sugar v2 — Dossier bento (header notch + 4 stage columns)
// 1:1 port from `crm-screen-parcours-sugar.jsx` (PCDossierFrame + PCBigAvatar + RoundBtn).

import { useState, type ReactNode } from 'react'
import MEIcon from '@/components/propertyx/MEIcon'
import type { SugarPalette } from '../tokens'
import { PCBentoShape } from './PCBentoShape'
import { PCColumn } from './PCColumn'
import {
  PARCOURS_STAGES,
  URGENCY_MAP,
  parcoursAgentById,
  type ParcoursAgent,
  type ParcoursDossier,
  type ParcoursTask,
} from './journeyData'

interface PCDossierFrameProps {
  dossier: ParcoursDossier
  sp: SugarPalette
  dark: boolean
  onTaskClick: (task: ParcoursTask) => void
}

export function PCDossierFrame({
  dossier,
  sp,
  dark,
  onTaskClick,
}: PCDossierFrameProps) {
  const u = URGENCY_MAP[dossier.urgency]

  const HEADER_H = 96
  const NOTCH_DEPTH = 38
  const AVATAR = 50
  const AVATAR_GAP = 14
  // Équipe (RBAC) non câblée → team toujours vide. Pas de notch ni d'avatars
  // tant qu'il n'y a personne à montrer (évite un panorama d'équipe trompeur +
  // un bouton « + » non fonctionnel).
  const teamCount = dossier.team.length > 0 ? dossier.team.length + 1 : 0
  const NOTCH_W = teamCount > 0 ? teamCount * AVATAR + (teamCount - 1) * AVATAR_GAP + 40 : 0

  const bentoFill = dark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.55)'
  const bentoStroke = sp.frameBorder

  return (
    <div
      style={{
        position: 'relative',
        paddingTop: HEADER_H + 6,
      }}
    >
      <PCBentoShape
        headerH={HEADER_H}
        notchW={NOTCH_W}
        notchDepth={NOTCH_DEPTH}
        fill={bentoFill}
        stroke={bentoStroke}
        shadow={sp.shadow}
      />

      {/* Header */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: HEADER_H,
          display: 'flex',
          alignItems: 'center',
          padding: '0 28px',
          zIndex: 2,
        }}
      >
        {/* Title + urgency */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: -0.3,
              color: sp.ink,
              lineHeight: 1.15,
            }}
          >
            {dossier.title}
          </h2>
          {dossier.subtitle && (
            <span
              style={{
                fontSize: 11.5,
                color: sp.sub,
                fontWeight: 500,
              }}
            >
              {dossier.subtitle}
            </span>
          )}
          <span
            style={{
              marginTop: 4,
              padding: '3px 9px',
              borderRadius: 999,
              background: u.bg,
              color: u.fg,
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: 0.3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              textTransform: 'uppercase',
              alignSelf: 'flex-start',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 999,
                background: u.dot,
              }}
            />
            {u.label}
          </span>
        </div>

        {/* Avatars in notch — masqués tant que l'équipe (RBAC) n'est pas câblée
            (team toujours vide) : pas de panorama d'équipe ni de « + » trompeur. */}
        {dossier.team.length > 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'flex-start',
            paddingTop: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: AVATAR_GAP,
            }}
          >
            {dossier.team.map(m => {
              const agent = parcoursAgentById(m.agentId)
              if (!agent) return null
              return (
                <PCBigAvatar
                  key={m.agentId}
                  agent={agent}
                  count={m.count}
                  badgeColor={m.badgeColor}
                  sp={sp}
                />
              )
            })}
            {/* "+" placeholder */}
            <div
              title="Ajouter un membre"
              style={{
                position: 'relative',
                width: AVATAR,
                height: AVATAR + 6,
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: AVATAR,
                  height: AVATAR,
                  borderRadius: 999,
                  background: dark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  border: `2px dashed ${
                    dark ? 'rgba(255,255,255,0.22)' : 'rgba(15,23,42,0.20)'
                  }`,
                  color: sp.sub,
                  display: 'grid',
                  placeItems: 'center',
                  boxSizing: 'border-box',
                }}
              >
                <MEIcon name="plus" size={16} color={sp.sub} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  bottom: -2,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#D1D5DB',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 999,
                  border: `2px solid ${sp.avatarBorder}`,
                  minWidth: 20,
                  textAlign: 'center',
                }}
              >
                +
              </div>
            </div>
          </div>
        </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}

        {/* Right actions */}
        <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
          <RoundBtn sp={sp} title="Ajouter une tâche">
            <MEIcon name="plus" size={16} color={sp.soft} />
          </RoundBtn>
          <RoundBtn sp={sp} title="Partager au réseau">
            <MEIcon name="share" size={16} color={sp.soft} />
          </RoundBtn>
          <RoundBtn sp={sp} title="Planifier">
            <MEIcon name="calendar" size={16} color={sp.soft} />
          </RoundBtn>
        </div>
      </div>

      {/* Body */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '0 26px 24px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1.2fr',
          gap: 18,
          alignItems: 'start',
        }}
      >
        {PARCOURS_STAGES.map(stage => (
          <PCColumn
            key={stage.id}
            stage={stage}
            tasks={dossier.columns[stage.id] || []}
            sp={sp}
            dark={dark}
            onTaskClick={onTaskClick}
          />
        ))}
      </div>
    </div>
  )
}

interface PCBigAvatarProps {
  agent: ParcoursAgent
  count?: number
  badgeColor?: string
  sp: SugarPalette
}

export function PCBigAvatar({ agent, count, badgeColor, sp }: PCBigAvatarProps) {
  const [hover, setHover] = useState(false)
  return (
    <div
      title={`${agent.firstName} ${agent.lastName} — ${agent.role}${
        count ? ` · ${count} tâches en cours` : ''
      }`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'relative',
        width: 50,
        height: 56,
        cursor: 'pointer',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 200ms cubic-bezier(.22,1,.36,1)',
      }}
    >
      <div
        style={{
          width: 50,
          height: 50,
          borderRadius: 999,
          background: agent.avatarBg,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 14,
          fontWeight: 700,
          border: `3px solid ${sp.avatarBorder}`,
          boxSizing: 'border-box',
          boxShadow: hover
            ? '0 6px 16px rgba(0,0,0,.18)'
            : '0 2px 8px rgba(0,0,0,.12)',
          transition: 'box-shadow 200ms ease',
        }}
      >
        {agent.initials}
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: -2,
          left: '50%',
          transform: 'translateX(-50%)',
          background: badgeColor || '#D1D5DB',
          color: '#fff',
          fontSize: 10,
          fontWeight: 700,
          padding: '2px 7px',
          borderRadius: 999,
          border: `2px solid ${sp.avatarBorder}`,
          minWidth: 20,
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums',
          opacity: count ? 1 : 0.7,
        }}
      >
        {count || '+'}
      </div>
    </div>
  )
}

function RoundBtn({
  children,
  title,
  sp,
}: {
  children: ReactNode
  title: string
  sp: SugarPalette
}) {
  return (
    <button
      title={title}
      style={{
        width: 38,
        height: 38,
        borderRadius: 999,
        border: 0,
        background: sp.iconBtnBg,
        boxShadow: sp.shadowSm,
        display: 'grid',
        placeItems: 'center',
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      {children}
    </button>
  )
}
