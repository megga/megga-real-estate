// MEGGA CRM Sugar v2 — Dossier bento (header notch + 4 stage columns)
// 1:1 port from `crm-screen-journey-screen.jsx` (PCDossierFrame + PCBigAvatar + RoundBtn).

import { crmVoileEncre } from '@/components/crm/tokens'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { type CrmPalette } from '../tokens'
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
  sp: CrmPalette
  dark: boolean
  onTaskClick: (task: ParcoursTask) => void
}

export function PCDossierFrame({
  dossier,
  sp,
  dark,
  onTaskClick,
}: PCDossierFrameProps) {
  const { t: tr } = useTranslation('pipeline')
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

  const bentoFill = dark ? sp.cardBg : 'rgba(255,255,255,0.55)'
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
            gap: 'var(--crm-space-xs)',
            flexShrink: 0,
            minWidth: 0,
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--crm-text-2xl)',
              fontWeight: 600,
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
                fontSize: 'var(--crm-text-sm)',
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
              padding: 'var(--crm-space-2xs) var(--crm-space-md)',
              borderRadius: 'var(--crm-radius-pill)',
              background: u.bg,
              color: u.fg,
              fontSize: 'var(--crm-text-xs)',
              fontWeight: 600,
              letterSpacing: 0.3,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--crm-space-sm)',
                            alignSelf: 'flex-start',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 'var(--crm-radius-pill)',
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
            paddingTop: 'var(--crm-space-md)',
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
              title={tr('journey.actions.addMember')}
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
                  borderRadius: 'var(--crm-radius-pill)',
                  background: dark ? sp.cardBg : '#FFFFFF',
                  border: `2px dashed ${
                    dark ? 'rgba(255,255,255,0.22)' : `${crmVoileEncre(false, 0.20)}`
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
                  fontSize: 'var(--crm-text-xs)',
                  fontWeight: 600,
                  padding: 'var(--crm-space-2xs) var(--crm-space-sm)',
                  borderRadius: 'var(--crm-radius-pill)',
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
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', flexShrink: 0 }}>
          <RoundBtn sp={sp} title={tr('journey.actions.addTask')}>
            <MEIcon name="plus" size={16} color={sp.soft} />
          </RoundBtn>
          <RoundBtn sp={sp} title={tr('journey.actions.shareToNetwork')}>
            <MEIcon name="share" size={16} color={sp.soft} />
          </RoundBtn>
          <RoundBtn sp={sp} title={tr('journey.actions.schedule')}>
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
          gap: 'var(--crm-space-4xl)',
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
  sp: CrmPalette
}

export function PCBigAvatar({ agent, count, badgeColor, sp }: PCBigAvatarProps) {
  const { t: tr } = useTranslation('pipeline')
  const [hover, setHover] = useState(false)
  const baseTitle = tr('journey.avatar.title', {
    firstName: agent.firstName,
    lastName: agent.lastName,
    role: agent.role,
  })
  const title = count
    ? `${baseTitle} · ${tr('journey.avatar.tasksInProgress', { count })}`
    : baseTitle
  return (
    <div
      title={title}
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
          borderRadius: 'var(--crm-radius-pill)',
          background: agent.avatarBg,
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
          fontSize: 'var(--crm-text-xl)',
          fontWeight: 600,
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
          fontSize: 'var(--crm-text-xs)',
          fontWeight: 600,
          padding: 'var(--crm-space-2xs) var(--crm-space-sm)',
          borderRadius: 'var(--crm-radius-pill)',
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
  sp: CrmPalette
}) {
  return (
    <button
      title={title}
      style={{
        width: 38,
        height: 38,
        borderRadius: 'var(--crm-radius-pill)',
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
